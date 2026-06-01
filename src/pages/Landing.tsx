import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  BookOpen,
  Sparkles,
  FileDown,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Users,
  Clock,
  Heart,
  Send,
  KeyRound,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const ROLES = ['담임 선생님', '교과 선생님', '강사', '교육 행정직', '기타'];

const features = [
  {
    icon: BookOpen,
    color: 'bg-amber-100 text-amber-600',
    title: '관찰기록 수집',
    desc: '학생이 참여 코드로 직접 제출. 선생님은 승인만 하면 됩니다.',
  },
  {
    icon: Sparkles,
    color: 'bg-violet-100 text-violet-600',
    title: 'AI 세특 초안',
    desc: 'Gemini AI가 관찰기록을 분석해 세특 초안을 자동 생성합니다.',
  },
  {
    icon: FileDown,
    color: 'bg-emerald-100 text-emerald-600',
    title: '나이스 바로 제출',
    desc: '500자 맞춤 편집 후 나이스 엑셀로 한 번에 내보냅니다.',
  },
];

const steps = [
  { num: '01', title: '학급 생성', desc: '학급 코드를 만들면 학생들이 바로 참여합니다.' },
  { num: '02', title: '기록 쌓기', desc: '학생이 제출한 관찰기록을 승인하며 포트폴리오를 쌓습니다.' },
  { num: '03', title: '세특 완성', desc: 'AI 초안을 확인·수정하고 나이스 엑셀로 제출합니다.' },
];

