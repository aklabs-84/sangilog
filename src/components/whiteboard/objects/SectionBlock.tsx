import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import type { BoardObject } from '../types';

const SECTION_COLORS = [
  { bg: '#F0F9FF', border: '#BAE6FD' }, // sky
  { bg: '#FFF9C4', border: '#FDE047' }, // yellow
  { bg: '#FCE4EC', border: '#F9A8D4' }, // pink
  { bg: '#E8F5E9', border: '#86EFAC' }, // green
  { bg: '#F3E5F5', border: '#D8B4FE' }, // purple
  { bg: '#FFF3E0', border: '#FDB26F' }, // orange
  { bg: '#E3F2FD', border: '#93C5FD' }, // blue
  { bg: '#F1F5F9', border: '#CBD5E1' }, // slate
];

interface Props {
  obj: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (changes: Partial<BoardObject>) => void;
  onDelete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
}

export default function SectionBlock({ obj, isSelected, onSelect, onUpdate, onDelete, onDragStart }: Props) {
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
      {/* 색상 팔레트 툴바 */}
      {isSelected && (
        <div
          style={{ position: 'absolute', top: -44, left: 0, display: 'flex', gap: 4, background: '#1e1e1e', borderRadius: 8, padding: '6px 10px', zIndex: 10000, alignItems: 'center' }}
          onPointerDown={e => e.stopPropagation()}
        >
          {SECTION_COLORS.map((c, i) => (
            <button
              key={i}
              onPointerDown={e => { e.stopPropagation(); onUpdate({ style: { ...obj.style, bgColor: c.bg } }); }}
              style={{
                width: 18, height: 18, borderRadius: 4,
                background: c.bg, border: `2px solid ${c.border}`,
                cursor: 'pointer',
                outline: bgColor === c.bg ? '2px solid #60A5FA' : 'none',
                outlineOffset: 1,
              }}
            />
          ))}
          <div style={{ width: 1, background: '#444', margin: '0 2px', alignSelf: 'stretch' }} />
          <button
            onPointerDown={e => { e.stopPropagation(); onDelete(); }}
            style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

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
