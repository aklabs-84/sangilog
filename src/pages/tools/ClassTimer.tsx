import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, RotateCcw, Maximize2, Minimize2, Volume2, VolumeX, Plus, Minus, BellOff
} from 'lucide-react';

const PRESETS = [
  { label: '준비', minutes: 1, seconds: 0, emoji: '✋' },
  { label: '발표', minutes: 3, seconds: 0, emoji: '🎤' },
  { label: '쉬는 시간', minutes: 5, seconds: 0, emoji: '☕' },
  { label: '모둠 활동', minutes: 10, seconds: 0, emoji: '👥' },
  { label: '수업', minutes: 45, seconds: 0, emoji: '📚' },
];

const CIRCLE_RADIUS = 120;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

function playBeep(audioCtx: AudioContext, freq: number, duration: number, delay = 0) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
  osc.start(audioCtx.currentTime + delay);
  osc.stop(audioCtx.currentTime + delay + duration);
}

function playAlarm(audioCtx: AudioContext) {
  playBeep(audioCtx, 880, 0.2, 0);
  playBeep(audioCtx, 880, 0.2, 0.25);
  playBeep(audioCtx, 1100, 0.4, 0.5);
}

interface TimerDisplayProps {
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isFinished: boolean;
  isAlarming: boolean;
  soundEnabled: boolean;
  presentMode?: boolean;
  onToggle: () => void;
  onReset: () => void;
  onSoundToggle: () => void;
  onStopAlarm: () => void;
  onPresentMode?: () => void;
  onExitPresent?: () => void;
}

