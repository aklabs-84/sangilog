import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Images, Upload, X, ChevronLeft, ChevronRight, Trash2,
  Play, Crown, AlertCircle, Loader2, ImageOff, Plus, Check, BadgeCheck
} from 'lucide-react';
import { useAuth, checkIsPro } from '../lib/auth';
import { supabase } from '../lib/supabase';
import {
  fetchGalleryItems, uploadGalleryItem, deleteGalleryItem, countGalleryItems,
  type GalleryItem
} from '../lib/gallery';

const FREE_IMAGE_LIMIT = 100;
const VIDEO_MAX_BYTES = 500 * 1024 * 1024; // 500MB

interface Class {
  id: string;
  name: string;
  weekly_plan?: { week: number; topic: string }[];
}

export default function Gallery() {
  const { user, profile } = useAuth();
  const isPro = checkIsPro(profile);

  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // 클래스 목록 로드
  useEffect(() => {
    if (!user) return;
    supabase
      .from('classes')
      .select('id, name, weekly_plan')
      .eq('teacher_id', user.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = data ?? [];
        setClasses(list);
        if (list.length > 0) setSelectedClassId(list[0].id);
      });
  }, [user]);

  // 전체 업로드 카운트 (무료 제한용)
  useEffect(() => {
    if (!user || isPro) return;
    countGalleryItems(user.id).then(setTotalCount);
  }, [user, isPro, items]);

  // 갤러리 아이템 로드
  useEffect(() => {
    if (!user || !selectedClassId) { setItems([]); return; }
    setLoading(true);
    setError(null);
    fetchGalleryItems(user.id, selectedClassId, selectedWeek)
      .then(setItems)
      .catch(() => setError('갤러리를 불러오는데 실패했습니다.'))
      .finally(() => setLoading(false));
  }, [user, selectedClassId, selectedWeek]);

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const totalWeeks = selectedClass?.weekly_plan?.length ?? 0;

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !user || !selectedClassId) return;
      setError(null);

      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (!isImage && !isVideo) {
          setError('이미지 또는 영상 파일만 업로드할 수 있습니다.');
          continue;
        }
        if (isVideo && !isPro) {
          setError('영상 업로드는 PRO 플랜 전용입니다.');
          continue;
        }
        if (isVideo && file.size > VIDEO_MAX_BYTES) {
          setError('영상 파일은 최대 500MB까지 업로드할 수 있습니다.');
          continue;
        }
        if (!isPro && totalCount >= FREE_IMAGE_LIMIT) {
          setError(`무료 플랜은 전체 ${FREE_IMAGE_LIMIT}장까지 업로드할 수 있습니다. PRO로 업그레이드하세요.`);
          break;
        }

        setUploading(true);
        setUploadProgress(0);

        // 진행 표시용 인터벌 (Storage는 진행률 콜백 없음 → 가짜 진행률)
        const interval = setInterval(() => {
          setUploadProgress(p => Math.min(p + 10, 85));
        }, 300);

        try {
          const item = await uploadGalleryItem(user.id, selectedClassId, selectedWeek, file);
          setItems(prev => [item, ...prev]);
          setTotalCount(c => c + 1);
        } catch (e: any) {
          setError(e?.message ?? '업로드에 실패했습니다.');
        } finally {
          clearInterval(interval);
          setUploadProgress(100);
          setTimeout(() => { setUploading(false); setUploadProgress(0); }, 400);
        }
      }
    },
    [user, selectedClassId, selectedWeek, isPro, totalCount]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDelete = async (id: string, fileUrl: string) => {
    try {
      await deleteGalleryItem(id, fileUrl);
      setItems(prev => prev.filter(i => i.id !== id));
      setTotalCount(c => c - 1);
      if (lightboxIndex !== null) setLightboxIndex(null);
    } catch {
      setError('삭제에 실패했습니다.');
    } finally {
      setDeleteTarget(null);
    }
  };

  const lightboxItem = lightboxIndex !== null ? items[lightboxIndex] : null;

  return (
    <div className="min-h-screen p-6 font-manrope">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center text-white shadow-md shadow-primary/20">
            <Images size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black text-on-surface tracking-tightest">수업 갤러리</h1>
            <p className="text-xs text-on-surface-variant font-medium">수업 장면 사진·영상을 클래스별로 기록합니다</p>
          </div>
        </div>
        {!isPro && (
          <div className="text-xs text-on-surface-variant bg-surface-container-low rounded-xl px-3 py-2 border border-on-surface/5">
            <span className="font-bold text-primary">{totalCount}</span>
            <span> / {FREE_IMAGE_LIMIT}장 사용</span>
          </div>
        )}
      </div>

      {/* 플랜 안내 카드 */}
      <PlanGuide isPro={isPro} totalCount={totalCount} />

      {/* 필터 바 */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {/* 클래스 선택 */}
        <select
          value={selectedClassId}
          onChange={e => { setSelectedClassId(e.target.value); setSelectedWeek(null); }}
          className="px-4 py-2.5 rounded-xl border border-on-surface/10 bg-white text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px]"
        >
          <option value="">클래스 선택</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* 주차 필터 */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedWeek(null)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              selectedWeek === null
                ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                : 'border-on-surface/10 text-on-surface-variant hover:bg-white hover:text-on-surface'
            }`}
          >
            전체
          </button>
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => (
            <button
              key={w}
              onClick={() => setSelectedWeek(w)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                selectedWeek === w
                  ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                  : 'border-on-surface/10 text-on-surface-variant hover:bg-white hover:text-on-surface'
              }`}
            >
              {w}주차
            </button>
          ))}
        </div>

        {/* 업로드 버튼 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !selectedClassId}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-primary/20 active:scale-95"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {uploading ? `업로드 중 ${uploadProgress}%` : '사진·영상 추가'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* 에러 메시지 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 mb-4 px-4 py-3 bg-error/5 border border-error/20 rounded-xl text-sm text-error font-medium"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 드롭존 + 그리드 */}
      <div
        ref={dropZoneRef}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="min-h-[400px]"
      >
        {!selectedClassId ? (
          <EmptyState icon={<Images size={40} />} message="클래스를 선택해 갤러리를 확인하세요" />
        ) : loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={32} className="animate-spin text-primary/40" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ImageOff size={40} />}
            message="아직 업로드된 사진·영상이 없습니다"
            sub="위 버튼이나 이 영역에 파일을 드래그해서 추가하세요"
            onUpload={() => fileInputRef.current?.click()}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {items.map((item, idx) => (
              <GalleryCard
                key={item.id}
                item={item}
                onClick={() => setLightboxIndex(idx)}
                onDelete={() => setDeleteTarget(item.id)}
              />
            ))}
          </div>
        )}
      </div>


      {/* 삭제 확인 모달 */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4"
            >
              <h3 className="font-black text-on-surface mb-2">파일을 삭제할까요?</h3>
              <p className="text-sm text-on-surface-variant mb-5">삭제한 파일은 복구할 수 없습니다.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-on-surface/10 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    const target = items.find(i => i.id === deleteTarget);
                    if (target) handleDelete(target.id, target.file_url);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-bold hover:bg-error/90"
                >
                  삭제
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 라이트박스 */}
      <AnimatePresence>
        {lightboxItem !== null && lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            onClick={() => setLightboxIndex(null)}
          >
            {/* 닫기 */}
            <button
              className="absolute top-4 right-4 text-white/70 hover:text-white"
              onClick={() => setLightboxIndex(null)}
            >
              <X size={28} />
            </button>

            {/* 삭제 */}
            <button
              className="absolute top-4 left-4 text-white/70 hover:text-error"
              onClick={e => { e.stopPropagation(); setDeleteTarget(lightboxItem.id); }}
            >
              <Trash2 size={22} />
            </button>

            {/* 이전/다음 */}
            {lightboxIndex > 0 && (
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                onClick={e => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              >
                <ChevronLeft size={40} />
              </button>
            )}
            {lightboxIndex < items.length - 1 && (
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                onClick={e => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              >
                <ChevronRight size={40} />
              </button>
            )}

            {/* 미디어 */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="max-w-[90vw] max-h-[85vh] flex flex-col items-center gap-3"
              onClick={e => e.stopPropagation()}
            >
              {lightboxItem.file_type === 'image' ? (
                <img
                  src={lightboxItem.file_url}
                  alt={lightboxItem.file_name ?? ''}
                  className="max-w-full max-h-[80vh] rounded-xl object-contain"
                />
              ) : (
                <video
                  src={lightboxItem.file_url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[80vh] rounded-xl"
                />
              )}
              {lightboxItem.caption && (
                <p className="text-white/80 text-sm font-medium">{lightboxItem.caption}</p>
              )}
              <p className="text-white/40 text-xs">
                {lightboxIndex + 1} / {items.length}
                {lightboxItem.week_number != null && ` · ${lightboxItem.week_number}주차`}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 갤러리 카드
function GalleryCard({
  item,
  onClick,
  onDelete,
}: {
  item: GalleryItem;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative aspect-square rounded-2xl overflow-hidden bg-surface-container-low border border-on-surface/5 cursor-pointer hover:shadow-lg transition-all duration-200"
      onClick={onClick}
    >
      {item.file_type === 'image' ? (
        <img
          src={item.file_url}
          alt={item.file_name ?? ''}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="relative w-full h-full bg-black/80">
          <video
            src={item.file_url}
            className="w-full h-full object-cover opacity-70"
            muted
            preload="metadata"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Play size={18} className="text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>
      )}

      {/* 호버 오버레이 */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200" />

      {/* 삭제 버튼 */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-error"
      >
        <Trash2 size={12} />
      </button>

      {/* 주차 배지 */}
      {item.week_number != null && (
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-bold backdrop-blur-sm">
          {item.week_number}주차
        </div>
      )}
    </motion.div>
  );
}

// 플랜 안내 카드
function PlanGuide({ isPro, totalCount }: { isPro: boolean; totalCount: number }) {
  const freeRows = [
    { label: '사진 업로드', free: `최대 ${FREE_IMAGE_LIMIT}장`, pro: '무제한', freeOk: true },
    { label: '영상 업로드', free: '불가', pro: '가능 (파일당 500MB)', freeOk: false },
    { label: '이미지 자동 최적화', free: 'WebP 변환 + 리사이즈', pro: 'WebP 변환 + 리사이즈', freeOk: true },
    { label: '드래그 & 드롭', free: '지원', pro: '지원', freeOk: true },
    { label: '라이트박스 뷰어', free: '지원', pro: '지원', freeOk: true },
  ];

  if (isPro) {
    return (
      <div className="flex items-center gap-2.5 mb-5 px-4 py-3 bg-emerald-50 border border-emerald-200/70 rounded-2xl">
        <BadgeCheck size={18} className="text-emerald-500 shrink-0" />
        <p className="text-sm font-bold text-emerald-700">PRO 플랜 이용 중 — 사진 무제한 + 영상 업로드 모두 이용 가능합니다</p>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-2xl border border-on-surface/8 overflow-hidden bg-white shadow-sm">
      {/* 제목 행 */}
      <div className="grid grid-cols-3 bg-surface-container-low/60">
        <div className="px-4 py-2.5 text-xs font-black text-on-surface-variant uppercase tracking-wider">기능</div>
        <div className="px-4 py-2.5 text-xs font-black text-on-surface-variant text-center border-l border-on-surface/5">
          무료 플랜
          <span className="ml-1.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
            {totalCount}/{FREE_IMAGE_LIMIT}장
          </span>
        </div>
        <div className="px-4 py-2.5 text-xs font-black text-amber-600 text-center border-l border-on-surface/5 bg-amber-50/60">
          <span className="flex items-center justify-center gap-1">
            <Crown size={11} /> PRO 플랜
          </span>
        </div>
      </div>

      {/* 비교 행 */}
      {freeRows.map((row, i) => (
        <div
          key={row.label}
          className={`grid grid-cols-3 border-t border-on-surface/5 ${i % 2 === 1 ? 'bg-surface-container-low/30' : ''}`}
        >
          <div className="px-4 py-2.5 text-xs font-bold text-on-surface">{row.label}</div>
          <div className={`px-4 py-2.5 text-xs text-center border-l border-on-surface/5 font-medium flex items-center justify-center gap-1 ${row.freeOk ? 'text-on-surface-variant' : 'text-error/70'}`}>
            {row.freeOk
              ? <Check size={12} className="text-emerald-500 shrink-0" />
              : <X size={12} className="text-error/60 shrink-0" />}
            {row.free}
          </div>
          <div className="px-4 py-2.5 text-xs text-center border-l border-on-surface/5 font-medium text-amber-700 bg-amber-50/40 flex items-center justify-center gap-1">
            <Check size={12} className="text-amber-500 shrink-0" />
            {row.pro}
          </div>
        </div>
      ))}

      {/* 업그레이드 CTA */}
      <div className="border-t border-amber-100 bg-amber-50/60 px-4 py-3 flex items-center justify-between gap-4">
        <p className="text-xs text-amber-700 font-medium">PRO로 업그레이드하면 영상 업로드 + 사진 무제한이 가능합니다</p>
        <a
          href="mailto:aklabs84@naver.com?subject=생기로그 Pro 플랜 업그레이드 문의"
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl transition-colors"
        >
          <Crown size={12} /> 업그레이드 문의
        </a>
      </div>
    </div>
  );
}

// 빈 상태
function EmptyState({
  icon,
  message,
  sub,
  onUpload,
}: {
  icon: React.ReactNode;
  message: string;
  sub?: string;
  onUpload?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-on-surface-variant">
      <div className="text-on-surface/20">{icon}</div>
      <div className="text-center">
        <p className="font-bold text-sm">{message}</p>
        {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
      </div>
      {onUpload && (
        <button
          onClick={onUpload}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-on-surface/20 text-sm font-bold text-on-surface-variant hover:border-primary hover:text-primary transition-all"
        >
          <Upload size={16} /> 파일 업로드
        </button>
      )}
    </div>
  );
}
