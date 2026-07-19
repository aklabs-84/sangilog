import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, Check, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react';

const DICEBEAR_STYLE = 'notionists';

const randomSeed = () => Math.random().toString(36).substring(2, 10);

const rangeVariants = (n: number) => Array.from({ length: n }, (_, i) => `variant${String(i + 1).padStart(2, '0')}`);

const HAIR_OPTIONS = [...rangeVariants(63), 'hat'];
const BROWS_OPTIONS = rangeVariants(13);
const EYES_OPTIONS = rangeVariants(5);
const NOSE_OPTIONS = rangeVariants(20);
const LIPS_OPTIONS = rangeVariants(30);
const GLASSES_OPTIONS = ['none', ...rangeVariants(11)];
const BEARD_OPTIONS = ['none', ...rangeVariants(12)];
const BG_COLORS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'c8f4c8', 'fdf1a3', 'f4c2c2', 'e0e0e0'];

interface Traits {
  hair: string;
  brows: string;
  eyes: string;
  nose: string;
  lips: string;
  glasses: string;
  beard: string;
  backgroundColor: string;
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const randomTraits = (): Traits => ({
  hair: pick(HAIR_OPTIONS),
  brows: pick(BROWS_OPTIONS),
  eyes: pick(EYES_OPTIONS),
  nose: pick(NOSE_OPTIONS),
  lips: pick(LIPS_OPTIONS),
  glasses: pick(GLASSES_OPTIONS),
  beard: pick(BEARD_OPTIONS),
  backgroundColor: pick(BG_COLORS),
});

const buildAvatarUrl = (seed: string, t: Traits) => {
  const params = new URLSearchParams();
  params.set('seed', seed);
  params.append('hair[]', t.hair);
  params.append('brows[]', t.brows);
  params.append('eyes[]', t.eyes);
  params.append('nose[]', t.nose);
  params.append('lips[]', t.lips);
  params.append('backgroundColor[]', t.backgroundColor);
  params.append('body[]', 'variant01');
  params.set('gestureProbability', '0');
  params.set('bodyIconProbability', '0');
  if (t.glasses === 'none') {
    params.set('glassesProbability', '0');
  } else {
    params.append('glasses[]', t.glasses);
    params.set('glassesProbability', '100');
  }
  if (t.beard === 'none') {
    params.set('beardProbability', '0');
  } else {
    params.append('beard[]', t.beard);
    params.set('beardProbability', '100');
  }
  return `https://api.dicebear.com/9.x/${DICEBEAR_STYLE}/svg?${params.toString()}`;
};

const parseAvatarUrl = (url: string): { seed: string; traits: Traits } | null => {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('dicebear.com')) return null;
    const p = u.searchParams;
    const hair = p.get('hair[]');
    if (!hair) return null;
    return {
      seed: p.get('seed') || randomSeed(),
      traits: {
        hair,
        brows: p.get('brows[]') || BROWS_OPTIONS[0],
        eyes: p.get('eyes[]') || EYES_OPTIONS[0],
        nose: p.get('nose[]') || NOSE_OPTIONS[0],
        lips: p.get('lips[]') || LIPS_OPTIONS[0],
        backgroundColor: p.get('backgroundColor[]') || BG_COLORS[0],
        glasses: p.get('glassesProbability') === '100' ? (p.get('glasses[]') || 'none') : 'none',
        beard: p.get('beardProbability') === '100' ? (p.get('beard[]') || 'none') : 'none',
      },
    };
  } catch {
    return null;
  }
};

const TRAIT_ROWS: { key: keyof Traits; label: string; options: string[] }[] = [
  { key: 'hair', label: '헤어스타일', options: HAIR_OPTIONS },
  { key: 'brows', label: '눈썹', options: BROWS_OPTIONS },
  { key: 'eyes', label: '눈', options: EYES_OPTIONS },
  { key: 'nose', label: '코', options: NOSE_OPTIONS },
  { key: 'lips', label: '입', options: LIPS_OPTIONS },
  { key: 'glasses', label: '안경', options: GLASSES_OPTIONS },
  { key: 'beard', label: '수염', options: BEARD_OPTIONS },
];

