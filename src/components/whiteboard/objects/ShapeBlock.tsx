import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import type { BoardObject } from '../types';

interface Props {
  obj: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (changes: Partial<BoardObject>) => void;
  onDelete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
}

const SHAPE_COLORS = ['#DBEAFE', '#FCE7F3', '#D1FAE5', '#FEF3C7', '#EDE9FE', '#FFE4E6'];
const BORDER_COLORS = ['#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#F43F5E'];

export default function ShapeBlock({ obj, isSelected, onSelect, onUpdate, onDelete, onDragStart }: Props) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shape = (obj.style.shape as string) || 'rect';
  const bgColor = (obj.style.bgColor as string) || '#DBEAFE';
  const borderColor = (obj.style.borderColor as string) || '#3B82F6';
  const text = (obj.content.text as string) || '';

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const clipPath = shape === 'diamond'
    ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
    : undefined;
  const borderRadius = shape === 'circle' ? '50%' : 8;

  return (
    <div
      style={{
        position: 'absolute', left: obj.x, top: obj.y,
        width: obj.width, height: obj.height,
        zIndex: isSelected ? 9999 : obj.z_index,
        cursor: editing ? 'text' : 'grab', userSelect: 'none',
      }}
      onPointerDown={e => { if (editing) return; onSelect(); onDragStart(e); }}
      onDoubleClick={() => { onSelect(); setEditing(true); }}
    >
      <div style={{ width: '100%', height: '100%', background: bgColor, border: `2px solid ${isSelected ? '#3B82F6' : borderColor}`, borderRadius, clipPath, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isSelected ? '0 0 0 2px #3B82F680' : '1px 2px 4px rgba(0,0,0,0.1)' }}>
        {editing ? (
          <input ref={inputRef} value={text} onChange={e => onUpdate({ content: { ...obj.content, text: e.target.value } })} onBlur={() => setEditing(false)}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center', width: '80%' }} />
        ) : (
          <span style={{ fontSize: 14, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center', padding: '0 8px' }}>
            {text || <span style={{ color: '#bbb', fontWeight: 'normal' }}>더블클릭</span>}
          </span>
        )}
      </div>

      {isSelected && (
        <div style={{ position: 'absolute', top: -40, left: 0, display: 'flex', gap: 4, background: '#1e1e1e', borderRadius: 6, padding: '4px 8px', zIndex: 10000 }}>
          {(['rect', 'circle', 'diamond'] as const).map(s => (
            <button key={s} onPointerDown={e => { e.stopPropagation(); onUpdate({ style: { ...obj.style, shape: s } }); }}
              style={{ color: shape === s ? '#60A5FA' : '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: '2px 5px' }}>
              {s === 'rect' ? '■' : s === 'circle' ? '●' : '◆'}
            </button>
          ))}
          <div style={{ width: 1, background: '#444', margin: '0 2px' }} />
          {SHAPE_COLORS.map((c, i) => (
            <button key={c} onPointerDown={e => { e.stopPropagation(); onUpdate({ style: { ...obj.style, bgColor: c, borderColor: BORDER_COLORS[i] } }); }}
              style={{ width: 16, height: 16, background: c, border: `2px solid ${BORDER_COLORS[i]}`, borderRadius: 3, cursor: 'pointer', outline: bgColor === c ? '2px solid #fff' : 'none' }} />
          ))}
          <button onPointerDown={e => { e.stopPropagation(); onDelete(); }}
            style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', marginLeft: 4 }}>
            <X size={13} />
          </button>
        </div>
      )}
      {isSelected && (
        <div
          onPointerDown={e => {
            e.stopPropagation();
            const startX = e.clientX, startY = e.clientY, startW = obj.width, startH = obj.height;
            const onMove = (ev: PointerEvent) => onUpdate({ width: Math.max(80, startW + ev.clientX - startX), height: Math.max(60, startH + ev.clientY - startY) });
            const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
            window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
          }}
          style={{ position: 'absolute', right: -4, bottom: -4, width: 12, height: 12, cursor: 'se-resize', background: '#3B82F6', borderRadius: 2, zIndex: 10001 }}
        />
      )}
    </div>
  );
}
