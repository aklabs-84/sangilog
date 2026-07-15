import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Play, Pause, Music, Volume2, VolumeX, Clock, Check } from 'lucide-react';
import type { GalleryItem } from '../../lib/gallery';

const BGM_TRACKS = [
  { id: 'bgm-1', name: '고독한 미식가 OST', url: '/bgm/bgm-1.mp3' },
  { id: 'bgm-2', name: '고독한 미식가 OST 2', url: '/bgm/bgm-2.mp3' },
  { id: 'bgm-3', name: '고독한 미식가 OST 3', url: '/bgm/bgm-3.mp3' },
  { id: 'bgm-4', name: '고독한 미식가 OST 4', url: '/bgm/bgm-4.mp3' },
] as const;

const IMAGE_DURATION_OPTIONS = [2, 3, 4, 5, 7, 10] as const;

function fadeVolume(audio: HTMLAudioElement, to: number, durationMs: number, onDone?: () => void) {
  const from = audio.volume;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    audio.volume = from + (to - from) * t;
    if (t < 1) requestAnimationFrame(step);
    else onDone?.();
  };
  requestAnimationFrame(step);
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

interface GalleryScreeningProps {
  items: GalleryItem[];
  initialIndex: number;
  onClose: () => void;
}

// 갤러리 사진을 전체화면 슬라이드쇼(+배경음악)로 자동 재생하는 "상영회" 모드 (영상 제외, 랜덤 순서)
export default function GalleryScreening({ items, initialIndex, onClose }: GalleryScreeningProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 선택해서 들어온 사진을 맨 앞에 두고, 나머지 사진들은 랜덤 순서로 섞음
  const [slides] = useState(() => {
    const images = items.filter(i => i.file_type === 'image');
    const selected = items[initialIndex];
    if (selected?.file_type === 'image') {
      return [selected, ...shuffle(images.filter(i => i.id !== selected.id))];
    }
    return shuffle(images);
  });

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  const [bgmTrackId, setBgmTrackId] = useState<string | null>(null);
  const [bgmMuted, setBgmMuted] = useState(false);
  const [bgmMenuOpen, setBgmMenuOpen] = useState(false);
  const [durationMenuOpen, setDurationMenuOpen] = useState(false);
  const [imageDurationSec, setImageDurationSec] = useState<number>(4);
  const audioRef = useRef<HTMLAudioElement>(null);

  const bgmTrack = BGM_TRACKS.find(t => t.id === bgmTrackId) ?? null;
  const imageDurationMs = imageDurationSec * 1000;

  const current = slides[index];
  const isLast = index >= slides.length - 1;

  const goNext = useCallback(() => {
    if (index >= slides.length - 1) {
      onClose();
      return;
    }
    setIndex(i => i + 1);
  }, [index, slides.length, onClose]);

  const goPrev = useCallback(() => {
    setIndex(i => Math.max(0, i - 1));
  }, []);

  // 보여줄 사진이 하나도 없으면 바로 종료
  useEffect(() => {
    if (slides.length === 0) onClose();
  }, [slides.length, onClose]);

  // 전체화면 진입/해제
  useEffect(() => {
    containerRef.current?.requestFullscreen?.().catch(() => {});
    const handleFsChange = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 키보드 단축키
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === ' ') {
        e.preventDefault();
        setPlaying(p => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, goNext, goPrev]);

  // 사진 자동 넘김
  useEffect(() => {
    if (!playing || !current) return;
    const t = setTimeout(goNext, imageDurationMs);
    return () => clearTimeout(t);
  }, [index, playing, current, goNext, imageDurationMs]);

  // BGM 재생/일시정지
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !bgmTrack) return;
    if (playing) {
      audio.play().catch(() => {});
      fadeVolume(audio, bgmMuted ? 0 : 0.6, 400);
    } else {
      fadeVolume(audio, 0, 300, () => audio.pause());
    }
  }, [playing, bgmTrack, bgmMuted]);

  if (!current) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] bg-black flex flex-col select-none">
      {bgmTrack && <audio ref={audioRef} src={bgmTrack.url} loop />}

      {(bgmMenuOpen || durationMenuOpen) && (
        <div
          className="fixed inset-0 z-[5]"
          onClick={() => {
            setBgmMenuOpen(false);
            setDurationMenuOpen(false);
          }}
        />
      )}

      {/* 상단 바 */}
      <div className="relative z-10 flex items-center gap-3 px-5 py-4 text-white/80">
        <span className="text-xs font-bold tabular-nums">
          {index + 1} / {slides.length}
        </span>
        {current.caption && <span className="text-sm text-white/60 truncate">{current.caption}</span>}

        <div className="ml-auto flex items-center gap-2">
          {/* 이미지 유지 시간 설정 */}
          <div className="relative">
            <button
              onClick={() => {
                setDurationMenuOpen(o => !o);
                setBgmMenuOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-xs font-bold hover:bg-white/10 transition-colors"
            >
              <Clock size={13} />
              {imageDurationSec}초
            </button>
            {durationMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-32 rounded-lg bg-neutral-900 border border-white/15 shadow-xl overflow-hidden z-10">
                {IMAGE_DURATION_OPTIONS.map(sec => (
                  <button
                    key={sec}
                    onClick={() => {
                      setImageDurationSec(sec);
                      setDurationMenuOpen(false);
                    }}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs text-left text-white/80 hover:bg-white/10 transition-colors"
                  >
                    {sec}초
                    {sec === imageDurationSec && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 배경음악 선택 */}
          <div className="relative">
            <button
              onClick={() => {
                setBgmMenuOpen(o => !o);
                setDurationMenuOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-xs font-bold hover:bg-white/10 transition-colors"
            >
              <Music size={13} />
              {bgmTrack ? bgmTrack.name.slice(0, 14) : '배경음악 선택'}
            </button>
            {bgmMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-lg bg-neutral-900 border border-white/15 shadow-xl overflow-hidden z-10">
                <button
                  onClick={() => {
                    setBgmTrackId(null);
                    setBgmMenuOpen(false);
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs text-left text-white/80 hover:bg-white/10 transition-colors"
                >
                  선택 안함
                  {!bgmTrack && <Check size={13} />}
                </button>
                <div className="h-px bg-white/10" />
                {BGM_TRACKS.map(track => (
                  <button
                    key={track.id}
                    onClick={() => {
                      setBgmTrackId(track.id);
                      setBgmMenuOpen(false);
                    }}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs text-left text-white/80 hover:bg-white/10 transition-colors"
                  >
                    <span className="truncate">{track.name}</span>
                    {bgmTrack?.id === track.id && <Check size={13} className="shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {bgmTrack && (
            <button
              onClick={() => setBgmMuted(m => !m)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              {bgmMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 슬라이드 영역 */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center"
          >
            <img
              src={current.file_url}
              alt={current.file_name ?? ''}
              className="max-w-full max-h-[85vh] rounded-xl object-contain"
            />
          </motion.div>
        </AnimatePresence>

        {index > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
          >
            <ChevronLeft size={40} />
          </button>
        )}
        {!isLast && (
          <button
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
          >
            <ChevronRight size={40} />
          </button>
        )}
      </div>

      {/* 하단 컨트롤 */}
      <div className="flex flex-col gap-2 px-5 pb-5">
        <div className="h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
          {playing && (
            <motion.div
              key={`${current.id}-${playing}`}
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: imageDurationSec, ease: 'linear' }}
              className="h-full bg-white/70"
            />
          )}
        </div>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPlaying(p => !p)}
            className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
