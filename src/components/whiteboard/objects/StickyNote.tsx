import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import type { BoardObject } from '../types';
import { STICKY_COLORS } from '../types';

interface Props {
  obj: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (changes: Partial<BoardObject>) => void;
  onDelete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
}

export default function StickyNote({ obj, isSelected, onSelect, onUpdate, onDelete, onDragStart }: Props) {
  const [editing, setEditing] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const colorKey = (obj.style.color as string) || 'yellow';
  const colorDef = STICKY_COLORS.find(c => c.key === colorKey) ?? STICKY_COLORS[0];

  useEffect(() => {
    if (editing) textRef.current?.focus();
  }, [editing]);

  return (
    <div
      style={{
        position: 'absolute',
        left: obj.x,
        top: obj.y,
        width: obj.width,
        height: obj.height,
        zIndex: isSelected ? 9999 : obj.z_index,
        background: colorDef.bg,
        border: `2px solid ${isSelected ? '#3B82F6' : colorDef.border}`,
        borderRadius: 6,
        boxShadow: isSelected ? '0 0 0 2px #3B82F680' : '2px 3px 8px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        cursor: editing ? 'text' : 'grab',
        userSelect: editing ? 'text' : 'none',
      }}
      onPointerDown={(e) => {
        if (editing) return;
        onSelect();
        onDragStart(e);
      }}
      onDoubleClick={() => { onSelect(); setEditing(true); }}
    >
      {/* 색상 선택 바 */}
      {isSelected && (
        <div style={{ display: 'flex', gap: 4, padding: '4px 6px', borderBottom: `1px solid ${colorDef.border}` }}>
          {STICKY_COLORS.map(c => (
            <button
              key={c.key}
              onPointerDown={e => { e.stopPropagation(); onUpdate({ style: { ...obj.style, color: c.key } }); }}
              style={{
                width: 16, height: 16, borderRadius: '50%',
                background: c.bg, border: `2px solid ${c.border}`,
                cursor: 'pointer', outline: colorKey === c.key ? `2px solid #3B82F6` : 'none',
              }}
            />
          ))}
          <button
            onPointerDown={e => { e.stopPropagation(); onDelete(); }}
            style={{ marginLeft: 'auto', color: '#EF4444', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            <X size={14} />
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
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            resize: 'none', padding: 8, fontSize: 14, fontFamily: 'inherit',
            color: '#1a1a1a', lineHeight: 1.5,
          }}
        />
      ) : (
        <div style={{ flex: 1, padding: 8, fontSize: 14, color: '#1a1a1a', lineHeight: 1.5, overflowWrap: 'break-word', overflowY: 'hidden', whiteSpace: 'pre-wrap' }}>
          {(obj.content.text as string) || <span style={{ color: '#aaa' }}>더블클릭해서 입력</span>}
        </div>
      )}
      {/* 리사이즈 핸들 */}
      {isSelected && (
        <div
          onPointerDown={e => {
            e.stopPropagation();
            const startX = e.clientX, startY = e.clientY;
            const startW = obj.width, startH = obj.height;
            const onMove = (ev: PointerEvent) => {
              onUpdate({ width: Math.max(120, startW + ev.clientX - startX), height: Math.max(80, startH + ev.clientY - startY) });
            };
            const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
          }}
          style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, cursor: 'se-resize', background: colorDef.border, borderRadius: '2px 0 4px 0', opacity: 0.7 }}
        />
      )}
    </div>
  );
}
