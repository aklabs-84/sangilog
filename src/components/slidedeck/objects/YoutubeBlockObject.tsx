import { X, SquarePlay, Play } from 'lucide-react';
import type { SlideObject } from '../types';
import { extractYoutubeVideoId } from '../types';

interface Props {
  obj: SlideObject;
  isSelected: boolean;
  editable: boolean;
  onSelect: () => void;
  onUpdate: (changes: Partial<SlideObject>) => void;
  onDelete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  captureMode?: boolean;  // true면 항상 썸네일만 그림(PDF/PPTX 내보내기·썸네일 캡처용 — iframe은 캡처 불가)
}

// 편집 화면과 캡처(내보내기)에서는 항상 썸네일만 보여주고, 실제 영상 재생은
// 발표 모드(editable=false, captureMode=false)에서만 iframe으로 렌더링한다.
export default function YoutubeBlockObject({
  obj, isSelected, editable, onSelect, onUpdate, onDelete, onDragStart, onResizeStart, captureMode,
}: Props) {
  const style = obj.style ?? {};
  const videoId = obj.src ? extractYoutubeVideoId(obj.src) : null;
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  const showLive = !editable && !captureMode && videoId;

  return (
    <div
      style={{
        position: 'absolute', left: obj.x, top: obj.y, width: obj.width, height: obj.height,
        zIndex: isSelected ? 9999 : obj.zIndex,
        outline: editable && isSelected ? '2px solid #3B82F6' : 'none',
        cursor: editable ? 'grab' : 'default',
        userSelect: 'none', boxSizing: 'border-box', overflow: 'hidden',
        borderRadius: style.borderRadius ?? 10,
        background: '#000',
      }}
      onPointerDown={editable ? e => { onSelect(); onDragStart(e); } : undefined}
    >
      {showLive ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={obj.alt || '유튜브 영상'}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : thumbnailUrl ? (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <img src={thumbnailUrl} alt={obj.alt ?? ''} draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.15)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Play size={26} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 8, color: '#9CA3AF', background: '#f2f2f2',
        }}>
          <SquarePlay size={32} />
          {editable && <span style={{ fontSize: 13 }}>유튜브 URL을 입력하세요</span>}
        </div>
      )}
      {editable && isSelected && (
        <div
          style={{
            position: 'absolute', left: 8, right: 34, top: 8, zIndex: 10000,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.95)', borderRadius: 6, padding: '4px 6px',
          }}
          onPointerDown={e => e.stopPropagation()}
        >
          <SquarePlay size={14} color="#EF4444" style={{ flexShrink: 0 }} />
          <input
            value={obj.src ?? ''}
            placeholder="https://youtube.com/watch?v=..."
            onChange={e => onUpdate({ src: e.target.value })}
            style={{ flex: 1, minWidth: 0, border: '1px solid #e5e7eb', borderRadius: 4, padding: '4px 6px', fontSize: 12 }}
          />
        </div>
      )}
      {editable && isSelected && (
        <>
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
