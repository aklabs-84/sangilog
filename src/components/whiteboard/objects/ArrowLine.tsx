import { useState } from 'react';
import { X } from 'lucide-react';
import type { BoardObject } from '../types';

interface Props {
  obj: BoardObject;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (changes: Partial<BoardObject>) => void;
  onDelete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  allObjects: BoardObject[];
  zoom: number;
}

const ARROW_COLORS = ['#374151', '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
const SNAP_THRESHOLD = 30; // canvas pixels

function getConnectionPoints(o: BoardObject) {
  if (o.type === 'arrow') return [];
  return [
    { x: o.x + o.width / 2, y: o.y },
    { x: o.x + o.width,     y: o.y + o.height / 2 },
    { x: o.x + o.width / 2, y: o.y + o.height },
    { x: o.x,               y: o.y + o.height / 2 },
    { x: o.x + o.width / 2, y: o.y + o.height / 2 },
  ];
}

function findSnap(canvasX: number, canvasY: number, objs: BoardObject[], excludeId: string) {
  let best: { x: number; y: number; dist: number } | null = null;
  for (const o of objs) {
    if (o.id === excludeId) continue;
    for (const pt of getConnectionPoints(o)) {
      const dist = Math.hypot(canvasX - pt.x, canvasY - pt.y);
      if (dist < SNAP_THRESHOLD && (!best || dist < best.dist)) {
        best = { x: pt.x, y: pt.y, dist };
      }
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

export default function ArrowLine({ obj, isSelected, onSelect, onUpdate, onDelete, onDragStart, allObjects, zoom }: Props) {
  const [snapIndicator, setSnapIndicator] = useState<{ x: number; y: number } | null>(null);

  const color = (obj.style.color as string) || '#374151';
  const x2rel = (obj.content.x2rel as number) ?? 200;
  const y2rel = (obj.content.y2rel as number) ?? 0;

  const minX = Math.min(0, x2rel);
  const minY = Math.min(0, y2rel);
  const maxX = Math.max(0, x2rel);
  const maxY = Math.max(0, y2rel);
  const svgW = Math.max(maxX - minX, 20);
  const svgH = Math.max(maxY - minY, 20);
  const pad = 20;

  const sx = 0 - minX + pad;
  const sy = 0 - minY + pad;
  const ex = x2rel - minX + pad;
  const ey = y2rel - minY + pad;

  const markerId = `arrowhead-${obj.id}`;

  // 끝점 드래그 (zoom 보정 + 자석 스냅)
  const handleEndDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    const startClient = { x: e.clientX, y: e.clientY };
    const startRel = { x: x2rel, y: y2rel };

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startClient.x) / zoom;
      const dy = (ev.clientY - startClient.y) / zoom;
      const newX2 = startRel.x + dx;
      const newY2 = startRel.y + dy;
      const absEndX = obj.x + newX2;
      const absEndY = obj.y + newY2;

      const snap = findSnap(absEndX, absEndY, allObjects, obj.id);
      if (snap) {
        setSnapIndicator(snap);
        onUpdate({ content: { ...obj.content, x2rel: snap.x - obj.x, y2rel: snap.y - obj.y } });
      } else {
        setSnapIndicator(null);
        onUpdate({ content: { ...obj.content, x2rel: newX2, y2rel: newY2 } });
      }
    };
    const onUp = () => {
      setSnapIndicator(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // 시작점 드래그 (zoom 보정 + 자석 스냅)
  const handleStartDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    const startClient = { x: e.clientX, y: e.clientY };
    const origX = obj.x, origY = obj.y;
    const origX2 = x2rel, origY2 = y2rel;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startClient.x) / zoom;
      const dy = (ev.clientY - startClient.y) / zoom;
      const newStartX = origX + dx;
      const newStartY = origY + dy;

      const snap = findSnap(newStartX, newStartY, allObjects, obj.id);
      if (snap) {
        setSnapIndicator(snap);
        onUpdate({ x: snap.x, y: snap.y, content: { ...obj.content, x2rel: origX2 + origX - snap.x, y2rel: origY2 + origY - snap.y } });
      } else {
        setSnapIndicator(null);
        onUpdate({ x: newStartX, y: newStartY, content: { ...obj.content, x2rel: origX2 - dx, y2rel: origY2 - dy } });
      }
    };
    const onUp = () => {
      setSnapIndicator(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: obj.x + minX - pad,
        top: obj.y + minY - pad,
        width: svgW + pad * 2,
        height: svgH + pad * 2,
        zIndex: isSelected ? 9999 : obj.z_index,
        cursor: 'grab',
        userSelect: 'none',
      }}
      onPointerDown={e => { onSelect(); onDragStart(e); }}
    >
      {/* 색상/삭제 툴바 */}
      {isSelected && (
        <div style={{ position: 'absolute', top: -36, left: 0, display: 'flex', gap: 4, background: '#1e1e1e', borderRadius: 6, padding: '4px 8px', zIndex: 10000 }}>
          {ARROW_COLORS.map(c => (
            <button key={c} onPointerDown={e => { e.stopPropagation(); onUpdate({ style: { ...obj.style, color: c } }); }}
              style={{ width: 16, height: 16, background: c, border: color === c ? '2px solid #fff' : 'none', borderRadius: 3, cursor: 'pointer' }} />
          ))}
          <button onPointerDown={e => { e.stopPropagation(); onDelete(); }}
            style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', marginLeft: 4 }}>
            <X size={13} />
          </button>
        </div>
      )}

      <svg width={svgW + pad * 2} height={svgH + pad * 2} style={{ overflow: 'visible' }}>
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        </defs>

        {/* 클릭 영역 */}
        <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="transparent" strokeWidth={16} style={{ cursor: 'grab' }} />

        {/* 화살표 선 */}
        <line
          x1={sx} y1={sy} x2={ex} y2={ey}
          stroke={color}
          strokeWidth={isSelected ? 2.5 : 2}
          markerEnd={`url(#${markerId})`}
        />

        {/* 자석 스냅 인디케이터 */}
        {snapIndicator && (
          <circle
            cx={snapIndicator.x - (obj.x + minX - pad)}
            cy={snapIndicator.y - (obj.y + minY - pad)}
            r={8}
            fill="none"
            stroke="#3B82F6"
            strokeWidth={2}
            strokeDasharray="4 2"
          />
        )}

        {/* 시작점 핸들 */}
        {isSelected && (
          <circle cx={sx} cy={sy} r={7} fill="#fff" stroke={color} strokeWidth={2}
            style={{ cursor: 'crosshair' }}
            onPointerDown={handleStartDrag}
          />
        )}

        {/* 끝점 핸들 */}
        {isSelected && (
          <circle cx={ex} cy={ey} r={7} fill={color} stroke="#fff" strokeWidth={2}
            style={{ cursor: 'crosshair' }}
            onPointerDown={handleEndDrag}
          />
        )}
      </svg>
    </div>
  );
}
