import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, MousePointer2, Loader2, CheckCircle2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const setupDone = searchParams.get('setup') === 'done';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const navigate = useNavigate();

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden selection:bg-primary/20 selection:text-primary">
      <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[100px] animate-pulse delay-700" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-accent/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-4 mb-8 md:mb-16 relative z-10"
      >
        <div
          onClick={() => navigate('/')}
          className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-[1.5rem] flex items-center justify-center text-white shadow-elevated cursor-pointer hover:rotate-12 transition-transform duration-500"
        >
          <GraduationCap size={36} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tightest leading-none gradient-text">생기로그 AI</h1>
          <p className="text-[10px] text-primary/40 font-black tracking-[0.15em] mt-1 ml-1">수업 기록부터 세특까지</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-[480px] layered-card shadow-elevated p-6 md:p-12 relative z-10 overflow-hidden bg-white/70"
      >
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />

        <div className="text-center mb-10">
          <h2 className="text-3xl font-black mb-3 tracking-tightest">다시 오셨군요!</h2>
          <p className="text-[10px] text-on-surface-variant/40 uppercase tracking-[0.25em] font-black">
            Educator Authentication
          </p>
        </div>

        {setupDone && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-8 p-5 bg-emerald-50 border-2 border-emerald-100 rounded-2xl text-emerald-700 text-[13px] font-black tracking-tight flex items-center gap-3"
          >
            <CheckCircle2 size={18} className="shrink-0" />
            비밀번호 설정 완료! 이메일과 비밀번호로 로그인해주세요.
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-8 p-5 bg-error/10 border-2 border-error/20 rounded-2xl text-error text-[13px] font-black tracking-tight flex items-center gap-3"
          >
            <div className="w-2 h-2 bg-error rounded-full animate-pulse" />
            {error}
          </motion.div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-3">
            <label className="text-[11px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] ml-2">이메일 계정</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-on-surface-variant/20 group-focus-within:text-primary transition-colors">
                <Mail size={20} strokeWidth={2.5} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.edu"
                className="w-full pl-14 pr-6 py-5 bg-surface-container/50 rounded-2xl text-base font-bold focus:outline-none focus:ring-8 focus:ring-primary/5 focus:bg-white focus:border-primary/20 border-2 border-transparent transition-all shadow-inner"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[11px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] ml-2">비밀번호</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-on-surface-variant/20 group-focus-within:text-primary transition-colors">
                <Lock size={20} strokeWidth={2.5} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-14 pr-14 py-5 bg-surface-container/50 rounded-2xl text-base font-bold focus:outline-none focus:ring-8 focus:ring-primary/5 focus:bg-white focus:border-primary/20 border-2 border-transparent transition-all shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-5 flex items-center text-on-surface-variant/20 hover:text-primary transition-colors"
              >
                {showPassword ? <EyeOff size={20} strokeWidth={2.5} /> : <Eye size={20} strokeWidth={2.5} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-vibrant py-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-4 shadow-elevated active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 mt-4"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={24} strokeWidth={3} />
            ) : (
              <>
                <span>대시보드 입장</span>
                <ArrowRight size={22} strokeWidth={3} />
              </>
            )}
          </button>

          <p className="text-center text-[11px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em]">
            계정이 없으신가요?{' '}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-primary hover:underline"
            >
              사용 신청하기
            </button>
          </p>
        </form>

        <div className="mt-10 pt-10 border-t border-on-surface/5 text-center">
          <p className="text-[11px] font-black text-on-surface-variant/30 uppercase tracking-[0.3em] mb-6">학생인가요? 코드를 입력하세요</p>
          <button
            onClick={() => navigate('/classroom-entry')}
            className="w-full py-5 rounded-2xl glass hover:bg-white text-primary font-black text-sm flex items-center justify-center gap-3 active:scale-95 transition-all border border-white/60 shadow-soft"
          >
            <MousePointer2 size={18} strokeWidth={3} />
            입장 코드로 간편 입장
          </button>
        </div>
      </motion.div>

      <div className="mt-12 flex gap-8 relative z-10">
        <div className="flex items-center gap-8 text-[11px] font-black text-on-surface-variant/30 uppercase tracking-[0.2em]">
          <span>© 2026 SAENGGI LOG AI</span>
          <span className="w-1 h-1 bg-on-surface-variant/20 rounded-full" />
          <span>System v2.5V</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
