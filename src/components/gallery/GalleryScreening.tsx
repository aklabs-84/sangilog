import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Play, Pause, Music, Volume2, VolumeX, HardDrive, Clock, Check } from 'lucide-react';
import { parseVideoUrl, type GalleryItem } from '../../lib/gallery';

const DRIVE_VIDEO_DURATION_MS = 5000;
// 유튜브 IFrame API 로딩 실패 등 예외 상황에서 상영회가 멈추지 않도록 하는 안전장치
const YOUTUBE_FALLBACK_MS = 60000;

const BGM_TRACKS = [
  { id: 'bgm-1', name: '고독한 미식가 OST', url: '/bgm/bgm-1.mp3' },
  { id: 'bgm-2', name: '고독한 미식가 OST 2', url: '/bgm/bgm-2.mp3' },
  { id: 'bgm-3', name: '고독한 미식가 OST 3', url: '/bgm/bgm-3.mp3' },
  { id: 'bgm-4', name: '고독한 미식가 OST 4', url: '/bgm/bgm-4.mp3' },
] as const;

const IMAGE_DURATION_OPTIONS = [2, 3, 4, 5, 7, 10] as const;

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
  muted,
  onEnded,
  onAutoplayBlocked,
  onUnmute,
}: {
  url: string;
  playing: boolean;
  muted: boolean;
  onEnded: () => void;
  onAutoplayBlocked: () => void;
  onUnmute: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!playing) {
      video.pause();
      return;
    }
    // 소리 있는 자동재생이 브라우저 정책에 막히면 음소거로 전환해서라도 재생을 이어감
    video.play().catch(() => {
      if (!video.muted) {
        video.muted = true;
        onAutoplayBlocked();
        video.play().catch(() => {});
      }
    });
  }, [playing, muted]);

  return (
    <div className="relative flex items-center justify-center">
      <video
        ref={ref}
        src={url}
        muted={muted}
        playsInline
        onEnded={onEnded}
        className="max-w-full max-h-[80vh] rounded-xl"
      />
      {muted && (
        <button
          onClick={() => {
            if (ref.current) ref.current.muted = false;
            onUnmute();
          }}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-bold hover:bg-black/80 transition-colors"
        >
          <VolumeX size={14} />
          눌러서 소리 켜기
        </button>
      )}
    </div>
  );
}

function YoutubeSlide({
  embedUrl,
  playing,
  muted,
  onEnded,
  onAutoplayBlocked,
  onUnmute,
}: {
  embedUrl: string;
  playing: boolean;
  muted: boolean;
  onEnded: () => void;
  onAutoplayBlocked: () => void;
  onUnmute: () => void;
}) {
  const elId = useMemo(() => `gallery-screening-yt-${Math.random().toString(36).slice(2)}`, [embedUrl]);
  const playerRef = useRef<any>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onAutoplayBlockedRef = useRef(onAutoplayBlocked);
  onAutoplayBlockedRef.current = onAutoplayBlocked;

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
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, mute: muted ? 1 : 0 },
        events: {
          onReady: () => {
            // 소리 켠 채로 자동재생을 시도했는데 유튜브 자체 정책으로 재생이 시작되지 않으면 음소거로 폴백
            setTimeout(() => {
              const p = playerRef.current;
              if (!destroyed && !muted && p?.getPlayerState?.() !== window.YT.PlayerState.PLAYING) {
                p?.mute?.();
                p?.playVideo?.();
                onAutoplayBlockedRef.current();
              }
            }, 1200);
          },
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

  return (
    <div className="relative">
      <div id={elId} className="w-[80vw] max-w-[900px] aspect-video rounded-xl overflow-hidden" />
      {muted && (
        <button
          onClick={() => {
            playerRef.current?.unMute?.();
            onUnmute();
          }}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-bold hover:bg-black/80 transition-colors"
        >
          <VolumeX size={14} />
          눌러서 소리 켜기
        </button>
      )}
    </div>
  );
}

