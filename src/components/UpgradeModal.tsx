import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, GraduationCap, Zap, Crown } from 'lucide-react';

type Reason = 'class_limit' | 'ai_limit' | 'ai_bulk' | 'teacher_invite' | 'naiss_export' | 'school_block';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: Reason;
}

const REASON_CONFIG: Record<Reason, {
  emoji: string;
  title: string;
  desc: string;
  freeLimit: string;
  proGain: string;
}> = {
  class_limit: {
    emoji: '🏫',
    title: '클래스 생성 한도 초과',
    desc: '무료 플랜은 클래스를 최대 2개까지 만들 수 있습니다.',
    freeLimit: '클래스 최대 2개',
    proGain: '클래스 무제한 생성',
  },
  ai_limit: {
    emoji: '✨',
    title: 'AI 사용 한도 초과',
    desc: '무료 플랜은 AI 세특 초안을 하루 10회까지 사용할 수 있습니다.\n자정이 지나면 자동으로 초기화됩니다.',
    freeLimit: 'AI 세특 하루 10회',
    proGain: 'AI 세특 무제한',
  },
  ai_bulk: {
    emoji: '⚡',
    title: 'Pro 기능',
    desc: '학급 전체 세특을 한 번에 생성하는 일괄 생성은 Pro 플랜 전용 기능입니다.',
    freeLimit: '개별 AI 생성만 가능',
    proGain: '학급 전체 일괄 생성',
  },
  teacher_invite: {
    emoji: '🔗',
    title: 'Pro 기능',
    desc: '교과 선생님을 담임반에 초대하는 연동 기능은 Pro 플랜 전용입니다.',
    freeLimit: '교사 연동 불가',
    proGain: '교사 연동 무제한',
  },
  naiss_export: {
    emoji: '📤',
    title: 'Pro 기능 — NAISS 내보내기',
    desc: 'NAISS 워크스테이션 및 나이스 포맷 내보내기는 Pro 플랜 전용 기능입니다.',
    freeLimit: '기본 CSV 내보내기만 가능',
    proGain: 'NAISS 포맷 내보내기 무제한',
  },
  school_block: {
    emoji: '🏫',
    title: 'School 플랜 — 열람 전용',
    desc: 'School 플랜은 초대된 클래스를 열람하는 관찰자 역할입니다.\n클래스 생성 및 AI 기능은 지원되지 않습니다.',
    freeLimit: '',
    proGain: '',
  },
};

const UpgradeModal = ({ isOpen, onClose, reason }: UpgradeModalProps) => {
  const config = REASON_CONFIG[reason];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-6 pt-8 pb-10 text-white text-center relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
              <div className="text-4xl mb-3">{config.emoji}</div>
              <h2 className="text-xl font-black mb-1">{config.title}</h2>
              <p className="text-sm text-white/80 whitespace-pre-line">{config.desc}</p>
            </div>

            {/* Plan Compare — school_block은 숨김 */}
            {reason !== 'school_block' && (
              <div className="px-6 -mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <GraduationCap size={14} className="text-gray-400" />
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Free</span>
                    </div>
                    <p className="text-sm font-bold text-gray-700">{config.freeLimit}</p>
                  </div>
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-center relative">
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      PRO
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <Crown size={14} className="text-amber-500" />
                      <span className="text-xs font-bold text-amber-600 uppercase tracking-wide">Pro</span>
                    </div>
                    <p className="text-sm font-black text-amber-800">{config.proGain}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Pro 기능 목록 — school_block은 숨김 */}
            {reason !== 'school_block' && (
              <div className="px-6 py-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Pro 플랜에서 가능한 것들</p>
                <div className="space-y-2">
                  {[
                    '클래스 무제한 생성',
                    'AI 세특 초안 무제한',
                    '학급 전체 일괄 AI 생성',
                    '교과 교사 연동 초대',
                    'NAISS 포맷 내보내기',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-gray-700">
                      <Sparkles size={13} className="text-amber-400 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="px-6 pb-6 space-y-2">
              {reason === 'school_block' ? (
                <button
                  onClick={onClose}
                  className="w-full py-3.5 bg-violet-500 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-violet-600 transition-all active:scale-95"
                >
                  확인
                </button>
              ) : (
                <a
                  href="mailto:mosebb@gmail.com?subject=생기로그 AI Pro 업그레이드 문의"
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-200 transition-all hover:scale-[1.02] active:scale-95"
                >
                  <Zap size={16} />
                  Pro 업그레이드 문의하기
                </a>
              )}
              <button
                onClick={onClose}
                className="w-full py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                {reason === 'school_block' ? '' : '나중에 하기'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default UpgradeModal;
