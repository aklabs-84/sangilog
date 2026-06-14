import { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, Timer, ClipboardCheck, Dices, ChevronRight, ArrowLeft, BookOpen, Mic, LayoutPanelTop, BarChart2, Lock, Crown, X, HelpCircle } from 'lucide-react';
import { useAuth, checkIsPro, checkIsBasicOrAbove } from '../lib/auth';
import GroupPicker from './tools/GroupPicker';
import ClassTimer from './tools/ClassTimer';
import QuizGame from './tools/QuizGame';
import MaterialEditor from './tools/MaterialEditor';
import ClassTranscription from './tools/ClassTranscription';
import WhiteboardList from '../components/whiteboard/WhiteboardList';
import SurveyTool from './tools/SurveyTool';

interface QuickGuideStep {
  title: string;
  desc: string;
}

interface QuickGuide {
  steps: QuickGuideStep[];
  tip?: string;
}

interface Tool {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  badge?: string;
  available: boolean;
  planRequired: 'free' | 'limited' | 'basic' | 'pro';
  component?: React.ReactNode;
  quickGuide?: QuickGuide;
}

const tools: Tool[] = [
  {
    id: 'group-picker',
    icon: <Shuffle size={28} />,
    label: '랜덤 조 뽑기',
    description: '학생들을 랜덤으로 조를 나누고 애니메이션과 함께 발표합니다',
    available: true,
    planRequired: 'free',
    component: <GroupPicker />,
    quickGuide: {
      steps: [
        { title: '학생 목록 준비', desc: '클래스 불러오기로 학급 학생을 가져오거나 이름을 직접 입력합니다.' },
        { title: '조 구성 방식 선택', desc: '조 수 기준 또는 인원 수 기준으로 나눌 방식을 선택하고 조장 자동 선정 여부도 설정합니다.' },
        { title: '조 뽑기 실행', desc: '조 뽑기 버튼을 클릭하면 애니메이션과 함께 결과가 발표됩니다.' },
        { title: '결과 저장', desc: '이미지로 저장하거나 클래스에 적용해 학급에 조 정보를 저장합니다.' },
      ],
      tip: '저장된 조 탭에서 이전에 저장한 조 배정을 다시 불러올 수 있습니다.',
    },
  },
  {
    id: 'timer',
    icon: <Timer size={28} />,
    label: '수업 타이머',
    description: '발표 시간 제한, 쉬는 시간 등 다양한 타이머를 설정합니다',
    available: true,
    planRequired: 'free',
    component: <ClassTimer />,
    quickGuide: {
      steps: [
        { title: '프리셋 선택', desc: '준비(1분), 발표(3분), 쉬는 시간(5분), 모둠 활동(10분), 수업(45분) 중 선택하거나 직접 입력합니다.' },
        { title: '시작 / 일시정지 / 초기화', desc: '▶ 버튼으로 시작하고, 다시 누르면 일시정지됩니다. 🔄로 초기화합니다.' },
        { title: '전체화면 발표 모드', desc: '⬜ 확대 버튼으로 전체화면 전환. TV·프로젝터에 띄울 때 사용합니다.' },
      ],
      tip: '타이머는 다른 도구 사용 중에도 우측 하단 플로팅 버튼으로 빠르게 접근할 수 있습니다.',
    },
  },
  {
    id: 'quiz',
    icon: <ClipboardCheck size={28} />,
    label: '실시간 퀴즈',
    description: '클래스별 문제를 만들고 Kahoot 스타일의 실시간 퀴즈를 진행합니다',
    badge: 'NEW',
    available: true,
    planRequired: 'limited',
    component: <QuizGame />,
    quickGuide: {
      steps: [
        { title: '퀴즈 세트 만들기', desc: '+ 새 퀴즈 세트를 클릭해 4지선다 문제를 추가합니다. PRO는 AI 자동 생성도 가능합니다.' },
        { title: '세션 시작', desc: '퀴즈 세트 선택 후 ▶ 세션 시작을 클릭하면 6자리 PIN이 생성됩니다.' },
        { title: 'PIN 공유 → 학생 참여', desc: '학생은 PIN을 입력해 로비에 입장합니다. 참가자가 모이면 퀴즈 시작을 누릅니다.' },
        { title: '진행 및 결과 확인', desc: '문제마다 정답과 실시간 순위가 표시됩니다. 마지막엔 최종 순위 화면이 나옵니다.' },
      ],
      tip: '무료 플랜은 퀴즈 세트당 5문항까지만 사용 가능합니다.',
    },
  },
  {
    id: 'material-editor',
    icon: <BookOpen size={28} />,
    label: '수업 자료 에디터',
    description: '마크다운으로 수업 자료를 작성하고 클래스 주차별로 학생에게 공개합니다',
    badge: 'NEW',
    available: true,
    planRequired: 'basic',
    component: <MaterialEditor />,
    quickGuide: {
      steps: [
        { title: '클래스 · 주차 선택', desc: '상단에서 대상 클래스와 주차를 선택합니다.' },
        { title: '마크다운으로 작성', desc: '툴바 버튼이나 마크다운 문법으로 자료를 작성합니다. 우측 미리보기에서 실시간 확인이 가능합니다.' },
        { title: '슬라이드 구분', desc: '본문에 --- 를 입력하면 슬라이드가 구분됩니다. 슬라이드 모드로 전체화면 발표를 할 수 있습니다.' },
        { title: '저장 후 공개', desc: '저장 후 🔒 비공개 토글을 켜면 학생이 학생 페이지에서 자료를 확인할 수 있습니다.' },
      ],
      tip: '# 제목 / **굵게** / - 목록 / `코드` 등 마크다운 기초 문법으로 빠르게 작성하세요.',
    },
  },
  {
    id: 'transcription',
    icon: <Mic size={28} />,
    label: '수업 전사 & AI 분석',
    description: '수업을 실시간 전사하고 AI가 학생별 관찰 기록과 수업 품질을 자동 분석합니다',
    badge: 'NEW',
    available: true,
    planRequired: 'basic',
    component: <ClassTranscription />,
    quickGuide: {
      steps: [
        { title: '클래스 선택', desc: '분석에 사용할 클래스를 선택합니다. 학생 이름이 AI 분석의 기준이 됩니다.' },
        { title: '녹음 시작', desc: '🎙️ 녹음 시작을 클릭하고 마이크 권한을 허용하면 실시간으로 수업이 전사됩니다.' },
        { title: '녹음 중지 후 AI 분석', desc: '■ 중지 후 ✨ AI 분석을 클릭합니다. 학생별 관찰·수업 평가·자기 성찰 3가지 탭으로 결과가 표시됩니다.' },
        { title: '관찰 기록 저장', desc: '학생별 관찰 초안에서 저장 버튼을 누르면 해당 학생의 관찰기록에 바로 추가됩니다.' },
      ],
      tip: 'Chrome 브라우저에서 가장 잘 작동합니다. Safari·Firefox에서는 실시간 전사가 제한될 수 있습니다.',
    },
  },
  {
    id: 'whiteboard',
    icon: <LayoutPanelTop size={28} />,
    label: '협업 화이트보드',
    description: '조별 협업 보드를 만들고 포스트잇, 도형, 이미지로 수업 활동을 진행합니다',
    badge: 'NEW',
    available: true,
    planRequired: 'basic',
    component: <WhiteboardList />,
    quickGuide: {
      steps: [
        { title: '보드 만들기', desc: '+ 새 보드를 클릭해 보드 이름을 입력합니다.' },
        { title: '학생 공유 링크 배포', desc: '보드 공유 버튼을 클릭해 학생용 링크를 복사하고 공유합니다.' },
        { title: '오브젝트 추가', desc: '툴바에서 포스트잇·도형·이미지·섹션을 추가하고 드래그해 배치합니다.' },
        { title: '단축키 활용', desc: 'Ctrl+C/V 복사·붙여넣기, Ctrl+Z 되돌리기, Delete 삭제. 섹션 색상은 우클릭 메뉴로 변경합니다.' },
      ],
      tip: '수업 종료 후 공유 중지 버튼을 눌러 학생 접근을 차단하세요.',
    },
  },
  {
    id: 'survey',
    icon: <BarChart2 size={28} />,
    label: '실시간 설문',
    description: '객관식, 예/아니오, 별점, 순위 매기기, AI 분석까지 다양한 실시간 설문을 진행합니다',
    badge: 'NEW',
    available: true,
    planRequired: 'basic',
    component: <SurveyTool />,
    quickGuide: {
      steps: [
        { title: '설문 양식 만들기', desc: '+ 새 설문 만들기를 클릭해 제목을 입력하고 + 문항 추가로 원하는 타입의 문항을 추가합니다.' },
        { title: '설문 열기 · PIN 공유', desc: '▶ 설문 열기를 클릭하면 6자리 PIN이 생성됩니다. 학생들이 PIN을 입력해 응답합니다.' },
        { title: '실시간 결과 확인', desc: '응답이 들어오는 대로 결과 차트가 실시간으로 업데이트됩니다.' },
        { title: 'AI 분석 · CSV 내보내기', desc: '설문 종료 후 ✨ AI 분석으로 응답을 요약하거나 CSV로 저장합니다.' },
      ],
      tip: '문항 타입: 객관식 · 예/아니오 · 별점 · 단답형 · 의견 척도(슬라이더) · 순위 매기기 6가지를 조합할 수 있습니다.',
    },
  },
  {
    id: 'random-pick',
    icon: <Dices size={28} />,
    label: '랜덤 학생 뽑기',
    description: '발표자, 청소 당번 등 랜덤으로 학생 1명을 뽑습니다',
    badge: '준비 중',
    available: false,
    planRequired: 'free',
  },
];

