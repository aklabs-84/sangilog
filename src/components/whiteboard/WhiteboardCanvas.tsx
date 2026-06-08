import { useRef, useEffect, useCallback, useState, useLayoutEffect } from 'react';
import type { BoardObject as BoardObjectType, ActiveTool, RemoteCursor } from './types';
import BoardObject from './BoardObject';
import BoardToolbar from './toolbar/BoardToolbar';
import { v4 as uuidv4 } from 'uuid';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface Props {
  boardId: string;
  objects: BoardObjectType[];
  activeTool: ActiveTool;
  selectedId: string | null;
  isViewer?: boolean;
  remoteCursors?: Record<string, RemoteCursor>;
  onToolChange: (tool: ActiveTool) => void;
  onSelectObject: (id: string | null) => void;
  onAddObject: (obj: BoardObjectType) => void;
  onUpdateObject: (id: string, changes: Partial<BoardObjectType>) => void;
  onDeleteObject: (id: string) => void;
  onCursorMove?: (canvasX: number, canvasY: number) => void;
}

const CANVAS_W = 1600;
const CANVAS_H = 1000;
const INIT_X = 60;
const INIT_Y = 40;
const INIT_ZOOM = 0.7;

export default function WhiteboardCanvas({
  boardId, objects, activeTool, selectedId,
  isViewer = false, remoteCursors = {},
  onToolChange, onSelectObject, onAddObject, onUpdateObject, onDeleteObject,
  onCursorMove,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; objX: number; objY: number } | null>(null);
  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  // refs for real-time transform (bypasses React re-render during drag)
  const panRef = useRef({ x: INIT_X, y: INIT_Y });
  const zoomRef = useRef(INIT_ZOOM);

  // state only for zoom display + passing to children
  const [zoom, setZoom] = useState(INIT_ZOOM);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [isPanningState, setIsPanningState] = useState(false);

  // Direct DOM transform — no React re-render
  const applyTransform = useCallback((x: number, y: number, z: number) => {
    if (canvasRef.current) {
      canvasRef.current.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
    }
  }, []);

  // Set initial transform on mount
  useLayoutEffect(() => {
    applyTransform(panRef.current.x, panRef.current.y, zoomRef.current);
  }, [applyTransform]);

  // Wheel: Ctrl+wheel = zoom, plain wheel = pan
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        // zoom towards cursor
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.max(0.25, Math.min(3, zoomRef.current * factor));
        const ratio = newZoom / zoomRef.current;
        panRef.current.x = mouseX - (mouseX - panRef.current.x) * ratio;
        panRef.current.y = mouseY - (mouseY - panRef.current.y) * ratio;
        zoomRef.current = newZoom;
        setZoom(newZoom);
        applyTransform(panRef.current.x, panRef.current.y, newZoom);
      } else {
        panRef.current.x -= e.deltaX;
        panRef.current.y -= e.deltaY;
        applyTransform(panRef.current.x, panRef.current.y, zoomRef.current);
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [applyTransform]);

  const getNextZIndex = useCallback(() => {
    return objects.length > 0 ? Math.max(...objects.map(o => o.z_index)) + 1 : 1;
  }, [objects]);

  // Canvas coords using refs (stable, no stale closure)
  const toCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current,
    };
  }, []);

  const createObject = useCallback((e: React.PointerEvent) => {
    if (activeTool === 'select') return;
    const { x, y } = toCanvasCoords(e.clientX, e.clientY);

    const base: Omit<BoardObjectType, 'type' | 'content' | 'style' | 'width' | 'height'> = {
      id: uuidv4(), board_id: boardId,
      x: Math.max(0, x - 100), y: Math.max(0, y - 60),
      z_index: getNextZIndex(),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };

    const map: Record<string, BoardObjectType> = {
      sticky:  { ...base, type: 'sticky',  width: 200, height: 160, content: { text: '' }, style: { color: 'yellow' } },
      text:    { ...base, type: 'text',    width: 240, height: 80,  content: { text: '' }, style: { fontSize: 16, fontWeight: 'normal', textAlign: 'left' } },
      image:   { ...base, type: 'image',   width: 280, height: 200, content: { url: '', caption: '' }, style: {} },
      shape:   { ...base, type: 'shape',   width: 160, height: 100, content: { text: '' }, style: { shape: 'rect', bgColor: '#DBEAFE', borderColor: '#3B82F6' } },
      arrow:   { ...base, type: 'arrow',   width: 0,   height: 0,   content: { x2rel: 200, y2rel: 0, label: '' }, style: { color: '#374151' } },
      section: { ...base, type: 'section', width: 400, height: 300, content: { title: '섹션' }, style: { bgColor: '#F0F9FF', opacity: 0.6 }, z_index: 0 },
    };

    if (map[activeTool]) {
      onAddObject(map[activeTool]);
      onSelectObject(base.id);
      onToolChange('select');
    }
  }, [activeTool, boardId, getNextZIndex, onAddObject, onSelectObject, onToolChange, toCanvasCoords]);

  const handleDragStart = useCallback((e: React.PointerEvent, obj: BoardObjectType) => {
    e.stopPropagation();
    dragRef.current = { id: obj.id, startX: e.clientX, startY: e.clientY, objX: obj.x, objY: obj.y };

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      // Use zoomRef (not stale zoom state) for accurate delta
      const dx = (ev.clientX - dragRef.current.startX) / zoomRef.current;
      const dy = (ev.clientY - dragRef.current.startY) / zoomRef.current;
      onUpdateObject(dragRef.current.id, {
        x: Math.max(0, dragRef.current.objX + dx),
        y: Math.max(0, dragRef.current.objY + dy),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [onUpdateObject]);

  // Space+drag pan: direct DOM update, no React re-render
  const handleContainerPointerDown = useCallback((e: React.PointerEvent) => {
    const isPanMode = spaceHeld || activeTool === 'select';
    if (!isPanMode) return;
    if (!spaceHeld && e.target !== containerRef.current && e.target !== canvasRef.current) return;

    isPanning.current = true;
    setIsPanningState(true);
    lastPanPos.current = { x: e.clientX, y: e.clientY };

    const onMove = (ev: PointerEvent) => {
      if (!isPanning.current) return;
      panRef.current.x += ev.clientX - lastPanPos.current.x;
      panRef.current.y += ev.clientY - lastPanPos.current.y;
      lastPanPos.current = { x: ev.clientX, y: ev.clientY };
      // Direct DOM — zero React overhead during drag
      applyTransform(panRef.current.x, panRef.current.y, zoomRef.current);
    };
    const onUp = () => {
      isPanning.current = false;
      setIsPanningState(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [activeTool, spaceHeld, applyTransform]);

  // Zoom buttons
  const handleZoomChange = useCallback((newZoom: number) => {
    zoomRef.current = newZoom;
    setZoom(newZoom);
    applyTransform(panRef.current.x, panRef.current.y, newZoom);
  }, [applyTransform]);

  const handleReset = useCallback(() => {
    panRef.current = { x: INIT_X, y: INIT_Y };
    zoomRef.current = INIT_ZOOM;
    setZoom(INIT_ZOOM);
    applyTransform(INIT_X, INIT_Y, INIT_ZOOM);
  }, [applyTransform]);

  // Keyboard shortcuts + space pan
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') { e.preventDefault(); setSpaceHeld(true); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) onDeleteObject(selectedId);
      const keyMap: Record<string, ActiveTool> = { v: 'select', s: 'sticky', t: 'text', i: 'image', r: 'shape', a: 'arrow', g: 'section' };
      if (keyMap[e.key.toLowerCase()]) onToolChange(keyMap[e.key.toLowerCase()]);
    };
    const onUp = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [selectedId, onDeleteObject, onToolChange]);

  const sorted = [...objects].sort((a, b) => a.z_index - b.z_index);

  const cursor = spaceHeld
    ? (isPanningState ? 'grabbing' : 'grab')
    : activeTool === 'select' ? 'default' : 'crosshair';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <BoardToolbar
        activeTool={activeTool}
        onToolChange={onToolChange}
        onDeleteSelected={() => selectedId && onDeleteObject(selectedId)}
        hasSelection={!!selectedId}
      />

      {/* 줌 컨트롤 */}
      <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 4, background: '#1e1e1e', borderRadius: 10, padding: '6px 8px' }}>
        <button onClick={() => handleZoomChange(Math.max(0.25, zoom - 0.1))} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', display: 'flex' }}><ZoomOut size={16} /></button>
        <span style={{ color: '#fff', fontSize: 12, minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => handleZoomChange(Math.min(3, zoom + 0.1))} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', display: 'flex' }}><ZoomIn size={16} /></button>
        <div style={{ width: 1, background: '#333', margin: '0 2px' }} />
        <button onClick={handleReset} title="맞추기" style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', display: 'flex' }}><Maximize2 size={14} /></button>
      </div>

      {/* 뷰어 모드 배너 */}
      {isViewer && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.4)',
          color: '#EAB308', fontSize: 12, fontWeight: 'bold',
          padding: '5px 14px', borderRadius: 20, zIndex: 1001,
          pointerEvents: 'none',
        }}>
          👁 보기 전용 모드
        </div>
      )}

      {/* 팬/줌 뷰포트 */}
      <div
        ref={containerRef}
        style={{
          width: '100%', height: '100%', overflow: 'hidden', background: '#f3f4f6',
          cursor,
        }}
        onPointerDown={handleContainerPointerDown}
        onPointerMove={e => {
          if (!onCursorMove) return;
          const { x, y } = toCanvasCoords(e.clientX, e.clientY);
          onCursorMove(x, y);
        }}
      >
        {/* transform은 useLayoutEffect + applyTransform으로만 관리 */}
        <div
          ref={canvasRef}
          data-canvas="true"
          style={{
            position: 'absolute',
            left: 0, top: 0,
            width: CANVAS_W, height: CANVAS_H,
            background: '#ffffff',
            borderRadius: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
            backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            transformOrigin: '0 0',
            willChange: 'transform',
            userSelect: 'none',
            cursor: isViewer ? 'default' : activeTool === 'select' ? 'default' : 'crosshair',
          }}
          onPointerDown={e => {
            if (isViewer || spaceHeld) return;
            if (e.target === canvasRef.current) {
              onSelectObject(null);
              if (activeTool !== 'select') createObject(e);
            }
          }}
        >
          {sorted.map(obj => (
            <BoardObject
              key={obj.id}
              obj={obj}
              isSelected={!isViewer && selectedId === obj.id}
              onSelect={() => !isViewer && onSelectObject(obj.id)}
              onUpdate={changes => !isViewer && onUpdateObject(obj.id, changes)}
              onDelete={() => !isViewer && onDeleteObject(obj.id)}
              onDragStart={e => !isViewer && handleDragStart(e, obj)}
              allObjects={objects}
              zoom={zoom}
            />
          ))}

          {/* 원격 커서 */}
          {Object.values(remoteCursors).map(cursor => (
            <div
              key={cursor.userId}
              style={{
                position: 'absolute',
                left: cursor.canvasX,
                top: cursor.canvasY,
                transform: 'translate(-4px, -4px)',
                pointerEvents: 'none',
                zIndex: 9999,
                transition: 'left 0.05s, top 0.05s',
              }}
            >
              {/* 커서 삼각형 */}
              <svg width="16" height="16" viewBox="0 0 16 16" style={{ display: 'block' }}>
                <path d="M0 0 L0 12 L4 9 L7 14 L9 13 L6 8 L11 8 Z" fill={cursor.avatarColor} stroke="#fff" strokeWidth="1" />
              </svg>
              {/* 이름 라벨 */}
              <div style={{
                position: 'absolute', top: 14, left: 4,
                background: cursor.avatarColor,
                color: '#fff', fontSize: 10, fontWeight: 'bold',
                padding: '2px 6px', borderRadius: 6,
                whiteSpace: 'nowrap',
              }}>
                {cursor.displayName}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
