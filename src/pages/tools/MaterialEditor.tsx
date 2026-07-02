import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { reorganizeMaterialContent, MATERIAL_REORG_PROMPTS } from '../../lib/gemini';
import rehypeRaw from 'rehype-raw';

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
  Users, Presentation, ChevronLeft, ChevronRight, X as XIcon,
  Maximize2, Download, Sparkles, RotateCcw, AlertCircle,
} from 'lucide-react';
import CodeBlock from '../../components/CodeBlock';
import RichEditor from '../../components/RichEditor';

interface Material {
  id: string;
  class_id: string;
  week_number: number;
  title: string;
  content: string;
  url: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  view_count?: number;
}

// ── 슬라이드 파싱 ─────────────────────────────────────────────────────────────
const parseSlides = (content: string): string[] => {
  const slides = content.split(/\n\s*---\s*\n/).map(s => s.trim()).filter(Boolean);
  return slides.length > 0 ? slides : [content.trim()];
};

// ── 프레젠테이션 슬라이드 마크다운 렌더러 ────────────────────────────────────
const slideComponents: any = {
  h1: ({ children }: any) => (
    <h1 className="text-5xl font-black mb-6 leading-tight text-white tracking-tight">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-3xl font-black mb-4 mt-6 text-white/90">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-2xl font-black mb-3 mt-5 text-white/80">{children}</h3>
  ),
  p: ({ children }: any) => (
    <p className="text-xl leading-relaxed mb-4 text-white/75">{children}</p>
  ),
  ul: ({ children }: any) => <ul className="space-y-3 mb-4 pl-2">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-6 space-y-3 mb-4">{children}</ol>,
  li: ({ children }: any) => (
    <li className="flex items-start gap-3 text-xl text-white/75">
      <span className="mt-2 w-2 h-2 rounded-full bg-primary shrink-0" />
      <span>{children}</span>
    </li>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-primary pl-6 italic text-white/60 my-4 text-xl">{children}</blockquote>
  ),
  code: ({ children, className }: any) => {
    if (!className) {
      return <code className="bg-white/10 px-2 py-0.5 rounded text-lg font-mono text-primary-light">{children}</code>;
    }
    return <code className={className}>{children}</code>;
  },
  pre: ({ children }: any) => {
    const child = (Array.isArray(children) ? children[0] : children) as any;
    const code = String(child?.props?.children ?? '').replace(/\n$/, '');
    return (
      <pre className="bg-white/5 rounded-2xl p-5 overflow-auto text-base font-mono text-white/80 my-4 border border-white/10">
        {code}
      </pre>
    );
  },
  strong: ({ children }: any) => <strong className="font-black text-white">{children}</strong>,
  em: ({ children }: any) => <em className="italic text-primary-light">{children}</em>,
  img: ({ src, alt, title }: any) => {
    const wm = (title || '').match(/^width:(\d+)$/);
    const style = wm ? { width: `${wm[1]}px`, maxWidth: '100%' } : undefined;
    return <img src={src} alt={alt} style={style} className="max-w-full rounded-2xl my-4 shadow-xl max-h-64 object-contain" />;
  },
  a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>,
  hr: () => <hr className="border-white/10 my-5" />,
  details: ({ children }: any) => (
    <details className="my-3 rounded-xl border border-white/15 overflow-hidden">
      {children}
    </details>
  ),
  summary: ({ children }: any) => (
    <summary className="px-4 py-2.5 bg-white/10 cursor-pointer font-black text-lg text-white/90 list-none flex items-center gap-2 select-none hover:bg-white/15 transition-colors">
      <span className="text-sm opacity-70">▶</span> {children}
    </summary>
  ),
};

