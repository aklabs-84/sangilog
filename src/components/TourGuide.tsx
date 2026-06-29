import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';

export type TourStep = {
  targetId?: string;
  emoji: string;
  title: string;
  description: string;
  placement?: 'top' | 'bottom';
};

type Props = {
  steps: TourStep[];
  onClose: (dontShowToday: boolean) => void;
};

const TOOLTIP_W = 300;
const GAP = 14;
const PADDING = 16;

export default function TourGuide({ steps, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [dontShow, setDontShow] = useState(false);

  const step = steps[idx];
  const isLast = idx === steps.length - 1;

  useEffect(() => {
    if (!step.targetId) { setRect(null); return; }
    const el = document.getElementById(step.targetId);
    if (el) setRect(el.getBoundingClientRect());
    else setRect(null);
  }, [idx, step.targetId]);

  const tooltipPos = (): React.CSSProperties => {
    if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const estimatedH = isLast ? 240 : 190;
    const safeLeft = Math.max(
      PADDING,
      Math.min(rect.left + rect.width / 2 - TOOLTIP_W / 2, window.innerWidth - TOOLTIP_W - PADDING)
    );

    if ((step.placement ?? 'top') === 'top') {
      return { top: Math.max(PADDING, rect.top - estimatedH - GAP), left: safeLeft };
    }
    return { top: rect.bottom + GAP, left: safeLeft };
  };

  const goNext = () => {
    if (isLast) onClose(dontShow);
    else setIdx(i => i + 1);
  };

  return (
    <>
      {/* 클릭 차단 레이어 */}
      <div className="fixed inset-0 z-[9990]" />

      {/* 스포트라이트 / 전체 딤 */}
      {rect ? (
        <div
          className="fixed z-[9991] pointer-events-none"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: 14,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
            outline: '2px solid rgba(255,255,255,0.35)',
            transition: 'top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease',
          }}
        />
      ) : (
        <div className="fixed inset-0 z-[9991] bg-black/65 pointer-events-none" />
      )}

      {/* 툴팁 카드 */}
      <div className="fixed z-[9995] pointer-events-auto" style={tooltipPos()}>
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            style={{ width: TOOLTIP_W }}
            className="bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* 진행 바 */}
            <div className="flex gap-1 pt-4 px-4">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    i <= idx ? 'bg-primary' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>

            <div className="p-5 space-y-3">
              <div className="text-3xl">{step.emoji}</div>
              <div>
                <p className="font-black text-base text-on-surface">{step.title}</p>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mt-1">{step.description}</p>
              </div>

              {isLast && (
                <label className="flex items-center gap-2.5 cursor-pointer group pt-1">
                  <div
                    onClick={() => setDontShow(v => !v)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                      dontShow ? 'bg-primary border-primary' : 'border-slate-300 group-hover:border-primary/40'
                    }`}
                  >
                    {dontShow && <Check size={11} className="text-white" strokeWidth={4} />}
                  </div>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors select-none">
                    오늘 하루 보지 않기
                  </span>
                </label>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => onClose(true)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  건너뛰기
                </button>
                <div className="flex items-center gap-2">
                  {idx > 0 && (
                    <button
                      onClick={() => setIdx(i => i - 1)}
                      className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all"
                    >
                      <ArrowLeft size={15} className="text-slate-600" />
                    </button>
                  )}
                  <button
                    onClick={goNext}
                    className="px-4 h-8 rounded-xl btn-gradient text-sm font-black flex items-center gap-1.5 shadow-md shadow-primary/20"
                  >
                    {isLast ? '완료!' : '다음'}
                    {!isLast && <ArrowRight size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
