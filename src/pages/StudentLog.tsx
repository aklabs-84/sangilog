import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { openFile } from '../lib/fileUtils';
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
  Megaphone,
  LayoutDashboard,
  ArrowRight,
  Gamepad2,
  Play,
  RefreshCw,
  MoreHorizontal,
  Users2,
  StickyNote,
  Heart,
  Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { geminiFlash } from '../lib/gemini';
import ReactMarkdown from 'react-markdown';
import CodeBlock from '../components/CodeBlock';

const StudentLog = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'record' | 'history' | 'badges' | 'materials' | 'results' | 'unit' | 'suggestions' | 'quiz' | 'board'>('home');
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const [selectedHomeWeek, setSelectedHomeWeek] = useState<number | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'obs' | 'result'>('all');
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogForm, setEditLogForm] = useState({ activity_name: '', content: '' });
  const [savingLogId, setSavingLogId] = useState<string | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [guidePrompt, setGuidePrompt] = useState<string>('');
  const [minObsChars, setMinObsChars] = useState(0);
  const [reminderModal, setReminderModal] = useState<{
    type: 'need_result' | 'need_obs';
    week: number;
    topic: string;
  } | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{reason: string, guide: string} | null>(null);

  // 반려 실시간 알림 (폴링)
  const [rejectionNotification, setRejectionNotification] = useState<{
    type: 'obs' | 'result';
    title: string;
    feedback: string | null;
  } | null>(null);
  const isFirstRejectionPoll = useRef(true);
  const seenRejectionIds = useRef(new Set<string>());
  
  // Resources State (weekly_plan + class_materials)
  const [classResources, setClassResources] = useState<any[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [classMaterials, setClassMaterials] = useState<any[]>([]);
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);

  // Result Submission State
  const [results, setResults] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [resultTitle, setResultTitle] = useState('');
  const [resultText, setResultText] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [resultSubmitting, setResultSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [resultImageFile, setResultImageFile] = useState<File | null>(null);
  const [resultFileUpload, setResultFileUpload] = useState<File | null>(null);
  const resultImageInputRef = useRef<HTMLInputElement | null>(null);
  const resultFileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingResult, setEditingResult] = useState<any>(null);
  const [editingGroupResults, setEditingGroupResults] = useState<any[]>([]);
  const resultFormRef = useRef<HTMLDivElement | null>(null);
  const [filterWeek, setFilterWeek] = useState<number | null>(null);
  const [detailItem, setDetailItem] = useState<any>(null);

  // 가이드 모달 State
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideTab, setGuideTab] = useState<'obs' | 'result'>('obs');
  const [dontShowToday, setDontShowToday] = useState(false);

  // Toast State
  const [toasts, setToasts] = useState<{id: string; msg: string; type: 'success' | 'error'}[]>([]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const handleCloseGuide = () => {
    if (dontShowToday && session?.student_id) {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(`guide_hidden_${session.student_id}`, today);
    }
    setShowGuideModal(false);
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
  const [unreadReplyCount, setUnreadReplyCount] = useState(0);

  // Unit Submission States
  const [pendingUnits, setPendingUnits] = useState<any[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitPendingCount, setUnitPendingCount] = useState(0);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [unitForm, setUnitForm] = useState<Record<string, any>>({});
  const [unitSubmitting, setUnitSubmitting] = useState(false);

  // Quiz Tab States
  const [activeQuizSessions, setActiveQuizSessions] = useState<any[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);

  // Board Tab States
  const [boardPosts, setBoardPosts] = useState<any[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardWeekFilter, setBoardWeekFilter] = useState<number | 'all'>('all');
  const [boardTypeFilter, setBoardTypeFilter] = useState<'all' | 'obs' | 'result'>('all');
  const [boardSelectedPost, setBoardSelectedPost] = useState<any | null>(null);
  const [boardLikes, setBoardLikes] = useState<Record<string, boolean>>({}); // postId → liked

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
    fetchUnreadReplyCount(parsed.student_id, parsed.class_id);

    // 가이드 모달 표시 여부 확인 (학생별, 당일 기준)
    const today = new Date().toISOString().slice(0, 10);
    const guideKey = `guide_hidden_${parsed.student_id}`;
    const hiddenDate = localStorage.getItem(guideKey);
    if (hiddenDate !== today) {
      setShowGuideModal(true);
    }
  }, []);

  // 반려 알림 폴링 — 15초마다 새 반려 확인
  useEffect(() => {
    if (!session?.student_id) return;

    const check = async () => {
      try {
        // 관찰기록 반려 체크
        const { data: rejectedObs } = await supabase
          .from('observations')
          .select('id, activity_name, teacher_feedback')
          .eq('student_id', session.student_id)
          .eq('status', 'rejected')
          .eq('is_student_record', true);

        for (const obs of (rejectedObs || [])) {
          const key = `obs-${obs.id}`;
          if (isFirstRejectionPoll.current) {
            seenRejectionIds.current.add(key);
          } else if (!seenRejectionIds.current.has(key)) {
            seenRejectionIds.current.add(key);
            setRejectionNotification({
              type: 'obs',
              title: obs.activity_name || '관찰기록',
              feedback: obs.teacher_feedback || null,
            });
            fetchHistory();
            return;
          }
        }

        // 결과물 반려 체크
        const { data: rejectedResults } = await supabase
          .from('student_results')
          .select('id, submission_group, week_number, title, rejection_feedback')
          .eq('student_id', session.student_id)
          .eq('status', 'rejected');

        const seenGroups = new Set<string>();
        for (const r of (rejectedResults || [])) {
          const gId = r.submission_group || r.id;
          if (seenGroups.has(gId)) continue;
          seenGroups.add(gId);
          const key = `result-${gId}`;
          if (isFirstRejectionPoll.current) {
            seenRejectionIds.current.add(key);
          } else if (!seenRejectionIds.current.has(key)) {
            seenRejectionIds.current.add(key);
            setRejectionNotification({
              type: 'result',
              title: r.title || (r.week_number ? `${r.week_number}주차 결과물` : '결과물'),
              feedback: (r as any).rejection_feedback || null,
            });
            fetchResults();
            return;
          }
        }
      } catch {
        // 백그라운드 폴링 오류 무시
      } finally {
        isFirstRejectionPoll.current = false;
      }
    };

    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [session?.student_id]);

  const fetchUnreadReplyCount = async (studentId: string, classId: string) => {
    const { count } = await supabase
      .from('student_suggestions')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('is_reply_read', false)
      .not('teacher_reply', 'is', null);
    if (count !== null) setUnreadReplyCount(count);
  };

  const fetchClassDetails = async (classId: string) => {
    try {
      const { data } = await supabase
        .from('classes')
        .select('teacher_id, student_guide_prompt, weekly_plan, min_obs_chars')
        .eq('id', classId)
        .single();

      if (data) {
        setTeacherId(data.teacher_id);
        setGuidePrompt(data.student_guide_prompt || '수업 시간에 배운 내용과 본인의 활동 역할을 구체적으로 작성하세요.');
        setMinObsChars(data.min_obs_chars || 0);
        if (data.weekly_plan && Array.isArray(data.weekly_plan) && data.weekly_plan.length > 0) {
          setClassResources(data.weekly_plan);

          // weekly_plan 중 material_id가 있는 항목의 자료 미리 로드
          const materialIds = data.weekly_plan
            .map((p: any) => p.material_id)
            .filter(Boolean);
          if (materialIds.length > 0) {
            const { data: mats } = await supabase
              .from('class_materials')
              .select('*')
              .in('id', materialIds);
            if (mats) setClassMaterials(mats);
          }
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
    if (!session?.class_id) return;
    setResourcesLoading(true);
    try {
      // weekly_plan의 material_id 목록 기준으로 자료 로드
      const plan = classResources as any[];
      const materialIds = plan.map(p => p.material_id).filter(Boolean);
      if (materialIds.length > 0) {
        const { data } = await supabase
          .from('class_materials')
          .select('*')
          .in('id', materialIds);
        if (data) setClassMaterials(data);
      } else {
        setClassMaterials([]);
      }
    } catch (err) {
      console.error('Error fetching class_materials:', err);
    } finally {
      setResourcesLoading(false);
    }
  };

  // 수업 자료 열람 기록 (학생별 1회)
  const recordMaterialView = async (materialId: string) => {
    if (!session?.student_id) return;
    await supabase.from('student_material_views').upsert(
      { material_id: materialId, student_id: session.student_id },
      { onConflict: 'material_id,student_id', ignoreDuplicates: true }
    );
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

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert('파일 크기는 20MB를 초과할 수 없습니다.'); e.target.value = ''; return; }
    setResultImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert('파일 크기는 20MB를 초과할 수 없습니다.'); e.target.value = ''; return; }
    setResultFileUpload(file);
  };

  const resetResultForm = () => {
    setResultTitle(''); setResultText(''); setResultUrl('');
    setResultImageFile(null); setResultFileUpload(null); setImagePreview(null);
    setEditingResult(null); setEditingGroupResults([]);
    if (resultImageInputRef.current) resultImageInputRef.current.value = '';
    if (resultFileInputRef.current) resultFileInputRef.current.value = '';
  };

  const uploadFile = async (file: File, type: 'image' | 'file') => {
    const ext = file.name.split('.').pop() || '';
    const path = `results/${session.student_id}/${type}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('student-attachments').upload(path, file);
    if (error) throw error;
    return { path, displayName: file.name, fileSize: file.size, fileType: file.type };
  };

  const handleSubmitResult = async () => {
    if (!session?.student_id || !session?.class_id) return;

    // 수정 모드: 그룹 전체 업데이트
    if (editingResult) {
      const hasText  = resultText.trim() !== '';
      const hasLink  = resultUrl.trim() !== '';
      const hasImage = resultImageFile !== null;
      const hasFile  = resultFileUpload !== null;
      const keepImg  = imagePreview !== null && !hasImage; // 기존 이미지 유지 여부

      setResultSubmitting(true);
      try {
        const groupId = editingResult.submission_group || crypto.randomUUID();
        const base = {
          student_id:       editingResult.student_id,
          class_id:         editingResult.class_id,
          week_number:      editingResult.week_number,
          submission_group: groupId,
          title:            resultTitle.trim() || null,
        };

        const existingText  = editingGroupResults.find((r: any) => r.result_type === 'text');
        const existingLink  = editingGroupResults.find((r: any) => r.result_type === 'link');
        const existingImage = editingGroupResults.find((r: any) => r.result_type === 'image');
        const existingFile  = editingGroupResults.find((r: any) => r.result_type === 'file');

        // ── 텍스트 ──
        if (hasText) {
          if (existingText) {
            const { error } = await supabase.from('student_results').update({ title: base.title, text_content: resultText.trim() }).eq('id', existingText.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('student_results').insert({ ...base, result_type: 'text', text_content: resultText.trim() });
            if (error) throw error;
          }
        } else if (existingText) {
          // 텍스트 비움 → 삭제
          await supabase.from('student_results').delete().eq('id', existingText.id);
        }

        // ── 링크 ──
        if (hasLink) {
          if (existingLink) {
            const { error } = await supabase.from('student_results').update({ title: base.title, link_url: resultUrl.trim() }).eq('id', existingLink.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('student_results').insert({ ...base, result_type: 'link', link_url: resultUrl.trim() });
            if (error) throw error;
          }
        } else if (existingLink) {
          await supabase.from('student_results').delete().eq('id', existingLink.id);
        }

        // ── 이미지 ──
        if (hasImage) {
          if (existingImage?.storage_path) await supabase.storage.from('student-attachments').remove([existingImage.storage_path]);
          const up = await uploadFile(resultImageFile!, 'image');
          if (existingImage) {
            const { error } = await supabase.from('student_results').update({ title: base.title, storage_path: up.path, display_name: up.displayName, file_size: up.fileSize, file_type: up.fileType }).eq('id', existingImage.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('student_results').insert({ ...base, result_type: 'image', storage_path: up.path, display_name: up.displayName, file_size: up.fileSize, file_type: up.fileType });
            if (error) throw error;
          }
        } else if (existingImage && keepImg) {
          // 기존 이미지 유지 — title만 반영
          await supabase.from('student_results').update({ title: base.title }).eq('id', existingImage.id);
        }

        // ── 파일 ──
        if (hasFile) {
          if (existingFile?.storage_path) await supabase.storage.from('student-attachments').remove([existingFile.storage_path]);
          const up = await uploadFile(resultFileUpload!, 'file');
          if (existingFile) {
            const { error } = await supabase.from('student_results').update({ title: base.title, storage_path: up.path, display_name: up.displayName, file_size: up.fileSize, file_type: up.fileType }).eq('id', existingFile.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('student_results').insert({ ...base, result_type: 'file', storage_path: up.path, display_name: up.displayName, file_size: up.fileSize, file_type: up.fileType });
            if (error) throw error;
          }
        } else if (existingFile) {
          // 기존 파일 유지 — title만 반영
          await supabase.from('student_results').update({ title: base.title }).eq('id', existingFile.id);
        }

        // 반려 상태였으면 제출 상태로 초기화
        if (editingResult.submission_group) {
          await supabase.from('student_results')
            .update({ status: 'submitted', rejection_feedback: null })
            .eq('submission_group', editingResult.submission_group);
        }

        resetResultForm();
        await fetchResults();
        showToast('수정되었습니다! ✅');
      } catch { showToast('오류가 발생했습니다.', 'error'); }
      finally { setResultSubmitting(false); }
      return;
    }

    // 신규 제출 모드
    const hasText = resultText.trim() !== '';
    const hasLink = resultUrl.trim() !== '';
    const hasImage = resultImageFile !== null;
    const hasFile = resultFileUpload !== null;
    if (!hasText && !hasLink && !hasImage && !hasFile) {
      showToast('하나 이상의 항목을 입력해주세요.', 'error'); return;
    }
    if (!selectedWeek) {
      showToast('주차를 선택해주세요.', 'error'); return;
    }

    setResultSubmitting(true);
    try {
      const groupId = crypto.randomUUID();
      const base = { student_id: session.student_id, class_id: session.class_id, week_number: selectedWeek, submission_group: groupId, title: resultTitle.trim() || null };
      const rows: any[] = [];

      if (hasText) rows.push({ ...base, result_type: 'text', text_content: resultText.trim() });
      if (hasLink) rows.push({ ...base, result_type: 'link', link_url: resultUrl.trim() });
      if (hasImage) {
        const up = await uploadFile(resultImageFile!, 'image');
        rows.push({ ...base, result_type: 'image', storage_path: up.path, display_name: up.displayName, file_size: up.fileSize, file_type: up.fileType });
      }
      if (hasFile) {
        const up = await uploadFile(resultFileUpload!, 'file');
        rows.push({ ...base, result_type: 'file', storage_path: up.path, display_name: up.displayName, file_size: up.fileSize, file_type: up.fileType });
      }

      const { error } = await supabase.from('student_results').insert(rows);
      if (error) throw error;

      if (teacherId) {
        await supabase.from('notifications').insert({
          user_id: teacherId,
          title: `📁 ${session.student_name}이(가) ${selectedWeek}주차 결과를 제출했습니다`,
          content: `${rows.map((r: any) => r.result_type).join('·')} — ${session.class_name}`,
          type: 'result_submission',
          link: `/classroom?id=${session.class_id}&student_id=${session.student_id}`
        });
      }

      resetResultForm();
      await fetchResults();
      showToast(`${selectedWeek}주차 결과물이 제출되었습니다! ✅`);

      // 관찰기록 리마인더 체크
      if (selectedWeek) {
        const norm2 = (s: string) => s?.replace(/\s+/g, '').toLowerCase() || '';
        const weekPlan = (classResources as any[]).find(r => r.week === selectedWeek);
        const weekTopic = weekPlan?.topic || '';
        if (weekTopic) {
          const hasObs = historyLogs.some((l: any) => norm2(l.activity_name || '') === norm2(weekTopic));
          if (!hasObs) {
            setTimeout(() => setReminderModal({
              type: 'need_obs',
              week: selectedWeek,
              topic: weekTopic,
            }), 1200);
          }
        }
      }
    } catch { showToast('오류가 발생했습니다.', 'error'); }
    finally { setResultSubmitting(false); }
  };

  const handleEditResult = async (result: any) => {
    setEditingResult(result);
    setResultTitle(result.title || '');
    setResultImageFile(null); setResultFileUpload(null); setImagePreview(null);
    if (resultImageInputRef.current) resultImageInputRef.current.value = '';
    if (resultFileInputRef.current) resultFileInputRef.current.value = '';

    // submission_group으로 같은 그룹의 모든 row 조회
    let groupResults: any[] = [result];
    if (result.submission_group) {
      const { data } = await supabase
        .from('student_results')
        .select('*')
        .eq('submission_group', result.submission_group);
      if (data && data.length > 0) groupResults = data;
    }
    setEditingGroupResults(groupResults);

    // 각 타입별 pre-populate
    const textRow  = groupResults.find((r: any) => r.result_type === 'text');
    const linkRow  = groupResults.find((r: any) => r.result_type === 'link');
    const imageRow = groupResults.find((r: any) => r.result_type === 'image');

    setResultText(textRow?.text_content || '');
    setResultUrl(linkRow?.link_url || '');

    if (imageRow?.storage_path) {
      const { data } = supabase.storage.from('student-attachments').getPublicUrl(imageRow.storage_path);
      setImagePreview(data.publicUrl);
    }

    // 수정 중인 주차 고정
    setSelectedWeek(result.week_number || null);

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
      if (data) {
        setSuggestions(data);
        // 읽지 않은 답변이 있으면 읽음 처리
        const unreadIds = data
          .filter(s => s.teacher_reply && !s.is_reply_read)
          .map(s => s.id);
        if (unreadIds.length > 0) {
          await supabase.from('student_suggestions')
            .update({ is_reply_read: true })
            .in('id', unreadIds);
          setUnreadReplyCount(0);
        }
      }
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
        type: 'student_submission',
        link: `/classroom?id=${session.class_id}&student_id=${session.student_id}`
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

  const fetchActiveQuizSessions = async () => {
    if (!session?.class_id) return;
    setQuizLoading(true);
    try {
      const { data, error } = await supabase
        .from('quiz_sessions')
        .select('id, pin_code, state, created_at, quiz_sets(title)')
        .eq('class_id', session.class_id)
        .neq('state', 'FINAL')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setActiveQuizSessions(data);
      }
    } catch (err) {
      console.error('Error fetching quiz sessions:', err);
    } finally {
      setQuizLoading(false);
    }
  };

  const fetchBoard = async () => {
    if (!session?.class_id) return;
    setBoardLoading(true);
    try {
      const norm = (s: string) => s?.replace(/\s+/g, '').toLowerCase() || '';

      // 1. 학생 목록 조회
      const { data: studentList } = await supabase
        .from('students')
        .select('id, full_name')
        .eq('class_id', session.class_id);
      const studentIds = (studentList || []).map((s: any) => s.id);
      const nameMap: Record<string, string> = Object.fromEntries(
        (studentList || []).map((s: any) => [s.id, s.full_name])
      );

      // activity_name → week_number 매핑 (이미 로드된 classResources 사용)
      const topicWeekMap: Record<string, number> = {};
      (classResources as any[]).forEach((p: any) => {
        if (p.topic && p.week) topicWeekMap[norm(p.topic)] = Number(p.week);
      });

      if (studentIds.length === 0) { setBoardPosts([]); setBoardLoading(false); return; }

      // 2. 관찰기록 + 결과 병렬 조회 (최신 100건씩 제한 — 학생 뷰)
      const [{ data: obs }, { data: results }] = await Promise.all([
        supabase
          .from('observations')
          .select('id, student_id, activity_name, content, created_at, status')
          .in('student_id', studentIds)
          .eq('is_student_record', true)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('student_results')
          .select('id, student_id, week_number, title, text_content, storage_path, display_name, link_url, result_type, created_at')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      // 3. student_name 매핑 + 이미지 URL 변환(썸네일) + 관찰기록에 week_number 부여
      const obsPosts = (obs || []).map((o: any) => ({
        ...o,
        week_number: topicWeekMap[norm(o.activity_name)] ?? null,
        student_name: nameMap[o.student_id] || '학생',
        _type: 'obs' as const,
      }));
      const resultPosts = (results || []).map((r: any) => {
        let image_url = null;
        let image_original_url = null;
        let file_url = null;
        if (r.result_type === 'image' && r.storage_path) {
          const { data: orig } = supabase.storage.from('student-attachments').getPublicUrl(r.storage_path);
          image_original_url = orig?.publicUrl || null;
          const { data: thumb } = supabase.storage.from('student-attachments').getPublicUrl(r.storage_path, {
            transform: { width: 600, quality: 70 },
          });
          image_url = thumb?.publicUrl || image_original_url;
        } else if (r.result_type === 'file' && r.storage_path) {
          const { data: urlData } = supabase.storage.from('student-attachments').getPublicUrl(r.storage_path);
          file_url = urlData?.publicUrl || null;
        }
        return { ...r, image_url, image_original_url, file_url, student_name: nameMap[r.student_id] || '학생', _type: 'result' as const };
      });

      setBoardPosts([...obsPosts, ...resultPosts].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (err) {
      console.error('fetchBoard error:', err);
    } finally {
      setBoardLoading(false);
    }
  };

  const handleTabChange = (tab: 'home' | 'record' | 'history' | 'badges' | 'materials' | 'results' | 'unit' | 'suggestions' | 'quiz' | 'board') => {
    setActiveTab(tab);
    setIsMoreSheetOpen(false);
    if (tab === 'history') { fetchHistory(); fetchResults(); }
    if (tab === 'materials') fetchResources();
    if (tab === 'results') fetchResults();
    if (tab === 'unit') fetchPendingUnits();
    if (tab === 'suggestions') fetchSuggestions();
    if (tab === 'quiz') fetchActiveQuizSessions();
    if (tab === 'board') fetchBoard();
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
    if (!title) {
      const hasTopics = classResources && classResources.length > 0 && classResources[0]?.topic;
      showToast(hasTopics ? '주차를 선택해주세요.' : '활동 제목을 입력해주세요.', 'error');
      return;
    }
    if (!content) {
      showToast('활동 내용을 입력해주세요.', 'error');
      return;
    }

    if (!session?.student_id || !teacherId) return;

    // ── 최소 글자수 검사 (하드 차단) ────────────────────────────────────────
    if (minObsChars > 0 && content.trim().length < minObsChars) {
      showToast(`주요 활동 내용을 최소 ${minObsChars}자 이상 작성해주세요. (현재 ${content.trim().length}자)`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      // ── AI 가이드 검토 ──────────────────────────────────────────────────────
      // guidePrompt가 있을 때만 실행. AI 오류가 나더라도 제출 자체는 막지 않음.
      // AI 검토 결과를 저장해서 관찰기록 저장 시 함께 사용
      let aiReviewFlag: 'good' | 'review_needed' | null = null;
      let aiConcern = '';

      if (guidePrompt) {
        try {
          const contentLength = content.trim().length;
          const prompt = `
당신은 학생이 제출한 활동 기록을 검토하는 AI 가이드입니다.
선생님의 지침을 참고하여 아래 3단계로 평가하세요.

[교사의 지침]
${guidePrompt}

[학생이 제출한 활동 정보]
제목: "${title}"
내용(${contentLength}자): "${content}"
배운 점 및 느낀 점: "${feeling}"

━━ 평가 기준 ━━

1. reject (제출 차단):
   - 'ㅋ', 'ㅎ', '모름', '없음' 같은 무성의한 내용만 있는 경우
   - 내용이 사실상 비어 있는 경우

2. review_needed (자동 승인되나 선생님에게 검토 권장 알림):
   【품질 부족】 다음 중 하나 이상:
   - 3문장 이하로 너무 짧고 구체성 없음
   - 수업 주제("${title}")와 전혀 무관한 내용
   - 교사 지침의 핵심 항목을 전혀 반영하지 않음

   【AI 생성 의심】 다음 중 2가지 이상:
   - 중고등학생 수준을 넘는 격식체·학술어 다수 사용 (예: "함양", "도모", "고찰", "심층적 탐구", "역량 증진")
   - AI 특유 한국어 상투어 다수 포함 (예: "다양한 관점에서", "비판적 사고력 향상", "융합적 사고", "깊이 있는 이해", "핵심 역량 함양", "통해 성장할 수 있었습니다")
   - 개인 에피소드·감정·실수담이 전혀 없고 교과서식 일반 서술만 존재
   - 구어체·개인 어투("~해서 신기했다", "솔직히", "처음엔 어려웠는데")가 전혀 없고 모두 격식 문어체
   - 500자 초과이면서 위 특징을 2개 이상 포함

   → concern 필드: 선생님께 전달할 검토 이유 한 문장. AI 생성 의심이면 "AI 생성 의심:" 으로 시작.

3. good (승인):
   - 개인 경험·진정성이 느껴지거나 수업과 관련된 내용이면 문법·분량 무관하게 good
   - 한두 가지 특징만 해당되는 애매한 경우도 good으로 판단

반드시 아래 JSON 형식만 반환하세요 (다른 텍스트 없이):
{"status":"good","concern":"","reason":"","guide":""}
`;
          const aiResult = await geminiFlash.generateContent(prompt);
          const aiResponseText = aiResult.response.text();

          const jsonMatch = aiResponseText.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.status === 'reject') {
              setAiFeedback({ reason: parsed.reason || '', guide: parsed.guide || '' });
              setIsRejectModalOpen(true);
              setSubmitting(false);
              return;
            }
            if (parsed.status === 'review_needed' && parsed.concern) {
              aiReviewFlag = 'review_needed';
              aiConcern = parsed.concern;
            } else {
              aiReviewFlag = 'good';
            }
          }
        } catch (aiErr) {
          console.warn('[AI 검토 오류 — 제출 진행]', aiErr);
        }
      }

      // ── 1. 관찰 기록 저장 ──────────────────────────────────────────────────
      // AI 검토 권장인 경우 pending으로 저장 (선생님 확인 필요)
      const obsStatus = aiReviewFlag === 'review_needed' ? 'pending' : 'approved';
      const { error: obsError } = await supabase
        .from('observations')
        .insert({
          teacher_id: teacherId,
          student_id: session.student_id,
          activity_name: title,
          content: `${content}\n\n[배운 점 및 느낀 점]\n${feeling}`,
          is_student_record: true,
          status: obsStatus,
          ai_concern: aiReviewFlag === 'review_needed' ? aiConcern : null,
          category: session?.subject || '학생 제출'
        });

      if (obsError) throw new Error(`기록 저장 오류: ${obsError.message}`);

      // ── 2. 교사 알림 전송 (실패해도 제출 성공으로 처리) ───────────────────
      supabase
        .from('notifications')
        .insert({
          user_id: teacherId,
          title: `📝 ${session.student_name}이(가) 활동을 제출했습니다`,
          content: `"${title}" — ${session.class_name}`,
          type: 'student_submission',
          link: `/classroom?id=${session.class_id}&student_id=${session.student_id}`,
        })
        .then(({ error }) => {
          if (error) console.warn('[알림 전송 실패]', error.message);
        });

      // ── 3. AI 검토 권장 시 선생님에게 별도 알림 ─────────────────────────────
      if (aiReviewFlag === 'review_needed' && aiConcern) {
        const isAiGenerated = aiConcern.startsWith('AI 생성 의심');
        supabase
          .from('notifications')
          .insert({
            user_id: teacherId,
            title: isAiGenerated
              ? `🤖 AI 생성 의심 · ${session.student_name} "${title}"`
              : `⚠️ AI 검토 권장 · ${session.student_name} "${title}"`,
            content: aiConcern,
            type: 'ai_review_needed',
            link: `/classroom?id=${session.class_id}&student_id=${session.student_id}`,
          })
          .then(({ error }) => {
            if (error) console.warn('[AI 검토 알림 실패]', error.message);
          });
      }

      showToast(
        aiReviewFlag === 'review_needed'
          ? '제출 완료! AI 검토가 필요하여 선생님 확인 후 반영됩니다. ⚠️'
          : '제출 완료! ✅'
      );

      // 결과제출 리마인더 체크 — stale state 대신 DB 직접 조회
      const normR = (s: string) => s?.replace(/\s+/g, '').toLowerCase() || '';
      const matchedWeekPlan = (classResources as any[]).find(r => normR(r.topic) === normR(title));
      if (matchedWeekPlan && matchedWeekPlan.requires_result !== false) {
        const { count } = await supabase
          .from('student_results')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', session.student_id)
          .eq('class_id', session.class_id)
          .eq('week_number', matchedWeekPlan.week);
        if ((count ?? 0) === 0) {
          setTimeout(() => setReminderModal({
            type: 'need_result',
            week: matchedWeekPlan.week,
            topic: matchedWeekPlan.topic,
          }), 1200);
        }
      }

      setTitle('');
      setContent('');
      setFeeling('');
      handleTabChange('history');

    } catch (err: any) {
      console.error('[handleSubmit 오류]', err);
      showToast('저장 중 오류가 발생했습니다: ' + err.message, 'error');
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
    <div className="min-h-screen bg-surface flex flex-col p-6 pb-28">
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
          {/* 관찰 기록 탭 제출 버튼 — 상단 고정 */}
          {activeTab === 'record' && (
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-end gap-3 bg-violet-50/40">
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-black text-slate-500 hover:text-slate-700 transition-all rounded-xl hover:bg-slate-200 whitespace-nowrap">
                <Save size={15} />임시 저장
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 btn-gradient rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : (
                  <><Send size={15} /> 활동 기록 제출하기</>
                )}
              </button>
            </div>
          )}

          {/* Tab Contents */}
          <AnimatePresence mode="wait">
            {/* ─── 홈 탭 ─── */}
            {activeTab === 'home' && (() => {
              const weeklyPlan: {week: number; topic: string}[] = classResources as {week: number; topic: string}[];
              const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

              // 기본 선택 주차: 마지막 주차
              const displayWeek = selectedHomeWeek ?? (weeklyPlan.length > 0 ? weeklyPlan[weeklyPlan.length - 1].week : null);
              const weekInfo = weeklyPlan.find(p => p.week === displayWeek);

              // 완료 여부
              const obsSubmitted = displayWeek !== null && weekInfo
                ? historyLogs.some(l => norm(l.activity_name || '') === norm(weekInfo.topic))
                : false;
              const resultSubmitted = displayWeek !== null
                ? results.some(r => r.week_number === displayWeek)
                : false;

              const steps = [
                {
                  step: 1,
                  label: '관찰 기록 작성',
                  desc: '수업에서 한 활동, 배운 점, 느낀 점을 기록하세요',
                  done: obsSubmitted,
                  tab: 'record' as const,
                  color: 'violet',
                },
                {
                  step: 2,
                  label: '결과물 제출',
                  desc: '만든 결과물을 텍스트·이미지·링크·파일로 올리세요',
                  done: resultSubmitted,
                  tab: 'results' as const,
                  color: 'emerald',
                },
              ];

              return (
                <motion.div key="home" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="p-6 md:p-8 space-y-6">

                  {/* 인사 */}
                  <div>
                    <p className="text-sm font-bold text-on-surface-variant/60">{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} · {session?.class_name}</p>
                    <h2 className="text-2xl font-black mt-0.5">안녕하세요, {session?.student_name}님! 👋</h2>
                  </div>

                  {/* 주차 선택 */}
                  {weeklyPlan.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-black text-on-surface-variant/50 uppercase tracking-widest">주차 선택</p>
                      <div className="flex flex-wrap gap-2">
                        {weeklyPlan.map(p => {
                          const isActive = p.week === displayWeek;
                          const wObs = historyLogs.some(l => norm(l.activity_name || '') === norm(p.topic));
                          const wRes = results.some(r => r.week_number === p.week);
                          const allDone = wObs && wRes;
                          return (
                            <button
                              key={p.week}
                              onClick={() => setSelectedHomeWeek(p.week)}
                              className={`relative flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-black border-2 transition-all ${
                                isActive ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-neutral-500 border-neutral-200 hover:border-primary/40 hover:text-primary'
                              }`}
                            >
                              {allDone && <CheckCircle2 size={14} className={isActive ? 'text-white/80' : 'text-emerald-500'} />}
                              {p.week}주차
                              <span className={`text-[10px] font-bold ${isActive ? 'text-white/70' : 'text-neutral-400'}`}>· {p.topic}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 체크리스트 */}
                  {displayWeek !== null ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-black text-on-surface-variant/50 uppercase tracking-widest">
                          {displayWeek}주차 할 일
                        </p>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
                          {steps.filter(s => s.done).length}/{steps.length} 완료
                        </span>
                      </div>

                      {steps.map((s) => (
                        <div key={s.step} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                          s.done
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-white border-neutral-200 hover:border-primary/30'
                        }`}>
                          {/* 완료 아이콘 */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${
                            s.done ? 'bg-emerald-500 text-white' : 'bg-neutral-100 text-neutral-400'
                          }`}>
                            {s.done ? <Check size={18} /> : s.step}
                          </div>

                          {/* 텍스트 */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-black text-sm ${s.done ? 'text-emerald-700 line-through decoration-emerald-300' : 'text-on-surface'}`}>
                              Step {s.step} · {s.label}
                            </p>
                            <p className="text-xs font-bold text-on-surface-variant/60 mt-0.5">{s.desc}</p>
                          </div>

                          {/* 버튼 */}
                          {s.done ? (
                            <span className="text-[11px] font-black text-emerald-600 shrink-0">완료 ✓</span>
                          ) : (
                            <button
                              onClick={() => {
                                if (s.tab === 'results') setSelectedWeek(displayWeek);
                                handleTabChange(s.tab);
                              }}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-black hover:bg-primary/80 active:scale-95 transition-all shrink-0 shadow-sm"
                            >
                              시작하기 <ArrowRight size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-on-surface-variant/40">
                      <p className="font-black">등록된 주차 계획이 없습니다.</p>
                      <p className="text-sm font-bold mt-1">선생님께 주차 계획을 요청하세요.</p>
                    </div>
                  )}

                  {/* 바로가기 */}
                  <div className="pt-2 border-t border-neutral-100">
                    <p className="text-[11px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-3">바로가기</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'materials' as const, label: '수업 자료', icon: BookOpen, color: 'text-cyan-600 bg-cyan-50' },
                        { key: 'badges' as const,    label: '나의 배지', icon: Trophy,   color: 'text-yellow-600 bg-yellow-50' },
                        { key: 'suggestions' as const, label: '건의사항', icon: Megaphone, color: 'text-rose-600 bg-rose-50' },
                      ].map(item => (
                        <button key={item.key} onClick={() => handleTabChange(item.key)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-neutral-200 hover:border-primary/30 bg-white hover:bg-primary/5 transition-all text-sm font-black text-on-surface-variant">
                          <item.icon size={15} className={item.color.split(' ')[0]} />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })()}

            {/* ─── RECORD FORM 탭 ─── */}
            {activeTab === 'record' && (
              <motion.div
                key="record"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-12 space-y-12"
              >
                {/* Step 1 배너 */}
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-violet-50 border border-violet-200">
                  <div className="w-8 h-8 rounded-xl bg-violet-500 text-white flex items-center justify-center font-black text-sm shrink-0">1</div>
                  <div>
                    <p className="text-xs font-black text-violet-700">Step 1 · 관찰 기록 작성</p>
                    <p className="text-[11px] font-bold text-violet-500/80">수업에서 한 활동, 배운 점, 느낀 점을 기록하고 제출하세요.</p>
                  </div>
                  <button onClick={() => handleTabChange('home')} className="ml-auto text-[11px] font-black text-violet-400 hover:text-violet-600 shrink-0">홈으로 →</button>
                </div>

                {classResources && classResources.length > 0 && classResources[0]?.topic ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between ml-2">
                      <label className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">
                        주차별 주제 선택 <span className="text-red-400 ml-0.5">*</span>
                      </label>
                      <span className="text-[10px] text-on-surface-variant/40 font-bold">주제를 선택해야 제출할 수 있습니다</span>
                    </div>
                    <div className="relative">
                      <select
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={`w-full px-10 py-6 rounded-3xl text-xl font-black focus:ring-8 transition-all border-2 appearance-none cursor-pointer ${
                          title
                            ? 'bg-primary/5 border-primary/30 text-primary focus:ring-primary/10 focus:border-primary/50'
                            : 'bg-neutral-100 border-neutral-200/50 text-neutral-400 focus:ring-primary/10 focus:border-primary/30'
                        }`}
                      >
                        <option value="">주차를 선택하세요...</option>
                        {classResources.map((item: any, idx: number) => (
                          <option key={idx} value={item.topic}>
                            {item.week}주차: {item.topic}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-primary/60">▼</div>
                    </div>
                  </div>
                ) : (
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
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-primary uppercase tracking-[0.2em] ml-2">주요 활동 내용</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="오늘 수업에서 내가 어떤 역할을 맡았고, 어떤 구체적인 활동 과정을 거쳤는지 자세히 입력하세요..."
                      className={`w-full min-h-[350px] p-10 bg-neutral-100/80 backdrop-blur-sm rounded-[2.5rem] text-base leading-relaxed font-semibold focus:ring-8 transition-all border-2 resize-none shadow-sm ${
                        minObsChars > 0 && content.trim().length < minObsChars && content.trim().length > 0
                          ? 'border-amber-300 focus:border-amber-400 focus:ring-amber-100'
                          : minObsChars > 0 && content.trim().length >= minObsChars
                          ? 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100'
                          : 'border-neutral-200/50 focus:border-primary/30 focus:ring-primary/10'
                      }`}
                    />
                    {minObsChars > 0 && (
                      <div className="mt-3 px-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black ${
                            content.trim().length === 0 ? 'text-neutral-400' :
                            content.trim().length < minObsChars ? 'text-amber-500' : 'text-emerald-600'
                          }`}>
                            {content.trim().length === 0
                              ? `최소 ${minObsChars}자 이상 작성해야 제출할 수 있어요`
                              : content.trim().length < minObsChars
                              ? `${minObsChars - content.trim().length}자 더 작성해야 제출할 수 있어요`
                              : '✓ 충분히 작성됐어요!'}
                          </span>
                          <span className={`text-xs font-black tabular-nums ${
                            content.trim().length < minObsChars ? 'text-amber-500' : 'text-emerald-600'
                          }`}>
                            {content.trim().length} / {minObsChars}자
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              content.trim().length >= minObsChars ? 'bg-emerald-400' : 'bg-amber-400'
                            }`}
                            style={{ width: `${Math.min((content.trim().length / minObsChars) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
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
            {activeTab === 'history' && (() => {
              // 관찰 기록 + 결과 제출 통합 타임라인
              const obsItems = historyLogs.map(l => ({ ...l, _kind: 'obs' as const }));
              const resItems = results.map(r => ({ ...r, _kind: 'result' as const }));
              const allItems = [...obsItems, ...resItems].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              );
              const filtered = historyFilter === 'all' ? allItems
                : historyFilter === 'obs' ? allItems.filter(i => i._kind === 'obs')
                : allItems.filter(i => i._kind === 'result');

              const resultTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
                text:  { icon: <AlignLeft size={13} />,  label: '텍스트', color: 'text-primary bg-primary/10' },
                link:  { icon: <Link2 size={13} />,      label: '링크',   color: 'text-blue-500 bg-blue-50' },
                image: { icon: <ImageIcon size={13} />,  label: '이미지', color: 'text-emerald-500 bg-emerald-50' },
                file:  { icon: <File size={13} />,       label: '파일',   color: 'text-amber-500 bg-amber-50' },
              };

              return (
                <motion.div
                  key="history"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-12 space-y-6 min-h-[400px]"
                >
                  {/* 헤더 + 필터 */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                        <History size={24} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black font-manrope">제출 기록 이력</h3>
                        <p className="text-on-surface-variant text-sm font-bold mt-1">관찰 기록과 결과 제출 내역을 함께 확인하세요.</p>
                      </div>
                    </div>
                    {/* 필터 칩 */}
                    <div className="flex gap-2 shrink-0">
                      {([
                        { key: 'all' as const,    label: `전체 (${allItems.length})` },
                        { key: 'obs' as const,    label: `📝 관찰 기록 (${obsItems.length})` },
                        { key: 'result' as const, label: `📁 결과 제출 (${resItems.length})` },
                      ]).map(f => (
                        <button
                          key={f.key}
                          onClick={() => setHistoryFilter(f.key)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all whitespace-nowrap ${
                            historyFilter === f.key
                              ? 'bg-primary text-white border-primary'
                              : 'bg-surface-container text-on-surface-variant border-transparent hover:border-primary/30'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {historyLoading || resultsLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 size={36} className="animate-spin text-primary" />
                    </div>
                  ) : filtered.length > 0 ? (
                    <div className="space-y-4">
                      {filtered.map((item) => {
                        if (item._kind === 'obs') {
                          const log = item;
                          const isEditing = editingLogId === log.id;
                          const isDeleting = deletingLogId === log.id;
                          return (
                            <motion.div
                              key={`obs-${log.id}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              onClick={() => { if (!isEditing) setDetailItem(log); }}
                              className={`rounded-3xl border transition-all group ${
                                isEditing
                                  ? 'p-6 border-primary/30 bg-primary/[0.02] cursor-default'
                                  : 'p-6 bg-surface-container-low border-surface-container hover:border-violet-200 cursor-pointer'
                              }`}
                            >
                              {isEditing ? (
                                <div className="space-y-3">
                                  {classResources.length > 0 && (
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-primary uppercase tracking-widest">주차 선택</label>
                                      <div className="flex flex-wrap gap-1.5">
                                        {(classResources as {week: number; topic: string}[]).map(p => {
                                          const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
                                          const isActive = norm(editLogForm.activity_name) === norm(p.topic);
                                          return (
                                            <button key={p.week} type="button"
                                              onClick={() => setEditLogForm(prev => ({ ...prev, activity_name: p.topic }))}
                                              className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all ${isActive ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-400 border-neutral-200 hover:border-primary/40 hover:text-primary'}`}>
                                              {p.week}주차<span className={`ml-1 text-[9px] ${isActive ? 'text-white/70' : 'text-neutral-300'}`}>· {p.topic}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-primary uppercase tracking-widest">활동 제목 *</label>
                                    <input type="text" value={editLogForm.activity_name}
                                      onChange={e => setEditLogForm(prev => ({ ...prev, activity_name: e.target.value }))}
                                      className="w-full px-5 py-3 bg-white rounded-2xl font-bold text-sm border-2 border-primary/10 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">활동 내용</label>
                                    <textarea value={editLogForm.content} rows={5}
                                      onChange={e => setEditLogForm(prev => ({ ...prev, content: e.target.value }))}
                                      className="w-full px-5 py-3 bg-white rounded-2xl font-medium text-sm leading-relaxed border-2 border-surface-container focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10 resize-none transition-all" />
                                  </div>
                                  <div className="flex gap-3">
                                    <button onClick={() => handleSaveEditLog(log.id)} disabled={savingLogId === log.id}
                                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-black text-xs hover:bg-primary/80 active:scale-95 transition-all disabled:opacity-50 shadow-sm">
                                      {savingLogId === log.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} 저장
                                    </button>
                                    <button onClick={handleCancelEditLog}
                                      className="flex items-center gap-2 px-5 py-2.5 bg-surface-container text-on-surface-variant rounded-xl font-black text-xs hover:bg-surface-container-high active:scale-95 transition-all">
                                      <X size={13} /> 취소
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4 flex-1 min-w-0">
                                      <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600 shrink-0 mt-1">
                                        <FileText size={18} />
                                      </div>
                                      <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-md">📝 관찰 기록</span>
                                          {log.category && <span className="text-[10px] font-black text-secondary bg-secondary/10 px-2 py-0.5 rounded-md">{log.category}</span>}
                                        </div>
                                        <p className="font-black text-base group-hover:text-primary transition-colors">{log.activity_name}</p>
                                        <p className="text-sm text-on-surface-variant font-medium leading-relaxed line-clamp-2">{log.content}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <div className="text-right space-y-1">
                                        <p className="text-[11px] text-on-surface-variant font-bold flex items-center gap-1 justify-end">
                                          <Clock size={10} />{formatRelativeTime(log.created_at)}
                                        </p>
                                      </div>
                                      {log.status === 'rejected' ? (
                                        <div className="flex flex-col items-center gap-1">
                                          <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                                            <X size={14} className="text-red-500" />
                                          </div>
                                          <span className="text-[9px] font-black text-red-500">반려됨</span>
                                        </div>
                                      ) : log.status === 'pending' ? (
                                        <div className="flex flex-col items-center gap-1">
                                          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                                            <Clock size={14} className="text-amber-500" />
                                          </div>
                                          <span className="text-[9px] font-black text-amber-500">대기중</span>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col items-center gap-1">
                                          <CheckCircle2 size={18} className="text-secondary" />
                                          <span className="text-[9px] font-black text-secondary">승인됨</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {/* 선생님 피드백 (반려 시) */}
                                  {log.status === 'rejected' && log.teacher_feedback && (
                                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-2xl">
                                      <p className="text-[10px] font-black text-red-500 mb-1">선생님 피드백</p>
                                      <p className="text-xs font-bold text-red-700 leading-relaxed">{log.teacher_feedback}</p>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setTitle(log.activity_name || '');
                                          setContent('');
                                          setFeeling('');
                                          setActiveTab('record');
                                        }}
                                        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[10px] font-black transition-all"
                                      >
                                        <RefreshCw size={10} /> 수정 후 재제출
                                      </button>
                                    </div>
                                  )}
                                  <div className="flex justify-end gap-2 pt-1 border-t border-surface-container opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); handleStartEditLog(log); }}
                                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-surface-container hover:bg-primary/10 hover:text-primary text-on-surface-variant font-black text-xs transition-all">
                                      <Pencil size={12} /> 수정
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteLog(log.id); }} disabled={isDeleting}
                                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-surface-container hover:bg-error/10 hover:text-error text-on-surface-variant font-black text-xs transition-all disabled:opacity-50">
                                      {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} 삭제
                                    </button>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          );
                        }

                        // 결과 제출 카드
                        const r = item;
                        const tc = resultTypeConfig[r.submission_type] ?? resultTypeConfig['text'];
                        const weekLabel = r.week_number
                          ? `${r.week_number}주차${classResources.find((c: any) => c.week === r.week_number)?.topic ? ` · ${classResources.find((c: any) => c.week === r.week_number).topic}` : ''}`
                          : null;
                        return (
                          <motion.div
                            key={`result-${r.id}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={() => setDetailItem(r)}
                            className="p-6 bg-surface-container-low border border-surface-container hover:border-emerald-200 rounded-3xl transition-all group cursor-pointer"
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-1">
                                <FolderOpen size={18} />
                              </div>
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">📁 결과 제출</span>
                                  <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md ${tc.color}`}>{tc.icon}{tc.label}</span>
                                  {r.status === 'rejected' && (
                                    <span className="text-[10px] font-black text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                      <X size={9} /> 반려됨
                                    </span>
                                  )}
                                  {weekLabel && <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">{weekLabel}</span>}
                                </div>
                                {r.title && <p className="font-black text-base group-hover:text-primary transition-colors">{r.title}</p>}
                                {r.submission_type === 'text' && r.text_content && (
                                  <p className="text-sm text-on-surface-variant font-medium leading-relaxed line-clamp-2">{r.text_content}</p>
                                )}
                                {r.submission_type === 'link' && r.link_url && (
                                  <a href={r.link_url} target="_blank" rel="noopener noreferrer"
                                    className="text-sm text-blue-500 font-bold underline underline-offset-2 hover:text-blue-700 line-clamp-1 break-all">{r.link_url}</a>
                                )}
                                {(r.submission_type === 'image' || r.submission_type === 'file') && r.display_name && (
                                  <p className="text-sm text-on-surface-variant font-medium">{r.display_name}</p>
                                )}
                              </div>
                              <p className="text-[11px] text-on-surface-variant font-bold flex items-center gap-1 shrink-0">
                                <Clock size={10} />{formatRelativeTime(r.created_at)}
                              </p>
                            </div>
                            {/* 반려 피드백 */}
                            {r.status === 'rejected' && (
                              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-2xl">
                                <p className="text-[10px] font-black text-red-500 mb-1">선생님 피드백</p>
                                {r.rejection_feedback && (
                                  <p className="text-xs font-bold text-red-700 leading-relaxed mb-2">{r.rejection_feedback}</p>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleEditResult(r); handleTabChange('results'); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[10px] font-black transition-all"
                                >
                                  <RefreshCw size={10} /> 수정 후 재제출
                                </button>
                              </div>
                            )}
                            {/* 수정/삭제 버튼 */}
                            <div className="flex justify-end gap-2 pt-3 mt-2 border-t border-surface-container opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditResult(r); handleTabChange('results'); }}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-surface-container hover:bg-primary/10 hover:text-primary text-on-surface-variant font-black text-xs transition-all"
                              >
                                <Pencil size={12} /> 수정
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteResult(r); }}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-surface-container hover:bg-error/10 hover:text-error text-on-surface-variant font-black text-xs transition-all"
                              >
                                <Trash2 size={12} /> 삭제
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 space-y-4 opacity-30">
                      <History size={64} />
                      <p className="font-black text-lg">아직 제출한 기록이 없습니다.</p>
                    </div>
                  )}
                </motion.div>
              );
            })()}


            {/* ─── CLASS MATERIALS 탭 ─── */}
            {activeTab === 'materials' && (
              <motion.div
                key="materials"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6 space-y-5 min-h-[400px]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-cyan-100 rounded-2xl flex items-center justify-center text-cyan-600">
                    <BookOpen size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">수업 자료실</h3>
                    <p className="text-on-surface-variant text-xs font-bold mt-0.5">선생님이 작성하고 공개한 자료입니다.</p>
                  </div>
                </div>

                {resourcesLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 size={32} className="animate-spin text-primary" />
                  </div>
                ) : (() => {
                  // weekly_plan에 자료(material_id 또는 url)가 있는 주차만 필터링
                  const weeks = (classResources as any[]).filter(r => r.material_id || r.url);
                  if (weeks.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-24 space-y-4 opacity-30">
                        <BookOpen size={64} />
                        <p className="font-black text-lg">아직 등록된 수업 자료가 없습니다.</p>
                        <p className="text-sm font-bold">선생님이 자료를 공유해주시면 이곳에 표시됩니다.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      {weeks.map((res: any) => {
                        // material_id가 있으면 에디터 자료 사용
                        const mat = res.material_id
                          ? classMaterials.find(m => m.id === res.material_id)
                          : null;

                        if (res.material_id && mat) {
                          // ── 에디터 자료 카드 ──
                          return (
                            <div key={res.week} className="bg-white rounded-2xl border border-surface-container overflow-hidden hover:border-cyan-200 transition-all">
                              <button
                                className="w-full flex items-center gap-3 p-4 text-left"
                                onClick={() => {
                                  const next = expandedMaterialId === mat.id ? null : mat.id;
                                  setExpandedMaterialId(next);
                                  if (next) recordMaterialView(mat.id);
                                }}
                              >
                                <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center text-xs font-black shrink-0">
                                  {res.week}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-black text-sm">{res.topic || mat.title}</p>
                                  <p className="text-[11px] text-cyan-600 font-bold mt-0.5">{mat.title}</p>
                                </div>
                                <ArrowRight
                                  size={16}
                                  className={`shrink-0 text-on-surface-variant transition-transform duration-200 ${
                                    expandedMaterialId === mat.id ? 'rotate-90' : ''
                                  }`}
                                />
                              </button>

                              {expandedMaterialId === mat.id && (
                                <div className="border-t border-surface-container">
                                  {mat.url && (
                                    <a
                                      href={mat.url.startsWith('http') ? mat.url : `https://${mat.url}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors border-b border-surface-container"
                                    >
                                      <ExternalLink size={14} />
                                      <span className="truncate">{mat.url}</span>
                                    </a>
                                  )}
                                  {mat.content ? (
                                    <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
                                      <ReactMarkdown
                                        components={{
                                          h1: ({ children }: any) => <h1 className="text-xl font-black mb-3 mt-4">{children}</h1>,
                                          h2: ({ children }: any) => <h2 className="text-lg font-black mb-2 mt-3">{children}</h2>,
                                          h3: ({ children }: any) => <h3 className="text-base font-black mb-2 mt-3">{children}</h3>,
                                          p: ({ children }: any) => <p className="mb-2.5 text-sm leading-relaxed">{children}</p>,
                                          ul: ({ children }: any) => <ul className="list-disc pl-5 mb-2.5 space-y-1">{children}</ul>,
                                          ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-2.5 space-y-1">{children}</ol>,
                                          li: ({ children }: any) => <li className="text-sm">{children}</li>,
                                          blockquote: ({ children }: any) => (
                                            <blockquote className="border-l-4 border-cyan-400 pl-3 italic text-on-surface-variant my-2 bg-cyan-50 py-1.5 rounded-r-lg text-sm">
                                              {children}
                                            </blockquote>
                                          ),
                                          code: ({ children, className }: any) => {
                                            if (!className) return <code className="bg-surface-container px-1.5 py-0.5 rounded text-xs font-mono text-primary">{children}</code>;
                                            return <code className={className}>{children}</code>;
                                          },
                                          pre: ({ children }: any) => {
                                            const child = (Array.isArray(children) ? children[0] : children) as any;
                                            const lang = (child?.props?.className || '').replace('language-', '') || 'text';
                                            const code = String(child?.props?.children ?? '').replace(/\n$/, '');
                                            return <CodeBlock lang={lang} code={code} />;
                                          },
                                          a: ({ href, children }: any) => (
                                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm hover:opacity-70">{children}</a>
                                          ),
                                          img: ({ src, alt }: any) => <img src={src} alt={alt} className="max-w-full rounded-xl my-2 shadow-sm" />,
                                          hr: () => <hr className="border-surface-container my-3" />,
                                          strong: ({ children }: any) => <strong className="font-black">{children}</strong>,
                                          em: ({ children }: any) => <em className="italic">{children}</em>,
                                        }}
                                      >
                                        {mat.content}
                                      </ReactMarkdown>
                                    </div>
                                  ) : (
                                    <p className="px-5 py-4 text-sm text-on-surface-variant font-bold opacity-50">
                                      작성된 내용이 없습니다. 링크를 참고해 주세요.
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }

                        // ── URL 링크 카드 ──
                        if (res.url) {
                          const href = res.url.startsWith('http') ? res.url : `https://${res.url}`;
                          return (
                            <a
                              key={res.week}
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-surface-container hover:border-primary/30 hover:shadow-sm transition-all group"
                            >
                              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0">
                                {res.week}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-sm truncate group-hover:text-primary transition-colors">
                                  {res.topic || '수업 자료'}
                                </p>
                                <p className="text-[11px] text-on-surface-variant truncate opacity-60 font-medium">{res.url}</p>
                              </div>
                              <ExternalLink size={14} className="shrink-0 text-on-surface-variant group-hover:text-primary transition-colors" />
                            </a>
                          );
                        }

                        return null;
                      })}
                    </div>
                  );
                })()}
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
                {/* Step 2 배너 */}
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-sm shrink-0">2</div>
                  <div>
                    <p className="text-xs font-black text-emerald-700">Step 2 · 결과물 제출</p>
                    <p className="text-[11px] font-bold text-emerald-500/80">관찰 기록 작성 후 결과물을 업로드하세요.</p>
                  </div>
                  <button onClick={() => handleTabChange('home')} className="ml-auto text-[11px] font-black text-emerald-400 hover:text-emerald-600 shrink-0">홈으로 →</button>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <FolderOpen size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black font-manrope">결과 제출</h3>
                    <p className="text-on-surface-variant text-sm font-bold mt-1">
                      주차를 선택하고 텍스트·링크·이미지·파일을 한 번에 제출하세요.
                    </p>
                  </div>
                </div>

                {/* ── 주차 선택 ── */}
                <div ref={resultFormRef} className="space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/70">
                    주차 선택 {editingResult ? '' : '*'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(classResources.length > 0
                      ? classResources.map((r: any) => ({ week: r.week, label: `${r.week}주차${r.topic ? `: ${r.topic}` : ''}` }))
                      : Array.from({ length: 16 }, (_, i) => ({ week: i + 1, label: `${i + 1}주차` }))
                    ).map(({ week, label }) => (
                      <button
                        key={week}
                        onClick={() => { if (!editingResult) setSelectedWeek(week); }}
                        className={`px-4 py-2 rounded-xl text-xs font-black border-2 transition-all ${
                          selectedWeek === week
                            ? 'bg-primary text-white border-primary shadow-md'
                            : 'bg-surface-container text-on-surface-variant border-transparent hover:border-primary/30'
                        } ${editingResult ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── 수정 중 배너 ── */}
                {editingResult && (
                  <div className="flex items-center justify-between px-5 py-4 bg-amber-50 border border-amber-200 rounded-2xl">
                    <div>
                      <p className="text-sm font-black text-amber-700">
                        ✏️ {editingResult.week_number}주차 결과물 수정 중
                      </p>
                      <p className="text-xs font-bold text-amber-500 mt-0.5">
                        항목을 추가하거나 내용을 수정할 수 있습니다
                      </p>
                    </div>
                    <button onClick={resetResultForm} className="text-xs font-black text-amber-500 hover:text-amber-700 flex items-center gap-1">
                      <X size={14} /> 취소
                    </button>
                  </div>
                )}

                {/* ── 통합 입력 폼 ── */}
                <div className="space-y-4 bg-surface-container-low rounded-3xl p-6 border border-surface-container">
                  <input
                    type="text"
                    value={resultTitle}
                    onChange={e => setResultTitle(e.target.value)}
                    placeholder="제목 (선택사항)"
                    className="w-full px-5 py-3.5 bg-white rounded-2xl font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 border-2 border-transparent focus:border-primary/20 transition-all"
                  />

                  {/* 텍스트 */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[11px] font-black text-primary/70 uppercase tracking-widest">
                      <AlignLeft size={13} /> 텍스트
                    </label>
                    <textarea
                      value={resultText}
                      onChange={e => setResultText(e.target.value)}
                      placeholder="수업 내용, 느낀 점 등을 자유롭게 작성하세요..."
                      rows={4}
                      className="w-full p-5 bg-white rounded-2xl font-bold text-sm leading-relaxed focus:outline-none focus:ring-4 focus:ring-primary/10 border-2 border-transparent focus:border-primary/20 resize-none transition-all"
                    />
                  </div>

                  {/* 링크 */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[11px] font-black text-blue-500/80 uppercase tracking-widest">
                      <Link2 size={13} /> 링크
                    </label>
                    <input
                      type="url"
                      value={resultUrl}
                      onChange={e => setResultUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-5 py-3.5 bg-white rounded-2xl font-bold text-sm focus:outline-none focus:ring-4 focus:ring-blue-100 border-2 border-transparent focus:border-blue-300 transition-all"
                    />
                  </div>

                  {/* 이미지 */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[11px] font-black text-emerald-600/80 uppercase tracking-widest">
                      <ImageIcon size={13} /> 이미지
                    </label>
                    <div
                      onClick={() => resultImageInputRef.current?.click()}
                      className="border-2 border-dashed border-emerald-200 rounded-2xl p-6 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-all text-center group"
                    >
                      {imagePreview ? (
                        <div>
                          <img src={imagePreview} alt="preview" className="max-h-36 mx-auto rounded-xl object-contain" />
                          <p className="text-xs font-bold text-emerald-600 mt-2">
                            {resultImageFile
                              ? resultImageFile.name
                              : (editingGroupResults.find((r: any) => r.result_type === 'image')?.display_name || '현재 이미지') + ' — 새 이미지 선택 시 교체'}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                            <ImageIcon size={20} className="text-emerald-500" />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-emerald-600 text-sm">이미지 선택</p>
                            <p className="text-xs font-bold text-emerald-400">JPG, PNG, GIF, WEBP (최대 20MB)</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <input ref={resultImageInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageFileSelect} />
                  </div>

                  {/* 파일 */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-[11px] font-black text-amber-600/80 uppercase tracking-widest">
                      <File size={13} /> 파일
                    </label>
                    <div
                      onClick={() => resultFileInputRef.current?.click()}
                      className="border-2 border-dashed border-amber-200 rounded-2xl p-6 cursor-pointer hover:border-amber-400 hover:bg-amber-50/50 transition-all group"
                    >
                      {(() => {
                        const existingFile = editingGroupResults.find((r: any) => r.result_type === 'file');
                        if (resultFileUpload) {
                          return (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                <File size={18} className="text-amber-500" />
                              </div>
                              <div>
                                <p className="font-black text-sm">{resultFileUpload.name}</p>
                                <p className="text-xs font-bold text-amber-500">{formatFileSize(resultFileUpload.size)}</p>
                              </div>
                            </div>
                          );
                        }
                        if (editingResult && existingFile?.storage_path) {
                          return (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                <File size={18} className="text-amber-500" />
                              </div>
                              <div>
                                <p className="font-black text-sm text-amber-700">{existingFile.display_name || '현재 파일'}</p>
                                <p className="text-xs font-bold text-amber-400">새 파일 선택 시 교체됩니다</p>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="flex items-center justify-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                              <Upload size={18} className="text-amber-500" />
                            </div>
                            <div>
                              <p className="font-black text-amber-600 text-sm">파일 선택</p>
                              <p className="text-xs font-bold text-amber-400">모든 파일 형식 (최대 20MB)</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <input ref={resultFileInputRef} type="file" className="hidden" accept="*" onChange={handleUploadFileSelect} />
                  </div>
                </div>

                <button
                  onClick={handleSubmitResult}
                  disabled={resultSubmitting}
                  className="w-full py-5 btn-gradient rounded-[1.25rem] font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {resultSubmitting ? <Loader2 size={20} className="animate-spin" /> : editingResult ? <><Send size={20} /> 수정 완료</> : <><Send size={20} /> {selectedWeek ? `${selectedWeek}주차 결과 제출` : '결과 제출하기'}</>}
                </button>

                {/* 제출 내역은 나의 기록 탭에서 확인 */}
                <div className="pt-2 border-t border-surface-container">
                  <button onClick={() => handleTabChange('history')}
                    className="flex items-center gap-2 text-sm font-black text-primary/60 hover:text-primary transition-colors">
                    <History size={14} /> 제출 내역은 나의 기록 탭에서 확인하세요 →
                  </button>
                </div>

                {false && <div className="space-y-4 pt-4 border-t border-surface-container">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-base">제출 내역</h4>
                    <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-lg">{results.length}개</span>
                  </div>

                  {resultsLoading ? (
                    <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin text-primary" /></div>
                  ) : results.length === 0 ? (
                    <div className="flex flex-col items-center py-16 space-y-3 opacity-30">
                      <FolderOpen size={48} />
                      <p className="font-black">아직 제출한 결과물이 없습니다.</p>
                    </div>
                  ) : (() => {
                    const typeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
                      text:  { icon: <AlignLeft size={15} />,  color: 'text-primary bg-primary/10',     label: '텍스트' },
                      link:  { icon: <Link2 size={15} />,      color: 'text-blue-500 bg-blue-50',       label: '링크' },
                      image: { icon: <ImageIcon size={15} />,  color: 'text-emerald-500 bg-emerald-50', label: '이미지' },
                      file:  { icon: <File size={15} />,       color: 'text-amber-500 bg-amber-50',     label: '파일' }
                    };
                    // 주차별 그룹핑 (week_number 없으면 0으로)
                    const grouped: Record<number, any[]> = {};
                    results.forEach(r => {
                      const w = r.week_number ?? 0;
                      if (!grouped[w]) grouped[w] = [];
                      grouped[w].push(r);
                    });
                    const weeks = Object.keys(grouped).map(Number).sort((a, b) => b - a);
                    const visibleWeeks = filterWeek === null ? weeks : weeks.filter(w => w === filterWeek);

                    return (
                      <div className="space-y-5">
                        {/* 주차 필터 칩 */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setFilterWeek(null)}
                            className={`px-4 py-1.5 rounded-xl text-xs font-black border-2 transition-all ${
                              filterWeek === null
                                ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                                : 'bg-surface-container text-on-surface-variant border-transparent hover:border-primary/30'
                            }`}
                          >
                            전체 <span className="opacity-60 font-bold">({results.length})</span>
                          </button>
                          {weeks.map(w => {
                            const topic = classResources.find((r: any) => r.week === w)?.topic;
                            const chipLabel = w === 0 ? '미지정' : topic ? `${w}주차 · ${topic}` : `${w}주차`;
                            return (
                              <button
                                key={w}
                                onClick={() => setFilterWeek(w)}
                                className={`px-4 py-1.5 rounded-xl text-xs font-black border-2 transition-all ${
                                  filterWeek === w
                                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                                    : 'bg-surface-container text-on-surface-variant border-transparent hover:border-primary/30'
                                }`}
                              >
                                {chipLabel} <span className="opacity-60 font-bold">({grouped[w].length})</span>
                              </button>
                            );
                          })}
                        </div>

                        {visibleWeeks.map(week => {
                          const weekLabel = week === 0 ? '주차 미지정'
                            : classResources.find((r: any) => r.week === week)?.topic
                              ? `${week}주차 — ${classResources.find((r: any) => r.week === week).topic}`
                              : `${week}주차`;
                          const weekItems = grouped[week];
                          return (
                            <div key={week} className="space-y-3">
                              <div className="flex items-center gap-3">
                                <span className="px-3 py-1 bg-primary/10 text-primary text-[11px] font-black rounded-lg">{weekLabel}</span>
                                <span className="text-[10px] font-bold text-on-surface-variant/40">{weekItems.length}개 항목</span>
                              </div>
                              <div className="space-y-2 pl-1">
                                {weekItems.map(r => {
                                  const cfg = typeConfig[r.result_type] || typeConfig.file;
                                  const publicUrl = r.storage_path
                                    ? supabase.storage.from('student-attachments').getPublicUrl(r.storage_path).data.publicUrl
                                    : null;
                                  const isEditing = editingResult?.id === r.id;
                                  return (
                                    <motion.div
                                      key={r.id}
                                      initial={{ opacity: 0, y: 6 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className={`p-4 rounded-2xl border-2 transition-all group ${isEditing ? 'border-amber-300 bg-amber-50/50' : 'border-surface-container bg-white hover:border-primary/20'}`}
                                    >
                                      <div className="flex items-start gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>{cfg.icon}</div>
                                        <div className="flex-1 min-w-0 space-y-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            {r.title && <p className="font-black text-sm">{r.title}</p>}
                                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${cfg.color}`}>{cfg.label}</span>
                                            {isEditing && <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md">수정 중</span>}
                                          </div>
                                          {r.text_content && <p className="text-xs font-bold text-on-surface-variant line-clamp-2 leading-relaxed">{r.text_content}</p>}
                                          {r.link_url && (
                                            <a href={r.link_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1 truncate">
                                              <ExternalLink size={11} />{r.link_url}
                                            </a>
                                          )}
                                          {r.result_type === 'image' && publicUrl && (
                                            <img src={publicUrl} alt={r.title || '이미지'} className="max-h-24 rounded-xl object-cover mt-1 cursor-pointer" onClick={() => window.open(publicUrl, '_blank')} />
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
                                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {(r.result_type === 'image' || r.result_type === 'file') && r.storage_path && (
                                            <button onClick={() => handleDownloadResult(r)} title="다운로드" className="w-7 h-7 rounded-lg bg-surface-container hover:bg-primary/10 hover:text-primary flex items-center justify-center text-on-surface-variant transition-all">
                                              <Upload size={12} className="rotate-180" />
                                            </button>
                                          )}
                                          <button onClick={() => handleEditResult(r)} title="수정" className="w-7 h-7 rounded-lg bg-surface-container hover:bg-amber-100 hover:text-amber-600 flex items-center justify-center text-on-surface-variant transition-all">
                                            <FileText size={12} />
                                          </button>
                                          <button onClick={() => handleDeleteResult(r)} title="삭제" className="w-7 h-7 rounded-lg bg-surface-container hover:bg-error/10 hover:text-error flex items-center justify-center text-on-surface-variant transition-all">
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </div>
                                    </motion.div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>}
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
                                  <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
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

                                {/* 선생님 답변 버블 */}
                                {s.teacher_reply ? (
                                  <div className="ml-14 p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-1">
                                    <p className="text-[9px] font-black text-primary uppercase tracking-[0.15em] flex items-center gap-1.5">
                                      <span className="w-4 h-4 rounded-md bg-primary/20 flex items-center justify-center text-primary">↩</span>
                                      선생님 답변
                                    </p>
                                    <p className="text-sm font-medium text-on-surface leading-relaxed">{s.teacher_reply}</p>
                                    {s.replied_at && (
                                      <p className="text-[9px] font-bold text-on-surface-variant/30 flex items-center gap-1">
                                        <Clock size={9} /> {formatRelativeTime(s.replied_at)}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="ml-14 px-4 py-2.5 rounded-xl bg-surface-container border border-dashed border-surface-container-highest flex items-center gap-2">
                                    <Clock size={12} className="text-on-surface-variant/30" />
                                    <p className="text-[11px] font-bold text-on-surface-variant/40">답변 대기 중</p>
                                  </div>
                                )}

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

            {/* ─── 퀴즈 탭 ─── */}
            {activeTab === 'quiz' && (
              <motion.div
                key="quiz"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="p-8 space-y-6"
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-purple-500 uppercase tracking-[0.25em]">Live Quiz</p>
                    <h2 className="text-2xl font-black">실시간 퀴즈</h2>
                    <p className="text-sm text-on-surface-variant font-bold">선생님이 시작한 퀴즈에 바로 참여하세요</p>
                  </div>
                  <button
                    onClick={fetchActiveQuizSessions}
                    disabled={quizLoading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-black text-xs transition-all disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={quizLoading ? 'animate-spin' : ''} />
                    새로고침
                  </button>
                </div>

                {/* 내용 */}
                {quizLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 size={28} className="animate-spin text-purple-500" />
                  </div>
                ) : activeQuizSessions.length === 0 ? (
                  <div className="flex flex-col items-center py-20 space-y-4">
                    <div className="w-20 h-20 rounded-3xl bg-purple-50 flex items-center justify-center">
                      <Gamepad2 size={36} className="text-purple-300" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-black text-on-surface opacity-40">진행 중인 퀴즈가 없습니다</p>
                      <p className="text-sm text-on-surface-variant/50 font-bold">선생님이 퀴즈를 시작하면 여기에 표시됩니다</p>
                    </div>
                    <button
                      onClick={fetchActiveQuizSessions}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 font-black text-sm hover:bg-purple-100 transition-all"
                    >
                      <RefreshCw size={14} />
                      다시 확인하기
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeQuizSessions.map((qs) => {
                      const quizTitle = (qs.quiz_sets as any)?.title ?? '퀴즈';
                      const stateLabel: Record<string, { text: string; color: string }> = {
                        LOBBY:   { text: '대기 중',   color: 'bg-amber-100 text-amber-700' },
                        QUIZ:    { text: '진행 중 🔥', color: 'bg-red-100 text-red-700' },
                        RESULT:  { text: '결과 확인', color: 'bg-blue-100 text-blue-700' },
                        RANKING: { text: '순위 발표', color: 'bg-violet-100 text-violet-700' },
                      };
                      const st = stateLabel[qs.state] ?? { text: qs.state, color: 'bg-surface-container text-on-surface-variant' };

                      return (
                        <motion.div
                          key={qs.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="rounded-3xl border-2 border-purple-100 bg-gradient-to-r from-purple-50 to-violet-50 p-6 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-200 shrink-0">
                              <Gamepad2 size={26} className="text-white" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${st.color}`}>
                                  {st.text}
                                </span>
                                <span className="text-[10px] font-black text-on-surface-variant/50 bg-white/60 px-2 py-0.5 rounded-full border border-surface-container">
                                  PIN: {qs.pin_code}
                                </span>
                              </div>
                              <h3 className="font-black text-on-surface text-base truncate">{quizTitle}</h3>
                              <p className="text-xs text-on-surface-variant font-bold mt-0.5">
                                {session?.student_name}으로 자동 입장됩니다
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              navigate(`/quiz/${qs.pin_code}`, {
                                state: { autoJoinName: session?.student_name }
                              });
                            }}
                            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 text-white font-black text-sm shadow-lg shadow-purple-200 hover:brightness-110 active:scale-95 transition-all shrink-0"
                          >
                            <Play size={16} />
                            입장하기
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
            {/* ─── 보드 탭 ─── */}
            {activeTab === 'board' && (
              <motion.div
                key="board"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6 md:p-8"
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <Users2 size={16} className="text-indigo-600" />
                      </div>
                      <h2 className="text-xl font-black">우리 반 보드</h2>
                    </div>
                    <p className="text-xs text-on-surface-variant font-bold ml-10">승인된 관찰기록·결과를 함께 봐요</p>
                  </div>
                  <button
                    onClick={fetchBoard}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 font-black text-xs hover:bg-indigo-100 transition-all"
                  >
                    <RefreshCw size={12} /> 새로고침
                  </button>
                </div>

                {/* 필터 바 */}
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  {/* 타입 필터 */}
                  <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                    {[
                      { key: 'all', label: '전체' },
                      { key: 'obs', label: '📝 관찰기록' },
                      { key: 'result', label: '📁 결과' },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setBoardTypeFilter(f.key as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                          boardTypeFilter === f.key
                            ? 'bg-white text-indigo-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* 주차 필터 */}
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <button
                      onClick={() => setBoardWeekFilter('all')}
                      className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                        boardWeekFilter === 'all'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      전체 주차
                    </button>
                    {Array.from(new Set(boardPosts.map(p => p.week_number).filter(Boolean))).sort((a,b)=>a-b).map(w => (
                      <button
                        key={w}
                        onClick={() => setBoardWeekFilter(w)}
                        className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                          boardWeekFilter === w
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        {w}주차
                      </button>
                    ))}
                  </div>
                </div>

                {/* 보드 콘텐츠 */}
                {boardLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 size={28} className="animate-spin text-indigo-500" />
                  </div>
                ) : (() => {
                  const filtered = boardPosts.filter(p => {
                    if (boardTypeFilter !== 'all' && p._type !== boardTypeFilter) return false;
                    if (boardWeekFilter !== 'all' && p.week_number !== boardWeekFilter) return false;
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="flex flex-col items-center py-20 space-y-4">
                        <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center">
                          <StickyNote size={36} className="text-indigo-200" />
                        </div>
                        <div className="text-center space-y-1">
                          <p className="font-black text-on-surface opacity-40">아직 게시물이 없어요</p>
                          <p className="text-sm text-on-surface-variant/50 font-bold">선생님이 승인한 기록이 여기에 나타납니다</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
                      {filtered.map((post) => {
                        const isObs = post._type === 'obs';
                        const isMe = post.student_id === session?.student_id;
                        const liked = !!boardLikes[post.id];

                        return (
                          <motion.div
                            key={`${post._type}-${post.id}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onClick={() => setBoardSelectedPost(post)}
                            className={`break-inside-avoid rounded-3xl border-2 p-5 space-y-3 transition-all cursor-pointer hover:scale-[1.02] hover:shadow-md ${
                              isMe
                                ? isObs
                                  ? 'bg-violet-50 border-violet-200 hover:border-violet-300'
                                  : 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
                                : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm'
                            }`}
                          >
                            {/* 카드 헤더 */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black shrink-0 ${
                                  isObs ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {isObs ? '📝' : '📁'}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-black truncate">
                                    {post.student_name}
                                    {isMe && <span className="ml-1 text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">나</span>}
                                  </p>
                                  <p className="text-[10px] text-on-surface-variant font-bold">
                                    {post.week_number ? `${post.week_number}주차 · ` : ''}{new Date(post.created_at).toLocaleDateString('ko-KR')}
                                  </p>
                                </div>
                              </div>
                              <span className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full ${
                                isObs ? 'bg-violet-100 text-violet-600' : 'bg-emerald-100 text-emerald-600'
                              }`}>
                                {isObs ? '관찰기록' : '결과'}
                              </span>
                            </div>

                            {/* 카드 내용 */}
                            <div className="space-y-1.5">
                              <p className="text-sm font-black leading-snug line-clamp-2">
                                {isObs ? post.activity_name : post.title}
                              </p>
                              {isObs && post.content && (
                                <p className="text-xs text-on-surface-variant font-bold leading-relaxed line-clamp-4">
                                  {post.content}
                                </p>
                              )}
                              {isObs && post.feeling && (
                                <p className="text-[11px] text-on-surface-variant/60 font-bold italic line-clamp-2">
                                  💬 {post.feeling}
                                </p>
                              )}
                              {!isObs && post.text_content && (
                                <p className="text-xs text-on-surface-variant font-bold leading-relaxed line-clamp-4">
                                  {post.text_content}
                                </p>
                              )}
                              {!isObs && post.image_url && (
                                <img
                                  src={post.image_url}
                                  alt="결과 이미지"
                                  className="w-full rounded-xl object-cover max-h-40"
                                  loading="lazy"
                                  onError={e => {
                                    if (post.image_original_url) (e.target as HTMLImageElement).src = post.image_original_url;
                                  }}
                                />
                              )}
                              {!isObs && post.link_url && (
                                <a
                                  href={post.link_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs font-black text-blue-600 hover:underline"
                                >
                                  <ExternalLink size={11} />
                                  <span className="truncate">{post.link_url}</span>
                                </a>
                              )}
                              {!isObs && post.file_url && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                                  <File size={13} className="text-amber-500 shrink-0" />
                                  <span className="text-xs font-black text-amber-700 truncate flex-1">{post.display_name || '파일'}</span>
                                  <Download size={11} className="text-amber-400 shrink-0" />
                                </div>
                              )}
                            </div>

                            {/* 좋아요 버튼 */}
                            <div className="pt-1 border-t border-slate-100">
                              <button
                                onClick={(e) => { e.stopPropagation(); setBoardLikes(prev => ({ ...prev, [post.id]: !prev[post.id] })); }}
                                className={`flex items-center gap-1.5 text-xs font-black transition-all px-2 py-1 rounded-lg ${
                                  liked
                                    ? 'text-rose-500 bg-rose-50'
                                    : 'text-slate-400 hover:text-rose-400 hover:bg-rose-50'
                                }`}
                              >
                                <Heart size={13} className={liked ? 'fill-rose-500' : ''} />
                                공감
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  );
                })()}
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

      {/* ── 하단 바텀 탭 바 ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700/60 shadow-[0_-8px_40px_rgba(0,0,0,0.35)]">
        <div className="max-w-lg mx-auto flex items-center px-1 pb-safe">
          {[
            { key: 'home' as const,    icon: LayoutDashboard, label: '홈',   activeColor: 'text-sky-400',     activeBg: 'bg-sky-400/15' },
            { key: 'record' as const,  icon: MessageSquare,   label: '기록', activeColor: 'text-violet-400',  activeBg: 'bg-violet-400/15' },
            { key: 'results' as const, icon: FolderOpen,      label: '결과', activeColor: 'text-emerald-400', activeBg: 'bg-emerald-400/15' },
            { key: 'board' as const,   icon: Users2,          label: '보드', activeColor: 'text-indigo-400',  activeBg: 'bg-indigo-400/15' },
          ].map((tab) => {
            const isActive = activeTab === tab.key && !isMoreSheetOpen;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className="flex-1 flex flex-col items-center gap-1.5 py-3.5 transition-all"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isActive ? `${tab.activeBg} scale-105` : 'hover:bg-white/5'
                }`}>
                  <tab.icon size={24} className={isActive ? tab.activeColor : 'text-slate-500'} strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
                <span className={`text-[11px] font-black tracking-tight transition-colors ${isActive ? tab.activeColor : 'text-slate-500'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}

          {/* 더보기 버튼 */}
          <button
            onClick={() => setIsMoreSheetOpen(prev => !prev)}
            className="flex-1 flex flex-col items-center gap-1.5 py-3.5 transition-all"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all relative ${
              isMoreSheetOpen ? 'bg-white/15 scale-105' : 'hover:bg-white/5'
            }`}>
              <MoreHorizontal size={24} className={isMoreSheetOpen ? 'text-white' : 'text-slate-500'} strokeWidth={isMoreSheetOpen ? 2.5 : 1.8} />
              {(unitPendingCount + unreadReplyCount) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[8px] font-black flex items-center justify-center">
                  {unitPendingCount + unreadReplyCount}
                </span>
              )}
            </div>
            <span className={`text-[11px] font-black tracking-tight transition-colors ${isMoreSheetOpen ? 'text-white' : 'text-slate-500'}`}>
              더보기
            </span>
          </button>
        </div>
      </div>

      {/* ── 더보기 슬라이드업 시트 ── */}
      <AnimatePresence>
        {isMoreSheetOpen && (
          <>
            {/* 딤 레이어 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoreSheetOpen(false)}
              className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
            />
            {/* 시트 */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="fixed bottom-[68px] left-0 right-0 z-40 bg-white rounded-t-[2rem] shadow-2xl border-t border-slate-200 overflow-hidden"
            >
              {/* 핸들 */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-slate-300 rounded-full" />
              </div>

              <div className="px-4 pt-1 pb-6 grid grid-cols-5 gap-1">
                {[
                  { key: 'materials' as const, icon: BookOpen,    label: '수업 자료', color: 'text-cyan-600',   activeBg: 'bg-cyan-50'   },
                  { key: 'history' as const,   icon: History,     label: '나의 기록', color: 'text-blue-600',   activeBg: 'bg-blue-50'   },
                  { key: 'quiz' as const,      icon: Gamepad2,    label: '퀴즈',      color: 'text-purple-600', activeBg: 'bg-purple-50' },
                  { key: 'unit' as const,      icon: ClipboardList, label: '단원마무리', color: 'text-amber-600', activeBg: 'bg-amber-50', badge: unitPendingCount },
                  { key: 'suggestions' as const, icon: Megaphone, label: '건의사항',  color: 'text-rose-600',   activeBg: 'bg-rose-50',  badge: unreadReplyCount },
                ].map((item) => {
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleTabChange(item.key)}
                      className={`relative flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl transition-all ${
                        isActive ? item.activeBg : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                        isActive ? `${item.activeBg} shadow-sm` : 'bg-slate-100'
                      }`}>
                        <item.icon size={20} className={isActive ? item.color : 'text-slate-500'} />
                      </div>
                      <span className={`text-[10px] font-black text-center leading-tight ${isActive ? item.color : 'text-slate-500'}`}>
                        {item.label}
                      </span>
                      {(item as any).badge > 0 && (
                        <span className="absolute top-2 right-2 w-4 h-4 bg-error text-white rounded-full text-[8px] font-black flex items-center justify-center shadow-sm">
                          {(item as any).badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 가이드 모달 */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full sm:max-w-2xl bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* 헤더 */}
              <div className="px-8 pt-8 pb-6 border-b border-surface-container shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">시작 가이드</p>
                    <h2 className="text-2xl font-black">어떻게 사용하나요?</h2>
                    <p className="text-sm text-on-surface-variant font-bold mt-1">관찰기록과 결과 제출 방법을 확인해 보세요!</p>
                  </div>
                  <button onClick={handleCloseGuide} className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-all shrink-0">
                    <X size={16} />
                  </button>
                </div>

                {/* 탭 */}
                <div className="flex gap-2 mt-5">
                  <button
                    onClick={() => setGuideTab('obs')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${guideTab === 'obs' ? 'bg-violet-600 text-white shadow-md' : 'bg-surface-container text-on-surface-variant hover:bg-violet-50 hover:text-violet-600'}`}
                  >
                    📝 관찰기록
                  </button>
                  <button
                    onClick={() => setGuideTab('result')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${guideTab === 'result' ? 'bg-emerald-600 text-white shadow-md' : 'bg-surface-container text-on-surface-variant hover:bg-emerald-50 hover:text-emerald-600'}`}
                  >
                    📁 결과 제출
                  </button>
                </div>
              </div>

              {/* 본문 */}
              <div className="overflow-y-auto flex-1 px-8 py-6">
                <AnimatePresence mode="wait">
                  {guideTab === 'obs' ? (
                    <motion.div key="obs" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-5">
                      {/* 방법 */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-black text-violet-600 uppercase tracking-widest">📌 입력 방법</h3>
                        <div className="space-y-2">
                          {[
                            { step: '1', text: '상단 탭에서 "관찰 기록" 클릭' },
                            { step: '2', text: '오늘 배운 활동의 주차를 선택 (예: 2주차)' },
                            { step: '3', text: '활동 제목을 입력하거나 주차를 선택하면 자동 입력됩니다' },
                            { step: '4', text: '오늘 수업에서 무엇을 했는지, 느낀 점을 자유롭게 작성' },
                            { step: '5', text: '"제출하기" 버튼을 눌러 저장' },
                          ].map(({ step, text }) => (
                            <div key={step} className="flex items-start gap-3">
                              <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">{step}</span>
                              <p className="text-sm font-bold text-on-surface leading-relaxed">{text}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 예시 */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-black text-violet-600 uppercase tracking-widest">✏️ 작성 예시</h3>
                        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 space-y-3">
                          <div>
                            <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1">활동 제목</p>
                            <p className="text-sm font-black text-violet-900">앱 만들기 실습 1</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-1">활동 내용</p>
                            <p className="text-sm font-bold text-violet-800 leading-relaxed">
                              오늘 수업에서 피그마를 이용해 앱 화면을 처음으로 설계해봤다. 버튼 배치가 생각보다 어려웠지만 선생님이 알려주신 그리드 방법을 따라 하니 훨씬 쉬웠다. 다음 시간에는 색상 팔레트도 직접 만들어보고 싶다.
                            </p>
                          </div>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                          <p className="text-xs font-black text-amber-600 mb-1">💡 잘 쓰는 팁</p>
                          <p className="text-xs font-bold text-amber-700 leading-relaxed">무엇을 했는지 + 어려웠던 점 + 배운 점 순서로 쓰면 선생님께 잘 보여요!</p>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="result" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                      {/* 방법 */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-black text-emerald-600 uppercase tracking-widest">📌 입력 방법</h3>
                        <div className="space-y-2">
                          {[
                            { step: '1', text: '상단 탭에서 "결과 제출" 클릭' },
                            { step: '2', text: '제출할 주차 선택 (예: 2주차)' },
                            { step: '3', text: '결과물 종류 선택: 텍스트 · 링크 · 이미지 · 파일 중 해당하는 것 작성' },
                            { step: '4', text: '제목을 입력하고 내용을 채운 후 "제출하기" 클릭' },
                          ].map(({ step, text }) => (
                            <div key={step} className="flex items-start gap-3">
                              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">{step}</span>
                              <p className="text-sm font-bold text-on-surface leading-relaxed">{text}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 제출 유형 */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-black text-emerald-600 uppercase tracking-widest">📂 제출 유형</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { icon: '📝', label: '텍스트', desc: '글로 작성한 보고서, 소감문' },
                            { icon: '🔗', label: '링크', desc: '구글 슬라이드, 유튜브, 웹사이트 URL' },
                            { icon: '🖼️', label: '이미지', desc: '스크린샷, 사진, 작품 이미지' },
                            { icon: '📎', label: '파일', desc: 'PDF, 한글, 워드 등 파일 첨부' },
                          ].map(({ icon, label, desc }) => (
                            <div key={label} className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-1">
                              <p className="text-base">{icon} <span className="text-sm font-black text-emerald-700">{label}</span></p>
                              <p className="text-[11px] font-bold text-emerald-600/70">{desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 예시 */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-black text-emerald-600 uppercase tracking-widest">✏️ 작성 예시</h3>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
                          <div>
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">제목</p>
                            <p className="text-sm font-black text-emerald-900">2주차 앱 기획서 최종본</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">링크 예시</p>
                            <p className="text-sm font-bold text-blue-600 underline">https://docs.google.com/presentation/d/...</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 하단 */}
              <div className="px-8 py-6 border-t border-surface-container shrink-0 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => setDontShowToday(prev => !prev)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${dontShowToday ? 'bg-primary border-primary' : 'border-neutral-300 group-hover:border-primary/50'}`}
                  >
                    {dontShowToday && <Check size={12} className="text-white" strokeWidth={4} />}
                  </div>
                  <span className="text-sm font-bold text-on-surface-variant group-hover:text-on-surface transition-colors">오늘 하루 보지 않기</span>
                </label>
                <button
                  onClick={handleCloseGuide}
                  className="w-full py-4 rounded-2xl bg-primary text-white font-black text-sm hover:bg-primary/80 active:scale-[0.99] transition-all shadow-lg shadow-primary/20"
                >
                  확인했어요!
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

      {/* 상세 보기 모달 */}
      <AnimatePresence>
        {detailItem && (() => {
          const isObs = detailItem._kind === 'obs' || !detailItem._kind;
          const weeklyPlan: {week: number; topic: string}[] = classResources || [];
          const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

          let weekLabel: string | null = null;
          if (isObs) {
            const matched = weeklyPlan.find(p => norm(p.topic) === norm(detailItem.activity_name || ''));
            if (matched) weekLabel = `${matched.week}주차 · ${matched.topic}`;
          } else if (detailItem.week_number) {
            const topic = weeklyPlan.find(p => p.week === detailItem.week_number)?.topic;
            weekLabel = topic ? `${detailItem.week_number}주차 · ${topic}` : `${detailItem.week_number}주차`;
          }

          const imagePublicUrl = !isObs && (detailItem.result_type === 'image' || detailItem.submission_type === 'image') && detailItem.storage_path
            ? supabase.storage.from('student-attachments').getPublicUrl(detailItem.storage_path).data.publicUrl
            : null;

          return (
            <div
              className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setDetailItem(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 60 }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                onClick={e => e.stopPropagation()}
                className="w-full sm:max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                {/* 헤더 */}
                <div className={`px-8 pt-8 pb-6 shrink-0 ${isObs ? 'bg-violet-50 border-b border-violet-100' : 'bg-emerald-50 border-b border-emerald-100'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isObs ? (
                          <span className="text-[10px] font-black text-violet-600 bg-white border border-violet-200 px-2.5 py-1 rounded-lg">📝 관찰 기록</span>
                        ) : (
                          <span className="text-[10px] font-black text-emerald-600 bg-white border border-emerald-200 px-2.5 py-1 rounded-lg">📁 결과 제출</span>
                        )}
                        {weekLabel && (
                          <span className="text-[10px] font-black text-primary bg-primary/10 px-2.5 py-1 rounded-lg">{weekLabel}</span>
                        )}
                      </div>
                      <p className="font-black text-xl leading-tight">
                        {isObs ? detailItem.activity_name : (detailItem.title || '제목 없음')}
                      </p>
                      <p className="text-xs text-on-surface-variant font-bold flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(detailItem.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={() => setDetailItem(null)}
                      className="w-9 h-9 rounded-xl bg-white/80 hover:bg-white flex items-center justify-center text-on-surface-variant shrink-0 transition-all border border-black/5"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* 본문 */}
                <div className="px-8 py-6 overflow-y-auto flex-1 space-y-5">
                  {isObs ? (
                    <>
                      {detailItem.category && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest">카테고리</p>
                          <p className="text-sm font-bold">{detailItem.category}</p>
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">활동 내용</p>
                        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{detailItem.content || '내용 없음'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">상태</p>
                        {detailItem.status === 'pending' ? (
                          <span className="flex items-center gap-1 text-xs font-black text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                            <Clock size={11} /> 승인 대기중
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-black text-secondary bg-secondary/10 border border-secondary/20 px-2.5 py-1 rounded-lg">
                            <CheckCircle2 size={11} /> 승인됨
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {(detailItem.result_type === 'text' || detailItem.submission_type === 'text') && detailItem.text_content && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">텍스트 내용</p>
                          <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap bg-surface-container rounded-2xl px-5 py-4">{detailItem.text_content}</p>
                        </div>
                      )}
                      {(detailItem.result_type === 'link' || detailItem.submission_type === 'link') && detailItem.link_url && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">링크</p>
                          <a
                            href={detailItem.link_url.startsWith('http') ? detailItem.link_url : `https://${detailItem.link_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 border border-blue-200 px-5 py-4 rounded-2xl hover:bg-blue-100 transition-all break-all"
                          >
                            <ExternalLink size={14} className="shrink-0" />
                            {detailItem.link_url}
                          </a>
                        </div>
                      )}
                      {(detailItem.result_type === 'image' || detailItem.submission_type === 'image') && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">이미지</p>
                          {imagePublicUrl ? (
                            <img
                              src={imagePublicUrl}
                              alt={detailItem.display_name || '제출 이미지'}
                              className="w-full rounded-2xl object-contain max-h-[50vh] border border-surface-container bg-surface-container"
                            />
                          ) : (
                            <p className="text-sm text-on-surface-variant">{detailItem.display_name}</p>
                          )}
                        </div>
                      )}
                      {(detailItem.result_type === 'file' || detailItem.submission_type === 'file') && detailItem.display_name && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">파일</p>
                          <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 px-5 py-4 rounded-2xl">
                            <div className="flex items-center gap-3 min-w-0">
                              <File size={18} className="text-amber-600 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-black truncate">{detailItem.display_name}</p>
                                {detailItem.file_size && <p className="text-xs text-on-surface-variant font-bold">{(detailItem.file_size / 1024).toFixed(1)} KB</p>}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDownloadResult(detailItem)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-black hover:bg-amber-600 transition-all shrink-0"
                            >
                              <ExternalLink size={12} /> 다운로드
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* 하단 액션 */}
                <div className="px-8 pb-8 pt-4 border-t border-surface-container shrink-0 flex gap-3">
                  <button
                    onClick={() => setDetailItem(null)}
                    className="flex-1 py-3.5 rounded-2xl bg-surface-container text-on-surface-variant font-black text-sm hover:bg-surface-container-high transition-all"
                  >
                    닫기
                  </button>
                  {isObs ? (
                    <button
                      onClick={() => { handleStartEditLog(detailItem); setDetailItem(null); }}
                      className="flex items-center justify-center gap-2 flex-1 py-3.5 rounded-2xl bg-primary text-white font-black text-sm hover:bg-primary/80 transition-all"
                    >
                      <Pencil size={14} /> 수정하기
                    </button>
                  ) : (
                    <button
                      onClick={() => { handleEditResult(detailItem); handleTabChange('results'); setDetailItem(null); }}
                      className="flex items-center justify-center gap-2 flex-1 py-3.5 rounded-2xl bg-primary text-white font-black text-sm hover:bg-primary/80 transition-all"
                    >
                      <Pencil size={14} /> 수정하기
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* 보드 카드 상세 모달 */}
      <AnimatePresence>
        {boardSelectedPost && (() => {
          const p = boardSelectedPost;
          const isObs = p._type === 'obs';
          const isMe = p.student_id === session?.student_id;
          return (
            <>
              <motion.div
                key="board-detail-backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setBoardSelectedPost(null)}
                className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
              />
              <motion.div
                key="board-detail-modal"
                initial={{ opacity: 0, y: 60, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 60, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                className="fixed inset-x-0 bottom-0 z-[200] flex justify-center px-4 pb-safe pointer-events-none"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
              >
                <div
                  onClick={e => e.stopPropagation()}
                  className={`pointer-events-auto w-full max-w-lg max-h-[75vh] overflow-y-auto rounded-3xl border-2 shadow-2xl bg-white ${
                    isMe
                      ? isObs ? 'border-violet-200' : 'border-emerald-200'
                      : 'border-slate-200'
                  }`}
                >
                  {/* 모달 헤더 */}
                  <div className={`sticky top-0 flex items-center justify-between gap-3 px-5 py-4 border-b ${
                    isMe
                      ? isObs ? 'bg-violet-50 border-violet-100' : 'bg-emerald-50 border-emerald-100'
                      : 'bg-slate-50 border-slate-100'
                  }`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base shrink-0 ${
                        isObs ? 'bg-violet-100' : 'bg-emerald-100'
                      }`}>
                        {isObs ? '📝' : '📁'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black truncate text-sm">
                          {p.student_name}
                          {isMe && <span className="ml-1.5 text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">나</span>}
                        </p>
                        <p className="text-[11px] text-on-surface-variant font-bold">
                          {p.week_number ? `${p.week_number}주차 · ` : ''}
                          {new Date(p.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                          &nbsp;·&nbsp;
                          <span className={isObs ? 'text-violet-600' : 'text-emerald-600'}>
                            {isObs ? '관찰기록' : '결과물'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setBoardSelectedPost(null)}
                      className="shrink-0 w-9 h-9 rounded-xl hover:bg-surface-container flex items-center justify-center transition-all"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* 모달 본문 */}
                  <div className="p-5 space-y-4">
                    <h2 className="text-base font-black leading-snug">
                      {isObs ? p.activity_name : p.title}
                    </h2>
                    {isObs && p.content && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">관찰 내용</p>
                        <p className="text-sm text-on-surface-variant font-bold leading-relaxed whitespace-pre-wrap">{p.content}</p>
                      </div>
                    )}
                    {isObs && p.feeling && (
                      <div className="px-4 py-3 rounded-2xl bg-violet-50 border border-violet-100">
                        <p className="text-sm text-on-surface-variant/70 font-bold italic leading-relaxed">💬 {p.feeling}</p>
                      </div>
                    )}
                    {!isObs && p.text_content && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">내용</p>
                        <p className="text-sm text-on-surface-variant font-bold leading-relaxed whitespace-pre-wrap">{p.text_content}</p>
                      </div>
                    )}
                    {!isObs && p.image_url && (
                      <a
                        href={p.image_original_url || p.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block relative group"
                      >
                        <img
                          src={p.image_url}
                          alt=""
                          className="w-full rounded-2xl object-contain max-h-72 cursor-zoom-in"
                          loading="lazy"
                          decoding="async"
                          onError={e => {
                            if (p.image_original_url) (e.target as HTMLImageElement).src = p.image_original_url;
                          }}
                        />
                        <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-black bg-black/50 px-3 py-1.5 rounded-full transition-all">
                            새 탭에서 보기
                          </span>
                        </div>
                      </a>
                    )}
                    {!isObs && p.link_url && (
                      <a href={p.link_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 font-black text-sm hover:bg-blue-100 transition-all">
                        <ExternalLink size={14} /><span className="truncate">{p.link_url}</span>
                      </a>
                    )}
                    {!isObs && p.file_url && (
                      <button
                        onClick={() => openFile(p.file_url, p.display_name || '첨부파일')}
                        className="w-full flex items-center gap-3 px-4 py-3.5 bg-amber-50 border border-amber-100 rounded-2xl hover:bg-amber-100 transition-all group text-left"
                      >
                        <File size={15} className="text-amber-500 shrink-0" />
                        <span className="text-sm font-black text-amber-700 truncate flex-1">{p.display_name || '첨부 파일'}</span>
                        <Download size={14} className="text-amber-400 shrink-0 group-hover:text-amber-600 transition-colors" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* ── 반려 알림 바텀시트 ── */}
      <AnimatePresence>
        {rejectionNotification && (
          <div className="fixed inset-0 z-[1600] flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setRejectionNotification(null)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative w-full max-w-lg bg-white rounded-t-3xl px-6 pt-5 pb-8 shadow-2xl border-t-4 border-red-400"
            >
              <div className="w-10 h-1.5 bg-neutral-200 rounded-full mx-auto mb-5" />
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-2xl shrink-0">🚨</div>
                <div className="flex-1">
                  <p className="font-black text-on-surface text-base leading-snug">
                    {rejectionNotification.type === 'obs'
                      ? `"${rejectionNotification.title}" 관찰기록이 반려되었습니다`
                      : `"${rejectionNotification.title}" 결과물이 반려되었습니다`}
                  </p>
                  {rejectionNotification.feedback && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                      <p className="text-[10px] font-black text-red-500 mb-1">선생님 피드백</p>
                      <p className="text-sm font-bold text-red-700 leading-relaxed">{rejectionNotification.feedback}</p>
                    </div>
                  )}
                  <p className="text-xs text-on-surface-variant/60 font-bold mt-2">수정 후 재제출할 수 있습니다.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const type = rejectionNotification.type;
                    setRejectionNotification(null);
                    handleTabChange(type === 'obs' ? 'record' : 'results');
                  }}
                  className="flex-1 py-4 btn-gradient rounded-2xl font-black text-sm"
                >
                  지금 수정하러 가기 →
                </button>
                <button
                  onClick={() => setRejectionNotification(null)}
                  className="px-5 py-4 bg-neutral-100 hover:bg-neutral-200 rounded-2xl font-black text-sm text-neutral-500 transition-all"
                >
                  확인
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 제출 리마인더 바텀시트 ── */}
      <AnimatePresence>
        {reminderModal && (
          <div className="fixed inset-0 z-[1500] flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setReminderModal(null)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative w-full max-w-lg bg-white rounded-t-3xl px-6 pt-5 pb-8 shadow-2xl"
            >
              {/* 드래그 핸들 */}
              <div className="w-10 h-1.5 bg-neutral-200 rounded-full mx-auto mb-5" />

              <div className="flex items-start gap-4 mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                  reminderModal.type === 'need_result' ? 'bg-emerald-100' : 'bg-violet-100'
                }`}>
                  {reminderModal.type === 'need_result' ? '📁' : '📝'}
                </div>
                <div className="flex-1">
                  <p className="font-black text-on-surface text-base leading-snug">
                    {reminderModal.type === 'need_result'
                      ? `${reminderModal.week}주차 결과물도 제출해주세요!`
                      : `${reminderModal.week}주차 관찰기록도 작성해주세요!`}
                  </p>
                  <p className="text-sm text-on-surface-variant/70 mt-1.5 leading-relaxed">
                    {reminderModal.type === 'need_result'
                      ? `"${reminderModal.topic}" 관찰기록은 제출됐어요.\n이번 주차 결과물도 함께 제출해야 완성돼요.`
                      : `"${reminderModal.topic}" 결과물은 제출됐어요.\n관찰기록도 빠짐없이 작성해주세요.`}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const type = reminderModal.type;
                    const week = reminderModal.week;
                    setReminderModal(null);
                    if (type === 'need_result') {
                      setSelectedWeek(week);
                      setActiveTab('results');
                    } else {
                      setActiveTab('record');
                    }
                  }}
                  className="flex-1 py-4 btn-gradient rounded-2xl font-black text-sm"
                >
                  지금 {reminderModal.type === 'need_result' ? '결과물' : '관찰기록'} 작성하기 →
                </button>
                <button
                  onClick={() => setReminderModal(null)}
                  className="px-5 py-4 bg-neutral-100 hover:bg-neutral-200 rounded-2xl font-black text-sm text-neutral-500 transition-all"
                >
                  나중에
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