const Landing = () => {
  const navigate = useNavigate();

  // 신청 폼 상태
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const { error } = await supabase.from('access_requests').insert({
      name,
      email,
      school_name: schoolName,
      role,
      message: message || null,
    });

    if (error) {
      setSubmitting(false);
      setSubmitError('제출 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    // 슬랙 알림 (실패해도 신청은 이미 저장됐으므로 무시)
    try {
      await fetch('/api/slack-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, school_name: schoolName, role, message: message || null }),
      });
    } catch (_) {}

    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#FFFBF5] text-[#2d2d2d] font-pretendard">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-[#FFFBF5]/90 backdrop-blur border-b border-amber-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-sm">
              <GraduationCap size={20} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-black tracking-tight text-amber-800">생기로그 AI</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/catalog.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex px-4 py-2 text-amber-700 hover:text-amber-900 text-sm font-bold rounded-full transition-colors items-center gap-1.5 hover:bg-amber-50"
            >
              제품 소개
            </a>
            <a
              href="/guide.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex px-4 py-2 text-amber-700 hover:text-amber-900 text-sm font-bold rounded-full transition-colors items-center gap-1.5 hover:bg-amber-50"
            >
              사용 가이드
            </a>
            <button
              onClick={() => navigate('/classroom-entry')}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-full transition-colors shadow-sm flex items-center gap-1.5"
            >
              <KeyRound size={14} strokeWidth={2.5} />
              수업 참여
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-full transition-colors shadow-sm"
            >
              선생님 로그인
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-8%] right-[-5%] w-[500px] h-[500px] bg-amber-200/40 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-[-5%] w-[400px] h-[400px] bg-orange-100/60 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full mb-6">
              <Heart size={12} fill="currentColor" /> 선생님을 위한 AI 도구
            </span>
            <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight mb-6 text-amber-900">
              선생님의 소중한 시간을<br />
              <span className="text-amber-500">돌려드립니다</span>
            </h1>
            <p className="text-lg text-amber-800/70 max-w-xl mx-auto mb-10 leading-relaxed">
              관찰기록 수집부터 AI 세특 초안 생성, 나이스 제출까지.<br />
              생기로그 AI가 반복 업무를 대신합니다.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => document.getElementById('request-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl text-base transition-all shadow-lg hover:shadow-amber-200 hover:scale-105 flex items-center justify-center gap-2"
              >
                사용 신청하기 <ArrowRight size={18} strokeWidth={3} />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-4 bg-white hover:bg-amber-50 text-amber-700 font-bold rounded-2xl text-base transition-all border border-amber-200 shadow-sm"
              >
                기존 사용자 로그인
              </button>
            </div>
            <a
              href="/catalog.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-4 text-sm text-amber-600/80 hover:text-amber-700 font-semibold transition-colors underline underline-offset-4 decoration-amber-300"
            >
              📋 제품 카탈로그 · 도입 안내서 보기
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto"
          >
            {[
              { icon: Users, value: '300+', label: '사용 중인 선생님' },
              { icon: Clock, value: '3시간', label: '세특 작성 시간 절감' },
              { icon: CheckCircle2, value: '98%', label: '나이스 제출 호환성' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="text-center">
                <Icon size={20} className="text-amber-400 mx-auto mb-1" />
                <div className="text-2xl font-black text-amber-800">{value}</div>
                <div className="text-xs text-amber-600/70 font-medium">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Student CTA ── */}
      <section className="bg-white py-6">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onClick={() => navigate('/classroom-entry')}
            className="cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl px-7 py-5 hover:border-emerald-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-emerald-500 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                <KeyRound size={20} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <p className="font-black text-emerald-800 text-base">학생이신가요?</p>
                <p className="text-sm text-emerald-600/80">선생님께 받은 수업 코드로 바로 수업에 참여하세요</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 group-hover:bg-emerald-600 text-white font-bold text-sm rounded-xl transition-colors shrink-0">
              수업코드로 참여하기
              <ArrowRight size={16} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-black text-amber-900 mb-3">핵심 기능 3가지</h2>
            <p className="text-amber-700/60 text-base">이 세 가지만으로 세특 작성이 끝납니다</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map(({ icon: Icon, color, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#FFFBF5] rounded-3xl p-8 border border-amber-100 hover:border-amber-200 hover:shadow-lg transition-all"
              >
                <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center mb-5`}>
                  <Icon size={24} strokeWidth={2} />
                </div>
                <h3 className="text-lg font-black text-amber-900 mb-2">{title}</h3>
                <p className="text-sm text-amber-700/70 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 bg-amber-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-black text-amber-900 mb-3">이렇게 사용해요</h2>
            <p className="text-amber-700/60 text-base">세 단계면 충분합니다</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            {steps.map(({ num, title, desc }, i) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="flex flex-col items-center text-center"
              >
                <div className="w-14 h-14 bg-amber-500 text-white rounded-full flex items-center justify-center font-black text-lg mb-5 shadow-md shadow-amber-200">
                  {num}
                </div>
                <h3 className="text-lg font-black text-amber-900 mb-2">{title}</h3>
                <p className="text-sm text-amber-700/70 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Access Request Form ── */}
      <section id="request-section" className="py-24 bg-white">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full mb-4">
              <CheckCircle2 size={12} /> 사전 신청
            </span>
            <h2 className="text-3xl font-black text-amber-900 mb-3">사용 신청하기</h2>
            <p className="text-amber-700/70 text-sm leading-relaxed">
              신청 후 검토를 거쳐 계정 생성 안내 이메일을 보내드립니다.<br />
              학교 규모와 무관하게 모두 환영합니다.
            </p>
          </div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16 bg-emerald-50 rounded-3xl border border-emerald-100"
            >
              <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
              <h3 className="text-xl font-black text-emerald-800 mb-2">신청이 접수되었습니다!</h3>
              <p className="text-emerald-700/70 text-sm">검토 후 이메일로 안내해 드리겠습니다.<br />감사합니다 😊</p>
            </motion.div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-[#FFFBF5] rounded-3xl p-8 border border-amber-100 shadow-sm space-y-5"
            >
              {submitError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
                  {submitError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-amber-700 ml-1">이름 *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-sm font-medium focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-amber-700 ml-1">이메일 *</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@school.edu"
                    className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-sm font-medium focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-amber-700 ml-1">학교 이름 *</label>
                <input
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="아크고등학교"
                  className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-sm font-medium focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-amber-700 ml-1">직책 *</label>
                <select
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-sm font-medium focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all appearance-none"
                >
                  <option value="">선택해 주세요</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-amber-700 ml-1">하고 싶은 말 (선택)</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="사용하고 싶은 이유나 기대하는 기능을 자유롭게 적어주세요."
                  rows={3}
                  className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-sm font-medium focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-black rounded-2xl text-base transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-amber-200"
              >
                {submitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <Send size={18} strokeWidth={2.5} />
                    신청서 제출하기
                  </>
                )}
              </button>

              <p className="text-center text-xs text-amber-600/50">
                이미 계정이 있으신가요?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-amber-600 font-bold hover:underline"
                >
                  로그인하기
                </button>
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 bg-amber-900 text-amber-200">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center">
              <GraduationCap size={16} className="text-white" />
            </div>
            <span className="font-black text-amber-100">생기로그 AI</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-amber-400">
            <a
              href="/guide.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-amber-200 transition-colors underline underline-offset-2"
            >
              사용 가이드
            </a>
            <span>© 2026 AK LABS. 선생님을 응원합니다.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
