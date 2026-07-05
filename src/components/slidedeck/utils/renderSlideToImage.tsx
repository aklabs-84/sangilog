import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import SlideStage from '../SlideStage';
import type { DeckSlide } from '../types';
import { DECK_CANVAS_W, DECK_CANVAS_H } from '../types';

// 화면에 보이지 않는 곳에 슬라이드를 실제 디자인 해상도(1280x720)로 잠깐 렌더링한 뒤
// html2canvas로 캡처해 PNG data URL로 반환한다. PPT/PDF 내보내기에서 공용으로 사용.
// includeObjects=false면 배경(색/그라디언트/배경이미지)만 캡처 — PPTX 배경 스냅샷용.
export async function renderSlideToImage(
  slide: DeckSlide,
  opts: { includeObjects?: boolean; scale?: number } = {}
): Promise<string> {
  const { includeObjects = true, scale = 2 } = opts;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-10000px';
  container.style.left = '-10000px';
  container.style.width = `${DECK_CANVAS_W}px`;
  container.style.height = `${DECK_CANVAS_H}px`;
  document.body.appendChild(container);

  const root = createRoot(container);
  const slideToRender = includeObjects ? slide : { ...slide, objects: [] };
  root.render(<SlideStage slide={slideToRender} editable={false} />);

  try {
    // 레이아웃/페인트가 반영될 때까지 두 프레임 대기
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      imgs.map(img => img.complete ? Promise.resolve() : new Promise<void>(res => {
        img.onload = () => res();
        img.onerror = () => res();
      }))
    );

    const target = container.firstElementChild as HTMLElement;
    const canvas = await html2canvas(target, {
      scale, useCORS: true, backgroundColor: '#ffffff',
      width: DECK_CANVAS_W, height: DECK_CANVAS_H,
    });
    return canvas.toDataURL('image/png');
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}
