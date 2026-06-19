import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { supabase } from '../lib/supabase';
import { openFile } from '../lib/fileUtils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  X,
  LayoutDashboard,
  Sparkles,
  Archive,
  RefreshCcw,
  AlertCircle,
  GraduationCap,
  ChevronDown,
  Users,
  BookOpen,
  Link2,
  Plus,
  ClipboardList,
  Users2,
  Layers,
  Maximize2,
  StickyNote,
  RefreshCw,
  ExternalLink,
  File,
  Loader2,
  Download,
  Headphones,
  Search,
  ArrowLeft,
  Eye,
  Upload,
  FileText,
  CheckCircle2,
  Lock,
  Unlock,
  CalendarDays,
  School,
} from 'lucide-react';
import { useAuth, getClassLimit, getStudentLimit } from '../lib/auth';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';

import CodeBlock from '../components/CodeBlock';

// Modular Components
import ClassSelector from '../components/classroom/ClassSelector';
import BriefingModal from '../components/classroom/BriefingModal';
import SubjectDashboard from '../components/classroom/SubjectDashboard';
import AIInsightBanner from '../components/classroom/AIInsightBanner';
import AIReportModal from '../components/classroom/AIReportModal';
import AIChatModal from '../components/classroom/AIChatModal';
import StudentDetailDrawer from '../components/classroom/StudentDetailDrawer';
import UnitManager from '../components/classroom/UnitManager';
import AttendanceTab from '../components/classroom/AttendanceTab';
import GroupTab from '../components/classroom/GroupTab';
import GlobalStudentSearch from '../components/classroom/GlobalStudentSearch';
import UpgradeModal from '../components/UpgradeModal';
import SchoolProjectHub from '../components/classroom/SchoolProjectHub';
import SchoolProjectModal from '../components/classroom/SchoolProjectModal';


