import { useState, useEffect, useLayoutEffect, useMemo, useRef, useContext, createContext, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useTimer } from '../../lib/timerContext';
import { reorganizeMaterialContent, validateReorganizeInstruction, MATERIAL_REORG_PROMPTS } from '../../lib/gemini';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

// ── WebP 변환 + 리사이즈 (최대 1280px) ───────────────────────────────────────
const compressToWebP = (file: File, maxWidth = 1280, quality = 0.85): Promise<File> =>
  new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        resolve(blob
          ? new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' })
          : file);
      }, 'image/webp', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
import ReactMarkdown from 'react-markdown';
import {
  Save, Trash2, Copy, Plus,
  Loader2, ChevronDown, Globe, Lock,
  BookOpen, Pencil, ArrowLeft, Eye, EyeOff,
  Users, Presentation, ChevronRight, X as XIcon,
  Maximize2, Download, Sparkles, RotateCcw, AlertCircle, History, Check,
  Library, Link2,
  ZoomIn, PenTool, Undo2, Highlighter, Flashlight, Timer as TimerIcon, Play, Pause,
  Sun, Moon,
} from 'lucide-react';
import CodeBlock from '../../components/CodeBlock';
import RichEditor from '../../components/RichEditor';

// AI로 정리한 결과 히스토리 (학습가이드/발표자료 등 여러 버전을 보관)
interface AiVersion {
  id: string;
  mode: 'guide' | 'presentation';
  label: string;
  content: string;
  created_at: string;
}

interface Material {
  id: string;
  class_id: string | null;
  week_number: number;
  title: string;
  content: string;
  url: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  view_count?: number;
  ai_versions?: AiVersion[];
  teacher_id?: string | null;
  source_material_id?: string | null;
}

const formatVersionDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return ''; }
};

const PEN_COLORS = ['#ff5252', '#ffd600', '#4ade80', '#ffffff'];

