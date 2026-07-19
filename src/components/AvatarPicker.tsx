import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, Check, Loader2, X, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';

type StyleId = 'notionists' | 'adventurer';
type FieldKind = 'variant' | 'optionalVariant' | 'color';

interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  /** cycle-order option list. optionalVariant fields include 'none' as the first entry. */
  options: string[];
  /** only for optionalVariant fields */
  probabilityKey?: string;
}

interface StyleConfig {
  id: StyleId;
  label: string;
  fields: Field[];
  /** params always sent as-is (fixed body/pose, forced probabilities, etc.) */
  extraParams: Record<string, string>;
  attribution: string;
}

type Traits = Record<string, string>;

const randomSeed = () => Math.random().toString(36).substring(2, 10);

const rangeVariants = (n: number, prefix = 'variant') => Array.from({ length: n }, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`);

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const BG_COLORS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'c8f4c8', 'fdf1a3', 'f4c2c2', 'e0e0e0'];
const ADVENTURER_HAIR_COLORS = ['ac6511', 'cb6820', 'ab2a18', 'e5d7a3', 'b9a05f', '796a45', '6a4e35', '562306', '0e0e0e', 'afafaf', '3eac2c', '85c2c6', 'dba3be', '592454'];
const ADVENTURER_SKIN_COLORS = ['f2d3b1', 'ecad80', '9e5622', '763900'];

const STYLES: Record<StyleId, StyleConfig> = {
  notionists: {
    id: 'notionists',
    label: '노션 스타일',
    fields: [
      { key: 'hair', label: '헤어스타일', kind: 'variant', options: [...rangeVariants(63), 'hat'] },
      { key: 'brows', label: '눈썹', kind: 'variant', options: rangeVariants(13) },
      { key: 'eyes', label: '눈', kind: 'variant', options: rangeVariants(5) },
      { key: 'nose', label: '코', kind: 'variant', options: rangeVariants(20) },
      { key: 'lips', label: '입', kind: 'variant', options: rangeVariants(30) },
      { key: 'glasses', label: '안경', kind: 'optionalVariant', options: ['none', ...rangeVariants(11)], probabilityKey: 'glassesProbability' },
      { key: 'beard', label: '수염', kind: 'optionalVariant', options: ['none', ...rangeVariants(12)], probabilityKey: 'beardProbability' },
      { key: 'backgroundColor', label: '배경색', kind: 'color', options: BG_COLORS },
    ],
    extraParams: { 'body[]': 'variant01', gestureProbability: '0', bodyIconProbability: '0' },
    attribution: 'Avatars by Notionists (CC BY 4.0)',
  },
  adventurer: {
    id: 'adventurer',
    label: '어드벤처러 스타일',
    fields: [
      { key: 'hair', label: '헤어스타일', kind: 'variant', options: [...rangeVariants(19, 'short'), ...rangeVariants(26, 'long')] },
      { key: 'eyebrows', label: '눈썹', kind: 'variant', options: rangeVariants(15) },
      { key: 'eyes', label: '눈', kind: 'variant', options: rangeVariants(26) },
      { key: 'mouth', label: '입', kind: 'variant', options: rangeVariants(30) },
      { key: 'glasses', label: '안경', kind: 'optionalVariant', options: ['none', ...rangeVariants(5)], probabilityKey: 'glassesProbability' },
      { key: 'earrings', label: '귀걸이', kind: 'optionalVariant', options: ['none', ...rangeVariants(6)], probabilityKey: 'earringsProbability' },
      { key: 'features', label: '얼굴 특징', kind: 'optionalVariant', options: ['none', 'mustache', 'blush', 'birthmark', 'freckles'], probabilityKey: 'featuresProbability' },
      { key: 'hairColor', label: '헤어컬러', kind: 'color', options: ADVENTURER_HAIR_COLORS },
      { key: 'skinColor', label: '피부색', kind: 'color', options: ADVENTURER_SKIN_COLORS },
      { key: 'backgroundColor', label: '배경색', kind: 'color', options: BG_COLORS },
    ],
    extraParams: { hairProbability: '100' },
    attribution: 'Avatars by Adventurer (CC BY 4.0)',
  },
};

const STYLE_LIST = Object.values(STYLES);

const randomTraitsFor = (config: StyleConfig): Traits => {
  const traits: Traits = {};
  for (const f of config.fields) traits[f.key] = pick(f.options);
  return traits;
};

const buildAvatarUrl = (styleId: StyleId, seed: string, traits: Traits) => {
  const config = STYLES[styleId];
  const params = new URLSearchParams();
  params.set('seed', seed);
  for (const f of config.fields) {
    const val = traits[f.key];
    if (f.kind === 'color' || f.kind === 'variant') {
      params.append(`${f.key}[]`, val);
    } else if (f.kind === 'optionalVariant') {
      if (val === 'none') {
        params.set(f.probabilityKey!, '0');
      } else {
        params.append(`${f.key}[]`, val);
        params.set(f.probabilityKey!, '100');
      }
    }
  }
  for (const [k, v] of Object.entries(config.extraParams)) params.set(k, v);
  return `https://api.dicebear.com/9.x/${styleId}/svg?${params.toString()}`;
};

