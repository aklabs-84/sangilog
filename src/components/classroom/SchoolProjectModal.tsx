import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import {
  X, School, Plus, Trash2, UserPlus, Copy, Check,
  CalendarDays, FolderOpen, Users, Link as LinkIcon,
  ChevronRight, AlertCircle
} from 'lucide-react';

interface ProjectClass {
  class_id: string;
  class_name: string;
  subject: string;
  teacher_id: string | null;
  teacher_name: string | null;
}

interface SchoolProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editProject?: any; // 편집 모드
}

const SchoolProjectModal = ({ isOpen, onClose, onSaved, editProject }: SchoolProjectModalProps) => {
  const { user, profile } = useAuth();

  // 폼 상태
  const [step, setStep] = useState<'info' | 'classes' | 'invite'>('info');
  const [projectName, setProjectName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);

  // 클래스 관리
  const [myClasses, setMyClasses] = useState<any[]>([]);
  const [projectClasses, setProjectClasses] = useState<ProjectClass[]>([]);
  const [addingClassId, setAddingClassId] = useState('');

  // 교사 초대
  const [schoolTeachers, setSchoolTeachers] = useState<any[]>([]);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [invitingClassId, setInvitingClassId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMyClasses();
      fetchSchoolTeachers();
      if (editProject) {
        setProjectName(editProject.name || '');
        setSchoolName(editProject.school_name || '');
        setEndDate(editProject.end_date || '');
        setSavedProjectId(editProject.id);
        setShareToken(editProject.share_token);
        setStep('classes');
        fetchProjectClasses(editProject.id);
      } else {
        setStep('info');
        setProjectName('');
        setSchoolName(profile?.school_name || '');
        setEndDate('');
        setSavedProjectId(null);
        setProjectClasses([]);
      }
    }
  }, [isOpen, editProject]);

  const fetchMyClasses = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('classes')
      .select('id, name, subject')
      .eq('teacher_id', user.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    setMyClasses(data || []);
  };

  const fetchSchoolTeachers = async () => {
    if (!profile?.school_code) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('school_code', profile.school_code)
      .neq('id', user?.id);
    setSchoolTeachers(data || []);
  };

  const fetchProjectClasses = async (projectId: string) => {
    const { data } = await supabase
      .from('school_project_classes')
      .select(`
        class_id,
        teacher_id,
        role,
        classes!inner(name, subject),
        profiles(full_name)
      `)
      .eq('project_id', projectId);

    if (data) {
      setProjectClasses(data.map((row: any) => ({
        class_id: row.class_id,
        class_name: row.classes?.name || '',
        subject: row.classes?.subject || '',
        teacher_id: row.teacher_id,
        teacher_name: row.profiles?.full_name || null,
      })));
    }
  };

  // 1단계: 프로젝트 기본 정보 저장
  const handleSaveInfo = async () => {
    if (!projectName.trim() || !user) return;
    setSaving(true);
    try {
      const payload = {
        name: projectName.trim(),
        school_name: schoolName.trim() || null,
        admin_id: user.id,
        end_date: endDate || null,
      };

      let projectId = savedProjectId;
      let token = shareToken;

      if (projectId) {
        await supabase.from('school_projects').update(payload).eq('id', projectId);
      } else {
        const { data } = await supabase
          .from('school_projects')
          .insert(payload)
          .select('id, share_token')
          .single();
        if (data) {
          projectId = data.id;
          token = data.share_token;
        }
      }

      setSavedProjectId(projectId);
      setShareToken(token);
      setStep('classes');
    } finally {
      setSaving(false);
    }
  };

  // 클래스 프로젝트에 추가
  const handleAddClass = async () => {
    if (!addingClassId || !savedProjectId) return;
    const cls = myClasses.find(c => c.id === addingClassId);
    if (!cls) return;

    await supabase.from('school_project_classes').upsert({
      project_id: savedProjectId,
      class_id: addingClassId,
      teacher_id: user?.id,
      role: 'class_owner',
    });

    setProjectClasses(prev => [
      ...prev.filter(pc => pc.class_id !== addingClassId),
      { class_id: addingClassId, class_name: cls.name, subject: cls.subject, teacher_id: user?.id || null, teacher_name: profile?.full_name || null }
    ]);
    setAddingClassId('');
  };

  // 클래스 프로젝트에서 제거
  const handleRemoveClass = async (classId: string) => {
    if (!savedProjectId) return;
    await supabase.from('school_project_classes')
      .delete()
      .eq('project_id', savedProjectId)
      .eq('class_id', classId);
    setProjectClasses(prev => prev.filter(pc => pc.class_id !== classId));
  };

  // 교사 초대 (특정 클래스에 배정)
  const handleAssignTeacher = async (teacherId: string, classId: string, teacherName: string) => {
    if (!savedProjectId) return;
    await supabase.from('school_project_classes')
      .update({ teacher_id: teacherId })
      .eq('project_id', savedProjectId)
      .eq('class_id', classId);

    setProjectClasses(prev => prev.map(pc =>
      pc.class_id === classId ? { ...pc, teacher_id: teacherId, teacher_name: teacherName } : pc
    ));
    setInvitingClassId(null);
  };

  // 초대 링크 복사
  const handleCopyInviteLink = (classId: string) => {
    const link = `${window.location.origin}/project-join?project=${savedProjectId}&class=${classId}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(classId);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // 공유 URL 복사
  const handleCopyShareUrl = () => {
    const url = `${window.location.origin}/school-project/${shareToken}`;
    navigator.clipboard.writeText(url);
    setCopiedToken('share');
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const filteredTeachers = schoolTeachers.filter(t =>
    t.full_name?.toLowerCase().includes(inviteSearchQuery.toLowerCase())
  );

  const availableClasses = myClasses.filter(c => !projectClasses.find(pc => pc.class_id === c.id));

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
                <p className="text-sm text-white/70">여러 선생님이 함께하는 협업 수업 관리</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all">
                <X size={18} />
              </button>
            </div>

            {/* 스텝 표시 */}
            <div className="flex border-b border-gray-100 shrink-0">
              {[
                { key: 'info', label: '기본 정보' },
                { key: 'classes', label: '클래스 관리' },
                { key: 'invite', label: '교사 초대' },
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

            {/* 본문 */}
            <div className="overflow-y-auto flex-1 p-8">

              {/* ── STEP 1: 기본 정보 ── */}
              {step === 'info' && (
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">프로젝트 이름 *</label>
                    <input
                      type="text"
                      placeholder="예: 아크고등학교 2학년 수업"
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold border-2 border-transparent focus:border-violet-300 focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">학교 이름</label>
                    <input
                      type="text"
                      placeholder="예: 아크고등학교"
                      value={schoolName}
                      onChange={e => setSchoolName(e.target.value)}
                      className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold border-2 border-transparent focus:border-violet-300 focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">수업 종료일</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold border-2 border-transparent focus:border-violet-300 focus:bg-white outline-none transition-all"
                    />
                    <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                      <CalendarDays size={11} /> 종료일 이후 담당 교사의 쓰기 권한이 자동으로 해제됩니다.
                    </p>
                  </div>

                  <button
                    onClick={handleSaveInfo}
                    disabled={!projectName.trim() || saving}
                    className="w-full py-4 bg-violet-500 hover:bg-violet-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-95"
                  >
                    {saving ? '저장 중...' : <><ChevronRight size={16} /> 다음: 클래스 추가</>}
                  </button>
                </div>
              )}

              {/* ── STEP 2: 클래스 관리 ── */}
              {step === 'classes' && (
                <div className="space-y-6">
                  {/* 클래스 추가 */}
                  <div>
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-3">내 클래스 추가</label>
                    <div className="flex gap-3">
                      <select
                        value={addingClassId}
                        onChange={e => setAddingClassId(e.target.value)}
                        className="flex-1 px-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold border-2 border-transparent focus:border-violet-300 outline-none transition-all"
                      >
                        <option value="">클래스 선택...</option>
                        {availableClasses.map(c => (
                          <option key={c.id} value={c.id}>{c.name} {c.subject && `· ${c.subject}`}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleAddClass}
                        disabled={!addingClassId}
                        className="px-5 py-3 bg-violet-500 text-white rounded-2xl font-black text-sm flex items-center gap-2 disabled:opacity-40 active:scale-95 transition-all"
                      >
                        <Plus size={16} /> 추가
                      </button>
                    </div>
                    {availableClasses.length === 0 && myClasses.length === 0 && (
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <AlertCircle size={11} /> 먼저 학급 페이지에서 클래스를 생성해주세요.
                      </p>
                    )}
                  </div>

                  {/* 프로젝트 클래스 목록 */}
                  <div className="space-y-3">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest">프로젝트 클래스 ({projectClasses.length}개)</p>
                    {projectClasses.length === 0 ? (
                      <div className="text-center py-10 text-gray-300">
                        <FolderOpen size={32} className="mx-auto mb-2" />
                        <p className="text-xs font-bold">추가된 클래스가 없습니다</p>
                      </div>
                    ) : (
                      projectClasses.map(pc => (
                        <div key={pc.class_id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600 shrink-0">
                            <Users size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black truncate">{pc.class_name}</p>
                            <p className="text-xs text-gray-400">
                              {pc.subject && <span>{pc.subject} · </span>}
                              <span className={pc.teacher_name ? 'text-violet-600 font-bold' : 'text-orange-400'}>
                                {pc.teacher_name ? `${pc.teacher_name} 선생님` : '담당 교사 미지정'}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleCopyInviteLink(pc.class_id)}
                              title="초대 링크 복사"
                              className="p-2 rounded-xl bg-white border border-gray-200 hover:border-violet-300 text-gray-400 hover:text-violet-600 transition-all"
                            >
                              {copiedToken === pc.class_id ? <Check size={15} className="text-green-500" /> : <LinkIcon size={15} />}
                            </button>
                            <button
                              onClick={() => setInvitingClassId(invitingClassId === pc.class_id ? null : pc.class_id)}
                              title="교사 지정"
                              className="p-2 rounded-xl bg-white border border-gray-200 hover:border-violet-300 text-gray-400 hover:text-violet-600 transition-all"
                            >
                              <UserPlus size={15} />
                            </button>
                            <button
                              onClick={() => handleRemoveClass(pc.class_id)}
                              className="p-2 rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          {/* 교사 지정 드롭다운 */}
                          <AnimatePresence>
                            {invitingClassId === pc.class_id && (
                              <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="absolute right-20 mt-1 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-10 overflow-hidden"
                              >
                                <div className="p-3 border-b border-gray-100">
                                  <input
                                    type="text"
                                    placeholder="선생님 검색..."
                                    value={inviteSearchQuery}
                                    onChange={e => setInviteSearchQuery(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 rounded-xl text-xs font-bold outline-none"
                                  />
                                </div>
                                <div className="max-h-40 overflow-y-auto">
                                  {filteredTeachers.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-4">같은 학교 선생님이 없습니다</p>
                                  ) : (
                                    filteredTeachers.map(t => (
                                      <button
                                        key={t.id}
                                        onClick={() => handleAssignTeacher(t.id, pc.class_id, t.full_name)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-50 text-left transition-all"
                                      >
                                        <img
                                          src={t.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.full_name)}&background=random`}
                                          alt={t.full_name}
                                          className="w-8 h-8 rounded-full object-cover"
                                        />
                                        <span className="text-sm font-bold">{t.full_name} 선생님</span>
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
                    onClick={() => setStep('invite')}
                    disabled={projectClasses.length === 0}
                    className="w-full py-4 bg-violet-500 hover:bg-violet-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-95"
                  >
                    <ChevronRight size={16} /> 다음: 공유 URL 확인
                  </button>
                </div>
              )}

              {/* ── STEP 3: 공유 URL ── */}
              {step === 'invite' && (
                <div className="space-y-6">
                  <div className="p-6 bg-violet-50 rounded-2xl border border-violet-100 text-center space-y-4">
                    <School size={36} className="mx-auto text-violet-500" />
                    <div>
                      <p className="font-black text-base text-violet-900">{projectName}</p>
                      <p className="text-xs text-violet-500 mt-0.5">{schoolName}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-xs font-mono text-gray-500 break-all border border-violet-100">
                      {window.location.origin}/school-project/{shareToken}
                    </div>
                    <button
                      onClick={handleCopyShareUrl}
                      className="w-full py-3.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      {copiedToken === 'share' ? <><Check size={16} /> 복사 완료!</> : <><Copy size={16} /> 학교 선생님 공유 URL 복사</>}
                    </button>
                    <p className="text-[10px] text-violet-400">이 URL을 학교 담당 선생님께 전달하면 전체 클래스 결과를 한 번에 열람할 수 있습니다.</p>
                  </div>

                  {projectClasses.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-black text-gray-500 uppercase tracking-widest">클래스별 초대 링크</p>
                      {projectClasses.map(pc => (
                        <div key={pc.class_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                          <div>
                            <p className="text-sm font-black">{pc.class_name}</p>
                            <p className="text-xs text-gray-400">{pc.teacher_name ? `${pc.teacher_name} 선생님` : '담당 미지정'}</p>
                          </div>
                          <button
                            onClick={() => handleCopyInviteLink(pc.class_id)}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-violet-300 rounded-xl text-xs font-bold text-gray-600 hover:text-violet-600 transition-all"
                          >
                            {copiedToken === pc.class_id ? <><Check size={13} className="text-green-500" /> 복사됨</> : <><LinkIcon size={13} /> 링크 복사</>}
                          </button>
                        </div>
                      ))}
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
