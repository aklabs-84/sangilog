import { Mail, School, Sparkles, Users, BookOpen, ClipboardList, FileText, Star, CheckCircle } from 'lucide-react';

const FEATURES = [
  {
    icon: <School size={22} className="text-violet-600" />,
    title: '학교 그룹 관리',
    desc: '교장·부장이 학교 그룹을 개설하고 교사를 초대해 학교 단위로 함께 사용합니다.',
  },
  {
    icon: <Users size={22} className="text-indigo-600" />,
    title: '교사 연동 & 역할 분리',
    desc: '관리자·멘토·일반 교사 역할을 구분하여 권한을 체계적으로 운영할 수 있습니다.',
  },
  {
    icon: <BookOpen size={22} className="text-emerald-600" />,
    title: '학급 공유 URL',
    desc: '각 학급의 수업·평가 기록을 전용 URL로 공유해 학부모·학생 모두 열람 가능합니다.',
  },
  {
    icon: <ClipboardList size={22} className="text-amber-600" />,
    title: '나이스 연동 일괄 처리',
    desc: '나이스 학생 명단을 한 번에 가져오고, AI가 세특 초안을 일괄 생성합니다.',
  },
  {
    icon: <FileText size={22} className="text-rose-500" />,
    title: 'AI 세특 작성',
    desc: 'AI가 수업 기록을 분석해 학생별 생활기록부 세부능력 및 특기사항 초안을 제안합니다.',
  },
  {
    icon: <Sparkles size={22} className="text-sky-500" />,
    title: '학교 프로젝트 공유',
    desc: '학교 내 프로젝트·캠페인을 교사 전체가 함께 기록하고 성과를 한 화면에서 확인합니다.',
  },
];

const STEPS = [
  { num: '01', label: '이메일 도입 문의', desc: '학교명·교사 수를 적어 문의를 보내주세요.' },
  { num: '02', label: '관리자 그룹 개설', desc: '아크 AI 랩스가 학교 전용 그룹을 설정합니다.' },
  { num: '03', label: '교사 초대 & 입장', desc: '초대 링크로 소속 교사가 바로 합류합니다.' },
  { num: '04', label: '전교 AI 기록 시작', desc: '오늘부터 학교 전체 수업 기록을 AI로 관리하세요.' },
];

const TIERS = [
  { range: '~ 10명', price: '월 89,000원', annual: '연 960,000원', saving: 'Pro 대비 55% 절감' },
  { range: '~ 20명', price: '월 149,000원', annual: '연 1,610,000원', saving: 'Pro 대비 62% 절감' },
  { range: '~ 40명', price: '월 249,000원', annual: '연 2,690,000원', saving: 'Pro 대비 68% 절감' },
  { range: '40명~', price: '별도 문의', annual: '', saving: '맞춤 견적 제공' },
];

