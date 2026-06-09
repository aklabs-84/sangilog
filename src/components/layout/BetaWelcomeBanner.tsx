import { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth, getBetaDaysLeft } from '../../lib/auth';

const BetaWelcomeBanner = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!profile?.beta_expires_at) return;
    const days = getBetaDaysLeft(profile);
    if (!days || days <= 0) return;

    const key = `beta_welcome_shown_${profile.beta_expires_at}`;
    if (localStorage.getItem(key)) return;

    setDaysLeft(days);
    setVisible(true);
  }, [profile?.beta_expires_at]);

  const dismiss = () => {
    if (profile?.beta_expires_at) {
      localStorage.setItem(`beta_welcome_shown_${profile.beta_expires_at}`, '1');
    }
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
          className="mx-4 md:mx-8 mt-3 mb-0 rounded-2xl overflow-hidden shadow-lg"
        >
          <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex items-center gap-3 min-w-0">
              <Sparkles size={18} className="shrink-0 text-yellow-300" />
              <p className="text-sm font-bold truncate">
                🎉 Pro 체험이 시작되었습니다!&nbsp;
                <span className="font-normal opacity-90">
                  {daysLeft}일 동안 모든 Pro 기능을 자유롭게 사용해 보세요.
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => { dismiss(); navigate('/settings'); }}
                className="text-xs font-black bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                설정 보기
              </button>
              <button
                onClick={dismiss}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="닫기"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BetaWelcomeBanner;
