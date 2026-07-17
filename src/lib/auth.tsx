import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';
import type { User, Session, RealtimeChannel } from '@supabase/supabase-js';
import { useIdleTimeout } from '../hooks/useIdleTimeout';

const IDLE_MS = 29 * 60 * 1000;   // 29분 무활동 → 경고
const WARNING_MS = 60 * 1000;      // 1분 카운트다운 → 자동 로그아웃

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  isTeacher: boolean; // 인증된 선생님 여부 (익명 유저 제외)
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  showIdleWarning: boolean;
  idleSecondsLeft: number;
  dismissIdleWarning: () => void;
}

// 익명 유저 판별 — is_anonymous(최신 SDK) + app_metadata.provider(구버전) 이중 확인
export function isAnonymousUser(user: User | null): boolean {
  if (!user) return false;
  return (user as any).is_anonymous === true ||
    user.app_metadata?.provider === 'anonymous';
}

// 신규 구글 가입 감지 시 Slack 알림 (최초 로그인 = created_at과 last_sign_in_at이 거의 동시)
function notifyGoogleSignupIfNew(user: User) {
  if (user.app_metadata?.provider !== 'google') return;

  const dedupeKey = `google-signup-notified:${user.id}`;
  if (sessionStorage.getItem(dedupeKey)) return;

  const createdAt = new Date(user.created_at).getTime();
  const lastSignInAt = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
  const isFirstSignIn = Math.abs(lastSignInAt - createdAt) < 5000;
  if (!isFirstSignIn) return;

  sessionStorage.setItem(dedupeKey, '1');

  fetch('/api/slack?type=google-signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      email: user.email,
    }),
  }).catch((error) => console.error('Google signup Slack notify failed:', error));
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const profileChannelRef = useRef<RealtimeChannel | null>(null);
  // 이전 인증 사용자 ID 추적 — 동일 사용자의 토큰 갱신 시 loading 전환을 막기 위해 사용
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. 초기 세션 체크 (10초 타임아웃 적용)
    const sessionTimeout = setTimeout(() => setLoading(false), 10000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        clearTimeout(sessionTimeout);
        setSession(session);
        setUser(session?.user ?? null);
        prevUserIdRef.current = session?.user?.id ?? null;
        if (session?.user && !session.user.is_anonymous) {
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      })
      .catch((error) => {
        clearTimeout(sessionTimeout);
        console.error('Session fetch failed:', error);
        setLoading(false);
      });

    // 2. 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUserId = session?.user?.id ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && !session.user.is_anonymous) {
        // 동일 사용자의 토큰 갱신/재인증(탭 전환 후 복귀 등)은 loading을 true로 전환하지 않음
        // — loading이 true가 되면 ProtectedRoute가 로딩 스피너를 표시하면서
        //   전체 컴포넌트 트리가 언마운트/리마운트돼 화면 상태가 초기화되는 버그 방지
        const isNewUserSession = newUserId !== prevUserIdRef.current;
        if (isNewUserSession) {
          setLoading(true);
          notifyGoogleSignupIfNew(session.user);
        }
        prevUserIdRef.current = newUserId;
        fetchProfile(session.user.id);
      } else {
        prevUserIdRef.current = null;
        setProfile(null);
        setLoading(false);
        cleanupProfileChannel();
      }
    });

    return () => {
      subscription.unsubscribe();
      cleanupProfileChannel();
    };
  }, []);

  const cleanupProfileChannel = () => {
    if (profileChannelRef.current) {
      supabase.removeChannel(profileChannelRef.current);
      profileChannelRef.current = null;
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      // 프로필 없음 = 관리자가 계정 삭제 → 강제 로그아웃
      if (data === null) {
        await supabase.auth.signOut();
        return;
      }

      setProfile(data);

      // Realtime 구독: UPDATE(플랜 변경 등) + DELETE(계정 삭제) 감지
      cleanupProfileChannel();
      profileChannelRef.current = supabase
        .channel(`profile-${userId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          (payload) => { setProfile(payload.new); }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          () => { supabase.auth.signOut(); }
        )
        .subscribe();

    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const signOut = async () => {
    cleanupProfileChannel();
    await supabase.auth.signOut();
  };

  // 유휴 타이머로 인한 자동 로그아웃 전용 — scope: 'local'로 이 탭만 로그아웃시킴.
  // 기본 signOut()은 scope: 'global'이라 다른 탭의 세션까지 함께 무효화되어,
  // 한 탭이 무활동으로 자동 로그아웃될 때 다른 탭에서 활발히 작업 중이어도 같이 튕겨나가는 문제가 있었음.
  const handleIdleTimeout = async () => {
    cleanupProfileChannel();
    await supabase.auth.signOut({ scope: 'local' });
  };

  const isTeacher = !!user && !isAnonymousUser(user);
  const userId = user?.id ?? null;

  // 오늘 수업 시작을 체크했고 아직 종료를 체크하지 않은 학급이 하나라도 있으면
  // 수업 중 자리를 비운 것으로 오인해 자동 로그아웃되지 않도록 유휴 타이머를 비활성화
  const [hasActiveClassToday, setHasActiveClassToday] = useState(false);

  useEffect(() => {
    if (!isTeacher || !userId) {
      setHasActiveClassToday(false);
      return;
    }

    const toLocalDateStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const checkActiveSession = async () => {
      const todayStr = toLocalDateStr(new Date());
      const { data } = await supabase
        .from('classes')
        .select('today_started_at, today_ended_at')
        .eq('teacher_id', userId)
        .eq('is_closed', false);

      const active = (data || []).some((c: { today_started_at: string | null; today_ended_at: string | null }) => {
        const startedToday = c.today_started_at && toLocalDateStr(new Date(c.today_started_at)) === todayStr;
        const endedToday = c.today_ended_at && toLocalDateStr(new Date(c.today_ended_at)) === todayStr;
        return startedToday && !endedToday;
      });
      setHasActiveClassToday(active);
    };

    checkActiveSession();
    const interval = setInterval(checkActiveSession, 60 * 1000);
    return () => clearInterval(interval);
  }, [isTeacher, userId]);

  const { showWarning: showIdleWarning, secondsLeft: idleSecondsLeft, resetTimer: dismissIdleWarning } = useIdleTimeout({
    idleMs: IDLE_MS,
    warningMs: WARNING_MS,
    onTimeout: handleIdleTimeout,
    enabled: isTeacher && !hasActiveClassToday,
  });

  const value = { user, session, profile, loading, isTeacher, signOut, refreshProfile, showIdleWarning, idleSecondsLeft, dismissIdleWarning };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export function checkIsPro(profile: any): boolean {
  if (!profile) return false;
  if (['pro', 'school', 'admin'].includes(profile.plan ?? 'free')) return true;
  if (profile.beta_expires_at && new Date(profile.beta_expires_at) > new Date()) return true;
  if (profile.project_pro_until && new Date(profile.project_pro_until) > new Date()) return true;
  return false;
}

export function checkIsBasicOrAbove(profile: any): boolean {
  if (!profile) return false;
  if (['basic', 'pro', 'school', 'admin'].includes(profile.plan ?? 'free')) return true;
  if (profile.beta_expires_at && new Date(profile.beta_expires_at) > new Date()) return true;
  return false;
}

export function getAiMonthlyLimit(profile: any): number {
  if (!profile) return 0;
  if (profile.plan === 'admin') return Infinity;
  if (checkIsPro(profile)) return 500;  // pro, school, beta 모두 500회
  if (checkIsBasicOrAbove(profile)) return 100;
  return 20; // Free: 월 20회 체험
}

/** @deprecated getAiMonthlyLimit 으로 대체됨 */
export function getAiDailyLimit(profile: any): number {
  return getAiMonthlyLimit(profile);
}

export function checkCanUseAi(profile: any): boolean {
  return getAiMonthlyLimit(profile) > 0;
}

export function getClassLimit(profile: any): number {
  if (profile?.plan === 'admin') return Infinity;
  if (checkIsPro(profile)) return 10;
  if (checkIsBasicOrAbove(profile)) return 5;
  return 1;
}

export function getStudentLimit(profile: any): number {
  if (profile?.plan === 'admin') return Infinity;
  if (checkIsBasicOrAbove(profile)) return 35;
  return 20;
}

export function getBetaDaysLeft(profile: any): number | null {
  if (!profile?.beta_expires_at) return null;
  const diff = new Date(profile.beta_expires_at).getTime() - Date.now();
  if (diff <= 0) return null;
  // 서버-브라우저 시계 오차(수 ms~수 초)로 Math.ceil이 실제보다 1 크게 나오는 현상 방지
  return Math.ceil((diff - 60_000) / (1000 * 60 * 60 * 24)) || 1;
}