// 문단 바로 뒤에 빈 줄 없이 "---"가 붙으면 CommonMark가 구분선(hr) 대신 제목(Setext heading)이나
// 그냥 텍스트로 잘못 해석하는 경우가 있어, 렌더링 직전에 "---" 단독 줄 앞뒤로 빈 줄을 강제 삽입해 보정한다.
// (코드펜스 안의 "---"는 건드리지 않음)
const normalizeStandaloneHr = (md: string): string => {
  const lines = md.split('\n');
  const out: string[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const isHr = !inFence && /^(-{3,}|_{3,}|\*{3,})$/.test(line.trim());
    if (isHr) {
      if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('');
      out.push(line);
      if (lines[i + 1] !== undefined && lines[i + 1].trim() !== '') out.push('');
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
};

// 슬라이드 글자 크기 편집 — 편집 패널의 %를 --slide-font-scale CSS 변수로 상위에서 지정하면
// 아래 각 요소가 calc()로 기본 rem 크기에 곱해서 반영한다 (Tailwind text-* 클래스는 rem 고정값이라 상속 배율 적용 불가)
const slideFontSize = (baseRem: number) => ({ fontSize: `calc(${baseRem}rem * var(--slide-font-scale, 1))` });

// 노션 스타일 콜아웃 블록 — RichEditor의 CalloutExtension이 `<div data-callout="...">`로 직렬화한 것을 렌더링
const CALLOUT_STYLES: Record<string, { icon: string; classes: string }> = {
  info: { icon: '💡', classes: 'bg-blue-50 border-blue-200 text-blue-900' },
  warning: { icon: '⚠️', classes: 'bg-amber-50 border-amber-200 text-amber-900' },
  tip: { icon: '✅', classes: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
  important: { icon: '❗', classes: 'bg-red-50 border-red-200 text-red-900' },
};
const CALLOUT_STYLES_DARK: Record<string, { icon: string; classes: string }> = {
  info: { icon: '💡', classes: 'bg-blue-500/10 border-blue-400/30 text-blue-50' },
  warning: { icon: '⚠️', classes: 'bg-amber-500/10 border-amber-400/30 text-amber-50' },
  tip: { icon: '✅', classes: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-50' },
  important: { icon: '❗', classes: 'bg-red-500/10 border-red-400/30 text-red-50' },
};
const renderCallout = (props: any, dark: boolean) => {
  const { children, ...rest } = props;
  const type = rest['data-callout'];
  const style = type ? (dark ? CALLOUT_STYLES_DARK : CALLOUT_STYLES)[type] : undefined;
  if (!style) return <div {...rest}>{children}</div>;
  return (
    <div className={`my-3 rounded-xl border-2 flex gap-3 px-4 py-3 ${style.classes}`}>
      <span className="shrink-0 text-lg leading-none mt-0.5">{style.icon}</span>
      <div className="flex-1 min-w-0 text-sm [&>p]:m-0 [&>p]:mb-2 [&>p:last-child]:mb-0">{children}</div>
    </div>
  );
};

// 슬라이드 안 이미지를 클릭하면 전체화면으로 보여주기 위한 컨텍스트 — Provider가 없으면(null)
// 클릭해도 아무 동작 없이 일반 이미지처럼 보인다 (미리보기 등 확대가 필요 없는 곳에서 안전).
const SlideImageZoomContext = createContext<((src: string) => void) | null>(null);

const SlideImg = ({ src, alt, title }: { src?: string; alt?: string; title?: string }) => {
  const zoom = useContext(SlideImageZoomContext);
  const wm = (title || '').match(/^width:(\d+)$/);
  const style = wm ? { width: `${wm[1]}px`, maxWidth: '100%' } : undefined;
  return (
    <img
      src={src}
      alt={alt}
      style={style}
      onClick={zoom ? () => zoom(src!) : undefined}
      className={`w-full h-auto rounded-2xl my-4 shadow-xl ${zoom ? 'cursor-zoom-in hover:opacity-90 transition-opacity' : ''}`}
    />
  );
};

// ── 프레젠테이션 슬라이드 마크다운 렌더러 ────────────────────────────────────
// 발표 화면은 다크/라이트 두 테마를 지원한다 — dark=true면 짙은 배경 위 흰 글자,
// false면 밝은 배경 위 어두운 글자로 색상 세트 전체를 바꿔 반환한다.
const getSlideComponents = (dark: boolean): any => {
  const SlideSummary = ({ children }: any) => (
    <summary className={`px-6 py-4 cursor-pointer font-black text-lg list-none flex items-center gap-3 select-none transition-colors [&::-webkit-details-marker]:hidden ${dark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}>
      <span className="text-sm opacity-70 shrink-0">▶</span> <span>{children}</span>
    </summary>
  );

  return {
  h1: ({ children }: any) => (
    <h1 style={slideFontSize(3)} className={`font-black mb-6 leading-tight tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 style={slideFontSize(1.875)} className={`font-black mb-4 mt-6 ${dark ? 'text-white/90' : 'text-slate-800'}`}>{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 style={slideFontSize(1.5)} className={`font-black mb-3 mt-5 ${dark ? 'text-white/80' : 'text-slate-700'}`}>{children}</h3>
  ),
  p: ({ children }: any) => (
    <p style={slideFontSize(1.25)} className={`leading-relaxed mb-4 ${dark ? 'text-white/75' : 'text-slate-600'}`}>{children}</p>
  ),
  ul: ({ children }: any) => <ul className="space-y-3 mb-4 pl-2">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-6 space-y-3 mb-4">{children}</ol>,
  li: ({ children }: any) => (
    <li style={slideFontSize(1.25)} className={`flex items-start gap-3 ${dark ? 'text-white/75' : 'text-slate-600'}`}>
      <span className="mt-2 w-2 h-2 rounded-full bg-primary shrink-0" />
      <span>{children}</span>
    </li>
  ),
  blockquote: ({ children }: any) => (
    <blockquote style={slideFontSize(1.25)} className={`border-l-4 border-primary pl-6 italic my-4 ${dark ? 'text-white/60' : 'text-slate-500'}`}>{children}</blockquote>
  ),
  code: ({ children, className }: any) => {
    if (!className) {
      return <code style={slideFontSize(1.125)} className={`px-2 py-0.5 rounded font-mono text-primary ${dark ? 'bg-white/10' : 'bg-slate-900/5'}`}>{children}</code>;
    }
    return <code className={className}>{children}</code>;
  },
  pre: ({ children }: any) => {
    const child = (Array.isArray(children) ? children[0] : children) as any;
    const code = String(child?.props?.children ?? '').replace(/\n$/, '');
    return (
      <pre style={slideFontSize(1)} className={`rounded-2xl p-5 whitespace-pre-wrap break-words font-mono my-4 border ${dark ? 'bg-white/5 text-white/80 border-white/10' : 'bg-slate-900/[0.03] text-slate-700 border-slate-900/10'}`}>
        {code}
      </pre>
    );
  },
  strong: ({ children }: any) => <strong className={`font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{children}</strong>,
  em: ({ children }: any) => <em className="italic text-primary">{children}</em>,
  img: ({ src, alt, title }: any) => <SlideImg src={src} alt={alt} title={title} />,
  a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>,
  hr: () => <hr className={`my-5 ${dark ? 'border-white/10' : 'border-slate-900/10'}`} />,
  table: ({ children }: any) => (
    <div className="overflow-auto mb-4">
      <table style={slideFontSize(1.125)} className={`w-full border-collapse ${dark ? 'text-white/80' : 'text-slate-700'}`}>{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className={`border px-3 py-2 font-black text-left ${dark ? 'border-white/15 bg-white/10 text-white' : 'border-slate-900/10 bg-slate-900/5 text-slate-900'}`}>{children}</th>
  ),
  td: ({ children }: any) => (
    <td className={`border px-3 py-2 ${dark ? 'border-white/15' : 'border-slate-900/10'}`}>{children}</td>
  ),
  details: ({ children }: any) => {
    // 원문에서 <details>와 <summary>가 줄바꿈으로 떨어져 있으면 그 사이 개행이
    // children 배열의 첫 항목(공백 텍스트 노드)으로 끼어든다. 자리(0번 인덱스)가
    // 아니라 실제 summary 타입으로 찾아야 <summary>가 <details>의 직계 자식으로
    // 남아 — 안 그러면 브라우저가 유효한 summary로 인식하지 못해 기본 스타일로 표시된다.
    const arr = Array.isArray(children) ? children : [children];
    const summaryEl = arr.find((c: any) => c?.type === SlideSummary);
    const rest = arr.filter((c: any) => c !== summaryEl);
    return (
      <details className={`my-4 rounded-2xl border overflow-hidden ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white shadow-sm'}`}>
        {summaryEl}
        <div className="px-6 py-5">{rest}</div>
      </details>
    );
  },
  summary: SlideSummary,
  div: (props: any) => renderCallout(props, dark),
  };
};

// ── 프레젠테이션 모달 ─────────────────────────────────────────────────────────
const PresentationModal = ({
  material,
  onClose,
  onSave,
}: {
  material: Material;
  onClose: () => void;
  onSave?: (newContent: string) => void;
}) => {
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState(material.content);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const dark = theme === 'dark';

  const handleSaveEdits = () => {
    onSave?.(editedContent);
    setEditMode(false);
  };

  // ── 발표 중 보조 도구 (돋보기 / 펜 / 스포트라이트) ─────────────────────────
  const [tool, setTool] = useState<'none' | 'zoom' | 'pen' | 'spotlight'>('none');
  const [lensPos, setLensPos] = useState<{ x: number; y: number } | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const timer = useTimer();

  const selectTool = (t: typeof tool) => {
    setEditMode(false);
    setTool(prev => (prev === t ? 'none' : t));
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (zoomedImage) {
        if (e.key === 'Escape') setZoomedImage(null);
        return;
      }
      if (editMode) {
        if (e.key === 'Escape') setEditMode(false);
        return;
      }
      if (tool !== 'none' && e.key === 'Escape') { setTool('none'); return; }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, editMode, tool, zoomedImage]);

  // ── 문서 스크롤 영역 크기/스크롤 위치 추적 (돋보기·스포트라이트가 "지금 화면에
  // 보이는 부분"을 계산하는 데 필요) — 편집모드로 전환되어도 캔버스가 리셋되지
  // 않도록, 크기 측정은 항상 마운트돼 있는 바깥 wrapper(viewRef) 기준으로 한다.
  const viewRef = useRef<HTMLDivElement>(null);
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [paneSize, setPaneSize] = useState({ width: 0, height: 0 });
  const [docHeight, setDocHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const calc = () => {
      const el = viewRef.current;
      if (el) setPaneSize({ width: el.clientWidth, height: el.clientHeight });
    };
    calc();
    const ro = new ResizeObserver(calc);
    if (viewRef.current) ro.observe(viewRef.current);
    window.addEventListener('resize', calc);
    return () => { ro.disconnect(); window.removeEventListener('resize', calc); };
  }, []);

  useEffect(() => {
    const doc = docRef.current;
    if (!doc) return;
    const update = () => setDocHeight(doc.scrollHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(doc);
    return () => ro.disconnect();
  }, [editMode]);

  const handleStageMouseMove = (e: React.MouseEvent) => {
    const box = stageBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    setLensPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // ── 문서 본문(돋보기/스포트라이트 복제본에도 동일하게 재사용) ─────────────────
  const slideComponents = useMemo(() => getSlideComponents(dark), [dark]);
  const docInner = (
    <ReactMarkdown components={slideComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
      {normalizeStandaloneHr(material.content)}
    </ReactMarkdown>
  );

  // ── 펜 그리기 (Canvas 오버레이 — 화면에 고정, 문서를 스크롤해도 그림은 그대로 남는다) ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const [penColor, setPenColor] = useState('#ff5252');
  const [penHighlight, setPenHighlight] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  // useEffect는 브라우저 페인트 이후 실행되어 첫 클릭 시점에 캔버스 크기가
  // 아직 반영되지 않을 수 있음 → useLayoutEffect로 페인트 전에 동기 반영
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
    // 드래그 상태부터 먼저 세팅 — undo 스냅샷 저장에 실패해도 그리기 자체는 항상 되도록
    drawingRef.current = true;
    lastPointRef.current = getCanvasPoint(e);
    try {
      undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      setCanUndo(true);
    } catch {
      // 캔버스 크기가 0이거나 스냅샷을 뜰 수 없는 경우 — undo만 비활성화하고 그리기는 계속
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

  const SPOTLIGHT_RADIUS = 130;

  return createPortal(
    <SlideImageZoomContext.Provider value={setZoomedImage}>
    <div className={`fixed inset-0 z-[9999] flex flex-col select-none ${dark ? 'bg-[#0a0a14]' : 'bg-slate-50'}`}>

      {/* 상단 바 */}
      <div className={`flex items-center gap-3 px-5 py-3 border-b shrink-0 ${dark ? 'border-white/10 bg-white/5' : 'border-slate-900/10 bg-white'}`}>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-800 font-black text-sm hover:bg-slate-100 active:scale-95 transition-all shadow"
        >
          <ArrowLeft size={15} /> 나가기
        </button>
        <div className="flex items-center gap-2 ml-2 flex-1 min-w-0">
          <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
          <span className={`text-sm font-bold truncate ${dark ? 'text-white/60' : 'text-slate-500'}`}>{material.title}</span>
        </div>

        {/* 발표 보조 도구 */}
        {!editMode && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
              title={dark ? '밝게 보기' : '어둡게 보기'}
              className={`p-2 rounded-xl transition-all ${dark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-slate-900/5 text-slate-600 hover:bg-slate-900/10'}`}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => selectTool('zoom')}
              title="돋보기"
              className={`p-2 rounded-xl transition-all ${tool === 'zoom' ? 'bg-primary text-white' : dark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-slate-900/5 text-slate-600 hover:bg-slate-900/10'}`}
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={() => selectTool('pen')}
              title="펜"
              className={`p-2 rounded-xl transition-all ${tool === 'pen' ? 'bg-primary text-white' : dark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-slate-900/5 text-slate-600 hover:bg-slate-900/10'}`}
            >
              <PenTool size={16} />
            </button>
            <button
              onClick={() => selectTool('spotlight')}
              title="스포트라이트"
              className={`p-2 rounded-xl transition-all ${tool === 'spotlight' ? 'bg-primary text-white' : dark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-slate-900/5 text-slate-600 hover:bg-slate-900/10'}`}
            >
              <Flashlight size={16} />
            </button>
            <button
              onClick={timer.toggle}
              title="타이머"
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-black tabular-nums transition-all ${timer.isRunning ? 'bg-primary text-white' : dark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-slate-900/5 text-slate-600 hover:bg-slate-900/10'}`}
            >
              {timer.isRunning ? <Pause size={14} /> : <Play size={14} />}
              <TimerIcon size={14} />
              {String(Math.floor(timer.remainingSeconds / 60)).padStart(2, '0')}:{String(timer.remainingSeconds % 60).padStart(2, '0')}
            </button>
          </div>
        )}

        {onSave && (
          editMode ? (
            <button
              onClick={handleSaveEdits}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white font-black text-sm hover:bg-emerald-600 active:scale-95 transition-all shadow shrink-0"
            >
              <Save size={15} /> 저장
            </button>
          ) : (
            <button
              onClick={() => { setTool('none'); setEditMode(true); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm active:scale-95 transition-all shrink-0 ${dark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-900/5 text-slate-800 hover:bg-slate-900/10'}`}
            >
              <Pencil size={15} /> 편집
            </button>
          )
        )}
      </div>

      {/* 본문 영역 — 편집모드: 원문 전체 텍스트 편집 / 발표모드: 전체 문서 스크롤 뷰 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div ref={viewRef} className="relative flex-1 min-h-0">
          {editMode ? (
            <div className="absolute inset-0 p-6">
              <textarea
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                className={`w-full h-full px-5 py-4 rounded-2xl border text-sm font-mono focus:outline-none focus:border-primary/40 resize-none ${dark ? 'bg-white/5 border-white/10 text-white/90' : 'bg-white border-slate-900/10 text-slate-800'}`}
                placeholder="마크다운 내용을 입력하세요"
              />
            </div>
          ) : (
            <div
              ref={stageBoxRef}
              className="absolute inset-0 overflow-y-auto"
              onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
              onMouseMove={tool === 'zoom' || tool === 'spotlight' ? handleStageMouseMove : undefined}
              onMouseLeave={() => setLensPos(null)}
            >
              <div ref={docRef} className="max-w-6xl mx-auto px-8 md:px-16 py-14">
                {docInner}
              </div>
            </div>
          )}

          {/* 돋보기 — 화면 상단에 고정된 확대창. 지금 스크롤돼 보이는 부분을 커서 위치 기준으로 확대 */}
          {!editMode && tool === 'zoom' && lensPos && paneSize.width > 0 && docHeight > 0 && (() => {
            const ZOOM = 2.6;
            const panelW = paneSize.width;
            const panelH = Math.min(340, Math.round(paneSize.height * 0.46));
            const scaledW = panelW * ZOOM;
            const scaledH = docHeight * ZOOM;
            let tx = panelW / 2 - lensPos.x * ZOOM;
            let ty = panelH / 2 - (lensPos.y + scrollTop) * ZOOM;
            tx = Math.min(0, Math.max(panelW - scaledW, tx));
            ty = Math.min(0, Math.max(panelH - scaledH, ty));
            return (
              <div
                className="absolute left-0 right-0 top-0 z-30 overflow-hidden rounded-b-[28px] border-b-4 border-primary shadow-2xl pointer-events-none"
                style={{ height: panelH, boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}
              >
                <div
                  className={dark ? 'bg-[#0a0a14]' : 'bg-slate-50'}
                  style={{
                    width: panelW,
                    transform: `translate(${tx}px, ${ty}px) scale(${ZOOM})`,
                    transformOrigin: '0 0',
                  }}
                >
                  <div className="max-w-6xl mx-auto px-8 md:px-16 py-14">
                    {docInner}
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/50 to-transparent" />
                <span className="absolute top-2.5 left-3.5 flex items-center gap-1.5 text-[11px] font-black text-white bg-black/55 px-2.5 py-1 rounded-lg">
                  <ZoomIn size={12} /> 돋보기 {ZOOM}x
                </span>
              </div>
            );
          })()}

          {/* 스포트라이트 (레이저 포인터) — 원 안쪽은 지금 보이는 내용을 밝기/대비만 높여 다시 그려 또렷하게, 바깥은 짙게 어둡게 */}
          {!editMode && tool === 'spotlight' && lensPos && (
            <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
              {/* 원 안쪽 — 같은 스크롤 위치의 같은 콘텐츠를 밝기/대비 필터만 올려 복제 */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  clipPath: `circle(${SPOTLIGHT_RADIUS}px at ${lensPos.x}px ${lensPos.y}px)`,
                  WebkitClipPath: `circle(${SPOTLIGHT_RADIUS}px at ${lensPos.x}px ${lensPos.y}px)`,
                }}
              >
                <div
                  className={`absolute inset-x-0 ${dark ? 'bg-[#0a0a14]' : 'bg-slate-50'}`}
                  style={{ top: -scrollTop, filter: dark ? 'brightness(1.8) contrast(1.15) saturate(1.1)' : 'brightness(1.1) contrast(1.05)' }}
                >
                  <div className="max-w-6xl mx-auto px-8 md:px-16 py-14">
                    {docInner}
                  </div>
                </div>
              </div>
              {/* 원 바깥쪽을 짙게 어둡게 */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'rgba(0,0,0,0.92)',
                  WebkitMaskImage: `radial-gradient(circle ${SPOTLIGHT_RADIUS}px at ${lensPos.x}px ${lensPos.y}px, transparent 0%, transparent 42%, black 78%)`,
                  maskImage: `radial-gradient(circle ${SPOTLIGHT_RADIUS}px at ${lensPos.x}px ${lensPos.y}px, transparent 0%, transparent 42%, black 78%)`,
                } as CSSProperties}
              />
              <div
                className="absolute rounded-full"
                style={{
                  width: SPOTLIGHT_RADIUS * 2,
                  height: SPOTLIGHT_RADIUS * 2,
                  left: lensPos.x - SPOTLIGHT_RADIUS,
                  top: lensPos.y - SPOTLIGHT_RADIUS,
                  boxShadow: '0 0 0 4px rgba(255,255,255,0.95), 0 0 50px 12px rgba(255,255,255,0.6)',
                }}
              />
            </div>
          )}

          {/* 펜 그리기 캔버스 — 이 영역(발표 화면)에 고정, 문서를 스크롤해도 그림은 화면에 그대로 남는다 */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 z-40"
            style={{
              pointerEvents: tool === 'pen' && !editMode ? 'auto' : 'none',
              cursor: tool === 'pen' ? 'crosshair' : 'default',
              touchAction: 'none',
            }}
            onMouseDown={handlePenDown}
            onMouseMove={handlePenMove}
            onMouseUp={handlePenUp}
            onMouseLeave={handlePenUp}
            onDragStart={(e) => e.preventDefault()}
          />
        </div>

        {/* 펜 보조 도구바 — 색상/형광펜/실행취소/지우기 */}
        {tool === 'pen' && !editMode && (
          <div className={`shrink-0 flex items-center justify-center gap-4 px-6 py-3 border-t ${dark ? 'border-white/10 bg-white/5' : 'border-slate-900/10 bg-white'}`}>
            <div className="flex items-center gap-1.5">
              {PEN_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setPenColor(c)}
                  title={c}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${penColor === c ? 'border-primary scale-110' : dark ? 'border-white/20 hover:border-white/50' : 'border-slate-900/15 hover:border-slate-900/40'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button
              onClick={() => setPenHighlight(h => !h)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${penHighlight ? 'bg-primary/30 ring-2 ring-primary text-white' : dark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-slate-900/5 text-slate-600 hover:bg-slate-900/10'}`}
            >
              <Highlighter size={14} /> 형광펜
            </button>
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed transition-all ${dark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-slate-900/5 text-slate-600 hover:bg-slate-900/10'}`}
            >
              <Undo2 size={14} /> 실행취소
            </button>
            <button
              onClick={handleClearPen}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${dark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-slate-900/5 text-slate-600 hover:bg-slate-900/10'}`}
            >
              <XIcon size={14} /> 전체 지우기
            </button>
          </div>
        )}
      </div>

      {/* 이미지 전체화면 보기 — 문서 안 이미지를 클릭하면 확대 */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-8 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-5 right-5 p-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
          >
            <XIcon size={20} />
          </button>
          <img
            src={zoomedImage}
            alt=""
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
    </SlideImageZoomContext.Provider>,
    document.body
  );
};

// ── 다른 클래스에서 가져오기 모달 ─────────────────────────────────────────────
const ImportFromClassModal = ({
  currentClassId,
  userId,
  onImport,
  onClose,
}: {
  currentClassId?: string;
  userId: string;
  onImport: (title: string, content: string, weekNumber: number) => void;
  onClose: () => void;
}) => {
  const [step, setStep] = useState<'class' | 'material'>('class');
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let query = supabase
      .from('classes')
      .select('id, name')
      .eq('teacher_id', userId)
      .eq('is_archived', false);
    if (currentClassId) query = query.neq('id', currentClassId);
    query
      .order('created_at', { ascending: false })
      .then(({ data }) => { setClasses(data || []); setLoading(false); });
  }, []);

  const handleSelectClass = async (cls: any) => {
    setSelectedClass(cls);
    setLoading(true);
    const { data, error } = await supabase
      .from('class_materials')
      .select('id, title, content, is_published, week_number, created_at')
      .eq('class_id', cls.id)
      .order('week_number', { ascending: true });
    if (error) console.error('[ImportModal] class_materials fetch error:', error);
    setMaterials((data || []) as Material[]);
    setLoading(false);
    setStep('material');
  };

  const handleSelectMaterial = (material: Material) => {
    if (!window.confirm(`"${material.title}" 내용을 현재 에디터에 복사하시겠습니까?\n현재 작성 중인 내용이 있다면 덮어씁니다.`)) return;
    onImport(material.title, material.content ?? '', material.week_number ?? 1);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-container shrink-0">
          {step === 'material' && (
            <button
              onClick={() => { setStep('class'); setSelectedClass(null); setMaterials([]); }}
              className="p-1.5 rounded-xl hover:bg-surface-container transition-colors text-on-surface-variant"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm text-on-surface">
              {step === 'class' ? '다른 클래스에서 가져오기' : selectedClass?.name}
            </p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {step === 'class' ? '가져올 자료가 있는 클래스를 선택하세요' : '가져올 자료를 선택하세요'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-surface-container transition-colors text-on-surface-variant shrink-0"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : step === 'class' ? (
            classes.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3 opacity-40">
                <BookOpen size={36} />
                <p className="font-black text-sm">다른 클래스가 없습니다</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {classes.map(cls => (
                  <button
                    key={cls.id}
                    onClick={() => handleSelectClass(cls)}
                    className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-2xl hover:bg-surface-container-low transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <BookOpen size={15} />
                    </div>
                    <span className="font-bold text-sm flex-1 text-on-surface">{cls.name}</span>
                    <ChevronRight size={14} className="text-on-surface-variant group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>
            )
          ) : (
            materials.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3 opacity-40">
                <BookOpen size={36} />
                <p className="font-black text-sm">이 클래스에 자료가 없습니다</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {materials.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMaterial(m)}
                    className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-2xl hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all group"
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      m.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      <BookOpen size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-on-surface truncate">{m.title}</p>
                      {m.content && (
                        <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1 opacity-60">
                          {m.content.slice(0, 60)}…
                        </p>
                      )}
                    </div>
                    <Download size={14} className="text-on-surface-variant group-hover:text-primary transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── 공통 자료함 → 클래스 연결 모달 ────────────────────────────────────────────
const LinkToClassModal = ({
  material,
  classes,
  userId,
  onClose,
  onLinked,
}: {
  material: Material;
  classes: any[];
  userId: string;
  onClose: () => void;
  onLinked: () => void;
}) => {
  const [linkedClassIds, setLinkedClassIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('class_materials')
      .select('class_id')
      .eq('source_material_id', material.id)
      .then(({ data }) => {
        setLinkedClassIds((data || []).map((d: any) => d.class_id));
        setLoading(false);
      });
  }, [material.id]);

  const toggle = (classId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId); else next.add(classId);
      return next;
    });
  };

  const handleLink = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const rows = Array.from(selected).map(classId => ({
        class_id: classId,
        teacher_id: userId,
        week_number: 1,
        title: material.title,
        content: material.content ?? '',
        ai_versions: material.ai_versions ?? [],
        is_published: false,
        source_material_id: material.id,
      }));
      const { error } = await supabase.from('class_materials').insert(rows);
      if (error) throw error;
      onLinked();
      onClose();
    } catch (err: any) {
      alert(`연결 중 오류가 발생했습니다.\n${err?.message || JSON.stringify(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-container shrink-0">
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm text-on-surface truncate">"{material.title}" 연결하기</p>
            <p className="text-xs text-on-surface-variant mt-0.5">연결할 클래스를 선택하세요 (여러 개 가능)</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-surface-container transition-colors text-on-surface-variant shrink-0"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : classes.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3 opacity-40">
              <BookOpen size={36} />
              <p className="font-black text-sm">연결할 클래스가 없습니다</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {classes.map(cls => {
                const isLinked = linkedClassIds.includes(cls.id);
                const isSelected = selected.has(cls.id);
                return (
                  <button
                    key={cls.id}
                    onClick={() => !isLinked && toggle(cls.id)}
                    disabled={isLinked}
                    className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-2xl border transition-all ${
                      isLinked
                        ? 'border-transparent opacity-40 cursor-not-allowed'
                        : isSelected
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-transparent hover:bg-surface-container-low'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-primary/15 text-primary' : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      <BookOpen size={15} />
                    </div>
                    <span className="font-bold text-sm flex-1 text-on-surface">{cls.name}</span>
                    {isLinked
                      ? <span className="text-[10px] font-black text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full shrink-0">연결됨</span>
                      : isSelected
                        ? <Check size={16} className="text-primary shrink-0" />
                        : null
                    }
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 하단 액션 */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-surface-container shrink-0">
          <p className="flex-1 text-xs font-bold text-on-surface-variant">
            {selected.size > 0 ? `${selected.size}개 클래스 선택됨` : '클래스를 선택하세요'}
          </p>
          <button
            onClick={handleLink}
            disabled={selected.size === 0 || saving}
            className="flex items-center gap-2 px-5 py-2.5 btn-gradient rounded-xl font-black text-sm text-white shadow hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            연결하기
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── 미리보기 전체화면 모달 ────────────────────────────────────────────────────
const PreviewFullscreenModal = ({
  title,
  content,
  onClose,
}: {
  title: string;
  content: string;
  onClose: () => void;
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.documentElement.style.overflow = prev;
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[9998] bg-white flex flex-col overflow-hidden">
      {/* 상단 헤더 */}
      <div className="flex items-center gap-3 px-5 py-3 bg-slate-800 shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-800 font-black text-sm hover:bg-slate-100 active:scale-95 transition-all shadow"
        >
          <ArrowLeft size={15} /> 나가기
        </button>
        <div className="flex items-center gap-2 ml-2">
          <Eye size={15} className="text-white/60" />
          <span className="font-black text-sm text-white/80 truncate max-w-xs">{title || '미리보기'}</span>
        </div>
      </div>
      {/* 본문 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-10">
          <ReactMarkdown components={mdComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── 마크다운 컴포넌트 렌더러 ──────────────────────────────────────────────────
const mdComponents: any = {
  h1: ({ children }: any) => <h1 className="text-2xl font-black mb-4 mt-6 text-on-surface">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-xl font-black mb-3 mt-5 text-on-surface">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-lg font-black mb-2 mt-4 text-on-surface">{children}</h3>,
  p: ({ children }: any) => <p className="mb-3 leading-relaxed text-sm text-on-surface">{children}</p>,
  ul: ({ children }: any) => <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>,
  li: ({ children }: any) => <li className="text-sm text-on-surface">{children}</li>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-primary pl-4 italic text-on-surface-variant my-3 bg-surface-container-low py-2 rounded-r-xl">
      {children}
    </blockquote>
  ),
  // 인라인 코드 (className 없는 경우)
  code: ({ children, className }: any) => {
    if (!className) {
      return <code className="bg-surface-container px-1.5 py-0.5 rounded text-sm font-mono text-primary">{children}</code>;
    }
    // 블록 코드는 pre에서 처리하므로 그대로 전달
    return <code className={className}>{children}</code>;
  },
  // 블록 코드 — CodeBlock 컴포넌트 사용
  pre: ({ children }: any) => {
    const child = (Array.isArray(children) ? children[0] : children) as any;
    const className = child?.props?.className || '';
    const lang = className.replace('language-', '') || 'text';
    const code = String(child?.props?.children ?? '').replace(/\n$/, '');
    return <CodeBlock lang={lang} code={code} />;
  },
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-70">
      {children}
    </a>
  ),
  img: ({ src, alt, title }: any) => {
    const wm = (title || '').match(/^width:(\d+)$/);
    const style = wm ? { width: `${wm[1]}px`, maxWidth: '100%' } : undefined;
    return <img src={src} alt={alt} style={style} className="max-w-full rounded-xl my-3 shadow" />;
  },
  hr: () => <hr className="border-surface-container my-5" />,
  strong: ({ children }: any) => <strong className="font-black">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  table: ({ children }: any) => (
    <div className="overflow-auto mb-3">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="border border-surface-container px-3 py-2 bg-surface-container font-black text-left">{children}</th>
  ),
  td: ({ children }: any) => (
    <td className="border border-surface-container px-3 py-2">{children}</td>
  ),
  details: ({ children }: any) => (
    <details className="my-3 rounded-xl border border-surface-container overflow-hidden">
      {children}
    </details>
  ),
  summary: ({ children }: any) => (
    <summary className="px-4 py-2.5 bg-surface-container-low cursor-pointer font-black text-sm list-none flex items-center gap-2 select-none hover:bg-surface-container transition-colors">
      <span className="text-primary text-xs">▶</span> {children}
    </summary>
  ),
  div: (props: any) => renderCallout(props, false),
};

// ── AI 재구성 모달 (학습 가이드) ─────────────────────────────────
type ReorganizeStep = 'configure' | 'loading' | 'preview' | 'error';

const AiReorganizeModal = ({
  rawContent,
  classId,
  onApply,
  onClose,
}: {
  rawContent: string;
  classId?: string;
  onApply: (newContent: string, mode: 'guide' | 'presentation') => void;
  onClose: () => void;
}) => {
  const [step, setStep] = useState<ReorganizeStep>('configure');
  const mode = 'guide' as const;
  const [userInstruction, setUserInstruction] = useState('');
  const [showBasePrompt, setShowBasePrompt] = useState(false);
  const [result, setResult] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationWarning, setValidationWarning] = useState<{ message: string; guide?: string } | null>(null);

  const runGenerate = async () => {
    setStep('loading');
    setFeedback(null);
    try {
      const generated = await reorganizeMaterialContent(rawContent, mode, userInstruction, classId);
      setResult(generated.content);
      setFeedback(generated.feedback);
      setStep('preview');
    } catch (err: any) {
      setErrorMessage(
        err?.message === 'AI_LIMIT_EXCEEDED'
          ? '이번 달 AI 사용 한도에 도달했습니다.'
          : (err?.message || 'AI 정리 중 오류가 발생했습니다.')
      );
      setStep('error');
    }
  };

  const handleGenerate = async () => {
    const trimmed = userInstruction.trim();
    if (!trimmed) {
      setValidationWarning(null);
      await runGenerate();
      return;
    }
    setValidating(true);
    setValidationWarning(null);
    const check = await validateReorganizeInstruction(trimmed, mode);
    setValidating(false);
    if (!check.feasible) {
      setValidationWarning({ message: check.message, guide: check.guide });
      return;
    }
    await runGenerate();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/40 px-4"
      onClick={step === 'loading' ? undefined : onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-container shrink-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Sparkles size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm text-on-surface">AI로 정리</p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {step === 'configure' && '학습 가이드로 정리'}
              {step === 'loading' && 'AI가 정리하는 중입니다...'}
              {step === 'preview' && '결과를 확인하세요'}
              {step === 'error' && '오류가 발생했습니다'}
            </p>
          </div>
          {step !== 'loading' && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-surface-container transition-colors text-on-surface-variant shrink-0"
            >
              <XIcon size={16} />
            </button>
          )}
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 'configure' && (
            <div className="space-y-3">
              <button
                onClick={() => setShowBasePrompt(s => !s)}
                className="flex items-center gap-1.5 text-xs font-bold text-primary hover:opacity-70 transition-opacity"
              >
                {showBasePrompt ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                AI에게 전달되는 기본 지침 보기
              </button>
              {showBasePrompt && (
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-on-surface-variant bg-surface-container-low rounded-2xl p-4 font-sans">
                  {MATERIAL_REORG_PROMPTS[mode]}
                </pre>
              )}
              <div>
                <p className="text-xs font-black text-on-surface-variant mb-1.5">추가로 반영하고 싶은 요청사항 (선택)</p>
                <textarea
                  value={userInstruction}
                  onChange={e => { setUserInstruction(e.target.value); setValidationWarning(null); }}
                  placeholder="예: 중학생 눈높이로 쉽게 풀어줘"
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white rounded-xl border border-surface-container text-sm focus:outline-none focus:border-primary/40 resize-none"
                />
              </div>
              {validationWarning && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <div className="text-xs font-bold leading-relaxed space-y-1">
                    <p>{validationWarning.message}</p>
                    {validationWarning.guide && (
                      <p className="text-amber-700">💡 {validationWarning.guide}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm font-bold text-on-surface-variant">AI가 정리하는 중입니다...</p>
            </div>
          )}

          {step === 'preview' && (
            <>
              {feedback && (
                <div className="flex items-start gap-2 px-4 py-3 mb-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <div className="text-xs font-bold leading-relaxed whitespace-pre-line">{feedback}</div>
                </div>
              )}
              <div className="max-h-[50vh] overflow-auto">
                <ReactMarkdown components={mdComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{result}</ReactMarkdown>
              </div>
            </>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center py-12 gap-3 text-center">
              <AlertCircle size={32} className="text-red-400" />
              <p className="text-sm font-bold text-on-surface-variant">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* 하단 액션 */}
        {step !== 'loading' && (
          <div className="flex items-center gap-2 px-5 py-4 border-t border-surface-container bg-surface-container-low/50 shrink-0">
            {step === 'configure' && (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  취소
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleGenerate}
                  disabled={validating}
                  className="flex items-center gap-2 px-6 py-2.5 btn-gradient rounded-xl font-black text-sm text-white shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:hover:scale-100 transition-all"
                >
                  {validating
                    ? <><Loader2 size={15} className="animate-spin" /> 요청사항 확인 중...</>
                    : <><Sparkles size={15} /> 정리 시작</>}
                </button>
              </>
            )}
            {step === 'preview' && (
              <>
                <button
                  onClick={() => { setFeedback(null); setStep('configure'); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  <RotateCcw size={14} /> 다시 요청
                </button>
                <div className="flex-1" />
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => onApply(result, mode)}
                  className="flex items-center gap-2 px-6 py-2.5 btn-gradient rounded-xl font-black text-sm text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <Save size={15} /> 적용
                </button>
              </>
            )}
            {step === 'error' && (
              <>
                <div className="flex-1" />
                <button
                  onClick={() => setStep('configure')}
                  className="px-4 py-2 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  뒤로
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl font-black text-sm text-white bg-red-400 hover:bg-red-500 transition-colors"
                >
                  닫기
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

const MaterialEditor = () => {
  const { user } = useAuth();

  // 클래스
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);
  // 공통 자료함 — 클래스 선택 없이 만들어두고 나중에 원하는 클래스에 연결
  const [libraryMode, setLibraryMode] = useState(false);
  const [linkingMaterial, setLinkingMaterial] = useState<Material | null>(null);

  // 자료 목록
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  // 에디터 열림 여부
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  // 폼 필드
  const [title, setTitle] = useState('');
  const [weekNumber, setWeekNumber] = useState(1);
  const [content, setContent] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  // UI 상태
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [presentingMaterial, setPresentingMaterial] = useState<Material | null>(null);
  // 발표 모드에서 "저장" 시 어디에 반영할지 (원본 draft / 특정 AI 버전 / DB 직접 저장 등 호출부마다 다름)
  const [presentingOnSave, setPresentingOnSave] = useState<((newContent: string) => void) | null>(null);
  const closePresenting = () => { setPresentingMaterial(null); setPresentingOnSave(null); };
  const [fullscreenPreview, setFullscreenPreview] = useState<{ title: string; content: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAiReorganize, setShowAiReorganize] = useState(false);
  const [aiVersions, setAiVersions] = useState<AiVersion[]>([]);
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  // 목록 화면에서 자료별로 "원본" 또는 AI 정리 버전 중 어떤 걸 보고 있는지 (null = 원본)
  const [selectedVersionId, setSelectedVersionId] = useState<Record<string, string | null>>({});
  const [versionMenuFor, setVersionMenuFor] = useState<string | null>(null);

  const getActiveVersion = (material: Material): { content: string; label: string } => {
    const selId = selectedVersionId[material.id];
    const v = selId ? material.ai_versions?.find(v => v.id === selId) : undefined;
    return v ? { content: v.content, label: v.label } : { content: material.content, label: '원본' };
  };

  useEffect(() => {
    if (user) fetchClasses();
  }, [user?.id]);

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, class_type, weekly_plan')
      .eq('teacher_id', user!.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    if (data) setClasses(data);
  };

  const fetchMaterials = async (classId: string) => {
    setMaterialsLoading(true);
    try {
      const { data } = await supabase
        .from('class_materials')
        .select('*')
        .eq('class_id', classId)
        .order('week_number', { ascending: true });

      if (data && data.length > 0) {
        // 열람 수 집계
        const { data: viewData } = await supabase
          .from('student_material_views')
          .select('material_id')
          .in('material_id', data.map(m => m.id));

        const viewCounts: Record<string, number> = {};
        viewData?.forEach(v => {
          viewCounts[v.material_id] = (viewCounts[v.material_id] || 0) + 1;
        });

        setMaterials(data.map(m => ({ ...m, view_count: viewCounts[m.id] || 0 })));
      } else {
        setMaterials(data || []);
      }
    } finally {
      setMaterialsLoading(false);
    }
  };

  const fetchLibraryMaterials = async () => {
    setMaterialsLoading(true);
    try {
      const { data } = await supabase
        .from('class_materials')
        .select('*')
        .is('class_id', null)
        .eq('teacher_id', user!.id)
        .order('created_at', { ascending: false });
      setMaterials(data ?? []);
    } finally {
      setMaterialsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle(''); setWeekNumber(1); setContent(''); setIsPublished(false);
    setEditingMaterial(null); setViewMode('edit'); setAiVersions([]);
  };

  const handleNew = () => {
    resetForm();
    setIsEditorOpen(true);
  };

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    setTitle(material.title || '');
    setWeekNumber(material.week_number ?? 1);
    setContent(material.content || '');
    setIsPublished(material.is_published || false);
    setViewMode('edit');
    setAiVersions(material.ai_versions ?? []);
    setIsEditorOpen(true);
  };

  // ── 이미지 업로드 — WebP 변환 후 Supabase 저장 ───────────────────────────
  const handleUploadImage = async (file: File): Promise<string> => {
    if (!user) throw new Error('로그인 필요');
    if (file.size > 50 * 1024 * 1024) {
      alert('파일 크기가 너무 큽니다. 50MB 이하 이미지만 업로드 가능합니다.');
      throw new Error('파일 크기 초과');
    }
    setUploading(true);
    try {
      const compressed = await compressToWebP(file);
      if (compressed.size > 20 * 1024 * 1024) {
        alert('변환 후에도 20MB를 초과합니다. 더 작은 이미지를 사용해주세요.');
        throw new Error('파일 크기 초과');
      }
      const path = `materials/${user.id}/${Date.now()}.webp`;
      const { error } = await supabase.storage.from('student-attachments').upload(path, compressed);
      if (error) throw error;
      const { data } = supabase.storage.from('student-attachments').getPublicUrl(path);
      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  };

  // ── 저장 ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!libraryMode && !selectedClass) { alert('클래스를 선택해주세요.'); return; }
    if (!title.trim()) { alert('제목을 입력해주세요.'); return; }
    setSaving(true);
    try {
      const payload = {
        class_id: libraryMode ? null : selectedClass.id,
        teacher_id: user!.id,
        week_number: weekNumber,
        title: title.trim(),
        content: (content ?? '').trim(),
        is_published: libraryMode ? false : isPublished,
        ai_versions: aiVersions,
        updated_at: new Date().toISOString(),
      };
      if (editingMaterial) {
        const { error } = await supabase.from('class_materials').update(payload).eq('id', editingMaterial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('class_materials').insert(payload);
        if (error) throw error;
      }
      if (libraryMode) await fetchLibraryMaterials(); else await fetchMaterials(selectedClass.id);
      setIsEditorOpen(false);
      resetForm();
    } catch (err: any) {
      console.error('[MaterialEditor] save error:', err);
      alert(`저장 중 오류가 발생했습니다.\n${err?.message || JSON.stringify(err)}`);
    }
    finally { setSaving(false); }
  };

  // ── 삭제 ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('이 수업 자료를 삭제하시겠습니까?')) return;
    await supabase.from('class_materials').delete().eq('id', id);
    if (libraryMode) await fetchLibraryMaterials(); else await fetchMaterials(selectedClass.id);
  };

  // ── 복사 ──────────────────────────────────────────────────────────────────
  const handleCopy = async (material: Material) => {
    if (!confirm(`"${material.title}"을(를) 복사하시겠습니까?`)) return;
    const { error } = await supabase.from('class_materials').insert({
      class_id: selectedClass.id,
      week_number: material.week_number,
      title: `${material.title} (복사)`,
      content: material.content ?? '',
      is_published: false,
    });
    if (!error) await fetchMaterials(selectedClass.id);
  };

  // ── 공개/비공개 토글 ──────────────────────────────────────────────────────
  const handleTogglePublish = async (material: Material) => {
    const next = !material.is_published;
    const { error } = await supabase
      .from('class_materials')
      .update({ is_published: next, updated_at: new Date().toISOString() })
      .eq('id', material.id);
    if (!error) setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, is_published: next } : m));
  };

  // ── AI 정리 히스토리 개별 삭제 (편집 화면) ────────────────────────────────
  const handleDeleteAiVersion = async (v: AiVersion) => {
    if (!confirm(`"${v.label}" 버전을 삭제하시겠습니까?`)) return;
    const next = aiVersions.filter(x => x.id !== v.id);
    setAiVersions(next);
    if (editingMaterial?.id) {
      const { error } = await supabase
        .from('class_materials')
        .update({ ai_versions: next, updated_at: new Date().toISOString() })
        .eq('id', editingMaterial.id);
      if (!error) setMaterials(prev => prev.map(m => m.id === editingMaterial.id ? { ...m, ai_versions: next } : m));
    }
  };

  // ── AI 정리 히스토리 개별 삭제 (목록 화면) ────────────────────────────────
  const handleDeleteMaterialVersion = async (material: Material, v: AiVersion) => {
    if (!confirm(`"${v.label}" 버전을 삭제하시겠습니까?`)) return;
    const nextVersions = (material.ai_versions ?? []).filter(x => x.id !== v.id);
    const { error } = await supabase
      .from('class_materials')
      .update({ ai_versions: nextVersions, updated_at: new Date().toISOString() })
      .eq('id', material.id);
    if (!error) {
      setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, ai_versions: nextVersions } : m));
      if (selectedVersionId[material.id] === v.id) {
        setSelectedVersionId(prev => ({ ...prev, [material.id]: null }));
      }
    }
  };

  // ── 목록 화면 발표 모드에서 편집 저장 (원본 또는 특정 AI 버전) ────────────────
  const persistMaterialVersion = async (material: Material, versionId: string | null, newContent: string) => {
    if (versionId) {
      const nextVersions = (material.ai_versions ?? []).map(v => v.id === versionId ? { ...v, content: newContent } : v);
      const { error } = await supabase
        .from('class_materials')
        .update({ ai_versions: nextVersions, updated_at: new Date().toISOString() })
        .eq('id', material.id);
      if (!error) setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, ai_versions: nextVersions } : m));
    } else {
      const { error } = await supabase
        .from('class_materials')
        .update({ content: newContent, updated_at: new Date().toISOString() })
        .eq('id', material.id);
      if (!error) setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, content: newContent } : m));
    }
  };

  return (
    <>
    {presentingMaterial && (
      <PresentationModal
        material={presentingMaterial}
        onClose={closePresenting}
        onSave={presentingOnSave ?? undefined}
      />
    )}
    {showImportModal && user && (
      <ImportFromClassModal
        currentClassId={selectedClass?.id}
        userId={user.id}
        onImport={(importedTitle, importedContent, importedWeek) => {
          setTitle(importedTitle ?? '');
          setWeekNumber(importedWeek ?? 1);
          setContent(importedContent ?? '');
        }}
        onClose={() => setShowImportModal(false)}
      />
    )}
    {fullscreenPreview && (
      <PreviewFullscreenModal
        title={fullscreenPreview.title}
        content={fullscreenPreview.content}
        onClose={() => setFullscreenPreview(null)}
      />
    )}
    {showAiReorganize && (
      <AiReorganizeModal
        rawContent={content}
        classId={selectedClass?.id}
        onApply={(newContent, mode) => {
          const newVersion: AiVersion = {
            id: crypto.randomUUID(),
            mode,
            label: mode === 'guide' ? '학습 가이드' : '발표 자료',
            content: newContent,
            created_at: new Date().toISOString(),
          };
          // 원본(content)은 절대 건드리지 않고, 결과는 히스토리에만 추가한다
          setAiVersions(prev => [newVersion, ...prev]);
          setShowAiReorganize(false);
          // 방금 만든 결과를 바로 발표 모드로 열어서 확인/편집할 수 있게 한다
          setPresentingMaterial({
            id: editingMaterial?.id ?? 'draft',
            class_id: selectedClass?.id ?? null,
            week_number: weekNumber,
            title: `${title.trim() || '(제목 없음)'} · ${newVersion.label}`,
            content: newVersion.content,
            url: '',
            is_published: isPublished,
            created_at: newVersion.created_at,
            updated_at: newVersion.created_at,
          });
          setPresentingOnSave(() => (updated: string) => {
            setAiVersions(prev => prev.map(v => v.id === newVersion.id ? { ...v, content: updated } : v));
          });
        }}
        onClose={() => setShowAiReorganize(false)}
      />
    )}
    {linkingMaterial && user && (
      <LinkToClassModal
        material={linkingMaterial}
        classes={classes}
        userId={user.id}
        onLinked={() => fetchLibraryMaterials()}
        onClose={() => setLinkingMaterial(null)}
      />
    )}
    <div className="space-y-5">
      {/* ── 상단: 클래스 선택 + 새 자료 버튼 ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setClassDropdownOpen(o => !o)}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container rounded-2xl border-2 border-transparent hover:border-primary/20 transition-all font-black text-sm"
          >
            {libraryMode ? '클래스 선택' : (selectedClass ? selectedClass.name : '클래스 선택')}
            <ChevronDown size={15} className="text-on-surface-variant" />
          </button>
          {classDropdownOpen && (
            <div className="absolute top-full mt-2 left-0 bg-white rounded-2xl shadow-xl border border-surface-container z-50 min-w-[200px] overflow-hidden">
              {classes.length === 0 ? (
                <p className="px-4 py-3 text-sm text-on-surface-variant font-bold">클래스 없음</p>
              ) : classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => { setSelectedClass(cls); setLibraryMode(false); setClassDropdownOpen(false); fetchMaterials(cls.id); setIsEditorOpen(false); resetForm(); }}
                  className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors text-sm font-bold"
                >
                  {cls.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => { setLibraryMode(true); setSelectedClass(null); setIsEditorOpen(false); resetForm(); fetchLibraryMaterials(); }}
          title="클래스 선택 없이 공통으로 쓸 자료를 만들고, 나중에 원하는 클래스에 연결할 수 있습니다"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 transition-all font-black text-sm ${
            libraryMode
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-surface-container border-transparent hover:border-primary/20'
          }`}
        >
          <Library size={15} /> 공통 자료함
        </button>

        {(selectedClass || libraryMode) && !isEditorOpen && (
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2.5 btn-gradient rounded-2xl font-black text-sm text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={15} /> 새 자료 작성
          </button>
        )}
      </div>

      {/* ── 에디터 패널 ── */}
      {isEditorOpen && (
        <div className="bg-white rounded-3xl border border-surface-container overflow-hidden shadow-sm">

          {/* 에디터 헤더 */}
          <div className="flex items-center flex-wrap gap-2 px-5 py-3.5 border-b border-surface-container bg-surface-container-low">
            <button
              onClick={() => { setIsEditorOpen(false); resetForm(); }}
              className="p-1.5 rounded-xl hover:bg-surface-container transition-colors text-on-surface-variant"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="font-black text-sm flex-1">
              {libraryMode
                ? (editingMaterial ? '공통 자료 수정' : '새 공통 자료 작성')
                : (editingMaterial ? '수업 자료 수정' : '새 수업 자료 작성')}
            </span>
            {/* AI로 정리 */}
            <button
              onClick={() => setShowAiReorganize(true)}
              disabled={!content.trim()}
              title={content.trim() ? 'AI로 학습 가이드/발표 자료 정리' : '내용을 먼저 작성해주세요'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 font-black text-xs transition-colors border border-violet-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles size={12} /> AI로 정리
            </button>
            {/* AI 정리 히스토리 */}
            {aiVersions.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowVersionMenu(o => !o)}
                  title="AI로 정리한 이전 결과 보기"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container text-on-surface-variant hover:bg-surface-container-low hover:text-primary font-black text-xs transition-colors border border-surface-container"
                >
                  <History size={12} /> 정리 히스토리 ({aiVersions.length})
                </button>
                {showVersionMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowVersionMenu(false)} />
                    <div className="absolute top-full mt-2 right-0 bg-white rounded-2xl shadow-xl border border-surface-container z-50 w-72 overflow-hidden">
                      <p className="px-4 pt-3 pb-2 text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                        AI 정리 결과 목록
                      </p>
                      <div className="max-h-64 overflow-y-auto">
                        {aiVersions.map(v => (
                          <div key={v.id} className="flex items-center group hover:bg-surface-container-low transition-colors">
                            <button
                              onClick={() => {
                                setShowVersionMenu(false);
                                // 원본(content)은 건드리지 않고, 이 버전만 발표 모드로 열어서 보기/편집한다
                                setPresentingMaterial({
                                  id: editingMaterial?.id ?? 'draft',
                                  class_id: selectedClass?.id ?? null,
                                  week_number: weekNumber,
                                  title: `${title.trim() || '(제목 없음)'} · ${v.label}`,
                                  content: v.content,
                                  url: '',
                                  is_published: isPublished,
                                  created_at: v.created_at,
                                  updated_at: new Date().toISOString(),
                                });
                                setPresentingOnSave(() => (updated: string) => {
                                  setAiVersions(prev => prev.map(x => x.id === v.id ? { ...x, content: updated } : x));
                                });
                              }}
                              className="flex-1 min-w-0 flex items-center gap-2 text-left pl-4 pr-2 py-2.5"
                            >
                              {v.mode === 'guide'
                                ? <BookOpen size={13} className="text-primary shrink-0" />
                                : <Presentation size={13} className="text-violet-600 shrink-0" />}
                              <span className="flex-1 min-w-0">
                                <span className="block text-xs font-black truncate">{v.label}</span>
                                <span className="block text-[10px] font-bold text-on-surface-variant">{formatVersionDate(v.created_at)}</span>
                              </span>
                            </button>
                            <button
                              onClick={() => handleDeleteAiVersion(v)}
                              title="이 버전 삭제"
                              className="shrink-0 p-1.5 mr-2 rounded-lg text-on-surface-variant hover:bg-red-50 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {/* 편집 중인 내용을 바로 발표 모드로 */}
            <button
              onClick={() => {
                setPresentingMaterial({
                  id: editingMaterial?.id ?? 'draft',
                  class_id: selectedClass?.id ?? '',
                  week_number: weekNumber,
                  title: title.trim() || '(제목 없음)',
                  content,
                  url: '',
                  is_published: isPublished,
                  created_at: editingMaterial?.created_at ?? new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                // 발표 화면에서 슬라이드를 편집해도 원본(content)은 건드리지 않는다 — 편집은 발표 세션 내에서만 반영
                setPresentingOnSave(() => () => {});
              }}
              disabled={!content.trim()}
              title={content.trim() ? '지금 편집 중인 내용을 바로 발표 모드로 보기' : '내용을 먼저 작성해주세요'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 font-black text-xs transition-colors border border-violet-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Presentation size={12} /> 발표
            </button>
            {/* 다른 클래스에서 가져오기 */}
            <button
              onClick={() => setShowImportModal(true)}
              title="다른 클래스 자료 가져오기"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/8 text-primary hover:bg-primary/15 font-black text-xs transition-colors border border-primary/15"
            >
              <Download size={12} /> 가져오기
            </button>
            {/* 저장 (상단에서도 바로 저장 가능) */}
            <button
              onClick={handleSave}
              disabled={saving || uploading}
              title={uploading ? '이미지 업로드 완료 후 저장 가능합니다' : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 btn-gradient rounded-xl font-black text-xs text-white shadow hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              {(saving || uploading) ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {editingMaterial ? '수정 완료' : '저장'}
            </button>
            {/* 뷰 모드 토글 */}
            <div className="flex items-center gap-0.5 bg-surface-container rounded-xl p-1">
              {(['edit', 'preview'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={mode === 'edit' ? '편집 모드' : '미리보기'}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition-all ${
                    viewMode === mode
                      ? 'bg-white shadow text-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {mode === 'edit' ? <>편집</> : <><Eye size={12}/> 미리보기</>}
                </button>
              ))}
            </div>
          </div>

          {/* 메타 정보 입력 */}
          <div className="flex flex-wrap gap-2.5 px-5 py-3 border-b border-surface-container bg-surface-container-low/50">
            {!libraryMode && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-black text-on-surface-variant whitespace-nowrap">주차</span>
                <input
                  type="number"
                  min={1}
                  value={weekNumber}
                  onChange={e => setWeekNumber(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 px-2 py-2 bg-white rounded-xl border border-surface-container font-black text-sm text-center focus:outline-none focus:border-primary/40"
                />
              </div>
            )}
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="자료 제목을 입력하세요 *"
              className="flex-1 min-w-[180px] px-4 py-2 bg-white rounded-xl border border-surface-container font-black text-sm focus:outline-none focus:border-primary/40"
            />
          </div>

          {/* 편집 / 미리보기 영역 */}
          {viewMode === 'edit' ? (
            <RichEditor
              value={content}
              onChange={setContent}
              onUploadImage={handleUploadImage}
              uploading={uploading}
            />
          ) : (
            <div className="relative min-h-[440px] p-6 overflow-auto bg-white">
              {content.trim() ? (
                <>
                  <button
                    onClick={() => setFullscreenPreview({ title, content })}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors z-10"
                    title="전체 화면으로 보기"
                  >
                    <Maximize2 size={15} />
                  </button>
                  <ReactMarkdown components={mdComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
                  <EyeOff size={32} />
                  <p className="text-sm font-bold">편집창에 내용을 작성하면 미리보기가 표시됩니다</p>
                </div>
              )}
            </div>
          )}

          {/* 하단 액션 바 */}
          <div className="flex items-center gap-3 px-5 py-4 border-t border-surface-container bg-surface-container-low/50">
            {libraryMode ? (
              <p className="text-xs font-bold text-on-surface-variant opacity-60 flex items-center gap-1.5">
                <Library size={14} /> 공통 자료함에는 학생에게 공개되지 않습니다. 저장 후 원하는 클래스에 연결하면 그 클래스에서 공개 여부를 설정할 수 있습니다.
              </p>
            ) : (
              <>
                {/* 공개 토글 */}
                <button
                  onClick={() => setIsPublished(p => !p)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-black text-sm transition-all ${
                    isPublished
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-white border-surface-container text-on-surface-variant hover:border-primary/20'
                  }`}
                >
                  {isPublished ? <><Globe size={14} /> 학생 공개 중</> : <><Lock size={14} /> 비공개</>}
                </button>
                <p className="text-xs font-bold text-on-surface-variant opacity-60">
                  {isPublished ? '학생이 수업자료 탭에서 볼 수 있습니다' : '저장 후 공개 여부를 설정하세요'}
                </p>
              </>
            )}
            <div className="flex-1" />
            <button
              onClick={() => { setIsEditorOpen(false); resetForm(); }}
              className="px-4 py-2 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || uploading}
              title={uploading ? '이미지 업로드 완료 후 저장 가능합니다' : undefined}
              className="flex items-center gap-2 px-6 py-2.5 btn-gradient rounded-xl font-black text-sm text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : uploading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {uploading ? '이미지 업로드 중...' : editingMaterial ? '수정 완료' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* ── 자료 목록 ── */}
      {(selectedClass || libraryMode) && !isEditorOpen && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
              {libraryMode ? `공통 자료함 (${materials.length}개)` : `${selectedClass.name} 수업 자료 (${materials.length}개)`}
            </p>
          </div>

          {materialsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center py-16 space-y-3 opacity-30">
              <BookOpen size={48} />
              <p className="font-black">{libraryMode ? '아직 등록된 공통 자료가 없습니다.' : '아직 작성된 수업 자료가 없습니다.'}</p>
              <p className="text-sm font-bold">위의 '새 자료 작성' 버튼을 눌러 시작하세요.</p>
            </div>
          ) : (
            materials.map(material => (
              <div key={material.id} className="bg-white rounded-2xl border border-surface-container transition-all hover:border-primary/20 hover:shadow-sm">
                {/* 자료 헤더 */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      material.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      <BookOpen size={16} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm truncate">{material.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {material.is_published
                          ? <span className="shrink-0 whitespace-nowrap text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">● 공개 중</span>
                          : <span className="shrink-0 whitespace-nowrap text-[10px] font-black text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">● 비공개</span>
                        }
                        {material.content && <span className="shrink-0 whitespace-nowrap text-[10px] font-bold text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full">📝 내용 있음</span>}
                        {(material.view_count ?? 0) > 0 && (
                          <span className="shrink-0 whitespace-nowrap text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Users size={9} /> {material.view_count}명 열람
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="flex items-center gap-1 flex-wrap shrink-0 sm:justify-end">
                    {/* 원본/AI 정리 버전 선택 — 목록 화면에서도 선택해서 볼 수 있게 */}
                    {(material.ai_versions?.length ?? 0) > 0 && (
                      <div className="relative shrink-0">
                        <button
                          onClick={() => setVersionMenuFor(v => v === material.id ? null : material.id)}
                          title="보고 싶은 버전 선택 (원본 / AI 정리 결과)"
                          className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container text-on-surface-variant hover:bg-surface-container-low hover:text-primary font-black text-xs transition-colors border border-surface-container"
                        >
                          <History size={12} /> {getActiveVersion(material).label} <ChevronDown size={11} />
                        </button>
                        {versionMenuFor === material.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setVersionMenuFor(null)} />
                            <div className="absolute top-full mt-1 left-0 bg-white rounded-2xl shadow-xl border border-surface-container z-50 w-64 overflow-hidden">
                              <p className="px-4 pt-3 pb-2 text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                                어떤 버전을 볼까요?
                              </p>
                              <div className="max-h-64 overflow-y-auto">
                                <button
                                  onClick={() => { setSelectedVersionId(prev => ({ ...prev, [material.id]: null })); setVersionMenuFor(null); }}
                                  className="w-full flex items-center gap-2 text-left px-4 py-2.5 hover:bg-surface-container-low transition-colors"
                                >
                                  <span className="flex-1 min-w-0"><span className="block text-xs font-black">원본</span></span>
                                  {!selectedVersionId[material.id] && <Check size={13} className="text-emerald-500 shrink-0" />}
                                </button>
                                {material.ai_versions!.map(v => (
                                  <div key={v.id} className="flex items-center group hover:bg-surface-container-low transition-colors">
                                    <button
                                      onClick={() => { setSelectedVersionId(prev => ({ ...prev, [material.id]: v.id })); setVersionMenuFor(null); }}
                                      className="flex-1 min-w-0 flex items-center gap-2 text-left pl-4 pr-2 py-2.5"
                                    >
                                      {v.mode === 'guide'
                                        ? <BookOpen size={13} className="text-primary shrink-0" />
                                        : <Presentation size={13} className="text-violet-600 shrink-0" />}
                                      <span className="flex-1 min-w-0">
                                        <span className="block text-xs font-black truncate">{v.label}</span>
                                        <span className="block text-[10px] font-bold text-on-surface-variant">{formatVersionDate(v.created_at)}</span>
                                      </span>
                                      {selectedVersionId[material.id] === v.id && <Check size={13} className="text-emerald-500 shrink-0" />}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMaterialVersion(material, v)}
                                      title="이 버전 삭제"
                                      className="shrink-0 p-1.5 mr-2 rounded-lg text-on-surface-variant hover:bg-red-50 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {/* 발표 모드 */}
                    {material.content && (
                      <button
                        onClick={() => {
                          const versionId = selectedVersionId[material.id] ?? null;
                          setPresentingMaterial({ ...material, content: getActiveVersion(material).content });
                          // AI 정리 버전 편집은 그대로 저장하되, 원본(versionId 없음)은 발표 화면 편집으로 덮어쓰지 않는다
                          setPresentingOnSave(() => (updated: string) => {
                            if (versionId) persistMaterialVersion(material, versionId, updated);
                          });
                        }}
                        title="전체화면 발표 모드"
                        className="shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 font-black text-xs transition-colors"
                      >
                        <Presentation size={13} /> 발표
                      </button>
                    )}
                    {/* 미리보기 토글 */}
                    <button
                      onClick={() => setExpandedId(expandedId === material.id ? null : material.id)}
                      title="내용 미리보기"
                      className="shrink-0 p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
                    >
                      {expandedId === material.id ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    {libraryMode ? (
                      /* 클래스에 연결 */
                      <button
                        onClick={() => setLinkingMaterial(material)}
                        title="이 공통 자료를 원하는 클래스에 연결(복사)"
                        className="shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 font-black text-xs transition-colors"
                      >
                        <Link2 size={13} /> 클래스에 연결
                      </button>
                    ) : (
                      <>
                        {/* 공개/비공개 토글 */}
                        <button
                          onClick={() => handleTogglePublish(material)}
                          title={material.is_published ? '비공개로 전환' : '학생에게 공개'}
                          className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-colors ${
                            material.is_published
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-surface-container text-on-surface-variant hover:bg-primary/10 hover:text-primary'
                          }`}
                        >
                          {material.is_published
                            ? <><Globe size={13} /> 공개 중</>
                            : <><Lock size={13} /> 비공개</>
                          }
                        </button>
                        {/* 복사 */}
                        <button
                          onClick={() => handleCopy(material)}
                          title="다른 주차로 복사"
                          className="shrink-0 p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
                        >
                          <Copy size={15} />
                        </button>
                      </>
                    )}
                    {/* 수정 */}
                    <button
                      onClick={() => handleEdit(material)}
                      title="수정"
                      className="shrink-0 p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    {/* 삭제 */}
                    <button
                      onClick={() => handleDelete(material.id)}
                      title="삭제"
                      className="shrink-0 p-2 rounded-xl text-red-400 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* 내용 미리보기 (확장) */}
                {expandedId === material.id && (
                  <div className="border-t border-surface-container rounded-b-2xl overflow-hidden">
                    {material.content ? (
                      <div className="relative">
                        <button
                          onClick={() => setFullscreenPreview({ title: material.title, content: getActiveVersion(material).content })}
                          className="absolute top-2 right-2 z-10 p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                          title="전체 화면으로 보기"
                        >
                          <Maximize2 size={14} />
                        </button>
                        <div className="p-5 max-h-80 overflow-y-auto">
                          <ReactMarkdown components={mdComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{getActiveVersion(material).content}</ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <p className="px-5 py-4 text-sm font-bold text-on-surface-variant opacity-50">작성된 내용이 없습니다.</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 클래스 미선택 안내 */}
      {!selectedClass && !libraryMode && !isEditorOpen && (
        <div className="flex flex-col items-center py-24 space-y-3 opacity-30">
          <BookOpen size={56} />
          <p className="font-black text-lg">클래스를 선택하세요</p>
          <p className="text-sm font-bold">위에서 클래스를 선택하거나, '공통 자료함'에서 클래스 구분 없이 자료를 관리할 수 있습니다.</p>
        </div>
      )}
    </div>
    </>
  );
};

export default MaterialEditor;
