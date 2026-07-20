import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronLeft, ChevronRight,
  ZoomIn, PenTool, Undo2, Highlighter, Flashlight, Timer as TimerIcon, Play, Pause, X as XIcon,
} from 'lucide-react';
import { useTimer } from '../../lib/timerContext';
import type { DeckSlide } from './types';
import SlideStage from './SlideStage';

interface Props {
  slides: DeckSlide[];
  startIndex: number;
  onClose: () => void;
}

const PEN_COLORS = ['#ff5252', '#ffd600', '#4ade80', '#ffffff'];
const ZOOM = 2.6;
const SPOTLIGHT_RADIUS = 190;
const SPOTLIGHT_ZOOM = 1.6;

// 슬라이드를 전체화면으로 넘겨보는 발표 보기 모드. 편집은 불가능하고,
// 링크 오브젝트는 여기서만 클릭 시 바로 새 탭으로 열린다.
// 타이머/펜 그리기/돋보기/스포트라이트 보조 도구는 자료 에디터 발표 모드(PresentationModal)와 동일한
// 로직을 이식한 것이나, 이 캔버스는 스크롤이 없는 고정 1280x720 비율이라 scrollTop/docHeight 같은
// 스크롤 보정 없이 슬라이드 렌더 크기(paneSize) 기준으로만 계산한다.
export default function PresentationView({ slides, startIndex, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);
  const [tool, setTool] = useState<'none' | 'zoom' | 'pen' | 'spotlight'>('none');
  const [lensPos, setLensPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useTimer();

  const goNext = () => setIndex(i => Math.min(i + 1, slides.length - 1));
  const goPrev = () => setIndex(i => Math.max(i - 1, 0));
  const selectTool = (t: typeof tool) => setTool(prev => (prev === t ? 'none' : t));

  // ── 슬라이드 렌더 크기 추적(돋보기/스포트라이트 계산, 펜 캔버스 크기 기준) ──
  const stageWrapRef = useRef<HTMLDivElement>(null);
  const [paneSize, setPaneSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = stageWrapRef.current;
    if (!el) return;
    const calc = () => setPaneSize({ width: el.clientWidth, height: el.clientHeight });
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    window.addEventListener('resize', calc);
    return () => { ro.disconnect(); window.removeEventListener('resize', calc); };
  }, []);

  const handleMouseMove = (e: ReactMouseEvent) => {
    const box = stageWrapRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    setLensPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // ── 펜 그리기 (Canvas 오버레이 — 슬라이드 화면에 고정) ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const [penColor, setPenColor] = useState('#ff5252');
  const [penHighlight, setPenHighlight] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !paneSize.width || !paneSize.height) return;
    canvas.width = paneSize.width;
    canvas.height = paneSize.height;
    undoStackRef.current = [];
    setCanUndo(false);
  }, [paneSize.width, paneSize.height]);

  const getCanvasPoint = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePenDown = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    lastPointRef.current = getCanvasPoint(e);
    try {
      undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      setCanUndo(true);
    } catch {
      // 캔버스 크기가 0인 경우 등 — undo만 비활성화하고 그리기는 계속
    }
  };

  const handlePenMove = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !lastPointRef.current) return;
    const point = getCanvasPoint(e);
    ctx.globalAlpha = penHighlight ? 0.35 : 1;
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penHighlight ? 18 : 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
  };

  const handlePenUp = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const lastState = undoStackRef.current.pop();
    if (lastState) ctx.putImageData(lastState, 0, 0);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
    setCanUndo(undoStackRef.current.length > 0);
  };

  const handleClearPen = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    undoStackRef.current = [];
    setCanUndo(false);
  };

  // 슬라이드를 넘기면 이전 슬라이드에 그려둔 낙서는 지운다(도구 선택 상태 자체는 유지).
  useEffect(() => {
    handleClearPen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { setIndex(i => Math.min(i + 1, slides.length - 1)); return; }
      if (e.key === 'ArrowLeft') { setIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'z' || e.key === 'Z') { selectTool('zoom'); return; }
      if (e.key === 'p' || e.key === 'P') { selectTool('pen'); return; }
      if (e.key === 'l' || e.key === 'L') { selectTool('spotlight'); return; }
      if (e.key === 't' || e.key === 'T') { timer.toggle(); return; }
      if (e.key === 'Escape') {
        if (tool !== 'none') { setTool('none'); return; }
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, onClose, tool, timer]);

  const slide = slides[index];
  if (!slide) return null;

  const toolBtnStyle = (active: boolean): CSSProperties => ({
    padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer',
    background: active ? '#3B82F6' : 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center',
  });

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={stageWrapRef} style={{ width: 'min(92vw, calc(92vh * 16 / 9))', position: 'relative' }}>
        <div onClick={tool === 'none' ? goNext : undefined} style={{ cursor: tool === 'none' ? 'pointer' : 'default' }}>
          <SlideStage slide={slide} editable={false} />
        </div>

        {/* 돋보기 — 커서 위치 기준으로 슬라이드 상단을 확대해 보여주는 패널 */}
        {tool === 'zoom' && lensPos && paneSize.width > 0 && paneSize.height > 0 && (() => {
          const panelW = paneSize.width;
          const panelH = Math.round(paneSize.height * 0.85);
          const scaledW = panelW * ZOOM;
          const scaledH = paneSize.height * ZOOM;
          let tx = panelW / 2 - lensPos.x * ZOOM;
          let ty = panelH / 2 - lensPos.y * ZOOM;
          tx = Math.min(0, Math.max(panelW - scaledW, tx));
          ty = Math.min(0, Math.max(panelH - scaledH, ty));
          return (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: 0, height: panelH, zIndex: 30, overflow: 'hidden',
              borderRadius: '0 0 20px 20px', borderBottom: '4px solid #3B82F6', boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              pointerEvents: 'none',
            }}>
              <div style={{ width: panelW, transform: `translate(${tx}px, ${ty}px) scale(${ZOOM})`, transformOrigin: '0 0', background: '#000' }}>
                <SlideStage slide={slide} editable={false} captureMode />
              </div>
              <span style={{
                position: 'absolute', top: 8, left: 10, display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '4px 8px', borderRadius: 8,
              }}>
                <ZoomIn size={12} /> 돋보기 {ZOOM}x
              </span>
            </div>
          );
        })()}

        {/* 스포트라이트(레이저 포인터) — 원 안쪽은 커서 중심 확대, 바깥은 어둡게 */}
        {tool === 'spotlight' && lensPos && paneSize.width > 0 && paneSize.height > 0 && (() => {
          const panelW = paneSize.width;
          const panelH = paneSize.height;
          const scaledW = panelW * SPOTLIGHT_ZOOM;
          const scaledH = panelH * SPOTLIGHT_ZOOM;
          let tx = lensPos.x - lensPos.x * SPOTLIGHT_ZOOM;
          let ty = lensPos.y - lensPos.y * SPOTLIGHT_ZOOM;
          tx = Math.min(0, Math.max(panelW - scaledW, tx));
          ty = Math.min(0, Math.max(panelH - scaledH, ty));
          return (
            <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', inset: 0, overflow: 'hidden',
                clipPath: `circle(${SPOTLIGHT_RADIUS}px at ${lensPos.x}px ${lensPos.y}px)`,
                WebkitClipPath: `circle(${SPOTLIGHT_RADIUS}px at ${lensPos.x}px ${lensPos.y}px)`,
              } as CSSProperties}>
                <div style={{ position: 'absolute', left: 0, top: 0, width: panelW, transform: `translate(${tx}px, ${ty}px) scale(${SPOTLIGHT_ZOOM})`, transformOrigin: '0 0', background: '#000' }}>
                  <SlideStage slide={slide} editable={false} captureMode />
                </div>
              </div>
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)',
                WebkitMaskImage: `radial-gradient(circle ${SPOTLIGHT_RADIUS}px at ${lensPos.x}px ${lensPos.y}px, transparent 0px, transparent ${SPOTLIGHT_RADIUS - 3}px, black ${SPOTLIGHT_RADIUS}px)`,
                maskImage: `radial-gradient(circle ${SPOTLIGHT_RADIUS}px at ${lensPos.x}px ${lensPos.y}px, transparent 0px, transparent ${SPOTLIGHT_RADIUS - 3}px, black ${SPOTLIGHT_RADIUS}px)`,
              } as CSSProperties} />
              <div style={{
                position: 'absolute', borderRadius: '50%',
                width: SPOTLIGHT_RADIUS * 2, height: SPOTLIGHT_RADIUS * 2,
                left: lensPos.x - SPOTLIGHT_RADIUS, top: lensPos.y - SPOTLIGHT_RADIUS,
                boxShadow: '0 0 0 4px rgba(255,255,255,0.95), 0 0 50px 12px rgba(255,255,255,0.6)',
              }} />
            </div>
          );
        })()}

        {/* 도구 활성 중 마우스 추적/그리기용 오버레이 — 유튜브 iframe 위에서도 확실히 이벤트를 잡기 위해
            슬라이드 전체를 덮는 투명 레이어를 별도로 둔다(펜 캔버스도 이 레이어 위에 얹는다). */}
        {tool !== 'none' && (
          <div
            style={{ position: 'absolute', inset: 0, zIndex: 40, cursor: tool === 'pen' ? 'crosshair' : 'default' }}
            onMouseMove={tool === 'zoom' || tool === 'spotlight' ? handleMouseMove : undefined}
            onMouseLeave={() => setLensPos(null)}
          >
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: '100%', pointerEvents: tool === 'pen' ? 'auto' : 'none', touchAction: 'none' }}
              onMouseDown={tool === 'pen' ? handlePenDown : undefined}
              onMouseMove={tool === 'pen' ? handlePenMove : undefined}
              onMouseUp={tool === 'pen' ? handlePenUp : undefined}
              onMouseLeave={tool === 'pen' ? handlePenUp : undefined}
              onDragStart={e => e.preventDefault()}
            />
          </div>
        )}
      </div>

      {/* 좌측 상단 발표 보조 도구 툴바 */}
      <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', alignItems: 'center', gap: 6, zIndex: 50 }}>
        <button onClick={() => selectTool('zoom')} title="돋보기 (Z)" style={toolBtnStyle(tool === 'zoom')}><ZoomIn size={16} /></button>
        <button onClick={() => selectTool('pen')} title="펜 (P)" style={toolBtnStyle(tool === 'pen')}><PenTool size={16} /></button>
        <button onClick={() => selectTool('spotlight')} title="스포트라이트 (L)" style={toolBtnStyle(tool === 'spotlight')}><Flashlight size={16} /></button>
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.15)', borderRadius: 8, marginLeft: 4 }}>
          <button
            onClick={timer.toggle}
            title="타이머 시작/정지 (T)"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px 8px 10px',
              background: timer.isRunning ? '#3B82F6' : 'transparent', border: 'none', borderRadius: '8px 0 0 8px',
              color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700,
            }}
          >
            {timer.isRunning ? <Pause size={13} /> : <Play size={13} />}
            <TimerIcon size={13} />
            {String(Math.floor(timer.remainingSeconds / 60)).padStart(2, '0')}:{String(timer.remainingSeconds % 60).padStart(2, '0')}
          </button>
          <input
            type="number" min={0} max={99}
            value={Math.floor(timer.totalSeconds / 60)}
            onChange={e => timer.applyTime(Math.max(0, Math.min(99, Number(e.target.value) || 0)), 0)}
            title="타이머 시간(분) 직접 입력"
            style={{ width: 32, textAlign: 'center', fontSize: 12, fontWeight: 700, background: 'transparent', border: 'none', color: '#fff' }}
          />
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', paddingRight: 8 }}>분</span>
        </div>
      </div>

      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, color: '#fff', cursor: 'pointer', zIndex: 50 }}>
        <X size={20} />
      </button>

      <button
        onClick={e => { e.stopPropagation(); goPrev(); }}
        disabled={index === 0}
        style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, color: '#fff', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 1, zIndex: 50 }}
      >
        <ChevronLeft size={22} />
      </button>
      <button
        onClick={e => { e.stopPropagation(); goNext(); }}
        disabled={index === slides.length - 1}
        style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, color: '#fff', cursor: index === slides.length - 1 ? 'default' : 'pointer', opacity: index === slides.length - 1 ? 0.3 : 1, zIndex: 50 }}
      >
        <ChevronRight size={22} />
      </button>

      {tool === 'pen' && (
        <div style={{
          position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(20,20,20,0.85)', borderRadius: 12, padding: '8px 16px',
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {PEN_COLORS.map(c => (
              <button key={c} onClick={() => setPenColor(c)} title={c}
                style={{ width: 22, height: 22, borderRadius: '50%', border: penColor === c ? '2px solid #3B82F6' : '2px solid rgba(255,255,255,0.3)', background: c, cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
          <button onClick={() => setPenHighlight(h => !h)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: 'none', background: penHighlight ? '#3B82F6' : 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
            <Highlighter size={13} /> 형광펜
          </button>
          <button onClick={handleUndo} disabled={!canUndo} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, cursor: canUndo ? 'pointer' : 'default', opacity: canUndo ? 1 : 0.3 }}>
            <Undo2 size={13} /> 실행취소
          </button>
          <button onClick={handleClearPen} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
            <XIcon size={13} /> 전체 지우기
          </button>
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: '#fff', fontSize: 13, opacity: 0.7 }}>
        {index + 1} / {slides.length}
      </div>
    </div>,
    document.body
  );
}
