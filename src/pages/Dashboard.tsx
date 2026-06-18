import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import {
  Clock,
  ArrowRight,
  BarChart3,
  Users,
  Sparkles,
  GraduationCap,
  BellRing,
  Check,
  X,
  BookOpen,
  TrendingUp,
  School,
  Plus,
  ExternalLink,
  Lock,
  Map,
  BookMarked,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { useAuth, checkIsPro } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import SchoolProjectModal from '../components/classroom/SchoolProjectModal';

const Dashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [totalActivitiesCount, setTotalActivitiesCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, inProgress: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [subjectInputs, setSubjectInputs] = useState<Record<string, string>>({});
  const [inviteActionLoading, setInviteActionLoading] = useState<string | null>(null);
  const [assignedClasses, setAssignedClasses] = useState<any[]>([]);
  const [myProjects, setMyProjects] = useState<any[]>([]);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deletingProjectName, setDeletingProjectName] = useState('');
  const [showActivityChart, setShowActivityChart] = useState(false);
  const [chartData, setChartData] = useState<{ daily: { label: string; count: number }[]; byClass: { name: string; count: number }[]; totalCount: number; uniqueStudents: number }>({ daily: [], byClass: [], totalCount: 0, uniqueStudents: 0 });

  useEffect(() => {
    fetchDashboardData();
    fetchPendingInvitations();
    fetchMyProjects();
    fetchAssignedClasses();
  }, []);

  const fetchMyProjects = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('school_projects')
      .select(`
        id, name, school_name, status, start_date, end_date, share_token, created_at,
        classes!school_project_id(id, parent_class_id, assigned_teacher_id)
      `)
      .eq('admin_id', user.id)
      .neq('status', 'archived')
      .order('created_at', { ascending: false });
    setMyProjects(data || []);
  };

  const fetchAssignedClasses = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('classes')
        .select('id, name, subject, color_hex, school_project_id')
        .eq('assigned_teacher_id', user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });
      if (!data || data.length === 0) { setAssignedClasses([]); return; }

      const { data: studentData } = await supabase
        .from('students')
        .select('id, class_id, avatar_url, full_name')
        .in('class_id', data.map(c => c.id));

      const studentMap = (studentData || []).reduce((acc: any, curr: any) => {
        if (!acc[curr.class_id]) acc[curr.class_id] = [];
        acc[curr.class_id].push({ avatar: curr.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(curr.full_name)}&background=random` });
        return acc;
      }, {});

      setAssignedClasses(data.map(c => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        students: (studentMap[c.id] || []).length,
        avatars: (studentMap[c.id] || []).slice(0, 3).map((s: any) => s.avatar),
        color: c.color_hex || 'bg-violet-100',
        school_project_id: c.school_project_id,
      })));
    } catch (_e) { /* assigned_teacher_id 컬럼 미존재 시 무시 */ }
  };

  const handleDeleteProject = async () => {
    if (!deletingProjectId) return;
    await supabase.from('school_projects').delete().eq('id', deletingProjectId);
    setMyProjects(prev => prev.filter(p => p.id !== deletingProjectId));
    setDeletingProjectId(null);
    setDeletingProjectName('');
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Classes
      const { data: rawClassesData } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user?.id)
        .eq('is_archived', false);
      
      if (rawClassesData) {
        // 모든 실제 데이터 타겟 ID 수집 (본인 ID 또는 연동 ID)
        const targetIds = rawClassesData.map(c => c.linked_class_id || c.id);
        
        // 타겟 ID별 학생 데이터 및 아바타 일괄 조회
        const { data: studentData } = await supabase
          .from('students')
          .select('id, class_id, avatar_url, full_name')
          .in('class_id', targetIds);

        const studentMap = (studentData || []).reduce((acc: any, curr: any) => {
          if (!acc[curr.class_id]) acc[curr.class_id] = [];
          acc[curr.class_id].push({
            avatar: curr.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(curr.full_name)}&background=random`
          });
          return acc;
        }, {});

        // 학생별 관찰 기록을 조회하여 고유 작성비율(Progress) 파악
        const studentIds = studentData ? studentData.map(s => s.id) : [];
        let classProgressMap: Record<string, number> = {};
        
        if (studentIds.length > 0) {
          const { data: allObsData, count } = await supabase
            .from('observations')
            .select('student_id, students(class_id)', { count: 'exact' })
            .in('student_id', studentIds)
            .eq('is_student_record', true);

          setTotalActivitiesCount(count || 0);

          const classToObservedStudents: Record<string, Set<string>> = {};
          (allObsData || []).forEach((obs: any) => {
            const cId = obs.students?.class_id;
            if (cId) {
              if (!classToObservedStudents[cId]) classToObservedStudents[cId] = new Set();
              classToObservedStudents[cId].add(obs.student_id);
            }
          });

          Object.keys(classToObservedStudents).forEach(cId => {
            classProgressMap[cId] = classToObservedStudents[cId].size;
          });
        }

        setClasses(rawClassesData.map(c => {
          const targetId = c.linked_class_id || c.id;
          const classStudents = studentMap[targetId] || [];
          const observedCount = classProgressMap[targetId] || 0;
          const progressPercent = classStudents.length > 0 ? Math.round((observedCount / classStudents.length) * 100) : 0;

          return {
            id: c.id,
            name: c.name,
            subject: c.subject,
            students: classStudents.length,
            avatars: classStudents.slice(0, 3).map((s: any) => s.avatar),
            progress: progressPercent,
            color: c.color_hex || 'bg-surface-container-high'
          };
        }));

        // 3. Fetch Stats — AI 초안 생성 완료 학생 수 기준
        const totalStudents = studentData?.length || 0;
        const { count: completedCount } = await supabase
          .from('student_evaluations')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', user?.id)
          .eq('academic_year', new Date().getFullYear())
          .neq('setech_content', '')
          .neq('status', 'empty');

        setStats({
          total: totalStudents,
          inProgress: totalStudents - (completedCount || 0),
          completed: completedCount || 0
        });
      }

      // 2. Fetch Recent Activities — 학생 제출 기록만 표시
      const { data: obsData } = await supabase
        .from('observations')
        .select('*, students!inner(full_name, class_id(name))')
        .eq('teacher_id', user?.id)
        .eq('is_student_record', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (obsData) {
        setActivities(obsData.map(o => ({
          id: o.id,
          name: o.students?.full_name || '학생',
          class: o.students?.class_id?.name?.replace('2학년 ', '') || '',
          time: new Date(o.created_at).toLocaleString('ko-KR', { hour: 'numeric', minute: 'numeric', hour12: true }),
          action: o.activity_name || '활동 기록',
          content: o.content,
          icon: Clock
        })));
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityChartData = async () => {
    if (!user) return;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('observations')
      .select('created_at, student_id, students!inner(class_id(name))')
      .eq('teacher_id', user.id)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    if (!data) return;

    // 일별 집계
    const dayMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      dayMap[key] = 0;
    }
    data.forEach(o => {
      const d = new Date(o.created_at);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      if (key in dayMap) dayMap[key]++;
    });

    // 클래스별 집계
    const classMap: Record<string, number> = {};
    data.forEach(o => {
      const name = (o.students as any)?.class_id?.name || '기타';
      classMap[name] = (classMap[name] || 0) + 1;
    });

    setChartData({
      daily: Object.entries(dayMap).map(([label, count]) => ({ label, count })),
      byClass: Object.entries(classMap).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      totalCount: data.length,
      uniqueStudents: new Set(data.map(o => o.student_id)).size,
    });
  };

  const fetchPendingInvitations = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('class_invitations')
        .select(`
          id,
          source_class_id,
          created_at,
          sender:sender_id ( full_name ),
          source_class:source_class_id ( name, subject )
        `)
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (data) setPendingInvitations(data);
    } catch (err) {
      console.error('초대 조회 오류:', err);
    }
  };

  const handleAcceptInvitation = async (inv: any) => {
    const subject = subjectInputs[inv.id]?.trim();
    if (!subject) {
      alert('담당 과목명을 입력해주세요.');
      return;
    }
    setInviteActionLoading(inv.id);
    try {
      const entryCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error: classError } = await supabase
        .from('classes')
        .insert({
          teacher_id: user?.id,
          name: inv.source_class?.name || '연동 학급',
          subject: subject,
          class_type: 'subject',
          linked_class_id: inv.source_class_id,
          entry_code: entryCode,
          school_code: profile?.school_code || null,
          student_guide_prompt: '수업 시간에 배운 내용과 본인의 활동 역할을 구체적으로 작성하세요.',
          teacher_report_prompt: '교육부 기재 요령을 준수하여 사실 기반의 객관적인 문체(~함, ~임)로 작성해줘.',
          weekly_plan: []
        });

      if (classError) throw classError;

      await supabase
        .from('class_invitations')
        .update({ status: 'accepted' })
        .eq('id', inv.id);

      setPendingInvitations(prev => prev.filter(i => i.id !== inv.id));
      fetchDashboardData();
    } catch (err: any) {
      alert('수락 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setInviteActionLoading(null);
    }
  };

  const handleRejectInvitation = async (invId: string) => {
    setInviteActionLoading(invId);
    try {
      await supabase
        .from('class_invitations')
        .update({ status: 'rejected' })
        .eq('id', invId);
      setPendingInvitations(prev => prev.filter(i => i.id !== invId));
    } catch (err) {
      console.error('거절 오류:', err);
    } finally {
      setInviteActionLoading(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      {/* 교과 연동 초대 알림 */}
      <AnimatePresence>
        {pendingInvitations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 px-1">
              <BellRing size={16} className="text-primary animate-pulse" />
              <h3 className="text-sm font-black text-primary uppercase tracking-widest">교과 연동 초대 {pendingInvitations.length}건</h3>
            </div>
            {pendingInvitations.map((inv) => (
              <motion.div
                key={inv.id}
                layout
                exit={{ opacity: 0, height: 0 }}
                className="surface-card p-6 border-l-4 border-primary shadow-ambient flex flex-col md:flex-row md:items-center gap-4"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0">
                  <BookOpen size={22} />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="font-black text-base">
                    <span className="text-primary">{inv.sender?.full_name} 선생님</span>이 학급 연동을 요청했습니다
                  </p>
                  <p className="text-xs font-bold text-on-surface-variant">
                    학급: {inv.source_class?.name} · {new Date(inv.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <input
                    type="text"
                    placeholder="담당 과목 입력 (예: 국어)"
                    value={subjectInputs[inv.id] || ''}
                    onChange={(e) => setSubjectInputs(prev => ({ ...prev, [inv.id]: e.target.value }))}
                    className="px-4 py-2.5 bg-surface-container rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 w-48 border border-surface-container-highest"
                  />
                  <button
                    onClick={() => handleAcceptInvitation(inv)}
                    disabled={inviteActionLoading === inv.id}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-black hover:bg-primary/80 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                  >
                    <Check size={16} />
                    수락
                  </button>
                  <button
                    onClick={() => handleRejectInvitation(inv.id)}
                    disabled={inviteActionLoading === inv.id}
                    className="p-2.5 text-neutral-400 hover:text-error hover:bg-error/10 rounded-xl transition-all disabled:opacity-50"
                  >
                    <X size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero & Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
        <div className="md:col-span-8 surface-zone p-6 md:p-10 flex flex-col justify-center relative overflow-hidden min-h-[200px] md:h-[340px]">
          <div className="relative z-10 max-w-lg">
            <p className="text-primary font-bold text-xs mb-3 tracking-widest uppercase">인텔리전스 허브</p>
            <h1 className="text-2xl md:text-4xl font-extrabold mb-4 md:mb-6 leading-[1.2] font-manrope">
              AI로 간편하게 만드는<br />
              학생 맞춤형 생기부 초안
            </h1>
            <p className="text-on-surface-variant text-sm md:text-base mb-6 md:mb-8 leading-relaxed hidden sm:block">
              학급 내 관찰 기록을 바탕으로 세밀하게 튜닝된 AI가 학기말 리포트 초안을<br />
              정성스럽게 작성해 드립니다.
            </p>
            <button
              onClick={() => navigate('/ai-assistant')}
              className="btn-gradient px-6 md:px-8 py-3 md:py-3.5 rounded-xl font-bold flex items-center gap-2 w-fit hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 text-sm"
            >
              <Sparkles size={18} />
              AI 리포트 자동 생성
            </button>
          </div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[200px] h-[200px] md:w-[300px] md:h-[300px] opacity-10 hidden sm:block">
            <GraduationCap size={300} />
          </div>
        </div>

        <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-1 gap-4 md:gap-6">
          <div className="surface-card p-5 md:p-8 flex flex-col justify-between shadow-ambient">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">리포트 완성도</p>
              <div className="text-primary bg-primary-container/30 px-2 py-1 rounded-lg text-[10px] font-bold">
                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
              </div>
            </div>
            <div className="my-2 md:my-4">
              <p className="text-3xl md:text-5xl font-extrabold font-manrope">{stats.completed}</p>
            </div>
            <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full bg-primary"
              />
            </div>
          </div>

          <div className="surface-card p-5 md:p-8 flex flex-col justify-between shadow-ambient">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">기록된 관찰 내용</p>
              <div className="text-on-surface-variant bg-surface-container-high px-2 py-1 rounded-lg text-[10px] font-bold">주간 목표</div>
            </div>
            <div className="my-2 md:my-4">
              <p className="text-3xl md:text-5xl font-extrabold font-manrope">{totalActivitiesCount}</p>
            </div>
            <p className="text-[11px] text-on-surface-variant italic hidden sm:block">
              "지속적인 관찰 기록이 AI 초안의 정확도를 높입니다."
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
        {/* Classes Section */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl md:text-2xl font-bold font-manrope">나의 학급</h2>
            <button 
              onClick={() => navigate('/classroom')}
              className="text-xs font-bold text-primary flex items-center gap-1 hover:underline underline-offset-4 decoration-2"
            >
              전체 보기 <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            {loading ? (
              [1, 2].map(i => <div key={i} className="h-[160px] md:h-[200px] surface-card animate-pulse" />)
            ) : classes.length > 0 ? (
              classes.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => navigate(`/classroom?id=${cls.id}`)}
                  className="surface-card p-5 md:p-8 shadow-ambient hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer group"
                >
                  <div className={`w-12 h-12 ${cls.color} rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform`}>
                    <Users size={24} className="text-on-surface" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{cls.name}</h3>
                  <p className="text-sm text-on-surface-variant mb-6">{cls.students}명 학생 • {cls.subject}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex -space-x-2">
                      {cls.avatars && cls.avatars.map((avatar: string, i: number) => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-surface bg-surface-container-high overflow-hidden shadow-sm">
                          <img src={avatar} alt="student" className="w-full h-full object-cover" />
                        </div>
                      ))}
                      <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-container-highest flex items-center justify-center text-[10px] font-bold shadow-sm">
                        +{cls.students > 3 ? cls.students - 3 : 0}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-tighter">진척도</p>
                      <p className="text-sm font-black text-primary">{cls.progress}%</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 surface-zone p-10 text-center text-on-surface-variant">
                등록된 학급이 없습니다. 학급을 먼저 추가해주세요.
              </div>
            )}
          </div>
        </div>

        {/* 담당 학급 섹션 (학교 프로젝트에서 초대받은 클래스) */}
        {assignedClasses.length > 0 && (
          <div className="col-span-12 space-y-4">
            <div className="flex items-center gap-2 px-2">
              <School size={18} className="text-violet-500" />
              <h2 className="text-xl font-bold font-manrope">담당 학급</h2>
              <span className="text-[10px] font-black bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">학교 프로젝트</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              {assignedClasses.map(cls => (
                <div
                  key={cls.id}
                  onClick={() => navigate(`/classroom?id=${cls.id}`)}
                  className="surface-card p-5 md:p-8 shadow-ambient hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer group border-l-4 border-violet-400"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                      <School size={22} className="text-violet-600" />
                    </div>
                    <span className="text-[10px] font-black bg-violet-50 text-violet-500 px-2 py-1 rounded-xl border border-violet-100">담당 교사</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{cls.name}</h3>
                  <p className="text-sm text-on-surface-variant mb-6">{cls.students}명 학생 • {cls.subject}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex -space-x-2">
                      {cls.avatars && cls.avatars.map((avatar: string, i: number) => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-surface bg-surface-container-high overflow-hidden shadow-sm">
                          <img src={avatar} alt="student" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                    <span className="text-[10px] text-violet-400 font-bold flex items-center gap-1">
                      <School size={10} /> 학교 프로젝트
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 학교 프로젝트 섹션 */}
        <div className="col-span-12 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <School size={20} className="text-violet-500" />
              <h2 className="text-xl font-bold font-manrope">학교 프로젝트</h2>
              <span className="text-[10px] font-black bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full uppercase tracking-wide">PRO</span>
            </div>
            {checkIsPro(profile) && (
              <button
                onClick={() => { setEditingProject(null); setProjectModalOpen(true); }}
                className="flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-xl transition-all"
              >
                <Plus size={14} /> 새 프로젝트
              </button>
            )}
          </div>

          {!checkIsPro(profile) ? (
            <div className="surface-card p-6 border border-violet-100 bg-gradient-to-r from-violet-50 to-purple-50 flex items-center gap-4">
              <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center text-violet-400 shrink-0">
                <Lock size={22} />
              </div>
              <div>
                <p className="font-black text-sm text-violet-900">Pro 전용 기능</p>
                <p className="text-xs text-violet-500 mt-0.5">여러 선생님이 하나의 학교 수업을 함께 관리하고, 학교 담당자에게 통합 결과를 공유할 수 있습니다.</p>
              </div>
            </div>
          ) : myProjects.length === 0 ? (
            <button
              onClick={() => { setEditingProject(null); setProjectModalOpen(true); }}
              className="w-full surface-card p-8 border-2 border-dashed border-violet-200 hover:border-violet-400 text-center text-violet-400 hover:text-violet-600 transition-all group"
            >
              <School size={32} className="mx-auto mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-bold">학교 프로젝트 만들기</p>
              <p className="text-xs mt-1 opacity-70">여러 반을 여러 선생님과 함께 관리하세요</p>
            </button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myProjects.map(proj => {
                const allClasses = proj.classes || [];
                const subClassCount = allClasses.filter((c: any) => c.parent_class_id !== null).length;
                const assignedCount = allClasses.filter((c: any) => c.parent_class_id !== null && c.assigned_teacher_id).length;
                const isActive = proj.status === 'active';
                const isClosed = proj.status === 'closed';
                return (
                  <div
                    key={proj.id}
                    className="surface-card p-6 hover:scale-[1.02] transition-all cursor-pointer group border border-violet-100 relative"
                    onClick={() => { setEditingProject(proj); setProjectModalOpen(true); }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600">
                        <School size={20} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-green-100 text-green-600' :
                          isClosed ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {isActive ? '진행 중' : isClosed ? '수업 종료' : '보관됨'}
                        </span>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setDeletingProjectId(proj.id);
                            setDeletingProjectName(proj.name);
                          }}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                          title="프로젝트 삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <h3 className="font-black text-base mb-1 truncate">{proj.name}</h3>
                    {proj.school_name && <p className="text-xs text-gray-400 mb-3">{proj.school_name}</p>}
                    <div className="flex items-center justify-between mt-auto">
                      <div>
                        <p className="text-xs text-gray-500">{subClassCount}개 반 · {assignedCount}명 담당</p>
                        {proj.end_date && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            ~ {new Date(proj.end_date).toLocaleDateString('ko-KR')}
                          </p>
                        )}
                      </div>
                      {proj.share_token && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            window.open(`/school-project/${proj.share_token}`, '_blank');
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold text-violet-500 hover:text-violet-700 transition-all"
                        >
                          <ExternalLink size={11} /> 공유 URL
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => { setEditingProject(null); setProjectModalOpen(true); }}
                className="surface-card p-6 border-2 border-dashed border-violet-200 hover:border-violet-400 text-center text-violet-400 hover:text-violet-600 transition-all flex flex-col items-center justify-center gap-2 min-h-[140px]"
              >
                <Plus size={24} />
                <span className="text-xs font-bold">새 프로젝트</span>
              </button>
            </div>
          )}
        </div>

        {/* 가이드 & 카탈로그 링크 */}
        <div className="col-span-12 grid grid-cols-2 gap-3">
          <a
            href="/catalog.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-5 py-3.5 surface-card hover:bg-surface-container-high border border-surface-container-high transition-all group"
          >
            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0 group-hover:scale-110 transition-transform">
              <BookMarked size={16} />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">제품 소개</p>
              <p className="text-[11px] text-on-surface-variant">플랜 및 기능 안내</p>
            </div>
            <ArrowRight size={14} className="ml-auto text-on-surface-variant/40 group-hover:text-primary transition-colors" />
          </a>
          <a
            href="/guide.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-5 py-3.5 surface-card hover:bg-surface-container-high border border-surface-container-high transition-all group"
          >
            <div className="w-8 h-8 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary shrink-0 group-hover:scale-110 transition-transform">
              <Map size={16} />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">사용 가이드</p>
              <p className="text-[11px] text-on-surface-variant">처음 시작하는 분께</p>
            </div>
            <ArrowRight size={14} className="ml-auto text-on-surface-variant/40 group-hover:text-secondary transition-colors" />
          </a>
        </div>

        {/* Activity Section */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold font-manrope">최근 학생 활동</h2>
            <button
              onClick={() => { fetchActivityChartData(); setShowActivityChart(true); }}
              title="활동 통계 보기"
              className="p-2 rounded-lg hover:bg-surface-container-high transition-all text-on-surface-variant hover:text-primary"
            >
              <BarChart3 size={18} />
            </button>
          </div>
          <div className="surface-zone p-4 flex flex-col gap-2">
            {loading ? (
               [1, 2, 3].map(i => <div key={i} className="h-16 surface-card animate-pulse rounded-2xl" />)
            ) : activities.length > 0 ? (
              activities.map((act) => (
                <div key={act.id} className="flex items-center gap-4 px-4 py-3.5 rounded-2xl hover:bg-white hover:shadow-sm transition-all cursor-pointer group border border-transparent hover:border-surface-container-high">
                  <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center text-primary shrink-0">
                    <act.icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold truncate">{act.name}</span>
                      <span className="text-[10px] font-black text-primary bg-primary/8 px-2 py-0.5 rounded-md shrink-0 truncate max-w-[120px]">{act.action}</span>
                    </div>
                    {act.content && (
                      <p className="text-[11px] text-on-surface-variant line-clamp-1 leading-snug">{act.content}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-[10px] font-bold text-on-surface-variant/60 whitespace-nowrap">{act.time}</p>
                    {act.class && <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-wider">{act.class}</p>}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 text-center text-on-surface-variant text-sm">
                최근 활동이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Chart Modal */}
      <AnimatePresence>
        {showActivityChart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowActivityChart(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 overflow-y-auto max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <TrendingUp size={20} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight">활동 통계</h2>
                    <p className="text-[11px] text-on-surface-variant/60 font-medium">최근 7일 기준</p>
                  </div>
                </div>
                <button onClick={() => setShowActivityChart(false)} className="w-8 h-8 rounded-xl hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
                  <X size={16} />
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {[
                  { label: '총 활동 기록', value: chartData.totalCount, unit: '건', color: 'bg-primary/10 text-primary' },
                  { label: '참여 학생 수', value: chartData.uniqueStudents, unit: '명', color: 'bg-secondary/10 text-secondary' },
                ].map((item) => (
                  <div key={item.label} className="bg-surface-container-low rounded-2xl p-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 mb-2">{item.label}</p>
                    <p className="text-4xl font-black tracking-tighter">
                      {item.value}
                      <span className={`text-sm font-bold ml-1 ${item.color.split(' ')[1]}`}>{item.unit}</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Daily Bar Chart */}
              <div className="mb-8">
                <h3 className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60 mb-4">일별 활동 추이</h3>
                {chartData.daily.length > 0 ? (
                  <div className="flex items-end gap-2 h-32">
                    {(() => {
                      const max = Math.max(...chartData.daily.map(d => d.count), 1);
                      return chartData.daily.map((d) => (
                        <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5">
                          <span className="text-[10px] font-bold text-on-surface-variant/70">{d.count > 0 ? d.count : ''}</span>
                          <div className="w-full rounded-t-lg bg-primary/15 relative overflow-hidden" style={{ height: '88px' }}>
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${(d.count / max) * 100}%` }}
                              transition={{ duration: 0.5, delay: 0.1 }}
                              className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-lg"
                            />
                          </div>
                          <span className="text-[9px] font-black text-on-surface-variant/50">{d.label}</span>
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-sm text-on-surface-variant/40">데이터 없음</div>
                )}
              </div>

              {/* By Class */}
              {chartData.byClass.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60 mb-4">클래스별 활동 수</h3>
                  <div className="flex flex-col gap-3">
                    {(() => {
                      const max = Math.max(...chartData.byClass.map(c => c.count), 1);
                      return chartData.byClass.map((c, i) => (
                        <div key={c.name} className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-on-surface-variant w-24 shrink-0 truncate">{c.name}</span>
                          <div className="flex-1 bg-surface-container-low rounded-full h-2.5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(c.count / max) * 100}%` }}
                              transition={{ duration: 0.5, delay: 0.1 + i * 0.05 }}
                              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                            />
                          </div>
                          <span className="text-[11px] font-black text-primary w-8 text-right shrink-0">{c.count}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 학교 프로젝트 모달 */}
      <SchoolProjectModal
        isOpen={projectModalOpen}
        onClose={() => { setProjectModalOpen(false); setEditingProject(null); }}
        onSaved={() => fetchMyProjects()}
        editProject={editingProject}
      />

      {/* 학교 프로젝트 삭제 확인 모달 */}
      <AnimatePresence>
        {deletingProjectId && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center text-red-500">
                  <AlertTriangle size={26} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-gray-900">프로젝트 삭제</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    <span className="font-bold text-gray-800">"{deletingProjectName}"</span>을(를)<br />
                    삭제하면 복구할 수 없습니다.
                  </p>
                  <div className="mt-3 p-3 bg-orange-50 rounded-xl text-left space-y-1">
                    <p className="text-xs text-orange-700 font-bold">삭제 시 함께 사라지는 것:</p>
                    <p className="text-xs text-orange-600">• 학교 담당자 공유 URL 접근 불가</p>
                    <p className="text-xs text-orange-600">• 초대된 선생님의 Pro 혜택 만료</p>
                    <p className="text-xs text-gray-500 mt-1">※ 각 반 클래스와 학생 데이터는 유지됩니다</p>
                  </div>
                </div>
                <div className="flex gap-3 w-full mt-2">
                  <button
                    onClick={() => { setDeletingProjectId(null); setDeletingProjectName(''); }}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-black text-sm transition-all"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDeleteProject}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-sm transition-all active:scale-95"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Dashboard;