const TimerDisplay = ({
  totalSeconds, remainingSeconds, isRunning, isFinished, isAlarming, soundEnabled, presentMode,
  onToggle, onReset, onSoundToggle, onStopAlarm, onPresentMode, onExitPresent,
}: TimerDisplayProps) => {
  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 1;
  const dashOffset = CIRCLE_CIRCUMFERENCE * (1 - progress);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const color = isFinished
    ? '#ef4444'
    : progress > 0.5
    ? '#22c55e'
    : progress > 0.2
    ? '#f59e0b'
    : '#ef4444';

  const scale = presentMode ? 1.6 : 1;

  return (
    <div className={`flex flex-col items-center gap-8 ${presentMode ? 'py-12' : ''}`}>
      {/* Circle */}
      <div className="relative" style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
        <svg width="280" height="280" className="-rotate-90">
          <circle
            cx="140" cy="140" r={CIRCLE_RADIUS}
            fill="none"
            stroke={presentMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}
            strokeWidth="12"
          />
          <motion.circle
            cx="140" cy="140" r={CIRCLE_RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={CIRCLE_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {isFinished ? (
              <motion.div
                key="finished"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 0.7 }}
                className="text-6xl font-black"
                style={{ color }}
              >
                종료!
              </motion.div>
            ) : (
              <motion.div
                key="time"
                className={`font-black tabular-nums ${presentMode ? 'text-5xl text-white' : 'text-5xl text-on-surface'}`}
              >
                {timeStr}
              </motion.div>
            )}
          </AnimatePresence>
          <p className={`text-xs font-bold mt-1 ${presentMode ? 'text-white/50' : 'text-on-surface-variant'}`}>
            {isRunning ? '진행 중' : isFinished ? '' : remainingSeconds === totalSeconds ? '준비' : '일시정지'}
          </p>
        </div>
      </div>

      {/* 알림 끄기 버튼 — 알람 울리는 중일 때만 표시 */}
      {isAlarming && (
        <motion.button
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 0.6 }}
          onClick={onStopAlarm}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-lg ${
            presentMode
              ? 'bg-red-500 text-white hover:bg-red-400'
              : 'bg-red-500 text-white hover:bg-red-600 shadow-red-200'
          }`}
        >
          <BellOff size={18} />
          알림 끄기
        </motion.button>
      )}

      {/* Controls */}
      <div className={`flex items-center gap-4 ${presentMode ? 'mt-8' : ''}`}>
        <button
          onClick={onSoundToggle}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
            presentMode
              ? 'bg-white/10 text-white hover:bg-white/20'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-primary/10 hover:text-primary'
          }`}
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>

        <button
          onClick={onReset}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
            presentMode
              ? 'bg-white/10 text-white hover:bg-white/20'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-error/10 hover:text-error'
          }`}
        >
          <RotateCcw size={18} />
        </button>

        <button
          onClick={onToggle}
          disabled={isFinished && remainingSeconds === 0}
          className={`w-20 h-20 rounded-2xl flex items-center justify-center text-white font-black text-xl transition-all active:scale-95 shadow-lg ${
            isRunning
              ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
              : isFinished
              ? 'bg-on-surface/20 cursor-not-allowed'
              : 'bg-primary hover:bg-primary/90 shadow-primary/30'
          }`}
        >
          {isRunning ? <Pause size={28} strokeWidth={3} /> : <Play size={28} strokeWidth={3} />}
        </button>

        <div className="w-11 h-11" />

        {presentMode ? (
          <button
            onClick={onExitPresent}
            className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-all"
          >
            <Minimize2 size={18} />
          </button>
        ) : (
          <button
            onClick={onPresentMode}
            className="w-11 h-11 rounded-xl flex items-center justify-center bg-surface-container-low text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-all"
          >
            <Maximize2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

const ClassTimer = () => {
  const [totalSeconds, setTotalSeconds] = useState(3 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(3 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isAlarming, setIsAlarming] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [presentMode, setPresentMode] = useState(false);

  const [customMinutes, setCustomMinutes] = useState(3);
  const [customSeconds, setCustomSeconds] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  };

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = null;
    setIsAlarming(false);
  }, []);

  const startAlarm = useCallback(() => {
    const ctx = getAudioCtx();
    playAlarm(ctx);
    setIsAlarming(true);
    alarmIntervalRef.current = setInterval(() => {
      playAlarm(getAudioCtx());
    }, 2500);
  }, []);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          stop();
          setIsRunning(false);
          setIsFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return stop;
  }, [isRunning, stop]);

  // 타이머 종료 시 알람 시작
  useEffect(() => {
    if (isFinished && soundEnabled) {
      startAlarm();
    }
  // startAlarm은 종료 시점에만 실행되어야 하므로 isFinished 변화에만 반응
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished]);

  // 컴포넌트 언마운트 시 알람 정리
  useEffect(() => {
    return () => stopAlarm();
  }, [stopAlarm]);

  const handleToggle = () => {
    if (isFinished) return;
    setIsRunning((v) => !v);
  };

  const handleReset = () => {
    stop();
    stopAlarm();
    setIsRunning(false);
    setIsFinished(false);
    setRemainingSeconds(totalSeconds);
  };

  const applyTime = (mins: number, secs: number) => {
    const total = mins * 60 + secs;
    stop();
    setIsRunning(false);
    setIsFinished(false);
    setTotalSeconds(total);
    setRemainingSeconds(total);
    setCustomMinutes(mins);
    setCustomSeconds(secs);
  };

  const adjustMinutes = (delta: number) => {
    const next = Math.max(0, Math.min(99, customMinutes + delta));
    setCustomMinutes(next);
    applyTime(next, customSeconds);
  };

  const adjustSeconds = (delta: number) => {
    let s = customSeconds + delta;
    let m = customMinutes;
    if (s >= 60) { s -= 60; m = Math.min(99, m + 1); }
    if (s < 0) { s += 60; m = Math.max(0, m - 1); }
    setCustomSeconds(s);
    setCustomMinutes(m);
    applyTime(m, s);
  };

  const timerProps = {
    totalSeconds,
    remainingSeconds,
    isRunning,
    isFinished,
    isAlarming,
    soundEnabled,
    onToggle: handleToggle,
    onReset: handleReset,
    onStopAlarm: stopAlarm,
    onSoundToggle: () => setSoundEnabled((v) => !v),
  };

  return (
    <>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Presets */}
        <div className="glass rounded-2xl p-5 border border-white/40">
          <p className="text-xs font-black text-on-surface-variant mb-3 uppercase tracking-widest">프리셋</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const total = p.minutes * 60 + p.seconds;
              const isActive = total === totalSeconds;
              return (
                <button
                  key={p.label}
                  onClick={() => applyTime(p.minutes, p.seconds)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all border ${
                    isActive
                      ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                      : 'border-white/40 text-on-surface hover:border-primary/30 hover:bg-primary/5'
                  }`}
                >
                  <span>{p.emoji}</span>
                  <span>{p.label}</span>
                  <span className={`text-xs ${isActive ? 'text-white/70' : 'text-on-surface-variant'}`}>
                    {p.minutes > 0 ? `${p.minutes}분` : ''}{p.seconds > 0 ? `${p.seconds}초` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom time + Timer display */}
        <div className="glass rounded-2xl p-6 border border-white/40 flex flex-col items-center gap-6">
          {/* Custom input */}
          <div className="flex items-center gap-4">
            {/* Minutes */}
            <div className="flex flex-col items-center gap-1">
              <button onClick={() => adjustMinutes(1)} className="w-8 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center justify-center">
                <Plus size={14} strokeWidth={3} />
              </button>
              <input
                type="number"
                min={0}
                max={99}
                value={customMinutes}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(99, Number(e.target.value)));
                  setCustomMinutes(v);
                  applyTime(v, customSeconds);
                }}
                className="w-16 text-center text-2xl font-black rounded-xl border border-white/40 bg-surface-container-low/50 py-2 focus:outline-none focus:border-primary/40"
              />
              <button onClick={() => adjustMinutes(-1)} className="w-8 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center justify-center">
                <Minus size={14} strokeWidth={3} />
              </button>
              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">분</span>
            </div>

            <span className="text-3xl font-black text-on-surface-variant mt-1">:</span>

            {/* Seconds */}
            <div className="flex flex-col items-center gap-1">
              <button onClick={() => adjustSeconds(10)} className="w-8 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center justify-center">
                <Plus size={14} strokeWidth={3} />
              </button>
              <input
                type="number"
                min={0}
                max={59}
                value={customSeconds}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(59, Number(e.target.value)));
                  setCustomSeconds(v);
                  applyTime(customMinutes, v);
                }}
                className="w-16 text-center text-2xl font-black rounded-xl border border-white/40 bg-surface-container-low/50 py-2 focus:outline-none focus:border-primary/40"
              />
              <button onClick={() => adjustSeconds(-10)} className="w-8 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center justify-center">
                <Minus size={14} strokeWidth={3} />
              </button>
              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">초</span>
            </div>
          </div>

          {/* Timer circle + controls */}
          <TimerDisplay
            {...timerProps}
            onPresentMode={() => setPresentMode(true)}
          />
        </div>
      </div>

      {/* 발표 모드 */}
      <AnimatePresence>
        {presentMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-colors duration-700 ${
              isFinished
                ? 'bg-red-950'
                : remainingSeconds / totalSeconds > 0.5
                ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950'
                : remainingSeconds / totalSeconds > 0.2
                ? 'bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900'
                : 'bg-gradient-to-br from-slate-900 via-red-950 to-slate-900'
            }`}
          >
            <div className="flex flex-col items-center gap-4 mb-6">
              <p className="text-white/40 text-sm font-black uppercase tracking-widest">수업 타이머</p>
            </div>
            <TimerDisplay
              {...timerProps}
              presentMode
              onExitPresent={() => setPresentMode(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ClassTimer;
