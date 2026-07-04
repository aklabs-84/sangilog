import { useEffect, useRef, useState } from 'react';
import type { DeckSlide, SlideObject } from './types';
import { DECK_CANVAS_W, DECK_CANVAS_H } from './types';
import TextBlockObject from './objects/TextBlockObject';
import ImageBlockObject from './objects/ImageBlockObject';
import LinkBlockObject from './objects/LinkBlockObject';
import EmojiBlockObject from './objects/EmojiBlockObject';
import CodeBlockObject from './objects/CodeBlockObject';

interface Props {
  slide: DeckSlide;
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onUpdateObject?: (id: string, changes: Partial<SlideObject>) => void;
  onDeleteObject?: (id: string) => void;
}

// 1280x720 디자인 좌표계를 실제 화면 크기에 맞춰 transform: scale() 로 축소/확대해 보여주는 캔버스.
// 드래그/리사이즈 델타도 이 scale 값으로 나눠 디자인 좌표로 환산한다.
export default function SlideStage({ slide, editable = false, selectedId = null, onSelect, onUpdateObject, onDeleteObject }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? DECK_CANVAS_W;
      const s = w / DECK_CANVAS_W;
      scaleRef.current = s;
      setScale(s);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const startDrag = (obj: SlideObject) => (e: React.PointerEvent) => {
    if (!editable || !onUpdateObject) return;
    const startX = e.clientX, startY = e.clientY;
    const startObjX = obj.x, startObjY = obj.y;
    const onMove = (ev: PointerEvent) => {
      const s = scaleRef.current || 1;
      const dx = (ev.clientX - startX) / s;
      const dy = (ev.clientY - startY) / s;
      const nx = Math.min(Math.max(0, startObjX + dx), DECK_CANVAS_W - obj.width);
      const ny = Math.min(Math.max(0, startObjY + dy), DECK_CANVAS_H - obj.height);
      onUpdateObject(obj.id, { x: nx, y: ny });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startResize = (obj: SlideObject) => (e: React.PointerEvent) => {
    if (!editable || !onUpdateObject) return;
    const startX = e.clientX, startY = e.clientY;
    const startW = obj.width, startH = obj.height;
    const onMove = (ev: PointerEvent) => {
      const s = scaleRef.current || 1;
      const dx = (ev.clientX - startX) / s;
      const dy = (ev.clientY - startY) / s;
      const nw = Math.min(Math.max(40, startW + dx), DECK_CANVAS_W - obj.x);
      const nh = Math.min(Math.max(30, startH + dy), DECK_CANVAS_H - obj.y);
      onUpdateObject(obj.id, { width: nw, height: nh });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div ref={wrapRef} style={{ width: '100%', aspectRatio: `${DECK_CANVAS_W} / ${DECK_CANVAS_H}`, position: 'relative', overflow: 'hidden' }}>
      <div
        onPointerDown={editable ? (e) => { if (e.target === e.currentTarget) onSelect?.(null); } : undefined}
        style={{
          width: DECK_CANVAS_W, height: DECK_CANVAS_H,
          transform: `scale(${scale})`, transformOrigin: 'top left',
          background: slide.bg, position: 'relative',
        }}
      >
        {slide.objects.slice().sort((a, b) => a.zIndex - b.zIndex).map(obj => (
          obj.type === 'text' ? (
            <TextBlockObject
              key={obj.id}
              obj={obj}
              isSelected={editable && selectedId === obj.id}
              editable={editable}
              fallbackColor={slide.textColor}
              onSelect={() => onSelect?.(obj.id)}
              onUpdate={changes => onUpdateObject?.(obj.id, changes)}
              onDelete={() => onDeleteObject?.(obj.id)}
              onDragStart={startDrag(obj)}
              onResizeStart={startResize(obj)}
            />
          ) : obj.type === 'image' ? (
            <ImageBlockObject
              key={obj.id}
              obj={obj}
              isSelected={editable && selectedId === obj.id}
              editable={editable}
              onSelect={() => onSelect?.(obj.id)}
              onUpdate={changes => onUpdateObject?.(obj.id, changes)}
              onDelete={() => onDeleteObject?.(obj.id)}
              onDragStart={startDrag(obj)}
              onResizeStart={startResize(obj)}
            />
          ) : obj.type === 'link' ? (
            <LinkBlockObject
              key={obj.id}
              obj={obj}
              isSelected={editable && selectedId === obj.id}
              editable={editable}
              onSelect={() => onSelect?.(obj.id)}
              onUpdate={changes => onUpdateObject?.(obj.id, changes)}
              onDelete={() => onDeleteObject?.(obj.id)}
              onDragStart={startDrag(obj)}
              onResizeStart={startResize(obj)}
            />
          ) : obj.type === 'emoji' ? (
            <EmojiBlockObject
              key={obj.id}
              obj={obj}
              isSelected={editable && selectedId === obj.id}
              editable={editable}
              onSelect={() => onSelect?.(obj.id)}
              onUpdate={changes => onUpdateObject?.(obj.id, changes)}
              onDelete={() => onDeleteObject?.(obj.id)}
              onDragStart={startDrag(obj)}
              onResizeStart={startResize(obj)}
            />
          ) : (
            <CodeBlockObject
              key={obj.id}
              obj={obj}
              isSelected={editable && selectedId === obj.id}
              editable={editable}
              onSelect={() => onSelect?.(obj.id)}
              onUpdate={changes => onUpdateObject?.(obj.id, changes)}
              onDelete={() => onDeleteObject?.(obj.id)}
              onDragStart={startDrag(obj)}
              onResizeStart={startResize(obj)}
            />
          )
        ))}
      </div>
    </div>
  );
}
