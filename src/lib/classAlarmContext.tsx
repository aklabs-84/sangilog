import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { playAlarm } from './timerContext';

interface ClassAlarmRow {
  id: string;
  name: string;
  class_start_time: string | null;
  class_end_time: string | null;
  end_alarm_minutes: number[] | null;
  break_times: string[] | null;
  start_date: string | null;
  end_date: string | null;
  is_closed: boolean | null;
  is_archived: boolean | null;
}

export interface ClassAlarmAlert {
  key: string;
  classId: string;
  className: string;
  type: 'class_end' | 'break' | 'attendance';
  minutesLeft: number;
}

const BREAK_ALARM_MINUTES = 5;

interface ClassAlarmContextValue {
  activeAlerts: ClassAlarmAlert[];
  dismissAlert: (key: string) => void;
}

const ClassAlarmContext = createContext<ClassAlarmContextValue | null>(null);

export const useClassAlarm = () => {
  const ctx = useContext(ClassAlarmContext);
  if (!ctx) throw new Error('useClassAlarm must be used within ClassAlarmProvider');
  return ctx;
};

const TRIGGERED_STORAGE_KEY = 'class_alarm_triggered';

const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const loadTriggeredSet = (): Set<string> => {
  try {
    const raw = localStorage.getItem(TRIGGERED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: string[] = JSON.parse(raw);
    const today = getTodayStr();
    // 오늘 날짜가 아닌 키는 정리
    const valid = parsed.filter((k) => k.endsWith(today));
    return new Set(valid);
  } catch {
    return new Set();
  }
};

const saveTriggeredSet = (set: Set<string>) => {
  localStorage.setItem(TRIGGERED_STORAGE_KEY, JSON.stringify(Array.from(set)));
};

const minutesToHHMM = (totalMin: number) => {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const ClassAlarmProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassAlarmRow[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<ClassAlarmAlert[]>([]);
  const triggeredRef = useRef<Set<string>>(loadTriggeredSet());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alarmIntervalsRef = useRef<Map<string, number>>(new Map());

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  }, []);

  const fetchClasses = useCallback(async () => {
    if (!user) {
      setClasses([]);
      return;
    }
    const { data } = await supabase
      .from('classes')
      .select('id, name, class_start_time, class_end_time, end_alarm_minutes, break_times, start_date, end_date, is_closed, is_archived')
      .eq('teacher_id', user.id)
      .eq('is_closed', false);
    setClasses((data || []).filter((c) => {
      if (c.is_archived) return false;
      const hasStartAlarm = !!c.class_start_time;
      const hasEndAlarm = !!c.class_end_time && (c.end_alarm_minutes || []).length > 0;
      const hasBreakAlarm = (c.break_times || []).length > 0;
      return hasStartAlarm || hasEndAlarm || hasBreakAlarm;
    }));
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 최초 로드 + 5분 주기 재조회
    fetchClasses();
    const refreshInterval = setInterval(fetchClasses, 5 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, [fetchClasses]);

  const dismissAlert = useCallback((key: string) => {
    setActiveAlerts((prev) => prev.filter((a) => a.key !== key));
    const intervalId = alarmIntervalsRef.current.get(key);
    if (intervalId) {
      clearInterval(intervalId);
      alarmIntervalsRef.current.delete(key);
    }
  }, []);

  useEffect(() => {
    const intervalsMap = alarmIntervalsRef.current;
    return () => {
      intervalsMap.forEach((intervalId) => clearInterval(intervalId));
      intervalsMap.clear();
    };
  }, []);

  useEffect(() => {
    const checkAlarms = () => {
      if (classes.length === 0) return;
      const now = new Date();
      const todayStr = getTodayStr();
      const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const triggerAlarm = (triggerKey: string, alert: ClassAlarmAlert) => {
        if (triggeredRef.current.has(triggerKey)) return;

        triggeredRef.current.add(triggerKey);
        saveTriggeredSet(triggeredRef.current);

        setActiveAlerts((prev) => [...prev, alert]);
        try {
          playAlarm(getAudioCtx());
        } catch {
          // AudioContext가 사용자 상호작용 전이라 재생이 막힐 수 있음 — 무시
        }
        const intervalId = window.setInterval(() => {
          try {
            playAlarm(getAudioCtx());
          } catch {
            // AudioContext가 사용자 상호작용 전이라 재생이 막힐 수 있음 — 무시
          }
        }, 2500);
        alarmIntervalsRef.current.set(triggerKey, intervalId);
      };

      classes.forEach((cls) => {
        if (cls.start_date && cls.start_date > todayStr) return;
        if (cls.end_date && cls.end_date < todayStr) return;

        if (cls.class_start_time) {
          const [startH, startM] = cls.class_start_time.split(':').map((v) => parseInt(v, 10));
          const startTotalMin = startH * 60 + startM;
          if (minutesToHHMM(startTotalMin) === nowHHMM) {
            const triggerKey = `${cls.id}_start_${todayStr}`;
            triggerAlarm(triggerKey, { key: triggerKey, classId: cls.id, className: cls.name, type: 'attendance', minutesLeft: 0 });
          }
        }

        if (cls.class_end_time) {
          const [endH, endM] = cls.class_end_time.split(':').map((v) => parseInt(v, 10));
          const endTotalMin = endH * 60 + endM;

          (cls.end_alarm_minutes || []).forEach((minutes) => {
            const targetTotalMin = endTotalMin - minutes;
            if (targetTotalMin < 0) return;
            if (minutesToHHMM(targetTotalMin) !== nowHHMM) return;

            const triggerKey = `${cls.id}_${minutes}_${todayStr}`;
            triggerAlarm(triggerKey, { key: triggerKey, classId: cls.id, className: cls.name, type: 'class_end', minutesLeft: minutes });
          });
        }

        (cls.break_times || []).forEach((breakTime) => {
          const [breakH, breakM] = breakTime.split(':').map((v) => parseInt(v, 10));
          const breakTotalMin = breakH * 60 + breakM;
          const targetTotalMin = breakTotalMin - BREAK_ALARM_MINUTES;
          if (targetTotalMin < 0) return;
          if (minutesToHHMM(targetTotalMin) !== nowHHMM) return;

          const triggerKey = `${cls.id}_break_${breakTime}_${todayStr}`;
          triggerAlarm(triggerKey, { key: triggerKey, classId: cls.id, className: cls.name, type: 'break', minutesLeft: BREAK_ALARM_MINUTES });
        });
      });
    };

    const interval = setInterval(checkAlarms, 20 * 1000);
    checkAlarms();
    return () => clearInterval(interval);
  }, [classes, getAudioCtx]);

  return (
    <ClassAlarmContext.Provider value={{ activeAlerts, dismissAlert }}>
      {children}
    </ClassAlarmContext.Provider>
  );
};
