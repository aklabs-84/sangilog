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
  source?: 'upload' | 'drive';
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

// ── 구글 드라이브 폴더 연동 ────────────────────────────────────────────────

export interface DriveFolderLink {
  folder_url: string;
  folder_id: string;
  folder_name?: string;
}

export interface DriveFolderApiItem {
  id: string;
  name: string;
  type: 'image' | 'video';
  createdTime: string;
}

export async function fetchDriveFolderItems(folderId: string): Promise<DriveFolderApiItem[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('로그인이 필요합니다.');

  const res = await fetch(`/api/drive-folder?folderId=${encodeURIComponent(folderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? '구글 드라이브 폴더 조회에 실패했습니다.');
  return data.items ?? [];
}

export async function getDriveFolderLink(
  classId: string,
  weekNumber: number | null
): Promise<DriveFolderLink | null> {
  let query = supabase
    .from('class_gallery_drive_folders')
    .select('folder_url, folder_id')
    .eq('class_id', classId);

  query = weekNumber == null ? query.is('week_number', null) : query.eq('week_number', weekNumber);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function setDriveFolderLink(
  teacherId: string,
  classId: string,
  weekNumber: number | null,
  folderId: string,
  folderName: string
): Promise<DriveFolderLink> {
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

  const { error } = await supabase
    .from('class_gallery_drive_folders')
    .upsert(
      {
        teacher_id: teacherId,
        class_id: classId,
        week_number: weekNumber,
        folder_url: folderUrl,
        folder_id: folderId,
      },
      { onConflict: 'class_id, week_number' }
    );
  if (error) throw error;
  // folder_name은 DB에 저장하지 않음 (선택 직후 UI 표시용) — Picker에서 다시 선택하면 항상 최신 이름을 받는다.
  return { folder_url: folderUrl, folder_id: folderId, folder_name: folderName };
}

export async function removeDriveFolderLink(classId: string, weekNumber: number | null): Promise<void> {
  let query = supabase.from('class_gallery_drive_folders').delete().eq('class_id', classId);
  query = weekNumber == null ? query.is('week_number', null) : query.eq('week_number', weekNumber);
  const { error } = await query;
  if (error) throw error;
}

// 드라이브 폴더 파일을 기존 GalleryItem 형태로 합성 (기존 카드/라이트박스/영상 플레이어 재사용)
export function driveItemToGalleryItem(
  item: DriveFolderApiItem,
  teacherId: string,
  classId: string,
  weekNumber: number | null
): GalleryItem {
  return {
    id: `drive-${item.id}`,
    teacher_id: teacherId,
    class_id: classId,
    week_number: weekNumber,
    file_url:
      item.type === 'image'
        ? `https://drive.google.com/thumbnail?id=${item.id}&sz=w1600`
        : `https://drive.google.com/file/d/${item.id}/view`,
    file_type: item.type,
    file_name: item.name,
    file_size: null,
    caption: null,
    created_at: item.createdTime,
    source: 'drive',
  };
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