// ── 프레젠테이션 모달 ─────────────────────────────────────────────────────────
const PresentationModal = ({ material, onClose }: { material: Material; onClose: () => void }) => {
  const [current, setCurrent] = useState(0);
  const slides = parseSlides(material.content);
  const total = slides.length;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setCurrent(c => Math.min(c + 1, total - 1));
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setCurrent(c => Math.max(c - 1, 0));
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [total, onClose]);

  const prev = () => setCurrent(c => Math.max(c - 1, 0));
  const next = () => setCurrent(c => Math.min(c + 1, total - 1));

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-[#0a0a14] flex flex-col select-none">

      {/* 상단 바 */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10 bg-white/5 shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-800 font-black text-sm hover:bg-slate-100 active:scale-95 transition-all shadow"
        >
          <ArrowLeft size={15} /> 나가기
        </button>
        <div className="flex items-center gap-2 ml-2 flex-1 min-w-0">
          <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
          <span className="text-white/60 text-sm font-bold truncate">{material.title}</span>
        </div>
        <span className="text-white/40 text-sm font-bold tabular-nums shrink-0">
          {current + 1} / {total}
        </span>
      </div>

      {/* 슬라이드 메인 영역 */}
      <div className="flex-1 flex items-center justify-center px-16 py-10 overflow-hidden">
        <div
          className="w-full max-w-5xl min-h-0"
          style={{ maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}
        >
          {/* 슬라이드 카드 */}
          <div
            key={current}
            className="bg-gradient-to-br from-[#141428] to-[#0f0f1e] rounded-3xl border border-white/8 p-14 shadow-2xl"
            style={{ animation: 'slideIn 0.25s ease-out' }}
          >
            <ReactMarkdown components={slideComponents} rehypePlugins={[rehypeRaw]}>
              {slides[current]}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* 하단 네비게이션 */}
      <div className="flex items-center justify-center gap-6 px-8 py-5 border-t border-white/5">
        <button
          onClick={prev}
          disabled={current === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={16} /> 이전
        </button>

        {/* 도트 네비게이터 */}
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all ${
                i === current
                  ? 'w-6 h-2 bg-primary'
                  : 'w-2 h-2 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          disabled={current === total - 1}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
        >
          다음 <ChevronRight size={16} />
        </button>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>,
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
  currentClassId: string;
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
    supabase
      .from('classes')
      .select('id, name')
      .eq('teacher_id', userId)
      .eq('is_archived', false)
      .neq('id', currentClassId)
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
          <ReactMarkdown components={mdComponents} rehypePlugins={[rehypeRaw]}>
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
};

// ── AI 재구성 모달 (학습 가이드 / 발표 자료) ─────────────────────────────────
type ReorganizeStep = 'select-mode' | 'configure' | 'loading' | 'preview' | 'error';

const AiReorganizeModal = ({
  rawContent,
  classId,
  onApply,
  onClose,
}: {
  rawContent: string;
  classId?: string;
  onApply: (newContent: string) => void;
  onClose: () => void;
}) => {
  const [step, setStep] = useState<ReorganizeStep>('select-mode');
  const [mode, setMode] = useState<'guide' | 'presentation'>('guide');
  const [userInstruction, setUserInstruction] = useState('');
  const [showBasePrompt, setShowBasePrompt] = useState(false);
  const [result, setResult] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSelectMode = (m: 'guide' | 'presentation') => {
    setMode(m);
    setStep('configure');
  };

  const handleGenerate = async () => {
    setStep('loading');
    try {
      const generated = await reorganizeMaterialContent(rawContent, mode, userInstruction, classId);
      setResult(generated);
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
              {step === 'select-mode' && '어떤 형식으로 정리할까요?'}
              {step === 'configure' && (mode === 'guide' ? '학습 가이드로 정리' : '발표 자료로 정리')}
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
          {step === 'select-mode' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleSelectMode('guide')}
                className="flex flex-col items-start gap-2 p-4 rounded-2xl border-2 border-surface-container hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <BookOpen size={16} />
                </div>
                <p className="font-black text-sm">학습 가이드</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  학생이 단계별로(STEP 1, 2...) 따라갈 수 있는 자습형 가이드로 정리합니다.
                </p>
              </button>
              <button
                onClick={() => handleSelectMode('presentation')}
                className="flex flex-col items-start gap-2 p-4 rounded-2xl border-2 border-surface-container hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                  <Presentation size={16} />
                </div>
                <p className="font-black text-sm">발표 자료</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  16:9 발표 화면에 맞춰 슬라이드(핵심 불릿 위주)로 정리합니다.
                </p>
              </button>
            </div>
          )}

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
                  onChange={e => setUserInstruction(e.target.value)}
                  placeholder={mode === 'guide' ? '예: 중학생 눈높이로 쉽게 풀어줘' : '예: 실습 위주로 강조해줘'}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white rounded-xl border border-surface-container text-sm focus:outline-none focus:border-primary/40 resize-none"
                />
              </div>
            </div>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm font-bold text-on-surface-variant">AI가 정리하는 중입니다...</p>
            </div>
          )}

          {step === 'preview' && (
            mode === 'presentation' ? (
              <div className="bg-[#0a0a14] rounded-2xl p-6 overflow-auto max-h-[50vh]">
                <ReactMarkdown components={slideComponents} rehypePlugins={[rehypeRaw]}>
                  {parseSlides(result)[0] ?? result}
                </ReactMarkdown>
                <p className="text-white/40 text-xs font-bold mt-3">
                  총 {parseSlides(result).length}장의 슬라이드로 정리됩니다 (첫 슬라이드만 미리보기, 적용 후 발표 모드에서 전체 확인 가능)
                </p>
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-auto">
                <ReactMarkdown components={mdComponents} rehypePlugins={[rehypeRaw]}>{result}</ReactMarkdown>
              </div>
            )
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center py-12 gap-3 text-center">
              <AlertCircle size={32} className="text-red-400" />
              <p className="text-sm font-bold text-on-surface-variant">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* 하단 액션 */}
        {step !== 'select-mode' && step !== 'loading' && (
          <div className="flex items-center gap-2 px-5 py-4 border-t border-surface-container bg-surface-container-low/50 shrink-0">
            {step === 'configure' && (
              <>
                <button
                  onClick={() => setStep('select-mode')}
                  className="px-4 py-2 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  뒤로
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-2 px-6 py-2.5 btn-gradient rounded-xl font-black text-sm text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <Sparkles size={15} /> 정리 시작
                </button>
              </>
            )}
            {step === 'preview' && (
              <>
                <button
                  onClick={() => setStep('configure')}
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
                  onClick={() => onApply(result)}
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
  const [fullscreenPreview, setFullscreenPreview] = useState<{ title: string; content: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAiReorganize, setShowAiReorganize] = useState(false);

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

  const resetForm = () => {
    setTitle(''); setWeekNumber(1); setContent(''); setIsPublished(false);
    setEditingMaterial(null); setViewMode('edit');
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
    if (!selectedClass) { alert('클래스를 선택해주세요.'); return; }
    if (!title.trim()) { alert('제목을 입력해주세요.'); return; }
    setSaving(true);
    try {
      const payload = {
        class_id: selectedClass.id,
        week_number: weekNumber,
        title: title.trim(),
        content: (content ?? '').trim(),
        is_published: isPublished,
        updated_at: new Date().toISOString(),
      };
      if (editingMaterial) {
        const { error } = await supabase.from('class_materials').update(payload).eq('id', editingMaterial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('class_materials').insert(payload);
        if (error) throw error;
      }
      await fetchMaterials(selectedClass.id);
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
    await fetchMaterials(selectedClass.id);
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

  return (
    <>
    {presentingMaterial && (
      <PresentationModal material={presentingMaterial} onClose={() => setPresentingMaterial(null)} />
    )}
    {showImportModal && selectedClass && user && (
      <ImportFromClassModal
        currentClassId={selectedClass.id}
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
        onApply={(newContent) => { setContent(newContent); setShowAiReorganize(false); }}
        onClose={() => setShowAiReorganize(false)}
      />
    )}
    <div className="space-y-5">
      {/* ── 상단: 클래스 선택 + 새 자료 버튼 ── */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setClassDropdownOpen(o => !o)}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container rounded-2xl border-2 border-transparent hover:border-primary/20 transition-all font-black text-sm"
          >
            {selectedClass ? selectedClass.name : '클래스 선택'}
            <ChevronDown size={15} className="text-on-surface-variant" />
          </button>
          {classDropdownOpen && (
            <div className="absolute top-full mt-2 left-0 bg-white rounded-2xl shadow-xl border border-surface-container z-50 min-w-[200px] overflow-hidden">
              {classes.length === 0 ? (
                <p className="px-4 py-3 text-sm text-on-surface-variant font-bold">클래스 없음</p>
              ) : classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => { setSelectedClass(cls); setClassDropdownOpen(false); fetchMaterials(cls.id); setIsEditorOpen(false); resetForm(); }}
                  className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors text-sm font-bold"
                >
                  {cls.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedClass && !isEditorOpen && (
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
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-container bg-surface-container-low">
            <button
              onClick={() => { setIsEditorOpen(false); resetForm(); }}
              className="p-1.5 rounded-xl hover:bg-surface-container transition-colors text-on-surface-variant"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="font-black text-sm flex-1">{editingMaterial ? '수업 자료 수정' : '새 수업 자료 작성'}</span>
            {/* AI로 정리 */}
            <button
              onClick={() => setShowAiReorganize(true)}
              disabled={!content.trim()}
              title={content.trim() ? 'AI로 학습 가이드/발표 자료 정리' : '내용을 먼저 작성해주세요'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-100 text-violet-700 hover:bg-violet-200 font-black text-xs transition-colors border border-violet-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles size={12} /> AI로 정리
            </button>
            {/* 다른 클래스에서 가져오기 */}
            <button
              onClick={() => setShowImportModal(true)}
              title="다른 클래스 자료 가져오기"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/8 text-primary hover:bg-primary/15 font-black text-xs transition-colors border border-primary/15"
            >
              <Download size={12} /> 가져오기
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
                  <ReactMarkdown components={mdComponents} rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
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
      {selectedClass && !isEditorOpen && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
              {selectedClass.name} 수업 자료 ({materials.length}개)
            </p>
          </div>

          {materialsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center py-16 space-y-3 opacity-30">
              <BookOpen size={48} />
              <p className="font-black">아직 작성된 수업 자료가 없습니다.</p>
              <p className="text-sm font-bold">위의 '새 자료 작성' 버튼을 눌러 시작하세요.</p>
            </div>
          ) : (
            materials.map(material => (
              <div key={material.id} className="bg-white rounded-2xl border border-surface-container overflow-hidden transition-all hover:border-primary/20 hover:shadow-sm">
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
                    {/* 발표 모드 */}
                    {material.content && (
                      <button
                        onClick={() => setPresentingMaterial(material)}
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
                  <div className="border-t border-surface-container">
                    {material.content ? (
                      <div className="relative">
                        <button
                          onClick={() => setFullscreenPreview({ title: material.title, content: material.content })}
                          className="absolute top-2 right-2 z-10 p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                          title="전체 화면으로 보기"
                        >
                          <Maximize2 size={14} />
                        </button>
                        <div className="p-5 max-h-80 overflow-y-auto">
                          <ReactMarkdown components={mdComponents} rehypePlugins={[rehypeRaw]}>{material.content}</ReactMarkdown>
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
      {!selectedClass && !isEditorOpen && (
        <div className="flex flex-col items-center py-24 space-y-3 opacity-30">
          <BookOpen size={56} />
          <p className="font-black text-lg">클래스를 선택하세요</p>
          <p className="text-sm font-bold">위에서 클래스를 선택하면 수업 자료를 관리할 수 있습니다.</p>
        </div>
      )}
    </div>
    </>
  );
};

export default MaterialEditor;
