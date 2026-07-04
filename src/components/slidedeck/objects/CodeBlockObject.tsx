import { useEffect, useRef, useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import type { SlideObject } from '../types';

interface Props {
  obj: SlideObject;
  isSelected: boolean;
  editable: boolean;
  onSelect: () => void;
  onUpdate: (changes: Partial<SlideObject>) => void;
  onDelete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
}

// 실습 코드를 보여주는 오브젝트. 구문 강조 없이 단색 모노스페이스로 표시하고,
// 발표/편집 화면 모두에서 복사 버튼으로 실제 코드를 클립보드에 복사할 수 있다.
export default function CodeBlockObject({
  obj, isSelected, editable, onSelect, onUpdate, onDelete, onDragStart, onResizeStart,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(obj.text ?? '');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editing) textareaRef.current?.focus(); }, [editing]);

  const startEditing = () => { setDraft(obj.text ?? ''); setEditing(true); };

  const copyCode = () => {
    navigator.clipboard.writeText(obj.text ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const fontSize = obj.style?.fontSize ?? 16;

  return (
    <div
      style={{
        position: 'absolute', left: obj.x, top: obj.y, width: obj.width, height: obj.height,
        zIndex: isSelected ? 9999 : obj.zIndex,
        outline: editable && isSelected ? '2px solid #3B82F6' : 'none',
        cursor: editable ? 'grab' : 'default', userSelect: 'none', boxSizing: 'border-box',
        background: '#1e1e2e', borderRadius: 10, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      }}
      onPointerDown={editable ? e => { onSelect(); if (!editing) onDragStart(e); } : undefined}
      onDoubleClick={editable ? startEditing : undefined}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', background: '#181825', flexShrink: 0,
      }}>
        {editable && isSelected ? (
          <input
            value={obj.codeLang ?? ''}
            placeholder="언어(예: Python)"
            onChange={e => onUpdate({ codeLang: e.target.value })}
            onPointerDown={e => e.stopPropagation()}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#a6adc8', fontSize: 12, width: 110 }}
          />
        ) : (
          <span style={{ color: '#a6adc8', fontSize: 12 }}>{obj.codeLang || '코드'}</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onPointerDown={e => { e.stopPropagation(); copyCode(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: copied ? '#a6e3a1' : '#a6adc8', cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? '복사됨' : '복사'}
          </button>
          {editable && isSelected && (
            <button
              onPointerDown={e => { e.stopPropagation(); onDelete(); }}
              style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer', display: 'flex' }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onPointerDown={e => e.stopPropagation()}
          onBlur={() => { setEditing(false); onUpdate({ text: draft }); }}
          spellCheck={false}
          style={{
            flex: 1, width: '100%', resize: 'none', border: 'none', outline: 'none',
            background: '#1e1e2e', color: '#cdd6f4', fontFamily: "'Fira Code','JetBrains Mono',monospace",
            fontSize, lineHeight: 1.5, padding: 14, whiteSpace: 'pre',
          }}
        />
      ) : (
        <pre style={{
          flex: 1, margin: 0, padding: 14, overflow: 'hidden',
          color: '#cdd6f4', fontFamily: "'Fira Code','JetBrains Mono',monospace",
          fontSize, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {obj.text || (editable ? '더블클릭해서 코드를 입력하세요' : '')}
        </pre>
      )}

      {editable && isSelected && !editing && (
        <div
          onPointerDown={e => { e.stopPropagation(); onResizeStart(e); }}
          style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, cursor: 'se-resize', background: '#3B82F6', borderRadius: '2px 0 6px 0', zIndex: 10000 }}
        />
      )}
    </div>
  );
}
