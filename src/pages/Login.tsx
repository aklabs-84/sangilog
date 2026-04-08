import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, MousePointer2, User as UserIcon, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Login = () => {
  const [activeTab, setActiveTab] = useState('teacher'); // 'teacher' or 'student'
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [subject, setSubject] = useState('');

  const navigate = useNavigate();

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        // 1. 회원가입
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: activeTab,
              school_code: schoolCode,
              school_name: schoolName,
              subject: subject,
            }
          }
        });
        if (signUpError) throw signUpError;
        alert('회원가입이 완료되었습니다! 이메일 인증이 필요한 경우 확인해 주세요. 이제 로그인을 시도해 주세요.');
        setIsSignUp(false);
      } else {
        // 2. 로그인
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || '인증 과정에서 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-8 relative overflow-hidden selection:bg-primary/20 selection:text-primary">
      {/* Background Decor - More vibrant for the login page */}
      <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[100px] animate-pulse delay-700" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-accent/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-4 mb-16 relative z-10"
      >
        <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-[1.5rem] flex items-center justify-center text-white shadow-elevated group cursor-pointer hover:rotate-12 transition-transform duration-500">
          <GraduationCap size={36} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tightest leading-none gradient-text">생기로그 AI</h1>
          <p className="text-[10px] text-primary/40 font-black uppercase tracking-[0.4em] mt-1 ml-1">Next-Gen Education Lab</p>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-[520px] layered-card shadow-elevated p-12 relative z-10 overflow-hidden bg-white/70"
      >
        {/* Decorative corner glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />

        {/* Tabs */}
        <div className="flex glass rounded-2xl p-1.5 mb-12 border border-white/40 shadow-soft">
          {['teacher', 'student'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 text-sm font-black transition-all rounded-xl relative uppercase tracking-[0.15em] ${
                activeTab === tab ? 'bg-white text-primary shadow-elevated scale-105' : 'text-on-surface-variant/40 hover:text-on-surface'
              }`}
            >
              {tab === 'teacher' ? '선생님' : '학생'}
              {activeTab === tab && (
                <motion.div 
                  layoutId="activeLoginTab"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" 
                />
              )}
            </button>
          ))}
        </div>

        <div className="text-center mb-12">
          <h2 className="text-3xl font-black mb-3 tracking-tightest">{isSignUp ? '새로운 시작' : '다시 오셨군요!'}</h2>
          <p className="text-[10px] text-on-surface-variant/40 uppercase tracking-[0.25em] font-black">
            {activeTab === 'teacher' ? 'Educator' : 'Learner'} {isSignUp ? 'Registration' : 'Authentication'}
          </p>
        </div>

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

        <form onSubmit={handleAuth} className="space-y-8">
          <AnimatePresence mode="wait">
            {isSignUp && (
              <motion.div 
                key="signup-fields"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] ml-2">성함 또는 별명</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-on-surface-variant/20 group-focus-within:text-primary transition-colors">
                      <UserIcon size={20} strokeWidth={2.5} />
                    </div>
                    <input 
                      type="text" 
                      required={isSignUp}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="홍길동 선생님"
                      className="w-full pl-14 pr-6 py-5 bg-surface-container/50 rounded-2xl text-base font-bold focus:outline-none focus:ring-8 focus:ring-primary/5 focus:bg-white focus:border-primary/20 border-2 border-transparent transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] ml-2">학교 코드</label>
                    <input 
                      type="text" 
                      required={isSignUp}
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                      placeholder="SCH-123"
                      className="w-full px-5 py-5 bg-surface-container/50 rounded-2xl text-sm font-bold focus:bg-white border-2 border-transparent focus:border-primary/20 transition-all shadow-inner uppercase"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] ml-2">학교 명칭</label>
                    <input 
                      type="text" 
                      required={isSignUp}
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="아크고등학교"
                      className="w-full px-5 py-5 bg-surface-container/50 rounded-2xl text-sm font-bold focus:bg-white border-2 border-transparent focus:border-primary/20 transition-all shadow-inner"
                    />
                  </div>
                </div>

                {activeTab === 'teacher' && (
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] ml-2">담당 과목</label>
                    <input 
                      type="text" 
                      required={isSignUp && activeTab === 'teacher'}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="예: 국어, 수학 (담임은 '담임' 입력)"
                      className="w-full px-6 py-5 bg-surface-container/50 rounded-2xl text-base font-bold focus:bg-white border-2 border-transparent focus:border-primary/20 transition-all shadow-inner"
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

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
            <label className="text-[11px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em] ml-2">보안 비밀번호</label>
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

          {!isSignUp && (
            <div className="flex items-center justify-between px-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" className="hidden" />
                <div className="w-6 h-6 rounded-lg border-2 border-surface-container-high group-hover:border-primary transition-all flex items-center justify-center bg-white shadow-sm overflow-hidden">
                  <div className="w-2.5 h-2.5 bg-primary rounded-sm scale-0 group-focus-within:scale-110 transition-transform"></div>
                </div>
                <span className="text-sm text-on-surface-variant/60 group-hover:text-on-surface font-bold transition-colors">기억할게요</span>
              </label>
              <button type="button" className="text-sm text-primary font-black hover:text-secondary underline decoration-primary/20 underline-offset-4 transition-colors">도움이 필요하신가요?</button>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn-vibrant py-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-4 shadow-elevated active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 mt-4"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={24} strokeWidth={3} />
            ) : (
              <>
                <span>{isSignUp ? '계정 생성하기' : '대시보드 입장'}</span>
                <ArrowRight size={22} strokeWidth={3} />
              </>
            )}
          </button>

          <button 
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-center text-[11px] font-black text-on-surface-variant/40 hover:text-primary transition-colors uppercase tracking-[0.25em]"
          >
            {isSignUp ? '이미 계정이 있으신가요? 로그인' : '아직 계정이 없으신가요? 회원가입'}
          </button>
        </form>

        <div className="mt-12 pt-12 border-t border-on-surface/5 text-center">
          <p className="text-[11px] font-black text-on-surface-variant/30 uppercase tracking-[0.3em] mb-8">학생인가요? 코드를 입력하세요</p>
          <button 
            onClick={() => navigate('/classroom-entry')}
            className="w-full py-5 rounded-2xl glass hover:bg-white text-primary font-black text-sm flex items-center justify-center gap-3 active:scale-95 transition-all border border-white/60 shadow-soft"
          >
            <MousePointer2 size={18} strokeWidth={3} />
            입장 코드로 간편 입장
          </button>
        </div>
      </motion.div>

      {/* Footer Decoration */}
      <div className="mt-16 flex gap-10 relative z-10">
        <button className="flex items-center gap-3 text-on-surface-variant/40 hover:text-primary text-[11px] font-black uppercase tracking-[0.2em] transition-all">
          <span className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-soft text-[10px]">KR</span>
          Korean (Republic of Korea)
        </button>
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