export default function SchoolIntroPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-indigo-50 font-manrope">
      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-violet-100">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <span className="font-black text-indigo-900 text-sm">생기로그 AI</span>
          </a>
          <a
            href="mailto:aklabs84@naver.com?subject=생기로그 School 플랜 도입 문의"
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-black rounded-xl transition-all active:scale-95"
          >
            <Mail size={13} />
            도입 문의
          </a>
        </div>
      </header>

      {/* 히어로 */}
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-14 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 text-violet-700 text-xs font-black rounded-full mb-5">
          <Sparkles size={12} /> School 플랜 · 학교 전용
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight mb-4">
          우리 학교에 생기로그 AI를<br className="hidden sm:block" /> 도입해보세요
        </h1>
        <p className="text-base text-gray-500 leading-relaxed max-w-xl mx-auto mb-8">
          교사 수업 기록·AI 세특 작성·학급 공유까지,<br />
          학교 단위로 함께 쓰면 개인 Pro 플랜보다 최대 <strong className="text-violet-700">68%</strong> 저렴합니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="mailto:aklabs84@naver.com?subject=생기로그 School 플랜 도입 문의"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-violet-200 text-sm"
          >
            <Mail size={16} />
            학교 도입 문의하기
          </a>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white hover:bg-violet-50 text-violet-700 font-black rounded-2xl border border-violet-200 transition-all text-sm"
          >
            무료 체험 먼저 해보기
          </a>
        </div>
      </section>

      {/* 주요 기능 */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <h2 className="text-xl font-black text-gray-800 text-center mb-8">School 플랜 주요 기능</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-3">
                {f.icon}
              </div>
              <p className="font-black text-sm text-gray-900 mb-1">{f.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 도입 단계 */}
      <section className="bg-gradient-to-r from-violet-600 to-indigo-600 py-14">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-xl font-black text-white text-center mb-10">도입 절차</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s) => (
              <div key={s.num} className="bg-white/10 backdrop-blur rounded-2xl p-5 text-center">
                <p className="text-2xl font-black text-white/40 mb-2">{s.num}</p>
                <p className="font-black text-white text-sm mb-1">{s.label}</p>
                <p className="text-xs text-white/70 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 요금 */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-xl font-black text-gray-800 text-center mb-2">School 플랜 요금</h2>
        <p className="text-center text-sm text-gray-400 mb-8">교사 수 기준 티어제 · 학교 전체 무제한 기능 제공</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {TIERS.map((t) => (
            <div key={t.range} className="bg-white rounded-2xl p-5 border border-violet-100 shadow-sm text-center">
              <p className="text-xs font-bold text-violet-500 mb-1">{t.range}</p>
              <p className="text-lg font-black text-gray-900 mb-0.5">{t.price}</p>
              {t.annual && <p className="text-[11px] text-gray-400 mb-1">{t.annual}</p>}
              <p className="text-xs font-bold text-emerald-600">{t.saving}</p>
            </div>
          ))}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
          <Star size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            School 플랜은 이메일 문의 후 관리자가 직접 설정해드립니다.<br />
            온라인 결제 기능은 곧 추가될 예정입니다.
          </p>
        </div>
      </section>

      {/* 포함 기능 목록 */}
      <section className="max-w-3xl mx-auto px-4 pb-16">
        <h2 className="text-xl font-black text-gray-800 text-center mb-8">School 플랜에 포함된 모든 것</h2>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {[
            '학교 그룹 개설 및 교사 무제한 초대',
            '관리자·멘토·일반 교사 역할 구분',
            '나이스 학생 명단 일괄 가져오기',
            'AI 세특 초안 일괄 생성 (교사 수 × 월 200회)',
            '학급 공유 URL (학부모·학생 열람 가능)',
            '학교 프로젝트 공유 및 수업 협업 기록',
            '수업 녹음 AI 전사 기능',
            '퀴즈·화이트보드 무제한 생성',
            '전용 도입 지원 및 교사 연수 자료 제공',
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 px-5 py-4">
              <CheckCircle size={16} className="text-emerald-500 shrink-0" />
              <span className="text-sm text-gray-700">{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA 배너 */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl p-8 sm:p-10 text-center">
          <p className="text-2xl font-black text-white mb-2">지금 바로 도입 문의하세요</p>
          <p className="text-sm text-white/80 mb-6">도입 문의 후 보통 1~2 영업일 내에 설정을 완료해드립니다.</p>
          <a
            href="mailto:aklabs84@naver.com?subject=생기로그 School 플랜 도입 문의&body=학교명: %0A교사 수: %0A문의 내용: "
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-violet-700 font-black rounded-2xl hover:bg-violet-50 transition-all active:scale-95 text-sm shadow-lg"
          >
            <Mail size={16} />
            학교 도입 문의하기 →
          </a>
          <p className="mt-4 text-xs text-white/60">aklabs84@naver.com · 평일 오전 9시 ~ 오후 6시</p>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-gray-100 py-8 text-center">
        <p className="text-xs text-gray-400">생기로그 AI — 아크 AI 랩스 · aklabs84@naver.com</p>
        <div className="flex justify-center gap-4 mt-3">
          <a href="/" className="text-xs text-gray-400 hover:text-gray-600">홈으로</a>
          <a href="/privacy" className="text-xs text-gray-400 hover:text-gray-600">개인정보처리방침</a>
        </div>
      </footer>
    </div>
  );
}
