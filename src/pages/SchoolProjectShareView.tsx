import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  School, Users, ChevronDown, ChevronUp, ExternalLink,
  FileText, Loader2, AlertCircle, Lock, Calendar
} from 'lucide-react';

const SchoolProjectShareView = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [project, setProject] = useState<any>(null);
  const [classList, setClassList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [classStudents, setClassStudents] = useState<Record<string, any[]>>({});
  const [loadingClass, setLoadingClass] = useState<string | null>(null);

  useEffect(() => {
    if (!shareToken) return;
    fetchProjectMeta();
  }, [shareToken]);

  const fetchProjectMeta = async () => {
    setLoading(true);
    try {
      const { data: proj, error: projErr } = await supabase
        .from('school_projects')
        .select('id, name, school_name, status, end_date, created_at')
        .eq('share_token', shareToken)
        .single();

      if (projErr || !proj) {
        setError('공유 링크가 유효하지 않거나 존재하지 않습니다.');
        return;
      }

      setProject(proj);

      const { data: pcList } = await supabase
        .from('school_project_classes')
        .select(`
          class_id, role,
          classes!inner(id, name, subject),
          profiles(full_name)
        `)
        .eq('project_id', proj.id)
        .eq('role', 'class_owner');

      setClassList((pcList || []).map((pc: any) => ({
        id: pc.class_id,
        name: pc.classes?.name || '',
        subject: pc.classes?.subject || '',
        teacher_name: pc.profiles?.full_name || null,
      })));
    } finally {
      setLoading(false);
    }
  };

  const fetchClassStudents = async (classId: string) => {
    if (classStudents[classId]) {
      setActiveClassId(activeClassId === classId ? null : classId);
      return;
    }
    setLoadingClass(classId);
    try {
      const { data: students } = await supabase
        .from('students')
        .select('id, full_name, student_number')
        .eq('class_id', classId)
        .order('student_number', { ascending: true });

      if (!students) { setLoadingClass(null); return; }

      const studentIds = students.map(s => s.id);
      const { data: obs } = await supabase
        .from('observations')
        .select('student_id, activity_name, content, created_at')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false });

      const obsMap: Record<string, any[]> = {};
      (obs || []).forEach(o => {
        if (!obsMap[o.student_id]) obsMap[o.student_id] = [];
        obsMap[o.student_id].push(o);
      });

      setClassStudents(prev => ({
        ...prev,
        [classId]: students.map(s => ({ ...s, observations: obsMap[s.id] || [] }))
      }));
      setActiveClassId(classId);
    } finally {
      setLoadingClass(null);
    }
  };

  const handleToggleClass = (classId: string) => {
    if (activeClassId === classId) {
      setActiveClassId(null);
    } else {
      fetchClassStudents(classId);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 size={32} className="animate-spin" />
          <p className="text-sm font-bold">프로젝트 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle size={40} className="mx-auto text-red-400" />
          <p className="font-black text-gray-700">{error}</p>
          <p className="text-sm text-gray-400">URL을 확인하거나 담당 선생님에게 문의하세요.</p>
        </div>
      </div>
    );
  }

  const isClosed = project?.status === 'closed' || project?.status === 'archived';

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <School size={24} />
            </div>
            <div>
              {project?.school_name && (
                <p className="text-xs font-bold text-white/60 uppercase tracking-widest">{project.school_name}</p>
              )}
              <h1 className="text-2xl font-black">{project?.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-white/70">
            <span className="flex items-center gap-1.5">
              <Users size={14} /> {classList.length}개 학급
            </span>
            {project?.end_date && (
              <span className="flex items-center gap-1.5">
                <Calendar size={14} /> 종료일: {new Date(project.end_date).toLocaleDateString('ko-KR')}
              </span>
            )}
            {isClosed && (
              <span className="flex items-center gap-1.5 bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold">
                <Lock size={11} /> 수업 종료됨
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 클래스 목록 */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        {classList.length === 0 ? (
          <div className="text-center py-16 text-gray-300">
            <School size={40} className="mx-auto mb-3" />
            <p className="font-bold text-gray-400">등록된 학급이 없습니다.</p>
          </div>
        ) : (
          classList.map(cls => {
            const isExpanded = activeClassId === cls.id;
            const students = classStudents[cls.id] || [];
            const isLoading = loadingClass === cls.id;
            const obsCount = students.reduce((sum, s) => sum + s.observations.length, 0);

            return (
              <div key={cls.id} className="bg-white rounded-2xl shadow-sm border border-violet-100 overflow-hidden">
                {/* 클래스 헤더 */}
                <button
                  onClick={() => handleToggleClass(cls.id)}
                  className="w-full flex items-center justify-between px-6 py-5 hover:bg-violet-50 transition-all text-left"
                >
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
                  <div className="flex items-center gap-3">
                    {isExpanded && students.length > 0 && (
                      <span className="text-xs font-bold text-gray-400">{students.length}명 · 관찰기록 {obsCount}건</span>
                    )}
                    {isLoading ? (
                      <Loader2 size={18} className="animate-spin text-violet-400" />
                    ) : isExpanded ? (
                      <ChevronUp size={18} className="text-violet-400" />
                    ) : (
                      <ChevronDown size={18} className="text-gray-300" />
                    )}
                  </div>
                </button>

                {/* 학생 목록 */}
                {isExpanded && students.length > 0 && (
                  <div className="border-t border-violet-100">
                    {students.map(student => (
                      <div key={student.id} className="border-b border-gray-50 last:border-0">
                        <div className="px-6 py-4 flex items-start gap-4">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-black text-gray-500 shrink-0 mt-0.5">
                            {student.student_number || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm">{student.full_name}</p>
                            {student.observations.length === 0 ? (
                              <p className="text-xs text-gray-300 mt-1">관찰 기록 없음</p>
                            ) : (
                              <div className="mt-2 space-y-1.5">
                                {student.observations.slice(0, 3).map((obs: any, i: number) => (
                                  <div key={i} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                                    <span className="font-bold text-violet-600 mr-1">{obs.activity_name}</span>
                                    {obs.content}
                                  </div>
                                ))}
                                {student.observations.length > 3 && (
                                  <p className="text-xs text-gray-400 pl-3">+{student.observations.length - 3}개 더보기</p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
                            <FileText size={12} />
                            <span>{student.observations.length}건</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* 개별 클래스 공유 링크 */}
                    <div className="px-6 py-3 bg-gray-50 flex justify-end">
                      <a
                        href={`/share/${cls.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-bold text-violet-500 hover:text-violet-700 transition-all"
                      >
                        <ExternalLink size={12} /> 이 학급 상세 공유 페이지 →
                      </a>
                    </div>
                  </div>
                )}
                {isExpanded && students.length === 0 && !isLoading && (
                  <div className="border-t border-violet-100 py-8 text-center text-gray-300">
                    <Users size={24} className="mx-auto mb-2" />
                    <p className="text-xs">등록된 학생이 없습니다.</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <footer className="text-center py-8 text-xs text-gray-300">
        생기로그 · 학교 프로젝트 공유 페이지
      </footer>
    </div>
  );
};

export default SchoolProjectShareView;
