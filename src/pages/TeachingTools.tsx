import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, Timer, ClipboardCheck, Dices, ChevronRight, ArrowLeft, BookOpen, Mic, LayoutPanelTop, BarChart2, Lock, Crown, X } from 'lucide-react';
import { useAuth, checkIsPro } from '../lib/auth';
import GroupPicker from './tools/GroupPicker';
import ClassTimer from './tools/ClassTimer';
import QuizGame from './tools/QuizGame';
import MaterialEditor from './tools/MaterialEditor';
import ClassTranscription from './tools/ClassTranscription';
import WhiteboardList from '../components/whiteboard/WhiteboardList';
import SurveyTool from './tools/SurveyTool';

interface Tool {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  badge?: string;
  available: boolean;
  planRequired: 'free' | 'limited' | 'pro';
  component?: React.ReactNode;
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
  },
  {
    id: 'timer',
    icon: <Timer size={28} />,
    label: '수업 타이머',
    description: '발표 시간 제한, 쉬는 시간 등 다양한 타이머를 설정합니다',
    available: true,
    planRequired: 'free',
    component: <ClassTimer />,
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
  },
  {
    id: 'material-editor',
    icon: <BookOpen size={28} />,
    label: '수업 자료 에디터',
    description: '마크다운으로 수업 자료를 작성하고 클래스 주차별로 학생에게 공개합니다',
    badge: 'NEW',
    available: true,
    planRequired: 'pro',
    component: <MaterialEditor />,
  },
  {
    id: 'transcription',
    icon: <Mic size={28} />,
    label: '수업 전사 & AI 분석',
    description: '수업을 실시간 전사하고 AI가 학생별 관찰 기록과 수업 품질을 자동 분석합니다',
    badge: 'NEW',
    available: true,
    planRequired: 'pro',
    component: <ClassTranscription />,
  },
  {
    id: 'whiteboard',
    icon: <LayoutPanelTop size={28} />,
    label: '협업 화이트보드',
    description: '조별 협업 보드를 만들고 포스트잇, 도형, 이미지로 수업 활동을 진행합니다',
    badge: 'NEW',
    available: true,
    planRequired: 'pro',
    component: <WhiteboardList />,
  },
  {
    id: 'survey',
    icon: <BarChart2 size={28} />,
    label: '실시간 설문',
    description: '객관식, 예/아니오, 별점, 순위 매기기, AI 분석까지 다양한 실시간 설문을 진행합니다',
    badge: 'NEW',
    available: true,
    planRequired: 'pro',
    component: <SurveyTool />,
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
  const { profile } = useAuth();
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isPro = checkIsPro(profile);

  const handleToolClick = (tool: Tool) => {
    if (!tool.available) return;
    if (!isPro && tool.planRequired === 'pro') {
      setShowUpgradeModal(true);
      return;
    }
    setActiveTool(tool);
  };

  // 화이트보드에서 뒤로 버튼 누를 때 whiteboard 패널 자동 열기
  useEffect(() => {
    const stateToolId = (location.state as { activeToolId?: string } | null)?.activeToolId;
    if (stateToolId) {
      const tool = tools.find(t => t.id === stateToolId) ?? null;
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
              <h3 className="text-xl font-black text-gray-900 mb-2">PRO 전용 도구입니다</h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                이 수업 도구는 Pro 플랜 이상에서 사용할 수 있습니다.<br />
                업그레이드 문의는 관리자에게 연락해 주세요.
              </p>
              <div className="flex flex-col gap-3">
                <a
                  href="mailto:aklabs84@naver.com?subject=생기로그 Pro 플랜 업그레이드 문의"
                  className="block w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-sm transition-colors"
                >
                  업그레이드 문의하기
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
              const isLocked = !isPro && tool.planRequired === 'pro';
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
                  {/* PRO 잠금 배지 */}
                  {isLocked && (
                    <span className="absolute top-4 right-4 flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white">
                      <Crown size={9} /> PRO
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
                    <div className={`flex items-center gap-1 text-xs font-black group-hover:gap-2 transition-all ${isLocked ? 'text-amber-500' : 'text-primary'}`}>
                      {isLocked ? '업그레이드 필요' : '시작하기'}
                      <ChevronRight size={14} />
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
