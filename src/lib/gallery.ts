import { supabase } from './supabase';
import heic2any from 'heic2any';
import type { FFmpeg as FFmpegType } from '@ffmpeg/ffmpeg';

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
  // Storage path는 URL에서 bucket 이후 경로 추출
  const url = new URL(fileUrl);
  const pathParts = url.pathname.split('/class-gallery/');
  if (pathParts.length === 2) {
    await supabase.storage.from('class-gallery').remove([pathParts[1]]);
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

// ── 영상 압축 (FFmpeg.wasm) ─────────────────────────────────────────────────

export const VIDEO_COMPRESS_THRESHOLD = 49 * 1024 * 1024; // 49MB 초과 시 압축 (Supabase 무료 50MB 제한)
export const SUPABASE_VIDEO_LIMIT = 50 * 1024 * 1024;    // Supabase 버킷 파일 크기 제한

let _ffmpeg: FFmpegType | null = null;

async function loadFFmpeg(): Promise<FFmpegType> {
  if (_ffmpeg?.loaded) return _ffmpeg;
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');
  const ffmpeg = new FFmpeg();
  // ESM 빌드 사용 — UMD는 동적 import() 불가, ESM만 작동
  const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  _ffmpeg = ffmpeg;
  return ffmpeg;
}

export async function compressVideo(
  file: File,
  onProgress: (pct: number) => void,
  onPhase: (phase: 'loading' | 'compressing') => void
): Promise<Blob> {
  onPhase('loading');
  const ffmpeg = await loadFFmpeg();
  const { fetchFile } = await import('@ffmpeg/util');

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'mp4';
  const inputName = `in.${ext}`;
  const outputName = 'out.mp4';

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const handler = ({ progress }: { progress: number }) => {
    onProgress(Math.min(Math.round(progress * 100), 99));
  };
  ffmpeg.on('progress', handler);
  onPhase('compressing');

  // 480p + 비트레이트 캡 → Supabase 무료 50MB 제한 내 압축
  await ffmpeg.exec([
    '-i', inputName,
    '-vf', 'scale=854:-2',
    '-c:v', 'libx264',
    '-crf', '30',
    '-preset', 'fast',
    '-maxrate', '1500k',
    '-bufsize', '3000k',
    '-c:a', 'aac',
    '-b:a', '64k',
    '-movflags', '+faststart',
    outputName,
  ]);

  ffmpeg.off('progress', handler);

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile(outputName).catch(() => {});

  // SharedArrayBuffer 호환성: 새 Uint8Array에 복사하여 일반 ArrayBuffer로 변환
  const src = data as Uint8Array;
  const copy = new Uint8Array(src.length);
  copy.set(src);
  return new Blob([copy], { type: 'video/mp4' });
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

  const isImage = sourceFile.type.startsWith('image/');
  const isVideo = sourceFile.type.startsWith('video/');
  if (!isImage && !isVideo) throw new Error('이미지 또는 영상 파일만 업로드할 수 있습니다.');

  const ext = isImage ? 'webp' : sourceFile.name.split('.').pop() ?? 'mp4';
  const path = `${teacherId}/${classId}/${Date.now()}.${ext}`;

  let uploadBlob: Blob = sourceFile;
  if (isImage) {
    uploadBlob = await compressImage(sourceFile);
  }

  const { error: uploadError } = await supabase.storage
    .from('class-gallery')
    .upload(path, uploadBlob, { contentType: isImage ? 'image/webp' : sourceFile.type });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('class-gallery').getPublicUrl(path);

  const { data, error } = await supabase
    .from('class_gallery_items')
    .insert({
      teacher_id: teacherId,
      class_id: classId,
      week_number: weekNumber,
      file_url: urlData.publicUrl,
      file_type: isImage ? 'image' : 'video',
      file_name: sourceFile.name,
      file_size: uploadBlob.size,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
