import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';
import type { User, Session, RealtimeChannel } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  isTeacher: boolean; // 인증된 선생님 여부 (익명 유저 제외)
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// 익명 유저 판별 — is_anonymous(최신 SDK) + app_metadata.provider(구버전) 이중 확인
export function isAnonymousUser(user: User | null): boolean {
  if (!user) return false;
  return (user as any).is_anonymous === true ||
    user.app_metadata?.provider === 'anonymous';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const profileChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // 1. 초기 세션 체크 (10초 타임아웃 적용)
    const sessionTimeout = setTimeout(() => setLoading(false), 10000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        clearTimeout(sessionTimeout);
        setSession(session);
        setUser(session?.user ?? null);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && !session.user.is_anonymous) {
        // TOKEN_REFRESHED(탭 전환 시 자동 갱신)는 setLoading(true) 생략
        // — 이미 인증된 상태이므로 loading 전환 시 컴포넌트 재마운트가 불필요
        if (event !== 'TOKEN_REFRESHED') {
          setLoading(true);
        }
        fetchProfile(session.user.id);
      } else {
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

  const isTeacher = !!user && !isAnonymousUser(user);
  const value = { user, session, profile, loading, isTeacher, signOut, refreshProfile };

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
  if (['pro', 'admin'].includes(profile.plan ?? 'free')) return true;
  if (profile.beta_expires_at && new Date(profile.beta_expires_at) > new Date()) return true;
  return false;
}

export function checkIsBasicOrAbove(profile: any): boolean {
  if (!profile) return false;
  if (['basic', 'pro', 'admin'].includes(profile.plan ?? 'free')) return true;
  if (profile.beta_expires_at && new Date(profile.beta_expires_at) > new Date()) return true;
  return false;
}

export function getAiDailyLimit(profile: any): number {
  if (checkIsPro(profile)) return Infinity;
  if (checkIsBasicOrAbove(profile)) return 30;
  return 10;
}

export function getClassLimit(profile: any): number {
  if (checkIsPro(profile)) return Infinity;
  if (checkIsBasicOrAbove(profile)) return 5;
  return 2;
}

export function getBetaDaysLeft(profile: any): number | null {
  if (!profile?.beta_expires_at) return null;
  const diff = new Date(profile.beta_expires_at).getTime() - Date.now();
  if (diff <= 0) return null;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
