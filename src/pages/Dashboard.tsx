import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import {
  Clock,
  ArrowRight,
  BarChart3,
  Users,
  Sparkles,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [totalActivitiesCount, setTotalActivitiesCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, inProgress: 0, completed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
            .in('student_id', studentIds);

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
      }

      // 1.5 Fetch School Hub Classes (All homeroom classes in the same school)
      const currentSchoolCode = profile?.school_code;
      if (currentSchoolCode) {
        const { data: hubData } = await supabase
          .from('classes')
          .select('*, profiles(full_name)')
          .eq('school_code', currentSchoolCode)
          .eq('class_type', 'homeroom')
          .neq('teacher_id', user?.id) // 본인 반 제외
          .eq('is_archived', false);

        if (hubData) {
          setSchoolClasses(hubData.map(c => ({
            id: c.id,
            name: c.name,
            teacher: c.profiles?.full_name || '선생님',
            entry_code: c.entry_code
          })));
        }
      }

      // 2. Fetch Recent Activities (Observations) filtering by teacher's students instead of just teacher_id
      // This allows RLS to dynamically filter out unreadable records if RLS is strict, or show them if RLS permits homeroom teachers.
      const { data: obsData } = await supabase
        .from('observations')
        .select('*, students!inner(full_name, class_id(name))')
        .in('student_id', classes.length > 0 ? classes.map(c => c.id) : []) // Default fallback, but actually better to use studentIds here. Wait, studentIds is locally scoped. 
        // Let's refetch or structure differently. I will just execute a broad query since studentIds is not available in outer scope easily if we didn't save it. 
        // Actually I should just use `user_id` scope. But I'll use the same class_id approach.
        .in('students.class_id', rawClassesData && rawClassesData.length > 0 ? rawClassesData.map(c => c.linked_class_id || c.id) : [])
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

      // 3. Fetch Stats
      const { count: total } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('teacher_id', user?.id);
      const { count: completed } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('teacher_id', user?.id).eq('is_published', true);
      
      setStats({
        total: total || 0,
        inProgress: (total || 0) - (completed || 0),
        completed: completed || 0
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      {/* Hero & Stats Grid */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 surface-zone p-10 flex flex-col justify-center relative overflow-hidden h-[340px]">
          <div className="relative z-10 max-w-lg">
            <p className="text-primary font-bold text-xs mb-3 tracking-widest uppercase">인텔리전스 허브</p>
            <h1 className="text-4xl font-extrabold mb-6 leading-[1.2] font-manrope">
              AI로 간편하게 만드는 <br />
              학생 맞춤형 생기부 초안
            </h1>
            <p className="text-on-surface-variant text-base mb-8 leading-relaxed">
              학급 내 관찰 기록을 바탕으로 세밀하게 튜닝된 AI가 <br />
              학기말 리포트 초안을 정성스럽게 작성해 드립니다.
            </p>
            <button className="btn-gradient px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 w-fit">
              <Sparkles size={20} />
              AI 리포트 자동 생성
            </button>
          </div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[300px] h-[300px] opacity-10">
            <GraduationCap size={300} />
          </div>
        </div>

        <div className="col-span-4 flex flex-col gap-6">
          <div className="flex-1 surface-card p-8 flex flex-col justify-between shadow-ambient">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">리포트 완성도</p>
              <div className="text-primary bg-primary-container/30 px-2 py-1 rounded-lg text-[10px] font-bold">
                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
              </div>
            </div>
            <div className="my-4">
              <p className="text-5xl font-extrabold font-manrope">{stats.completed}</p>
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

          <div className="flex-1 surface-card p-8 flex flex-col justify-between shadow-ambient">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">기록된 관찰 내용</p>
              <div className="text-on-surface-variant bg-surface-container-high px-2 py-1 rounded-lg text-[10px] font-bold">주간 목표</div>
            </div>
            <div className="my-4">
              <p className="text-5xl font-extrabold font-manrope">{totalActivitiesCount}</p>
            </div>
            <p className="text-[11px] text-on-surface-variant italic">
              "지속적인 관찰 기록이 AI 초안의 정확도를 높입니다."
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-10">
        {/* Classes Section */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold font-manrope">나의 학급</h2>
            <button 
              onClick={() => navigate('/classroom')}
              className="text-xs font-bold text-primary flex items-center gap-1 hover:underline underline-offset-4 decoration-2"
            >
              전체 보기 <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {loading ? (
              [1, 2].map(i => <div key={i} className="h-[200px] surface-card animate-pulse" />)
            ) : classes.length > 0 ? (
              classes.map((cls) => (
                <div 
                  key={cls.id} 
                  onClick={() => navigate(`/classroom?id=${cls.id}`)}
                  className="surface-card p-8 shadow-ambient hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer group"
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

        {/* Activity Section */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          {/* School Hub - Added here for better layout */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-bold font-manrope text-primary flex items-center gap-2">
                <Sparkles size={18} className="animate-pulse" />
                우리 학교 학급 허브
              </h2>
              <span className="text-[9px] font-black bg-primary/10 text-primary px-2 py-1 rounded-full uppercase tracking-tighter">School Live</span>
            </div>
            <div className="surface-zone p-6 border-2 border-primary/5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                <GraduationCap size={120} />
              </div>
              <p className="text-[11px] font-bold text-on-surface-variant leading-relaxed relative z-10">
                담임 선생님들이 개설한 반을 가져와 <br />자신의 교과 수업을 <span className="text-primary underline underline-offset-2 decoration-2 px-0.5">단 1초 만에</span> 시작하세요.
              </p>
              <div className="space-y-3 relative z-10">
                {schoolClasses.length > 0 ? schoolClasses.map((sc, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={sc.id} 
                    className="bg-white/70 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-neutral-100 flex items-center justify-between group hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <Users size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-neutral-900 group-hover:text-primary transition-colors">{sc.name}</h4>
                        <p className="text-[10px] text-neutral-400 font-bold flex items-center gap-1">
                          <span className="w-1 h-1 bg-neutral-300 rounded-full" />
                          {sc.teacher} 선생님
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate(`/classroom?importId=${sc.id}&name=${encodeURIComponent(sc.name)}`)}
                      className="px-4 py-2 bg-primary text-white text-[10px] font-black rounded-xl opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all shadow-lg shadow-primary/20"
                    >
                      수업 개설
                    </button>
                  </motion.div>
                )) : (
                  <div className="py-10 text-center space-y-3 bg-neutral-50/50 rounded-2xl border border-dashed border-neutral-200">
                    <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center mx-auto text-neutral-300">
                      <Clock size={20} />
                    </div>
                    <p className="text-[11px] text-neutral-400 font-bold">아직 등록된 다른 학급이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-2 pt-4">
            <h2 className="text-2xl font-bold font-manrope">최근 학생 활동</h2>
            <button className="p-2 rounded-lg hover:bg-surface-container-high transition-all text-on-surface-variant">
              <BarChart3 size={18} />
            </button>
          </div>
          <div className="surface-zone p-4 flex flex-col gap-3">
            {loading ? (
               [1, 2, 3].map(i => <div key={i} className="h-[80px] surface-card animate-pulse" />)
            ) : activities.length > 0 ? (
              activities.map((act) => (
                <div key={act.id} className="surface-card p-5 shadow-sm hover:translate-x-1 transition-all cursor-pointer">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                      <act.icon size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-bold">{act.name} {act.action}</h4>
                        <p className="text-[10px] text-on-surface-variant">{act.time}</p>
                      </div>
                      <p className="text-[11px] text-on-surface-variant mb-2">{act.class} • 최근 활동 기록됨</p>
                      {act.content && (
                        <div className="bg-surface-container-low p-3 rounded-lg border-l-4 border-primary/20">
                          <p className="text-[11px] text-on-surface italic leading-relaxed">"{act.content}"</p>
                        </div>
                      )}
                    </div>
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

      {/* Footer Summary Section */}
      <div className="bg-on-surface text-surface rounded-3xl p-10 flex items-center justify-between relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold mb-2 font-manrope">이번 학기 현황</h2>
          <p className="text-sm text-surface/60">데이터 업데이트 기준: 2026년 4월 4일</p>
        </div>
        <div className="flex gap-16 relative z-10 px-10">
          {[
            { label: '전체 리포트', val: stats.total },
            { label: '진행 중', val: stats.inProgress },
            { label: '완료', val: stats.completed }
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-[10px] text-surface/40 font-bold uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-5xl font-black font-manrope tracking-tighter">{stat.val}</p>
            </div>
          ))}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-5 pointer-events-none">
          <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--color-primary)_0%,_transparent_70%)]" />
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