const parseAvatarUrl = (url: string): { styleId: StyleId; seed: string; traits: Traits } | null => {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('dicebear.com')) return null;
    const pathParts = u.pathname.split('/');
    const styleId = pathParts[2] as StyleId;
    const config = STYLES[styleId];
    if (!config) return null;
    const p = u.searchParams;
    const traits: Traits = {};
    for (const f of config.fields) {
      if (f.kind === 'optionalVariant') {
        traits[f.key] = p.get(f.probabilityKey!) === '100' ? (p.get(`${f.key}[]`) || 'none') : 'none';
      } else {
        traits[f.key] = p.get(`${f.key}[]`) || f.options[0];
      }
    }
    return { styleId, seed: p.get('seed') || randomSeed(), traits };
  } catch {
    return null;
  }
};

interface AvatarPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (avatarUrl: string) => Promise<void> | void;
  onSkip?: () => void;
  title?: string;
  description?: string;
  /** 이미 저장된 아바타가 있다면 그 스타일·트레잇에서부터 이어서 편집합니다. */
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
  const [styleId, setStyleId] = useState<StyleId>('notionists');
  const [seed, setSeed] = useState(randomSeed);
  const [traits, setTraits] = useState<Traits>(() => randomTraitsFor(STYLES.notionists));
  const [isSaving, setIsSaving] = useState(false);
  const [expandedTrait, setExpandedTrait] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setExpandedTrait(null);
    const parsed = currentAvatarUrl ? parseAvatarUrl(currentAvatarUrl) : null;
    if (parsed) {
      setStyleId(parsed.styleId);
      setSeed(parsed.seed);
      setTraits(parsed.traits);
    } else {
      setStyleId('notionists');
      setSeed(randomSeed());
      setTraits(randomTraitsFor(STYLES.notionists));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const config = STYLES[styleId];

  const handleStyleChange = (nextId: StyleId) => {
    if (isSaving || nextId === styleId) return;
    setStyleId(nextId);
    setSeed(randomSeed());
    setTraits(randomTraitsFor(STYLES[nextId]));
    setExpandedTrait(null);
  };

  const cycle = (key: string, options: string[], dir: 1 | -1) => {
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
    setTraits(randomTraitsFor(config));
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSelect(buildAvatarUrl(styleId, seed, traits));
    } finally {
      setIsSaving(false);
    }
  };

  const previewUrl = buildAvatarUrl(styleId, seed, traits);
  const activeRow = expandedTrait ? config.fields.find(f => f.key === expandedTrait) ?? null : null;
  const traitRows = config.fields.filter(f => f.kind !== 'color');
  const colorRows = config.fields.filter(f => f.kind === 'color');

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
            className="w-full max-w-xl lg:max-w-5xl max-h-[90vh] lg:max-h-[85vh] overflow-y-auto custom-scrollbar glass p-8 sm:p-10 lg:p-12 rounded-[2.5rem] relative shadow-2xl border border-white/20"
          >
            <button
              onClick={onClose}
              disabled={isSaving}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-surface-container transition-all disabled:opacity-40 z-10"
            >
              <X size={24} />
            </button>

            <div className="space-y-2 pr-8 mb-7">
              <h3 className="text-2xl lg:text-3xl font-black font-manrope">{title}</h3>
              <p className="text-sm lg:text-base font-bold text-on-surface-variant">{description}</p>
            </div>

            <div className="space-y-7 lg:space-y-0 lg:grid lg:grid-cols-[320px_1fr] lg:gap-10 lg:items-start">
            <div className="space-y-5">
            <div className="flex items-center gap-2 p-1 bg-surface-container-low rounded-2xl">
              {STYLE_LIST.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleStyleChange(s.id)}
                  disabled={isSaving}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all disabled:opacity-50 ${
                    styleId === s.id ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant/60 hover:text-on-surface-variant'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 lg:w-full lg:h-auto lg:aspect-square rounded-[2rem] bg-surface-container-low border-2 border-white/40 shadow-inner overflow-hidden">
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
            </div>

            <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {traitRows.map(({ key, label, options }) => {
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
                      <button
                        onClick={() => setExpandedTrait(prev => prev === key ? null : key)}
                        disabled={isSaving}
                        title="미리보고 고르기"
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-40 ${
                          expandedTrait === key ? 'bg-primary/15 text-primary' : 'hover:bg-white/70'
                        }`}
                      >
                        <LayoutGrid size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {activeRow && (
              <div className="rounded-2xl bg-surface-container-low p-3.5 space-y-2.5">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-black text-on-surface-variant">{activeRow.label} 미리보고 고르기</span>
                  <button onClick={() => setExpandedTrait(null)} className="text-on-surface-variant/50 hover:text-on-surface-variant transition-colors">
                    <X size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-7 lg:grid-cols-9 gap-2 max-h-56 lg:max-h-[26rem] overflow-y-auto custom-scrollbar pr-1">
                  {activeRow.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => {
                        if (isSaving) return;
                        setTraits(prev => ({ ...prev, [activeRow.key]: opt }));
                        setExpandedTrait(null);
                      }}
                      disabled={isSaving}
                      className={`aspect-square rounded-xl overflow-hidden border-2 transition-all disabled:opacity-40 ${
                        traits[activeRow.key] === opt ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-primary/30'
                      }`}
                    >
                      <img
                        src={buildAvatarUrl(styleId, seed, { ...traits, [activeRow.key]: opt })}
                        alt={opt === 'none' ? '없음' : opt}
                        loading="lazy"
                        className="w-full h-full object-cover bg-white"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {colorRows.map(({ key, label, options }) => (
              <div key={key} className="space-y-2">
                <span className="text-xs font-black text-on-surface-variant">{label}</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {options.map(color => (
                    <button
                      key={color}
                      onClick={() => !isSaving && setTraits(prev => ({ ...prev, [key]: color }))}
                      disabled={isSaving}
                      style={{ backgroundColor: `#${color}` }}
                      className={`w-8 h-8 rounded-full border-2 transition-all disabled:opacity-40 ${
                        traits[key] === color ? 'border-primary scale-110 shadow-md' : 'border-white/60'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
            </div>
            </div>

            <div className="flex items-center gap-3 pt-7">
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

            <p className="text-[10px] font-bold text-on-surface-variant/50 text-center mt-4">
              {config.attribution}
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AvatarPicker;
