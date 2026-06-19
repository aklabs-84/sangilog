import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import {
  X, School, Plus, Trash2, UserPlus, Copy, Check,
  CalendarDays, Users, ChevronRight, AlertCircle,
  Crown, Sparkles, GraduationCap, Search, Link as LinkIcon, Save
} from 'lucide-react';

interface SubClass {
  id: string;
  name: string;
  entry_code: string;
  assigned_teacher_id: string | null;
  assigned_teacher_name: string | null;
  assigned_teacher_avatar: string | null;
}

interface SchoolProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editProject?: any;
}

export const BANNER_THEMES = [
  { key: 'violet', label: '보라',    from: '#7c3aed', to: '#6d28d9', text: '#ffffff', sub: 'rgba(255,255,255,0.65)' },
  { key: 'blue',   label: '파랑',    from: '#2563eb', to: '#4338ca', text: '#ffffff', sub: 'rgba(255,255,255,0.65)' },
  { key: 'emerald',label: '초록',    from: '#059669', to: '#0d9488', text: '#ffffff', sub: 'rgba(255,255,255,0.65)' },
  { key: 'rose',   label: '분홍',    from: '#e11d48', to: '#db2777', text: '#ffffff', sub: 'rgba(255,255,255,0.65)' },
  { key: 'amber',  label: '주황',    from: '#d97706', to: '#b45309', text: '#ffffff', sub: 'rgba(255,255,255,0.65)' },
  { key: 'sky',    label: '하늘',    from: '#0ea5e9', to: '#3b82f6', text: '#ffffff', sub: 'rgba(255,255,255,0.65)' },
  { key: 'slate',  label: '슬레이트', from: '#475569', to: '#334155', text: '#ffffff', sub: 'rgba(255,255,255,0.65)' },
  { key: 'night',  label: '딥 네이비', from: '#1e1b4b', to: '#312e81', text: '#e0e7ff', sub: 'rgba(224,231,255,0.6)' },
  { key: 'forest', label: '딥 그린', from: '#14532d', to: '#166534', text: '#dcfce7', sub: 'rgba(220,252,231,0.6)' },
  { key: 'peach',  label: '피치',    from: '#fde68a', to: '#fdba74', text: '#78350f', sub: 'rgba(120,53,15,0.5)' },
];

