import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, User as UserIcon, BookOpen, Clock, Activity, FileText, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface StudentDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
}

const StudentDetailDrawer = ({ isOpen, onClose, studentId }: StudentDetailDrawerProps) => {
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStudentDetail = async () => {
      if (!studentId || !isOpen) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('students')
          .select(`
            *,
            observations(id, content, activity_name, created_at, is_student_record, status)
          `)
          .eq('id', studentId)
          .single();

        if (error) throw error;
        setStudent(data);
      } catch (err) {
        console.error('Error fetching student detail for drawer:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentDetail();
  }, [studentId, isOpen]);

  const handleNavigateToFullPage = () => {
    if (studentId) {
      navigate(`/student-view/${studentId}`);
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000]">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-neutral-900/20 backdrop-blur-sm"
        />
        
        {/* Drawer */}
        <motion.div 
          initial={{ x: '100%', boxShadow: '-20px 0 40px rgba(0,0,0,0)' }}
          animate={{ x: 0, boxShadow: '-20px 0 40px rgba(0,0,0,0.1)' }}
          exit={{ x: '100%', boxShadow: '-20px 0 40px rgba(0,0,0,0)' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="absolute top-0 right-0 h-full w-full max-w-md bg-surface border-l border-white/40 flex flex-col overflow-hidden text-on-surface"
        >
          {/* Drawer Header */}
          <header className="p-6 border-b border-surface-container-high flex flex-col gap-6 bg-white/50 backdrop-blur-xl shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex gap-4 items-center">
                <div className="w-14 h-14 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-[1.25rem] flex items-center justify-center text-primary shadow-inner">
                  <UserIcon size={24} strokeWidth={2} />
                </div>
                <div>
                  {loading ? (
                    <div className="h-6 w-24 bg-surface-container animate-pulse rounded-md mb-2" />
                  ) : (
                    <h2 className="text-2xl font-black tracking-tight">{student?.full_name}</h2>
                  )}
                  {loading ? (
                     <div className="h-4 w-12 bg-surface-container animate-pulse rounded-md" />
                  ) : (
                    <span className="px-2 py-0.5 bg-surface-container-high text-[10px] font-black uppercase text-on-surface-variant/60 rounded border border-neutral-200">
                       {student?.student_number ? `${student.student_number}번` : '정보 없음'}
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 -mr-2 text-on-surface-variant/40 hover:text-on-surface hover:bg-surface-container rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleNavigateToFullPage}
                className="flex-1 py-3 bg-on-surface text-surface rounded-xl text-xs font-black hover:bg-primary transition-all shadow-soft active:scale-95 flex items-center justify-center gap-2"
              >
                <BookOpen size={14} /> 전체 기록실 이동
              </button>
            </div>
          </header>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 bg-surface-container-low/30">
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 bg-surface-container/50 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : (
              <>
                {/* Quick AI Summary Hook */}
                <div className="p-5 layered-card rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border-primary/10 relative overflow-hidden group">
                   <div className="absolute -right-4 -top-4 text-primary/10 group-hover:rotate-12 transition-transform duration-500"><Sparkles size={60} /></div>
                   <div className="relative z-10 flex items-center gap-2 mb-3">
                      <Sparkles size={16} className="text-primary" />
                      <h4 className="text-[11px] font-black uppercase tracking-widest text-primary">AI Quick Insight</h4>
                   </div>
                   <p className="text-sm font-bold text-on-surface-variant leading-relaxed relative z-10 line-clamp-3">
                     {student?.observations?.length > 0 ? 
                       "누적된 관찰 기록을 분석하여 학생의 주요 성장 키워드와 성취도를 시각적으로 시뮬레이션 할 수 있습니다."
                       : "아직 등록된 활동 기록이 없습니다. 새로운 관찰 기록을 추가하여 AI 분석을 시작하세요."}
                   </p>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 bg-white rounded-2xl shadow-sm border border-neutral-100 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-secondary/60">
                         <Activity size={14} />
                         <span className="text-[9px] font-black uppercase tracking-widest">Total Activities</span>
                      </div>
                      <span className="text-2xl font-black">{student?.observations?.length || 0}</span>
                   </div>
                   <div className="p-4 bg-white rounded-2xl shadow-sm border border-neutral-100 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-primary/60">
                         <FileText size={14} />
                         <span className="text-[9px] font-black uppercase tracking-widest">Reports</span>
                      </div>
                      <span className="text-2xl font-black">0</span>
                   </div>
                </div>

                {/* Recent Activity Mini List */}
                <div className="space-y-4">
                   <h4 className="text-xs font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                      <Clock size={14} /> Recent Activities
                   </h4>
                   {student?.observations?.length > 0 ? (
                     <div className="space-y-3">
                       {student.observations.slice(0, 3).map((obs: any) => (
                         <div key={obs.id} className="p-4 bg-white rounded-2xl shadow-sm border border-neutral-100/50 hover:border-primary/20 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] font-bold text-on-surface-variant/40">
                                {new Date(obs.created_at).toLocaleDateString('ko-KR')}
                              </p>
                              {obs.is_student_record && (
                                obs.status === 'pending' ? (
                                  <span className="flex items-center gap-1 text-[9px] font-black text-amber-500 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                    <Clock size={9} /> 승인대기
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[9px] font-black text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-md">
                                    <CheckCircle2 size={9} /> 승인완료
                                  </span>
                                )
                              )}
                            </div>
                            <p className="text-sm font-black text-on-surface/80">{obs.activity_name}</p>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <div className="p-6 text-center border-2 border-dashed border-neutral-200 rounded-2xl">
                        <p className="text-xs font-bold text-neutral-400">최근 활동 기록이 없습니다.</p>
                     </div>
                   )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default StudentDetailDrawer;