const Classroom = () => {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  // student_id → { name, color }
  const [groupMap, setGroupMap] = useState<Record<string, { name: string; color: string }>>({});
  const [activeClassId, setActiveClassId] = useState<string | null>(
    searchParams.get('id') || localStorage.getItem('teacher_last_class_id')
  );
  const [classInfo, setClassInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [shareTeacherSuccess, setShareTeacherSuccess] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [upgradeModalReason, setUpgradeModalReason] = useState<'class_limit' | 'ai_limit' | 'ai_bulk' | 'teacher_invite' | 'naiss_export' | 'school_block' | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [newClassData, setNewClassData] = useState({
    name: '',
    subject: '',
    class_type: 'subject',
    student_guide_prompt: '',
    teacher_report_prompt: '',
    weekly_plan: [{ week: 1, topic: '', url: '', requires_result: true, requires_activity: true }],
    min_obs_chars: 0,
    blocked_keywords: [] as string[],
    ai_review_enabled: true,
  });
  const [updateClassData, setUpdateClassData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [activeTab, setActiveTab] = useState<'list' | 'ai' | 'units' | 'attendance' | 'board' | 'groups'>(
    (searchParams.get('tab') as 'list' | 'ai' | 'units' | 'attendance' | 'board' | 'groups') || 'list'
  );
  // 보드 탭 state
  const [boardPosts, setBoardPosts] = useState<any[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardTypeFilter, setBoardTypeFilter] = useState<'all' | 'obs' | 'result'>('all');
  const [boardWeekFilter, setBoardWeekFilter] = useState<number | 'all'>('all');
  const [boardSelectedPost, setBoardSelectedPost] = useState<any | null>(null);
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [editModalTab, setEditModalTab] = useState<'basic' | 'ai' | 'syllabus'>('basic');
  
  // 아카이브 관련 상태
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archivedClasses, setArchivedClasses] = useState<any[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // 학교 프로젝트 모달
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);

  // 학교 그룹 관련 상태
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [schools, setSchools] = useState<any[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [schoolCreating, setSchoolCreating] = useState(false);
  const [schoolCopiedId, setSchoolCopiedId] = useState<string | null>(null);
  const [assigningClassId, setAssigningClassId] = useState<string | null>(null);
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [editingSchoolName, setEditingSchoolName] = useState('');
  const [schoolUpdating, setSchoolUpdating] = useState(false);
  const [deletingSchoolId, setDeletingSchoolId] = useState<string | null>(null);
  
  
  // 정렬 상태
  type SortKey = 'name' | 'number' | 'created_at' | 'activity_time';
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({ key: 'number', direction: 'asc' });

  // 실시간 모니터링 상태
  const [realtimeToasts, setRealtimeToasts] = useState<{id: string; msg: string}[]>([]);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  
  // QR 코드 모달 상태
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  // AI 인사이트 모달 상태
  const [isAIReportOpen, setIsAIReportOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  // 학생 명단 관리 모달 상태
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [newStudentData, setNewStudentData] = useState({ name: '', number: '' });
  const [bulkNames, setBulkNames] = useState('');
  const [registerMode, setRegisterMode] = useState<'bulk' | 'single'>('bulk');

  // 수업 자료 관리 상태
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [classMaterials, setClassMaterials] = useState<any[]>([]);
  // 서브클래스의 부모 weekly_plan (수업 자료실 모달에서 사용)
  const [parentWeeklyPlan, setParentWeeklyPlan] = useState<any[]>([]);
  const [fullscreenMaterial, setFullscreenMaterial] = useState<{ title: string; content: string } | null>(null);
  // 학급정보 수정 팝업에서 에디터 자료 선택용
  const [editingClassMaterials, setEditingClassMaterials] = useState<any[]>([]);
  const [materialDropdownIdx, setMaterialDropdownIdx] = useState<number | null>(null);
  // 일반 자료 관리 상태
  const [generalMaterials, setGeneralMaterials] = useState<any[]>([]);
  const [showAddGeneralForm, setShowAddGeneralForm] = useState(false);
  const [generalMatForm, setGeneralMatForm] = useState<{ title: string; type: 'link' | 'file'; url: string; file: File | null }>({ title: '', type: 'link', url: '', file: null });
  const [generalMatUploading, setGeneralMatUploading] = useState(false);
  const [deletingGeneralMatId, setDeletingGeneralMatId] = useState<string | null>(null);

  // 학생 선택 및 드로어 상태
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [detailedStudentId, setDetailedStudentId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 전체화면 뷰어 — body/html 스크롤 잠금
  useEffect(() => {
    if (fullscreenMaterial) {
      const prev = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      return () => {
        document.documentElement.style.overflow = prev;
        document.body.style.overflow = '';
      };
    }
  }, [fullscreenMaterial]);

  // 토스트 알림 헬퍼
  const showToast = (msg: string) => {
    const id = Date.now().toString();
    setRealtimeToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => setRealtimeToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  useEffect(() => {
    if (user) {
      fetchClasses();
      setSelectedStudentIds([]);
    }
  }, [user]);

  // Cmd+K / Ctrl+K 전체 검색 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // activeClassId가 바뀔 때마다 URL + localStorage에 동기화 → 페이지 재진입 시 선택 클래스 복원
  useEffect(() => {
    if (activeClassId) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('id', activeClassId);
        return next;
      }, { replace: true });
      localStorage.setItem('teacher_last_class_id', activeClassId);
    }
  }, [activeClassId]);

  // activeTab이 바뀔 때마다 URL tab= 파라미터 동기화 → 페이지 재진입 시 탭 복원
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (activeTab === 'list') {
        next.delete('tab');
      } else {
        next.set('tab', activeTab);
      }
      return next;
    }, { replace: true });
  }, [activeTab]);

  // 알림 바로가기: 이미 해당 클래스룸에 있는 경우 → 커스텀 이벤트로 직접 drawer 오픈
  useEffect(() => {
    const openFromStorage = () => {
      const raw = sessionStorage.getItem('notif_open_student');
      if (!raw) return;
      try {
        const { studentId } = JSON.parse(raw);
        sessionStorage.removeItem('notif_open_student');
        if (!studentId) return;
        setDetailedStudentId(studentId);
        setIsDrawerOpen(true);
      } catch (_e) {
        sessionStorage.removeItem('notif_open_student');
      }
    };

    window.addEventListener('notif_open_student', openFromStorage);
    return () => window.removeEventListener('notif_open_student', openFromStorage);
  }, []);

  // 알림 바로가기: 다른 페이지/클래스에서 navigate로 진입한 경우 → location.key 변화로 처리
  useEffect(() => {
    const raw = sessionStorage.getItem('notif_open_student');
    if (!raw) return;

    try {
      const { studentId, classId } = JSON.parse(raw);
      sessionStorage.removeItem('notif_open_student');

      if (!studentId) return;

      if (classId && classId !== activeClassId) {
        setActiveClassId(classId);
      }
      setDetailedStudentId(studentId);
      setIsDrawerOpen(true);
    } catch (_e) {
      sessionStorage.removeItem('notif_open_student');
    }
  }, [location.key]);

  // 알림에서 student_id URL 파라미터로 진입한 경우 (하위 호환)
  useEffect(() => {
    const studentId = searchParams.get('student_id');
    if (!studentId) return;

    const urlClassId = searchParams.get('id');
    if (urlClassId && urlClassId !== activeClassId) {
      setActiveClassId(urlClassId);
    }

    setDetailedStudentId(studentId);
    setIsDrawerOpen(true);

    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('student_id');
      return next;
    }, { replace: true });
  }, [searchParams.get('student_id')]);

  useEffect(() => {
    const importId = searchParams.get('importId');
    const importName = searchParams.get('name');
    if (importId && importName) {
      setNewClassData(prev => ({
        ...prev,
        name: importName,
        class_type: 'subject',
      }));
      setIsCreateModalOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  // 서브클래스의 부모 weekly_plan 로드 (수업 자료실 모달용)
  const loadParentWeeklyPlan = async (parentClassId: string) => {
    try {
      const { data } = await supabase.from('classes').select('weekly_plan').eq('id', parentClassId).single();
      setParentWeeklyPlan(data?.weekly_plan || []);
    } catch (_e) {
      setParentWeeklyPlan([]);
    }
  };

  useEffect(() => {
    const handleClassActivation = async () => {
      if (!activeClassId) return;

      const currentLocalClass = classes.find(c => c.id === activeClassId);
      if (currentLocalClass) {
        setClassInfo(currentLocalClass);
        if (currentLocalClass.parent_class_id) {
          loadParentWeeklyPlan(currentLocalClass.parent_class_id);
        } else {
          setParentWeeklyPlan([]);
        }
        fetchStudents(activeClassId);
        loadGroupMap(activeClassId);
      } else {
        // 내 학급 목록에 없는 경우 직접 fetch
        try {
          const { data, error } = await supabase
            .from('classes')
            .select('*')
            .eq('id', activeClassId)
            .single();

          if (error) throw error;
          if (data) {
            setClassInfo(data);
            if (data.parent_class_id) {
              loadParentWeeklyPlan(data.parent_class_id);
            } else {
              setParentWeeklyPlan([]);
            }
            fetchStudents(activeClassId);
          }
        } catch (err) {
          console.error('Error fetching external class:', err);
        }
      }
    };

    handleClassActivation();
  }, [activeClassId, classes]);

  // 실시간 모니터링 구독
  useEffect(() => {
    if (!activeClassId) return;

    const channel = supabase
      .channel(`classroom-monitor-${activeClassId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'observations'
      }, async (payload: any) => {
        const { data: studentData } = await supabase
          .from('students')
          .select('full_name, class_id')
          .eq('id', payload.new.student_id)
          .single();

        const studentName = studentData?.full_name || '학생';
        showToast(`📝 ${studentName}이(가) "${payload.new.activity_name}" 활동을 제출했습니다!`);
        fetchStudents(activeClassId);
        setStatsRefreshKey(k => k + 1);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'student_results'
      }, async (payload: any) => {
        const { data: studentData } = await supabase
          .from('students')
          .select('full_name')
          .eq('id', payload.new.student_id)
          .single();

        const studentName = studentData?.full_name || '학생';
        const title = payload.new.title || `${payload.new.week_number}주차 결과물`;
        showToast(`📎 ${studentName}이(가) "${title}"을(를) 제출했습니다!`);
        setStatsRefreshKey(k => k + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeClassId]);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      // 직접 만든 클래스 + 학교 프로젝트에서 담당으로 지정된 하위 반 클래스 모두 포함
      const { data: ownData, error } = await supabase
        .from('classes').select('*').eq('teacher_id', user?.id).eq('is_archived', false).order('created_at', { ascending: false });

      if (error) throw error;

      // assigned_teacher_id 컬럼이 아직 없을 수 있으므로 별도로 시도하고 실패 시 무시
      let assignedData: any[] = [];
      try {
        const { data: ad } = await supabase
          .from('classes').select('*').eq('assigned_teacher_id', user?.id).eq('is_archived', false).order('created_at', { ascending: false });
        assignedData = ad || [];
      } catch (_e) { /* 컬럼 미존재 시 무시 */ }

      const seen = new Set<string>();
      const combined = [...(ownData || []), ...assignedData].filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      const classData = combined;
      setClasses(classData);
      
      if (classData.length > 0) {
        if (!activeClassId) {
          // URL 파라미터도 없고 현재 선택된 것도 없으면 첫 번째 학급 선택
          setActiveClassId(classData[0].id);
        } else {
          // 이미 activeClassId가 있다면(URL에서 왔거나 기존 선택) 데이터만 갱신
          const active = classData.find(c => c.id === activeClassId);
          if (active) {
            setClassInfo(active);
          } else {
            // 만약 URL로 넘어온 ID가 유효하지 않으면 첫 번째로 폴백
            setActiveClassId(classData[0].id);
          }
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      setLoading(false);
    }
  };


  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const isSubjectRequired = newClassData.class_type === 'subject';
    if (!newClassData.name || (isSubjectRequired && !newClassData.subject) || !user) return;

    // School 플랜 클래스 생성 차단
    if (profile?.plan === 'school') {
      setIsCreateModalOpen(false);
      setUpgradeModalReason('school_block');
      return;
    }

    // 플랜별 클래스 수 제한 (admin만 무제한)
    if (profile?.plan !== 'admin') {
      const classLimit = getClassLimit(profile);
      const { count } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', user.id);
      if ((count ?? 0) >= classLimit) {
        setIsCreateModalOpen(false);
        setUpgradeModalReason('class_limit');
        return;
      }
    }

    const entryCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
      const { data, error } = await supabase
        .from('classes')
        .insert({
          teacher_id: user.id,
          name: newClassData.name,
          subject: newClassData.class_type === 'homeroom' ? '담임' : newClassData.subject,
          class_type: newClassData.class_type,
          student_guide_prompt: newClassData.student_guide_prompt || '수업 시간에 배운 내용과 본인의 활동 역할을 구체적으로 작성하세요. 단답형이나 단순 감상평은 지양해 주세요.',
          teacher_report_prompt: newClassData.teacher_report_prompt || '교육부 기재 요령을 준수하여 사실 기반의 객관적인 문체(~함, ~임)로 작성해줘. 학생의 개별적인 성취가 잘 드러나야 해.',
          min_obs_chars: newClassData.min_obs_chars || 0,
          blocked_keywords: newClassData.blocked_keywords || [],
          ai_review_enabled: newClassData.ai_review_enabled ?? true,
          weekly_plan: newClassData.weekly_plan.filter((item: any) => item.topic.trim()),
          entry_code: entryCode
        })
        .select()
        .single();

      if (error) throw error;

      setIsCreateModalOpen(false);
      setNewClassData({
        name: '',
        subject: '',
        class_type: 'subject',
        student_guide_prompt: '',
        teacher_report_prompt: '',
        weekly_plan: [{ week: 1, topic: '', url: '', requires_result: true, requires_activity: true }],
        min_obs_chars: 0,
        blocked_keywords: [],
        ai_review_enabled: true,
      });
      await fetchClasses();
      if (data) setActiveClassId(data.id);
      showToast("학급이 성공적으로 생성되었습니다. ✨");
    } catch (error) {
      console.error('Error creating class:', error);
      showToast("학급 생성 중 오류가 발생했습니다.");
    }
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const isSubjectRequired = updateClassData?.class_type === 'subject';
    if (!updateClassData?.name || (isSubjectRequired && !updateClassData?.subject) || !user) return;

    // 하위 클래스에 공통 적용할 설정값
    const sharedSettings = {
      student_guide_prompt: updateClassData.student_guide_prompt,
      teacher_report_prompt: updateClassData.teacher_report_prompt,
      min_obs_chars: updateClassData.min_obs_chars || 0,
      blocked_keywords: updateClassData.blocked_keywords || [],
      ai_review_enabled: updateClassData.ai_review_enabled ?? true,
      start_date: updateClassData.start_date || null,
      end_date: updateClassData.end_date || null,
      is_closed: updateClassData.is_closed ?? false,
    };

    try {
      const { error } = await supabase
        .from('classes')
        .update({
          name: updateClassData.name,
          subject: updateClassData.subject,
          weekly_plan: updateClassData.weekly_plan || [],
          ...sharedSettings,
        })
        .eq('id', updateClassData.id);

      if (error) throw error;

      // 학교 프로젝트 부모 클래스이면 하위 클래스 전체에 공통 설정 cascade
      if (updateClassData.school_project_id && !updateClassData.parent_class_id) {
        await supabase.from('classes').update(sharedSettings).eq('parent_class_id', updateClassData.id);
      }

      setIsUpdateModalOpen(false);
      setUpdateClassData(null);
      setEditingClassMaterials([]);
      setMaterialDropdownIdx(null);
      await fetchClasses();
      showToast("학급 정보가 성공적으로 수정되었습니다. 💾");
    } catch (error) {
      console.error('Error updating class:', error);
      showToast("학급 수정 중 오류가 발생했습니다.");
    }
  };

  const handleToggleClassClosed = async (classId: string, currentIsClosed: boolean) => {
    const newState = !currentIsClosed;
    const msg = newState
      ? '수업을 종료하면 학생들은 활동기록 작성과 결과 제출을 할 수 없습니다. 수업을 종료하시겠습니까?'
      : '수업을 다시 진행 중으로 변경하시겠습니까?';
    if (!confirm(msg)) return;
    try {
      const { error } = await supabase.from('classes').update({ is_closed: newState }).eq('id', classId);
      if (error) throw error;
      await fetchClasses();
      showToast(newState ? '수업이 종료되었습니다.' : '수업이 재개되었습니다.');
    } catch (_e) {
      showToast('상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm('정말 이 학급을 삭제하시겠습니까? 삭제된 학급은 아카이브함으로 이동하며, 언제든지 복원할 수 있습니다.')) return;
    
    try {
      const { error } = await supabase
        .from('classes')
        .update({ is_archived: true })
        .eq('id', id);

      if (error) throw error;
      
      showToast("학급이 아카이브함으로 이동되었습니다. 📦");
      
      // 만약 삭제한 학급이 현재 활성화된 학급이면 다른 학급으로 전환
      if (id === activeClassId) {
        const remainingClasses = classes.filter(c => c.id !== id);
        if (remainingClasses.length > 0) {
          setActiveClassId(remainingClasses[0].id);
        } else {
          setActiveClassId(null);
          setClassInfo(null);
          setStudents([]);
        }
      }
      
      await fetchClasses();
    } catch (error) {
      console.error('Error deleting class:', error);
      showToast("학급 삭제 중 오류가 발생했습니다.");
    }
  };

  const fetchArchivedClasses = async () => {
    try {
      setArchiveLoading(true);
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user?.id)
        .eq('is_archived', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArchivedClasses(data || []);
    } catch (error) {
      console.error('Error fetching archived classes:', error);
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleRestoreClass = async (id: string) => {
    try {
      const { error } = await supabase
        .from('classes')
        .update({ is_archived: false })
        .eq('id', id);

      if (error) throw error;
      
      showToast("학급이 복원되었습니다. ✨");
      await fetchArchivedClasses();
      await fetchClasses();
    } catch (error) {
      console.error('Error restoring class:', error);
      showToast("학급 복원 중 오류가 발생했습니다.");
    }
  };

  const handlePermanentDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 학급을 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며 모든 관련 데이터(학생, 기록 등)가 사라질 수 있습니다.`)) return;
    
    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      showToast("학급이 영구적으로 삭제되었습니다.");
      await fetchArchivedClasses();
    } catch (error) {
      console.error('Error permanent deleting class:', error);
      showToast("영구 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleExportCSV = () => {
    if (students.length === 0) return;
    const headers = ['이름', '번호', '태그', '최근 활동', '기록 시간'];
    const rows = students.map(s => [s.name, s.number, s.tag, s.activity, s.time]);
    const csvContent = ['\uFEFF' + headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${classInfo?.name || '학급'}_명단.csv`;
    link.click();
  };

  const loadGroupMap = async (classId: string) => {
    const { data: groups } = await supabase
      .from('class_groups')
      .select('id, name, color')
      .eq('class_id', classId);
    if (!groups || groups.length === 0) { setGroupMap({}); return; }

    const { data: members } = await supabase
      .from('class_group_members')
      .select('group_id, student_id')
      .in('group_id', groups.map((g: any) => g.id));

    const map: Record<string, { name: string; color: string }> = {};
    (members || []).forEach((m: any) => {
      const g = groups.find((g: any) => g.id === m.group_id);
      if (g) map[m.student_id] = { name: g.name, color: g.color };
    });
    setGroupMap(map);
  };

  const fetchStudents = async (classId: string) => {
    if (!classInfo) setLoading(true);

    const targetClassId = classId;

    try {
      // 1. 학생 명단 조회
      let query = supabase
        .from('students')
        .select(`
          id,
          full_name,
          student_number,
          tag,
          avatar_url,
          created_at,
          memo,
          pin,
          observations(id, student_id, content, activity_name, created_at, teacher_id, status),
          reports(is_published)
        `)
        .eq('class_id', targetClassId);

      const { data, error } = await query.order('full_name');

      if (error) throw error;

      if (data) {
        const formattedStudents = data.map(s => {
          const latestObs = s.observations && s.observations.length > 0 
            ? [...s.observations].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
            : null;
          
          const report = s.reports && s.reports.length > 0 ? s.reports[0] : null;

          return {
            id: s.id,
            name: s.full_name,
            number: s.student_number || '-',
            tag: s.tag === '일반' ? '학생' : (s.tag || '학생'),
            memo: s.memo || '',
            pin: s.pin || null,
            avatar: s.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=random`,
            activity: latestObs ? latestObs.activity_name : '기록 없음',
            time: latestObs ? new Date(latestObs.created_at).toLocaleDateString('ko-KR') : '-',
            status: report ? (report.is_published ? '발행됨' : '초안 완료') : (s.observations && s.observations.length > 0 ? '기록 제출됨' : '미작성'),
            created_at: new Date(s.created_at).getTime(),
            activity_time: latestObs ? new Date(latestObs.created_at).getTime() : 0,
            all_observations: s.observations || [],
            // teacher_id 필터: 다른 선생님(예: 담임)의 pending 기록이 과목선생님 승인 대기 카운트에 포함되지 않도록
            pending_obs_ids: (s.observations || []).filter((o: any) => o.status === 'pending' && o.teacher_id === user?.id).map((o: any) => o.id),
            has_rejected: (s.observations || []).some((o: any) => o.status === 'rejected')
          };
        });
        setStudents(formattedStudents);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleCopyLink = () => {
    if (classInfo?.entry_code) {
      const url = `${window.location.origin}/classroom-entry?code=${classInfo.entry_code}`;
      navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      showToast('🔗 학생 입장 링크가 복사되었습니다.');
    }
  };

  const handleShareTeacher = () => {
    if (!activeClassId) return;
    const url = `${window.location.origin}/share/${activeClassId}`;
    navigator.clipboard.writeText(url);
    setShareTeacherSuccess(true);
    setTimeout(() => setShareTeacherSuccess(false), 2000);
    showToast('📋 학교 선생님 공유 링크가 복사되었습니다.');
  };

  const fetchSchools = async () => {
    if (!user) return;
    setSchoolsLoading(true);
    try {
      const { data } = await supabase
        .from('schools')
        .select('id, name, entry_code, share_enabled, created_at')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });
      setSchools(data || []);
    } finally {
      setSchoolsLoading(false);
    }
  };

  const handleCreateSchool = async () => {
    if (!newSchoolName.trim() || !user) return;
    setSchoolCreating(true);
    try {
      const entryCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data, error } = await supabase
        .from('schools')
        .insert({ name: newSchoolName.trim(), teacher_id: user.id, entry_code: entryCode })
        .select()
        .single();
      if (error) throw error;
      setNewSchoolName('');
      setSchools(prev => [data, ...prev]);
      showToast(`🏫 "${data.name}" 학교 그룹이 생성되었습니다.`);
    } catch (err: any) {
      showToast('학교 그룹 생성 중 오류가 발생했습니다.');
    } finally {
      setSchoolCreating(false);
    }
  };

  const handleAssignClassToSchool = async (classId: string, schoolId: string | null) => {
    setAssigningClassId(classId);
    try {
      const { error } = await supabase
        .from('classes')
        .update({ school_id: schoolId })
        .eq('id', classId);
      if (error) throw error;
      setClasses(prev => prev.map(c => c.id === classId ? { ...c, school_id: schoolId } : c));
      showToast(schoolId ? '✅ 학급이 학교 그룹에 배정되었습니다.' : '✅ 학교 그룹 배정이 해제되었습니다.');
    } catch (err) {
      showToast('배정 중 오류가 발생했습니다.');
    } finally {
      setAssigningClassId(null);
    }
  };

  const handleCopySchoolLink = (schoolId: string) => {
    const url = `${window.location.origin}/school-share/${schoolId}`;
    navigator.clipboard.writeText(url);
    setSchoolCopiedId(schoolId);
    setTimeout(() => setSchoolCopiedId(null), 2000);
    showToast('🏫 학교 전체 공유 링크가 복사되었습니다.');
  };

  const handleUpdateSchool = async (schoolId: string) => {
    if (!editingSchoolName.trim()) return;
    setSchoolUpdating(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ name: editingSchoolName.trim() })
        .eq('id', schoolId);
      if (error) throw error;
      setSchools(prev => prev.map(s => s.id === schoolId ? { ...s, name: editingSchoolName.trim() } : s));
      setEditingSchoolId(null);
      showToast('✅ 학교 이름이 수정되었습니다.');
    } catch (_e) {
      showToast('수정 중 오류가 발생했습니다.');
    } finally {
      setSchoolUpdating(false);
    }
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    if (!window.confirm(`"${schoolName}" 학교 그룹을 삭제할까요?\n배정된 학급은 그룹에서 해제되지만 삭제되지는 않습니다.`)) return;
    setDeletingSchoolId(schoolId);
    try {
      const { error } = await supabase.from('schools').delete().eq('id', schoolId);
      if (error) throw error;
      setSchools(prev => prev.filter(s => s.id !== schoolId));
      setClasses(prev => prev.map(c => c.school_id === schoolId ? { ...c, school_id: null } : c));
      showToast('🗑️ 학교 그룹이 삭제되었습니다.');
    } catch (_e) {
      showToast('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingSchoolId(null);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClassId || !newStudentData.name) return;

    // 플랜별 학생 수 제한 체크
    const studentLimit = getStudentLimit(profile);
    if (students.length >= studentLimit) {
      alert(`현재 플랜에서는 한 클래스에 최대 ${studentLimit}명까지 등록할 수 있습니다.\n플랜을 업그레이드하면 더 많은 학생을 추가할 수 있습니다.`);
      return;
    }

    try {
      const { error } = await supabase
        .from('students')
        .insert({
          class_id: activeClassId,
          full_name: newStudentData.name,
          student_number: newStudentData.number,
          tag: '학생'
        });

      if (error) throw error;
      setNewStudentData({ name: '', number: '' });
      fetchStudents(activeClassId);
    } catch (err) {
      console.error('Error adding student:', err);
    }
  };

  const handleEditStudent = async (id: string, number: string, name: string) => {
    if (!activeClassId) return;
    try {
      const { error } = await supabase
        .from('students')
        .update({ student_number: number || null, full_name: name })
        .eq('id', id);
      if (error) throw error;
      fetchStudents(activeClassId);
    } catch (err) {
      console.error('Error editing student:', err);
    }
  };

  const handleBulkRegister = async () => {
    if (!activeClassId || !bulkNames.trim()) return;

    const names = bulkNames.split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (names.length === 0) return;

    // 플랜별 학생 수 제한 체크 (일괄 등록 포함)
    const studentLimit = getStudentLimit(profile);
    if (students.length + names.length > studentLimit) {
      const remaining = Math.max(0, studentLimit - students.length);
      alert(`현재 플랜에서는 한 클래스에 최대 ${studentLimit}명까지 등록할 수 있습니다.\n현재 ${students.length}명 등록 중 — ${remaining}명만 추가 가능합니다.\n플랜을 업그레이드하면 더 많은 학생을 추가할 수 있습니다.`);
      return;
    }

    try {
      const newStudents = names.map(rawText => {
        let name = rawText;
        let number = null;
        const match = rawText.match(/(\d+)번?/);
        if (match) {
          number = match[1];
          name = rawText.replace(match[0], '').trim();
          name = name.replace(/^[\s.\-]+|[\s.\-]+$/g, '');
        }

        return {
          class_id: activeClassId,
          full_name: name,
          student_number: number,
          tag: '학생'
        };
      });

      const { error } = await supabase.from('students').insert(newStudents);
      if (error) throw error;

      setBulkNames('');
      setIsStudentModalOpen(false);
      fetchStudents(activeClassId);
    } catch (err) {
      console.error('Error bulk registering students:', err);
    }
  };

  const handleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(studentId => studentId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (isSelect: boolean) => {
    if (isSelect) {
      setSelectedStudentIds(students.map(s => s.id));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const handleBulkApprove = async () => {
    const pendingIds = students.flatMap(s => s.pending_obs_ids || []);
    if (pendingIds.length === 0) {
      showToast('승인 대기 중인 활동 기록이 없습니다.');
      return;
    }
    if (!confirm(`이 반의 승인 대기 기록 ${pendingIds.length}건을 모두 승인하시겠습니까?`)) return;

    try {
      const { error } = await supabase
        .from('observations')
        .update({ status: 'approved' })
        .in('id', pendingIds);

      if (error) throw error;

      setStudents(prev => prev.map(s => ({
        ...s,
        pending_obs_ids: [],
        all_observations: s.all_observations.map((o: any) =>
          s.pending_obs_ids?.includes(o.id) ? { ...o, status: 'approved' } : o
        )
      })));

      showToast(`✅ ${pendingIds.length}건 일괄 승인 완료!`);
    } catch (err) {
      console.error(err);
      showToast('일괄 승인 중 오류가 발생했습니다.');
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedStudentIds.length;
    if (count === 0) return;
    if (!confirm(`선택한 ${count}명의 학생 정보를 모두 삭제하시겠습니까? 기록된 모든 데이터가 영구적으로 사라집니다.`)) return;

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .in('id', selectedStudentIds);
      
      if (error) throw error;
      showToast(`${count}명의 학생이 성공적으로 삭제되었습니다. ✨`);
      setSelectedStudentIds([]);
      fetchStudents(activeClassId!);
    } catch (err) {
      console.error('Error bulk deleting students:', err);
      showToast('일괄 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleResetPin = async (studentId: string) => {
    if (!confirm('이 학생의 PIN을 초기화하시겠습니까? 학생이 다음 접속 시 새 PIN을 설정하게 됩니다.')) return;
    try {
      const { error } = await supabase.from('students').update({ pin: null }).eq('id', studentId);
      if (error) throw error;
      showToast('PIN이 초기화되었습니다. 🔑');
    } catch (err) {
      showToast('PIN 초기화 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`"${studentName}" 학생의 정보를 삭제하시겠습니까? 기록된 모든 데이터가 사라집니다.`)) return;
    try {
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;
      fetchStudents(activeClassId!);
    } catch (err) {
      console.error('Error deleting student:', err);
    }
  };

  const fetchBoard = async (classId: string) => {
    setBoardLoading(true);
    try {
      const norm = (s: string) => s?.replace(/\s+/g, '').toLowerCase() || '';

      // 1. 학생 목록 + 수업 weekly_plan 병렬 조회
      const [{ data: studentList }, { data: classInfoData }] = await Promise.all([
        supabase.from('students').select('id, full_name').eq('class_id', classId),
        supabase.from('classes').select('weekly_plan, parent_class_id').eq('id', classId).single(),
      ]);
      const studentIds = (studentList || []).map((s: any) => s.id);
      const nameMap: Record<string, string> = Object.fromEntries(
        (studentList || []).map((s: any) => [s.id, s.full_name])
      );

      // 하위 클래스인 경우 부모 클래스의 weekly_plan 로드
      let resolvedWeeklyPlan: any[] = classInfoData?.weekly_plan || [];
      if (classInfoData?.parent_class_id && resolvedWeeklyPlan.length === 0) {
        const { data: parentData } = await supabase.from('classes').select('weekly_plan').eq('id', classInfoData.parent_class_id).single();
        if (parentData?.weekly_plan) resolvedWeeklyPlan = parentData.weekly_plan;
      }

      // activity_name → week_number 매핑 (weekly_plan 기반)
      const topicWeekMap: Record<string, number> = {};
      (resolvedWeeklyPlan as any[]).forEach((p: any) => {
        if (p.topic && p.week) topicWeekMap[norm(p.topic)] = Number(p.week);
      });

      if (studentIds.length === 0) { setBoardPosts([]); setBoardLoading(false); return; }

      // 2. 관찰기록 + 결과 병렬 조회 (최신 150건씩 제한)
      const [{ data: obs }, { data: results }] = await Promise.all([
        supabase
          .from('observations')
          .select('id, student_id, activity_name, content, created_at, status')
          .in('student_id', studentIds)
          .eq('is_student_record', true)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(150),
        supabase
          .from('student_results')
          .select('id, student_id, week_number, title, text_content, storage_path, display_name, link_url, result_type, created_at')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false })
          .limit(150),
      ]);

      // 3. student_name 매핑 + 이미지 URL 변환(썸네일) + 관찰기록에 week_number 부여
      const obsPosts = (obs || []).map((o: any) => ({
        ...o,
        week_number: topicWeekMap[norm(o.activity_name)] ?? null,
        student_name: nameMap[o.student_id] || '학생',
        _type: 'obs' as const,
      }));
      const resPosts = (results || []).map((r: any) => {
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
        return {
          ...r,
          image_url,
          image_original_url,
          file_url,
          student_name: nameMap[r.student_id] || '학생',
          _type: 'result' as const,
        };
      });

      setBoardPosts([...obsPosts, ...resPosts].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (err) {
      console.error('fetchBoard error:', err);
    } finally {
      setBoardLoading(false);
    }
  };

  const fetchResources = async (classId: string) => {
    try {
      // 서브클래스인 경우 부모 클래스의 자료를 사용
      const sourceId = classInfo?.parent_class_id || classId;
      const [matsRes, generalRes] = await Promise.all([
        supabase.from('class_materials').select('id, title, content, week_number, is_published').eq('class_id', sourceId).order('week_number', { ascending: true }),
        supabase.from('class_general_materials').select('*').eq('class_id', sourceId).order('created_at', { ascending: false }),
      ]);
      setClassMaterials(matsRes.data || []);
      setGeneralMaterials(generalRes.data || []);
    } catch (err) {
      console.error('Error fetching resources:', err);
    }
  };

  const handleAddGeneralMat = async () => {
    if (!activeClassId || !user) return;
    if (!generalMatForm.title.trim()) { showToast('제목을 입력해주세요.'); return; }
    if (generalMatForm.type === 'link' && !generalMatForm.url.trim()) { showToast('링크 URL을 입력해주세요.'); return; }
    if (generalMatForm.type === 'file' && !generalMatForm.file) { showToast('파일을 선택해주세요.'); return; }

    setGeneralMatUploading(true);
    try {
      let filePath: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;

      if (generalMatForm.type === 'file' && generalMatForm.file) {
        const ext = generalMatForm.file.name.split('.').pop() || '';
        const path = `general-materials/${activeClassId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('student-attachments').upload(path, generalMatForm.file);
        if (upErr) throw upErr;
        filePath = path;
        fileName = generalMatForm.file.name;
        fileSize = generalMatForm.file.size;
      }

      const { error } = await supabase.from('class_general_materials').insert({
        class_id: activeClassId,
        teacher_id: user.id,
        title: generalMatForm.title.trim(),
        type: generalMatForm.type,
        url: generalMatForm.type === 'link' ? generalMatForm.url.trim() : null,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
        is_published: true,
      });
      if (error) throw error;

      await fetchResources(activeClassId);
      setGeneralMatForm({ title: '', type: 'link', url: '', file: null });
      setShowAddGeneralForm(false);
      showToast('자료가 등록되었습니다.');
    } catch (err) {
      console.error('handleAddGeneralMat error:', err);
      showToast('등록 중 오류가 발생했습니다.');
    } finally {
      setGeneralMatUploading(false);
    }
  };

  const handleDeleteGeneralMat = async (id: string, filePath?: string | null) => {
    setDeletingGeneralMatId(id);
    try {
      if (filePath) {
        await supabase.storage.from('student-attachments').remove([filePath]);
      }
      await supabase.from('class_general_materials').delete().eq('id', id);
      setGeneralMaterials(prev => prev.filter(m => m.id !== id));
      showToast('자료가 삭제되었습니다.');
    } catch (err) {
      console.error('handleDeleteGeneralMat error:', err);
      showToast('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingGeneralMatId(null);
    }
  };

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedStudents = [...students].filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.number.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];
    if (sortConfig.key === 'number') {
      const numA = parseInt(valA) || 0;
      const numB = parseInt(valB) || 0;
      return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
    }
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <>
    {fullscreenMaterial && createPortal(
      <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 bg-slate-800 shrink-0">
          <button
            onClick={() => setFullscreenMaterial(null)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-800 font-black text-sm hover:bg-slate-100 active:scale-95 transition-all shadow"
          >
            <ArrowLeft size={15} /> 나가기
          </button>
          <div className="flex items-center gap-2 ml-2">
            <Eye size={15} className="text-white/60" />
            <span className="font-black text-sm text-white/80 truncate max-w-xs">{fullscreenMaterial.title}</span>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-10">
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({ children }: any) => <h1 className="text-2xl font-black mb-4 mt-6">{children}</h1>,
                h2: ({ children }: any) => <h2 className="text-xl font-black mb-3 mt-5">{children}</h2>,
                h3: ({ children }: any) => <h3 className="text-lg font-black mb-2 mt-4">{children}</h3>,
                p: ({ children }: any) => <p className="mb-3 text-sm leading-relaxed">{children}</p>,
                ul: ({ children }: any) => <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>,
                ol: ({ children }: any) => <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>,
                li: ({ children }: any) => <li className="text-sm">{children}</li>,
                blockquote: ({ children }: any) => (
                  <blockquote className="border-l-4 border-primary pl-4 italic text-on-surface-variant my-3 bg-surface-container-low py-2 rounded-r-xl text-sm">{children}</blockquote>
                ),
                code: ({ children, className }: any) => {
                  if (!className) return <code className="bg-surface-container px-1.5 py-0.5 rounded text-sm font-mono text-primary">{children}</code>;
                  return <code className={className}>{children}</code>;
                },
                pre: ({ children }: any) => {
                  const child = (Array.isArray(children) ? children[0] : children) as any;
                  const code = String(child?.props?.children ?? '').replace(/\n$/, '');
                  const langMatch = (child?.props?.className ?? '').match(/language-(\w+)/);
                  const lang = langMatch ? langMatch[1] : 'text';
                  return <CodeBlock lang={lang} code={code} />;
                },
                img: ({ src, alt, title }: any) => {
                  const wm = (title || '').match(/^width:(\d+)$/);
                  const style = wm ? { width: `${wm[1]}px`, maxWidth: '100%' } : undefined;
                  return <img src={src} alt={alt} style={style} className="max-w-full rounded-xl my-3 shadow" />;
                },
                a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">{children}</a>,
                hr: () => <hr className="border-surface-container my-5" />,
                strong: ({ children }: any) => <strong className="font-black">{children}</strong>,
                em: ({ children }: any) => <em className="italic">{children}</em>,
                details: ({ children }: any) => <details className="my-3 rounded-xl border border-surface-container overflow-hidden">{children}</details>,
                summary: ({ children }: any) => (
                  <summary className="px-4 py-2.5 bg-surface-container-low cursor-pointer font-black text-sm list-none flex items-center gap-2 hover:bg-surface-container transition-colors">
                    <span className="text-primary text-xs">▶</span> {children}
                  </summary>
                ),
              }}
            >
              {fullscreenMaterial.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>,
      document.body
    )}
    <div className="flex flex-col relative bg-surface-container-low/20 rounded-[3rem] border border-white/40 shadow-2xl">
      {/* 1. 상단 학급 선택기 (기존 사이드바에서 수평형으로 전환) */}
      <ClassSelector
        classes={classes}
        activeClassId={activeClassId}
        onSelectClass={setActiveClassId}
        onCreateClass={() => setIsCreateModalOpen(true)}
        schoolName={profile?.school_name || ''}
        onSchoolSettings={() => navigate('/settings')}
        onEditClass={async (c) => {
          setUpdateClassData(c);
          setIsUpdateModalOpen(true);
          setMaterialDropdownIdx(null);
          // 해당 클래스의 수업자료 에디터 자료 로드
          const { data } = await supabase
            .from('class_materials')
            .select('id, week_number, title')
            .eq('class_id', c.id)
            .order('week_number', { ascending: true });
          setEditingClassMaterials(data || []);
        }}
        onDeleteClass={handleDeleteClass}
        currentUserId={user?.id}
        onOpenArchive={() => {
          fetchArchivedClasses();
          setIsArchiveModalOpen(true);
        }}
      />

      {/* 2. 메인 대시보드 영역 (통합 스크롤) */}
      <main className="flex flex-col relative">
        <div className="fixed top-24 right-4 md:right-10 z-[200] flex flex-col gap-3 pointer-events-none max-w-[calc(100vw-2rem)]">
          <AnimatePresence>
            {realtimeToasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 60, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.9 }}
                className="bg-neutral-900/90 backdrop-blur-xl text-white px-8 py-5 rounded-[2rem] shadow-2xl text-sm font-black flex items-center gap-4 pointer-events-auto border border-white/10"
              >
                <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse shadow-[0_0_12px_rgba(var(--primary-rgb),0.8)]" />
                {toast.msg}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="p-4 md:p-8 lg:p-12 max-w-[1600px] mx-auto w-full">
          {/* 상단 버튼 행 */}
          <div className="flex items-center justify-between mb-4 md:mb-6">
            {/* 전체 학생 검색 버튼 */}
            {classes.length > 0 && (
              <button
                onClick={() => setIsGlobalSearchOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/80 hover:bg-white border border-neutral-200 hover:border-primary/30 text-neutral-500 hover:text-primary font-black text-xs transition-all shadow-sm group"
              >
                <Search size={14} className="group-hover:scale-110 transition-transform" />
                <span>전체 학생 검색</span>
                <span className="hidden sm:inline text-[11px] font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-md">⌘K</span>
              </button>
            )}
            {/* 우측 버튼 그룹 */}
            <div className="ml-auto flex items-center gap-2">
              {/* 학교 그룹 관리 버튼 */}
              <button
                onClick={() => { fetchSchools(); setIsSchoolModalOpen(true); }}
                title="담당 선생님께 공유할 수 있는 학교 단위 묶음이에요 (공유 링크 생성 가능)"
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-600 font-black text-xs transition-all hover:scale-[1.02] active:scale-95"
              >
                <GraduationCap size={14} />
                <span className="hidden sm:inline">학교 그룹</span>
              </button>
              {/* 이동 중 브리핑 버튼 */}
              {activeClassId && (
                <button
                  onClick={() => setIsBriefingOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-600 font-black text-xs transition-all hover:scale-[1.02] active:scale-95"
                >
                  <Headphones size={14} />
                  <span className="hidden sm:inline">이동 중 브리핑</span>
                </button>
              )}
            </div>
          </div>

          {/* 학교 프로젝트 최상위 클래스 → 허브 뷰 */}
          {classInfo?.school_project_id && !classInfo?.parent_class_id && (
            <SchoolProjectHub
              classInfo={classInfo}
              onOpenResources={() => {
                if (activeClassId) fetchResources(activeClassId);
                setIsResourceModalOpen(true);
              }}
              onOpenProjectModal={async () => {
                if (!classInfo?.school_project_id) return;
                const { data } = await supabase
                  .from('school_projects')
                  .select('*')
                  .eq('id', classInfo.school_project_id)
                  .single();
                setEditingProject(data || null);
                setIsProjectModalOpen(true);
              }}
              onSaved={async () => {
                if (!activeClassId) return;
                const { data } = await supabase.from('classes').select('*').eq('id', activeClassId).single();
                if (data) {
                  setClassInfo(data);
                  setClasses(prev => prev.map(c => c.id === data.id ? data : c));
                }
              }}
            />
          )}

          {/* 2.1 Cohesive Segmented Control - 일반 클래스만 표시 */}
          {(!classInfo?.school_project_id || classInfo?.parent_class_id) && (
          <>
          <div className="flex justify-center mb-8 md:mb-16">
            <div className="p-1 md:p-1.5 bg-surface-container/50 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] flex items-center border border-white/40 shadow-soft relative overflow-x-auto max-w-full custom-scrollbar">
              {[
                { id: 'list', label: '전체 명단', icon: LayoutDashboard },
                { id: 'units', label: '단원 관리', icon: BookOpen },
                { id: 'attendance', label: '출석 체크', icon: ClipboardList },
                { id: 'groups', label: '조 편성', icon: Layers },
                { id: 'board', label: '우리반 보드', icon: Users2 },
                { id: 'ai', label: 'AI 분석 인사이트', icon: Sparkles }
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as 'list' | 'ai' | 'units' | 'attendance' | 'board' | 'groups');
                      if (tab.id === 'board' && activeClassId) fetchBoard(activeClassId);
                    }}
                    className={`
                      relative z-10 flex items-center gap-1.5 md:gap-3 px-4 md:px-8 py-3 md:py-4 rounded-[1.5rem] md:rounded-[2rem] font-black text-xs md:text-sm transition-all duration-500 whitespace-nowrap shrink-0
                      ${isActive ? 'text-surface' : 'text-on-surface-variant hover:text-on-surface hover:bg-white/30'}
                    `}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-pill"
                        className="absolute inset-0 bg-on-surface rounded-[2rem] shadow-elevated -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <tab.icon size={18} className={`transition-colors duration-500 ${isActive ? 'text-primary' : 'text-on-surface-variant/65'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {loading && !classInfo ? (
            <DashboardSkeleton />
          ) : (
            <>
              {activeTab === 'units' && classInfo && (
                <div className="max-w-3xl mx-auto">
                  <UnitManager
                    classId={activeClassId!}
                    teacherId={user?.id || ''}
                  />
                </div>
              )}

              {activeTab === 'attendance' && classInfo && (
                <div className="max-w-4xl mx-auto">
                  <AttendanceTab classId={activeClassId!} students={sortedStudents} />
                </div>
              )}

              {activeTab === 'groups' && classInfo && (
                <div className="max-w-5xl mx-auto">
                  <GroupTab
                    classId={activeClassId!}
                    students={sortedStudents.map(s => ({ id: s.id, name: s.name, number: s.number }))}
                    onGroupsChanged={() => loadGroupMap(activeClassId!)}
                  />
                </div>
              )}

              {activeTab === 'ai' && classInfo && (
                <div className="min-h-[600px] flex flex-col items-center justify-center">
                  <AIInsightBanner
                    className={classInfo.name}
                    classId={activeClassId}
                    students={sortedStudents}
                    onOpenReport={() => setIsAIReportOpen(true)}
                    onOpenChat={() => setIsAIChatOpen(true)}
                  />
                  {sortedStudents.length > 0 && (
                     <p className="mt-10 text-on-surface-variant/70 text-sm font-bold flex items-center gap-2">
                       <Sparkles size={16} /> 
                       명단 데이터를 기반으로 분석된 실시간 결과입니다.
                     </p>
                  )}
                </div>
              )}

              {activeTab === 'board' && activeClassId && (
                <div>
                  {/* 보드 헤더 */}
                  <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center">
                        <Users2 size={20} className="text-indigo-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black">우리반 보드</h2>
                        <p className="text-xs text-on-surface-variant/80 font-bold">승인된 활동 기록·결과를 한눈에</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => activeClassId && fetchBoard(activeClassId)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 font-black text-xs hover:bg-indigo-100 transition-all"
                      >
                        <RefreshCw size={13} /> 새로고침
                      </button>
                      <button
                        onClick={() => window.open(`/board/${activeClassId}`, '_blank')}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-black text-xs hover:bg-indigo-700 transition-all shadow-sm"
                      >
                        <Maximize2 size={13} /> 전체화면
                      </button>
                    </div>
                  </div>

                  {/* 필터 바 */}
                  <div className="flex items-center gap-3 mb-8 flex-wrap">
                    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                      {[
                        { key: 'all', label: '전체' },
                        { key: 'obs', label: '📝 활동 기록' },
                        { key: 'result', label: '📁 결과' },
                      ].map(f => (
                        <button
                          key={f.key}
                          onClick={() => setBoardTypeFilter(f.key as any)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                            boardTypeFilter === f.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      <button
                        onClick={() => setBoardWeekFilter('all')}
                        className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                          boardWeekFilter === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        전체 주차
                      </button>
                      {Array.from(new Set(boardPosts.map(p => p.week_number).filter(Boolean))).sort((a, b) => a - b).map(w => (
                        <button
                          key={w}
                          onClick={() => setBoardWeekFilter(w)}
                          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                            boardWeekFilter === w ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          {w}주차
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 보드 콘텐츠 */}
                  {boardLoading ? (
                    <div className="flex items-center justify-center py-24">
                      <Loader2 size={32} className="animate-spin text-indigo-400" />
                    </div>
                  ) : (() => {
                    const filtered = boardPosts.filter(p => {
                      if (boardTypeFilter !== 'all' && p._type !== boardTypeFilter) return false;
                      if (boardWeekFilter !== 'all' && p.week_number !== boardWeekFilter) return false;
                      return true;
                    });
                    if (filtered.length === 0) return (
                      <div className="flex flex-col items-center py-24 space-y-4">
                        <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center">
                          <StickyNote size={36} className="text-indigo-200" />
                        </div>
                        <p className="font-black text-on-surface opacity-60">아직 승인된 게시물이 없어요</p>
                        <p className="text-sm text-on-surface-variant/75 font-bold">학생 제출물을 승인하면 보드에 나타납니다</p>
                      </div>
                    );
                    return (
                      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                        {filtered.map(post => {
                          const isObs = post._type === 'obs';
                          return (
                            <motion.div
                              key={`${post._type}-${post.id}`}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onClick={() => setBoardSelectedPost(post)}
                              className={`break-inside-avoid rounded-3xl border-2 p-5 space-y-3 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg ${
                                isObs ? 'bg-violet-50 border-violet-100 hover:border-violet-300 hover:bg-violet-50/80' : 'bg-emerald-50 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/80'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black shrink-0 ${
                                    isObs ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'
                                  }`}>
                                    {isObs ? '📝' : '📁'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-black truncate">{post.student_name}</p>
                                    <p className="text-xs text-on-surface-variant/80 font-bold">
                                      {post.week_number ? `${post.week_number}주차 · ` : ''}{new Date(post.created_at).toLocaleDateString('ko-KR')}
                                    </p>
                                  </div>
                                </div>
                                <span className={`shrink-0 text-xs font-black px-2 py-0.5 rounded-full ${
                                  isObs ? 'bg-violet-100 text-violet-600' : 'bg-emerald-100 text-emerald-600'
                                }`}>
                                  {isObs ? '활동 기록' : '결과'}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-sm font-black leading-snug line-clamp-2">
                                  {isObs ? post.activity_name : post.title}
                                </p>
                                {isObs && post.content && (
                                  <p className="text-xs text-on-surface-variant font-bold leading-relaxed line-clamp-4">{post.content}</p>
                                )}
                                {isObs && post.feeling && (
                                  <p className="text-xs text-on-surface-variant/75 font-bold italic line-clamp-2">💬 {post.feeling}</p>
                                )}
                                {!isObs && post.text_content && (
                                  <p className="text-xs text-on-surface-variant font-bold leading-relaxed line-clamp-4">{post.text_content}</p>
                                )}
                                {!isObs && post.image_url && (
                                  <img
                                    src={post.image_url}
                                    alt=""
                                    className="w-full rounded-xl object-cover max-h-40"
                                    loading="lazy"
                                    onError={e => {
                                      if (post.image_original_url) (e.target as HTMLImageElement).src = post.image_original_url;
                                    }}
                                  />
                                )}
                                {!isObs && post.link_url && (
                                  <a href={post.link_url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-xs font-black text-blue-600 hover:underline">
                                    <ExternalLink size={11} /><span className="truncate">{post.link_url}</span>
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
                            </motion.div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'list' && classInfo && (() => {
                const today = new Date().toISOString().slice(0, 10);
                const autoClosedByDate = classInfo.end_date && classInfo.end_date < today;
                const isClosed = classInfo.is_closed || autoClosedByDate;
                return isClosed ? (
                  <div className="mb-6 flex items-center justify-between gap-4 px-6 py-4 bg-rose-50 border border-rose-200 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                        <Lock size={16} className="text-rose-500" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-rose-700">수업이 종료된 학급입니다</p>
                        <p className="text-xs font-bold text-rose-400 mt-0.5">
                          {autoClosedByDate && !classInfo.is_closed
                            ? `종료일(${classInfo.end_date}) 경과로 자동 종료`
                            : '선생님이 수업 종료를 선언했습니다'}
                          · 학생의 활동기록·결과 제출이 차단됩니다.
                        </p>
                      </div>
                    </div>
                    {!autoClosedByDate && (
                      <button
                        onClick={() => handleToggleClassClosed(classInfo.id, true)}
                        className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl text-xs font-black hover:bg-rose-100 transition-all"
                      >
                        <Unlock size={13} /> 수업 재개
                      </button>
                    )}
                  </div>
                ) : null;
              })()}

              {activeTab === 'list' && (
                <SubjectDashboard
                  classInfo={classInfo}
                  students={sortedStudents}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onOpenQR={() => setIsQRModalOpen(true)}
                  onOpenResources={() => {
                    if (activeClassId) fetchResources(activeClassId);
                    setIsResourceModalOpen(true);
                  }}
                  onExport={handleExportCSV}
                  onAddStudent={() => setIsStudentModalOpen(true)}
                  onEditStudent={handleEditStudent}
                  onDeleteStudent={(id) => handleDeleteStudent(id, students.find(s => s.id === id)?.name || '')}
                  onNavigateAI={(id) => {
                    setDetailedStudentId(id);
                    setIsDrawerOpen(true);
                  }}
                  onSort={handleSort}
                  sortConfig={sortConfig}
                  onCopyLink={handleCopyLink}
                  copySuccess={copySuccess}
                  onShareTeacher={handleShareTeacher}
                  shareTeacherSuccess={shareTeacherSuccess}
                  selectedIds={selectedStudentIds}
                  onSelectStudent={handleSelectStudent}
                  onSelectAll={handleSelectAll}
                  onBulkApprove={handleBulkApprove}
                  onResetPin={handleResetPin}
                  groupMap={groupMap}
                  statsRefreshKey={statsRefreshKey}
                />
              )}
            </>
          )}
          </>
          )}
        </div>
      </main>

      {/* 2.5 Bulk Action Bar */}
      <AnimatePresence>
        {selectedStudentIds.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-xl px-4"
          >
            <div className="bg-neutral-900/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-between gap-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                  <Users size={20} />
                </div>
                <div>
                  <h4 className="text-white font-black text-lg tracking-tight">
                    <span className="text-primary">{selectedStudentIds.length}명</span> 선택됨
                  </h4>
                  <p className="text-xs text-neutral-300 font-bold uppercase tracking-widest">선택된 학생에 대해 일괄 작업</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedStudentIds([])}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black transition-all"
                >
                  선택 취소
                </button>
                <button 
                  onClick={handleBulkDelete}
                  className="px-8 py-3 bg-error hover:bg-error/90 text-white rounded-xl text-xs font-black shadow-lg shadow-error/20 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  일괄 삭제
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. 모달 레이어 */}
      <GlobalStudentSearch
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        classes={classes}
      />

      <AIReportModal
        isOpen={isAIReportOpen}
        onClose={() => setIsAIReportOpen(false)}
        className={classInfo?.name || ''}
        classId={activeClassId}
        students={students}
      />

      <AIChatModal
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        className={classInfo?.name || ''}
        classId={activeClassId}
        students={students}
      />

      <StudentDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setDetailedStudentId(null);
        }}
        studentId={detailedStudentId}
        fromClassId={activeClassId || undefined}
      />

      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-6 bg-on-surface/20 backdrop-blur-sm overflow-y-auto">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-white p-8 md:p-10 rounded-[2.5rem] space-y-8 shadow-2xl border border-neutral-200 my-auto">
              <h3 className="text-2xl font-black text-center text-neutral-900">새 학급 만들기</h3>
              <form onSubmit={handleCreateClass} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-neutral-600 ml-1 uppercase tracking-widest">학급 명칭</label>
                  <input type="text" placeholder="예: 2학년 3반" value={newClassData.name} onChange={e => setNewClassData({...newClassData, name: e.target.value})} className="w-full px-5 py-3.5 bg-neutral-100 border-2 border-neutral-200 hover:border-neutral-300 focus:border-primary/40 focus:bg-white rounded-xl font-bold text-neutral-900 transition-all outline-none placeholder:text-neutral-400" required />
                </div>
                {newClassData.class_type === 'subject' && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-xs font-black text-neutral-600 ml-1 uppercase tracking-widest">담당 과목</label>
                    <input type="text" placeholder="예: 국어" value={newClassData.subject} onChange={e => setNewClassData({...newClassData, subject: e.target.value})} className="w-full px-5 py-3.5 bg-neutral-100 border-2 border-neutral-200 hover:border-neutral-300 focus:border-primary/40 focus:bg-white rounded-xl font-bold text-neutral-900 transition-all outline-none placeholder:text-neutral-400" required />
                  </div>
                )}
                <div className="flex p-1.5 bg-neutral-100 border border-neutral-200 rounded-2xl">
                  <button type="button" onClick={() => setNewClassData({...newClassData, class_type: 'subject'})} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${newClassData.class_type === 'subject' ? 'bg-white shadow-sm text-primary border border-primary/10' : 'text-neutral-500 hover:text-neutral-700'}`}>과목 수업 (세특 기반)</button>
                  <button type="button" onClick={() => setNewClassData({...newClassData, class_type: 'homeroom'})} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${newClassData.class_type === 'homeroom' ? 'bg-white shadow-sm text-secondary border border-secondary/10' : 'text-neutral-500 hover:text-neutral-700'}`}>담임 반 (행특 기반)</button>
                </div>
                
                <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-500 space-y-3">
                  <details className="group [&_summary::-webkit-details-marker]:hidden [&_summary]:list-none">
                    <summary className="flex items-center justify-between gap-2 text-xs font-black text-secondary cursor-pointer select-none py-3 px-5 bg-secondary/5 rounded-2xl hover:bg-secondary/10 transition-all">
                      <div className="flex items-center gap-2">
                        <BookOpen size={14} />
                        주차별 수업 계획 (Syllabus)
                      </div>
                      <ChevronDown size={14} className="group-open:rotate-180 transition-transform duration-300" />
                    </summary>
                    <div className="space-y-4 pt-4 px-1">
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {newClassData.weekly_plan.map((item: any, idx: number) => (
                          <div key={idx} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3 relative">
                            {idx > 0 && (
                              <button type="button" onClick={() => {
                                const plan = newClassData.weekly_plan.filter((_: any, i: number) => i !== idx);
                                setNewClassData({ ...newClassData, weekly_plan: plan });
                              }} className="absolute top-3 right-3 text-neutral-500 hover:text-error transition-colors"><X size={14} /></button>
                            )}
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-white border border-neutral-100 rounded-lg flex flex-col items-center justify-center shrink-0">
                                 <span className="text-[7px] font-black text-neutral-400 uppercase leading-none">W</span>
                                 <span className="text-xs font-black text-secondary leading-none">{item.week}</span>
                               </div>
                               <div className="flex-1 space-y-2">
                                 <input type="text" value={item.topic} onChange={(e) => {
                                   const plan = [...newClassData.weekly_plan];
                                   plan[idx].topic = e.target.value;
                                   setNewClassData({ ...newClassData, weekly_plan: plan });
                                 }} placeholder="주제 (예: 국어의 기술)" className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-bold outline-none focus:border-secondary/40" />
                                 <input type="text" value={item.url} onChange={(e) => {
                                   const plan = [...newClassData.weekly_plan];
                                   plan[idx].url = e.target.value;
                                   setNewClassData({ ...newClassData, weekly_plan: plan });
                                 }} placeholder="자료 링크 (URL)" className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-bold outline-none focus:border-secondary/40" />
                                 <div className="flex items-center gap-4 mt-1">
                                   <label onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 cursor-pointer">
                                     <input type="checkbox" checked={item.requires_result !== false} onChange={(e) => {
                                       const plan = [...newClassData.weekly_plan];
                                       plan[idx].requires_result = e.target.checked;
                                       setNewClassData({ ...newClassData, weekly_plan: plan });
                                     }} className="w-3.5 h-3.5 rounded accent-secondary" />
                                     <span className="text-xs font-black text-neutral-600">결과제출 필요</span>
                                   </label>
                                   <label onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 cursor-pointer">
                                     <input type="checkbox" checked={item.requires_activity !== false} onChange={(e) => {
                                       const plan = [...newClassData.weekly_plan];
                                       plan[idx].requires_activity = e.target.checked;
                                       setNewClassData({ ...newClassData, weekly_plan: plan });
                                     }} className="w-3.5 h-3.5 rounded accent-secondary" />
                                     <span className="text-xs font-black text-neutral-600">활동기록 필요</span>
                                   </label>
                                 </div>
                               </div>
                            </div>
                          </div>
                        ))}
                        <button type="button" onClick={() => {
                          const plan = newClassData.weekly_plan;
                          setNewClassData({ ...newClassData, weekly_plan: [...plan, { week: plan.length + 1, topic: '', url: '', requires_result: true, requires_activity: true }] });
                        }} className="w-full py-2 border-2 border-dashed border-neutral-300 rounded-xl text-xs font-black text-neutral-500 hover:border-secondary/40 hover:text-secondary transition-all">+ 주차 추가</button>
                      </div>
                    </div>
                  </details>

                  <details className="group [&_summary::-webkit-details-marker]:hidden [&_summary]:list-none">
                    <summary className="flex items-center justify-between gap-2 text-xs font-black text-primary cursor-pointer select-none py-3 px-5 bg-primary/5 rounded-2xl hover:bg-primary/10 transition-all">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} />
                        고급 AI 설정 (선택 사항)
                      </div>
                      <ChevronDown size={14} className="group-open:rotate-180 transition-transform duration-300" />
                    </summary>
                    <div className="space-y-4 pt-4 px-1">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-neutral-600 uppercase tracking-widest ml-1">학생 활동 가이드</label>
                        <textarea value={newClassData.student_guide_prompt} onChange={e => setNewClassData({...newClassData, student_guide_prompt: e.target.value})} placeholder="미입력 시 기본 지침이 적용됩니다." className="w-full h-24 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold focus:bg-white outline-none resize-none" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-neutral-600 uppercase tracking-widest ml-1">AI 초안 작성 지침</label>
                        <textarea value={newClassData.teacher_report_prompt} onChange={e => setNewClassData({...newClassData, teacher_report_prompt: e.target.value})} placeholder="미입력 시 기본 지침이 적용됩니다." className="w-full h-24 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold focus:bg-white outline-none resize-none" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-neutral-600 uppercase tracking-widest ml-1">최소 제출 글자수</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min={0}
                            max={500}
                            value={newClassData.min_obs_chars || ''}
                            onChange={e => setNewClassData({...newClassData, min_obs_chars: parseInt(e.target.value) || 0})}
                            placeholder="0 (제한 없음)"
                            className="w-40 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-black focus:bg-white outline-none"
                          />
                          <span className="text-xs font-bold text-neutral-500">자 미만이면 제출 차단 (0 = 제한 없음)</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-neutral-600 uppercase tracking-widest ml-1">제출 금지어 (하드 차단)</label>
                        <textarea
                          value={(newClassData.blocked_keywords || []).join('\n')}
                          onChange={e => {
                            const raw = e.target.value;
                            const keywords = raw.split('\n').map(k => k.trim()).filter(Boolean);
                            setNewClassData({...newClassData, blocked_keywords: keywords});
                          }}
                          placeholder={"한 줄에 하나씩 입력\n예: 모름\n예: 복붙\n예: 없음"}
                          className="w-full h-20 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold focus:bg-white outline-none resize-none"
                        />
                        <span className="text-xs font-bold text-neutral-500 ml-1">입력한 단어/문장이 포함되면 제출 즉시 차단</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <div>
                            <p className="text-xs font-black text-neutral-600 uppercase tracking-widest">AI 내용 품질 검토</p>
                            <p className="text-xs font-bold text-neutral-500 mt-0.5">꺼두면 글자수·금지어만 차단</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewClassData({...newClassData, ai_review_enabled: !newClassData.ai_review_enabled})}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${newClassData.ai_review_enabled ? 'bg-primary' : 'bg-neutral-300'}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${newClassData.ai_review_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        <div className={`rounded-xl px-3 py-2.5 text-[10px] font-bold leading-relaxed transition-colors ${newClassData.ai_review_enabled ? 'bg-primary/5 text-primary/80 border border-primary/10' : 'bg-neutral-100 text-neutral-400 border border-neutral-200'}`}>
                          {newClassData.ai_review_enabled ? (
                            <>
                              <span className="font-black">ON</span> — 학생이 제출하면 AI가 내용의 구체성·관련성을 판단합니다.<br />
                              교사 지침에 맞지 않으면 자동으로 <span className="font-black">반려 플래그</span>가 붙어 교사 화면에 표시됩니다.<br />
                              <span className="text-primary/50">※ 글자수·금지어 차단은 AI와 무관하게 항상 작동합니다.</span>
                            </>
                          ) : (
                            <>
                              <span className="font-black">OFF</span> — AI 검토 없이 글자수·금지어 조건만 통과하면 즉시 승인됩니다.<br />
                              <span className="text-neutral-400">Gemini API가 호출되지 않으므로 비용이 발생하지 않습니다.</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </details>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-4 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-2xl font-black text-neutral-700 transition-all">취소</button>
                  <button type="submit" className="flex-1 py-4 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95">생성하기</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isUpdateModalOpen && updateClassData && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-6 bg-black/30 backdrop-blur-md overflow-y-auto">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl bg-white p-8 md:p-10 rounded-[3rem] space-y-8 shadow-2xl border border-neutral-200 my-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-neutral-900">학급 정보 관리</h3>
                <div className="flex p-1 bg-neutral-100 rounded-2xl border border-neutral-200">
                  <button type="button" onClick={() => setEditModalTab('basic')} className={`px-6 py-2 text-xs font-black rounded-xl transition-all ${editModalTab === 'basic' ? 'bg-white shadow-sm text-primary' : 'text-neutral-500 hover:text-neutral-700'}`}>기본 정보</button>
                  <button type="button" onClick={() => setEditModalTab('syllabus')} className={`px-6 py-2 text-xs font-black rounded-xl transition-all ${editModalTab === 'syllabus' ? 'bg-white shadow-sm text-primary' : 'text-neutral-500 hover:text-neutral-700'}`}>주차별 계획</button>
                  <button type="button" onClick={() => setEditModalTab('ai')} className={`px-6 py-2 text-xs font-black rounded-xl transition-all ${editModalTab === 'ai' ? 'bg-white shadow-sm text-primary' : 'text-neutral-500 hover:text-neutral-700'}`}>AI 지침 설정</button>
                </div>
              </div>

              {/* 학교 프로젝트 부모 클래스 안내 */}
              {updateClassData.school_project_id && !updateClassData.parent_class_id && (
                <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 border border-violet-200 rounded-2xl">
                  <School size={15} className="text-violet-500 shrink-0" />
                  <p className="text-xs font-bold text-violet-700">
                    AI 지침·수업 기간 등 공통 설정은 <strong>하위 반 전체에 동일하게 적용</strong>됩니다.
                  </p>
                </div>
              )}

              <form onSubmit={handleUpdateClass} className="space-y-6">
                <AnimatePresence mode="wait">
                  {editModalTab === 'basic' ? (
                    <motion.div 
                      key="basic"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-5"
                    >
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-neutral-600 ml-1 uppercase tracking-widest">학급 명칭</label>
                        <input type="text" placeholder="학급 명칭" value={updateClassData.name} onChange={e => setUpdateClassData({...updateClassData, name: e.target.value})} className="w-full px-5 py-3.5 bg-neutral-100 border-2 border-neutral-200 hover:border-neutral-300 focus:border-primary/40 focus:bg-white rounded-xl font-bold text-neutral-900 transition-all outline-none" required />
                      </div>
                      {updateClassData.class_type === 'subject' && (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                          <label className="text-xs font-black text-neutral-600 ml-1 uppercase tracking-widest">담당 과목</label>
                          <input type="text" placeholder="담당 과목" value={updateClassData.subject} onChange={e => setUpdateClassData({...updateClassData, subject: e.target.value})} className="w-full px-5 py-3.5 bg-neutral-100 border-2 border-neutral-200 hover:border-neutral-300 focus:border-primary/40 focus:bg-white rounded-xl font-bold text-neutral-900 transition-all outline-none" required />
                        </div>
                      )}

                      {/* 수업 기간 */}
                      <div className="space-y-2 pt-1">
                        <label className="text-xs font-black text-neutral-600 ml-1 uppercase tracking-widest flex items-center gap-1.5">
                          <CalendarDays size={13} /> 수업 기간 (선택)
                        </label>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 space-y-1">
                            <p className="text-[10px] font-black text-neutral-400 ml-1">시작일</p>
                            <input
                              type="date"
                              value={updateClassData.start_date || ''}
                              onChange={e => setUpdateClassData({...updateClassData, start_date: e.target.value || null})}
                              className="w-full px-4 py-3 bg-neutral-100 border-2 border-neutral-200 hover:border-neutral-300 focus:border-primary/40 focus:bg-white rounded-xl font-bold text-sm text-neutral-900 transition-all outline-none"
                            />
                          </div>
                          <span className="text-neutral-400 font-black text-sm mt-5">~</span>
                          <div className="flex-1 space-y-1">
                            <p className="text-[10px] font-black text-neutral-400 ml-1">종료일</p>
                            <input
                              type="date"
                              value={updateClassData.end_date || ''}
                              onChange={e => setUpdateClassData({...updateClassData, end_date: e.target.value || null})}
                              className="w-full px-4 py-3 bg-neutral-100 border-2 border-neutral-200 hover:border-neutral-300 focus:border-primary/40 focus:bg-white rounded-xl font-bold text-sm text-neutral-900 transition-all outline-none"
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-neutral-400 font-bold ml-1">종료일이 지나면 학생의 활동기록·결과 제출이 자동으로 차단됩니다.</p>
                      </div>

                      {/* 수업 종료 선언 */}
                      <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${updateClassData.is_closed ? 'bg-rose-50 border-rose-200' : 'bg-neutral-50 border-neutral-200'}`}>
                        <div className="flex items-center gap-3">
                          {updateClassData.is_closed ? <Lock size={18} className="text-rose-500 shrink-0" /> : <Unlock size={18} className="text-neutral-400 shrink-0" />}
                          <div>
                            <p className={`text-sm font-black ${updateClassData.is_closed ? 'text-rose-700' : 'text-neutral-700'}`}>수업 종료 선언</p>
                            <p className="text-[11px] font-bold text-neutral-400 mt-0.5">
                              {updateClassData.is_closed ? '현재 수업이 종료된 상태입니다.' : '수업을 종료하면 학생의 기록·제출이 차단됩니다.'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUpdateClassData({...updateClassData, is_closed: !updateClassData.is_closed})}
                          className={`relative w-12 h-6 rounded-full transition-all duration-300 ${updateClassData.is_closed ? 'bg-rose-500' : 'bg-neutral-300'}`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${updateClassData.is_closed ? 'left-6' : 'left-0.5'}`} />
                        </button>
                      </div>
                    </motion.div>
                  ) : editModalTab === 'syllabus' ? (
                    <motion.div 
                      key="syllabus"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-5"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between ml-1 text-primary">
                          <label className="text-xs font-black uppercase tracking-widest">주차별 수업 계획 (Syllabus)</label>
                          <button
                            type="button"
                            onClick={() => {
                              const plan = updateClassData.weekly_plan || [];
                              setUpdateClassData({
                                ...updateClassData,
                                weekly_plan: [...plan, { week: plan.length + 1, topic: '', url: '', requires_result: true, requires_activity: true }]
                              });
                            }}
                            className="text-xs font-black px-3 py-1 bg-primary/10 rounded-lg hover:bg-primary hover:text-white transition-all"
                          >+ 주차 추가</button>
                        </div>
                        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                          {(updateClassData.weekly_plan || []).map((item: any, idx: number) => (
                            <div key={idx} className="p-5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-4 relative group">
                              <button 
                                type="button"
                                onClick={() => {
                                  const plan = updateClassData.weekly_plan.filter((_: any, i: number) => i !== idx);
                                  setUpdateClassData({ ...updateClassData, weekly_plan: plan });
                                }}
                                className="absolute top-4 right-4 text-neutral-300 hover:text-error transition-colors"
                              ><X size={16} /></button>
                              
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white border-2 border-neutral-100 rounded-xl flex flex-col items-center justify-center shrink-0">
                                  <span className="text-[10px] font-black text-neutral-500 uppercase">Week</span>
                                  <span className="text-sm font-black text-primary">{item.week}</span>
                                </div>
                                <div className="flex-1 space-y-4">
                                  <div className="space-y-1">
                                    <label className="text-xs font-black text-neutral-600 uppercase tracking-widest ml-1">수업 주제</label>
                                    <input 
                                      type="text" 
                                      value={item.topic} 
                                      onChange={(e) => {
                                        const plan = [...updateClassData.weekly_plan];
                                        plan[idx].topic = e.target.value;
                                        setUpdateClassData({ ...updateClassData, weekly_plan: plan });
                                      }}
                                      placeholder="예: 구운몽의 환상 구조 탐구"
                                      className="w-full px-4 py-2 bg-white border border-neutral-200 rounded-xl text-sm font-bold focus:border-primary/40 outline-none"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-black text-neutral-600 uppercase tracking-widest ml-1">자료 링크 (URL)</label>
                                    <input
                                      type="text"
                                      value={item.url || ''}
                                      disabled={!!item.material_id}
                                      onChange={(e) => {
                                        const plan = [...updateClassData.weekly_plan];
                                        plan[idx].url = e.target.value;
                                        plan[idx].material_id = '';
                                        setUpdateClassData({ ...updateClassData, weekly_plan: plan });
                                      }}
                                      placeholder={item.material_id ? '에디터 자료가 연결됨' : 'https://...'}
                                      className={`w-full px-4 py-2 border rounded-xl text-sm font-bold focus:border-primary/40 outline-none transition-all ${
                                        item.material_id
                                          ? 'bg-neutral-100 border-neutral-100 text-neutral-400 cursor-not-allowed'
                                          : 'bg-white border-neutral-200'
                                      }`}
                                    />
                                    <div className="flex items-center gap-4 mt-1">
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={item.requires_result !== false} onChange={(e) => {
                                          const plan = [...updateClassData.weekly_plan];
                                          plan[idx].requires_result = e.target.checked;
                                          setUpdateClassData({ ...updateClassData, weekly_plan: plan });
                                        }} className="w-3.5 h-3.5 rounded accent-primary" />
                                        <span className="text-xs font-black text-neutral-600">결과제출 필요</span>
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={item.requires_activity !== false} onChange={(e) => {
                                          const plan = [...updateClassData.weekly_plan];
                                          plan[idx].requires_activity = e.target.checked;
                                          setUpdateClassData({ ...updateClassData, weekly_plan: plan });
                                        }} className="w-3.5 h-3.5 rounded accent-primary" />
                                        <span className="text-xs font-black text-neutral-600">활동기록 필요</span>
                                      </label>
                                    </div>
                                  </div>

                                  {/* ── 에디터 자료 연결 ── */}
                                  <div className="space-y-1">
                                    <label className="text-xs font-black text-neutral-600 uppercase tracking-widest ml-1">
                                      수업자료 에디터 연결 {editingClassMaterials.length === 0 && <span className="normal-case font-bold text-neutral-400">(에디터에서 작성한 자료 없음)</span>}
                                    </label>

                                    {item.material_id ? (
                                      /* 선택된 자료 표시 */
                                      <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border-2 border-primary/20 rounded-xl">
                                        <BookOpen size={14} className="text-primary shrink-0" />
                                        <span className="text-sm font-black text-primary flex-1 truncate">
                                          {editingClassMaterials.find(m => m.id === item.material_id)?.title || '선택된 자료'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const plan = [...updateClassData.weekly_plan];
                                            plan[idx].material_id = '';
                                            setUpdateClassData({ ...updateClassData, weekly_plan: plan });
                                          }}
                                          className="p-0.5 text-neutral-400 hover:text-error transition-colors"
                                        >
                                          <X size={14} />
                                        </button>
                                      </div>
                                    ) : (
                                      /* 자료 선택 드롭다운 */
                                      <div className="relative">
                                        <button
                                          type="button"
                                          disabled={editingClassMaterials.length === 0}
                                          onClick={() => setMaterialDropdownIdx(materialDropdownIdx === idx ? null : idx)}
                                          className={`w-full flex items-center justify-between px-4 py-2 border rounded-xl text-sm font-bold transition-all ${
                                            editingClassMaterials.length === 0
                                              ? 'bg-neutral-50 border-neutral-100 text-neutral-300 cursor-not-allowed'
                                              : 'bg-white border-neutral-200 hover:border-primary/40 cursor-pointer'
                                          }`}
                                        >
                                          <span className="text-neutral-400">에디터 자료 선택...</span>
                                          <ChevronDown size={14} className="text-neutral-300" />
                                        </button>

                                        {materialDropdownIdx === idx && editingClassMaterials.length > 0 && (
                                          <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-xl shadow-xl border border-neutral-200 z-50 overflow-hidden max-h-48 overflow-y-auto">
                                            {editingClassMaterials.map(mat => (
                                              <button
                                                key={mat.id}
                                                type="button"
                                                onClick={() => {
                                                  const plan = [...updateClassData.weekly_plan];
                                                  plan[idx].material_id = mat.id;
                                                  plan[idx].url = '';
                                                  setUpdateClassData({ ...updateClassData, weekly_plan: plan });
                                                  setMaterialDropdownIdx(null);
                                                }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-primary/5 transition-colors flex items-center gap-2"
                                              >
                                                <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center shrink-0">
                                                  {mat.week_number}
                                                </span>
                                                <span className="text-sm font-bold truncate">{mat.title}</span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          {(!updateClassData.weekly_plan || updateClassData.weekly_plan.length === 0) && (
                            <div className="py-10 text-center border-2 border-dashed border-neutral-100 rounded-[2rem]">
                              <p className="text-xs font-bold text-neutral-400">등록된 주차별 계획이 없습니다. 상단 [+ 주차 추가] 버튼을 눌러보세요!</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ) : editModalTab === 'ai' ? (
                    <motion.div 
                      key="ai"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-5"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-xs font-black text-primary uppercase tracking-widest">학생 활동 가이드 (Guide Prompt)</label>
                          <span className="text-xs text-neutral-500 font-bold">학생 입력 시 AI가 참고할 지침</span>
                        </div>
                        <textarea 
                          value={updateClassData.student_guide_prompt} 
                          onChange={e => setUpdateClassData({...updateClassData, student_guide_prompt: e.target.value})} 
                          className="w-full h-32 px-5 py-4 bg-neutral-100 border-2 border-neutral-200 hover:border-neutral-300 focus:border-primary/40 focus:bg-white rounded-2xl font-bold text-sm text-neutral-800 transition-all outline-none resize-none"
                          placeholder="학생들에게 강조하고 싶은 기록 요령을 입력하세요..."
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-xs font-black text-secondary uppercase tracking-widest">
                            {updateClassData.class_type === 'homeroom' ? 'AI 행특 초안 작성 지침' : 'AI 세특 초안 작성 지침'}
                          </label>
                          <span className="text-xs text-neutral-500 font-bold">AI 분석 및 생성 시 적용할 스타일</span>
                        </div>
                        <textarea
                          value={updateClassData.teacher_report_prompt}
                          onChange={e => setUpdateClassData({...updateClassData, teacher_report_prompt: e.target.value})}
                          className="w-full h-32 px-5 py-4 bg-neutral-100 border-2 border-neutral-200 hover:border-neutral-300 focus:border-secondary/40 focus:bg-white rounded-2xl font-bold text-sm text-neutral-800 transition-all outline-none resize-none"
                          placeholder="AI가 문구를 작성할 때 특별히 반영하길 원하는 스타일을 입력하세요..."
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-xs font-black text-rose-500 uppercase tracking-widest">최소 제출 글자수</label>
                          <span className="text-xs text-neutral-500 font-bold">미달 시 학생 제출 차단</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min={0}
                            max={500}
                            value={updateClassData.min_obs_chars || ''}
                            onChange={e => setUpdateClassData({...updateClassData, min_obs_chars: parseInt(e.target.value) || 0})}
                            placeholder="0"
                            className="w-40 px-5 py-3 bg-neutral-100 border-2 border-neutral-200 hover:border-rose-200 focus:border-rose-400 focus:bg-white rounded-2xl font-black text-sm outline-none transition-all"
                          />
                          <span className="text-xs font-bold text-neutral-500">자 미만 제출 차단 <span className="text-neutral-400">(0 = 제한 없음)</span></span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-xs font-black text-orange-500 uppercase tracking-widest">제출 금지어 (하드 차단)</label>
                          <span className="text-xs text-neutral-500 font-bold">포함 시 즉시 제출 차단</span>
                        </div>
                        <textarea
                          value={(updateClassData.blocked_keywords || []).join('\n')}
                          onChange={e => {
                            const raw = e.target.value;
                            const keywords = raw.split('\n').map((k: string) => k.trim()).filter(Boolean);
                            setUpdateClassData({...updateClassData, blocked_keywords: keywords});
                          }}
                          placeholder={"한 줄에 하나씩 입력\n예: 모름\n예: 복붙\n예: 없음"}
                          className="w-full h-28 px-5 py-4 bg-neutral-100 border-2 border-neutral-200 hover:border-orange-200 focus:border-orange-400 focus:bg-white rounded-2xl font-bold text-sm text-neutral-800 transition-all outline-none resize-none"
                        />
                        <span className="text-xs font-bold text-neutral-400 ml-1">입력한 단어/문장이 내용에 포함되면 AI 검토 없이 즉시 차단</span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1 py-1">
                          <div>
                            <p className="text-xs font-black text-primary uppercase tracking-widest">AI 내용 품질 검토</p>
                            <p className="text-xs font-bold text-neutral-400 mt-0.5">꺼두면 글자수·금지어만 차단</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUpdateClassData({...updateClassData, ai_review_enabled: !(updateClassData.ai_review_enabled ?? true)})}
                            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${(updateClassData.ai_review_enabled ?? true) ? 'bg-primary' : 'bg-neutral-300'}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${(updateClassData.ai_review_enabled ?? true) ? 'translate-x-6' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        <div className={`rounded-2xl px-4 py-3 text-xs font-bold leading-relaxed transition-colors ${(updateClassData.ai_review_enabled ?? true) ? 'bg-primary/5 text-primary/80 border border-primary/10' : 'bg-neutral-100 text-neutral-400 border border-neutral-200'}`}>
                          {(updateClassData.ai_review_enabled ?? true) ? (
                            <>
                              <span className="font-black">ON</span> — 학생이 제출하면 AI가 내용의 구체성·관련성을 판단합니다.<br />
                              교사 지침에 맞지 않으면 자동으로 <span className="font-black">반려 플래그</span>가 붙어 교사 화면에 표시됩니다.<br />
                              <span className="text-primary/50 text-[11px]">※ 글자수·금지어 차단은 AI와 무관하게 항상 작동합니다.</span>
                            </>
                          ) : (
                            <>
                              <span className="font-black">OFF</span> — AI 검토 없이 글자수·금지어 조건만 통과하면 즉시 승인됩니다.<br />
                              <span className="text-[11px]">Gemini API가 호출되지 않으므로 비용이 발생하지 않습니다.</span>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => {
                    setIsUpdateModalOpen(false);
                    setEditModalTab('basic');
                  }} className="flex-1 py-4 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-2xl font-black text-neutral-700 transition-all">취소</button>
                  <button type="submit" className="flex-1 py-4 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95">설정 저장하기</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isQRModalOpen && classInfo && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-xl">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm glass p-10 rounded-[3rem] text-center space-y-8 relative shadow-2xl border border-white/20">
              <button onClick={() => setIsQRModalOpen(false)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-surface-container transition-all"><X size={24} /></button>
              <div className="space-y-2">
                <h3 className="text-3xl font-black font-manrope">{classInfo.name}</h3>
                <p className="text-on-surface-variant font-bold">학생 입장용 QR 코드</p>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-inner inline-block aspect-square">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`https://sangilog.vercel.app/classroom-entry?code=${classInfo.entry_code}`)}`} alt="QR Code" className="w-full h-full object-contain" />
              </div>
              <div className="bg-primary/5 p-6 rounded-3xl space-y-2">
                <p className="text-xs font-black text-primary uppercase tracking-widest">입장 코드</p>
                <p className="text-4xl font-black font-manrope text-primary tracking-[0.2em]">{classInfo.entry_code}</p>
              </div>
            </motion.div>
          </div>
        )}

        {/* 학생 명찰 관리 모달 (개별 추가/일괄 등록) */}
        {isStudentModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg surface-card shadow-2xl p-10 rounded-[3rem] space-y-8 relative">
              <button onClick={() => setIsStudentModalOpen(false)} className="absolute top-8 right-8 p-2 rounded-full hover:bg-surface-container transition-all"><X size={24} /></button>
              <h3 className="text-3xl font-black font-manrope">학생 명단 관리</h3>
              <div className="flex p-1 bg-surface-container rounded-2xl mb-6">
                <button onClick={() => setRegisterMode('bulk')} className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${registerMode === 'bulk' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant'}`}>명렬표 일괄 붙여넣기</button>
                <button onClick={() => setRegisterMode('single')} className={`flex-1 py-3 text-sm font-black rounded-xl transition-all ${registerMode === 'single' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant'}`}>개별 추가</button>
              </div>
              {registerMode === 'bulk' ? (
                <div className="space-y-4">
                  <textarea value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} placeholder="홍길동&#10;김철수..." className="w-full h-48 px-6 py-4 bg-neutral-100 border-2 border-transparent focus:border-primary/20 rounded-2xl text-sm font-bold focus:bg-white border-none resize-none transition-all shadow-inner" />
                  <button onClick={handleBulkRegister} className="w-full py-5 btn-gradient rounded-2xl font-black text-lg shadow-xl shadow-primary/20">총 {bulkNames.split('\n').filter(n => n.trim()).length}명 등록하기</button>
                </div>
              ) : (
                <form onSubmit={handleAddStudent} className="space-y-4">
                  <input type="text" value={newStudentData.name} onChange={(e) => setNewStudentData({...newStudentData, name: e.target.value})} placeholder="이름" className="w-full px-6 py-4 bg-neutral-100 border-2 border-transparent focus:border-primary/20 rounded-2xl font-bold transition-all focus:bg-white" required />
                  <input type="text" value={newStudentData.number} onChange={(e) => setNewStudentData({...newStudentData, number: e.target.value})} placeholder="번호" className="w-full px-6 py-4 bg-neutral-100 border-2 border-transparent focus:border-primary/20 rounded-2xl font-bold transition-all focus:bg-white" />
                  <button type="submit" className="w-full py-5 btn-gradient rounded-2xl font-black text-lg shadow-xl shadow-primary/20">학생 추가하기</button>
                </form>
              )}
            </motion.div>
          </div>
        )}

        {isArchiveModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl glass p-10 rounded-[3rem] space-y-8 relative shadow-2xl border border-white/20">
              <button onClick={() => setIsArchiveModalOpen(false)} className="absolute top-8 right-8 p-2 rounded-full hover:bg-surface-container transition-all"><X size={24} /></button>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary shadow-sm">
                  <Archive size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-3xl font-black font-manrope">학급 아카이브함</h3>
                  <p className="text-xs font-bold text-on-surface-variant/80 uppercase tracking-widest">아카이브된 학급 목록</p>
                </div>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                {archiveLoading ? (
                  <div className="py-20 text-center space-y-4 opacity-70">
                    <RefreshCcw size={40} className="mx-auto animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest">아카이브 불러오는 중...</p>
                  </div>
                ) : archivedClasses.length > 0 ? (
                  archivedClasses.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-6 bg-white/60 rounded-[2rem] border border-surface-container-high transition-all hover:bg-white hover:shadow-soft">
                      <div className="flex items-center gap-5">
                         <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant/60"><GraduationCap size={24} /></div>
                         <div className="flex flex-col">
                            <h4 className="text-lg font-black tracking-tight">{c.name}</h4>
                            <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/70">{c.subject}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <button onClick={() => handleRestoreClass(c.id)} className="flex items-center gap-2 px-5 py-2.5 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl text-xs font-black border border-primary/10 transition-all">
                            <RefreshCcw size={14} /> 복원하기
                         </button>
                         <button onClick={() => handlePermanentDelete(c.id, c.name)} className="p-2.5 hover:bg-error/10 text-error/60 hover:text-error transition-all rounded-xl" title="영구 삭제">
                            <Trash2 size={16} />
                         </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center space-y-6 flex flex-col items-center">
                    <div className="w-20 h-20 bg-surface-container rounded-[2rem] flex items-center justify-center opacity-50"><Archive size={32} /></div>
                    <div className="space-y-2">
                      <p className="text-base font-black tracking-tight">아카이브함이 비어 있습니다.</p>
                      <p className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest">아카이브된 학급이 없습니다.</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-error/5 p-6 rounded-3xl flex items-start gap-4 border border-error/10">
                <AlertCircle size={20} className="text-error/70 mt-0.5" />
                <p className="text-xs text-error/70 leading-relaxed font-bold">
                  아카이브함의 학급을 영구 삭제하면 학생 명단과 해당 학급에 기록된 모든 관찰 데이터가 영구적으로 손실됩니다. <br />
                  중요한 데이터는 사전에 [데이터 내보내기] 기능을 통해 백업하세요.
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {/* 이동 중 브리핑 모달 */}
        {isBriefingOpen && activeClassId && classInfo && (
          <BriefingModal
            classId={activeClassId}
            className={classInfo.name + (classInfo.subject ? ` · ${classInfo.subject}` : '')}
            onClose={() => setIsBriefingOpen(false)}
          />
        )}

        {/* 보드 카드 상세 모달 */}
        {boardSelectedPost && (() => {
          const p = boardSelectedPost;
          const isObs = p._type === 'obs';
          return (
            <>
              <motion.div
                key="board-backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setBoardSelectedPost(null)}
                className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm"
              />
              <motion.div
                key="board-modal"
                initial={{ opacity: 0, scale: 0.92, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 24 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                className="fixed inset-0 z-[2000] flex items-center justify-center p-4 pointer-events-none"
              >
                <div
                  onClick={e => e.stopPropagation()}
                  className={`pointer-events-auto w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border-2 shadow-2xl bg-white ${
                    isObs ? 'border-violet-200' : 'border-emerald-200'
                  }`}
                >
                  {/* 모달 헤더 */}
                  <div className={`sticky top-0 flex items-center justify-between gap-3 px-6 py-4 border-b ${
                    isObs ? 'bg-violet-50 border-violet-100' : 'bg-emerald-50 border-emerald-100'
                  }`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base shrink-0 ${
                        isObs ? 'bg-violet-100' : 'bg-emerald-100'
                      }`}>
                        {isObs ? '📝' : '📁'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black truncate">{p.student_name}</p>
                        <p className="text-[11px] text-on-surface-variant font-bold">
                          {p.week_number ? `${p.week_number}주차 · ` : ''}
                          {new Date(p.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                          &nbsp;·&nbsp;
                          <span className={isObs ? 'text-violet-600' : 'text-emerald-600'}>
                            {isObs ? '활동 기록' : '결과물'}
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
                  <div className="p-6 space-y-5">
                    <h2 className="text-lg font-black leading-snug">
                      {isObs ? p.activity_name : p.title}
                    </h2>
                    {isObs && p.content && (
                      <div className="space-y-1.5">
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
                      <div className="space-y-1.5">
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
                          className="w-full rounded-2xl object-contain max-h-96 cursor-zoom-in"
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
                        <ExternalLink size={15} /><span className="truncate">{p.link_url}</span>
                      </a>
                    )}
                    {!isObs && p.file_url && (
                      <button
                        onClick={() => openFile(p.file_url, p.display_name || '첨부파일')}
                        className="w-full flex items-center gap-3 px-4 py-3.5 bg-amber-50 border border-amber-100 rounded-2xl hover:bg-amber-100 transition-all group text-left"
                      >
                        <File size={16} className="text-amber-500 shrink-0" />
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

        {/* 수업 자료실 모달 */}
        {isResourceModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-xl">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg glass p-8 rounded-[3rem] space-y-6 relative shadow-2xl border border-white/20">
              <button onClick={() => { setIsResourceModalOpen(false); setShowAddGeneralForm(false); }} className="absolute top-6 right-6 p-2 rounded-full hover:bg-surface-container transition-all"><X size={22} /></button>

              {/* 헤더 */}
              <div className="pr-8">
                <h3 className="text-2xl font-black font-manrope">수업 자료실</h3>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">클릭하면 새 탭으로 열립니다</p>
              </div>

              {/* 목록 */}
              {(() => {
                // 서브클래스면 부모 weekly_plan, 아니면 본인 weekly_plan 사용
                const effectivePlan = classInfo?.parent_class_id
                  ? parentWeeklyPlan
                  : (classInfo?.weekly_plan || []);
                // weekly_plan 에서 url 또는 material_id 가 있는 항목만 추출
                const planItems: any[] = effectivePlan.filter(
                  (p: any) => p.url?.trim() || p.material_id
                );
                const hasAnything = planItems.length > 0;

                return (
                  <div className="space-y-2 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">

                    {/* 주차별 자료 (weekly_plan 기반) */}
                    {planItems.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest px-1">주차별 자료</p>
                        {planItems.map((item: any) => {
                          const isMaterial = !!item.material_id;
                          const matInfo = isMaterial
                            ? classMaterials.find((m: any) => m.id === item.material_id)
                            : null;

                          return (
                            <button
                              key={`plan-${item.week}`}
                              onClick={() => {
                                if (isMaterial && matInfo) {
                                  setFullscreenMaterial({ title: matInfo.title, content: matInfo.content || '' });
                                } else {
                                  window.open(item.url, '_blank');
                                }
                              }}
                              className={`w-full flex items-center gap-3 p-4 bg-white rounded-2xl border border-surface-container-high group transition-all text-left ${
                                isMaterial ? 'hover:bg-secondary/5' : 'hover:bg-primary/5'
                              }`}
                            >
                              {/* 아이콘 */}
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                isMaterial ? 'bg-secondary/10' : 'bg-primary/10'
                              }`}>
                                {isMaterial
                                  ? <BookOpen size={16} className="text-secondary" />
                                  : <Link2 size={16} className="text-primary" />
                                }
                              </div>

                              {/* 텍스트 */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-black truncate">
                                  {isMaterial
                                    ? (matInfo?.title || '수업 자료 에디터')
                                    : (item.topic || item.url)
                                  }
                                </p>
                                <p className="text-[10px] text-on-surface-variant/50 truncate">
                                  {item.week}주차
                                  {item.topic && !isMaterial && ` · ${item.topic}`}
                                  {isMaterial ? ' · 수업 자료 에디터' : ` · ${item.url}`}
                                </p>
                              </div>

                              {/* 뱃지 + 아이콘 */}
                              <div className="flex items-center gap-2 shrink-0">
                                {isMaterial && matInfo?.is_published && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-secondary/10 text-secondary rounded-md">공개</span>
                                )}
                                {isMaterial
                                  ? <Maximize2 size={14} className="text-on-surface-variant/30 group-hover:text-secondary transition-colors" />
                                  : <ExternalLink size={14} className="text-on-surface-variant/30 group-hover:text-primary transition-colors" />
                                }
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* 빈 상태 */}
                    {!hasAnything && (
                      <div className="text-center py-6 text-on-surface-variant/30">
                        <BookOpen size={28} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-black">주차별 자료 없음</p>
                        <p className="text-xs mt-0.5">학급 수정에서 주차별 계획에 URL 또는 에디터를 연결해보세요</p>
                      </div>
                    )}

                    {/* ── 일반 자료 섹션 ── */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">일반 자료</p>
                        <button
                          onClick={() => { setShowAddGeneralForm(v => !v); setGeneralMatForm({ title: '', type: 'link', url: '', file: null }); }}
                          className="flex items-center gap-1 text-[10px] font-black text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition-all"
                        >
                          <Plus size={11} /> 추가
                        </button>
                      </div>

                      {/* 추가 폼 */}
                      {showAddGeneralForm && (
                        <div className="mb-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl space-y-3">
                          <input
                            type="text"
                            placeholder="자료 제목"
                            value={generalMatForm.title}
                            onChange={e => setGeneralMatForm(f => ({ ...f, title: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-sm font-bold focus:border-primary/40 outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => setGeneralMatForm(f => ({ ...f, type: 'link', file: null }))}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black border-2 transition-all ${generalMatForm.type === 'link' ? 'border-primary bg-primary text-white' : 'border-neutral-200 text-neutral-400 hover:border-primary/30'}`}
                            >
                              <Link2 size={12} /> 링크
                            </button>
                            <button
                              onClick={() => setGeneralMatForm(f => ({ ...f, type: 'file', url: '' }))}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black border-2 transition-all ${generalMatForm.type === 'file' ? 'border-primary bg-primary text-white' : 'border-neutral-200 text-neutral-400 hover:border-primary/30'}`}
                            >
                              <Upload size={12} /> 파일
                            </button>
                          </div>
                          {generalMatForm.type === 'link' ? (
                            <input
                              type="url"
                              placeholder="https://..."
                              value={generalMatForm.url}
                              onChange={e => setGeneralMatForm(f => ({ ...f, url: e.target.value }))}
                              className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-sm font-bold focus:border-primary/40 outline-none"
                            />
                          ) : (
                            <label className="flex flex-col items-center gap-1.5 p-3 bg-white border-2 border-dashed border-neutral-200 rounded-xl cursor-pointer hover:border-primary/40 transition-all">
                              <Upload size={18} className="text-primary/60" />
                              <span className="text-xs font-black text-neutral-500">
                                {generalMatForm.file ? generalMatForm.file.name : '파일 선택 (PDF, PPT, HWP 등)'}
                              </span>
                              <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setGeneralMatForm(prev => ({ ...prev, file: f })); }} />
                            </label>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowAddGeneralForm(false)}
                              className="flex-1 py-2 rounded-xl text-xs font-black border border-neutral-200 text-neutral-400 hover:bg-neutral-50 transition-all"
                            >취소</button>
                            <button
                              onClick={handleAddGeneralMat}
                              disabled={generalMatUploading}
                              className="flex-1 py-2 rounded-xl text-xs font-black bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-1"
                            >
                              {generalMatUploading ? <Loader2 size={12} className="animate-spin" /> : null}
                              {generalMatUploading ? '등록 중...' : '등록'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 일반 자료 목록 */}
                      {generalMaterials.length === 0 && !showAddGeneralForm ? (
                        <div className="text-center py-6 text-on-surface-variant/30">
                          <FileText size={28} className="mx-auto mb-2 opacity-30" />
                          <p className="text-xs font-black">등록된 일반 자료가 없습니다</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {generalMaterials.map(mat => (
                            <div key={mat.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-surface-container-high group">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${mat.type === 'file' ? 'bg-amber-100' : 'bg-cyan-100'}`}>
                                {mat.type === 'file' ? <File size={14} className="text-amber-600" /> : <Link2 size={14} className="text-cyan-600" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                {mat.type === 'link' ? (
                                  <a href={mat.url} target="_blank" rel="noopener noreferrer" className="text-sm font-black hover:text-primary transition-colors truncate block">{mat.title}</a>
                                ) : (
                                  <button
                                    onClick={async () => {
                                      const { data } = supabase.storage.from('student-attachments').getPublicUrl(mat.file_path);
                                      window.open(data.publicUrl, '_blank');
                                    }}
                                    className="text-sm font-black hover:text-primary transition-colors truncate block text-left"
                                  >{mat.title}</button>
                                )}
                                <p className="text-[10px] text-on-surface-variant/50 truncate">
                                  {mat.type === 'link' ? mat.url : mat.file_name}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeleteGeneralMat(mat.id, mat.file_path)}
                                disabled={deletingGeneralMatId === mat.id}
                                className="p-1.5 text-neutral-200 hover:text-error hover:bg-error/5 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
                              >
                                {deletingGeneralMatId === mat.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <UpgradeModal
        isOpen={!!upgradeModalReason}
        onClose={() => setUpgradeModalReason(null)}
        reason={upgradeModalReason ?? 'class_limit'}
      />

      {/* ── 학교 프로젝트 관리 모달 ── */}
      <SchoolProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => { setIsProjectModalOpen(false); setEditingProject(null); }}
        onSaved={() => {}}
        editProject={editingProject}
      />

      {/* ── 학교 그룹 관리 모달 ── */}
      <AnimatePresence>
        {isSchoolModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onClick={() => setIsSchoolModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* 헤더 */}
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                    <GraduationCap size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-black text-base">학교 그룹 관리</h2>
                    <p className="text-violet-200 text-[11px] font-semibold">같은 학교 학급을 묶어 담당 선생님께 공유 링크 전달</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSchoolModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* 새 학교 그룹 만들기 */}
                <div className="space-y-3">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest">새 학교 그룹 만들기</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSchoolName}
                      onChange={e => setNewSchoolName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateSchool()}
                      placeholder="예: ○○고등학교"
                      className="flex-1 px-4 py-3 bg-gray-50 border-2 border-gray-200 focus:border-violet-400 focus:bg-white rounded-xl font-bold text-gray-900 outline-none transition-all text-sm placeholder:text-gray-400"
                    />
                    <button
                      onClick={handleCreateSchool}
                      disabled={!newSchoolName.trim() || schoolCreating}
                      className="px-5 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-black rounded-xl text-sm flex items-center gap-2 transition-all"
                    >
                      {schoolCreating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                      만들기
                    </button>
                  </div>
                </div>

                {/* 학교 목록 */}
                <div className="space-y-3">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest">내 학교 그룹</p>
                  {schoolsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={24} className="animate-spin text-violet-400" />
                    </div>
                  ) : schools.length === 0 ? (
                    <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <GraduationCap size={28} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-sm font-bold text-gray-400">아직 학교 그룹이 없습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {schools.map(school => {
                        const assignedClasses = classes.filter(c => c.school_id === school.id);
                        const isCopied = schoolCopiedId === school.id;
                        const isEditing = editingSchoolId === school.id;
                        const isDeleting = deletingSchoolId === school.id;
                        return (
                          <div key={school.id} className="bg-gray-50 rounded-2xl border border-gray-100 p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                {/* 학교 이름 — 인라인 편집 */}
                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      autoFocus
                                      type="text"
                                      value={editingSchoolName}
                                      onChange={e => setEditingSchoolName(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleUpdateSchool(school.id);
                                        if (e.key === 'Escape') setEditingSchoolId(null);
                                      }}
                                      className="flex-1 px-3 py-1.5 bg-white border-2 border-violet-400 rounded-lg text-sm font-black text-gray-900 outline-none"
                                    />
                                    <button
                                      onClick={() => handleUpdateSchool(school.id)}
                                      disabled={schoolUpdating}
                                      className="px-3 py-1.5 bg-violet-600 text-white text-xs font-black rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1"
                                    >
                                      {schoolUpdating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                      저장
                                    </button>
                                    <button
                                      onClick={() => setEditingSchoolId(null)}
                                      className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-black rounded-lg hover:bg-gray-300"
                                    >
                                      취소
                                    </button>
                                  </div>
                                ) : (
                                  <p className="font-black text-gray-900 text-sm truncate">{school.name}</p>
                                )}
                                <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                                  입장 코드: <span className="text-violet-600 font-black tracking-widest">{school.entry_code}</span>
                                  {' · '}배정된 학급: {assignedClasses.length}개
                                </p>
                              </div>
                              {/* 링크복사 / 수정 / 삭제 버튼 */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => handleCopySchoolLink(school.id)}
                                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                                    isCopied ? 'bg-green-500 text-white' : 'bg-violet-100 hover:bg-violet-200 text-violet-700'
                                  }`}
                                >
                                  <Link2 size={12} />
                                  {isCopied ? '복사됨!' : '링크 복사'}
                                </button>
                                {!isEditing && (
                                  <button
                                    onClick={() => { setEditingSchoolId(school.id); setEditingSchoolName(school.name); }}
                                    className="w-8 h-8 rounded-xl bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-500 transition-all"
                                    title="이름 수정"
                                  >
                                    <RefreshCw size={13} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteSchool(school.id, school.name)}
                                  disabled={isDeleting}
                                  className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-400 hover:text-red-600 transition-all disabled:opacity-50"
                                  title="삭제"
                                >
                                  {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                </button>
                              </div>
                            </div>

                            {/* 클래스 배정 */}
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">학급 배정</p>
                              <div className="flex flex-wrap gap-1.5">
                                {classes.map(cls => {
                                  const isAssigned = cls.school_id === school.id;
                                  const isAssigning = assigningClassId === cls.id;
                                  return (
                                    <button
                                      key={cls.id}
                                      onClick={() => handleAssignClassToSchool(cls.id, isAssigned ? null : school.id)}
                                      disabled={isAssigning || (cls.school_id !== null && cls.school_id !== school.id)}
                                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all disabled:opacity-40 ${
                                        isAssigned
                                          ? 'bg-violet-600 text-white shadow-sm'
                                          : cls.school_id !== null && cls.school_id !== school.id
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600'
                                      }`}
                                      title={
                                        cls.school_id !== null && cls.school_id !== school.id
                                          ? '다른 학교 그룹에 이미 배정됨'
                                          : isAssigned ? '클릭하여 배정 해제' : '클릭하여 배정'
                                      }
                                    >
                                      {isAssigning
                                        ? <Loader2 size={10} className="animate-spin" />
                                        : isAssigned ? <CheckCircle2 size={10} /> : null
                                      }
                                      {cls.name}
                                      {cls.subject && cls.subject !== '담임' && (
                                        <span className="opacity-60">· {cls.subject}</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                              {assignedClasses.length > 0 && (
                                <p className="text-[10px] text-violet-600 font-semibold pt-1">
                                  배정됨: {assignedClasses.map(c => c.name).join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-2 pb-1">
                  <p className="text-[11px] text-gray-400 leading-relaxed text-center">
                    학교 링크를 복사하여 관리자·부장 선생님께 공유하세요.<br />
                    입장 코드를 알면 학교 전체 반의 결과를 탭으로 볼 수 있습니다.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
};

const DashboardSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    <div className="h-44 bg-surface-container rounded-[2.5rem]" />
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-3 h-96 bg-surface-container rounded-[2.5rem]" />
      <div className="col-span-9 h-96 bg-surface-container rounded-[2.5rem]" />
    </div>
  </div>
);

export default Classroom;