const SchoolProjectModal = ({ isOpen, onClose, onSaved, editProject }: SchoolProjectModalProps) => {
  const { user, profile } = useAuth();

  const [step, setStep] = useState<'info' | 'subclasses' | 'teachers'>('info');
  const [projectName, setProjectName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bannerColor, setBannerColor] = useState('violet');
  const [saving, setSaving] = useState(false);
  const [savedInfo, setSavedInfo] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [parentClassId, setParentClassId] = useState<string | null>(null);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);

  const [subClasses, setSubClasses] = useState<SubClass[]>([]);
  const [newSubClassName, setNewSubClassName] = useState('');
  const [addingSubClass, setAddingSubClass] = useState(false);

  const [schoolTeachers, setSchoolTeachers] = useState<any[]>([]);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [assigningClassId, setAssigningClassId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSchoolTeachers();
      if (editProject) {
        setProjectName(editProject.name || '');
        setSchoolName(editProject.school_name || '');
        setStartDate(editProject.start_date || '');
        setEndDate(editProject.end_date || '');
        setBannerColor(editProject.banner_color || 'violet');
        setSavedProjectId(editProject.id);
        setShareToken(editProject.share_token || null);
        setParentClassId(editProject.parent_class_id || null);
        setStep('subclasses');
        fetchSubClasses(editProject.id);
      } else {
        setStep('info');
        setProjectName('');
        setSchoolName(profile?.school_name || '');
        setStartDate(new Date().toISOString().split('T')[0]);
        setEndDate('');
        setBannerColor('violet');
        setSavedProjectId(null);
        setShareToken(null);
        setParentClassId(null);
        setSubClasses([]);
        setCopiedShareUrl(false);
      }
    }
  }, [isOpen, editProject]);

  const fetchSchoolTeachers = async () => {
    if (!profile?.school_code) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('school_code', profile.school_code)
      .neq('id', user?.id);
    setSchoolTeachers(data || []);
  };

  const fetchSubClasses = async (projectId: string) => {
    const { data } = await supabase
      .from('classes')
      .select(`
        id, name, entry_code, assigned_teacher_id,
        profiles:assigned_teacher_id(full_name, avatar_url)
      `)
      .eq('school_project_id', projectId)
      .not('parent_class_id', 'is', null)
      .order('created_at', { ascending: true });

    if (data) {
      setSubClasses(data.map((c: any) => ({
        id: c.id,
        name: c.name,
        entry_code: c.entry_code,
        assigned_teacher_id: c.assigned_teacher_id,
        assigned_teacher_name: c.profiles?.full_name || null,
        assigned_teacher_avatar: c.profiles?.avatar_url || null,
      })));
    }
  };

  const generateEntryCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // Step 1: 프로젝트 기본 정보 + 부모 클래스 생성
  const handleSaveInfo = async () => {
    if (!projectName.trim() || !user) return;
    setSaving(true);
    try {
      let projectId = savedProjectId;
      let pClassId = parentClassId;

      if (projectId) {
        // 편집: 기본 정보 업데이트 + share_token 재조회
        await supabase.from('school_projects').update({
          name: projectName.trim(),
          school_name: schoolName.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          banner_color: bannerColor,
        }).eq('id', projectId);
        const { data: projData } = await supabase
          .from('school_projects')
          .select('share_token')
          .eq('id', projectId)
          .single();
        if (projData) setShareToken(projData.share_token);
        setSavedProjectId(projectId);
        setParentClassId(pClassId);
        setSavedInfo(true);
        setTimeout(() => setSavedInfo(false), 2000);
        onSaved();
        return;
      } else {
        // 신규 프로젝트 생성
        const { data: proj } = await supabase
          .from('school_projects')
          .insert({
            name: projectName.trim(),
            school_name: schoolName.trim() || null,
            admin_id: user.id,
            start_date: startDate || null,
            end_date: endDate || null,
            banner_color: bannerColor,
          })
          .select('id, share_token')
          .single();

        if (!proj) return;
        projectId = proj.id;
        setShareToken(proj.share_token);

        // 부모(학교) 클래스 자동 생성
        const parentClassPayload: any = {
          name: `${schoolName.trim() || projectName.trim()} (전체)`,
          subject: projectName.trim(),
          teacher_id: user.id,
          entry_code: generateEntryCode(),
        };
        try {
          const { data: pClass } = await supabase
            .from('classes')
            .insert({ ...parentClassPayload, school_project_id: projectId })
            .select('id')
            .single();
          if (pClass) pClassId = pClass.id;
        } catch (_e) {
          const { data: pClass } = await supabase
            .from('classes')
            .insert(parentClassPayload)
            .select('id')
            .single();
          if (pClass) pClassId = pClass.id;
        }
      }

      setSavedProjectId(projectId);
      setParentClassId(pClassId);
      setStep('subclasses');
    } finally {
      setSaving(false);
    }
  };

  // 하위 반 클래스 추가
  const handleAddSubClass = async () => {
    if (!newSubClassName.trim() || !savedProjectId || !parentClassId) return;
    setAddingSubClass(true);
    try {
      const { data } = await supabase
        .from('classes')
        .insert({
          name: newSubClassName.trim(),
          subject: projectName,
          teacher_id: user?.id,
          entry_code: generateEntryCode(),
          school_project_id: savedProjectId,
          parent_class_id: parentClassId,
        })
        .select('id, name, entry_code, assigned_teacher_id')
        .single();

      if (data) {
        setSubClasses(prev => [...prev, {
          id: data.id,
          name: data.name,
          entry_code: data.entry_code,
          assigned_teacher_id: null,
          assigned_teacher_name: null,
          assigned_teacher_avatar: null,
        }]);
        setNewSubClassName('');
      }
    } finally {
      setAddingSubClass(false);
    }
  };

  // 하위 반 삭제
  const handleDeleteSubClass = async (classId: string) => {
    await supabase.from('classes').delete().eq('id', classId);
    setSubClasses(prev => prev.filter(c => c.id !== classId));
  };

  // 담당 선생님 지정 (RPC 사용)
  const handleAssignTeacher = async (teacherId: string, classId: string, teacherName: string, teacherAvatar: string | null) => {
    if (!savedProjectId) return;

    // 기존 선생님이 있으면 먼저 Pro 회수
    const existing = subClasses.find(c => c.id === classId);
    if (existing?.assigned_teacher_id && existing.assigned_teacher_id !== teacherId) {
      await supabase.rpc('remove_teacher_from_subclass', {
        p_class_id: classId,
        p_teacher_id: existing.assigned_teacher_id,
      });
    }

    const { error } = await supabase.rpc('assign_teacher_to_subclass', {
      p_class_id: classId,
      p_teacher_id: teacherId,
      p_project_id: savedProjectId,
    });
    if (!error) {
      setSubClasses(prev => prev.map(c =>
        c.id === classId ? { ...c, assigned_teacher_id: teacherId, assigned_teacher_name: teacherName, assigned_teacher_avatar: teacherAvatar } : c
      ));
      setAssigningClassId(null);
      setTeacherSearchQuery('');
    }
  };

  // 담당 선생님 해제
  const handleRemoveTeacher = async (classId: string) => {
    const cls = subClasses.find(c => c.id === classId);
    if (!cls?.assigned_teacher_id) return;
    await supabase.rpc('remove_teacher_from_subclass', {
      p_class_id: classId,
      p_teacher_id: cls.assigned_teacher_id,
    });
    setSubClasses(prev => prev.map(c =>
      c.id === classId ? { ...c, assigned_teacher_id: null, assigned_teacher_name: null, assigned_teacher_avatar: null } : c
    ));
  };

  const handleCopyEntryCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredTeachers = schoolTeachers.filter(t =>
    t.full_name?.toLowerCase().includes(teacherSearchQuery.toLowerCase())
  );

  const proGrantedCount = subClasses.filter(c => c.assigned_teacher_id).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-8 py-6 text-white flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <School size={20} className="text-white" />
                  <h2 className="text-xl font-black text-white">학교 프로젝트</h2>
                </div>
                <p className="text-sm text-white/70">여러 반을 여러 선생님과 함께 운영하는 협업 수업</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all">
                <X size={18} />
              </button>
            </div>

            {/* 스텝 탭 */}
            <div className="flex border-b border-gray-100 shrink-0">
              {[
                { key: 'info', label: '기본 정보' },
                { key: 'subclasses', label: '반 클래스 관리' },
                { key: 'teachers', label: '선생님 초대' },
              ].map((s, i) => (
                <button
                  key={s.key}
                  onClick={() => savedProjectId ? setStep(s.key as any) : null}
                  className={`flex-1 py-3.5 text-xs font-black tracking-widest uppercase transition-all
                    ${step === s.key ? 'text-violet-600 border-b-2 border-violet-500' : 'text-gray-400 hover:text-gray-600'}
                    ${!savedProjectId && i > 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {i + 1}. {s.label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 p-8">

              {/* ── STEP 1: 기본 정보 ── */}
              {step === 'info' && (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">프로젝트 이름 *</label>
                    <input
                      type="text"
                      placeholder="예: 바이브코딩 수업"
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold border-2 border-transparent focus:border-violet-300 focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">학교 이름</label>
                    <input
                      type="text"
                      placeholder="예: 대건고등학교"
                      value={schoolName}
                      onChange={e => setSchoolName(e.target.value)}
                      className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold border-2 border-transparent focus:border-violet-300 focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">수업 시작일 *</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold border-2 border-transparent focus:border-violet-300 focus:bg-white outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">수업 종료일 *</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold border-2 border-transparent focus:border-violet-300 focus:bg-white outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* 배너 테마 */}
                  <div>
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-3">공유 페이지 배너 색상</label>
                    {/* 미리보기 */}
                    <div
                      className="w-full h-14 rounded-2xl mb-3 flex items-center px-5 gap-3 transition-all"
                      style={{ background: `linear-gradient(135deg, ${BANNER_THEMES.find(t => t.key === bannerColor)?.from ?? '#7c3aed'}, ${BANNER_THEMES.find(t => t.key === bannerColor)?.to ?? '#6d28d9'})` }}
                    >
                      <School size={16} style={{ color: BANNER_THEMES.find(t => t.key === bannerColor)?.text ?? '#fff' }} />
                      <span className="text-sm font-black" style={{ color: BANNER_THEMES.find(t => t.key === bannerColor)?.text ?? '#fff' }}>
                        {projectName || '프로젝트 이름'}
                      </span>
                    </div>
                    {/* 팔레트 */}
                    <div className="flex flex-wrap gap-2">
                      {BANNER_THEMES.map(theme => (
                        <button
                          key={theme.key}
                          type="button"
                          onClick={() => setBannerColor(theme.key)}
                          title={theme.label}
                          className={`w-9 h-9 rounded-xl transition-all border-2 ${bannerColor === theme.key ? 'scale-110 border-gray-800 shadow-md' : 'border-transparent hover:scale-105'}`}
                          style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Pro 공유 안내 */}
                  <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100 flex items-start gap-3">
                    <Sparkles size={16} className="text-violet-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-violet-800">Pro 크레딧 자동 공유</p>
                      <p className="text-xs text-violet-500 mt-0.5">
                        초대한 선생님들은 <strong>수업 기간 동안</strong> Pro 기능(AI, 화이트보드 등)을 무제한으로 사용할 수 있습니다.
                        수업 종료일 이후 자동으로 혜택이 만료됩니다.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
                    <AlertCircle size={16} className="text-blue-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-600">
                      주차/자료/퀴즈/화이트보드를 이 프로젝트에서 등록하면 <strong>모든 반 클래스에 자동 적용</strong>됩니다.
                    </p>
                  </div>

                  <button
                    onClick={handleSaveInfo}
                    disabled={!projectName.trim() || !startDate || !endDate || saving}
                    className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-95 ${
                      savedInfo
                        ? 'bg-emerald-500 text-white'
                        : 'bg-violet-500 hover:bg-violet-600 text-white'
                    }`}
                  >
                    {saving ? '저장 중...'
                      : savedInfo ? <><Check size={16} /> 저장됨!</>
                      : savedProjectId
                        ? <><Save size={16} /> 변경 내용 저장</>
                        : <><ChevronRight size={16} /> 다음: 반 클래스 추가</>
                    }
                  </button>
                </div>
              )}

              {/* ── STEP 2: 반 클래스 관리 ── */}
              {step === 'subclasses' && (
                <div className="space-y-6">
                  {/* Pro 공유 현황 배지 */}
                  {endDate && (
                    <div className="flex items-center gap-2 p-3 bg-violet-50 rounded-2xl border border-violet-100">
                      <Crown size={14} className="text-violet-500" />
                      <p className="text-xs text-violet-700">
                        <span className="font-black">Pro 공유 기간:</span> {new Date(startDate || '').toLocaleDateString('ko-KR')} ~ {new Date(endDate).toLocaleDateString('ko-KR')}
                        {proGrantedCount > 0 && <span className="ml-2 font-black text-violet-600">({proGrantedCount}명 활성)</span>}
                      </p>
                    </div>
                  )}

                  {/* 반 클래스 추가 */}
                  <div>
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-3">반 클래스 추가</label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="예: 2-1반, 2-2반"
                        value={newSubClassName}
                        onChange={e => setNewSubClassName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddSubClass()}
                        className="flex-1 px-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold border-2 border-transparent focus:border-violet-300 outline-none transition-all"
                      />
                      <button
                        onClick={handleAddSubClass}
                        disabled={!newSubClassName.trim() || addingSubClass}
                        className="px-5 py-3 bg-violet-500 text-white rounded-2xl font-black text-sm flex items-center gap-2 disabled:opacity-40 active:scale-95 transition-all"
                      >
                        <Plus size={16} /> 추가
                      </button>
                    </div>
                  </div>

                  {/* 반 클래스 목록 */}
                  <div className="space-y-3">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest">반 클래스 ({subClasses.length}개)</p>
                    {subClasses.length === 0 ? (
                      <div className="text-center py-10 text-gray-300">
                        <GraduationCap size={32} className="mx-auto mb-2" />
                        <p className="text-xs font-bold">반 클래스를 추가해주세요</p>
                        <p className="text-[10px] mt-1">예: 2-1반, 2-2반, 2-3반</p>
                      </div>
                    ) : (
                      subClasses.map(cls => (
                        <div key={cls.id} className="relative">
                          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600 shrink-0">
                              <GraduationCap size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-black truncate">{cls.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-mono bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                                  {cls.entry_code}
                                </span>
                                {cls.assigned_teacher_name ? (
                                  <span className="text-xs text-violet-600 font-bold flex items-center gap-1">
                                    <Crown size={10} /> {cls.assigned_teacher_name} 선생님
                                  </span>
                                ) : (
                                  <span className="text-xs text-orange-400">담당 선생님 미지정</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleCopyEntryCode(cls.entry_code)}
                                title="입장코드 복사"
                                className="p-2 rounded-xl bg-white border border-gray-200 hover:border-violet-300 text-gray-400 hover:text-violet-600 transition-all"
                              >
                                {copiedCode === cls.entry_code ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                              </button>
                              <button
                                onClick={() => setAssigningClassId(assigningClassId === cls.id ? null : cls.id)}
                                title="선생님 지정"
                                className="p-2 rounded-xl bg-white border border-gray-200 hover:border-violet-300 text-gray-400 hover:text-violet-600 transition-all"
                              >
                                <UserPlus size={15} />
                              </button>
                              {cls.assigned_teacher_id && (
                                <button
                                  onClick={() => handleRemoveTeacher(cls.id)}
                                  title="담당 해제"
                                  className="p-2 rounded-xl text-gray-300 hover:text-orange-400 hover:bg-orange-50 transition-all"
                                >
                                  <Users size={15} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteSubClass(cls.id)}
                                className="p-2 rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          {/* 선생님 지정 드롭다운 */}
                          <AnimatePresence>
                            {assigningClassId === cls.id && (
                              <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-10 overflow-hidden"
                              >
                                <div className="p-3 border-b border-gray-100 flex items-center gap-2">
                                  <Search size={13} className="text-gray-400" />
                                  <input
                                    type="text"
                                    placeholder="선생님 이름 검색..."
                                    value={teacherSearchQuery}
                                    onChange={e => setTeacherSearchQuery(e.target.value)}
                                    className="flex-1 text-xs font-bold outline-none"
                                    autoFocus
                                  />
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                  {filteredTeachers.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-4">
                                      {schoolTeachers.length === 0 ? '같은 학교 선생님이 없습니다' : '검색 결과 없음'}
                                    </p>
                                  ) : (
                                    filteredTeachers.map(t => (
                                      <button
                                        key={t.id}
                                        onClick={() => handleAssignTeacher(t.id, cls.id, t.full_name, t.avatar_url)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-50 text-left transition-all"
                                      >
                                        <img
                                          src={t.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.full_name)}&background=random`}
                                          alt={t.full_name}
                                          className="w-8 h-8 rounded-full object-cover shrink-0"
                                        />
                                        <div>
                                          <p className="text-sm font-bold">{t.full_name} 선생님</p>
                                          {endDate && (
                                            <p className="text-[10px] text-violet-500 flex items-center gap-1">
                                              <Sparkles size={9} /> Pro 혜택 {new Date(endDate).toLocaleDateString('ko-KR')}까지
                                            </p>
                                          )}
                                        </div>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    onClick={() => setStep('teachers')}
                    disabled={subClasses.length === 0}
                    className="w-full py-4 bg-violet-500 hover:bg-violet-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-95"
                  >
                    <ChevronRight size={16} /> 다음: 초대 확인
                  </button>
                </div>
              )}

              {/* ── STEP 3: 초대 확인 ── */}
              {step === 'teachers' && (
                <div className="space-y-6">
                  <div className="p-6 bg-violet-50 rounded-2xl border border-violet-100 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-violet-200 rounded-2xl flex items-center justify-center text-violet-700">
                        <School size={22} />
                      </div>
                      <div>
                        <p className="font-black text-base text-violet-900">{projectName}</p>
                        <p className="text-xs text-violet-500">{schoolName}</p>
                        {startDate && endDate && (
                          <p className="text-[10px] text-violet-400 mt-0.5 flex items-center gap-1">
                            <CalendarDays size={10} />
                            {new Date(startDate).toLocaleDateString('ko-KR')} ~ {new Date(endDate).toLocaleDateString('ko-KR')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest">반 클래스 현황 ({subClasses.length}개)</p>
                    {subClasses.map(cls => (
                      <div key={cls.id} className="relative">
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                          <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600 shrink-0">
                            <GraduationCap size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black truncate">{cls.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] font-mono bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">{cls.entry_code}</span>
                              {cls.assigned_teacher_name ? (
                                <span className="text-[10px] text-violet-600 font-bold flex items-center gap-1">
                                  <Crown size={9} /> {cls.assigned_teacher_name} 선생님
                                </span>
                              ) : (
                                <span className="text-[10px] text-orange-400 font-bold">담당 선생님 미지정</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleCopyEntryCode(cls.entry_code)}
                              title="입장코드 복사"
                              className="p-2 rounded-xl bg-white border border-gray-200 hover:border-violet-300 text-gray-400 hover:text-violet-600 transition-all"
                            >
                              {copiedCode === cls.entry_code ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                            <button
                              onClick={() => setAssigningClassId(assigningClassId === cls.id ? null : cls.id)}
                              title={cls.assigned_teacher_name ? '선생님 변경' : '선생님 지정'}
                              className={`p-2 rounded-xl border transition-all ${
                                assigningClassId === cls.id
                                  ? 'bg-violet-100 border-violet-300 text-violet-600'
                                  : 'bg-white border-gray-200 hover:border-violet-300 text-gray-400 hover:text-violet-600'
                              }`}
                            >
                              <UserPlus size={14} />
                            </button>
                            {cls.assigned_teacher_id && (
                              <button
                                onClick={() => handleRemoveTeacher(cls.id)}
                                title="담당 해제"
                                className="p-2 rounded-xl bg-white border border-gray-200 hover:border-orange-300 text-gray-300 hover:text-orange-400 transition-all"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 선생님 검색 드롭다운 */}
                        <AnimatePresence>
                          {assigningClassId === cls.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              className="mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-10"
                            >
                              <div className="p-3 border-b border-gray-100 flex items-center gap-2">
                                <Search size={13} className="text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="선생님 이름 검색..."
                                  value={teacherSearchQuery}
                                  onChange={e => setTeacherSearchQuery(e.target.value)}
                                  className="flex-1 text-xs font-bold outline-none"
                                  autoFocus
                                />
                                <button onClick={() => { setAssigningClassId(null); setTeacherSearchQuery(''); }} className="text-gray-300 hover:text-gray-500">
                                  <X size={14} />
                                </button>
                              </div>
                              <div className="max-h-44 overflow-y-auto">
                                {filteredTeachers.length === 0 ? (
                                  <p className="text-xs text-gray-400 text-center py-4">
                                    {schoolTeachers.length === 0 ? '같은 학교 선생님이 없습니다' : '검색 결과 없음'}
                                  </p>
                                ) : (
                                  filteredTeachers.map(t => (
                                    <button
                                      key={t.id}
                                      onClick={() => handleAssignTeacher(t.id, cls.id, t.full_name, t.avatar_url)}
                                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-50 text-left transition-all"
                                    >
                                      <img
                                        src={t.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.full_name)}&background=random`}
                                        alt={t.full_name}
                                        className="w-8 h-8 rounded-full object-cover shrink-0"
                                      />
                                      <div>
                                        <p className="text-sm font-bold">{t.full_name} 선생님</p>
                                        {endDate && (
                                          <p className="text-[10px] text-violet-500">수업 기간 Pro 자동 부여</p>
                                        )}
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>

                  {proGrantedCount > 0 && (
                    <div className="p-4 bg-green-50 rounded-2xl border border-green-100 flex items-center gap-3">
                      <Sparkles size={16} className="text-green-500 shrink-0" />
                      <p className="text-xs text-green-700">
                        <span className="font-black">{proGrantedCount}명의 선생님</span>에게 수업 기간 동안 Pro 혜택이 자동으로 부여됩니다.
                      </p>
                    </div>
                  )}

                  {/* 학교 담당자 공유 URL */}
                  {shareToken && (
                    <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <LinkIcon size={14} className="text-gray-500" />
                        <p className="text-xs font-black text-gray-600 uppercase tracking-widest">학교 담당자 공유 URL</p>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        이 링크를 학교 담당 선생님께 전달하면 모든 반의 결과를 한 번에 열람할 수 있습니다.
                        <br /><span className="text-orange-400 font-bold">⚠ 프로젝트 삭제 시 이 링크로 접근 불가</span>
                      </p>
                      <div className="flex gap-2">
                        <div className="flex-1 px-3 py-2 bg-white rounded-xl text-[10px] font-mono text-gray-500 border border-gray-200 truncate">
                          {window.location.origin}/school-project/{shareToken}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/school-project/${shareToken}`);
                            setCopiedShareUrl(true);
                            setTimeout(() => setCopiedShareUrl(false), 2000);
                          }}
                          className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
                        >
                          {copiedShareUrl ? <><Check size={13} /> 복사됨</> : <><Copy size={13} /> 복사</>}
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => { onSaved(); onClose(); }}
                    className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-black text-sm transition-all active:scale-95"
                  >
                    완료
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SchoolProjectModal;
