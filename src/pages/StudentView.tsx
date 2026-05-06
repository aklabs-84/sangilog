import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import {
  ArrowLeft, User as UserIcon, BookOpen, Clock, Activity,
  Sparkles, CheckCircle2, ThumbsUp, Loader2
} from 'lucide-react';
import { geminiFlash } from '../lib/gemini';

const StudentView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<any>(null);
  const [observations, setObservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // AI Report States
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    fetchStudentData();
  }, [id]);

  const fetchStudentData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Fetch Student Profile
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select(`
          *,
          classes(name, subject, teacher_id)
        `)
        .eq('id', id)
        .single();
      
      if (studentError) throw studentError;
      setStudent(studentData);

      // 2. Fetch all observations across subjects
      const { data: obsData, error: obsError } = await supabase
        .from('observations')
        .select('*')
        .eq('student_id', id)
        .order('created_at', { ascending: false });

      if (obsError) throw obsError;
      setObservations(obsData || []);
      
    } catch (error) {
      console.error('Error fetching student integrated data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (obsId: string) => {
    setApprovingId(obsId);
    try {
      const { error } = await supabase
        .from('observations')
        .update({ status: 'approved' })
        .eq('id', obsId);
      if (!error) {
        setObservations(prev =>
          prev.map(o => o.id === obsId ? { ...o, status: 'approved' } : o)
        );
      }
    } catch (err) {
      console.error('승인 처리 오류:', err);
    } finally {
      setApprovingId(null);
    }
  };

  const generateAIInsight = async () => {
    if (observations.length === 0) return;
    setIsGeneratingAI(true);
    
    try {
      const activitiesContext = observations.map(obs => 
        `[${obs.category || '일반'}] ${obs.activity_name}: ${obs.content}`
      ).join('\n---\n');

      const prompt = `
당신은 학생의 여러 과목에 걸친 활동들을 종합적으로 분석하는 AI 교육 전문가입니다.
다음은 "${student?.full_name}" 학생의 과목별 활동 기록입니다.

${activitiesContext}

위 내용을 바탕으로 학생의 학습 성향, 주요 관심사, 역량(장점)을 3문장 이내로 요약해 주시고, 
생활기록부에 들어갈 만한 "종합 세특 초안"을 1문단으로 작성해 주세요. 
(HTML 형태의 마크다운 없이 순수 텍스트로, 내용은 전문적이고 긍정적인 어조로 작성)
      `;

      const result = await geminiFlash.generateContent(prompt);
      setAiInsight(result.response.text());
    } catch (error) {
      console.error('Failed to generate AI Insight:', error);
      setAiInsight('AI 분석 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 max-w-7xl mx-auto font-pretendard space-y-8 pb-20"
    >
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 hover:bg-surface-container rounded-xl text-on-surface-variant font-bold transition-all group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> 
          돌아가기
        </button>
        <span className="px-4 py-1.5 bg-primary/10 text-primary rounded-full text-[11px] font-black uppercase tracking-widest border border-primary/20">
          Integrated Student Record
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Profile & AI AI Insight */}
        <div className="lg:col-span-4 space-y-8">
          {/* Section: Profile */}
          <div className="surface-card p-8 shadow-ambient border border-white/60 text-center relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-primary/10 to-secondary/10" />
             <div className="relative z-10 flex flex-col items-center mt-8">
               <div className="w-24 h-24 bg-white rounded-[2rem] shadow-md flex items-center justify-center text-primary mb-6 group-hover:scale-105 transition-transform">
                 <UserIcon size={40} />
               </div>
               <h1 className="text-3xl font-black tracking-tight mb-2">{student?.full_name}</h1>
               <p className="text-on-surface-variant font-bold text-sm mb-6 flex items-center gap-2 justify-center">
                 <span>{student?.classes?.name || '소속 반 없음'}</span>
                 <span className="w-1 h-1 rounded-full bg-neutral-300" />
                 <span>{student?.student_number ? `${student.student_number}번` : '번호 없음'}</span>
               </p>
               <div className="flex gap-2">
                 <span className="px-3 py-1 bg-surface-container text-[11px] font-black uppercase text-on-surface-variant rounded-lg border border-neutral-200">
                   {student?.tag || '일반 학생'}
                 </span>
               </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-surface-container/50 relative z-10">
               <div className="text-center">
                 <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 mb-1">Total Records</p>
                 <p className="text-2xl font-black text-on-surface">{observations.length}</p>
               </div>
               <div className="text-center">
                 <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 mb-1">Subjects</p>
                 <p className="text-2xl font-black text-on-surface">
                   {new Set(observations.map(o => o.category || '기본')).size}
                 </p>
               </div>
             </div>
          </div>

          {/* Section: AI Insight Embedded */}
          <div className="surface-card p-8 shadow-ambient bg-gradient-to-br from-primary/5 via-white to-secondary/5 border-primary/10 relative overflow-hidden">
             <div className="absolute right-[-10%] top-[-10%] text-primary/5 rotate-12 pointer-events-none"><Sparkles size={120} /></div>
             <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-primary">
                  <Sparkles size={20} />
                </div>
                <h3 className="font-black text-lg text-primary tracking-tight">AI 통합 분석 리포트</h3>
             </div>
             
             <div className="relative z-10">
               {aiInsight ? (
                 <div className="space-y-4">
                   <p className="text-sm font-medium leading-relaxed text-on-surface/90 whitespace-pre-wrap">
                     {aiInsight}
                   </p>
                   <button 
                     onClick={generateAIInsight}
                     disabled={isGeneratingAI}
                     className="text-[10px] font-black text-primary/40 hover:text-primary transition-colors uppercase tracking-widest underline underline-offset-4"
                   >
                     {isGeneratingAI ? '재분석 중...' : '다시 분석하기'}
                   </button>
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                   <p className="text-xs font-bold text-on-surface-variant/60">
                     모든 과목의 활동 기록을 종합하여<br/>핵심 성향과 생기부 초안을 생성합니다.
                   </p>
                   <button 
                     onClick={generateAIInsight}
                     disabled={isGeneratingAI || observations.length === 0}
                     className="w-full py-3.5 btn-gradient rounded-xl font-black text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                   >
                     {isGeneratingAI ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                     ) : (
                        <><Sparkles size={14} /> 종합 분석 시작</>
                     )}
                   </button>
                   {observations.length === 0 && (
                     <p className="text-[10px] text-error/60 mt-2 font-bold">기록이 최소 1개 이상 필요합니다.</p>
                   )}
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* Right Column: Timeline */}
        <div className="lg:col-span-8 surface-card p-10 shadow-ambient border-white/60 min-h-[600px] flex flex-col">
          <div className="flex items-center justify-between border-b border-surface-container pb-6 mb-8">
            <h2 className="text-xl font-black flex items-center gap-3">
              <Activity size={24} className="text-primary" />
              과목 통합 활동 타임라인
            </h2>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-neutral-100 rounded-lg text-xs font-bold text-neutral-500">최신순</div>
            </div>
          </div>
          
          <div className="flex-1 space-y-8">
            {observations.length > 0 ? (
              <div className="relative border-l-2 border-neutral-100 ml-4 space-y-10 pb-8">
                {observations.map((obs) => (
                  <div key={obs.id} className="relative pl-8 group">
                    <div className="absolute left-[-9px] top-1 w-4 h-4 rounded-full bg-white border-4 border-primary group-hover:scale-125 group-hover:border-secondary transition-all shadow-sm" />
                    
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                      <div>
                        {/* Task: Use proper category mapping if needed */}
                        <span className="inline-block px-2.5 py-1 bg-surface-container text-[10px] font-black uppercase text-on-surface-variant/60 rounded border border-neutral-200 mb-2 tracking-widest">
                          {obs.category || '활동'}
                        </span>
                        <h4 className="text-lg font-black tracking-tight text-on-surface group-hover:text-primary transition-colors">
                          {obs.activity_name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-on-surface-variant/40 shrink-0">
                        <Clock size={12} />
                        {new Date(obs.created_at).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                    
                    <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-100/50 text-sm font-medium text-on-surface/80 leading-relaxed group-hover:bg-primary/[0.02] group-hover:border-primary/10 transition-colors whitespace-pre-wrap">
                      {obs.content}
                    </div>

                    {obs.is_student_record && (
                      <div className="mt-3 flex items-center justify-between">
                        {obs.status === 'pending' ? (
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                              <Clock size={11} /> 승인 대기
                            </span>
                            <button
                              onClick={() => handleApprove(obs.id)}
                              disabled={approvingId === obs.id}
                              className="flex items-center gap-1.5 px-4 py-1.5 bg-secondary text-white rounded-lg text-[11px] font-black hover:bg-secondary/80 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
                            >
                              {approvingId === obs.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <ThumbsUp size={12} />
                              )}
                              승인하기
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-secondary uppercase tracking-widest">
                            <CheckCircle2 size={12} /> Student Submitted · 승인 완료
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center space-y-6 text-on-surface-variant/40 py-20">
                <div className="w-24 h-24 rounded-full bg-neutral-50 flex items-center justify-center border border-neutral-100">
                  <BookOpen size={40} className="opacity-20" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-black tracking-tight text-on-surface-variant/60">활동 기록이 없습니다.</p>
                  <p className="text-xs font-bold mt-2">학생이 활동을 등록하거나 선생님이 관찰 내용을 작성하면<br/>여기에 타임라인으로 표시됩니다.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default StudentView;
