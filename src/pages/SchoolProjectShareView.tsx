import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { BANNER_THEMES } from '../components/classroom/SchoolProjectModal';
import {
  School, Users, ChevronDown, ChevronUp, ExternalLink,
  FileText, Loader2, AlertCircle, Lock, Calendar,
  Images, Download, ZoomIn, X, BookOpen,
  AlignLeft, Link2, ImageIcon, File as FileIcon
} from 'lucide-react';

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
  observations: { id: string; activity_name: string; content: string; created_at: string }[];
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
  const [loadingClass, setLoadingClass] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  // 결과물 상세 모달
  const [detailGroup, setDetailGroup] = useState<{ group: ResultGroup; studentName: string } | null>(null);

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
        .select('id, name, subject, assigned_teacher_id')
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
      })));
    } finally {
      setLoading(false);
    }
  };

  const fetchClassData = async (classId: string) => {
    if (classStudents[classId]) {
      setActiveClassId(activeClassId === classId ? null : classId);
      return;
    }
    setLoadingClass(classId);
    try {
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

      const [obsRes, resultsRes, galleryRes] = await Promise.all([
        supabase.from('observations')
          .select('id, student_id, activity_name, content, created_at')
          .in('student_id', studentIds).order('created_at', { ascending: false }),
        supabase.from('student_results')
          .select('id, student_id, submission_group, is_group_submission, week_number, title, text_content, result_type, created_at, link_url, storage_path')
          .in('student_id', studentIds).order('created_at', { ascending: false }),
        supabase.from('class_gallery_items')
          .select('id, file_url, file_type, file_name, caption, week_number, created_at')
          .eq('class_id', classId).order('created_at', { ascending: false }),
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
        obsMap[o.student_id].push(o);
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
      setClassGallery(prev => ({ ...prev, [classId]: galleryRes.data || [] }));
      setActiveClassId(classId);
    } finally {
      setLoadingClass(null);
    }
  };

  const handleToggleClass = (classId: string) => {
    if (activeClassId === classId) setActiveClassId(null);
    else fetchClassData(classId);
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
                  ) : (
                    <>
                      {students.map(student => {
                        const hasData = student.observations.length > 0 || student.resultGroups.length > 0;
                        const isStudentExpanded = expandedStudents.has(student.id);

                        return (
                          <div key={student.id} className="border-b border-gray-50 last:border-0">
                            {/* 학생 헤더 */}
                            <button onClick={() => hasData && toggleStudent(student.id)} disabled={!hasData}
                              className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${hasData ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default opacity-50'}`}>
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

                            {/* 학생 상세 */}
                            {isStudentExpanded && hasData && (
                              <div className="px-6 pb-5 space-y-3 bg-gray-50/50">
                                {/* 관찰기록 */}
                                {student.observations.map(obs => (
                                  <div key={obs.id} className="bg-white rounded-xl border border-violet-100 p-4">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">📝 활동 기록</span>
                                      <span className="text-[10px] text-gray-400 ml-auto">{new Date(obs.created_at).toLocaleDateString('ko-KR')}</span>
                                    </div>
                                    {obs.activity_name && <p className="text-[11px] font-semibold text-gray-500 mb-1.5">{obs.activity_name}</p>}
                                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{obs.content}</p>
                                  </div>
                                ))}

                                {/* 결과물 그룹 카드 */}
                                {student.resultGroups.map(group => {
                                  const imageItem = group.items.find(r => r.image_url);
                                  const textItem  = group.items.find(r => r.result_type === 'text');
                                  const linkItem  = group.items.find(r => r.result_type === 'link');
                                  const fileItem  = group.items.find(r => r.result_type === 'file');

                                  return (
                                    <div key={group.groupId}
                                      onClick={() => setDetailGroup({ group, studentName: student.full_name })}
                                      className="bg-white rounded-xl border border-emerald-100 p-4 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all group">
                                      {/* 배지 행 */}
                                      <div className="flex items-center gap-1.5 flex-wrap mb-3">
                                        {group.isGroupSubmission && (
                                          <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 border border-violet-200">
                                            👥 조별 제출
                                          </span>
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
                                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200 ml-auto">
                                            {group.week_number}주차
                                          </span>
                                        )}
                                      </div>
                                      {/* 제목 */}
                                      {group.title && <p className="font-black text-sm text-gray-800 mb-2 group-hover:text-emerald-700 transition-colors">{group.title}</p>}
                                      {/* 미리보기 */}
                                      <div className="space-y-2">
                                        {imageItem?.image_url && (
                                          <img src={imageItem.image_url} alt="" className="rounded-lg w-full max-h-36 object-cover" />
                                        )}
                                        {textItem?.text_content && (
                                          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{textItem.text_content}</p>
                                        )}
                                        {linkItem?.link_url && (
                                          <p className="text-xs text-indigo-500 truncate flex items-center gap-1"><Link2 size={10} />{linkItem.link_url}</p>
                                        )}
                                        {fileItem && (
                                          <p className="text-xs text-amber-600 flex items-center gap-1"><FileIcon size={10} />첨부파일 있음</p>
                                        )}
                                      </div>
                                      {/* 날짜 + 클릭 힌트 */}
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

                      {/* 갤러리 섹션 */}
                      {gallery.length > 0 && (
                        <div className="border-t border-violet-100 px-6 py-5">
                          <div className="flex items-center gap-2 mb-4">
                            <Images size={15} className="text-amber-500" />
                            <p className="text-sm font-black text-gray-700">학급 갤러리</p>
                            <span className="text-[10px] text-gray-400 font-bold">{gallery.length}장</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {gallery.map(item => (
                              <div key={item.id} className="relative group cursor-pointer rounded-xl overflow-hidden bg-gray-100 aspect-square"
                                onClick={() => {
                                  const imgs = gallery.filter(g => g.file_type === 'image');
                                  const idx = imgs.findIndex(g => g.id === item.id);
                                  if (idx >= 0) setLightbox({ urls: imgs.map(g => g.file_url), index: idx });
                                  else window.open(item.file_url, '_blank');
                                }}>
                                {item.file_type === 'image' ? (
                                  <img src={item.file_url} alt={item.caption || ''} className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400">
                                    <FileText size={24} />
                                    <p className="text-[10px] font-bold px-2 text-center truncate w-full">{item.file_name || '파일'}</p>
                                  </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                                  <ZoomIn size={20} className="text-white" />
                                </div>
                                {item.caption && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                                    <p className="text-[10px] text-white truncate">{item.caption}</p>
                                  </div>
                                )}
                                {item.week_number && (
                                  <div className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                                    {item.week_number}주
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

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
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <footer className="text-center py-8 text-xs text-gray-300">
        생기로그 · 학교 프로젝트 공유 페이지
      </footer>
    </div>
  );
};

export default SchoolProjectShareView;