const TeachingTools = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [guideTool, setGuideTool] = useState<Tool | null>(null);

  const isPro = checkIsPro(profile);
  const isBasicOrAbove = checkIsBasicOrAbove(profile);

  const handleToolClick = (tool: Tool) => {
    if (!tool.available) return;
    if (!isBasicOrAbove && (tool.planRequired === 'basic' || tool.planRequired === 'pro')) {
      setShowUpgradeModal(true);
      return;
    }
    if (!isPro && tool.planRequired === 'pro') {
      setShowUpgradeModal(true);
      return;
    }
    setActiveTool(tool);
  };

  // location.state 또는 ?tool= 쿼리 파라미터로 특정 도구 자동 열기
  useEffect(() => {
    const stateToolId = (location.state as { activeToolId?: string } | null)?.activeToolId;
    const queryToolId = searchParams.get('tool');
    const toolId = stateToolId || queryToolId;
    if (toolId) {
      const tool = tools.find(t => t.id === toolId) ?? null;
      if (tool) handleToolClick(tool);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {activeTool && (
          <button
            onClick={() => setActiveTool(null)}
            className="p-2 rounded-xl hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-all"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h1 className="text-3xl font-black gradient-text">
            {activeTool ? activeTool.label : '수업 도구'}
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {activeTool
              ? activeTool.description
              : '수업에 바로 활용할 수 있는 도구 모음'}
          </p>
        </div>
      </div>

      {/* 업그레이드 모달 */}
      <AnimatePresence>
        {showUpgradeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => setShowUpgradeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Crown size={32} className="text-amber-500" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">
                {isBasicOrAbove ? 'PRO 전용 도구입니다' : 'Basic 이상 전용 도구입니다'}
              </h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                {isBasicOrAbove
                  ? <>이 도구는 Pro 플랜에서 사용할 수 있습니다.<br />업그레이드 문의는 관리자에게 연락해 주세요.</>
                  : <>이 도구는 Basic 플랜 이상에서 사용할 수 있습니다.<br />베타 테스터 또는 플랜 업그레이드 문의는 관리자에게 연락해 주세요.</>
                }
              </p>
              <div className="flex flex-col gap-3">
                <a
                  href={isBasicOrAbove
                    ? 'mailto:aklabs84@naver.com?subject=생기로그 Pro 플랜 업그레이드 문의'
                    : 'mailto:aklabs84@naver.com?subject=생기로그 Basic 플랜 문의'}
                  className="block w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-sm transition-colors"
                >
                  {isBasicOrAbove ? 'Pro 업그레이드 문의하기' : 'Basic 플랜 문의하기'}
                </a>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <X size={14} /> 닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 빠른 사용법 모달 */}
      <AnimatePresence>
        {guideTool && guideTool.quickGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => setGuideTool(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                    {guideTool.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900">{guideTool.label}</h3>
                    <p className="text-xs text-gray-400">빠른 사용 가이드</p>
                  </div>
                </div>
                <button
                  onClick={() => setGuideTool(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <ol className="flex flex-col gap-3 mb-4">
                {guideTool.quickGuide.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{step.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {guideTool.quickGuide.tip && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 leading-relaxed">
                  <span className="font-bold">💡 팁: </span>{guideTool.quickGuide.tip}
                </div>
              )}

              <button
                onClick={() => { setGuideTool(null); handleToolClick(guideTool); }}
                className="mt-4 w-full py-3 bg-primary hover:bg-primary/90 text-white font-black rounded-xl text-sm transition-colors"
              >
                {guideTool.planRequired === 'pro' && !isPro ? '업그레이드 필요' : '바로 시작하기 →'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeTool ? (
          <motion.div
            key={activeTool.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {activeTool.component}
          </motion.div>
        ) : (
          <motion.div
            key="menu"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {tools.map((tool, i) => {
              const isBasicLocked = !isBasicOrAbove && (tool.planRequired === 'basic' || tool.planRequired === 'pro');
              const isProLocked = isBasicOrAbove && !isPro && tool.planRequired === 'pro';
              const isLocked = isBasicLocked || isProLocked;
              const isLimited = !isPro && tool.planRequired === 'limited';
              return (
                <motion.button
                  key={tool.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  onClick={() => handleToolClick(tool)}
                  disabled={!tool.available}
                  className={`relative glass rounded-2xl p-6 border text-left flex flex-col gap-4 transition-all duration-300 group ${
                    !tool.available
                      ? 'border-white/20 opacity-60 cursor-not-allowed'
                      : isLocked
                      ? 'border-amber-200/60 hover:border-amber-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer'
                      : 'border-white/40 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 cursor-pointer'
                  }`}
                >
                  {/* 잠금 배지 */}
                  {isProLocked && (
                    <span className="absolute top-4 right-4 flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white">
                      <Crown size={9} /> PRO
                    </span>
                  )}
                  {isBasicLocked && (
                    <span className="absolute top-4 right-4 flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 text-white">
                      <Crown size={9} /> BASIC
                    </span>
                  )}
                  {/* 무료 제한 배지 */}
                  {isLimited && (
                    <span className="absolute top-4 right-4 text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                      무료 5문항
                    </span>
                  )}
                  {/* 기존 NEW / 준비중 배지 (잠금 아닐 때만) */}
                  {tool.badge && !isLocked && !isLimited && (
                    <span className={`absolute top-4 right-4 text-[10px] font-black px-2 py-0.5 rounded-full ${
                      tool.badge === 'NEW'
                        ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white'
                        : 'bg-on-surface/10 text-on-surface-variant'
                    }`}>
                      {tool.badge}
                    </span>
                  )}

                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      !tool.available
                        ? 'bg-on-surface/5 text-on-surface-variant'
                        : isLocked
                        ? 'bg-amber-100 text-amber-500 group-hover:bg-amber-500 group-hover:text-white'
                        : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white group-hover:shadow-md group-hover:shadow-primary/30'
                    }`}
                  >
                    {isLocked ? <Lock size={24} /> : tool.icon}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-black text-on-surface text-base">{tool.label}</h3>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{tool.description}</p>
                  </div>

                  {tool.available && (
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center gap-1 text-xs font-black group-hover:gap-2 transition-all ${isLocked ? 'text-amber-500' : 'text-primary'}`}>
                        {isLocked ? '업그레이드 필요' : '시작하기'}
                        <ChevronRight size={14} />
                      </div>
                      {tool.quickGuide && (
                        <button
                          onClick={e => { e.stopPropagation(); setGuideTool(tool); }}
                          className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-primary transition-colors px-1.5 py-0.5 rounded-lg hover:bg-primary/10"
                        >
                          <HelpCircle size={12} />
                          사용법
                        </button>
                      )}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeachingTools;
