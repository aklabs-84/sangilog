import { supabase } from './supabase';
import heic2any from 'heic2any';

export interface GalleryItem {
  id: string;
  teacher_id: string;
  class_id: string;
  week_number: number | null;
  file_url: string;
  file_type: 'image' | 'video';
  file_name: string | null;
  file_size: number | null;
  caption: string | null;
  created_at: string;
}

export interface VideoUrlInfo {
  platform: 'youtube' | 'drive' | 'direct';
  embedUrl: string;
  thumbnailUrl: string | null;
  label: string;
}

export function parseVideoUrl(url: string): VideoUrlInfo | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // YouTube (watch, shorts, youtu.be)
  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return {
      platform: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
      thumbnailUrl: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
      label: 'YouTube',
    };
  }

  // Google Drive
  const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return {
      platform: 'drive',
      embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
      thumbnailUrl: null,
      label: '구글 드라이브',
    };
  }

  // 직접 URL (기본 형식 검증)
  try {
    new URL(trimmed);
    return { platform: 'direct', embedUrl: trimmed, thumbnailUrl: null, label: '직접 링크' };
  } catch {
    return null;
  }
}

export async function fetchGalleryItems(
  teacherId: string,
  classId: string,
  weekNumber?: number | null
): Promise<GalleryItem[]> {
  let query = supabase
    .from('class_gallery_items')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('class_id', classId)
    .order('created_at', { ascending: false });

  if (weekNumber != null) {
    query = query.eq('week_number', weekNumber);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function countGalleryItems(teacherId: string): Promise<number> {
  const { count, error } = await supabase
    .from('class_gallery_items')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', teacherId);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteGalleryItem(id: string, fileUrl: string): Promise<void> {
  // Supabase storage에 저장된 파일만 삭제 시도
  try {
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/class-gallery/');
    if (pathParts.length === 2) {
      await supabase.storage.from('class-gallery').remove([pathParts[1]]);
    }
  } catch {
    // 외부 URL(YouTube 등)은 storage 삭제 불필요
  }
  const { error } = await supabase.from('class_gallery_items').delete().eq('id', id);
  if (error) throw error;
}

export async function updateCaption(id: string, caption: string): Promise<void> {
  const { error } = await supabase
    .from('class_gallery_items')
    .update({ caption })
    .eq('id', id);
  if (error) throw error;
}

export async function addVideoLink(
  teacherId: string,
  classId: string,
  weekNumber: number | null,
  videoUrl: string
): Promise<GalleryItem> {
  const info = parseVideoUrl(videoUrl);
  if (!info) throw new Error('올바른 URL 형식이 아닙니다.');

  const { data, error } = await supabase
    .from('class_gallery_items')
    .insert({
      teacher_id: teacherId,
      class_id: classId,
      week_number: weekNumber,
      file_url: videoUrl.trim(),
      file_type: 'video',
      file_name: info.label,
      file_size: null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── 이미지 → WebP 변환 + 리사이즈 (최대 1920x1080) ────────────────────────
export async function compressImage(file: File, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_W = 1920;
      const MAX_H = 1080;
      let { width, height } = img;
      if (width > MAX_W || height > MAX_H) {
        const ratio = Math.min(MAX_W / width, MAX_H / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not supported'));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Compression failed'));
          resolve(blob);
        },
        'image/webp',
        quality
      );
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

export async function uploadGalleryItem(
  teacherId: string,
  classId: string,
  weekNumber: number | null,
  file: File
): Promise<GalleryItem> {
  const isHeic = /\.(heic|heif)$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';

  let sourceFile: File = file;
  if (isHeic) {
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    sourceFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
  }

  if (!sourceFile.type.startsWith('image/')) throw new Error('이미지 파일만 업로드할 수 있습니다.');

  const path = `${teacherId}/${classId}/${Date.now()}.webp`;
  const uploadBlob = await compressImage(sourceFile);

  const { error: uploadError } = await supabase.storage
    .from('class-gallery')
    .upload(path, uploadBlob, { contentType: 'image/webp' });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('class-gallery').getPublicUrl(path);

  const { data, error } = await supabase
    .from('class_gallery_items')
    .insert({
      teacher_id: teacherId,
      class_id: classId,
      week_number: weekNumber,
      file_url: urlData.publicUrl,
      file_type: 'image',
      file_name: sourceFile.name,
      file_size: uploadBlob.size,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
