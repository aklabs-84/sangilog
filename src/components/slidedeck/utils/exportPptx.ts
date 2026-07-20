import PptxGenJS from 'pptxgenjs';
import type { SlideDeck, SlideObject } from '../types';
import { extractYoutubeVideoId } from '../types';
import { renderSlideToImage } from './renderSlideToImage';

// 1280x720 디자인 좌표(96dpi) → PPTX 인치/포인트 변환
const px2in = (px: number) => px / 96;
const px2pt = (px: number) => px * 0.75; // 96dpi 기준 1px = 0.75pt

const stripHash = (hex: string | undefined, fallback: string): string => (hex ?? fallback).replace('#', '');

// 카드형 텍스트/링크/코드 블록의 모서리 둥글기(px)를 pptxgenjs의 rectRadius(0~1, 짧은 변 대비 비율)로 환산
const toRectRadius = (borderRadiusPx: number | undefined, width: number, height: number): number => {
  if (!borderRadiusPx) return 0;
  return Math.min(1, borderRadiusPx / (Math.min(width, height) / 2));
};

async function imageUrlToPngDataUrl(url: string, cache: Map<string, string | null>): Promise<string | null> {
  if (cache.has(url)) return cache.get(url) ?? null;
  const result = await (async () => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('image load failed'));
      });
      img.src = url;
      await loaded;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1;
      canvas.height = img.naturalHeight || 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  })();
  cache.set(url, result);
  return result;
}

async function addObjectToSlide(
  pptxSlide: PptxGenJS.Slide,
  obj: SlideObject,
  fallbackColor: string,
  imageCache: Map<string, string | null>
): Promise<void> {
  const style = obj.style ?? {};
  const x = px2in(obj.x), y = px2in(obj.y), w = px2in(obj.width), h = px2in(obj.height);
  const opacity = style.opacity ?? 1;
  const transparency = Math.round((1 - opacity) * 100);

  if (obj.type === 'text') {
    const hasBg = !!style.background;
    pptxSlide.addText(obj.text || '', {
      x, y, w, h,
      fontSize: px2pt(style.fontSize ?? 24),
      color: stripHash(style.color, stripHash(fallbackColor, '000000')),
      bold: !!style.bold,
      align: style.align ?? 'left',
      valign: 'top',
      fontFace: style.fontFamily,
      fill: hasBg ? { color: stripHash(style.background, 'FFFFFF'), transparency } : undefined,
      transparency,
      shape: hasBg ? 'roundRect' : undefined,
      rectRadius: hasBg ? toRectRadius(style.borderRadius, obj.width, obj.height) : undefined,
      margin: hasBg ? 10 : 0,
      wrap: true,
    });
  } else if (obj.type === 'emoji') {
    pptxSlide.addText(obj.text || '🙂', {
      x, y, w, h,
      fontSize: px2pt(Math.min(obj.width, obj.height) * 0.8),
      align: 'center', valign: 'middle',
      transparency,
    });
  } else if (obj.type === 'link') {
    pptxSlide.addText(
      [
        { text: obj.text || '링크 제목 없음', options: { bold: true, fontSize: 14, color: stripHash(style.color, '3B82F6'), breakLine: true } },
        { text: obj.href || '', options: { fontSize: 11, color: '9CA3AF' } },
      ],
      {
        x, y, w, h, valign: 'middle', margin: 8,
        fill: { color: 'FFFFFF' },
        line: { color: stripHash(style.color, '3B82F6'), width: 1 },
        shape: 'roundRect',
        rectRadius: toRectRadius(style.borderRadius ?? 10, obj.width, obj.height),
        hyperlink: obj.href ? { url: obj.href } : undefined,
      }
    );
  } else if (obj.type === 'code') {
    pptxSlide.addText(obj.text || '', {
      x, y, w, h,
      fontSize: px2pt(style.fontSize ?? 16),
      fontFace: 'Courier New',
      color: 'CDD6F4',
      fill: { color: '1E1E2E' },
      align: 'left', valign: 'top', margin: 10,
      shape: 'roundRect',
      rectRadius: toRectRadius(10, obj.width, obj.height),
      wrap: true,
    });
  } else if (obj.type === 'image' && obj.src) {
    const dataUrl = await imageUrlToPngDataUrl(obj.src, imageCache);
    if (dataUrl) {
      pptxSlide.addImage({
        data: dataUrl, x, y, w, h,
        rounding: style.frame === 'circle',
        rotate: style.rotate ?? 0,
        transparency,
        sizing: { type: 'cover', w, h },
      });
    }
  } else if (obj.type === 'youtube' && obj.src) {
    const videoId = extractYoutubeVideoId(obj.src);
    if (videoId) {
      const dataUrl = await imageUrlToPngDataUrl(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, imageCache);
      if (dataUrl) {
        pptxSlide.addImage({
          data: dataUrl, x, y, w, h,
          sizing: { type: 'cover', w, h },
          hyperlink: { url: `https://www.youtube.com/watch?v=${videoId}` },
        });
      }
    }
  }
}

// 완성된 슬라이드 덱을 파워포인트에서 바로 열고 편집 가능한 .pptx로 내보낸다.
// 배경(색/그라디언트/배경이미지)은 오브젝트 없이 스냅샷 이미지로 굽고, 텍스트/이미지/링크/이모지/코드는
// 실제 편집 가능한 PPTX 오브젝트로 그 위에 배치한다.
export async function exportDeckToPptx(deck: SlideDeck): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = deck.title || '슬라이드';

  const imageCache = new Map<string, string | null>();

  for (const slide of deck.slides) {
    const pptxSlide = pptx.addSlide();
    const bgSnapshot = await renderSlideToImage(slide, { includeObjects: false });
    pptxSlide.background = { data: bgSnapshot };

    const sortedObjects = [...slide.objects].sort((a, b) => a.zIndex - b.zIndex);
    for (const obj of sortedObjects) {
      await addObjectToSlide(pptxSlide, obj, slide.textColor, imageCache);
    }
  }

  await pptx.writeFile({ fileName: `${deck.title || '슬라이드'}.pptx` });
}
