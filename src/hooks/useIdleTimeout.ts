import { useEffect, useRef, useState, useCallback } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;

interface UseIdleTimeoutOptions {
  idleMs: number;
  warningMs: number;
  onTimeout: () => void;
  enabled: boolean;
}

export function useIdleTimeout({ idleMs, warningMs, onTimeout, enabled }: UseIdleTimeoutOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  const resetRef = useRef<() => void>(() => {});

  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  const clearAll = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  useEffect(() => {
    if (!enabled) {
      clearAll();
      setShowWarning(false);
      return;
    }

    const startWarning = () => {
      setShowWarning(true);
      setSecondsLeft(Math.floor(warningMs / 1000));

      countdownRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      warningTimerRef.current = setTimeout(() => {
        onTimeoutRef.current();
      }, warningMs);
    };

    const reset = () => {
      clearAll();
      setShowWarning(false);
      setSecondsLeft(0);
      idleTimerRef.current = setTimeout(startWarning, idleMs);
    };

    resetRef.current = reset;
    reset();

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));

    return () => {
      clearAll();
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, [enabled, idleMs, warningMs]);

  const resetTimer = useCallback(() => resetRef.current(), []);

  return { showWarning, secondsLeft, resetTimer };
}
