import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { downloadFile } from '../../lib/fileUtils';

interface ImageCarouselProps {
  urls: string[];
  names?: string[];
  alt?: string;
  thumbClassName?: string;
  onThumbClick?: () => void;
}

// 결과 제출물 이미지 1~N장을 썸네일(대표 이미지 + 장수 배지)로 보여주고,
// 클릭 시 좌우 화살표로 넘겨볼 수 있는 전체화면 뷰어를 띄운다.
export function ImageCarousel({ urls, names, alt, thumbClassName, onThumbClick }: ImageCarouselProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (urls.length === 0) return null;

  return (
    <>
      <div
        className="relative inline-block cursor-pointer"
        onClick={() => { onThumbClick?.(); setLightboxIndex(0); }}
      >
        <img
          src={urls[0]}
          alt={alt || '이미지'}
          className={thumbClassName || 'max-h-24 rounded-xl object-cover'}
        />
        {urls.length > 1 && (
          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            1/{urls.length}
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            onClick={() => setLightboxIndex(null)}
          >
            <X size={20} />
          </button>
          <button
            className="absolute top-4 right-16 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); downloadFile(urls[lightboxIndex], names?.[lightboxIndex] || `image-${lightboxIndex + 1}.jpg`); }}
            title="다운로드"
          >
            <Download size={18} />
          </button>
          {urls.length > 1 && (
            <button
              className="absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i === null ? null : (i - 1 + urls.length) % urls.length)); }}
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <img
            src={urls[lightboxIndex]}
            alt={alt || '확대 보기'}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {urls.length > 1 && (
            <button
              className="absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i === null ? null : (i + 1) % urls.length)); }}
            >
              <ChevronRight size={22} />
            </button>
          )}
          {urls.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              {lightboxIndex + 1} / {urls.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// storage_paths(배열, 신규) 또는 storage_path(단일, 레거시)로부터 public URL 배열을 만든다.
export function getResultImagePublicUrls(
  storage: { from: (bucket: string) => { getPublicUrl: (path: string) => { data: { publicUrl: string } } } },
  row: { storage_paths?: string[] | null; storage_path?: string | null } | null | undefined,
  bucket = 'student-attachments'
): string[] {
  if (!row) return [];
  const paths = (row.storage_paths && row.storage_paths.length > 0)
    ? row.storage_paths
    : (row.storage_path ? [row.storage_path] : []);
  return paths.map((p) => storage.from(bucket).getPublicUrl(p).data.publicUrl);
}
