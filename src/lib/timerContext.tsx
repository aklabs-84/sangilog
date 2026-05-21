import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';

// ── Audio helpers ─────────────────────────────────────────────────────────────
function playBeep(ctx: AudioContext, freq: number, duration: number, delay = 0) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

export function playAlarm(ctx: AudioContext) {
  playBeep(ctx, 880, 0.2, 0);
  playBeep(ctx, 880, 0.2, 0.25);
  playBeep(ctx, 1100, 0.4, 0.5);
}

// ── Context types ─────────────────────────────────────────────────────────────
interface TimerContextValue {
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isFinished: boolean;
  isAlarming: boolean;
  soundEnabled: boolean;
  // 플로팅 위젯: ClassTimer 페이지에 있을 때 false
  isTimerPageVisible: boolean;
  setIsTimerPageVisible: (v: boolean) => void;

  toggle: () => void;
  reset: () => void;
  applyTime: (minutes: number, seconds: number) => void;
  stopAlarm: () => void;
  toggleSound: () => void;
  getAudioCtx: () => AudioContext;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export const useTimer = () => {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
};

// ── Provider ──────────────────────────────────────────────────────────────────
export const TimerProvider = ({ children }: { children: ReactNode }) => {
  const [totalSeconds, setTotalSeconds] = useState(3 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(3 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isAlarming, setIsAlarming] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isTimerPageVisible, setIsTimerPageVisible] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  }, []);

  const stopTick = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  const stopAlarm = useCallback(() => {
    if (alarmRef.current) { clearInterval(alarmRef.current); alarmRef.current = null; }
    setIsAlarming(false);
  }, []);

  const startAlarm = useCallback(() => {
    const ctx = getAudioCtx();
    playAlarm(ctx);
    setIsAlarming(true);
    alarmRef.current = setInterval(() => playAlarm(getAudioCtx()), 2500);
  }, [getAudioCtx]);

  // 카운트다운
  useEffect(() => {
    if (!isRunning) return;
    tickRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          stopTick();
          setIsRunning(false);
          setIsFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return stopTick;
  }, [isRunning, stopTick]);

  // 종료 시 알람 시작
  useEffect(() => {
    if (isFinished && soundEnabled) startAlarm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished]);

  // 언마운트 정리
  useEffect(() => () => { stopTick(); stopAlarm(); }, [stopTick, stopAlarm]);

  const toggle = useCallback(() => {
    if (isFinished) return;
    setIsRunning((v) => !v);
  }, [isFinished]);

  const reset = useCallback(() => {
    stopTick();
    stopAlarm();
    setIsRunning(false);
    setIsFinished(false);
    setRemainingSeconds(totalSeconds);
  }, [stopTick, stopAlarm, totalSeconds]);

  const applyTime = useCallback((mins: number, secs: number) => {
    const total = mins * 60 + secs;
    stopTick();
    stopAlarm();
    setIsRunning(false);
    setIsFinished(false);
    setTotalSeconds(total);
    setRemainingSeconds(total);
  }, [stopTick, stopAlarm]);

  const toggleSound = useCallback(() => setSoundEnabled((v) => !v), []);

  return (
    <TimerContext.Provider value={{
      totalSeconds, remainingSeconds, isRunning, isFinished, isAlarming, soundEnabled,
      isTimerPageVisible, setIsTimerPageVisible,
      toggle, reset, applyTime, stopAlarm, toggleSound, getAudioCtx,
    }}>
      {children}
    </TimerContext.Provider>
  );
};
