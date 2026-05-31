import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, User as UserIcon, BookOpen, Clock, Activity,
  Sparkles, CheckCircle2, ThumbsUp, Loader2, Pencil, Trash2,
  Check, X, FolderOpen, AlignLeft, Link2, ImageIcon, File,
  Upload, ExternalLink, Megaphone, MessageSquare, Reply, Send,
  RotateCw, AlertCircle,
} from 'lucide-react';
import { geminiFlash } from '../lib/gemini';

const StudentView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state: locationState } = useLocation();
  const fromClassId: string | undefined = locationState?.fromClassId;
  const [student, setStudent] = useState<any>(null);
  const [observations, setObservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // AI Report States
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSavingInsight, setIsSavingInsight] = useState(false);
  const [insightCopied, setInsightCopied] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Results & Suggestions States
  const [results, setResults] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [studentSuggestions, setStudentSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any>(null);

  // Classmates navigation
  const [classmates, setClassmates] = useState<{ id: string; full_name: string; student_number: string | null }[]>([]);

  // Result Action States
  const [rejectModal, setRejectModal] = useState<{ groupId: string } | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [processingGroupId, setProcessingGroupId] = useState<string | null>(null);

  // Obs Reject States
  const [obsRejectModal, setObsRejectModal] = useState<{ obsId: string } | null>(null);
  const [obsRejectFeedback, setObsRejectFeedback] = useState('');
  const [obsRejectingId, setObsRejectingId] = useState<string | null>(null);

  // Reply States
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [savingReplyId, setSavingReplyId] = useState<string | null>(null);

  const handleSaveReply = async (suggestionId: string) => {
    if (!replyText.trim()) return;
    setSavingReplyId(suggestionId);
    try {
      const { error } = await supabase
        .from('student_suggestions')
        .update({
          teacher_reply: replyText.trim(),
          replied_at: new Date().toISOString(),
          is_reply_read: false
        })
        .eq('id', suggestionId);
      if (error) throw error;
      setStudentSuggestions(prev => prev.map(s =>
        s.id === suggestionId
          ? { ...s, teacher_reply: replyText.trim(), replied_at: new Date().toISOString(), is_reply_read: false }
          : s
      ));
      setReplyingId(null);
      setReplyText('');
      showToast('답변이 저장되었습니다. ✅');
    } catch (err) {
      console.error('Reply save error:', err);
      showToast('저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setSavingReplyId(null);
    }
  };

  // Edit / Delete States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ activity_name: '', content: '', category: '' });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toast
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'error' }[]>([]);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const tid = Date.now().toString();
    setToasts(prev => [...prev, { id: tid, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== tid)), 3500);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    fetchStudentData();
  }, [id]);

  const fetchStudentData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select(`*, classes(name, subject, teacher_id, weekly_plan)`)
        .eq('id', id)
        .single();
      if (studentError) throw studentError;
      setStudent(studentData);
      if (studentData.behavior_insight) setAiInsight(studentData.behavior_insight);

      // 같은 반 학생 목록 조회 (번호순)
      const { data: classmatesData } = await supabase
        .from('students')
        .select('id, full_name, student_number')
        .eq('class_id', studentData.class_id)
        .order('student_number', { ascending: true });
      const sorted = (classmatesData || []).slice().sort((a: any, b: any) => {
        const na = parseInt(a.student_number);
        const nb = parseInt(b.student_number);
        const aHas = !isNaN(na) && a.student_number !== null && a.student_number !== '';
        const bHas = !isNaN(nb) && b.student_number !== null && b.student_number !== '';
        if (aHas && bHas) return na - nb;
        if (aHas) return -1;
        if (bHas) return 1;
        return a.full_name.localeCompare(b.full_name, 'ko');
      });
      setClassmates(sorted);

      const { data: obsData, error: obsError } = await supabase
        .from('observations')
        .select('*')
        .eq('student_id', id)
        .order('created_at', { ascending: false });
      if (obsError) throw obsError;
      setObservations(obsData || []);
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }

    // results & suggestions 병렬 조회
    setResultsLoading(true);
    setSuggestionsLoading(true);
    const [resResult, sugResult] = await Promise.all([
      supabase.from('student_results').select('*').eq('student_id', id).order('created_at', { ascending: false }),
      supabase.from('student_suggestions').select('*').eq('student_id', id).order('created_at', { ascending: false })
    ]);
    if (!resResult.error) setResults(resResult.data || []);
    setResultsLoading(false);
    if (!sugResult.error) setStudentSuggestions(sugResult.data || []);
    setSuggestionsLoading(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('이 결과물을 삭제하시겠습니까?\n복구할 수 없습니다.')) return;
    setProcessingGroupId(groupId);
    try {
      const groupItems = results.filter((r: any) => (r.submission_group || r.id) === groupId);
      const storagePaths = groupItems.map((r: any) => r.storage_path).filter(Boolean);
      if (storagePaths.length > 0) {
        await supabase.storage.from('student-attachments').remove(storagePaths);
      }
      if (groupItems[0]?.submission_group) {
        await supabase.from('student_results').delete().eq('submission_group', groupId);
      } else {
        await supabase.from('student_results').delete().eq('id', groupId);
      }
      setResults((prev: any[]) => prev.filter((r: any) => (r.submission_group || r.id) !== groupId));
      setSelectedResult(null);
      showToast('삭제되었습니다.');
    } catch {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setProcessingGroupId(null);
    }
  };

  const handleRejectGroup = async (feedback: string) => {
    if (!rejectModal) return;
    const { groupId } = rejectModal;
    setProcessingGroupId(groupId);
    try {
      const firstItem = results.find((r: any) => (r.submission_group || r.id) === groupId);
      if (firstItem?.submission_group) {
        await supabase.from('student_results')
          .update({ status: 'rejected', rejection_feedback: feedback.trim() || null })
          .eq('submission_group', groupId);
      } else {
        await supabase.from('student_results')
          .update({ status: 'rejected', rejection_feedback: feedback.trim() || null })
          .eq('id', groupId);
      }
      setResults((prev: any[]) => prev.map((r: any) =>
        (r.submission_group || r.id) === groupId
          ? { ...r, status: 'rejected', rejection_feedback: feedback.trim() || null }
          : r
      ));
      setSelectedResult((prev: any) =>
        prev && (prev.submission_group || prev.id) === groupId
          ? { ...prev, status: 'rejected', rejection_feedback: feedback.trim() || null }
          : prev
      );
      setRejectModal(null);
      setRejectFeedback('');
      showToast('반려 처리됐습니다. 학생이 수정 후 재제출할 수 있습니다.');
    } catch {
      showToast('처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setProcessingGroupId(null);
    }
  };

  const handleDownloadResult = (result: any) => {
    const { data } = supabase.storage.from('student-attachments').getPublicUrl(result.storage_path);
    const link = document.createElement('a');
    link.href = data.publicUrl;
    link.download = result.display_name || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApprove = async (obsId: string) => {
    setApprovingId(obsId);
    try {
      const { error } = await supabase
        .from('observations')
        .update({ status: 'approved' })
        .eq('id', obsId);
      if (!error) {
        setObservations(prev => prev.map(o => o.id === obsId ? { ...o, status: 'approved' } : o));
      }
    } catch (err) {
      console.error('승인 처리 오류:', err);
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectObs = async (obsId: string, feedback: string) => {
    setObsRejectingId(obsId);
    try {
      const { error } = await supabase
        .from('observations')
        .update({ status: 'rejected', teacher_feedback: feedback.trim() || null })
        .eq('id', obsId);
      if (!error) {
        setObservations(prev => prev.map(o =>
          o.id === obsId ? { ...o, status: 'rejected', teacher_feedback: feedback.trim() || null } : o
        ));
      }
    } catch (err) {
      console.error('반려 처리 오류:', err);
    } finally {
      setObsRejectingId(null);
      setObsRejectModal(null);
      setObsRejectFeedback('');
    }
  };

  const handleApproveFromRejected = async (obsId: string) => {
    setObsRejectingId(obsId);
    try {
      const { error } = await supabase
        .from('observations')
        .update({ status: 'approved', teacher_feedback: null })
        .eq('id', obsId);
      if (!error) {
        setObservations(prev => prev.map(o =>
          o.id === obsId ? { ...o, status: 'approved', teacher_feedback: null } : o
        ));
      }
    } finally {
      setObsRejectingId(null);
    }
  };

  const handleStartEdit = (obs: any) => {
    setEditingId(obs.id);
    setEditForm({
      activity_name: obs.activity_name || '',
      content: obs.content || '',
      category: obs.category || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ activity_name: '', content: '', category: '' });
  };

  const handleSaveEdit = async (obsId: string) => {
    if (!editForm.activity_name.trim()) {
      showToast('활동 제목을 입력해주세요.', 'error');
      return;
    }
    setSavingId(obsId);
    try {
      const { error } = await supabase
        .from('observations')
        .update({
          activity_name: editForm.activity_name.trim(),
          content: editForm.content.trim(),
          category: editForm.category.trim() || null
        })
        .eq('id', obsId);
      if (error) throw error;
      setObservations(prev => prev.map(o =>
        o.id === obsId
          ? { ...o, activity_name: editForm.activity_name.trim(), content: editForm.content.trim(), category: editForm.category.trim() || o.category }
          : o
      ));
      setEditingId(null);
      showToast('수정되었습니다.');
    } catch (err: any) {
      showToast('수정 중 오류가 발생했습니다.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (obsId: string) => {
    if (!confirm('이 기록을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.')) return;
    setDeletingId(obsId);
    try {
      const { error } = await supabase.from('observations').delete().eq('id', obsId);
      if (error) throw error;
      setObservations(prev => prev.filter(o => o.id !== obsId));
      showToast('삭제되었습니다.');
    } catch (err: any) {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const saveInsight = async (text: string) => {
    if (!id) return;
    setIsSavingInsight(true);
    try {
      await supabase.from('students').update({ behavior_insight: text }).eq('id', id);
      showToast('행동특성 초안이 저장되었습니다. ✅');
    } catch {
      showToast('저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSavingInsight(false);
    }
  };

  const copyInsight = () => {
    if (!aiInsight) return;
    navigator.clipboard.writeText(aiInsight);
    setInsightCopied(true);
    setTimeout(() => setInsightCopied(false), 2000);
  };

  const generateAIInsight = async () => {
    if (observations.length === 0) return;
    setIsGeneratingAI(true);
    try {
      const activitiesContext = observations.map(obs =>
        `[${obs.activity_name}] ${obs.content}`
      ).join('\n---\n');

      const prompt = `당신은 담임교사를 돕는 AI 교육 전문가입니다.
다음은 "${student?.full_name}" 학생의 수업별 활동 기록입니다.

${activitiesContext}

위 내용을 바탕으로 아래 두 가지를 작성해 주세요.

[학생 특성 요약] (3문장 이내)
학생의 학습 태도, 주요 관심사, 핵심 역량을 간결하게 요약하세요.

[행동특성 및 종합의견 초안] (2~3문단)
생활기록부 "행동특성 및 종합의견"란에 담임교사가 입력할 수 있는 수준으로 작성하세요.
학생의 인성, 학습 태도, 성장 가능성을 포함하며 전문적이고 긍정적인 어조로 작성하세요.
(HTML 없이 순수 텍스트, 나이스 시스템에 바로 붙여넣기 가능한 형태)`;

      const result = await geminiFlash.generateContent(prompt);
      const text = result.response.text();
      setAiInsight(text);
      await saveInsight(text);
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
      className="p-4 md:p-8 max-w-7xl mx-auto font-pretendard space-y-6 md:space-y-8 pb-20"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={() => navigate(`/classroom?id=${fromClassId || student?.class_id}`)}
          className="flex items-center gap-2 px-4 py-2 hover:bg-surface-container rounded-xl text-on-surface-variant font-bold transition-all group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          돌아가기
        </button>

        {/* 학생 네비게이션 */}
        {classmates.length > 1 && (() => {
          const currentIdx = classmates.findIndex(s => s.id === id);
          const prev = currentIdx > 0 ? classmates[currentIdx - 1] : null;
          const next = currentIdx < classmates.length - 1 ? classmates[currentIdx + 1] : null;
          const label = (s: typeof prev) => s ? [s.student_number ? `${s.student_number}번` : null, s.full_name].filter(Boolean).join(' ') : '';
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={() => prev && navigate(`/student-view/${prev.id}`, { state: { fromClassId } })}
                disabled={!prev}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary rounded-xl text-sm font-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title={label(prev)}
              >
                <ArrowLeft size={15} />
                {prev ? label(prev) : '이전 학생'}
              </button>

              <span className="text-[11px] font-black text-on-surface-variant/40 px-2">
                {currentIdx + 1} / {classmates.length}
              </span>

              <button
                onClick={() => next && navigate(`/student-view/${next.id}`, { state: { fromClassId } })}
                disabled={!next}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary rounded-xl text-sm font-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title={label(next)}
              >
                {next ? label(next) : '다음 학생'}
                <ArrowLeft size={15} className="rotate-180" />
              </button>
            </div>
          );
        })()}

        <span className="px-4 py-1.5 bg-primary/10 text-primary rounded-full text-[11px] font-black uppercase tracking-widest border border-primary/20">
          Integrated Student Record
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Profile & AI */}
        <div className="lg:col-span-4 space-y-8">
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

          {/* AI Insight — 행동특성 및 종합의견 */}
          <div className="surface-card p-8 shadow-ambient bg-gradient-to-br from-primary/5 via-white to-secondary/5 border-primary/10 relative overflow-hidden">
            <div className="absolute right-[-10%] top-[-10%] text-primary/5 rotate-12 pointer-events-none"><Sparkles size={120} /></div>
            <div className="flex items-center justify-between gap-3 mb-2 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-primary">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-primary tracking-tight">행동특성 및 종합의견 초안</h3>
                  <p className="text-[10px] font-bold text-on-surface-variant/50 mt-0.5">나이스 생기부 → 행동특성 및 종합의견란에 붙여넣기</p>
                </div>
              </div>
              {isSavingInsight && (
                <span className="text-[10px] font-bold text-primary/50 shrink-0">저장 중...</span>
              )}
            </div>
            <div className="relative z-10">
              {aiInsight ? (
                <div className="space-y-4">
                  <div className="bg-white/70 rounded-2xl p-4 border border-primary/10">
                    <p className="text-sm font-medium leading-relaxed text-on-surface/90 whitespace-pre-wrap">{aiInsight}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={copyInsight}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all border ${
                        insightCopied
                          ? 'bg-secondary/10 text-secondary border-secondary/30'
                          : 'bg-white text-on-surface-variant border-neutral-200 hover:border-primary/30 hover:text-primary'
                      }`}
                    >
                      {insightCopied ? <><CheckCircle2 size={13} /> 복사됨!</> : <><CheckCircle2 size={13} /> 나이스 붙여넣기용 복사</>}
                    </button>
                    <button
                      onClick={generateAIInsight}
                      disabled={isGeneratingAI}
                      className="text-[10px] font-black text-primary/40 hover:text-primary transition-colors underline underline-offset-4 disabled:opacity-50"
                    >
                      {isGeneratingAI ? '재생성 중...' : '다시 생성하기'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                  <p className="text-xs font-bold text-on-surface-variant/60">
                    모든 수업 활동 기록을 종합하여<br />생기부 행동특성 및 종합의견 초안을 생성합니다.
                  </p>
                  <button
                    onClick={generateAIInsight}
                    disabled={isGeneratingAI || observations.length === 0}
                    className="w-full py-3.5 btn-gradient rounded-xl font-black text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isGeneratingAI ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <><Sparkles size={14} /> 행동특성 초안 생성</>
                    )}
                  </button>
                  {observations.length === 0 && (
                    <p className="text-[10px] text-error/60 font-bold">기록이 최소 1개 이상 필요합니다.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Timeline */}
        <div className="lg:col-span-8 surface-card p-10 shadow-ambient border-white/60 min-h-[600px] flex flex-col">
          <div className="flex items-center justify-between border-b border-surface-container pb-6 mb-8">
            <h2 className="text-xl font-black flex items-center gap-3">
              <Activity size={24} className="text-primary" />
              과목 통합 활동 타임라인
            </h2>
            <div className="px-3 py-1.5 bg-neutral-100 rounded-lg text-xs font-bold text-neutral-500">
              총 {observations.length}건
            </div>
          </div>

          <div className="flex-1 space-y-8">
            {observations.length > 0 ? (
              <div className="relative border-l-2 border-neutral-100 ml-4 space-y-10 pb-8">
                {observations.map((obs) => {
                  const isEditing = editingId === obs.id;
                  const isDeleting = deletingId === obs.id;

                  return (
                    <div key={obs.id} className="relative pl-8 group">
                      <div className="absolute left-[-9px] top-1 w-4 h-4 rounded-full bg-white border-4 border-primary group-hover:scale-125 group-hover:border-secondary transition-all shadow-sm" />

                      {isEditing ? (
                        /* ── 인라인 수정 폼 ── */
                        <div className="bg-primary/[0.03] border-2 border-primary/20 rounded-2xl p-5 space-y-3">
                          {/* 주차 선택 칩 */}
                          {(() => {
                            const weeklyPlan: { week: number; topic: string }[] = student?.classes?.weekly_plan || [];
                            if (weeklyPlan.length === 0) return null;
                            const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
                            const activeWeek = weeklyPlan.find(p => norm(p.topic) === norm(editForm.activity_name))?.week ?? null;
                            return (
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-primary uppercase tracking-widest">주차 선택</label>
                                <div className="flex flex-wrap gap-1.5">
                                  {weeklyPlan.map(p => (
                                    <button
                                      key={p.week}
                                      type="button"
                                      onClick={() => setEditForm(prev => ({ ...prev, activity_name: p.topic }))}
                                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all ${
                                        activeWeek === p.week
                                          ? 'bg-primary text-white border-primary'
                                          : 'bg-white text-neutral-400 border-neutral-200 hover:border-primary/40 hover:text-primary'
                                      }`}
                                    >
                                      {p.week}주차<span className={`ml-1 text-[9px] ${activeWeek === p.week ? 'text-white/70' : 'text-neutral-300'}`}>· {p.topic}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2 space-y-1">
                              <label className="text-[10px] font-black text-primary uppercase tracking-widest">활동 제목 *</label>
                              <input
                                type="text"
                                value={editForm.activity_name}
                                onChange={e => setEditForm(prev => ({ ...prev, activity_name: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-white rounded-xl text-sm font-bold border-2 border-primary/10 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">카테고리</label>
                              <input
                                type="text"
                                value={editForm.category}
                                onChange={e => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                                placeholder="예: 국어, 수학..."
                                className="w-full px-4 py-2.5 bg-white rounded-xl text-sm font-bold border-2 border-surface-container focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">활동 내용</label>
                            <textarea
                              value={editForm.content}
                              onChange={e => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                              rows={5}
                              className="w-full px-4 py-3 bg-white rounded-xl text-sm font-medium leading-relaxed border-2 border-surface-container focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10 resize-none transition-all"
                            />
                          </div>
                          <div className="flex gap-3 pt-1">
                            <button
                              onClick={() => handleSaveEdit(obs.id)}
                              disabled={savingId === obs.id}
                              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-black text-xs hover:bg-primary/80 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
                            >
                              {savingId === obs.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                              저장
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="flex items-center gap-2 px-5 py-2.5 bg-surface-container text-on-surface-variant rounded-xl font-black text-xs hover:bg-surface-container-high active:scale-95 transition-all"
                            >
                              <X size={13} /> 취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── 일반 카드 ── */
                        <>
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                            <div>
                              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                <span className="inline-block px-2.5 py-1 bg-surface-container text-[10px] font-black uppercase text-on-surface-variant/60 rounded border border-neutral-200 tracking-widest">
                                  {obs.category || '활동'}
                                </span>
                                {(() => {
                                  const weeklyPlan: {week: number; topic: string}[] = student?.classes?.weekly_plan || [];
                                  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
                                  const matched = weeklyPlan.find(p => norm(p.topic) === norm(obs.activity_name || ''));
                                  if (!matched) return null;
                                  return (
                                    <span className="inline-block px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-black rounded border border-primary/20">
                                      {matched.week}주차
                                    </span>
                                  );
                                })()}
                              </div>
                              <h4 className="text-lg font-black tracking-tight text-on-surface group-hover:text-primary transition-colors">
                                {obs.activity_name}
                              </h4>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant/40">
                                <Clock size={12} />
                                {new Date(obs.created_at).toLocaleDateString('ko-KR')}
                              </span>
                              {/* 수정/삭제 버튼: 호버 시 표시 */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleStartEdit(obs)}
                                  title="수정"
                                  className="w-7 h-7 rounded-lg bg-surface-container hover:bg-primary/10 hover:text-primary flex items-center justify-center text-on-surface-variant transition-all"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => handleDelete(obs.id)}
                                  disabled={isDeleting}
                                  title="삭제"
                                  className="w-7 h-7 rounded-lg bg-surface-container hover:bg-error/10 hover:text-error flex items-center justify-center text-on-surface-variant transition-all disabled:opacity-50"
                                >
                                  {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-100/50 text-sm font-medium text-on-surface/80 leading-relaxed group-hover:bg-primary/[0.02] group-hover:border-primary/10 transition-colors whitespace-pre-wrap">
                            {obs.content}
                          </div>

                          {obs.is_student_record && (
                            <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
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
                                    {approvingId === obs.id ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
                                    승인하기
                                  </button>
                                </div>
                              ) : obs.status === 'rejected' ? (
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="flex items-center gap-1.5 text-[10px] font-black text-red-500 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg">
                                    <X size={11} /> 반려됨
                                  </span>
                                  {obs.teacher_feedback && (
                                    <span className="text-[10px] font-bold text-red-600/80 italic">"{obs.teacher_feedback}"</span>
                                  )}
                                  <button
                                    onClick={() => handleApproveFromRejected(obs.id)}
                                    disabled={obsRejectingId === obs.id}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-black hover:bg-emerald-100 transition-all disabled:opacity-50"
                                  >
                                    {obsRejectingId === obs.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                                    반려 취소
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5 text-[10px] font-black text-secondary uppercase tracking-widest">
                                    <CheckCircle2 size={12} /> Student Submitted · 승인 완료
                                  </div>
                                  <button
                                    onClick={() => { setObsRejectModal({ obsId: obs.id }); setObsRejectFeedback(''); }}
                                    disabled={obsRejectingId === obs.id}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-[10px] font-black hover:bg-amber-100 transition-all disabled:opacity-50"
                                  >
                                    <RotateCw size={11} /> 반려
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center space-y-6 text-on-surface-variant/40 py-20">
                <div className="w-24 h-24 rounded-full bg-neutral-50 flex items-center justify-center border border-neutral-100">
                  <BookOpen size={40} className="opacity-20" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-black tracking-tight text-on-surface-variant/60">활동 기록이 없습니다.</p>
                  <p className="text-xs font-bold mt-2">학생이 활동을 등록하거나 선생님이 관찰 내용을 작성하면<br />여기에 타임라인으로 표시됩니다.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 결과 제출 목록 ─── */}
      <div className="surface-card p-8 shadow-ambient border border-white/60">
        <div className="flex items-center justify-between mb-6 pb-5 border-b border-surface-container">
          <h2 className="text-xl font-black flex items-center gap-3">
            <FolderOpen size={22} className="text-primary" />
            결과 제출 목록
          </h2>
          <span className="px-3 py-1.5 bg-neutral-100 rounded-lg text-xs font-bold text-neutral-500">
            총 {results.length}건
          </span>
        </div>

        {resultsLoading ? (
          <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin text-primary" /></div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center py-12 space-y-3 opacity-30">
            <FolderOpen size={48} />
            <p className="font-black">제출된 결과물이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map(r => {
              const typeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
                text:  { icon: <AlignLeft size={16} />,  color: 'text-primary bg-primary/10',       label: '텍스트' },
                link:  { icon: <Link2 size={16} />,      color: 'text-blue-500 bg-blue-50',         label: '링크' },
                image: { icon: <ImageIcon size={16} />,  color: 'text-emerald-500 bg-emerald-50',   label: '이미지' },
                file:  { icon: <File size={16} />,       color: 'text-amber-500 bg-amber-50',       label: '파일' }
              };
              const cfg = typeConfig[r.result_type] || typeConfig.file;
              const publicUrl = r.storage_path
                ? supabase.storage.from('student-attachments').getPublicUrl(r.storage_path).data.publicUrl
                : null;

              const isRejected = r.status === 'rejected';
              const groupId = r.submission_group || r.id;
              const isProcessing = processingGroupId === groupId;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedResult({ ...r, publicUrl, cfg })}
                  className={`p-5 rounded-2xl border-2 bg-surface-container-low hover:shadow-md transition-all group cursor-pointer ${
                    isRejected
                      ? 'border-red-200 bg-red-50/30 hover:border-red-300'
                      : 'border-surface-container hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.color}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {r.title && <p className="font-black text-sm group-hover:text-primary transition-colors">{r.title}</p>}
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        {isRejected && (
                          <span className="text-[9px] font-black text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <X size={9} /> 반려됨
                          </span>
                        )}
                      </div>

                      {r.text_content && (
                        <p className="text-xs font-medium text-on-surface/80 leading-relaxed line-clamp-2 whitespace-pre-wrap">
                          {r.text_content}
                        </p>
                      )}

                      {r.link_url && (
                        <p className="text-xs font-bold text-blue-500 flex items-center gap-1 truncate">
                          <ExternalLink size={11} />{r.link_url}
                        </p>
                      )}

                      {r.result_type === 'image' && publicUrl && (
                        <img
                          src={publicUrl}
                          alt={r.title || '이미지'}
                          className="max-h-24 rounded-xl object-cover mt-1"
                        />
                      )}

                      {r.result_type === 'file' && (
                        <p className="text-xs font-bold text-amber-600 flex items-center gap-1">
                          <File size={11} />{r.display_name}
                          {r.file_size ? ` (${formatFileSize(r.file_size)})` : ''}
                        </p>
                      )}

                      <p className="text-[10px] font-bold text-on-surface-variant/40 flex items-center gap-1">
                        <Clock size={10} />{formatRelativeTime(r.created_at)}
                      </p>
                    </div>
                    <div className="w-6 h-6 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant/40 group-hover:text-primary group-hover:bg-primary/10 transition-all shrink-0 mt-1">
                      <ExternalLink size={12} />
                    </div>
                  </div>
                  {/* 삭제/반려 버튼 (hover) */}
                  <div className="flex gap-2 pt-3 mt-2 border-t border-surface-container opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isRejected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRejectModal({ groupId });
                          setRejectFeedback('');
                        }}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 rounded-xl font-black text-xs transition-all"
                      >
                        <RotateCw size={11} /> 반려
                      </button>
                    )}
                    {isRejected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRejectGroup('');
                          // 반려 취소: status를 submitted로 되돌리기
                          setResults((prev: any[]) => prev.map((item: any) =>
                            (item.submission_group || item.id) === groupId
                              ? { ...item, status: 'submitted', rejection_feedback: null }
                              : item
                          ));
                          supabase.from('student_results')
                            .update({ status: 'submitted', rejection_feedback: null })
                            .eq(r.submission_group ? 'submission_group' : 'id', groupId);
                        }}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-xl font-black text-xs transition-all"
                      >
                        <Check size={11} /> 반려 취소
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup(groupId);
                      }}
                      disabled={isProcessing}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 rounded-xl font-black text-xs transition-all"
                    >
                      {isProcessing ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} 삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── 건의사항 ─── */}
      <div className="surface-card p-8 shadow-ambient border border-white/60">
        <div className="flex items-center justify-between mb-6 pb-5 border-b border-surface-container">
          <h2 className="text-xl font-black flex items-center gap-3">
            <Megaphone size={22} className="text-primary" />
            건의사항
          </h2>
          <span className="px-3 py-1.5 bg-neutral-100 rounded-lg text-xs font-bold text-neutral-500">
            총 {studentSuggestions.length}건
          </span>
        </div>

        {suggestionsLoading ? (
          <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin text-primary" /></div>
        ) : studentSuggestions.length === 0 ? (
          <div className="flex flex-col items-center py-12 space-y-3 opacity-30">
            <Megaphone size={48} />
            <p className="font-black">등록된 건의사항이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {studentSuggestions.map(s => {
              const isReplying = replyingId === s.id;
              return (
                <div
                  key={s.id}
                  className="rounded-2xl border border-surface-container bg-surface-container-low overflow-hidden transition-all hover:border-primary/20"
                >
                  {/* 학생 건의 내용 */}
                  <div className="flex items-start gap-4 p-5">
                    <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
                      <MessageSquare size={16} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium text-on-surface leading-relaxed">{s.content}</p>
                      <p className="text-[10px] font-bold text-on-surface-variant/40 flex items-center gap-1">
                        <Clock size={10} />{formatRelativeTime(s.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* 답변 영역 */}
                  {isReplying ? (
                    <div className="border-t border-surface-container bg-primary/[0.02] p-5 space-y-3">
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        rows={3}
                        autoFocus
                        placeholder="학생에게 전달할 답변을 입력하세요..."
                        className="w-full px-4 py-3 bg-white rounded-xl text-sm font-medium border border-neutral-200 focus:border-primary/40 focus:outline-none resize-none transition-all"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveReply(s.id)}
                          disabled={savingReplyId === s.id || !replyText.trim()}
                          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/80 disabled:opacity-50 transition-all shadow-sm"
                        >
                          {savingReplyId === s.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                          답변 저장
                        </button>
                        <button
                          onClick={() => { setReplyingId(null); setReplyText(''); }}
                          className="px-5 py-2.5 text-neutral-400 rounded-xl text-xs font-black hover:bg-neutral-100 transition-all"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : s.teacher_reply ? (
                    <div className="border-t border-primary/10 bg-primary/[0.03] p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary shrink-0 mt-0.5">
                          <Reply size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-1.5">선생님 답변</p>
                          <p className="text-sm font-medium text-on-surface leading-relaxed">{s.teacher_reply}</p>
                          {s.replied_at && (
                            <p className="text-[10px] font-bold text-on-surface-variant/30 mt-1.5 flex items-center gap-1">
                              <Clock size={10} />{formatRelativeTime(s.replied_at)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => { setReplyingId(s.id); setReplyText(s.teacher_reply); }}
                          className="text-xs font-black text-primary/50 hover:text-primary transition-colors shrink-0 px-3 py-1.5 rounded-lg hover:bg-primary/10"
                        >
                          수정
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-surface-container px-5 py-3">
                      <button
                        onClick={() => { setReplyingId(s.id); setReplyText(''); }}
                        className="text-sm font-black text-primary/60 hover:text-primary flex items-center gap-2 transition-colors"
                      >
                        <Reply size={14} /> 답변 작성
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── 결과 상세 모달 ─── */}
      <AnimatePresence>
        {selectedResult && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              {/* 모달 헤더 */}
              <div className="flex items-start justify-between p-8 pb-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedResult.title && (
                      <h3 className="text-xl font-black tracking-tight">{selectedResult.title}</h3>
                    )}
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${selectedResult.cfg.color}`}>
                      {selectedResult.cfg.label}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-on-surface-variant/50 flex items-center gap-1">
                    <Clock size={11} />{new Date(selectedResult.created_at).toLocaleString('ko-KR')}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedResult(null)}
                  className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-all shrink-0 ml-4"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 모달 내용 */}
              <div className="px-8 pb-8 space-y-4 max-h-[65vh] overflow-y-auto">
                {selectedResult.text_content && (
                  <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <p className="text-sm font-medium text-on-surface leading-relaxed whitespace-pre-wrap">
                      {selectedResult.text_content}
                    </p>
                  </div>
                )}

                {selectedResult.link_url && (
                  <a
                    href={selectedResult.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100 hover:border-blue-300 transition-colors group"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
                      <Link2 size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-0.5">링크</p>
                      <p className="text-sm font-bold text-blue-500 group-hover:underline truncate">{selectedResult.link_url}</p>
                    </div>
                    <ExternalLink size={16} className="text-blue-400 shrink-0" />
                  </a>
                )}

                {selectedResult.result_type === 'image' && selectedResult.publicUrl && (
                  <div className="space-y-3">
                    <img
                      src={selectedResult.publicUrl}
                      alt={selectedResult.title || '이미지'}
                      className="w-full rounded-2xl object-contain border border-neutral-100 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(selectedResult.publicUrl, '_blank')}
                    />
                    <button
                      onClick={() => handleDownloadResult(selectedResult)}
                      className="w-full py-3 flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-black text-sm rounded-xl border border-emerald-200 transition-all"
                    >
                      <Upload size={16} className="rotate-180" /> 이미지 다운로드
                    </button>
                  </div>
                )}

                {selectedResult.result_type === 'file' && (
                  <div className="flex items-center gap-4 p-5 bg-amber-50 rounded-2xl border border-amber-100">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-500 shrink-0">
                      <File size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-on-surface">{selectedResult.display_name}</p>
                      {selectedResult.file_size && (
                        <p className="text-xs font-bold text-amber-500 mt-0.5">{formatFileSize(selectedResult.file_size)}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDownloadResult(selectedResult)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl transition-all shadow-sm"
                    >
                      <Upload size={14} className="rotate-180" /> 다운로드
                    </button>
                  </div>
                )}
                {/* 반려됨 피드백 표시 */}
                {selectedResult.status === 'rejected' && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                    <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-red-600 mb-1">반려된 결과물</p>
                      {selectedResult.rejection_feedback && (
                        <p className="text-xs font-bold text-red-700 leading-relaxed">{selectedResult.rejection_feedback}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* 모달 액션 푸터 */}
              <div className="px-8 pb-6 pt-4 border-t border-neutral-100 flex gap-3">
                {selectedResult.status !== 'rejected' ? (
                  <button
                    onClick={() => {
                      setRejectModal({ groupId: selectedResult.submission_group || selectedResult.id });
                      setRejectFeedback('');
                    }}
                    disabled={!!processingGroupId}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 rounded-2xl font-black text-sm transition-all"
                  >
                    <RotateCw size={14} /> 반려 (재작성 요청)
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      const gId = selectedResult.submission_group || selectedResult.id;
                      await supabase.from('student_results')
                        .update({ status: 'submitted', rejection_feedback: null })
                        .eq(selectedResult.submission_group ? 'submission_group' : 'id', gId);
                      setResults((prev: any[]) => prev.map((r: any) =>
                        (r.submission_group || r.id) === gId
                          ? { ...r, status: 'submitted', rejection_feedback: null } : r
                      ));
                      setSelectedResult((prev: any) => prev ? { ...prev, status: 'submitted', rejection_feedback: null } : null);
                      showToast('반려를 취소했습니다.');
                    }}
                    disabled={!!processingGroupId}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-2xl font-black text-sm transition-all"
                  >
                    <Check size={14} /> 반려 취소
                  </button>
                )}
                <button
                  onClick={() => handleDeleteGroup(selectedResult.submission_group || selectedResult.id)}
                  disabled={!!processingGroupId}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 rounded-2xl font-black text-sm transition-all"
                >
                  {processingGroupId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} 삭제
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 관찰기록 반려 모달 */}
      <AnimatePresence>
        {obsRejectModal && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="font-black text-lg">관찰기록 반려</h3>
                  <p className="text-sm text-on-surface-variant/70 mt-1">학생에게 전달할 피드백을 입력하세요. (선택사항)</p>
                </div>
                <textarea
                  value={obsRejectFeedback}
                  onChange={e => setObsRejectFeedback(e.target.value)}
                  placeholder="예: 활동 내용이 너무 간략합니다. 구체적인 활동 과정을 추가해서 다시 제출해주세요."
                  className="w-full min-h-[100px] p-4 rounded-xl border border-neutral-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-200"
                  autoFocus
                />
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => handleRejectObs(obsRejectModal.obsId, obsRejectFeedback)}
                  disabled={!!obsRejectingId}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm transition-all disabled:opacity-50"
                >
                  {obsRejectingId ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
                  반려 처리하기
                </button>
                <button
                  onClick={() => { setObsRejectModal(null); setObsRejectFeedback(''); }}
                  className="px-5 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 rounded-2xl font-black text-sm transition-all"
                >
                  취소
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 결과물 반려 피드백 입력 모달 */}
      <AnimatePresence>
        {rejectModal && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="font-black text-lg">반려 처리</h3>
                  <p className="text-sm text-on-surface-variant/70 mt-1">학생에게 전달할 피드백을 입력하세요. (선택사항)</p>
                </div>
                <textarea
                  value={rejectFeedback}
                  onChange={e => setRejectFeedback(e.target.value)}
                  placeholder="예: 결과물에 핵심 내용이 빠져 있습니다. 다시 작성해주세요."
                  className="w-full min-h-[100px] p-4 rounded-xl border border-neutral-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-200"
                  autoFocus
                />
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => handleRejectGroup(rejectFeedback)}
                  disabled={!!processingGroupId}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm transition-all disabled:opacity-50"
                >
                  {processingGroupId ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
                  반려 처리하기
                </button>
                <button
                  onClick={() => { setRejectModal(null); setRejectFeedback(''); }}
                  className="px-5 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 rounded-2xl font-black text-sm transition-all"
                >
                  취소
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[2000] flex flex-col gap-3 items-center pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={`px-8 py-4 rounded-2xl shadow-2xl text-sm font-black flex items-center gap-3 pointer-events-auto ${
                toast.type === 'error' ? 'bg-error text-white' : 'bg-neutral-900 text-white'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${toast.type === 'error' ? 'bg-white/60' : 'bg-primary animate-pulse'}`} />
              {toast.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default StudentView;
