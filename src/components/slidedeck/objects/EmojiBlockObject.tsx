import { useState } from 'react';
import { X } from 'lucide-react';
import type { SlideObject } from '../types';
import EmojiPickerPopover from '../EmojiPickerPopover';

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

export default function EmojiBlockObject({
  obj, isSelected, editable, onSelect, onUpdate, onDelete, onDragStart, onResizeStart,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div
      style={{
        position: 'absolute', left: obj.x, top: obj.y, width: obj.width, height: obj.height,
        zIndex: isSelected ? 9999 : obj.zIndex,
        outline: editable && isSelected ? '2px solid #3B82F6' : 'none',
        cursor: editable ? 'grab' : 'default', userSelect: 'none', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}
      onPointerDown={editable ? e => { onSelect(); onDragStart(e); } : undefined}
      onDoubleClick={editable ? () => setPickerOpen(true) : undefined}
    >
      <span style={{ fontSize: Math.min(obj.width, obj.height) * 0.8, lineHeight: 1 }}>{obj.text || '🙂'}</span>
      {editable && isSelected && (
        <>
          <button
            onPointerDown={e => { e.stopPropagation(); setPickerOpen(true); }}
            style={{ position: 'absolute', top: 4, right: 26, zIndex: 10000, background: '#1e1e1e', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer', fontSize: 11 }}
          >
            변경
          </button>
          <button
            onPointerDown={e => { e.stopPropagation(); onDelete(); }}
            style={{ position: 'absolute', top: 4, right: 4, zIndex: 10000, background: '#EF4444', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer' }}
          >
            <X size={12} />
          </button>
          <div
            onPointerDown={e => { e.stopPropagation(); onResizeStart(e); }}
            style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, cursor: 'se-resize', background: '#3B82F6', borderRadius: '2px 0 6px 0' }}
          />
        </>
      )}
      {pickerOpen && (
        <div style={{ position: 'absolute', top: 28, right: 0 }}>
          <EmojiPickerPopover onSelect={e => onUpdate({ text: e })} onClose={() => setPickerOpen(false)} />
        </div>
      )}
    </div>
  );
}
