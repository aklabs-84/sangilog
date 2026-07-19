import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, Check, Loader2, X } from 'lucide-react';

const DICEBEAR_STYLE = 'notionists';

const randomSeed = () => Math.random().toString(36).substring(2, 10);

const avatarUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/${DICEBEAR_STYLE}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

interface AvatarPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (avatarUrl: string) => Promise<void> | void;
  onSkip?: () => void;
  title?: string;
  description?: string;
}

const AvatarPicker = ({
  isOpen,
  onClose,
  onSelect,
  onSkip,
  title = '아바타 선택하기',
  description = '마음에 드는 아바타를 골라보세요. 언제든 다시 바꿀 수 있어요.',
}: AvatarPickerProps) => {
  const [seeds, setSeeds] = useState<string[]>(() => Array.from({ length: 9 }, randomSeed));
  const [savingSeed, setSavingSeed] = useState<string | null>(null);

  const handleShuffle = () => {
    if (savingSeed) return;
    setSeeds(Array.from({ length: 9 }, randomSeed));
  };

  const handlePick = async (seed: string) => {
    if (savingSeed) return;
    setSavingSeed(seed);
    try {
      await onSelect(avatarUrl(seed));
    } finally {
      setSavingSeed(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-xl"
          onClick={() => !savingSeed && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg glass p-10 rounded-[2.5rem] space-y-8 relative shadow-2xl border border-white/20"
          >
            <button
              onClick={onClose}
              disabled={!!savingSeed}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-surface-container transition-all disabled:opacity-40"
            >
              <X size={24} />
            </button>

            <div className="space-y-2 pr-8">
              <h3 className="text-2xl font-black font-manrope">{title}</h3>
              <p className="text-sm font-bold text-on-surface-variant">{description}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {seeds.map((seed) => {
                const isSaving = savingSeed === seed;
                return (
                  <button
                    key={seed}
                    onClick={() => handlePick(seed)}
                    disabled={!!savingSeed}
                    className="group relative aspect-square rounded-2xl bg-surface-container-low border-2 border-transparent hover:border-primary/60 transition-all overflow-hidden disabled:opacity-50"
                  >
                    <img src={avatarUrl(seed)} alt="아바타 후보" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors flex items-center justify-center">
                      {isSaving ? (
                        <Loader2 size={22} className="animate-spin text-primary" />
                      ) : (
                        <Check size={22} className="text-white opacity-0 group-hover:opacity-100 drop-shadow-lg transition-opacity" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleShuffle}
                disabled={!!savingSeed}
                className="flex-1 py-4 bg-surface-container hover:bg-surface-container-high rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Shuffle size={16} />
                다른 스타일 보기
              </button>
              {onSkip && (
                <button
                  onClick={onSkip}
                  disabled={!!savingSeed}
                  className="shrink-0 py-4 px-5 text-sm font-black text-on-surface-variant/60 hover:text-on-surface-variant transition-all disabled:opacity-50"
                >
                  나중에 설정할게요
                </button>
              )}
            </div>

            <p className="text-[10px] font-bold text-on-surface-variant/50 text-center">
              Avatars by Notionists (CC BY 4.0)
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AvatarPicker;
