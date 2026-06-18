import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import {
  X, School, Plus, Trash2, UserPlus, Copy, Check,
  CalendarDays, Users, ChevronRight, AlertCircle,
  Crown, Sparkles, GraduationCap, Search
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

const SchoolProjectModal = ({ isOpen, onClose, onSaved, editProject }: SchoolProjectModalProps) => {
  const { user, profile } = useAuth();

  const [step, setStep] = useState<'info' | 'subclasses' | 'teachers'>('info');
  const [projectName, setProjectName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [parentClassId, setParentClassId] = useState<string | null>(null);

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
        setSavedProjectId(editProject.id);
        setParentClassId(editProject.parent_class_id || null);
        setStep('subclasses');
        fetchSubClasses(editProject.id);
      } else {
        setStep('info');
        setProjectName('');
        setSchoolName(profile?.school_name || '');
        setStartDate(new Date().toISOString().split('T')[0]);
        setEndDate('');
        setSavedProjectId(null);
        setParentClassId(null);
        setSubClasses([]);
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
        await supabase.from('school_projects').update({
          name: projectName.trim(),
          school_name: schoolName.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
        }).eq('id', projectId);
      } else {
        // 프로젝트 생성
        const { data: proj } = await supabase
          .from('school_projects')
          .insert({
            name: projectName.trim(),
            school_name: schoolName.trim() || null,
            admin_id: user.id,
            start_date: startDate || null,
            end_date: endDate || null,
          })
          .select('id')
          .single();

        if (!proj) return;
        projectId = proj.id;

        // 부모(학교) 클래스 자동 생성
        const { data: pClass } = await supabase
          .from('classes')
          .insert({
            name: `${schoolName.trim() || projectName.trim()} (전체)`,
            subject: projectName.trim(),
            teacher_id: user.id,
            entry_code: generateEntryCode(),
            school_project_id: projectId,
          })
          .select('id')
          .single();

        if (pClass) pClassId = pClass.id;

        // 프로젝트에 parent_class_id 업데이트 (프로젝트 테이블에 없으면 클래스로만 추적)
        await supabase.from('school_projects').update({
          // share_token은 자동 생성됨
        }).eq('id', projectId);
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
                  <School size={20} />
                  <h2 className="text-xl font-black">학교 프로젝트</h2>
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
                    className="w-full py-4 bg-violet-500 hover:bg-violet-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-95"
                  >
                    {saving ? '저장 중...' : <><ChevronRight size={16} /> 다음: 반 클래스 추가</>}
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
                      <div key={cls.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600">
                            <GraduationCap size={15} />
                          </div>
                          <div>
                            <p className="text-sm font-black">{cls.name}</p>
                            <p className="text-xs text-gray-400">
                              입장코드: <span className="font-mono font-bold">{cls.entry_code}</span>
                              {cls.assigned_teacher_name && (
                                <span className="ml-2 text-violet-600 font-bold">· {cls.assigned_teacher_name} 선생님</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCopyEntryCode(cls.entry_code)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-violet-300 rounded-xl text-xs font-bold text-gray-600 hover:text-violet-600 transition-all"
                        >
                          {copiedCode === cls.entry_code ? <><Check size={12} className="text-green-500" /> 복사됨</> : <><Copy size={12} /> 코드 복사</>}
                        </button>
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
