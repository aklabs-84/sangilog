import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Play, Pause, Music, Volume2, VolumeX } from 'lucide-react';
import { parseVideoUrl, type GalleryItem } from '../../lib/gallery';

const IMAGE_DURATION_MS = 4000;
const DRIVE_VIDEO_DURATION_MS = 20000;
// 유튜브 IFrame API 로딩 실패 등 예외 상황에서 상영회가 멈추지 않도록 하는 안전장치
const YOUTUBE_FALLBACK_MS = 60000;

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;
function loadYoutubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise(resolve => {
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevReady?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

function extractYoutubeId(embedUrl: string): string | null {
  return embedUrl.match(/embed\/([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
}

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

function DirectVideoSlide({
  url,
  playing,
  onEnded,
}: {
  url: string;
  playing: boolean;
  onEnded: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (playing) ref.current?.play().catch(() => {});
    else ref.current?.pause();
  }, [playing]);

  return (
    <video
      ref={ref}
      src={url}
      autoPlay
      playsInline
      onEnded={onEnded}
      className="max-w-full max-h-[80vh] rounded-xl"
    />
  );
}

function YoutubeSlide({
  embedUrl,
  playing,
  onEnded,
}: {
  embedUrl: string;
  playing: boolean;
  onEnded: () => void;
}) {
  const elId = useMemo(() => `gallery-screening-yt-${Math.random().toString(36).slice(2)}`, [embedUrl]);
  const playerRef = useRef<any>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    let destroyed = false;
    let ended = false;
    const videoId = extractYoutubeId(embedUrl);
    if (!videoId) {
      onEndedRef.current();
      return;
    }

    const fallback = setTimeout(() => {
      if (!ended) onEndedRef.current();
    }, YOUTUBE_FALLBACK_MS);

    loadYoutubeApi().then(() => {
      if (destroyed) return;
      playerRef.current = new window.YT.Player(elId, {
        videoId,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.ENDED) {
              ended = true;
              onEndedRef.current();
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      clearTimeout(fallback);
      playerRef.current?.destroy?.();
    };
  }, [embedUrl, elId]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p?.playVideo) return;
    if (playing) p.playVideo();
    else p.pauseVideo();
  }, [playing]);

  return <div id={elId} className="w-[80vw] max-w-[900px] aspect-video rounded-xl overflow-hidden" />;
}

function DriveSlide({
  embedUrl,
  playing,
  onDone,
}: {
  embedUrl: string;
  playing: boolean;
  onDone: () => void;
}) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // 드라이브 미리보기(iframe)는 재생 종료를 감지할 API가 없어 고정 노출 시간 뒤 다음으로 넘어감
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => onDoneRef.current(), DRIVE_VIDEO_DURATION_MS);
    return () => clearTimeout(t);
  }, [playing, embedUrl]);

  return (
    <iframe
      src={embedUrl}
      className="w-[80vw] max-w-[900px] aspect-video rounded-xl"
      allow="autoplay; fullscreen; picture-in-picture"
    />
  );
}

function ScreeningMedia({
  item,
  playing,
  onMediaEnd,
}: {
  item: GalleryItem;
  playing: boolean;
  onMediaEnd: () => void;
}) {
  if (item.file_type === 'image') {
    return (
      <img
        src={item.file_url}
        alt={item.file_name ?? ''}
        className="max-w-full max-h-[85vh] rounded-xl object-contain"
      />
    );
  }

  const info = parseVideoUrl(item.file_url) ?? {
    platform: 'direct' as const,
    embedUrl: item.file_url,
    thumbnailUrl: null,
    label: '영상',
  };

  if (info.platform === 'direct') {
    return <DirectVideoSlide url={info.embedUrl} playing={playing} onEnded={onMediaEnd} />;
  }
  if (info.platform === 'youtube') {
    return <YoutubeSlide embedUrl={info.embedUrl} playing={playing} onEnded={onMediaEnd} />;
  }
  return <DriveSlide embedUrl={info.embedUrl} playing={playing} onDone={onMediaEnd} />;
}

interface GalleryScreeningProps {
  items: GalleryItem[];
  initialIndex: number;
  onClose: () => void;
}

// 갤러리 사진·영상을 전체화면 슬라이드쇼(+배경음악)로 자동 재생하는 "상영회" 모드
export default function GalleryScreening({ items, initialIndex, onClose }: GalleryScreeningProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), items.length - 1));
  const [playing, setPlaying] = useState(true);

  const [bgmName, setBgmName] = useState<string | null>(null);
  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const [bgmMuted, setBgmMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const bgmInputRef = useRef<HTMLInputElement>(null);

  const current = items[index];
  const isLast = index >= items.length - 1;
  const isImage = current?.file_type === 'image';

  const goNext = useCallback(() => {
    setIndex(i => {
      if (i >= items.length - 1) {
        setPlaying(false);
        return i;
      }
      return i + 1;
    });
  }, [items.length]);

  const goPrev = useCallback(() => {
    setIndex(i => Math.max(0, i - 1));
  }, []);

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

  // 사진 자동 넘김 (영상은 자체 종료 이벤트로 처리)
  useEffect(() => {
    if (!isImage || !playing) return;
    const t = setTimeout(goNext, IMAGE_DURATION_MS);
    return () => clearTimeout(t);
  }, [index, isImage, playing, goNext]);

  // BGM 재생/일시정지 — 영상 차례에는 페이드아웃 후 멈추고, 영상 소리로 전환
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !bgmUrl) return;
    if (playing && isImage) {
      audio.play().catch(() => {});
      fadeVolume(audio, bgmMuted ? 0 : 0.6, 400);
    } else {
      fadeVolume(audio, 0, 300, () => audio.pause());
    }
  }, [playing, isImage, bgmUrl, bgmMuted, index]);

  const handleBgmSelect = (file: File | null) => {
    if (!file) return;
    setBgmUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setBgmName(file.name);
  };

  useEffect(() => {
    return () => {
      if (bgmUrl) URL.revokeObjectURL(bgmUrl);
    };
  }, [bgmUrl]);

  if (!current) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] bg-black flex flex-col select-none">
      {bgmUrl && <audio ref={audioRef} src={bgmUrl} loop />}

      {/* 상단 바 */}
      <div className="flex items-center gap-3 px-5 py-4 text-white/80">
        <span className="text-xs font-bold tabular-nums">
          {index + 1} / {items.length}
        </span>
        {current.caption && <span className="text-sm text-white/60 truncate">{current.caption}</span>}

        <div className="ml-auto flex items-center gap-2">
          <input
            ref={bgmInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={e => handleBgmSelect(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={() => bgmInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-xs font-bold hover:bg-white/10 transition-colors"
          >
            <Music size={13} />
            {bgmName ? bgmName.slice(0, 18) : '배경음악 선택'}
          </button>
          {bgmUrl && (
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
            <ScreeningMedia item={current} playing={playing} onMediaEnd={goNext} />
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
        {isImage && (
          <div className="h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
            {playing && (
              <motion.div
                key={`${current.id}-${playing}`}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: IMAGE_DURATION_MS / 1000, ease: 'linear' }}
                className="h-full bg-white/70"
              />
            )}
          </div>
        )}
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
