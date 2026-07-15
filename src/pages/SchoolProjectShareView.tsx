import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import { GALLERY_PAGE_SIZE, parseVideoUrl } from '../lib/gallery';
import { buildXlsxBlob } from '../lib/xlsxBuilder';
import type { XCell } from '../lib/xlsxBuilder';
import { BANNER_THEMES } from '../components/classroom/SchoolProjectModal';
import {
  School, Users, ChevronDown, ChevronUp, ExternalLink,
  FileText, Loader2, AlertCircle, Lock, Calendar,
  Images, Download, ZoomIn, X, BookOpen,
  AlignLeft, Link2, ImageIcon, File as FileIcon,
  Sparkles, ArrowRight, CheckCircle2, FolderOpen, RefreshCw,
} from 'lucide-react';

async function blobDownload(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

interface ResultRow {
  id: string;
  student_id: string;
  submission_group: string | null;
  is_group_submission: boolean;
  week_number: number | null;
  title: string | null;
  text_content: string | null;
  result_type: string;
  link_url: string | null;
  image_url: string | null;
  file_url: string | null;
  file_name?: string | null;
  created_at: string;
}

interface ResultGroup {
  groupId: string;
  items: ResultRow[];
  title: string | null;
  week_number: number | null;
  isGroupSubmission: boolean;
  types: string[];
  created_at: string;
}

interface StudentWithData {
  id: string;
  full_name: string;
  student_number: number | null;
  observations: { id: string; activity_name: string; content: string; created_at: string; week_number: number | null }[];
  resultGroups: ResultGroup[];
}

interface GalleryItem {
  id: string;
  file_url: string;
  file_type: string;
  file_name: string | null;
  caption: string | null;
  week_number: number | null;
  created_at: string;
}

interface EvalRow {
  student_id: string;
  setech_content: string;
  achievement_level: string | null;
  status: string | null;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  text:  { icon: <AlignLeft size={12} />,   color: 'text-blue-600 bg-blue-50 border-blue-200',       label: '텍스트' },
  link:  { icon: <Link2 size={12} />,        color: 'text-indigo-600 bg-indigo-50 border-indigo-200', label: '링크' },
  image: { icon: <ImageIcon size={12} />,    color: 'text-emerald-600 bg-emerald-50 border-emerald-200', label: '이미지' },
  file:  { icon: <FileIcon size={12} />,     color: 'text-amber-600 bg-amber-50 border-amber-200',   label: '파일' },
};

const SchoolProjectShareView = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [project, setProject] = useState<any>(null);
  const [classList, setClassList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [classStudents, setClassStudents] = useState<Record<string, StudentWithData[]>>({});
  const [classGallery, setClassGallery] = useState<Record<string, GalleryItem[]>>({});
  const [classGalleryHasMore, setClassGalleryHasMore] = useState<Record<string, boolean>>({});
  const [galleryLoadingMore, setGalleryLoadingMore] = useState<string | null>(null);
  const galleryOffsetRef = useRef<Record<string, number>>({});
  const [classEvalMap, setClassEvalMap] = useState<Record<string, Record<string, EvalRow>>>({});
  const [loadingClass, setLoadingClass] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  // 결과물 상세 모달
  const [detailGroup, setDetailGroup] = useState<{ group: ResultGroup; studentName: string } | null>(null);
  // 학습 여정 / 결과 확인 / 갤러리 / 학급 기록 탭
  const [activeTab, setActiveTab] = useState<'journey' | 'results' | 'gallery' | 'setech'>('journey');
  const [weekFilter, setWeekFilter] = useState<number | 'all'>('all');
  const [zipping, setZipping] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!shareToken) return;
    fetchProjectMeta();
  }, [shareToken]);

  const fetchProjectMeta = async () => {
    setLoading(true);
    try {
      const { data: proj, error: projErr } = await supabase
        .from('school_projects')
        .select('id, name, school_name, status, end_date, created_at, banner_color')
        .eq('share_token', shareToken)
        .single();

      if (projErr || !proj) {
        setError('공유 링크가 유효하지 않거나 존재하지 않습니다.');
        return;
      }
      setProject(proj);

      const { data: subClasses } = await supabase
        .from('classes')
        .select('id, name, subject, assigned_teacher_id, weekly_plan, show_learning_journey')
        .eq('school_project_id', proj.id)
        .not('parent_class_id', 'is', null)
        .order('created_at', { ascending: true });

      if (!subClasses || subClasses.length === 0) { setClassList([]); return; }

      const teacherIds = [...new Set(subClasses.map((c: any) => c.assigned_teacher_id).filter(Boolean))];
      const teacherMap: Record<string, string> = {};
      if (teacherIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', teacherIds);
        (profiles || []).forEach((p: any) => { teacherMap[p.id] = p.full_name; });
      }
      setClassList(subClasses.map((c: any) => ({
        id: c.id, name: c.name, subject: c.subject || '',
        teacher_name: c.assigned_teacher_id ? (teacherMap[c.assigned_teacher_id] || null) : null,
        weekly_plan: c.weekly_plan || [],
        show_learning_journey: c.show_learning_journey ?? true,
      })));
    } finally {
      setLoading(false);
    }
  };

  const fetchClassData = async (classId: string) => {
    setLoadingClass(classId);
    try {
      const cls = classList.find(c => c.id === classId);
      const norm = (s: string) => s?.replace(/\s+/g, '').toLowerCase() || '';
      const topicWeekMap: Record<string, number> = {};
      ((cls?.weekly_plan as any[]) || []).forEach((p: any) => {
        if (p.topic && p.week) topicWeekMap[norm(p.topic)] = Number(p.week);
      });

      const { data: students } = await supabase
        .from('students').select('id, full_name, student_number')
        .eq('class_id', classId).order('student_number', { ascending: true });

      if (!students || students.length === 0) {
        setClassStudents(prev => ({ ...prev, [classId]: [] }));
        setClassGallery(prev => ({ ...prev, [classId]: [] }));
        setActiveClassId(classId);
        return;
      }
      const studentIds = students.map(s => s.id);

      const [obsRes, resultsRes, galleryRes, evalRes] = await Promise.all([
        supabase.from('observations')
          .select('id, student_id, activity_name, content, created_at')
          .in('student_id', studentIds)
          .eq('is_student_record', true)
          .eq('status', 'approved')
          .order('created_at', { ascending: false }),
        supabase.from('student_results')
          .select('id, student_id, submission_group, is_group_submission, week_number, title, text_content, result_type, created_at, link_url, storage_path')
          .in('student_id', studentIds).order('created_at', { ascending: false }),
        supabase.from('class_gallery_items')
          .select('id, file_url, file_type, file_name, caption, week_number, created_at')
          .eq('class_id', classId).order('created_at', { ascending: false })
          .range(0, GALLERY_PAGE_SIZE - 1),
        supabase.from('student_evaluations')
          .select('student_id, setech_content, achievement_level, status')
          .in('student_id', studentIds),
      ]);

      // 결과물 URL 처리
      const resultsWithUrls: ResultRow[] = (resultsRes.data || []).map((r: any) => {
        let image_url: string | null = null;
        let file_url: string | null = null;
        if (r.result_type === 'image' && r.storage_path) {
          image_url = supabase.storage.from('student-attachments').getPublicUrl(r.storage_path).data?.publicUrl || null;
        } else if (r.result_type === 'file' && r.storage_path) {
          file_url = supabase.storage.from('student-attachments').getPublicUrl(r.storage_path).data?.publicUrl || null;
        }
        return { ...r, image_url, file_url };
      });

      // submission_group 기준 그룹핑 함수
      const groupResults = (rows: ResultRow[]): ResultGroup[] => {
        const map: Record<string, ResultRow[]> = {};
        rows.forEach(r => {
          const key = r.submission_group || r.id;
          if (!map[key]) map[key] = [];
          map[key].push(r);
        });
        return Object.entries(map)
          .map(([groupId, items]) => ({
            groupId,
            items,
            title: items.find(r => r.title)?.title || null,
            week_number: items.find(r => r.week_number)?.week_number || null,
            isGroupSubmission: items.some(r => r.is_group_submission),
            types: [...new Set(items.map(r => r.result_type))],
            created_at: items[0].created_at,
          }))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      };

      const obsMap: Record<string, any[]> = {};
      (obsRes.data || []).forEach((o: any) => {
        if (!obsMap[o.student_id]) obsMap[o.student_id] = [];
        obsMap[o.student_id].push({ ...o, week_number: topicWeekMap[norm(o.activity_name)] ?? null });
      });
      const resultsMap: Record<string, ResultRow[]> = {};
      resultsWithUrls.forEach(r => {
        if (!resultsMap[r.student_id]) resultsMap[r.student_id] = [];
        resultsMap[r.student_id].push(r);
      });

      setClassStudents(prev => ({
        ...prev,
        [classId]: students.map(s => ({
          ...s,
          observations: obsMap[s.id] || [],
          resultGroups: groupResults(resultsMap[s.id] || []),
        })),
      }));
      const galleryPage = galleryRes.data || [];
      setClassGallery(prev => ({ ...prev, [classId]: galleryPage }));
      galleryOffsetRef.current[classId] = galleryPage.length;
      setClassGalleryHasMore(prev => ({ ...prev, [classId]: galleryPage.length === GALLERY_PAGE_SIZE }));

      const evalMap: Record<string, EvalRow> = {};
      (evalRes.data || []).forEach((e: any) => { evalMap[e.student_id] = e; });
      setClassEvalMap(prev => ({ ...prev, [classId]: evalMap }));

      setActiveClassId(classId);
    } finally {
      setLoadingClass(null);
    }
  };

  const handleLoadMoreGallery = async (classId: string) => {
    setGalleryLoadingMore(classId);
    try {
      const offset = galleryOffsetRef.current[classId] || 0;
      const { data } = await supabase
        .from('class_gallery_items')
        .select('id, file_url, file_type, file_name, caption, week_number, created_at')
        .eq('class_id', classId).order('created_at', { ascending: false })
        .range(offset, offset + GALLERY_PAGE_SIZE - 1);
      const page = data || [];
      setClassGallery(prev => ({ ...prev, [classId]: [...(prev[classId] || []), ...page] }));
      galleryOffsetRef.current[classId] = offset + page.length;
      setClassGalleryHasMore(prev => ({ ...prev, [classId]: page.length === GALLERY_PAGE_SIZE }));
    } finally {
      setGalleryLoadingMore(null);
    }
  };

  const handleToggleClass = (classId: string) => {
    if (activeClassId === classId) {
      setActiveClassId(null);
      return;
    }
    const cls = classList.find(c => c.id === classId);
    setActiveTab((cls?.show_learning_journey ?? true) ? 'journey' : 'results');
    setWeekFilter('all');
    setExpandedStudents(new Set());
    if (classStudents[classId]) {
      setActiveClassId(classId);
    } else {
      fetchClassData(classId);
    }
  };

  const handleRefreshClass = (classId: string) => {
    setClassStudents(prev => {
      const next = { ...prev };
      delete next[classId];
      return next;
    });
    fetchClassData(classId);
  };

  const toggleStudent = (studentId: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <Loader2 size={32} className="animate-spin" />
        <p className="text-sm font-bold">프로젝트 불러오는 중...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center space-y-3 max-w-sm">
        <AlertCircle size={40} className="mx-auto text-red-400" />
        <p className="font-black text-gray-700">{error}</p>
        <p className="text-sm text-gray-400">URL을 확인하거나 담당 선생님에게 문의하세요.</p>
      </div>
    </div>
  );

  const isClosed = project?.status === 'closed' || project?.status === 'archived';

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white">

      {/* ── 이미지 라이트박스 ── */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightbox(null)}><X size={28} /></button>
          <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2"
            onClick={e => { e.stopPropagation(); setLightbox(lb => lb && lb.index > 0 ? { ...lb, index: lb.index - 1 } : lb); }}>
            <ChevronDown size={32} className="-rotate-90" />
          </button>
          <img src={lightbox.urls[lightbox.index]} alt="" className="max-w-full max-h-[85vh] rounded-xl object-contain" onClick={e => e.stopPropagation()} />
          <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2"
            onClick={e => { e.stopPropagation(); setLightbox(lb => lb && lb.index < lb.urls.length - 1 ? { ...lb, index: lb.index + 1 } : lb); }}>
            <ChevronDown size={32} className="rotate-90" />
          </button>
          <p className="absolute bottom-4 text-white/50 text-sm">{lightbox.index + 1} / {lightbox.urls.length}</p>
        </div>
      )}

      {/* ── 결과물 상세 모달 ── */}
      {detailGroup && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDetailGroup(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {detailGroup.group.title && (
                    <h3 className="text-lg font-black text-gray-900 mb-2">{detailGroup.group.title}</h3>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {detailGroup.group.isGroupSubmission && (
                      <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 border border-violet-200">
                        👥 조별 제출
                      </span>
                    )}
                    {detailGroup.group.types.map(type => {
                      const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.file;
                      return (
                        <span key={type} className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${cfg.color}`}>
                          {cfg.icon}{cfg.label}
                        </span>
                      );
                    })}
                    {detailGroup.group.week_number && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                        {detailGroup.group.week_number}주차
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    {detailGroup.studentName} · {new Date(detailGroup.group.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => setDetailGroup(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 shrink-0 transition-all">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* 모달 내용 */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {(() => {
                const items = detailGroup.group.items;
                const textItem  = items.find(r => r.result_type === 'text');
                const linkItem  = items.find(r => r.result_type === 'link');
                const imageItem = items.find(r => r.result_type === 'image');
                const fileItem  = items.find(r => r.result_type === 'file');
                const allImgUrls = items.filter(r => r.image_url).map(r => r.image_url as string);

                return (
                  <>
                    {/* 이미지 */}
                    {imageItem?.image_url && (
                      <div className="relative group cursor-pointer rounded-2xl overflow-hidden"
                        onClick={() => setLightbox({ urls: allImgUrls, index: 0 })}>
                        <img src={imageItem.image_url} alt="결과 이미지" className="w-full max-h-64 object-cover group-hover:opacity-90 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                          <ZoomIn size={24} className="text-white" />
                        </div>
                      </div>
                    )}
                    {/* 텍스트 */}
                    {textItem?.text_content && (
                      <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                        <p className="text-[11px] font-black text-blue-500 mb-2 flex items-center gap-1"><AlignLeft size={12} />텍스트</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{textItem.text_content}</p>
                      </div>
                    )}
                    {/* 링크 */}
                    {linkItem?.link_url && (
                      <a href={linkItem.link_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 text-sm font-black text-white bg-indigo-500 hover:bg-indigo-600 px-4 py-3 rounded-2xl transition-colors shadow-sm">
                        <ExternalLink size={16} /> 링크 열기
                      </a>
                    )}
                    {/* 파일 */}
                    {fileItem?.file_url && (
                      <a href={fileItem.file_url} download target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 text-sm font-black text-white bg-amber-500 hover:bg-amber-600 px-4 py-3 rounded-2xl transition-colors shadow-sm">
                        <Download size={16} /> 파일 다운로드
                      </a>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      {(() => {
        const theme = BANNER_THEMES.find(t => t.key === (project?.banner_color || 'violet')) ?? BANNER_THEMES[0];
        return (
          <div style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)` }}>
            <div className="max-w-4xl mx-auto px-6 py-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <School size={24} style={{ color: theme.text }} />
                </div>
                <div>
                  {project?.school_name && (
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: theme.sub }}>{project.school_name}</p>
                  )}
                  <h1 className="text-2xl font-black" style={{ color: theme.text }}>{project?.name}</h1>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm flex-wrap" style={{ color: theme.sub }}>
                <span className="flex items-center gap-1.5"><Users size={14} /> {classList.length}개 학급</span>
                {project?.end_date && (
                  <span className="flex items-center gap-1.5"><Calendar size={14} /> 종료일: {new Date(project.end_date).toLocaleDateString('ko-KR')}</span>
                )}
                {isClosed && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(255,255,255,0.2)', color: theme.text }}>
                    <Lock size={11} /> 수업 종료됨
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 클래스 목록 */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        {classList.length === 0 ? (
          <div className="text-center py-16 text-gray-300">
            <School size={40} className="mx-auto mb-3" />
            <p className="font-bold text-gray-400">등록된 학급이 없습니다.</p>
          </div>
        ) : classList.map(cls => {
          const isExpanded = activeClassId === cls.id;
          const students = classStudents[cls.id] || [];
          const gallery = classGallery[cls.id] || [];
          const isLoading = loadingClass === cls.id;
          const totalObs = students.reduce((s, st) => s + st.observations.length, 0);
          const totalResults = students.reduce((s, st) => s + st.resultGroups.length, 0);

          return (
            <div key={cls.id} className="bg-white rounded-2xl shadow-sm border border-violet-100 overflow-hidden">
              {/* 클래스 헤더 */}
              <button onClick={() => handleToggleClass(cls.id)}
                className="w-full flex items-center justify-between px-6 py-5 hover:bg-violet-50 transition-all text-left">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600 shrink-0">
                    <Users size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-base">{cls.name}</h3>
                    <p className="text-xs text-gray-400">
                      {cls.subject && <span className="mr-2">{cls.subject}</span>}
                      {cls.teacher_name && <span className="text-violet-500 font-bold">{cls.teacher_name} 선생님</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  {isExpanded && students.length > 0 && (
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                      <span>{students.length}명</span>
                      {totalObs > 0 && <span className="text-violet-500">📝 {totalObs}건</span>}
                      {totalResults > 0 && <span className="text-emerald-500">📁 {totalResults}건</span>}
                      {gallery.length > 0 && <span className="text-amber-500">🖼️ {gallery.length}장</span>}
                    </div>
                  )}
                  {isLoading ? <Loader2 size={18} className="animate-spin text-violet-400" />
                    : isExpanded ? <ChevronUp size={18} className="text-violet-400" />
                    : <ChevronDown size={18} className="text-gray-300" />}
                </div>
              </button>

              {/* 펼쳐진 내용 */}
              {isExpanded && (
                <div className="border-t border-violet-100">
                  {students.length === 0 && !isLoading ? (
                    <div className="py-8 text-center text-gray-300">
                      <Users size={24} className="mx-auto mb-2" />
                      <p className="text-xs">등록된 학생이 없습니다.</p>
                    </div>
                  ) : (() => {
                    const evalMap = classEvalMap[cls.id] || {};

                    const allWeeks = Array.from(new Set([
                      ...students.flatMap(s => s.observations.map(o => o.week_number).filter(Boolean)),
                      ...students.flatMap(s => s.resultGroups.map(g => g.week_number).filter(Boolean)),
                    ] as number[])).sort((a, b) => a - b);

                    // 주차별 학습 여정 집계
                    type WeekEntry = { week: number; topic: string | null; participants: Set<string>; obsCount: number; resultCount: number; images: string[]; sampleText: string | null };
                    const weekMap: Record<number, WeekEntry> = {};
                    const ensureWeek = (w: number) => {
                      if (!weekMap[w]) weekMap[w] = { week: w, topic: null, participants: new Set(), obsCount: 0, resultCount: 0, images: [], sampleText: null };
                      return weekMap[w];
                    };
                    (cls.weekly_plan || []).forEach((p: any) => {
                      const w = Number(p.week);
                      if (!w) return;
                      ensureWeek(w).topic = p.topic || null;
                    });
                    students.forEach(student => {
                      student.observations.forEach(o => {
                        if (!o.week_number) return;
                        const wk = ensureWeek(o.week_number);
                        wk.participants.add(student.id);
                        wk.obsCount += 1;
                        if (!wk.sampleText && o.content) wk.sampleText = o.content.length > 120 ? `${o.content.slice(0, 120)}…` : o.content;
                      });
                      student.resultGroups.forEach(group => {
                        if (!group.week_number) return;
                        const wk = ensureWeek(group.week_number);
                        wk.participants.add(student.id);
                        wk.resultCount += 1;
                        const imgItem = group.items.find(r => r.image_url);
                        if (imgItem?.image_url && wk.images.length < 8 && !wk.images.includes(imgItem.image_url)) wk.images.push(imgItem.image_url);
                        const textItem = group.items.find(r => r.text_content);
                        if (!wk.sampleText && textItem?.text_content) wk.sampleText = textItem.text_content.length > 120 ? `${textItem.text_content.slice(0, 120)}…` : textItem.text_content;
                      });
                    });
                    gallery.forEach(g => {
                      if (!g.week_number || g.file_type !== 'image') return;
                      const wk = ensureWeek(g.week_number);
                      if (wk.images.length < 8 && !wk.images.includes(g.file_url)) wk.images.push(g.file_url);
                    });
                    const weeklyJourney = Object.values(weekMap)
                      .map(wk => ({ ...wk, participantCount: wk.participants.size }))
                      .sort((a, b) => a.week - b.week);

                    const filteredStudents = weekFilter === 'all' ? students : students.map(s => ({
                      ...s,
                      observations: s.observations.filter(o => o.week_number === weekFilter),
                      resultGroups: s.resultGroups.filter(g => g.week_number === weekFilter),
                    }));
                    const filteredGallery = weekFilter === 'all' ? gallery : gallery.filter(g => g.week_number === weekFilter);

                    const totalObsF = filteredStudents.reduce((a, s) => a + s.observations.length, 0);
                    const totalResultsF = filteredStudents.reduce((a, s) => a + s.resultGroups.length, 0);
                    const activeCountF = filteredStudents.filter(s => s.observations.length > 0 || s.resultGroups.length > 0).length;
                    const galleryImgs = filteredGallery.filter(g => g.file_type === 'image');
                    const galleryImgUrls = galleryImgs.map(g => g.file_url);

                    const statusLabelText = (s?: string | null) => (s === 'done' || s === 'final' ? '완료' : s === 'draft' ? '초안' : '미작성');
                    const statusLabelStyle = (s?: string | null) => {
                      if (s === 'final' || s === 'done') return { label: '완료', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
                      if (s === 'draft') return { label: '초안', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
                      return { label: '미작성', cls: 'bg-gray-100 text-gray-400 border-gray-200' };
                    };
                    const achLabel = (a?: string | null) => {
                      if (a === '상') return 'bg-blue-100 text-blue-700';
                      if (a === '중') return 'bg-yellow-100 text-yellow-700';
                      if (a === '하') return 'bg-red-100 text-red-700';
                      return 'bg-gray-100 text-gray-400';
                    };

                    const downloadCSV = () => {
                      const className = cls.name || '학급';
                      const headers = ['번호', '이름', '활동기록 수', '결과물 수', '세특 상태', '성취도', '세특 글자수'];
                      const rows = students.map(s => {
                        const ev = evalMap[s.id];
                        return [
                          s.student_number ?? '', s.full_name, s.observations.length, s.resultGroups.length,
                          statusLabelText(ev?.status), ev?.achievement_level ?? '', (ev?.setech_content || '').length,
                        ];
                      });
                      const csvContent = [headers, ...rows]
                        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                        .join('\n');
                      const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '').replace(/\.$/, '');
                      a.download = `${project?.name || ''}_${className}_전체학생_${todayStr}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    };

                    const downloadXLSX = async () => {
                      setDownloading(true);
                      try {
                        const className = cls.name || '학급';
                        const sheet1Rows: XCell[][] = [
                          [
                            { value: '번호', style: 'header' }, { value: '이름', style: 'header' },
                            { value: '활동기록 수', style: 'header' }, { value: '결과물 수', style: 'header' },
                            { value: '성취도', style: 'header' },
                          ],
                          ...students.map(s => {
                            const ev = evalMap[s.id];
                            return [
                              { value: s.student_number ?? null }, { value: s.full_name },
                              { value: s.observations.length }, { value: s.resultGroups.length },
                              { value: ev?.achievement_level ?? '' },
                            ] as XCell[];
                          }),
                        ];

                        const studentSheets = students.map(s => {
                          const sheetName = `${s.student_number ?? '?'}. ${s.full_name}`.replace(/[/\\?*[\]:]/g, '_').slice(0, 31);
                          const label = `${s.student_number != null ? s.student_number + '번 ' : ''}${s.full_name}`;
                          const rows: (XCell | null)[][] = [];
                          rows.push([{ value: label, span: 4, style: 'section' }, null, null, null]);
                          rows.push([{ value: '' }, { value: '' }, { value: '' }, { value: '' }]);

                          if (s.observations.length === 0 && s.resultGroups.length === 0) {
                            rows.push([{ value: '제출 없음', span: 4 }, null, null, null]);
                          } else {
                            if (s.observations.length > 0) {
                              rows.push([{ value: '활동기록', span: 4, style: 'section' }, null, null, null]);
                              rows.push([
                                { value: '주차', style: 'header' }, { value: '활동명', style: 'header' },
                                { value: '내용', style: 'header' }, { value: '날짜', style: 'header' },
                              ]);
                              s.observations.forEach(o => {
                                rows.push([
                                  { value: o.week_number != null ? `${o.week_number}주차` : '' },
                                  { value: o.activity_name || '' },
                                  { value: o.content, style: 'wrap' },
                                  { value: new Date(o.created_at).toLocaleDateString('ko-KR') },
                                ]);
                              });
                              rows.push([{ value: '' }, { value: '' }, { value: '' }, { value: '' }]);
                            }
                            if (s.resultGroups.length > 0) {
                              rows.push([{ value: '결과제출', span: 4, style: 'section' }, null, null, null]);
                              rows.push([
                                { value: '주차', style: 'header' }, { value: '제목', style: 'header' },
                                { value: '내용', style: 'header' }, { value: '날짜', style: 'header' },
                              ]);
                              s.resultGroups.forEach(group => {
                                const textItem = group.items.find(r => r.result_type === 'text');
                                const linkItem = group.items.find(r => r.result_type === 'link');
                                const fileItem = group.items.find(r => r.result_type === 'file');
                                const ct = textItem?.text_content || (linkItem?.link_url ? `링크: ${linkItem.link_url}` : fileItem ? '파일 첨부' : (group.items.find(r => r.image_url) ? '이미지 첨부' : ''));
                                rows.push([
                                  { value: group.week_number != null ? `${group.week_number}주차` : '' },
                                  { value: group.title || '' },
                                  { value: ct, style: 'wrap' },
                                  { value: new Date(group.created_at).toLocaleDateString('ko-KR') },
                                ]);
                              });
                            }
                          }
                          return { name: sheetName, colWidths: [10, 22, 55, 14], rows };
                        });

                        const sheet3Rows: XCell[][] = [
                          [
                            { value: '번호', style: 'header' }, { value: '이름', style: 'header' },
                            { value: '성취도', style: 'header' }, { value: '상태', style: 'header' },
                            { value: '세특 문장', style: 'header' }, { value: '글자수', style: 'header' },
                          ],
                          ...students.map(s => {
                            const ev = evalMap[s.id];
                            const content = ev?.setech_content || '';
                            return [
                              { value: s.student_number ?? null }, { value: s.full_name },
                              { value: ev?.achievement_level ?? '' }, { value: statusLabelText(ev?.status) },
                              { value: content, style: 'wrap' }, { value: content.length },
                            ] as XCell[];
                          }),
                        ];

                        const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '').replace(/\.$/, '');
                        const blob = await buildXlsxBlob([
                          { name: '전체학생', colWidths: [6, 14, 13, 12, 10], rows: sheet1Rows },
                          ...studentSheets,
                          { name: '학급 기록', colWidths: [6, 14, 10, 10, 65, 10], rows: sheet3Rows },
                        ]);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${project?.name || ''}${project?.name ? '_' : ''}${className}_학생기록_${todayStr}.xlsx`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        console.error('XLSX 다운로드 오류:', err);
                        alert('엑셀 파일 생성 중 오류가 발생했습니다.');
                      } finally {
                        setDownloading(false);
                      }
                    };

                    const handleZipDownload = async () => {
                      if (zipping || galleryImgs.length === 0) return;
                      setZipping(true);
                      try {
                        const zip = new JSZip();
                        await Promise.all(
                          galleryImgs.map(async (item, i) => {
                            const res = await fetch(item.file_url);
                            const blob = await res.blob();
                            const ext = item.file_url.split('.').pop()?.split('?')[0] || 'webp';
                            const name = `${String(i + 1).padStart(3, '0')}_${item.file_name?.replace(/\.[^.]+$/, '') || `image_${i + 1}`}.${ext}`;
                            zip.file(name, blob);
                          })
                        );
                        const zipBlob = await zip.generateAsync({ type: 'blob' });
                        const label = weekFilter === 'all' ? '전체' : `${weekFilter}주차`;
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(zipBlob);
                        a.download = `${cls.name || '갤러리'}_${label}.zip`;
                        a.click();
                        URL.revokeObjectURL(a.href);
                      } finally {
                        setZipping(false);
                      }
                    };

                    return (
                      <>
                        {/* 탭 바 + 다운로드 */}
                        <div className="px-6 pt-3 flex items-center gap-1 flex-wrap border-b border-violet-50">
                          {[
                            ...(cls.show_learning_journey ? [{ key: 'journey', label: '학습 여정', icon: Sparkles }] : []),
                            { key: 'results', label: '결과 확인', icon: FileText },
                            { key: 'gallery', label: `갤러리${gallery.length > 0 ? ` (${gallery.length})` : ''}`, icon: Images },
                            { key: 'setech', label: '학급 기록', icon: BookOpen },
                          ].map(({ key, label, icon: Icon }) => (
                            <button
                              key={key}
                              onClick={() => setActiveTab(key as 'journey' | 'results' | 'gallery' | 'setech')}
                              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-black border-b-2 transition-all ${activeTab === key ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                            >
                              <Icon size={13} />{label}
                            </button>
                          ))}
                          <div className="ml-auto flex items-center gap-1.5 mb-2">
                            <button onClick={() => handleRefreshClass(cls.id)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all" title="새로고침">
                              <RefreshCw size={13} />
                            </button>
                            <button onClick={downloadCSV} className="flex items-center gap-1.5 px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-black transition-all" title="CSV 다운로드">
                              <FileText size={13} /><span className="hidden sm:inline">CSV</span>
                            </button>
                            <button onClick={downloadXLSX} disabled={downloading} className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-lg text-xs font-black transition-all" title="XLSX 엑셀 다운로드">
                              {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}<span className="hidden sm:inline">XLSX</span>
                            </button>
                          </div>
                        </div>

                        <div className="px-6 py-5 space-y-5">
                          {/* ── 학습 여정 탭 ── */}
                          {activeTab === 'journey' && cls.show_learning_journey && (
                            weeklyJourney.length === 0 ? (
                              <div className="flex flex-col items-center py-16 space-y-2">
                                <Sparkles size={28} className="text-gray-300" />
                                <p className="text-xs font-bold text-gray-400">아직 등록된 주차별 활동이 없습니다</p>
                              </div>
                            ) : (
                              <div className="relative">
                                <div className="absolute left-[23px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-violet-200 via-violet-100 to-transparent" />
                                <div className="space-y-5">
                                  {weeklyJourney.map(wk => (
                                    <div key={wk.week} className="relative flex gap-3">
                                      <div className="relative z-10 shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex flex-col items-center justify-center shadow-md">
                                        <span className="text-[8px] font-bold opacity-80 leading-none">WEEK</span>
                                        <span className="text-base font-black leading-none">{wk.week}</span>
                                      </div>
                                      <div className="flex-1 min-w-0 bg-gray-50 rounded-xl border border-gray-100 p-4">
                                        <div className="flex items-start justify-between gap-2 flex-wrap">
                                          <div className="min-w-0">
                                            <p className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-0.5">{wk.week}주차</p>
                                            <h4 className="text-sm font-black text-gray-900">{wk.topic || `${wk.week}주차 활동`}</h4>
                                          </div>
                                          <button
                                            onClick={() => { setWeekFilter(wk.week); setActiveTab('results'); }}
                                            className="shrink-0 flex items-center gap-1 text-[11px] font-black text-violet-600 hover:text-violet-800 transition-colors"
                                          >
                                            자세히 보기 <ArrowRight size={11} />
                                          </button>
                                        </div>
                                        <div className="flex items-center gap-2.5 mt-2 flex-wrap text-[10px] font-bold text-gray-400">
                                          <span className="flex items-center gap-1"><Users size={10} /> 참여 {wk.participantCount}명</span>
                                          {wk.obsCount > 0 && <span className="text-violet-500">📝 활동기록 {wk.obsCount}건</span>}
                                          {wk.resultCount > 0 && <span className="text-emerald-500">📁 결과물 {wk.resultCount}건</span>}
                                        </div>
                                        {wk.sampleText && (
                                          <p className="mt-2 text-xs text-gray-600 leading-relaxed line-clamp-2 bg-white rounded-lg px-2.5 py-2 border border-gray-100">“{wk.sampleText}”</p>
                                        )}
                                        {wk.images.length > 0 && (
                                          <div className="flex gap-1.5 mt-2 overflow-x-auto custom-scrollbar pb-1">
                                            {wk.images.map((url, i) => (
                                              <img
                                                key={url}
                                                src={url}
                                                alt={`${wk.week}주차 사진 ${i + 1}`}
                                                loading="lazy"
                                                onClick={() => setLightbox({ urls: wk.images, index: i })}
                                                className="w-16 h-16 rounded-lg object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                              />
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          )}

                          {/* ── 결과 확인 탭 ── */}
                          {activeTab === 'results' && (
                            <>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {[
                                  { label: '전체 학생', value: students.length, unit: '명', icon: Users },
                                  { label: '활동 참여', value: activeCountF, unit: '명', icon: CheckCircle2 },
                                  { label: '활동 기록', value: totalObsF, unit: '건', icon: FileText },
                                  { label: '결과물', value: totalResultsF, unit: '건', icon: FolderOpen },
                                ].map(({ label, value, unit, icon: Icon }) => (
                                  <div key={label} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <Icon size={12} className="text-gray-400" />
                                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-xl font-black text-gray-900">{value}</span>
                                      <span className="text-xs font-bold text-gray-400">{unit}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {allWeeks.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-black text-gray-500 mr-1">주차:</span>
                                  <button onClick={() => setWeekFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${weekFilter === 'all' ? 'bg-violet-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-violet-300'}`}>전체</button>
                                  {allWeeks.map(w => (
                                    <button key={w} onClick={() => setWeekFilter(w)} className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${weekFilter === w ? 'bg-violet-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-violet-300'}`}>{w}주차</button>
                                  ))}
                                  <div className="ml-auto flex items-center gap-1.5">
                                    <button onClick={() => setExpandedStudents(new Set(students.map(s => s.id)))} className="text-xs font-black text-gray-500 hover:text-violet-600 px-2 py-1 rounded-lg hover:bg-violet-50 transition-all">전체 열기</button>
                                    <button onClick={() => setExpandedStudents(new Set())} className="text-xs font-black text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-100 transition-all">전체 닫기</button>
                                  </div>
                                </div>
                              )}

                              {filteredStudents.map(student => {
                                const hasData = student.observations.length > 0 || student.resultGroups.length > 0;
                                const isStudentExpanded = expandedStudents.has(student.id);

                                return (
                                  <div key={student.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                    <button onClick={() => hasData && toggleStudent(student.id)} disabled={!hasData}
                                      className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${hasData ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default opacity-50'}`}>
                                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-black text-gray-500 shrink-0">
                                        {student.student_number || '?'}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm">{student.full_name}</p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                          {student.observations.length > 0 && <span className="text-[10px] font-bold text-violet-600">📝 활동기록 {student.observations.length}건</span>}
                                          {student.resultGroups.length > 0 && <span className="text-[10px] font-bold text-emerald-600">📁 결과물 {student.resultGroups.length}건</span>}
                                          {!hasData && <span className="text-[10px] text-gray-400">기록 없음</span>}
                                        </div>
                                      </div>
                                      {hasData && (isStudentExpanded
                                        ? <ChevronUp size={14} className="text-gray-400 shrink-0" />
                                        : <ChevronDown size={14} className="text-gray-300 shrink-0" />
                                      )}
                                    </button>

                                    {isStudentExpanded && hasData && (
                                      <div className="px-5 pb-5 space-y-3 bg-gray-50/50 border-t border-gray-50">
                                        {student.observations.map(obs => (
                                          <div key={obs.id} className="bg-white rounded-xl border border-violet-100 p-4 mt-3">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                              <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">📝 활동 기록</span>
                                              {obs.week_number && <span className="text-[10px] font-bold text-gray-400">{obs.week_number}주차</span>}
                                              <span className="text-[10px] text-gray-400 ml-auto">{new Date(obs.created_at).toLocaleDateString('ko-KR')}</span>
                                            </div>
                                            {obs.activity_name && <p className="text-[11px] font-semibold text-gray-500 mb-1.5">{obs.activity_name}</p>}
                                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{obs.content}</p>
                                          </div>
                                        ))}

                                        {student.resultGroups.map(group => {
                                          const imageItem = group.items.find(r => r.image_url);
                                          const textItem  = group.items.find(r => r.result_type === 'text');
                                          const linkItem  = group.items.find(r => r.result_type === 'link');
                                          const fileItem  = group.items.find(r => r.result_type === 'file');

                                          return (
                                            <div key={group.groupId}
                                              onClick={() => setDetailGroup({ group, studentName: student.full_name })}
                                              className="bg-white rounded-xl border border-emerald-100 p-4 mt-3 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all group">
                                              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                                                {group.isGroupSubmission && (
                                                  <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 border border-violet-200">👥 조별 제출</span>
                                                )}
                                                {group.types.map(type => {
                                                  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.file;
                                                  return (
                                                    <span key={type} className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${cfg.color}`}>
                                                      {cfg.icon}{cfg.label}
                                                    </span>
                                                  );
                                                })}
                                                {group.week_number && (
                                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200 ml-auto">{group.week_number}주차</span>
                                                )}
                                              </div>
                                              {group.title && <p className="font-black text-sm text-gray-800 mb-2 group-hover:text-emerald-700 transition-colors">{group.title}</p>}
                                              <div className="space-y-2">
                                                {imageItem?.image_url && <img src={imageItem.image_url} alt="" className="rounded-lg w-full max-h-36 object-cover" />}
                                                {textItem?.text_content && <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{textItem.text_content}</p>}
                                                {linkItem?.link_url && <p className="text-xs text-indigo-500 truncate flex items-center gap-1"><Link2 size={10} />{linkItem.link_url}</p>}
                                                {fileItem && <p className="text-xs text-amber-600 flex items-center gap-1"><FileIcon size={10} />첨부파일 있음</p>}
                                              </div>
                                              <div className="flex items-center justify-between mt-3">
                                                <span className="text-[10px] text-gray-400">{new Date(group.created_at).toLocaleDateString('ko-KR')}</span>
                                                <span className="text-[10px] text-emerald-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">자세히 보기 →</span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {filteredStudents.length === 0 && (
                                <div className="flex flex-col items-center py-16 space-y-2">
                                  <Users size={28} className="text-gray-300" />
                                  <p className="text-xs font-bold text-gray-400">등록된 학생이 없습니다</p>
                                </div>
                              )}
                            </>
                          )}

                          {/* ── 갤러리 탭 ── */}
                          {activeTab === 'gallery' && (
                            <>
                              <div className="flex items-center gap-2 flex-wrap">
                                {allWeeks.length > 0 && (
                                  <>
                                    <span className="text-xs font-black text-gray-500 mr-1">주차:</span>
                                    <button onClick={() => setWeekFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${weekFilter === 'all' ? 'bg-violet-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-violet-300'}`}>전체</button>
                                    {allWeeks.map(w => (
                                      <button key={w} onClick={() => setWeekFilter(w)} className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${weekFilter === w ? 'bg-violet-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-violet-300'}`}>{w}주차</button>
                                    ))}
                                  </>
                                )}
                                {galleryImgs.length > 0 && (
                                  <button onClick={handleZipDownload} disabled={zipping} className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-black transition-all shadow-sm">
                                    {zipping ? <><Loader2 size={13} className="animate-spin" /> ZIP 생성 중...</> : <><Download size={13} /> 전체 ZIP 다운로드 ({galleryImgs.length}장)</>}
                                  </button>
                                )}
                              </div>

                              {filteredGallery.length === 0 ? (
                                <div className="flex flex-col items-center py-16 space-y-2">
                                  <Images size={28} className="text-gray-300" />
                                  <p className="text-xs font-bold text-gray-400">등록된 갤러리 항목이 없습니다</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {filteredGallery.map(item => (
                                    <div key={item.id} className="relative group cursor-pointer rounded-xl overflow-hidden bg-gray-100 aspect-square">
                                      {item.file_type === 'image' ? (
                                        <div className="w-full h-full" onClick={() => {
                                          const idx = galleryImgUrls.indexOf(item.file_url);
                                          if (idx >= 0) setLightbox({ urls: galleryImgUrls, index: idx });
                                        }}>
                                          <img src={item.file_url} alt={item.caption || ''} loading="lazy" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                                            <ZoomIn size={20} className="text-white" />
                                          </div>
                                          <button
                                            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 hover:bg-violet-600 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all"
                                            onClick={e => { e.stopPropagation(); blobDownload(item.file_url, item.file_name || 'image.webp'); }}
                                            title="개별 다운로드"
                                          >
                                            <Download size={12} />
                                          </button>
                                        </div>
                                      ) : item.file_type === 'video' ? (
                                        (() => {
                                          const info = parseVideoUrl(item.file_url);
                                          return info && info.platform !== 'direct' ? (
                                            <iframe src={info.embedUrl} className="w-full h-full" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" />
                                          ) : (
                                            <video src={item.file_url} controls preload="metadata" className="w-full h-full object-cover" />
                                          );
                                        })()
                                      ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400" onClick={() => window.open(item.file_url, '_blank')}>
                                          <FileText size={24} />
                                          <p className="text-[10px] font-bold px-2 text-center truncate w-full">{item.file_name || '파일'}</p>
                                        </div>
                                      )}
                                      {item.caption && (
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 pointer-events-none">
                                          <p className="text-[10px] text-white truncate">{item.caption}</p>
                                        </div>
                                      )}
                                      {item.week_number && (
                                        <div className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md pointer-events-none">
                                          {item.week_number}주
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {classGalleryHasMore[cls.id] && (
                                <div className="flex justify-center">
                                  <button
                                    onClick={() => handleLoadMoreGallery(cls.id)}
                                    disabled={galleryLoadingMore === cls.id}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 disabled:opacity-50 text-violet-600 text-xs font-black transition-all"
                                  >
                                    {galleryLoadingMore === cls.id ? <><Loader2 size={13} className="animate-spin" /> 불러오는 중...</> : '사진 더 보기'}
                                  </button>
                                </div>
                              )}
                            </>
                          )}

                          {/* ── 학급 기록 탭 ── */}
                          {activeTab === 'setech' && (() => {
                            const setechRows = students.map(s => ({ student: s, eval: evalMap[s.id] ?? null }));
                            const doneCount = setechRows.filter(r => r.eval?.status === 'final' || r.eval?.status === 'done').length;
                            const draftCount = setechRows.filter(r => r.eval?.status === 'draft').length;
                            const emptyCount = setechRows.filter(r => !r.eval?.setech_content).length;
                            const charCounts = setechRows.map(r => (r.eval?.setech_content || '').length);
                            const avgChars = charCounts.length > 0 ? Math.round(charCounts.reduce((a, b) => a + b, 0) / charCounts.length) : 0;

                            return (
                              <>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                  {[
                                    { label: '전체 학생', value: students.length, unit: '명', icon: Users },
                                    { label: '완료', value: doneCount, unit: '명', icon: CheckCircle2 },
                                    { label: '초안/미작성', value: draftCount + emptyCount, unit: '명', icon: FileText },
                                    { label: '평균 글자수', value: avgChars, unit: '자', icon: BookOpen },
                                  ].map(({ label, value, unit, icon: Icon }) => (
                                    <div key={label} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                                      <div className="flex items-center gap-1.5 mb-1.5">
                                        <Icon size={12} className="text-gray-400" />
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                                      </div>
                                      <div className="flex items-baseline gap-1">
                                        <span className="text-xl font-black text-gray-900">{value}</span>
                                        <span className="text-xs font-bold text-gray-400">{unit}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div className="space-y-2">
                                  {setechRows.map(({ student, eval: ev }) => {
                                    const setechKey = `setech_${student.id}`;
                                    const isExpandedSetech = expandedStudents.has(setechKey);
                                    const content = ev?.setech_content || '';
                                    const hasContent = !!content;
                                    const st = statusLabelStyle(ev?.status);
                                    return (
                                      <div key={student.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                        <button
                                          onClick={() => hasContent && toggleStudent(setechKey)}
                                          disabled={!hasContent}
                                          className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${hasContent ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default opacity-60'}`}
                                        >
                                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                            <span className="text-xs font-black text-gray-600">{student.student_number ?? '—'}</span>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-gray-900">{student.full_name}</p>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                              {ev?.achievement_level && (
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${achLabel(ev.achievement_level)}`}>성취도 {ev.achievement_level}</span>
                                              )}
                                              {hasContent && <span className="text-[10px] font-bold text-gray-400">{content.length}자</span>}
                                            </div>
                                          </div>
                                          <span className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
                                          {hasContent && <div className="shrink-0 text-gray-400">{isExpandedSetech ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</div>}
                                        </button>
                                        {isExpandedSetech && (
                                          <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{content}</p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {setechRows.length === 0 && (
                                  <div className="flex flex-col items-center py-16 space-y-2">
                                    <BookOpen size={28} className="text-gray-300" />
                                    <p className="text-xs font-bold text-gray-400">등록된 학생이 없습니다</p>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* 푸터 */}
                        <div className="px-6 py-3 bg-gray-50 flex items-center justify-between border-t border-gray-100">
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <BookOpen size={12} />
                            <span>총 {students.length}명 · 기록 {students.reduce((s, st) => s + st.observations.length + st.resultGroups.length, 0)}건</span>
                          </div>
                          <a href={`/share/${cls.id}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-bold text-violet-500 hover:text-violet-700 transition-all">
                            <ExternalLink size={12} /> 학급 상세 페이지 →
                          </a>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 생기로그 홍보 배너 */}
      <div className="max-w-4xl mx-auto px-4 pb-6 print:hidden">
        <div className="rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-lg">✨</span>
          </div>
          <div className="flex-1">
            <p className="font-black text-sm text-indigo-900">생기로그 AI로 학교 프로젝트를 운영해보세요</p>
            <p className="text-xs text-indigo-600 mt-0.5">학교 그룹 · 프로젝트 관리 · 학생 결과 공유까지 한 번에</p>
          </div>
          <a
            href="/"
            className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all active:scale-95"
          >
            무료로 시작하기
          </a>
        </div>
      </div>

      <footer className="text-center py-4 text-xs text-gray-300">
        생기로그 · 학교 프로젝트 공유 페이지
      </footer>
    </div>
  );
};

export default SchoolProjectShareView;
