import { Plus, Trash2, Copy } from 'lucide-react';
import type { DeckSlide } from './types';
import SlideStage from './SlideStage';

interface Props {
  slides: DeckSlide[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
}

export default function SlideThumbnailRail({ slides, activeIndex, onSelect, onAdd, onDuplicate, onDelete }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 168, flexShrink: 0, overflowY: 'auto', padding: '4px 2px' }}>
      {slides.map((slide, i) => (
        <div key={slide.id} style={{ position: 'relative' }}>
          <div
            onClick={() => onSelect(i)}
            style={{
              border: i === activeIndex ? '2px solid #3B82F6' : '1px solid #e5e7eb',
              borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
            }}
          >
            <SlideStage slide={slide} editable={false} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{i + 1}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => onDuplicate(i)} title="복제" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2 }}>
                <Copy size={13} />
              </button>
              {slides.length > 1 && (
                <button onClick={() => onDelete(i)} title="삭제" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={onAdd}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          border: '1px dashed #cbd5e1', borderRadius: 8, padding: '10px 0', color: '#64748b',
          background: 'none', cursor: 'pointer', fontSize: 12,
        }}
      >
        <Plus size={14} /> 슬라이드 추가
      </button>
    </div>
  );
}
