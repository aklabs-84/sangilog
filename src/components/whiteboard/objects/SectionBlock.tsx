import { useState, useRef, useEffect } from 'react';
import type { BoardObject } from '../types';

interface Props {
  obj: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (changes: Partial<BoardObject>) => void;
  onDragStart: (e: React.PointerEvent) => void;
}

export default function SectionBlock({ obj, isSelected, onSelect, onUpdate, onDragStart }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const title = (obj.content.title as string) || '섹션';
  const body = (obj.content.body as string) || '';
  const bgColor = (obj.style.bgColor as string) || '#F0F9FF';
  const opacity = (obj.style.opacity as number) ?? 0.6;

  useEffect(() => { if (editingTitle) titleRef.current?.focus(); }, [editingTitle]);

  return (
    <div
      style={{
        position: 'absolute', left: obj.x, top: obj.y,
        width: obj.width, height: obj.height,
        zIndex: obj.z_index,
        background: bgColor,
        opacity: isSelected ? 1 : opacity,
        border: isSelected ? '2px solid #3B82F6' : '1px solid rgba(0,0,0,0.1)',
        borderRadius: 10,
        display: 'flex', flexDirection: 'column',
        userSelect: 'none',
      }}
      onPointerDown={e => {
        // 텍스트 영역 클릭 시 드래그 방지
        if (e.target === bodyRef.current || e.target === titleRef.current) return;
        onSelect();
        onDragStart(e);
      }}
    >
      {/* 제목 바 */}
      <div
        style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.5)', borderRadius: '9px 9px 0 0', flexShrink: 0, cursor: 'grab' }}
        onPointerDown={e => { onSelect(); onDragStart(e); }}
      >
        {editingTitle ? (
          <input
            ref={titleRef}
            value={title}
            onChange={e => onUpdate({ content: { ...obj.content, title: e.target.value } })}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={e => { if (e.key === 'Enter') setEditingTitle(false); }}
            onPointerDown={e => e.stopPropagation()}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 'bold', color: '#374151', width: '100%' }}
          />
        ) : (
          <span
            onDoubleClick={e => { e.stopPropagation(); setEditingTitle(true); }}
            style={{ fontSize: 13, fontWeight: 'bold', color: '#374151', cursor: 'text', flex: 1 }}
          >
            {title}
          </span>
        )}
      </div>

      {/* 본문 텍스트 영역 */}
      <textarea
        ref={bodyRef}
        value={body}
        onChange={e => onUpdate({ content: { ...obj.content, body: e.target.value } })}
        onPointerDown={e => { e.stopPropagation(); onSelect(); }}
        placeholder="여기에 내용을 입력하세요..."
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'none',
          padding: '10px 12px',
          fontSize: 13,
          color: '#374151',
          lineHeight: 1.6,
          fontFamily: 'inherit',
          cursor: 'text',
        }}
      />

      {/* 리사이즈 핸들 */}
      {isSelected && (
        <div
          onPointerDown={e => {
            e.stopPropagation();
            const startX = e.clientX, startY = e.clientY, startW = obj.width, startH = obj.height;
            const onMove = (ev: PointerEvent) => onUpdate({ width: Math.max(150, startW + ev.clientX - startX), height: Math.max(100, startH + ev.clientY - startY) });
            const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
            window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
          }}
          style={{ position: 'absolute', right: 0, bottom: 0, width: 16, height: 16, cursor: 'se-resize', background: '#3B82F6', borderRadius: '2px 0 8px 0', opacity: 0.8, zIndex: 1 }}
        />
      )}
    </div>
  );
}
