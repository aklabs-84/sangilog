import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { openFile } from '../lib/fileUtils';
import { useTheme } from '../hooks/useTheme';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users2,
  RefreshCw,
  Minimize2,
  StickyNote,
  Loader2,
  ExternalLink,
  File,
  X,
  Download,
  Link2,
} from 'lucide-react';

const ClassBoard = () => {
  const { classId } = useParams<{ classId: string }>();

  // 이 페이지는 MainLayout 바깥(새 탭)이므로 직접 테마 적용
  useTheme();

  const [className, setClassName] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'obs' | 'result'>('all');
  const [weekFilter, setWeekFilter] = useState<number | 'all'>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [groupModalInfo, setGroupModalInfo] = useState<{ name: string; memberNames: string[] } | null>(null);

  const fetchData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const norm = (s: string) => s?.replace(/\s+/g, '').toLowerCase() || '';

      const [{ data: classInfo }, { data: studentList }] = await Promise.all([
        supabase.from('classes').select('name, subject, weekly_plan').eq('id', classId).single(),
        supabase.from('students').select('id, full_name').eq('class_id', classId),
      ]);
      if (classInfo) setClassName(`${classInfo.name}${classInfo.subject ? ` · ${classInfo.subject}` : ''}`);

      const studentIds = (studentList || []).map((s: any) => s.id);
      const builtNameMap: Record<string, string> = Object.fromEntries(
        (studentList || []).map((s: any) => [s.id, s.full_name])
      );
      setNameMap(builtNameMap);
      const nameMap = builtNameMap;

      const topicWeekMap: Record<string, number> = {};
      ((classInfo?.weekly_plan as any[]) || []).forEach((p: any) => {
        if (p.topic && p.week) topicWeekMap[norm(p.topic)] = Number(p.week);
      });

      if (studentIds.length === 0) { setPosts([]); setLoading(false); return; }

      const [{ data: obs }, { data: results }] = await Promise.all([
        supabase
          .from('observations')
          .select('id, student_id, activity_name, content, created_at, status')
          .in('student_id', studentIds)
          .eq('is_student_record', true)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(150),
        supabase
          .from('student_results')
          .select('id, student_id, week_number, title, text_content, storage_path, display_name, link_url, result_type, submission_group, is_group_submission, group_id, created_at')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false })
          .limit(300),
      ]);

      const obsPosts = (obs || []).map((o: any) => ({
        ...o,
        week_number: topicWeekMap[norm(o.activity_name)] ?? null,
        student_name: nameMap[o.student_id] || '학생',
        _type: 'obs' as const,
      }));

      // submission_group 기준으로 그룹핑
      // 조별 제출 시 RPC가 submission_group을 전파하지 못한 경우를 대비해
      // group_id + week_number + 30분 시간 버킷을 보조 키로 사용
      const groupKey = (r: any): string => {
        // 조별 제출은 submission_group 유무 관계없이 group_id 기반 키 우선 사용
        if (r.is_group_submission && r.group_id) {
          const bucket = Math.floor(new Date(r.created_at).getTime() / (1000 * 60 * 30));
          return `g_${r.group_id}_w_${r.week_number ?? 0}_t_${bucket}`;
        }
        return r.submission_group || r.id;
      };
      const groupMap: Record<string, any[]> = {};
      (results || []).forEach((r: any) => {
        const key = groupKey(r);
        if (!groupMap[key]) groupMap[key] = [];
        groupMap[key].push(r);
      });

      const resultPosts = await Promise.all(
        Object.values(groupMap).map(async (group: any[]) => {
          const rep = group[0];
          const imageItem = group.find((r: any) => r.result_type === 'image');
          const fileItem  = group.find((r: any) => r.result_type === 'file');
          const textItem  = group.find((r: any) => r.result_type === 'text');
          const linkItem  = group.find((r: any) => r.result_type === 'link');

          let image_url: string | null = null;
          let image_original_url: string | null = null;
          let file_url: string | null = null;

          if (imageItem?.storage_path) {
            const { data: urlData } = supabase.storage.from('student-attachments').getPublicUrl(imageItem.storage_path);
            image_original_url = urlData?.publicUrl || null;
            image_url = image_original_url;
          }
          if (fileItem?.storage_path) {
            const { data: urlData } = supabase.storage.from('student-attachments').getPublicUrl(fileItem.storage_path);
            file_url = urlData?.publicUrl || null;
          }

          const uniqueStudentIds = new Set(group.map((r: any) => r.student_id));
          const isGroupSub = group.some((r: any) => r.is_group_submission) || uniqueStudentIds.size > 1;

          return {
            ...rep,
            text_content: textItem?.text_content || null,
            link_url: linkItem?.link_url || null,
            display_name: fileItem?.display_name || rep.display_name,
            student_name: nameMap[rep.student_id] || '학생',
            image_url,
            image_original_url,
            file_url,
            _type: 'result' as const,
            _group: group,
            _types: [...new Set(group.map((r: any) => r.result_type))] as string[],
            _isGroupSub: isGroupSub,
          };
        })
      );

      const all = [...obsPosts, ...resultPosts].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setPosts(all);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 30초 자동 새로고침
  useEffect(() => {
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // 조별 제출 모달 열릴 때 그룹 정보 fetch
  useEffect(() => {
    if (!selectedPost || !selectedPost._isGroupSub) { setGroupModalInfo(null); return; }
    const groupId = selectedPost._group?.[0]?.group_id;
    const fetchGroupInfo = async () => {
      if (groupId) {
        const [{ data: groupData }, { data: members }] = await Promise.all([
          supabase.from('class_groups').select('name').eq('id', groupId).single(),
          supabase.from('class_group_members').select('student_id, students(full_name)').eq('group_id', groupId),
        ]);
        const memberNames = (members || []).map((m: any) => m.students?.full_name).filter(Boolean);
        setGroupModalInfo({ name: groupData?.name || '조별 제출', memberNames });
      } else {
        const uniqueIds = [...new Set((selectedPost._group || []).map((r: any) => r.student_id))] as string[];
        const memberNames = uniqueIds.map((id) => nameMap[id]).filter(Boolean);
        setGroupModalInfo({ name: '조별 제출', memberNames });
      }
    };
    fetchGroupInfo();
  }, [selectedPost, nameMap]);

  const filtered = useMemo(() => posts.filter(p => {
    if (typeFilter !== 'all' && p._type !== typeFilter) return false;
    if (weekFilter !== 'all' && p.week_number !== weekFilter) return false;
    return true;
  }), [posts, typeFilter, weekFilter]);

  const weekList = useMemo(
    () => Array.from(new Set(posts.map(p => p.week_number).filter(Boolean))).sort((a, b) => a - b),
    [posts]
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">

      {/* ── 헤더 ── */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-surface-container-high bg-surface-container-lowest sticky top-0 z-10 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
            <Users2 size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">우리반 보드</p>
            <h1 className="text-lg font-black leading-tight text-on-surface">{className || '보드'}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-on-surface-variant font-bold hidden sm:block">
              {lastUpdated.toLocaleTimeString('ko-KR')} 업데이트
            </span>
          )}
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-black text-xs transition-all border border-surface-container-high"
          >
            <RefreshCw size={13} /> 새로고침
          </button>
          <button
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              else document.documentElement.requestFullscreen();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 font-black text-xs transition-all border border-indigo-200 dark:border-indigo-700/40"
          >
            <Minimize2 size={13} /> 전체화면 해제
          </button>
        </div>
      </header>

      {/* ── 필터 바 ── */}
      <div className="sticky top-[65px] z-10 px-8 py-3 bg-surface-container-low border-b border-surface-container-high flex items-center gap-3 flex-wrap">
        {/* 타입 필터 */}
        <div className="flex items-center gap-1 bg-surface-container rounded-xl p-1">
          {[
            { key: 'all', label: '전체' },
            { key: 'obs', label: '📝 활동 기록' },
            { key: 'result', label: '📁 결과' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                typeFilter === f.key
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
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
                : 'bg-surface-container text-on-surface-variant border-surface-container-high hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300'
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
                  : 'bg-surface-container text-on-surface-variant border-surface-container-high hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300'
              }`}
            >
              {w}주차
            </button>
          ))}
        </div>

        <span className="ml-auto text-[11px] text-on-surface-variant font-black hidden sm:block">
          {filtered.length}개 게시물
        </span>
      </div>

      {/* ── 콘텐츠 ── */}
      <main className="flex-1 p-8">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={36} className="animate-spin text-indigo-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-32 space-y-4">
            <div className="w-24 h-24 rounded-3xl bg-surface-container flex items-center justify-center">
              <StickyNote size={40} className="text-on-surface-variant/30" />
            </div>
            <p className="font-black text-on-surface-variant text-lg">아직 승인된 게시물이 없어요</p>
            <p className="text-sm text-on-surface-variant/60 font-bold">학생 제출물을 승인하면 이 보드에 나타납니다</p>
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
                    transition={{ delay: Math.min(i, 15) * 0.03 }}
                    onClick={() => setSelectedPost(post)}
                    className={`break-inside-avoid rounded-3xl border p-5 space-y-3 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg ${
                      isObs
                        ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700/40 hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:border-violet-300 dark:hover:border-violet-500/60'
                        : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:border-emerald-300 dark:hover:border-emerald-500/60'
                    }`}
                  >
                    {/* 카드 헤더 */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[12px] shrink-0 ${
                          isObs
                            ? 'bg-violet-100 dark:bg-violet-700/40'
                            : 'bg-emerald-100 dark:bg-emerald-700/40'
                        }`}>
                          {isObs ? '📝' : '📁'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black truncate text-on-surface">{post.student_name}</p>
                          <p className="text-[10px] text-on-surface-variant font-bold">
                            {post.week_number ? `${post.week_number}주차 · ` : ''}
                            {new Date(post.created_at).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isObs && post._isGroupSub && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                            조별
                          </span>
                        )}
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                          isObs
                            ? 'bg-violet-100 dark:bg-violet-700/40 text-violet-700 dark:text-violet-300'
                            : 'bg-emerald-100 dark:bg-emerald-700/40 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {isObs ? '활동 기록' : '결과'}
                        </span>
                      </div>
                    </div>

                    {/* 카드 내용 */}
                    <div className="space-y-2">
                      <p className="text-sm font-black text-on-surface leading-snug line-clamp-2">
                        {isObs ? post.activity_name : post.title}
                      </p>
                      {isObs && post.content && (
                        <p className="text-xs text-on-surface-variant font-bold leading-relaxed line-clamp-5">{post.content}</p>
                      )}
                      {isObs && post.feeling && (
                        <p className="text-[11px] text-on-surface-variant font-bold italic line-clamp-2">💬 {post.feeling}</p>
                      )}
                      {!isObs && (
                        <div className="space-y-2">
                          {post.text_content && (
                            <p className="text-xs text-on-surface-variant font-bold leading-relaxed line-clamp-5">{post.text_content}</p>
                          )}
                          {post.image_url && (
                            <img
                              src={post.image_url}
                              alt=""
                              className="w-full rounded-xl object-cover max-h-48"
                              loading="lazy"
                              onError={e => {
                                if (post.image_original_url) {
                                  (e.target as HTMLImageElement).src = post.image_original_url;
                                }
                              }}
                            />
                          )}
                          {post.link_url && (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                              <ExternalLink size={11} className="shrink-0" />
                              <span className="truncate">{post.link_url}</span>
                            </div>
                          )}
                          {post.file_url && (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant">
                              <File size={11} className="shrink-0" />
                              <span className="truncate">{post.display_name || '파일'}</span>
                            </div>
                          )}
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

      {/* ── 하단 상태 바 ── */}
      <footer className="px-8 py-3 bg-surface-container-lowest border-t border-surface-container-high flex items-center justify-between">
        <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
          생기로그 · 우리반 보드
        </span>
        <span className="text-[10px] text-on-surface-variant/50 font-bold">
          30초마다 자동 새로고침
        </span>
      </footer>

      {/* ── 상세 모달 ── */}
      <AnimatePresence>
        {selectedPost && (() => {
          const isObs = selectedPost._type === 'obs';
          return (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedPost(null)}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              />
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
                  className={`pointer-events-auto w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border shadow-2xl bg-surface-container-lowest ${
                    isObs ? 'border-violet-200 dark:border-violet-700/50' : 'border-emerald-200 dark:border-emerald-700/50'
                  }`}
                >
                  {/* 모달 헤더 */}
                  <div className={`sticky top-0 flex items-center justify-between gap-3 px-6 py-4 border-b backdrop-blur-xl ${
                    isObs
                      ? 'bg-violet-50 dark:bg-violet-900/40 border-violet-200 dark:border-violet-700/30'
                      : 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-700/30'
                  }`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base shrink-0 ${
                        isObs
                          ? 'bg-violet-100 dark:bg-violet-700/50'
                          : 'bg-emerald-100 dark:bg-emerald-700/50'
                      }`}>
                        {isObs ? '📝' : '📁'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-on-surface truncate">{selectedPost.student_name}</p>
                        <p className="text-[11px] text-on-surface-variant font-bold">
                          {selectedPost.week_number ? `${selectedPost.week_number}주차 · ` : ''}
                          {new Date(selectedPost.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                          &nbsp;·&nbsp;
                          <span className={isObs ? 'text-violet-600 dark:text-violet-400' : 'text-emerald-600 dark:text-emerald-400'}>
                            {isObs ? '활동 기록' : '결과물'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedPost(null)}
                      className="shrink-0 w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high flex items-center justify-center transition-all text-on-surface-variant"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* 모달 본문 */}
                  <div className="p-6 space-y-5">
                    <h2 className="text-lg font-black text-on-surface leading-snug">
                      {isObs ? selectedPost.activity_name : selectedPost.title}
                    </h2>

                    {/* 조별 제출 정보 */}
                    {!isObs && selectedPost._isGroupSub && (
                      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700/40">
                        <span className="text-lg">👥</span>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                            {groupModalInfo ? groupModalInfo.name : '조별 제출'}
                          </p>
                          {groupModalInfo?.memberNames && groupModalInfo.memberNames.length > 0 && (
                            <p className="text-xs text-indigo-500 dark:text-indigo-400 font-bold mt-0.5">
                              {groupModalInfo.memberNames.join(' · ')}
                            </p>
                          )}
                          {!groupModalInfo && (
                            <p className="text-xs text-indigo-400 font-bold mt-0.5">조원 정보 불러오는 중...</p>
                          )}
                        </div>
                      </div>
                    )}

                    {isObs && selectedPost.content && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest">관찰 내용</p>
                        <p className="text-sm text-on-surface font-bold leading-relaxed whitespace-pre-wrap">
                          {selectedPost.content}
                        </p>
                      </div>
                    )}
                    {isObs && selectedPost.feeling && (
                      <div className="px-4 py-3 rounded-2xl bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700/30">
                        <p className="text-sm text-on-surface-variant font-bold italic leading-relaxed">
                          💬 {selectedPost.feeling}
                        </p>
                      </div>
                    )}

                    {!isObs && selectedPost.text_content && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">내용</p>
                        <p className="text-sm text-on-surface font-bold leading-relaxed whitespace-pre-wrap">
                          {selectedPost.text_content}
                        </p>
                      </div>
                    )}

                    {!isObs && selectedPost.image_url && (
                      <a
                        href={selectedPost.image_original_url || selectedPost.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block relative group"
                      >
                        <img
                          src={selectedPost.image_url}
                          alt=""
                          className="w-full rounded-2xl object-contain max-h-96 cursor-zoom-in"
                          loading="lazy"
                          decoding="async"
                          onError={e => {
                            if (selectedPost.image_original_url) {
                              (e.target as HTMLImageElement).src = selectedPost.image_original_url;
                            }
                          }}
                        />
                        <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-black bg-black/40 px-3 py-1.5 rounded-full transition-all">
                            새 탭에서 보기
                          </span>
                        </div>
                      </a>
                    )}

                    {!isObs && selectedPost.link_url && (
                      <a
                        href={selectedPost.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 text-blue-600 dark:text-blue-400 font-black text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all"
                      >
                        <ExternalLink size={15} />
                        <span className="truncate">{selectedPost.link_url}</span>
                      </a>
                    )}

                    {/* 추가 링크 항목들 (같은 그룹 내 여러 링크) */}
                    {!isObs && selectedPost._group && selectedPost._group.filter((r: any) => r.result_type === 'link' && r.link_url !== selectedPost.link_url).map((r: any) => (
                      <a
                        key={r.id}
                        href={r.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 text-blue-600 dark:text-blue-400 font-black text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all"
                      >
                        <ExternalLink size={15} />
                        <span className="truncate">{r.link_url}</span>
                      </a>
                    ))}

                    {!isObs && selectedPost.file_url && (
                      <button
                        onClick={() => openFile(selectedPost.file_url, selectedPost.display_name || '첨부파일')}
                        className="w-full flex items-center gap-3 px-4 py-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all group text-left"
                      >
                        <File size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="text-sm font-black text-amber-700 dark:text-amber-300 truncate flex-1">
                          {selectedPost.display_name || '첨부 파일'}
                        </span>
                        <Download size={14} className="text-amber-500/60 shrink-0 group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors" />
                      </button>
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
