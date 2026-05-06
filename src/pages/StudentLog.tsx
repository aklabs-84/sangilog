import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  User,
  Bell,
  MessageSquare,
  History,
  Trophy,
  Send,
  Save,
  Lightbulb,
  ArrowLeft,
  BookOpen,
  CheckCircle,
  CheckCircle2,
  Loader2,
  Clock,
  FileText,
  Paperclip,
  Upload,
  Download,
  Pencil,
  Trash2,
  X,
  File
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { geminiFlash } from '../lib/gemini';

const StudentLog = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'record' | 'history' | 'badges' | 'materials' | 'files'>('record');
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [guidePrompt, setGuidePrompt] = useState<string>('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{reason: string, guide: string} | null>(null);
  
  // Resources State
  const [classResources, setClassResources] = useState<any[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  // File Attachments State
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form States
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [feeling, setFeeling] = useState('');

  useEffect(() => {
    const sessionData = sessionStorage.getItem('student_session');
    if (!sessionData) {
      alert('입장 정보가 유효하지 않습니다. 다시 수업에 입장해 주세요.');
      navigate('/classroom-entry');
      return;
    }
    
    const parsed = JSON.parse(sessionData);
    setSession(parsed);
    fetchClassDetails(parsed.class_id);
  }, []);

  const fetchClassDetails = async (classId: string) => {
    try {
      const { data } = await supabase
        .from('classes')
        .select('teacher_id, student_guide_prompt, weekly_plan')
        .eq('id', classId)
        .single();
      
      if (data) {
        setTeacherId(data.teacher_id);
        setGuidePrompt(data.student_guide_prompt || '수업 시간에 배운 내용과 본인의 활동 역할을 구체적으로 작성하세요.');
        if (data.weekly_plan && Array.isArray(data.weekly_plan) && data.weekly_plan.length > 0) {
          setClassResources(data.weekly_plan);
          // Set initial title to first topic if available
          setTitle(data.weekly_plan[0].topic);
        }
      }
    } catch (err) {
      console.error('Error fetching teacher info:', err);
    } finally {
      setLoading(false);
    }
  };

  // MY HISTORY 탭용 이전 기록 조회
  const fetchHistory = async () => {
    if (!session?.student_id) return;
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('observations')
        .select('*')
        .eq('student_id', session.student_id)
        .eq('is_student_record', true)
        .order('created_at', { ascending: false });

      if (!error && data) setHistoryLogs(data);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchResources = async () => {
    // We already fetch weekly_plan from class_resources state in fetchClassDetails
    // But if we're mixing with legacy resources, we could fetch them here.
    // For now, let's keep the existing logic alongside weekly_plan.
    if (!session?.class_id) return;
    setResourcesLoading(true);
    try {
      const { data, error } = await supabase
        .from('class_resources')
        .select('*')
        .eq('class_id', session.class_id)
        .order('created_at', { ascending: false });

      if (!error && data) {
         // Merge legacy resources with weekly plans visually later, 
         // but for compatibility we might just leave this.
      }
    } catch (err) {
      console.error('Error fetching resources:', err);
    } finally {
      setResourcesLoading(false);
    }
  };

  const fetchAttachments = async () => {
    if (!session?.student_id || !session?.class_id) return;
    setAttachmentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_attachments')
        .select('*')
        .eq('student_id', session.student_id)
        .eq('class_id', session.class_id)
        .order('created_at', { ascending: false });
      if (!error && data) setAttachments(data);
    } catch (err) {
      console.error('Error fetching attachments:', err);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.student_id || !session?.class_id) return;

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      alert('파일 크기는 10MB를 초과할 수 없습니다.');
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const storagePath = `${session.student_id}/${session.class_id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('student-attachments')
        .upload(storagePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('student_attachments')
        .insert({
          student_id: session.student_id,
          class_id: session.class_id,
          storage_path: storagePath,
          display_name: file.name,
          file_size: file.size,
          file_type: file.type
        });
      if (dbError) throw dbError;

      await fetchAttachments();
    } catch (err: any) {
      alert('업로드 중 오류: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachment: any) => {
    if (!confirm(`"${attachment.display_name}" 파일을 삭제하시겠습니까?`)) return;
    try {
      await supabase.storage.from('student-attachments').remove([attachment.storage_path]);
      await supabase.from('student_attachments').delete().eq('id', attachment.id);
      setAttachments(prev => prev.filter(a => a.id !== attachment.id));
    } catch (err: any) {
      alert('삭제 중 오류: ' + err.message);
    }
  };

  const handleDownloadAttachment = async (attachment: any) => {
    const { data } = supabase.storage
      .from('student-attachments')
      .getPublicUrl(attachment.storage_path);
    const link = document.createElement('a');
    link.href = data.publicUrl;
    link.download = attachment.display_name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRenameAttachment = async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      const { error } = await supabase
        .from('student_attachments')
        .update({ display_name: renameValue.trim() })
        .eq('id', id);
      if (error) throw error;
      setAttachments(prev => prev.map(a => a.id === id ? { ...a, display_name: renameValue.trim() } : a));
      setRenamingId(null);
      setRenameValue('');
    } catch (err: any) {
      alert('이름 변경 중 오류: ' + err.message);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleTabChange = (tab: 'record' | 'history' | 'badges' | 'materials' | 'files') => {
    setActiveTab(tab);
    if (tab === 'history') fetchHistory();
    if (tab === 'materials') fetchResources();
    if (tab === 'files') fetchAttachments();
  };

  const formatRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    const hour = Math.floor(min / 60);
    const day = Math.floor(hour / 24);
    if (min < 1) return '방금 전';
    if (min < 60) return `${min}분 전`;
    if (hour < 24) return `${hour}시간 전`;
    return `${day}일 전`;
  };

  const handleSubmit = async () => {
    if (!title || !content) {
      alert('활동 제목과 내용을 입력해주세요.');
      return;
    }

    if (!session?.student_id || !teacherId) return;

    setSubmitting(true);
    try {
      if (guidePrompt) {
        const prompt = `
당신은 학생이 제출한 활동 기록을 정성껏 검토하고, 학생이 성실하게 참여했는지 판단하는 따뜻한 AI 가이드입니다.
선생님의 지침(guidePrompt)을 참고하되, 학생이 수업에 능동적으로 참여했다는 진심이 느껴진다면 가급적 수용(pass)하는 방향으로 평가하세요.

[교사의 지침]
${guidePrompt}

[학생이 제출한 활동 정보]
제목: "${title}"
내용: "${content}"
배운 점 및 느낀 점: "${feeling}"

평가 기준:
1. 단순히 'ㅋ'나 'ㅎ' 같은 장난스러운 표현만 있거나, 내용이 아예 없는 '성의 부족'인 경우에만 반려(reject) 처리하세요.
2. 문법적 완성도보다는 학생이 해당 활동에서 무엇을 했고, 어떤 기분을 느꼈는지 '진정성'이 보인다면 승인(pass)하세요.
3. 지침을 완전히 따르지 않더라도, 수업 내용과 관련된 의미 있는 기록이라면 수용하세요.

응답은 반드시 아래 순수 JSON 형식으로만 반환하세요 (백틱이나 마크다운 없이 {} 로 시작):
{
  "status": "pass" | "reject",
  "reason": "반려 시에만 작성: 어떤 점이 장난스럽거나 성의가 부족했는지 친절히 설명 (승인 시 빈 문자열)",
  "guide": "반려 시에만 작성: 학생이 기운 잃지 않고 조금만 더 보완할 수 있도록 구체적인 격려와 팁 제공 (승인 시 빈 문자열)"
}
`;
        const aiResult = await geminiFlash.generateContent(prompt);
        const aiResponseText = aiResult.response.text();
        // Remove potential markdown blocks
        const cleanedJson = aiResponseText.replace(/^```json/g, '').replace(/```$/g, '').trim();
        const parsed = JSON.parse(cleanedJson);

        if (parsed.status === 'reject') {
          setAiFeedback({ reason: parsed.reason, guide: parsed.guide });
          setIsRejectModalOpen(true);
          setSubmitting(false);
          return;
        }
      }

      // 1. 활동 기록 저장 (observations) - 교사 승인 대기 상태로 저장
      const { error: obsError } = await supabase
        .from('observations')
        .insert({
          teacher_id: teacherId,
          student_id: session.student_id,
          activity_name: title,
          content: `${content}\n\n[배운 점 및 느낀 점]\n${feeling}`,
          is_student_record: true,
          status: 'pending',
          category: session?.subject || '학생 제출'
        });

      if (obsError) throw obsError;

      // 2. 교사에게 실시간 알림 전송 (notifications 테이블 INSERT)
      await supabase
        .from('notifications')
        .insert({
          user_id: teacherId,
          title: `📝 ${session.student_name}이(가) 활동을 제출했습니다`,
          content: `"${title}" — ${session.class_name}`,
          type: 'student_submission'
        });

      alert('제출 완료! 선생님 승인 후 최종 기록에 반영됩니다.');
      setTitle('');
      setContent('');
      setFeeling('');
      handleTabChange('history');
      
    } catch (err: any) {
      alert('저장 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col p-6">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-6 py-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white rotate-3 shadow-lg shadow-primary/20">
            <GraduationCap size={24} />
          </div>
          <h1 className="text-xl font-black font-manrope tracking-tighter">생기로그</h1>
        </div>
        
        <div className="flex items-center gap-6">
          <button className="p-2.5 rounded-xl bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all"><Bell size={20} /></button>
          <div className="flex items-center gap-4 pl-4 border-l border-surface-container">
            <div className="text-right">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-0.5">STUDENT LOG</p>
              <p className="text-sm font-black">{session?.student_name}</p>
            </div>
            <div className="w-12 h-12 rounded-[1rem] bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/10">
              <User size={24} />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full py-10 space-y-12">
        {/* Session Card & Identity */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="col-span-1 md:col-span-8 glass p-12 rounded-[3.5rem] flex items-center justify-between relative overflow-hidden border border-white/20 shadow-ambient h-[280px] group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <p className="text-primary font-black text-[11px] uppercase tracking-[0.3em]">Current Active Session</p>
              </div>
              <h2 className="text-5xl font-black font-manrope tracking-tighter leading-[0.9]">{session?.class_name}</h2>
              <h3 className="text-3xl font-bold text-on-surface-variant/40 font-manrope">{session?.subject} 과목</h3>
            </div>
            <div className="absolute right-10 bottom-[-40px] opacity-10 group-hover:rotate-12 transition-transform duration-700">
              <BookOpen size={200} />
            </div>
          </div>

          <div className="col-span-1 md:col-span-4 glass p-10 rounded-[3rem] border border-white/20 shadow-ambient flex flex-col justify-center relative overflow-hidden">
            <div className="absolute -top-10 -left-10 text-primary/5"><User size={120} /></div>
            <div className="relative z-10 space-y-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] opacity-60">Verified Participant</p>
                <h3 className="text-3xl font-black font-manrope">{session?.student_name}</h3>
              </div>
              <div className="pt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-on-surface-variant">
                  <CheckCircle size={16} className="text-secondary" />
                  <span>{session?.class_name} 참여 중</span>
                </div>
                <p className="text-[11px] text-on-surface-variant/60 font-bold ml-6">{new Date().toLocaleDateString('ko-KR')} 기록 활성화</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Card with Tabs */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-card rounded-[3.5rem] shadow-ambient overflow-hidden border border-surface-container-highest"
        >
          {/* Tab Bar */}
          <div className="p-6 border-b border-surface-container bg-surface-container-low/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex bg-surface-container p-2 rounded-2xl shadow-inner border border-surface-container-highest/20 w-fit">
              {[
                { key: 'record' as const, icon: MessageSquare, label: '관찰 기록' },
                { key: 'history' as const, icon: History, label: '나의 기록' },
                { key: 'files' as const, icon: Paperclip, label: '첨부 파일' },
                { key: 'materials' as const, icon: BookOpen, label: '수업 자료' },
                { key: 'badges' as const, icon: Trophy, label: '나의 배지' }
              ].map((tab) => (
                <button 
                  key={tab.key} 
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-[10px] font-black tracking-[0.1em] transition-all ${
                    activeTab === tab.key ? 'bg-white text-primary shadow-md scale-105' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'record' && (
              <div className="flex items-center gap-6">
                <button className="px-10 py-5 text-sm font-black text-on-surface-variant hover:text-on-surface transition-all flex items-center gap-3 opacity-60 hover:opacity-100 whitespace-nowrap">
                  <Save size={20} />
                  임시 저장
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-14 py-5 btn-gradient rounded-[1.25rem] font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-3 group relative overflow-hidden disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="animate-spin" /> : (
                    <>
                      <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      활동 기록 제출하기
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Tab Contents */}
          <AnimatePresence mode="wait">
            {/* ─── RECORD FORM 탭 ─── */}
            {activeTab === 'record' && (
              <motion.div
                key="record"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-12 space-y-12"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between ml-2">
                    <label className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">활동 주제</label>
                    <span className="text-[10px] text-on-surface-variant/40 font-bold">* 명확한 핵심 활동명을 입력하세요</span>
                  </div>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예: 구운몽의 환상 구조와 주제 의식 탐구"
                    className="w-full px-10 py-6 bg-neutral-100 rounded-3xl text-xl font-black focus:ring-8 focus:ring-primary/10 transition-all border-2 border-neutral-200/50 focus:border-primary/30 shadow-inner"
                  />
                </div>
                {classResources && classResources.length > 0 && classResources[0]?.topic && (
                    <div className="space-y-4">
                      <label className="text-[11px] font-black text-primary uppercase tracking-[0.2em] ml-2">선생님이 등록한 주차별 주제 선택</label>
                      <div className="relative">
                        <select 
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full px-10 py-4 bg-surface-container/30 rounded-2xl text-base font-bold focus:ring-4 focus:ring-primary/10 transition-all border-2 border-primary/20 focus:border-primary/50 text-primary appearance-none cursor-pointer"
                        >
                          <option value="">항목을 선택하면 활동 주제창에 자동으로 붙여넣기 됩니다</option>
                          {classResources.map((item: any, idx: number) => (
                            <option key={idx} value={item.topic}>
                              {item.week}주차: {item.topic}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-primary/60">▼</div>
                      </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-primary uppercase tracking-[0.2em] ml-2">주요 활동 내용</label>
                    <textarea 
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="오늘 수업에서 내가 어떤 역할을 맡았고, 어떤 구체적인 활동 과정을 거쳤는지 자세히 입력하세요..."
                      className="w-full min-h-[350px] p-10 bg-neutral-100/80 backdrop-blur-sm rounded-[2.5rem] text-base leading-relaxed font-semibold focus:ring-8 focus:ring-primary/10 transition-all border-2 border-neutral-200/50 focus:border-primary/30 resize-none shadow-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-10">
                    <div className="space-y-4 flex-1">
                      <label className="text-[11px] font-black text-primary uppercase tracking-[0.2em] ml-2">배운 점 및 느낀 점</label>
                      <textarea 
                        value={feeling}
                        onChange={(e) => setFeeling(e.target.value)}
                        placeholder="활동을 통해 새롭게 깨달은 지식, 확장된 호기심, 또는 어려웠던 점을 어떻게 해결했는지 기록하세요."
                        className="w-full min-h-[220px] p-10 bg-neutral-100/80 backdrop-blur-sm rounded-[2.5rem] text-sm leading-relaxed font-bold focus:ring-8 focus:ring-primary/10 transition-all border-2 border-neutral-200/50 focus:border-primary/30 resize-none shadow-sm"
                      />
                    </div>

                    <div className="glass p-10 rounded-[2.5rem] flex items-start gap-6 border border-primary/10 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-2 h-full bg-primary/20 group-hover:bg-primary transition-all duration-500" />
                      <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-primary shadow-sm mt-1 shrink-0">
                        <Lightbulb size={24} />
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-black text-lg text-primary tracking-tight">작성 팁 (Saenggi Tips)</h4>
                        <p className="text-sm text-on-surface leading-relaxed font-bold opacity-80">
                          {guidePrompt || '수동적인 학습 태도보다는 본인이 직접 시도한 능동적인 탐구 과정을 중심으로 작성하는 것이 생활기록부 작성에 큰 도움이 됩니다.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── MY HISTORY 탭 ─── */}
            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-12 space-y-6 min-h-[400px]"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <History size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black font-manrope">제출 기록 이력</h3>
                    <p className="text-on-surface-variant text-sm font-bold mt-1">내가 지금까지 제출한 활동 기록 목록입니다.</p>
                  </div>
                </div>

                {historyLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 size={36} className="animate-spin text-primary" />
                  </div>
                ) : historyLogs.length > 0 ? (
                  <div className="space-y-4">
                    {historyLogs.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-6 bg-surface-container-low rounded-3xl border border-surface-container hover:border-primary/20 transition-all group cursor-default"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-1">
                              <FileText size={18} />
                            </div>
                            <div className="space-y-1">
                              <p className="font-black text-base group-hover:text-primary transition-colors">{log.activity_name}</p>
                              <p className="text-sm text-on-surface-variant font-medium leading-relaxed line-clamp-2">{log.content}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-right">
                            <div className="space-y-1">
                              <span className="text-[10px] font-black text-secondary uppercase tracking-widest bg-secondary/10 px-2 py-0.5 rounded-md block">{log.category}</span>
                              <p className="text-[11px] text-on-surface-variant font-bold flex items-center gap-1 justify-end">
                                <Clock size={10} />
                                {formatRelativeTime(log.created_at)}
                              </p>
                            </div>
                            {log.status === 'pending' ? (
                              <div className="flex flex-col items-center gap-1">
                                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                                  <Clock size={14} className="text-amber-500" />
                                </div>
                                <span className="text-[9px] font-black text-amber-500 uppercase tracking-wider">대기중</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <CheckCircle2 size={18} className="text-secondary" />
                                <span className="text-[9px] font-black text-secondary uppercase tracking-wider">승인됨</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 space-y-4 opacity-30">
                    <History size={64} />
                    <p className="font-black text-lg">아직 제출한 기록이 없습니다.</p>
                    <p className="text-sm font-bold">RECORD FORM 탭에서 활동을 작성하고 제출해보세요.</p>
                  </div>
                )}
              </motion.div>
            )}


            {/* ─── CLASS MATERIALS 탭 ─── */}
            {activeTab === 'materials' && (
              <motion.div
                key="materials"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-12 space-y-6 min-h-[400px]"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black font-manrope">수업 자료실</h3>
                    <p className="text-on-surface-variant text-sm font-bold mt-1">선생님이 공유해주신 참고 자료 링크 모음입니다.</p>
                  </div>
                </div>

                {resourcesLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 size={36} className="animate-spin text-primary" />
                  </div>
                ) : classResources && classResources.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {classResources.map((res, idx) => (
                      <a
                        key={idx}
                        href={res.url && res.url.startsWith('http') ? res.url : `https://${res.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-6 bg-surface-container-low rounded-3xl border border-surface-container hover:border-primary/30 hover:shadow-lg transition-all group flex items-start gap-4 cursor-pointer relative overflow-hidden"
                      >
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all">
                          <BookOpen size={100} />
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary shrink-0 mt-1 relative z-10">
                          {res.week ? (
                            <span className="text-xs font-black">{res.week}</span>
                          ) : (
                            <BookOpen size={20} />
                          )}
                        </div>
                        <div className="flex-1 overflow-hidden space-y-1 relative z-10">
                          <p className="font-black text-base truncate group-hover:text-primary transition-colors">
                            {res.topic || res.title || '수업 자료'}
                          </p>
                          <p className="text-[11px] text-on-surface-variant truncate opacity-60 font-medium">{res.url}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-surface-container group-hover:bg-primary/10 flex items-center justify-center shrink-0 text-on-surface-variant group-hover:text-primary transition-colors relative z-10">
                          <ArrowLeft size={14} className="rotate-[135deg]" />
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 space-y-4 opacity-30">
                    <BookOpen size={64} />
                    <p className="font-black text-lg">아직 등록된 수업 자료가 없습니다.</p>
                    <p className="text-sm font-bold">선생님이 자료를 공유해주시면 이곳에 표시됩니다.</p>
                  </div>
                )}
              </motion.div>
            )}
            {/* ─── FILE ATTACHMENTS 탭 ─── */}
            {activeTab === 'files' && (
              <motion.div
                key="files"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-12 space-y-8 min-h-[400px]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                      <Paperclip size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black font-manrope">첨부 파일</h3>
                      <p className="text-on-surface-variant text-sm font-bold mt-1">수업 관련 활동 파일을 업로드하고 관리하세요. (최대 10MB)</p>
                    </div>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-3 px-8 py-4 btn-gradient rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.03] active:scale-95 transition-all disabled:opacity-50"
                  >
                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                    {uploading ? '업로드 중...' : '파일 업로드'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                {attachmentsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 size={36} className="animate-spin text-primary" />
                  </div>
                ) : attachments.length > 0 ? (
                  <div className="space-y-3">
                    {attachments.map((att) => (
                      <motion.div
                        key={att.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-5 bg-surface-container-low rounded-3xl border border-surface-container hover:border-primary/20 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <File size={22} />
                          </div>

                          <div className="flex-1 min-w-0">
                            {renamingId === att.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameAttachment(att.id);
                                    if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                                  }}
                                  autoFocus
                                  className="flex-1 px-4 py-2 bg-white rounded-xl text-sm font-bold border-2 border-primary/30 focus:outline-none focus:border-primary"
                                />
                                <button
                                  onClick={() => handleRenameAttachment(att.id)}
                                  className="p-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all"
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                                <button
                                  onClick={() => { setRenamingId(null); setRenameValue(''); }}
                                  className="p-2 bg-surface-container text-on-surface-variant rounded-xl hover:bg-surface-container-high transition-all"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <p className="font-black text-sm truncate group-hover:text-primary transition-colors">{att.display_name}</p>
                                <p className="text-[11px] text-on-surface-variant font-bold mt-0.5">
                                  {formatFileSize(att.file_size)} · {formatRelativeTime(att.created_at)}
                                </p>
                              </>
                            )}
                          </div>

                          {renamingId !== att.id && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleDownloadAttachment(att)}
                                title="다운로드"
                                className="w-9 h-9 rounded-xl bg-surface-container hover:bg-primary/10 hover:text-primary flex items-center justify-center text-on-surface-variant transition-all"
                              >
                                <Download size={16} />
                              </button>
                              <button
                                onClick={() => { setRenamingId(att.id); setRenameValue(att.display_name); }}
                                title="이름 변경"
                                className="w-9 h-9 rounded-xl bg-surface-container hover:bg-secondary/10 hover:text-secondary flex items-center justify-center text-on-surface-variant transition-all"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteAttachment(att)}
                                title="삭제"
                                className="w-9 h-9 rounded-xl bg-surface-container hover:bg-error/10 hover:text-error flex items-center justify-center text-on-surface-variant transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center py-24 space-y-4 border-2 border-dashed border-surface-container-highest rounded-3xl cursor-pointer hover:border-primary/30 hover:bg-primary/3 transition-all group"
                  >
                    <div className="w-20 h-20 bg-surface-container rounded-3xl flex items-center justify-center text-on-surface-variant/30 group-hover:text-primary/30 transition-colors">
                      <Upload size={40} />
                    </div>
                    <p className="font-black text-lg opacity-40">업로드된 파일이 없습니다.</p>
                    <p className="text-sm font-bold opacity-30">클릭하거나 위 버튼으로 파일을 업로드하세요.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'badges' && (
              <motion.div
                key="badges"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-12 min-h-[400px] flex flex-col items-center justify-center space-y-4 opacity-30"
              >
                <Trophy size={64} />
                <p className="font-black text-xl">뱃지 시스템 준비 중</p>
                <p className="text-sm font-bold text-on-surface-variant">활동 기록을 계속 제출하면 곧 뱃지를 획득할 수 있습니다!</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <button 
          onClick={() => navigate('/classroom-entry')}
          className="flex items-center gap-3 text-on-surface-variant hover:text-primary text-[12px] font-black uppercase tracking-[0.3em] transition-all mx-auto pb-10 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          다른 수업의 참여 코드가 있나요?
        </button>
      </div>

      <AnimatePresence>
        {isRejectModalOpen && aiFeedback && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="w-full max-w-lg bg-white p-10 rounded-[3rem] space-y-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-error/60 to-error" />
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 bg-error/5 text-error rounded-3xl flex items-center justify-center shadow-inner border border-error/10">
                  <Lightbulb size={36} />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-3xl font-black text-slate-900 font-manrope">잠깐만요! ✨</h3>
                <p className="text-sm font-bold text-slate-500">조금만 더 내용을 다듬어볼까요?</p>
              </div>
              
              <div className="space-y-6 pt-4">
                <div className="space-y-2 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <h4 className="text-xs font-black text-error uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-error" /> AI 피드백
                  </h4>
                  <p className="text-sm font-bold text-slate-600 leading-relaxed">{aiFeedback.reason}</p>
                </div>
                <div className="space-y-2 bg-primary/5 p-6 rounded-3xl border border-primary/10">
                  <h4 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" /> 이렇게 해보세요
                  </h4>
                  <p className="text-sm font-bold text-primary/80 leading-relaxed">{aiFeedback.guide}</p>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => setIsRejectModalOpen(false)}
                  className="w-full py-5 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95"
                >
                  내용 수정하러 가기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentLog;