interface AvatarPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (avatarUrl: string) => Promise<void> | void;
  onSkip?: () => void;
  title?: string;
  description?: string;
  /** 이미 저장된 아바타가 있다면 그 트레잇에서부터 이어서 편집합니다. */
  currentAvatarUrl?: string | null;
}

const AvatarPicker = ({
  isOpen,
  onClose,
  onSelect,
  onSkip,
  title = '아바타 선택하기',
  description = '헤어, 눈, 입, 안경까지 세세하게 골라 나만의 아바타를 만들어보세요.',
  currentAvatarUrl,
}: AvatarPickerProps) => {
  const [seed, setSeed] = useState(randomSeed);
  const [traits, setTraits] = useState<Traits>(randomTraits);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const parsed = currentAvatarUrl ? parseAvatarUrl(currentAvatarUrl) : null;
    if (parsed) {
      setSeed(parsed.seed);
      setTraits(parsed.traits);
    } else {
      setSeed(randomSeed());
      setTraits(randomTraits());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const cycle = (key: keyof Traits, options: string[], dir: 1 | -1) => {
    if (isSaving) return;
    setTraits(prev => {
      const idx = options.indexOf(prev[key]);
      const nextIdx = (idx + dir + options.length) % options.length;
      return { ...prev, [key]: options[nextIdx] };
    });
  };

  const handleShuffleAll = () => {
    if (isSaving) return;
    setSeed(randomSeed());
    setTraits(randomTraits());
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSelect(buildAvatarUrl(seed, traits));
    } finally {
      setIsSaving(false);
    }
  };

  const previewUrl = buildAvatarUrl(seed, traits);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-xl"
          onClick={() => !isSaving && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar glass p-8 sm:p-10 rounded-[2.5rem] space-y-7 relative shadow-2xl border border-white/20"
          >
            <button
              onClick={onClose}
              disabled={isSaving}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-surface-container transition-all disabled:opacity-40"
            >
              <X size={24} />
            </button>

            <div className="space-y-2 pr-8">
              <h3 className="text-2xl font-black font-manrope">{title}</h3>
              <p className="text-sm font-bold text-on-surface-variant">{description}</p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-[2rem] bg-surface-container-low border-2 border-white/40 shadow-inner overflow-hidden">
                <img src={previewUrl} alt="아바타 미리보기" className="w-full h-full object-cover" />
              </div>
              <button
                onClick={handleShuffleAll}
                disabled={isSaving}
                className="py-2.5 px-5 bg-surface-container hover:bg-surface-container-high rounded-full font-black text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Shuffle size={14} />
                전체 랜덤으로 섞기
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TRAIT_ROWS.map(({ key, label, options }) => {
                const idx = options.indexOf(traits[key]);
                const displayLabel = traits[key] === 'none' ? '없음' : `${idx + 1} / ${options.length}`;
                return (
                  <div key={key} className="flex items-center justify-between bg-surface-container-low rounded-2xl pl-4 pr-1.5 py-1.5">
                    <span className="text-xs font-black text-on-surface-variant">{label}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => cycle(key, options, -1)}
                        disabled={isSaving}
                        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/70 transition-all disabled:opacity-40"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-[11px] font-bold text-on-surface-variant/70 w-14 text-center tabular-nums">{displayLabel}</span>
                      <button
                        onClick={() => cycle(key, options, 1)}
                        disabled={isSaving}
                        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/70 transition-all disabled:opacity-40"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black text-on-surface-variant">배경색</span>
              <div className="flex items-center gap-2 flex-wrap">
                {BG_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => !isSaving && setTraits(prev => ({ ...prev, backgroundColor: color }))}
                    disabled={isSaving}
                    style={{ backgroundColor: `#${color}` }}
                    className={`w-8 h-8 rounded-full border-2 transition-all disabled:opacity-40 ${
                      traits.backgroundColor === color ? 'border-primary scale-110 shadow-md' : 'border-white/60'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-4 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                이 아바타로 저장하기
              </button>
              {onSkip && (
                <button
                  onClick={onSkip}
                  disabled={isSaving}
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
