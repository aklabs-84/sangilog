import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DeckSlide } from './types';
import SlideStage from './SlideStage';

interface Props {
  slides: DeckSlide[];
  startIndex: number;
  onClose: () => void;
}

// 슬라이드를 전체화면으로 넘겨보는 발표 보기 모드. 편집은 불가능하고,
// 링크 오브젝트는 여기서만 클릭 시 바로 새 탭으로 열린다.
export default function PresentationView({ slides, startIndex, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);

  const goNext = () => setIndex(i => Math.min(i + 1, slides.length - 1));
  const goPrev = () => setIndex(i => Math.max(i - 1, 0));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setIndex(i => Math.min(i + 1, slides.length - 1));
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length, onClose]);

  const slide = slides[index];
  if (!slide) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 'min(92vw, calc(92vh * 16 / 9))' }} onClick={goNext}>
        <SlideStage slide={slide} editable={false} />
      </div>

      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, color: '#fff', cursor: 'pointer' }}>
        <X size={20} />
      </button>

      <button
        onClick={e => { e.stopPropagation(); goPrev(); }}
        disabled={index === 0}
        style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, color: '#fff', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 1 }}
      >
        <ChevronLeft size={22} />
      </button>
      <button
        onClick={e => { e.stopPropagation(); goNext(); }}
        disabled={index === slides.length - 1}
        style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, color: '#fff', cursor: index === slides.length - 1 ? 'default' : 'pointer', opacity: index === slides.length - 1 ? 0.3 : 1 }}
      >
        <ChevronRight size={22} />
      </button>

      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: '#fff', fontSize: 13, opacity: 0.7 }}>
        {index + 1} / {slides.length}
      </div>
    </div>,
    document.body
  );
}
