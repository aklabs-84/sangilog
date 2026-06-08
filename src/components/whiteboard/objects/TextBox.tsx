import { useState, useRef, useEffect } from 'react';
import { X, Bold, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import type { BoardObject } from '../types';

interface Props {
  obj: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (changes: Partial<BoardObject>) => void;
  onDelete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
}

export default function TextBox({ obj, isSelected, onSelect, onUpdate, onDelete, onDragStart }: Props) {
  const [editing, setEditing] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fontSize = (obj.style.fontSize as number) || 16;
  const fontWeight = (obj.style.fontWeight as string) || 'normal';
  const textAlign = (obj.style.textAlign as string) || 'left';

  useEffect(() => {
    if (editing) textRef.current?.focus();
  }, [editing]);

  return (
    <div
      style={{
        position: 'absolute',
        left: obj.x, top: obj.y,
        width: obj.width, height: obj.height,
        zIndex: isSelected ? 9999 : obj.z_index,
        border: isSelected ? '2px solid #3B82F6' : '1px dashed #ccc',
        borderRadius: 4,
        background: 'transparent',
        cursor: editing ? 'text' : 'grab',
        userSelect: editing ? 'text' : 'none',
      }}
      onPointerDown={e => { if (editing) return; onSelect(); onDragStart(e); }}
      onDoubleClick={() => { onSelect(); setEditing(true); }}
    >
      {isSelected && (
        <div style={{ position: 'absolute', top: -36, left: 0, display: 'flex', gap: 4, background: '#1e1e1e', borderRadius: 6, padding: '3px 6px', zIndex: 10000 }}>
          <button onPointerDown={e => { e.stopPropagation(); onUpdate({ style: { ...obj.style, fontWeight: fontWeight === 'bold' ? 'normal' : 'bold' } }); }}
            style={{ color: fontWeight === 'bold' ? '#60A5FA' : '#fff', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
            <Bold size={13} />
          </button>
          {[{ icon: <AlignLeft size={13} />, v: 'left' }, { icon: <AlignCenter size={13} />, v: 'center' }, { icon: <AlignRight size={13} />, v: 'right' }].map(btn => (
            <button key={btn.v} onPointerDown={e => { e.stopPropagation(); onUpdate({ style: { ...obj.style, textAlign: btn.v } }); }}
              style={{ color: textAlign === btn.v ? '#60A5FA' : '#fff', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
              {btn.icon}
            </button>
          ))}
          {[12, 16, 20, 24, 32].map(s => (
            <button key={s} onPointerDown={e => { e.stopPropagation(); onUpdate({ style: { ...obj.style, fontSize: s } }); }}
              style={{ color: fontSize === s ? '#60A5FA' : '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: '2px 3px' }}>
              {s}
            </button>
          ))}
          <button onPointerDown={e => { e.stopPropagation(); onDelete(); }}
            style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', marginLeft: 4 }}>
            <X size={13} />
          </button>
        </div>
      )}
      {editing ? (
        <textarea
          ref={textRef}
          value={(obj.content.text as string) || ''}
          onChange={e => onUpdate({ content: { ...obj.content, text: e.target.value } })}
          onBlur={() => setEditing(false)}
          style={{
            width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none',
            resize: 'none', padding: 6, fontSize, fontWeight, textAlign: textAlign as CanvasTextAlign,
            fontFamily: 'inherit', color: '#1a1a1a', lineHeight: 1.5,
          }}
        />
      ) : (
        <div style={{ padding: 6, fontSize, fontWeight, textAlign: textAlign as CanvasTextAlign, color: '#1a1a1a', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
          {(obj.content.text as string) || <span style={{ color: '#bbb' }}>텍스트 입력</span>}
        </div>
      )}
      {isSelected && (
        <div
          onPointerDown={e => {
            e.stopPropagation();
            const startX = e.clientX, startY = e.clientY, startW = obj.width, startH = obj.height;
            const onMove = (ev: PointerEvent) => onUpdate({ width: Math.max(100, startW + ev.clientX - startX), height: Math.max(40, startH + ev.clientY - startY) });
            const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
            window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
          }}
          style={{ position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, cursor: 'se-resize', background: '#3B82F6', borderRadius: '2px 0 4px 0' }}
        />
      )}
    </div>
  );
}
