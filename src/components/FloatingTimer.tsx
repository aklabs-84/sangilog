import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, RotateCcw, BellOff, Timer } from 'lucide-react';
import { useTimer } from '../lib/timerContext';

const RADIUS = 22;
const CIRC = 2 * Math.PI * RADIUS;

const FloatingTimer = () => {
  const {
    totalSeconds, remainingSeconds, isRunning, isFinished, isAlarming,
    isTimerPageVisible, toggle, reset, stopAlarm,
  } = useTimer();
  const navigate = useNavigate();
  const constraintsRef = useRef(null);

  // 한 번도 시작 안 했거나, 타이머 페이지에 있으면 숨김
  const hasActivity = remainingSeconds < totalSeconds || isRunning || isFinished;
  const visible = hasActivity && !isTimerPageVisible;

  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 1;
  const dashOffset = CIRC * (1 - progress);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isUrgent = !isFinished && progress <= 0.2;
  const accentColor = isFinished || isUrgent ? '#ef4444' : progress <= 0.5 ? '#f59e0b' : '#22c55e';

  const widget = (
    <AnimatePresence>
      {visible && (
        // 드래그 제약 영역
        <div ref={constraintsRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 9998 }}>
          <motion.div
            drag
            dragMomentum={false}
            dragConstraints={constraintsRef}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            style={{ position: 'absolute', bottom: 28, right: 28 }}
            className="pointer-events-auto cursor-grab active:cursor-grabbing"
          >
            <motion.div
              animate={isAlarming ? { scale: [1, 1.04, 1] } : {}}
              transition={{ repeat: Infinity, duration: 0.6 }}
              className="flex items-center gap-3 pl-3 pr-4 py-3 rounded-2xl shadow-2xl border border-white/30 backdrop-blur-xl"
              style={{
                background: isAlarming
                  ? 'rgba(239,68,68,0.92)'
                  : 'rgba(15,15,25,0.88)',
              }}
            >
              {/* 미니 원형 타이머 */}
              <div
                className="relative shrink-0 cursor-pointer"
                onClick={() => navigate('/teaching-tools')}
                title="타이머 페이지로 이동"
              >
                <svg width="56" height="56" className="-rotate-90">
                  <circle cx="28" cy="28" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
                  <motion.circle
                    cx="28" cy="28" r={RADIUS}
                    fill="none"
                    stroke={accentColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={dashOffset}
                    style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.6s ease' }}
                    filter={`drop-shadow(0 0 4px ${accentColor})`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  {isFinished ? (
                    <motion.span
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ repeat: Infinity, duration: 0.7 }}
                      className="text-red-400 text-[9px] font-black"
                    >
                      종료
                    </motion.span>
                  ) : (
                    <Timer size={14} className="text-white/60" />
                  )}
                </div>
              </div>

              {/* 시간 표시 */}
              <div
                className="cursor-pointer select-none"
                onClick={() => navigate('/teaching-tools')}
              >
                <p className="text-white font-black text-lg tabular-nums leading-none" style={{ textShadow: `0 0 12px ${accentColor}88` }}>
                  {timeStr}
                </p>
                <p className="text-white/40 text-[10px] font-bold mt-0.5">
                  {isAlarming ? '알림 중' : isRunning ? '진행 중' : isFinished ? '종료됨' : '일시정지'}
                </p>
              </div>

              {/* 컨트롤 버튼 */}
              <div className="flex items-center gap-1.5 ml-1">
                {isAlarming ? (
                  <button
                    onClick={stopAlarm}
                    className="w-8 h-8 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-all flex items-center justify-center"
                    title="알림 끄기"
                  >
                    <BellOff size={14} />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={toggle}
                      disabled={isFinished}
                      className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center text-white ${
                        isFinished
                          ? 'bg-white/10 opacity-40 cursor-not-allowed'
                          : isRunning
                          ? 'bg-amber-500/80 hover:bg-amber-500'
                          : 'bg-primary/80 hover:bg-primary'
                      }`}
                      title={isRunning ? '일시정지' : '시작'}
                    >
                      {isRunning ? <Pause size={13} strokeWidth={3} /> : <Play size={13} strokeWidth={3} />}
                    </button>
                    <button
                      onClick={reset}
                      className="w-8 h-8 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all flex items-center justify-center"
                      title="리셋"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(widget, document.body);
};

export default FloatingTimer;