function DriveSlide({
  embedUrl,
  fileName,
  playing,
  onDone,
}: {
  embedUrl: string;
  fileName: string | null;
  playing: boolean;
  onDone: () => void;
}) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // 구글 드라이브 미리보기는 크로스오리진 iframe이라 JS로 자동재생을 걸 수 없음
  // (재생하려면 드라이브 자체 UI를 사용자가 직접 클릭해야 함) → 안내만 보여주고 빠르게 다음으로 넘어감
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => onDoneRef.current(), DRIVE_VIDEO_DURATION_MS);
    return () => clearTimeout(t);
  }, [playing, embedUrl]);

  return (
    <div className="w-[80vw] max-w-[900px] aspect-video rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-3 text-white/70 px-6 text-center">
      <HardDrive size={32} className="opacity-60" />
      <p className="text-sm font-bold truncate max-w-full">{fileName || '구글 드라이브 영상'}</p>
      <p className="text-xs text-white/40">자동재생을 지원하지 않아 건너뜁니다</p>
      <a
        href={embedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors"
      >
        새 탭에서 보기
      </a>
    </div>
  );
}

function ScreeningMedia({
  item,
  playing,
  videoMuted,
  onMediaEnd,
  onAutoplayBlocked,
  onUnmute,
}: {
  item: GalleryItem;
  playing: boolean;
  videoMuted: boolean;
  onMediaEnd: () => void;
  onAutoplayBlocked: () => void;
  onUnmute: () => void;
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
    return (
      <DirectVideoSlide
        url={info.embedUrl}
        playing={playing}
        muted={videoMuted}
        onEnded={onMediaEnd}
        onAutoplayBlocked={onAutoplayBlocked}
        onUnmute={onUnmute}
      />
    );
  }
  if (info.platform === 'youtube') {
    return (
      <YoutubeSlide
        embedUrl={info.embedUrl}
        playing={playing}
        muted={videoMuted}
        onEnded={onMediaEnd}
        onAutoplayBlocked={onAutoplayBlocked}
        onUnmute={onUnmute}
      />
    );
  }
  return <DriveSlide embedUrl={info.embedUrl} fileName={item.file_name} playing={playing} onDone={onMediaEnd} />;
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
  // 소리 있는 영상 자동재생이 브라우저 정책에 막히면 true로 전환해 음소거 재생으로 폴백
  const [videoMuted, setVideoMuted] = useState(false);

  const [bgmTrackId, setBgmTrackId] = useState<string | null>(null);
  const [bgmMuted, setBgmMuted] = useState(false);
  const [bgmMenuOpen, setBgmMenuOpen] = useState(false);
  const [durationMenuOpen, setDurationMenuOpen] = useState(false);
  const [imageDurationSec, setImageDurationSec] = useState<number>(4);
  const audioRef = useRef<HTMLAudioElement>(null);

  const bgmTrack = BGM_TRACKS.find(t => t.id === bgmTrackId) ?? null;
  const imageDurationMs = imageDurationSec * 1000;

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
    const t = setTimeout(goNext, imageDurationMs);
    return () => clearTimeout(t);
  }, [index, isImage, playing, goNext, imageDurationMs]);

  // BGM 재생/일시정지 — 영상 차례에는 페이드아웃 후 멈추고, 영상 소리로 전환
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !bgmTrack) return;
    if (playing && isImage) {
      audio.play().catch(() => {});
      fadeVolume(audio, bgmMuted ? 0 : 0.6, 400);
    } else {
      fadeVolume(audio, 0, 300, () => audio.pause());
    }
  }, [playing, isImage, bgmTrack, bgmMuted, index]);

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
          {index + 1} / {items.length}
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
            <ScreeningMedia
              item={current}
              playing={playing}
              videoMuted={videoMuted}
              onMediaEnd={goNext}
              onAutoplayBlocked={() => setVideoMuted(true)}
              onUnmute={() => setVideoMuted(false)}
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
        {isImage && (
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
