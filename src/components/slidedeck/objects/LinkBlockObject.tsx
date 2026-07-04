import { X, Link2 } from 'lucide-react';
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

// 편집 화면에는 아직 발표 모드가 없을 때도 있어 클릭=즉시 이동은 위험 — 선택 시 툴바의
// "새 탭에서 열기"로만 이동하고, 실제 클릭 이동은 PresentationView(발표 보기)에서만 동작한다.
export default function LinkBlockObject({
  obj, isSelected, editable, onSelect, onUpdate, onDelete, onDragStart, onResizeStart,
}: Props) {
  const style = obj.style ?? {};

  const openLink = () => {
    if (!obj.href) return;
    window.open(obj.href, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      style={{
        position: 'absolute', left: obj.x, top: obj.y, width: obj.width, height: obj.height,
        zIndex: isSelected ? 9999 : obj.zIndex,
        outline: editable && isSelected ? '2px solid #3B82F6' : 'none',
        cursor: editable ? 'grab' : obj.href ? 'pointer' : 'default',
        userSelect: 'none', boxSizing: 'border-box', overflow: 'hidden',
        background: style.background ?? '#fff',
        border: '1px solid ' + (style.color ?? '#3B82F6'),
        borderRadius: style.borderRadius ?? 10,
        display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
      }}
      onPointerDown={editable ? e => { onSelect(); onDragStart(e); } : undefined}
      onClick={!editable ? e => { e.stopPropagation(); openLink(); } : undefined}
    >
      <Link2 size={18} color={style.color ?? '#3B82F6'} style={{ flexShrink: 0 }} />
      {editable && isSelected ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }} onPointerDown={e => e.stopPropagation()}>
          <input
            value={obj.text ?? ''}
            placeholder="링크 제목"
            onChange={e => onUpdate({ text: e.target.value })}
            style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 6px', fontSize: 13, fontWeight: 600 }}
          />
          <input
            value={obj.href ?? ''}
            placeholder="https://..."
            onChange={e => onUpdate({ href: e.target.value })}
            style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 6px', fontSize: 12, color: '#6b7280' }}
          />
        </div>
      ) : (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: style.color ?? '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {obj.text || '링크 제목 없음'}
          </div>
          <div style={{ fontSize: 12, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {obj.href || '주소를 입력하세요'}
          </div>
        </div>
      )}
      {editable && isSelected && (
        <>
          <button
            onPointerDown={e => { e.stopPropagation(); openLink(); }}
            style={{ position: 'absolute', top: 4, right: 26, zIndex: 10000, background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer', fontSize: 11 }}
          >
            새 탭에서 열기
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
    </div>
  );
}
