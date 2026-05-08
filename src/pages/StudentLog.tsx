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
  Upload,
  Trash2,
  X,
  Pencil,
  Check,
  File,
  ClipboardList,
  AlertCircle,
  FolderOpen,
  AlignLeft,
  Link2,
  ImageIcon,
  ExternalLink,
  Megaphone
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { geminiFlash } from '../lib/gemini';

const StudentLog = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'record' | 'history' | 'badges' | 'materials' | 'results' | 'unit' | 'suggestions'>('record');
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogForm, setEditLogForm] = useState({ activity_name: '', content: '' });
  const [savingLogId, setSavingLogId] = useState<string | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [guidePrompt, setGuidePrompt] = useState<string>('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{reason: string, guide: string} | null>(null);
  
  // Resources State
  const [classResources, setClassResources] = useState<any[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  // Result Submission State
  const [results, setResults] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultType, setResultType] = useState<'text' | 'link' | 'image' | 'file'>('text');
  const [resultTitle, setResultTitle] = useState('');
  const [resultText, setResultText] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [resultSubmitting, setResultSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const resultFileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingResult, setEditingResult] = useState<any>(null);
  const [resultsPage, setResultsPage] = useState(1);
  const RESULTS_PER_PAGE = 5;
  const resultFormRef = useRef<HTMLDivElement | null>(null);

  // Toast State
  const [toasts, setToasts] = useState<{id: string; msg: string; type: 'success' | 'error'}[]>([]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  // Form States
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [feeling, setFeeling] = useState('');

  // Suggestions State
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionContent, setSuggestionContent] = useState('');
  const [suggestionSubmitting, setSuggestionSubmitting] = useState(false);
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [editSuggestionContent, setEditSuggestionContent] = useState('');
  const [savingSuggestionId, setSavingSuggestionId] = useState<string | null>(null);
  const [deletingSuggestionId, setDeletingSuggestionId] = useState<string | null>(null);

  // Unit Submission States
  const [pendingUnits, setPendingUnits] = useState<any[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitPendingCount, setUnitPendingCount] = useState(0);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [unitForm, setUnitForm] = useState<Record<string, any>>({});
  const [unitSubmitting, setUnitSubmitting] = useState(false);

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

      if (error) {
        console.error('fetchHistory RLS/DB 오류:', error);
      }
      if (data) setHistoryLogs(data);
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

  const handleStartEditLog = (log: any) => {
    setEditingLogId(log.id);
    setEditLogForm({ activity_name: log.activity_name || '', content: log.content || '' });
  };

  const handleCancelEditLog = () => {
    setEditingLogId(null);
    setEditLogForm({ activity_name: '', content: '' });
  };

  const handleSaveEditLog = async (logId: string) => {
    if (!editLogForm.activity_name.trim()) {
      showToast('활동 제목을 입력해주세요.', 'error'); return;
    }
    setSavingLogId(logId);
    try {
      const { error } = await supabase
        .from('observations')
        .update({ activity_name: editLogForm.activity_name.trim(), content: editLogForm.content.trim() })
        .eq('id', logId);
      if (error) throw error;
      setHistoryLogs(prev => prev.map(l =>
        l.id === logId ? { ...l, activity_name: editLogForm.activity_name.trim(), content: editLogForm.content.trim() } : l
      ));
      setEditingLogId(null);
      showToast('수정되었습니다.');
    } catch {
      showToast('수정 중 오류가 발생했습니다.', 'error');
    } finally {
      setSavingLogId(null);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    setDeletingLogId(logId);
    try {
      const { error } = await supabase.from('observations').delete().eq('id', logId);
      if (error) throw error;
      setHistoryLogs(prev => prev.filter(l => l.id !== logId));
      showToast('삭제되었습니다.');
    } catch {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setDeletingLogId(null);
    }
  };

  const fetchResults = async () => {
    if (!session?.student_id || !session?.class_id) return;
    setResultsLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_results')
        .select('*')
        .eq('student_id', session.student_id)
        .eq('class_id', session.class_id)
        .order('created_at', { ascending: false });
      if (!error && data) setResults(data);
    } catch (err) {
      console.error('Error fetching results:', err);
    } finally {
      setResultsLoading(false);
    }
  };

  const handleResultFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert('파일 크기는 20MB를 초과할 수 없습니다.');
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
    if (resultType === 'image' && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const handleSubmitResult = async () => {
    if (!session?.student_id || !session?.class_id) return;

    if (resultType === 'text' && !resultText.trim()) {
      showToast('내용을 입력해주세요.', 'error'); return;
    }
    if (resultType === 'link' && !resultUrl.trim()) {
      showToast('링크를 입력해주세요.', 'error'); return;
    }
    if ((resultType === 'image' || resultType === 'file') && !editingResult && !selectedFile) {
      showToast('파일을 선택해주세요.', 'error'); return;
    }

    setResultSubmitting(true);
    try {
      let storagePath: string | null = editingResult?.storage_path || null;
      let displayName: string | null = editingResult?.display_name || null;
      let fileSize: number | null = editingResult?.file_size || null;
      let fileType: string | null = editingResult?.file_type || null;

      if ((resultType === 'image' || resultType === 'file') && selectedFile) {
        if (editingResult?.storage_path) {
          await supabase.storage.from('student-attachments').remove([editingResult.storage_path]);
        }
        const ext = selectedFile.name.split('.').pop() || '';
        storagePath = `results/${session.student_id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('student-attachments')
          .upload(storagePath, selectedFile);
        if (uploadError) throw uploadError;
        displayName = selectedFile.name;
        fileSize = selectedFile.size;
        fileType = selectedFile.type;
      }

      const payload = {
        result_type: resultType,
        title: resultTitle.trim() || null,
        text_content: resultType === 'text' ? resultText.trim() : null,
        link_url: resultType === 'link' ? resultUrl.trim() : null,
        storage_path: storagePath,
        display_name: displayName,
        file_size: fileSize,
        file_type: fileType
      };

      if (editingResult) {
        const { error } = await supabase.from('student_results').update(payload).eq('id', editingResult.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('student_results').insert({
          ...payload,
          student_id: session.student_id,
          class_id: session.class_id
        });
        if (error) throw error;
      }

      setEditingResult(null);
      setResultTitle('');
      setResultText('');
      setResultUrl('');
      setSelectedFile(null);
      setImagePreview(null);
      setResultsPage(1);
      if (resultFileInputRef.current) resultFileInputRef.current.value = '';
      await fetchResults();
      showToast(editingResult ? '수정되었습니다! ✅' : '결과물이 제출되었습니다! ✅');
    } catch (err: any) {
      showToast('오류가 발생했습니다.', 'error');
    } finally {
      setResultSubmitting(false);
    }
  };

  const handleEditResult = (result: any) => {
    setEditingResult(result);
    setResultType(result.result_type);
    setResultTitle(result.title || '');
    setResultText(result.text_content || '');
    setResultUrl(result.link_url || '');
    setSelectedFile(null);
    setImagePreview(null);
    if (resultFileInputRef.current) resultFileInputRef.current.value = '';
    resultFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const handleDeleteResult = async (result: any) => {
    if (!confirm('이 결과물을 삭제하시겠습니까?')) return;
    try {
      if (result.storage_path) {
        await supabase.storage.from('student-attachments').remove([result.storage_path]);
      }
      const { error } = await supabase.from('student_results').delete().eq('id', result.id);
      if (error) throw error;
      setResults(prev => prev.filter(r => r.id !== result.id));
      showToast('삭제되었습니다.');
    } catch (err: any) {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fetchPendingUnits = async () => {
    if (!session?.student_id || !session?.class_id) return;
    setUnitsLoading(true);
    try {
      // 완료된 단원 목록 조회
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('*')
        .eq('class_id', session.class_id)
        .eq('status', 'completed')
        .order('ended_at', { ascending: false });

      if (unitsError) throw unitsError;
      if (!units || units.length === 0) {
        setPendingUnits([]);
        setUnitPendingCount(0);
        return;
      }

      // 이미 제출한 단원 ID 조회
      const unitIds = units.map((u: any) => u.id);
      const { data: submittedData, error: subError } = await supabase
        .from('unit_submissions')
        .select('unit_id')
        .eq('student_id', session.student_id)
        .in('unit_id', unitIds);

      if (subError) throw subError;

      const submittedIds = new Set((submittedData || []).map((s: any) => s.unit_id));
      const pending = units.filter((u: any) => !submittedIds.has(u.id));

      setPendingUnits(pending);
      setUnitPendingCount(pending.length);
      if (pending.length > 0 && !activeUnitId) {
        setActiveUnitId(pending[0].id);
      }
    } catch (err) {
      console.error('Error fetching pending units:', err);
    } finally {
      setUnitsLoading(false);
    }
  };

  const handleUnitSubmit = async (unitId: string) => {
    if (!session?.student_id) return;
    setUnitSubmitting(true);
    try {
      const { error } = await supabase
        .from('unit_submissions')
        .insert({
          unit_id: unitId,
          student_id: session.student_id,
          class_id: session.class_id,
          self_eval: unitForm[`${unitId}_self_eval`] || null,
          inquiry_reflection: unitForm[`${unitId}_inquiry_reflection`] || null,
          performance_record: unitForm[`${unitId}_performance_record`] || null,
          reading_record_title: unitForm[`${unitId}_reading_title`] || null,
          reading_record_author: unitForm[`${unitId}_reading_author`] || null,
          reading_record_reflection: unitForm[`${unitId}_reading_reflection`] || null
        });
      if (error) throw error;

      showToast('단원 마무리 서식이 제출되었습니다! 선생님이 세특 초안 작성 시 활용됩니다. ✅');
      await fetchPendingUnits();
      setUnitForm({});
    } catch (err: any) {
      showToast('제출 중 오류가 발생했습니다.', 'error');
    } finally {
      setUnitSubmitting(false);
    }
  };

  const fetchSuggestions = async () => {
    if (!session?.student_id || !session?.class_id) return;
    setSuggestionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_suggestions')
        .select('*')
        .eq('student_id', session.student_id)
        .eq('class_id', session.class_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setSuggestions(data);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleSubmitSuggestion = async () => {
    if (!suggestionContent.trim()) {
      showToast('건의사항 내용을 입력해주세요.', 'error'); return;
    }
    if (!session?.student_id || !session?.class_id || !teacherId) return;
    setSuggestionSubmitting(true);
    try {
      const { error } = await supabase
        .from('student_suggestions')
        .insert({
          student_id: session.student_id,
          class_id: session.class_id,
          teacher_id: teacherId,
          student_name: session.student_name,
          content: suggestionContent.trim()
        });
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: teacherId,
        title: `💬 ${session.student_name}이(가) 건의사항을 등록했습니다`,
        content: suggestionContent.trim().slice(0, 80),
        type: 'student_submission'
      });

      setSuggestionContent('');
      showToast('건의사항이 등록되었습니다! ✅');
      await fetchSuggestions();
    } catch {
      showToast('등록 중 오류가 발생했습니다.', 'error');
    } finally {
      setSuggestionSubmitting(false);
    }
  };

  const handleStartEditSuggestion = (s: any) => {
    setEditingSuggestionId(s.id);
    setEditSuggestionContent(s.content);
  };

  const handleCancelEditSuggestion = () => {
    setEditingSuggestionId(null);
    setEditSuggestionContent('');
  };

  const handleSaveEditSuggestion = async (id: string) => {
    if (!editSuggestionContent.trim()) {
      showToast('내용을 입력해주세요.', 'error'); return;
    }
    setSavingSuggestionId(id);
    try {
      const { error } = await supabase
        .from('student_suggestions')
        .update({ content: editSuggestionContent.trim() })
        .eq('id', id);
      if (error) throw error;
      setSuggestions(prev => prev.map(s =>
        s.id === id ? { ...s, content: editSuggestionContent.trim() } : s
      ));
      setEditingSuggestionId(null);
      showToast('수정되었습니다.');
    } catch {
      showToast('수정 중 오류가 발생했습니다.', 'error');
    } finally {
      setSavingSuggestionId(null);
    }
  };

  const handleDeleteSuggestion = async (id: string) => {
    if (!confirm('이 건의사항을 삭제하시겠습니까?')) return;
    setDeletingSuggestionId(id);
    try {
      const { error } = await supabase.from('student_suggestions').delete().eq('id', id);
      if (error) throw error;
      setSuggestions(prev => prev.filter(s => s.id !== id));
      showToast('삭제되었습니다.');
    } catch {
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    } finally {
      setDeletingSuggestionId(null);
    }
  };

  const handleTabChange = (tab: 'record' | 'history' | 'badges' | 'materials' | 'results' | 'unit' | 'suggestions') => {
    setActiveTab(tab);
    if (tab === 'history') fetchHistory();
    if (tab === 'materials') fetchResources();
    if (tab === 'results') fetchResults();
    if (tab === 'unit') fetchPendingUnits();
    if (tab === 'suggestions') fetchSuggestions();
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

      showToast('제출 완료! 선생님 승인 후 최종 기록에 반영됩니다. ✅');
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
          <div className="border-b border-surface-container bg-surface-container-low/20">
            {/* 탭 목록 — 가로 스크롤 */}
            <div className="px-6 pt-5 pb-3 overflow-x-auto scrollbar-hide">
              <div className="flex gap-1 bg-surface-container p-2 rounded-2xl shadow-inner border border-surface-container-highest/20 w-fit">
                {[
                  { key: 'record' as const,      icon: MessageSquare, label: '관찰 기록',   active: 'bg-violet-500 text-white shadow-violet-200' },
                  { key: 'history' as const,      icon: History,       label: '나의 기록',   active: 'bg-blue-500 text-white shadow-blue-200' },
                  { key: 'unit' as const,         icon: ClipboardList, label: '단원 마무리', active: 'bg-amber-500 text-white shadow-amber-200', badge: unitPendingCount },
                  { key: 'results' as const,      icon: FolderOpen,    label: '결과 제출',   active: 'bg-emerald-500 text-white shadow-emerald-200' },
                  { key: 'materials' as const,    icon: BookOpen,      label: '수업 자료',   active: 'bg-cyan-500 text-white shadow-cyan-200' },
                  { key: 'badges' as const,       icon: Trophy,        label: '나의 배지',   active: 'bg-yellow-400 text-white shadow-yellow-200' },
                  { key: 'suggestions' as const,  icon: Megaphone,     label: '건의사항',    active: 'bg-rose-500 text-white shadow-rose-200' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => handleTabChange(tab.key)}
                    className={`relative flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black tracking-[0.03em] transition-all whitespace-nowrap shadow-sm ${
                      activeTab === tab.key
                        ? `${tab.active} scale-105`
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-white/60'
                    }`}
                  >
                    <tab.icon size={15} />
                    {tab.label}
                    {'badge' in tab && (tab as any).badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-error text-white rounded-full text-[8px] font-black flex items-center justify-center">
                        {(tab as any).badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 관찰 기록 탭 액션 버튼 — 별도 행 */}
            {activeTab === 'record' && (
              <div className="px-6 pb-4 flex items-center justify-end gap-4">
                <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-black text-on-surface-variant hover:text-on-surface transition-all opacity-60 hover:opacity-100 rounded-xl hover:bg-surface-container whitespace-nowrap">
                  <Save size={16} />
                  임시 저장
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2.5 px-8 py-3 btn-gradient rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:scale-[1.03] active:scale-95 transition-all group disabled:opacity-50 whitespace-nowrap"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : (
                    <>
                      <Send size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
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
                    {historyLogs.map((log) => {
                      const isEditing = editingLogId === log.id;
                      const isDeleting = deletingLogId === log.id;

                      return (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`rounded-3xl border transition-all group cursor-default ${
                            isEditing
                              ? 'p-6 border-primary/30 bg-primary/[0.02]'
                              : 'p-6 bg-surface-container-low border-surface-container hover:border-primary/20'
                          }`}
                        >
                          {isEditing ? (
                            /* ── 인라인 수정 폼 ── */
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-primary uppercase tracking-widest">활동 제목 *</label>
                                <input
                                  type="text"
                                  value={editLogForm.activity_name}
                                  onChange={e => setEditLogForm(prev => ({ ...prev, activity_name: e.target.value }))}
                                  className="w-full px-5 py-3 bg-white rounded-2xl font-bold text-sm border-2 border-primary/10 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">활동 내용</label>
                                <textarea
                                  value={editLogForm.content}
                                  onChange={e => setEditLogForm(prev => ({ ...prev, content: e.target.value }))}
                                  rows={5}
                                  className="w-full px-5 py-3 bg-white rounded-2xl font-medium text-sm leading-relaxed border-2 border-surface-container focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10 resize-none transition-all"
                                />
                              </div>
                              <div className="flex gap-3">
                                <button
                                  onClick={() => handleSaveEditLog(log.id)}
                                  disabled={savingLogId === log.id}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-black text-xs hover:bg-primary/80 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
                                >
                                  {savingLogId === log.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                  저장
                                </button>
                                <button
                                  onClick={handleCancelEditLog}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-surface-container text-on-surface-variant rounded-xl font-black text-xs hover:bg-surface-container-high active:scale-95 transition-all"
                                >
                                  <X size={13} /> 취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* ── 일반 카드 ── */
                            <div className="space-y-3">
                              {/* 상단: 내용 + 상태 */}
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-1">
                                    <FileText size={18} />
                                  </div>
                                  <div className="space-y-1 min-w-0">
                                    <p className="font-black text-base group-hover:text-primary transition-colors">{log.activity_name}</p>
                                    <p className="text-sm text-on-surface-variant font-medium leading-relaxed line-clamp-2">{log.content}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-right space-y-1">
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
                              {/* 하단: 수정/삭제 버튼 (호버 시 표시) */}
                              <div className="flex justify-end gap-2 pt-1 border-t border-surface-container opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleStartEditLog(log)}
                                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-surface-container hover:bg-primary/10 hover:text-primary text-on-surface-variant font-black text-xs transition-all"
                                >
                                  <Pencil size={12} /> 수정
                                </button>
                                <button
                                  onClick={() => handleDeleteLog(log.id)}
                                  disabled={isDeleting}
                                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-surface-container hover:bg-error/10 hover:text-error text-on-surface-variant font-black text-xs transition-all disabled:opacity-50"
                                >
                                  {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                  삭제
                                </button>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
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
            {/* ─── 결과 제출 탭 ─── */}
            {activeTab === 'results' && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-12 space-y-10 min-h-[400px]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <FolderOpen size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black font-manrope">결과 제출</h3>
                    <p className="text-on-surface-variant text-sm font-bold mt-1">
                      수업 결과물을 텍스트·링크·이미지·파일로 제출하세요.
                    </p>
                  </div>
                </div>

                {/* 타입 선택 */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { key: 'text' as const, icon: AlignLeft, label: '텍스트', color: 'text-primary', bg: 'bg-primary/10', activeBg: 'bg-primary', border: 'border-primary' },
                    { key: 'link' as const, icon: Link2, label: '링크', color: 'text-blue-500', bg: 'bg-blue-50', activeBg: 'bg-blue-500', border: 'border-blue-500' },
                    { key: 'image' as const, icon: ImageIcon, label: '이미지', color: 'text-emerald-500', bg: 'bg-emerald-50', activeBg: 'bg-emerald-500', border: 'border-emerald-500' },
                    { key: 'file' as const, icon: File, label: '파일', color: 'text-amber-500', bg: 'bg-amber-50', activeBg: 'bg-amber-500', border: 'border-amber-500' }
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => { setResultType(t.key); setSelectedFile(null); setImagePreview(null); if (resultFileInputRef.current) resultFileInputRef.current.value = ''; }}
                      className={`flex flex-col items-center gap-3 py-5 rounded-2xl border-2 font-black text-sm transition-all ${
                        resultType === t.key
                          ? `${t.activeBg} text-white border-transparent shadow-lg scale-[1.03]`
                          : `${t.bg} ${t.color} border-transparent hover:border-current/20`
                      }`}
                    >
                      <t.icon size={22} />
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* 수정 중 배너 */}
                {editingResult && (
                  <div className="flex items-center justify-between px-5 py-4 bg-amber-50 border border-amber-200 rounded-2xl">
                    <p className="text-sm font-black text-amber-700">수정 중 — 변경 후 제출하세요</p>
                    <button
                      onClick={() => { setEditingResult(null); setResultTitle(''); setResultText(''); setResultUrl(''); setSelectedFile(null); setImagePreview(null); }}
                      className="text-xs font-black text-amber-500 hover:text-amber-700 flex items-center gap-1"
                    >
                      <X size={14} /> 취소
                    </button>
                  </div>
                )}

                {/* 입력 폼 */}
                <div ref={resultFormRef} className="space-y-4">
                  <input
                    type="text"
                    value={resultTitle}
                    onChange={e => setResultTitle(e.target.value)}
                    placeholder="제목 (선택사항)"
                    className="w-full px-6 py-4 bg-neutral-100 rounded-2xl font-bold text-base focus:outline-none focus:ring-4 focus:ring-primary/10 border-2 border-transparent focus:border-primary/20 transition-all"
                  />

                  {resultType === 'text' && (
                    <textarea
                      value={resultText}
                      onChange={e => setResultText(e.target.value)}
                      placeholder="수업 결과물 내용을 자유롭게 작성하세요..."
                      rows={6}
                      className="w-full p-6 bg-neutral-100 rounded-2xl font-bold text-sm leading-relaxed focus:outline-none focus:ring-4 focus:ring-primary/10 border-2 border-transparent focus:border-primary/20 resize-none transition-all"
                    />
                  )}

                  {resultType === 'link' && (
                    <input
                      type="url"
                      value={resultUrl}
                      onChange={e => setResultUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-6 py-4 bg-neutral-100 rounded-2xl font-bold text-sm focus:outline-none focus:ring-4 focus:ring-blue-100 border-2 border-transparent focus:border-blue-300 transition-all"
                    />
                  )}

                  {resultType === 'image' && (
                    <div
                      onClick={() => resultFileInputRef.current?.click()}
                      className="border-2 border-dashed border-emerald-200 rounded-2xl p-8 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-all text-center group"
                    >
                      {imagePreview ? (
                        <div className="relative">
                          <img src={imagePreview} alt="preview" className="max-h-48 mx-auto rounded-xl object-contain" />
                          <p className="text-xs font-bold text-emerald-600 mt-3">{selectedFile?.name}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto group-hover:bg-emerald-200 transition-colors">
                            <ImageIcon size={28} className="text-emerald-500" />
                          </div>
                          <p className="font-black text-emerald-600">이미지 선택하기</p>
                          <p className="text-xs font-bold text-emerald-400">JPG, PNG, GIF, WEBP (최대 20MB)</p>
                        </div>
                      )}
                    </div>
                  )}

                  {resultType === 'file' && (
                    <div
                      onClick={() => resultFileInputRef.current?.click()}
                      className="border-2 border-dashed border-amber-200 rounded-2xl p-8 cursor-pointer hover:border-amber-400 hover:bg-amber-50/50 transition-all text-center group"
                    >
                      {selectedFile ? (
                        <div className="flex items-center justify-center gap-4">
                          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                            <File size={22} className="text-amber-500" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-sm">{selectedFile.name}</p>
                            <p className="text-xs font-bold text-amber-500 mt-0.5">{formatFileSize(selectedFile.size)}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto group-hover:bg-amber-200 transition-colors">
                            <Upload size={28} className="text-amber-500" />
                          </div>
                          <p className="font-black text-amber-600">파일 선택하기</p>
                          <p className="text-xs font-bold text-amber-400">모든 파일 형식 (최대 20MB)</p>
                        </div>
                      )}
                    </div>
                  )}

                  <input
                    ref={resultFileInputRef}
                    type="file"
                    className="hidden"
                    accept={resultType === 'image' ? 'image/*' : '*'}
                    onChange={handleResultFileSelect}
                  />

                  <button
                    onClick={handleSubmitResult}
                    disabled={resultSubmitting}
                    className="w-full py-5 btn-gradient rounded-[1.25rem] font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {resultSubmitting ? <Loader2 size={20} className="animate-spin" /> : editingResult ? <><Send size={20} /> 수정 완료</>  : <><Send size={20} /> 결과 제출하기</>}
                  </button>
                </div>

                {/* 제출 목록 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pt-4 border-t border-surface-container">
                    <h4 className="font-black text-base">제출 내역</h4>
                    <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-lg">{results.length}개</span>
                  </div>

                  {resultsLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 size={28} className="animate-spin text-primary" />
                    </div>
                  ) : results.length === 0 ? (
                    <div className="flex flex-col items-center py-16 space-y-3 opacity-30">
                      <FolderOpen size={48} />
                      <p className="font-black">아직 제출한 결과물이 없습니다.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {results
                          .slice((resultsPage - 1) * RESULTS_PER_PAGE, resultsPage * RESULTS_PER_PAGE)
                          .map(r => {
                            const typeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
                              text: { icon: <AlignLeft size={16} />, color: 'text-primary bg-primary/10', label: '텍스트' },
                              link: { icon: <Link2 size={16} />, color: 'text-blue-500 bg-blue-50', label: '링크' },
                              image: { icon: <ImageIcon size={16} />, color: 'text-emerald-500 bg-emerald-50', label: '이미지' },
                              file: { icon: <File size={16} />, color: 'text-amber-500 bg-amber-50', label: '파일' }
                            };
                            const cfg = typeConfig[r.result_type] || typeConfig.file;
                            const publicUrl = r.storage_path
                              ? supabase.storage.from('student-attachments').getPublicUrl(r.storage_path).data.publicUrl
                              : null;
                            const isEditing = editingResult?.id === r.id;

                            return (
                              <motion.div
                                key={r.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`p-5 rounded-2xl border-2 transition-all group ${
                                  isEditing
                                    ? 'border-amber-300 bg-amber-50/50'
                                    : 'border-surface-container bg-surface-container-low hover:border-primary/20'
                                }`}
                              >
                                <div className="flex items-start gap-4">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.color}`}>
                                    {cfg.icon}
                                  </div>
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {r.title && <p className="font-black text-sm">{r.title}</p>}
                                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${cfg.color}`}>{cfg.label}</span>
                                      {isEditing && <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md">수정 중</span>}
                                    </div>
                                    {r.text_content && <p className="text-xs font-bold text-on-surface-variant line-clamp-2 leading-relaxed">{r.text_content}</p>}
                                    {r.link_url && (
                                      <a href={r.link_url} target="_blank" rel="noopener noreferrer"
                                        className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1 truncate">
                                        <ExternalLink size={11} />{r.link_url}
                                      </a>
                                    )}
                                    {r.result_type === 'image' && publicUrl && (
                                      <img src={publicUrl} alt={r.title || '이미지'} className="max-h-24 rounded-xl object-cover mt-2 cursor-pointer" onClick={() => window.open(publicUrl, '_blank')} />
                                    )}
                                    {r.result_type === 'file' && (
                                      <p className="text-xs font-bold text-amber-600 flex items-center gap-1">
                                        <File size={11} />{r.display_name} {r.file_size ? `(${formatFileSize(r.file_size)})` : ''}
                                      </p>
                                    )}
                                    <p className="text-[10px] font-bold text-on-surface-variant/40 flex items-center gap-1">
                                      <Clock size={10} />{formatRelativeTime(r.created_at)}
                                    </p>
                                  </div>

                                  {/* 액션 버튼 */}
                                  <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {(r.result_type === 'image' || r.result_type === 'file') && r.storage_path && (
                                      <button
                                        onClick={() => handleDownloadResult(r)}
                                        title="다운로드"
                                        className="w-8 h-8 rounded-xl bg-surface-container hover:bg-primary/10 hover:text-primary flex items-center justify-center text-on-surface-variant transition-all"
                                      >
                                        <Upload size={13} className="rotate-180" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleEditResult(r)}
                                      title="수정"
                                      className="w-8 h-8 rounded-xl bg-surface-container hover:bg-amber-100 hover:text-amber-600 flex items-center justify-center text-on-surface-variant transition-all"
                                    >
                                      <FileText size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteResult(r)}
                                      title="삭제"
                                      className="w-8 h-8 rounded-xl bg-surface-container hover:bg-error/10 hover:text-error flex items-center justify-center text-on-surface-variant transition-all"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                      </div>

                      {/* 페이지네이션 */}
                      {results.length > RESULTS_PER_PAGE && (
                        <div className="flex items-center justify-center gap-3 pt-2">
                          <button
                            onClick={() => setResultsPage(p => Math.max(1, p - 1))}
                            disabled={resultsPage === 1}
                            className="px-4 py-2 rounded-xl bg-surface-container font-black text-sm text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30 transition-all"
                          >
                            이전
                          </button>
                          {Array.from({ length: Math.ceil(results.length / RESULTS_PER_PAGE) }, (_, i) => i + 1).map(p => (
                            <button
                              key={p}
                              onClick={() => setResultsPage(p)}
                              className={`w-9 h-9 rounded-xl font-black text-sm transition-all ${
                                resultsPage === p
                                  ? 'bg-primary text-white shadow-md'
                                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                          <button
                            onClick={() => setResultsPage(p => Math.min(Math.ceil(results.length / RESULTS_PER_PAGE), p + 1))}
                            disabled={resultsPage === Math.ceil(results.length / RESULTS_PER_PAGE)}
                            className="px-4 py-2 rounded-xl bg-surface-container font-black text-sm text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30 transition-all"
                          >
                            다음
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* ─── 단원 마무리 탭 ─── */}
            {activeTab === 'unit' && (
              <motion.div
                key="unit"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-12 space-y-8 min-h-[400px]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <ClipboardList size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black font-manrope">단원 마무리 서식</h3>
                    <p className="text-on-surface-variant text-sm font-bold mt-1">
                      선생님이 마무리한 단원의 제출 서식을 작성하세요.
                    </p>
                  </div>
                </div>

                {unitsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 size={36} className="animate-spin text-primary" />
                  </div>
                ) : pendingUnits.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-4 opacity-30">
                    <CheckCircle2 size={64} />
                    <p className="font-black text-lg">제출할 서식이 없습니다.</p>
                    <p className="text-sm font-bold text-center">
                      선생님이 단원을 마무리하면 여기에 서식이 표시됩니다.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* 단원 선택 버튼 목록 */}
                    {pendingUnits.length > 1 && (
                      <div className="flex gap-3 flex-wrap">
                        {pendingUnits.map(unit => (
                          <button
                            key={unit.id}
                            onClick={() => setActiveUnitId(unit.id)}
                            className={`px-5 py-2.5 rounded-2xl font-black text-sm transition-all ${
                              activeUnitId === unit.id
                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                            }`}
                          >
                            {unit.title}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 선택된 단원 서식 */}
                    {pendingUnits
                      .filter(u => u.id === activeUnitId)
                      .map(unit => {
                        const cfg = unit.form_config || {};
                        const guides = unit.form_guides || {};
                        const defaultGuides: Record<string, string> = {
                          self_eval: '이번 단원에서 본인이 가장 잘 수행한 부분과 부족했던 점을 솔직하게 작성하고, 다음에 개선하고 싶은 점을 구체적으로 서술하세요.',
                          inquiry_reflection: '탐구 과정에서 발견한 점, 어려움과 해결 과정, 새롭게 알게 된 내용을 구체적인 근거와 함께 300자 이내로 작성하세요.',
                          performance_record: '수행평가 활동에서 본인이 담당한 역할, 활동 과정, 결과물의 특징을 구체적으로 기술하세요. (500자 이내)',
                          reading_record: '이번 단원과 연계하여 읽은 책의 제목, 저자, 인상 깊은 내용과 탐구 방향을 작성하세요.'
                        };

                        return (
                          <div key={unit.id} className="space-y-6">
                            <div className="p-5 bg-primary/5 border border-primary/10 rounded-2xl">
                              <h4 className="font-black text-lg text-primary">{unit.title}</h4>
                              {unit.description && (
                                <p className="text-sm font-bold text-primary/70 mt-1">{unit.description}</p>
                              )}
                            </div>

                            {/* 자기평가서 */}
                            {cfg.self_eval && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 bg-primary rounded-full" />
                                  <label className="text-[11px] font-black text-primary uppercase tracking-widest">자기평가서</label>
                                </div>
                                <div className="flex items-start gap-3 bg-primary/5 p-4 rounded-xl border border-primary/10 mb-3">
                                  <Lightbulb size={14} className="text-primary mt-0.5 shrink-0" />
                                  <p className="text-xs font-bold text-primary/70 leading-relaxed">
                                    {guides.self_eval || defaultGuides.self_eval}
                                  </p>
                                </div>
                                <textarea
                                  value={unitForm[`${unit.id}_self_eval`] || ''}
                                  onChange={e => setUnitForm(prev => ({ ...prev, [`${unit.id}_self_eval`]: e.target.value }))}
                                  placeholder="이번 단원에서 본인의 수행을 평가해 주세요..."
                                  rows={5}
                                  className="w-full p-6 bg-neutral-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 border-2 border-transparent focus:border-primary/20 resize-none transition-all leading-relaxed"
                                />
                              </div>
                            )}

                            {/* 탐구소감문 */}
                            {cfg.inquiry_reflection && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 bg-secondary rounded-full" />
                                  <label className="text-[11px] font-black text-secondary uppercase tracking-widest">탐구소감문</label>
                                </div>
                                <div className="flex items-start gap-3 bg-secondary/5 p-4 rounded-xl border border-secondary/10 mb-3">
                                  <Lightbulb size={14} className="text-secondary mt-0.5 shrink-0" />
                                  <p className="text-xs font-bold text-secondary/70 leading-relaxed">
                                    {guides.inquiry_reflection || defaultGuides.inquiry_reflection}
                                  </p>
                                </div>
                                <div className="relative">
                                  <textarea
                                    value={unitForm[`${unit.id}_inquiry_reflection`] || ''}
                                    onChange={e => setUnitForm(prev => ({ ...prev, [`${unit.id}_inquiry_reflection`]: e.target.value }))}
                                    placeholder="탐구 활동에서 배운 점과 소감을 작성하세요..."
                                    rows={5}
                                    maxLength={300}
                                    className="w-full p-6 bg-neutral-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-secondary/10 border-2 border-transparent focus:border-secondary/20 resize-none transition-all leading-relaxed"
                                  />
                                  <span className="absolute bottom-4 right-4 text-[10px] font-black text-on-surface-variant/40">
                                    {(unitForm[`${unit.id}_inquiry_reflection`] || '').length}/300
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* 수행평가 활동 기술 */}
                            {cfg.performance_record && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 bg-amber-500 rounded-full" />
                                  <label className="text-[11px] font-black text-amber-600 uppercase tracking-widest">수행평가 활동 기술</label>
                                  <span className="text-[9px] font-black text-amber-500 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">NEIS 세특 기준</span>
                                </div>
                                <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-100 mb-3">
                                  <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                                  <p className="text-xs font-bold text-amber-600/80 leading-relaxed">
                                    {guides.performance_record || defaultGuides.performance_record}
                                  </p>
                                </div>
                                <div className="relative">
                                  <textarea
                                    value={unitForm[`${unit.id}_performance_record`] || ''}
                                    onChange={e => setUnitForm(prev => ({ ...prev, [`${unit.id}_performance_record`]: e.target.value }))}
                                    placeholder="수행평가 활동 내용을 구체적으로 기술하세요..."
                                    rows={6}
                                    maxLength={500}
                                    className="w-full p-6 bg-neutral-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-amber-200 border-2 border-transparent focus:border-amber-200 resize-none transition-all leading-relaxed"
                                  />
                                  <span className={`absolute bottom-4 right-4 text-[10px] font-black ${
                                    (unitForm[`${unit.id}_performance_record`] || '').length > 450
                                      ? 'text-error'
                                      : 'text-on-surface-variant/40'
                                  }`}>
                                    {(unitForm[`${unit.id}_performance_record`] || '').length}/500
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* 독서기록 */}
                            {cfg.reading_record && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 bg-violet-500 rounded-full" />
                                  <label className="text-[11px] font-black text-violet-600 uppercase tracking-widest">독서기록</label>
                                </div>
                                <div className="flex items-start gap-3 bg-violet-50 p-4 rounded-xl border border-violet-100 mb-3">
                                  <Lightbulb size={14} className="text-violet-500 mt-0.5 shrink-0" />
                                  <p className="text-xs font-bold text-violet-600/70 leading-relaxed">
                                    {guides.reading_record || defaultGuides.reading_record}
                                  </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <input
                                    type="text"
                                    value={unitForm[`${unit.id}_reading_title`] || ''}
                                    onChange={e => setUnitForm(prev => ({ ...prev, [`${unit.id}_reading_title`]: e.target.value }))}
                                    placeholder="책 제목"
                                    className="px-5 py-3 bg-neutral-100 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-violet-100 border-2 border-transparent focus:border-violet-200 transition-all"
                                  />
                                  <input
                                    type="text"
                                    value={unitForm[`${unit.id}_reading_author`] || ''}
                                    onChange={e => setUnitForm(prev => ({ ...prev, [`${unit.id}_reading_author`]: e.target.value }))}
                                    placeholder="저자"
                                    className="px-5 py-3 bg-neutral-100 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-violet-100 border-2 border-transparent focus:border-violet-200 transition-all"
                                  />
                                </div>
                                <textarea
                                  value={unitForm[`${unit.id}_reading_reflection`] || ''}
                                  onChange={e => setUnitForm(prev => ({ ...prev, [`${unit.id}_reading_reflection`]: e.target.value }))}
                                  placeholder="독서 소감 및 탐구 연계 내용..."
                                  rows={4}
                                  className="w-full p-6 bg-neutral-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-violet-100 border-2 border-transparent focus:border-violet-200 resize-none transition-all leading-relaxed"
                                />
                              </div>
                            )}

                            {/* 제출 버튼 */}
                            <button
                              onClick={() => handleUnitSubmit(unit.id)}
                              disabled={unitSubmitting}
                              className="w-full py-5 btn-gradient rounded-[1.25rem] font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                              {unitSubmitting ? (
                                <Loader2 className="animate-spin" size={20} />
                              ) : (
                                <>
                                  <Send size={20} />
                                  단원 마무리 서식 제출하기
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
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

            {/* ─── 건의사항 탭 ─── */}
            {activeTab === 'suggestions' && (
              <motion.div
                key="suggestions"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-12 space-y-10 min-h-[400px]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Megaphone size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black font-manrope">건의사항</h3>
                    <p className="text-on-surface-variant text-sm font-bold mt-1">
                      선생님께 자유롭게 의견이나 건의사항을 전달하세요.
                    </p>
                  </div>
                </div>

                {/* 입력 폼 */}
                <div className="space-y-4">
                  <textarea
                    value={suggestionContent}
                    onChange={e => setSuggestionContent(e.target.value)}
                    placeholder="수업 방식, 과제, 환경 등 자유롭게 의견을 작성해 주세요. 선생님께 전달됩니다."
                    rows={5}
                    className="w-full p-6 bg-neutral-100 rounded-[2rem] text-sm font-bold leading-relaxed focus:outline-none focus:ring-4 focus:ring-primary/10 border-2 border-transparent focus:border-primary/20 resize-none transition-all"
                  />
                  <button
                    onClick={handleSubmitSuggestion}
                    disabled={suggestionSubmitting || !suggestionContent.trim()}
                    className="w-full py-5 btn-gradient rounded-[1.25rem] font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {suggestionSubmitting
                      ? <Loader2 size={20} className="animate-spin" />
                      : <><Send size={20} /> 건의사항 전달하기</>
                    }
                  </button>
                </div>

                {/* 내가 보낸 건의사항 목록 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pt-4 border-t border-surface-container">
                    <h4 className="font-black text-base">내가 보낸 건의사항</h4>
                    <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-lg">
                      {suggestions.length}개
                    </span>
                  </div>

                  {suggestionsLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 size={28} className="animate-spin text-primary" />
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="flex flex-col items-center py-16 space-y-3 opacity-30">
                      <Megaphone size={48} />
                      <p className="font-black">아직 등록한 건의사항이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {suggestions.map(s => {
                        const isEditing = editingSuggestionId === s.id;
                        const isDeleting = deletingSuggestionId === s.id;

                        return (
                          <motion.div
                            key={s.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`rounded-3xl border transition-all group cursor-default ${
                              isEditing
                                ? 'p-6 border-primary/30 bg-primary/[0.02]'
                                : 'p-6 bg-surface-container-low border-surface-container hover:border-primary/20'
                            }`}
                          >
                            {isEditing ? (
                              <div className="space-y-3">
                                <textarea
                                  value={editSuggestionContent}
                                  onChange={e => setEditSuggestionContent(e.target.value)}
                                  rows={4}
                                  className="w-full px-5 py-3 bg-white rounded-2xl font-medium text-sm leading-relaxed border-2 border-surface-container focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10 resize-none transition-all"
                                />
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => handleSaveEditSuggestion(s.id)}
                                    disabled={savingSuggestionId === s.id}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-black text-xs hover:bg-primary/80 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
                                  >
                                    {savingSuggestionId === s.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                    저장
                                  </button>
                                  <button
                                    onClick={handleCancelEditSuggestion}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-surface-container text-on-surface-variant rounded-xl font-black text-xs hover:bg-surface-container-high active:scale-95 transition-all"
                                  >
                                    <X size={13} /> 취소
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex items-start gap-4">
                                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                                    <MessageSquare size={18} />
                                  </div>
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <p className="text-sm font-medium text-on-surface leading-relaxed">{s.content}</p>
                                    <p className="text-[10px] font-bold text-on-surface-variant/50 flex items-center gap-1">
                                      <Clock size={10} />
                                      {formatRelativeTime(s.created_at)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-1 border-t border-surface-container opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleStartEditSuggestion(s)}
                                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-surface-container hover:bg-primary/10 hover:text-primary text-on-surface-variant font-black text-xs transition-all"
                                  >
                                    <Pencil size={12} /> 수정
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSuggestion(s.id)}
                                    disabled={isDeleting}
                                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-surface-container hover:bg-error/10 hover:text-error text-on-surface-variant font-black text-xs transition-all disabled:opacity-50"
                                  >
                                    {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                    삭제
                                  </button>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                toast.type === 'error'
                  ? 'bg-error text-white'
                  : 'bg-neutral-900 text-white'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${toast.type === 'error' ? 'bg-white/60' : 'bg-primary animate-pulse'}`} />
              {toast.msg}
            </motion.div>
          ))}
        </AnimatePresence>
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

