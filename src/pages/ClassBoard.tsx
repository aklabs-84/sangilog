import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users2,
  RefreshCw,
  Minimize2,
  StickyNote,
  Loader2,
  ExternalLink,
  File,
  ArrowLeft,
  X,
} from 'lucide-react';

const ClassBoard = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();

  const [className, setClassName] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'obs' | 'result'>('all');
  const [weekFilter, setWeekFilter] = useState<number | 'all'>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);

  const fetchData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const norm = (s: string) => s?.replace(/\s+/g, '').toLowerCase() || '';

      // 1. 클래스 정보 + 학생 목록 병렬 조회
      const [{ data: classInfo }, { data: studentList }] = await Promise.all([
        supabase.from('classes').select('name, subject, weekly_plan').eq('id', classId).single(),
        supabase.from('students').select('id, full_name').eq('class_id', classId),
      ]);
      if (classInfo) setClassName(`${classInfo.name}${classInfo.subject ? ` · ${classInfo.subject}` : ''}`);

      const studentIds = (studentList || []).map((s: any) => s.id);
      const nameMap: Record<string, string> = Object.fromEntries(
        (studentList || []).map((s: any) => [s.id, s.full_name])
      );

      // activity_name → week_number 매핑 (weekly_plan 기반)
      const topicWeekMap: Record<string, number> = {};
      ((classInfo?.weekly_plan as any[]) || []).forEach((p: any) => {
        if (p.topic && p.week) topicWeekMap[norm(p.topic)] = Number(p.week);
      });

      if (studentIds.length === 0) { setPosts([]); setLoading(false); return; }

      // 2. 관찰기록 + 결과 병렬 조회
      const [{ data: obs }, { data: results }] = await Promise.all([
        supabase
          .from('observations')
          .select('id, student_id, activity_name, content, created_at, status')
          .in('student_id', studentIds)
          .eq('is_student_record', true)
          .in('status', ['approved', 'pending'])
          .order('created_at', { ascending: false }),
        supabase
          .from('student_results')
          .select('id, student_id, week_number, title, text_content, storage_path, display_name, link_url, result_type, created_at')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false }),
      ]);

      // 3. student_name 매핑 + 이미지 URL 변환 + 관찰기록에 week_number 부여
      const obsPosts = (obs || []).map((o: any) => ({
        ...o,
        week_number: topicWeekMap[norm(o.activity_name)] ?? null,
        student_name: nameMap[o.student_id] || '학생',
        _type: 'obs' as const,
      }));
      const resPosts = (results || []).map((r: any) => {
        let image_url = null;
        if (r.result_type === 'image' && r.storage_path) {
          const { data: urlData } = supabase.storage.from('student-attachments').getPublicUrl(r.storage_path);
          image_url = urlData?.publicUrl || null;
        }
        return { ...r, image_url, student_name: nameMap[r.student_id] || '학생', _type: 'result' as const };
      });

      setPosts([...obsPosts, ...resPosts].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
      setLastUpdated(new Date());
    } catch (err) {
      console.error('ClassBoard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  // 최초 로드 + 30초마다 자동 갱신
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedPost(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filtered = posts.filter(p => {
    if (typeFilter !== 'all' && p._type !== typeFilter) return false;
    if (weekFilter !== 'all' && p.week_number !== weekFilter) return false;
    return true;
  });

  const weekList = Array.from(new Set(posts.map(p => p.week_number).filter(Boolean))).sort((a, b) => a - b);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
              <Users2 size={20} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">우리반 보드</p>
              <h1 className="text-lg font-black leading-tight">{className || '보드'}</h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-white/30 font-bold hidden sm:block">
              {lastUpdated.toLocaleTimeString('ko-KR')} 업데이트
            </span>
          )}
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-xs transition-all"
          >
            <RefreshCw size={13} /> 새로고침
          </button>
          <button
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                document.documentElement.requestFullscreen();
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-black text-xs transition-all border border-indigo-500/30"
          >
            <Minimize2 size={13} /> 전체화면 해제
          </button>
        </div>
      </header>

      {/* 필터 바 */}
      <div className="sticky top-[69px] z-10 px-8 py-3 bg-slate-900/60 backdrop-blur-xl border-b border-white/5 flex items-center gap-3 flex-wrap">
        {/* 타입 필터 */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          {[
            { key: 'all', label: '전체' },
            { key: 'obs', label: '📝 관찰기록' },
            { key: 'result', label: '📁 결과' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                typeFilter === f.key ? 'bg-indigo-500 text-white shadow-sm' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 주차 필터 */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setWeekFilter('all')}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
              weekFilter === 'all'
                ? 'bg-indigo-500 text-white border-indigo-500'
                : 'bg-white/5 text-white/50 border-white/10 hover:border-indigo-400 hover:text-white/80'
            }`}
          >
            전체 주차
          </button>
          {weekList.map(w => (
            <button
              key={w}
              onClick={() => setWeekFilter(w)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                weekFilter === w
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'bg-white/5 text-white/50 border-white/10 hover:border-indigo-400 hover:text-white/80'
              }`}
            >
              {w}주차
            </button>
          ))}
        </div>

        {/* 게시물 수 */}
        <span className="ml-auto text-[11px] text-white/30 font-black hidden sm:block">
          {filtered.length}개 게시물
        </span>
      </div>

      {/* 콘텐츠 */}
      <main className="flex-1 p-8">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={36} className="animate-spin text-indigo-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-32 space-y-4">
            <div className="w-24 h-24 rounded-3xl bg-white/5 flex items-center justify-center">
              <StickyNote size={40} className="text-white/20" />
            </div>
            <p className="font-black text-white/30 text-lg">아직 승인된 게시물이 없어요</p>
            <p className="text-sm text-white/20 font-bold">학생 제출물을 승인하면 이 보드에 나타납니다</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-4 space-y-4">
            <AnimatePresence>
              {filtered.map((post, i) => {
                const isObs = post._type === 'obs';
                return (
                  <motion.div
                    key={`${post._type}-${post.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => setSelectedPost(post)}
                    className={`break-inside-avoid rounded-3xl border p-5 space-y-3 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl ${
                      isObs
                        ? 'bg-violet-900/30 border-violet-700/40 hover:border-violet-500/60 hover:bg-violet-900/50'
                        : 'bg-emerald-900/30 border-emerald-700/40 hover:border-emerald-500/60 hover:bg-emerald-900/50'
                    }`}
                  >
                    {/* 카드 헤더 */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[12px] shrink-0 ${
                          isObs ? 'bg-violet-700/40' : 'bg-emerald-700/40'
                        }`}>
                          {isObs ? '📝' : '📁'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black truncate text-white">{post.student_name}</p>
                          <p className="text-[10px] text-white/40 font-bold">
                            {post.week_number ? `${post.week_number}주차 · ` : ''}
                            {new Date(post.created_at).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                      </div>
                      <span className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full ${
                        isObs ? 'bg-violet-700/40 text-violet-300' : 'bg-emerald-700/40 text-emerald-300'
                      }`}>
                        {isObs ? '관찰기록' : '결과'}
                      </span>
                    </div>

                    {/* 카드 내용 */}
                    <div className="space-y-2">
                      <p className="text-sm font-black text-white leading-snug line-clamp-2">
                        {isObs ? post.activity_name : post.title}
                      </p>
                      {isObs && post.content && (
                        <p className="text-xs text-white/60 font-bold leading-relaxed line-clamp-5">{post.content}</p>
                      )}
                      {isObs && post.feeling && (
                        <p className="text-[11px] text-white/40 font-bold italic line-clamp-2">💬 {post.feeling}</p>
                      )}
                      {!isObs && post.text_content && (
                        <p className="text-xs text-white/60 font-bold leading-relaxed line-clamp-5">{post.text_content}</p>
                      )}
                      {!isObs && post.image_url && (
                        <img
                          src={post.image_url}
                          alt=""
                          className="w-full rounded-xl object-cover max-h-48"
                          loading="lazy"
                        />
                      )}
                      {!isObs && post.link_url && (
                        <div className="flex items-center gap-1.5 text-xs font-black text-blue-400">
                          <ExternalLink size={11} />
                          <span className="truncate">{post.link_url}</span>
                        </div>
                      )}
                      {!isObs && post.file_url && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-900/30 border border-amber-700/30 rounded-xl">
                          <File size={13} className="text-amber-400 shrink-0" />
                          <span className="text-xs font-black text-amber-300 truncate">{post.display_name || '파일'}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* 하단 상태 바 */}
      <footer className="px-8 py-3 bg-slate-900/50 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">
          생기로그 · 우리반 보드
        </span>
        <span className="text-[10px] text-white/20 font-bold">
          30초마다 자동 새로고침
        </span>
      </footer>

      {/* 상세 모달 */}
      <AnimatePresence>
        {selectedPost && (() => {
          const isObs = selectedPost._type === 'obs';
          return (
            <>
              {/* 배경 오버레이 */}
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedPost(null)}
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              />

              {/* 모달 패널 */}
              <motion.div
                key="modal"
                initial={{ opacity: 0, scale: 0.92, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 24 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
              >
                <div
                  onClick={e => e.stopPropagation()}
                  className={`pointer-events-auto w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border shadow-2xl ${
                    isObs
                      ? 'bg-slate-900 border-violet-700/50'
                      : 'bg-slate-900 border-emerald-700/50'
                  }`}
                >
                  {/* 모달 헤더 */}
                  <div className={`sticky top-0 flex items-center justify-between gap-3 px-6 py-4 border-b backdrop-blur-xl ${
                    isObs ? 'bg-violet-900/40 border-violet-700/30' : 'bg-emerald-900/40 border-emerald-700/30'
                  }`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base shrink-0 ${
                        isObs ? 'bg-violet-700/50' : 'bg-emerald-700/50'
                      }`}>
                        {isObs ? '📝' : '📁'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-white truncate">{selectedPost.student_name}</p>
                        <p className="text-[11px] text-white/40 font-bold">
                          {selectedPost.week_number ? `${selectedPost.week_number}주차 · ` : ''}
                          {new Date(selectedPost.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                          &nbsp;·&nbsp;
                          <span className={isObs ? 'text-violet-400' : 'text-emerald-400'}>
                            {isObs ? '관찰기록' : '결과물'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedPost(null)}
                      className="shrink-0 w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* 모달 본문 */}
                  <div className="p-6 space-y-5">
                    {/* 제목 */}
                    <h2 className="text-lg font-black text-white leading-snug">
                      {isObs ? selectedPost.activity_name : selectedPost.title}
                    </h2>

                    {/* 관찰기록 내용 */}
                    {isObs && selectedPost.content && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">관찰 내용</p>
                        <p className="text-sm text-white/80 font-bold leading-relaxed whitespace-pre-wrap">
                          {selectedPost.content}
                        </p>
                      </div>
                    )}
                    {isObs && selectedPost.feeling && (
                      <div className="px-4 py-3 rounded-2xl bg-violet-900/30 border border-violet-700/30">
                        <p className="text-sm text-white/70 font-bold italic leading-relaxed">
                          💬 {selectedPost.feeling}
                        </p>
                      </div>
                    )}

                    {/* 결과물 텍스트 */}
                    {!isObs && selectedPost.text_content && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">내용</p>
                        <p className="text-sm text-white/80 font-bold leading-relaxed whitespace-pre-wrap">
                          {selectedPost.text_content}
                        </p>
                      </div>
                    )}

                    {/* 결과물 이미지 */}
                    {!isObs && selectedPost.image_url && (
                      <img
                        src={selectedPost.image_url}
                        alt=""
                        className="w-full rounded-2xl object-contain max-h-96"
                      />
                    )}

                    {/* 결과물 링크 */}
                    {!isObs && selectedPost.link_url && (
                      <a
                        href={selectedPost.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-blue-900/30 border border-blue-700/30 text-blue-400 font-black text-sm hover:bg-blue-900/50 transition-all"
                      >
                        <ExternalLink size={15} />
                        <span className="truncate">{selectedPost.link_url}</span>
                      </a>
                    )}

                    {/* 결과물 파일 */}
                    {!isObs && selectedPost.storage_path && selectedPost.result_type === 'file' && (
                      <div className="flex items-center gap-3 px-4 py-3 bg-amber-900/30 border border-amber-700/30 rounded-2xl">
                        <File size={16} className="text-amber-400 shrink-0" />
                        <span className="text-sm font-black text-amber-300 truncate">
                          {selectedPost.display_name || '첨부 파일'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

export default ClassBoard;
