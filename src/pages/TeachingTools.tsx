import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, Timer, ClipboardCheck, Dices, ChevronRight, ArrowLeft } from 'lucide-react';
import GroupPicker from './tools/GroupPicker';

interface Tool {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  badge?: string;
  available: boolean;
  component?: React.ReactNode;
}

const tools: Tool[] = [
  {
    id: 'group-picker',
    icon: <Shuffle size={28} />,
    label: '랜덤 조 뽑기',
    description: '학생들을 랜덤으로 조를 나누고 애니메이션과 함께 발표합니다',
    available: true,
    component: <GroupPicker />,
  },
  {
    id: 'timer',
    icon: <Timer size={28} />,
    label: '수업 타이머',
    description: '발표 시간 제한, 쉬는 시간 등 다양한 타이머를 설정합니다',
    badge: '준비 중',
    available: false,
  },
  {
    id: 'random-pick',
    icon: <Dices size={28} />,
    label: '랜덤 학생 뽑기',
    description: '발표자, 청소 당번 등 랜덤으로 학생 1명을 뽑습니다',
    badge: '준비 중',
    available: false,
  },
  {
    id: 'quiz',
    icon: <ClipboardCheck size={28} />,
    label: '퀴즈 & 투표',
    description: '실시간 퀴즈와 학급 투표를 진행합니다',
    badge: '준비 중',
    available: false,
  },
];

const TeachingTools = () => {
  const [activeTool, setActiveTool] = useState<Tool | null>(null);

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
            {tools.map((tool, i) => (
              <motion.button
                key={tool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => tool.available && setActiveTool(tool)}
                disabled={!tool.available}
                className={`relative glass rounded-2xl p-6 border text-left flex flex-col gap-4 transition-all duration-300 group ${
                  tool.available
                    ? 'border-white/40 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 cursor-pointer'
                    : 'border-white/20 opacity-60 cursor-not-allowed'
                }`}
              >
                {tool.badge && (
                  <span className="absolute top-4 right-4 text-[10px] font-black bg-on-surface/10 text-on-surface-variant px-2 py-0.5 rounded-full">
                    {tool.badge}
                  </span>
                )}

                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    tool.available
                      ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white group-hover:shadow-md group-hover:shadow-primary/30'
                      : 'bg-on-surface/5 text-on-surface-variant'
                  }`}
                >
                  {tool.icon}
                </div>

                <div className="flex-1">
                  <h3 className="font-black text-on-surface text-base">{tool.label}</h3>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{tool.description}</p>
                </div>

                {tool.available && (
                  <div className="flex items-center gap-1 text-primary text-xs font-black group-hover:gap-2 transition-all">
                    시작하기
                    <ChevronRight size={14} />
                  </div>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeachingTools;
