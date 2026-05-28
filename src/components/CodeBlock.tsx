import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  lang: string;
  code: string;
}

/**
 * 코드 블록 컴포넌트
 * - 언어 레이블 표시
 * - 우상단 복사 버튼 (클릭 시 2초간 "복사됨 ✓" 피드백)
 * - 다크 테마 코드 영역
 */
const CodeBlock = ({ lang, code }: Props) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {
      // fallback for older browsers
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLang = lang && lang !== 'text' ? lang : 'text';

  return (
    <div className="rounded-xl overflow-hidden mb-4 border border-slate-700 shadow-lg">
      {/* ── 헤더 바 ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 select-none">
        <span className="text-[11px] font-bold text-slate-400 tracking-wider font-mono">
          {displayLang}
        </span>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black transition-all duration-200 ${
            copied
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'text-slate-400 hover:text-white hover:bg-slate-700 active:scale-95'
          }`}
        >
          {copied ? (
            <><Check size={11} strokeWidth={3} /> 복사됨</>
          ) : (
            <><Copy size={11} /> 복사</>
          )}
        </button>
      </div>

      {/* ── 코드 본문 ── */}
      <pre className="m-0 px-5 py-4 bg-[#0d1117] overflow-x-auto">
        <code className="text-sm font-mono text-[#e6edf3] whitespace-pre leading-relaxed">
          {code}
        </code>
      </pre>
    </div>
  );
};

export default CodeBlock;
