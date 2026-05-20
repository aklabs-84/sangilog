import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Trash2, Shuffle, ChevronDown, X,
  Maximize2, Minimize2, Crown, RefreshCw, Check,
  UserPlus, Download
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

interface Student {
  id: string;
  name: string;
  number: string;
}

interface Group {
  id: number;
  name: string;
  members: Student[];
  leader: Student | null;
}

const PRESET_GROUP_NAMES = ['1조', '2조', '3조', '4조', '5조', '6조', '7조', '8조', '9조', '10조'];

const GroupPicker = () => {
  const { user } = useAuth();

  // 학생 목록
  const [students, setStudents] = useState<Student[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [newStudentName, setNewStudentName] = useState('');

  // 클래스 불러오기
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loadingClass, setLoadingClass] = useState(false);
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);

  // 설정
  const [splitMode, setSplitMode] = useState<'groups' | 'members'>('groups');
  const [groupCount, setGroupCount] = useState(4);
  const [memberCount, setMemberCount] = useState(4);
  const [autoLeader, setAutoLeader] = useState(true);

  // 결과
  const [groups, setGroups] = useState<Group[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [revealedGroups, setRevealedGroups] = useState<Set<number>>(new Set());

  // 전체화면 발표 모드
  const [presentMode, setPresentMode] = useState(false);

  useEffect(() => {
    if (user) fetchClasses();
  }, [user]);

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classrooms')
      .select('id, name, class_type')
      .eq('teacher_id', user!.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    if (data) setClasses(data);
  };

  const loadClassStudents = async (classId: string) => {
    setLoadingClass(true);
    setClassDropdownOpen(false);
    const { data } = await supabase
      .from('students')
      .select('id, name, number')
      .eq('classroom_id', classId)
      .eq('is_approved', true)
      .order('number', { ascending: true });
    if (data) {
      const merged = [...students];
      data.forEach((s) => {
        if (!merged.find((m) => m.id === s.id)) merged.push(s);
      });
      setStudents(merged);
    }
    setLoadingClass(false);
  };

  const addManualStudents = () => {
    const lines = manualInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const newStudents: Student[] = lines.map((name, i) => ({
      id: `manual-${Date.now()}-${i}`,
      name,
      number: String(students.length + i + 1),
    }));
    setStudents((prev) => [...prev, ...newStudents]);
    setManualInput('');
  };

  const addSingleStudent = () => {
    if (!newStudentName.trim()) return;
    setStudents((prev) => [
      ...prev,
      { id: `manual-${Date.now()}`, name: newStudentName.trim(), number: String(prev.length + 1) },
    ]);
    setNewStudentName('');
  };

  const removeStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const clearAll = () => {
    setStudents([]);
    setGroups([]);
    setShowResult(false);
    setRevealedGroups(new Set());
  };

  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const pickGroups = useCallback(async () => {
    if (students.length < 2) return;

    setIsPicking(true);
    setShowResult(false);
    setRevealedGroups(new Set());
    setGroups([]);

    await new Promise((r) => setTimeout(r, 2200));

    const shuffled = shuffle(students);
    const numGroups =
      splitMode === 'groups'
        ? groupCount
        : Math.ceil(shuffled.length / memberCount);

    const result: Group[] = Array.from({ length: numGroups }, (_, i) => ({
      id: i,
      name: PRESET_GROUP_NAMES[i] ?? `${i + 1}조`,
      members: [],
      leader: null,
    }));

    shuffled.forEach((student, idx) => {
      result[idx % numGroups].members.push(student);
    });

    if (autoLeader) {
      result.forEach((g) => {
        if (g.members.length > 0) {
          g.leader = g.members[Math.floor(Math.random() * g.members.length)];
        }
      });
    }

    setGroups(result);
    setIsPicking(false);
    setShowResult(true);

    // 조별 순차 공개
    for (let i = 0; i < result.length; i++) {
      await new Promise((r) => setTimeout(r, 400 * i));
      setRevealedGroups((prev) => new Set([...prev, i]));
    }
  }, [students, splitMode, groupCount, memberCount, autoLeader]);

  const reshuffle = () => {
    setShowResult(false);
    setRevealedGroups(new Set());
    setTimeout(pickGroups, 100);
  };

  const numGroups =
    splitMode === 'groups'
      ? groupCount
      : Math.ceil(students.length / Math.max(memberCount, 1));

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black gradient-text">랜덤 조 뽑기</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">학생들을 랜덤으로 조를 나눠 공개합니다</p>
          </div>
          {showResult && (
            <button
              onClick={() => setPresentMode(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-md"
            >
              <Maximize2 size={16} />
              발표 모드
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: 학생 목록 */}
          <div className="glass rounded-2xl p-5 border border-white/40 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-on-surface flex items-center gap-2">
                <Users size={18} className="text-primary" />
                학생 목록
                <span className="ml-1 text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {students.length}명
                </span>
              </h3>
              {students.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-error/60 hover:text-error flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={13} />
                  전체 삭제
                </button>
              )}
            </div>

            {/* 클래스에서 불러오기 */}
            <div className="relative">
              <button
                onClick={() => setClassDropdownOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-white/40 bg-surface-container-low/50 text-sm font-bold hover:border-primary/30 transition-all"
              >
                <span className="text-on-surface-variant">
                  {loadingClass ? '불러오는 중...' : '클래스에서 학생 불러오기'}
                </span>
                <ChevronDown size={16} className={`transition-transform ${classDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {classDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-white/40 z-50 overflow-hidden"
                  >
                    {classes.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-on-surface-variant">클래스가 없습니다</div>
                    ) : (
                      classes.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => loadClassStudents(c.id)}
                          className="w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-primary/5 transition-colors flex items-center gap-2"
                        >
                          <Users size={14} className="text-primary/60" />
                          {c.name}
                          <span className="ml-auto text-[10px] text-on-surface-variant/60 font-normal">
                            {c.class_type === 'homeroom' ? '담임' : '과목'}
                          </span>
                        </button>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 직접 입력 */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-on-surface-variant">직접 입력</p>
              <div className="flex gap-2">
                <input
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSingleStudent()}
                  placeholder="이름 입력 후 Enter"
                  className="flex-1 px-3 py-2 rounded-xl border border-white/40 bg-surface-container-low/50 text-sm font-bold focus:outline-none focus:border-primary/40 transition-all"
                />
                <button
                  onClick={addSingleStudent}
                  className="px-3 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all"
                >
                  <Plus size={16} strokeWidth={3} />
                </button>
              </div>
              <textarea
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder={"여러 명 한번에 입력\n(한 줄에 한 명씩)"}
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-white/40 bg-surface-container-low/50 text-sm resize-none focus:outline-none focus:border-primary/40 transition-all"
              />
              {manualInput.trim() && (
                <button
                  onClick={addManualStudents}
                  className="w-full py-2 bg-primary/10 text-primary rounded-xl text-sm font-bold hover:bg-primary/20 transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus size={15} />
                  추가하기
                </button>
              )}
            </div>

            {/* 학생 목록 */}
            {students.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                <AnimatePresence>
                  {students.map((s) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-container-low/50 group"
                    >
                      <span className="text-sm font-bold text-on-surface">
                        <span className="text-on-surface-variant/50 text-xs mr-1.5">{s.number}</span>
                        {s.name}
                      </span>
                      <button
                        onClick={() => removeStudent(s.id)}
                        className="opacity-0 group-hover:opacity-100 text-error/50 hover:text-error transition-all"
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* RIGHT: 설정 */}
          <div className="glass rounded-2xl p-5 border border-white/40 space-y-5">
            <h3 className="font-black text-on-surface">조 구성 설정</h3>

            {/* 분리 방식 */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-on-surface-variant">분리 방식</p>
              <div className="grid grid-cols-2 gap-2">
                {(['groups', 'members'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSplitMode(mode)}
                    className={`py-2.5 rounded-xl text-sm font-black transition-all border ${
                      splitMode === mode
                        ? 'bg-primary text-white border-primary shadow-md'
                        : 'border-white/40 text-on-surface-variant hover:border-primary/30'
                    }`}
                  >
                    {mode === 'groups' ? '조 개수로 나누기' : '조원 수로 나누기'}
                  </button>
                ))}
              </div>
            </div>

            {/* 슬라이더 */}
            {splitMode === 'groups' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-on-surface-variant">조 개수</p>
                  <span className="text-2xl font-black gradient-text">{groupCount}조</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={Math.max(2, students.length)}
                  value={groupCount}
                  onChange={(e) => setGroupCount(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-on-surface-variant/50">
                  <span>2조</span>
                  <span>{Math.max(2, students.length)}조</span>
                </div>
                {students.length > 0 && (
                  <p className="text-xs text-center text-on-surface-variant">
                    조당 약 <strong>{Math.ceil(students.length / groupCount)}명</strong>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-on-surface-variant">조원 수</p>
                  <span className="text-2xl font-black gradient-text">{memberCount}명</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={Math.max(2, students.length)}
                  value={memberCount}
                  onChange={(e) => setMemberCount(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                {students.length > 0 && (
                  <p className="text-xs text-center text-on-surface-variant">
                    총 <strong>{Math.ceil(students.length / memberCount)}개 조</strong> 구성
                  </p>
                )}
              </div>
            )}

            {/* 조장 자동 지정 */}
            <div
              onClick={() => setAutoLeader((v) => !v)}
              className="flex items-center justify-between p-3 rounded-xl border border-white/40 cursor-pointer hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-2">
                <Crown size={16} className="text-amber-500" />
                <div>
                  <p className="text-sm font-bold">조장 자동 지정</p>
                  <p className="text-[10px] text-on-surface-variant">랜덤으로 조장 1명 자동 선정</p>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${autoLeader ? 'bg-primary justify-end' : 'bg-on-surface/10 justify-start'}`}>
                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>

            {/* 미리보기 */}
            {students.length > 0 && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 text-center">
                <p className="text-xs text-on-surface-variant">
                  <strong className="text-on-surface">{students.length}명</strong>을{' '}
                  <strong className="text-primary">{numGroups}개 조</strong>로 나눕니다
                </p>
              </div>
            )}

            {/* 뽑기 버튼 */}
            <button
              onClick={pickGroups}
              disabled={students.length < 2 || isPicking}
              className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3 ${
                students.length < 2 || isPicking
                  ? 'bg-on-surface/10 text-on-surface-variant cursor-not-allowed'
                  : 'btn-vibrant shadow-lg active:scale-95'
              }`}
            >
              {isPicking ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.5, ease: 'linear' }}
                  >
                    <Shuffle size={22} />
                  </motion.div>
                  조 뽑는 중...
                </>
              ) : (
                <>
                  <Shuffle size={22} />
                  랜덤 조 뽑기!
                </>
              )}
            </button>
          </div>
        </div>

        {/* 뽑기 애니메이션 */}
        <AnimatePresence>
          {isPicking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            >
              <div className="text-center space-y-6">
                <motion.div
                  animate={{ rotate: [0, 15, -15, 10, -10, 5, -5, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  className="text-8xl"
                >
                  🎲
                </motion.div>
                <motion.p
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="text-white text-2xl font-black tracking-tight"
                >
                  조를 뽑는 중...
                </motion.p>
                <div className="flex gap-2 justify-center">
                  {students.slice(0, Math.min(6, students.length)).map((s, i) => (
                    <motion.div
                      key={s.id}
                      animate={{ y: [-8, 8, -8] }}
                      transition={{ duration: 0.6, delay: i * 0.1, repeat: Infinity }}
                      className="px-3 py-1.5 bg-white/20 backdrop-blur rounded-lg text-white text-sm font-bold"
                    >
                      {s.name}
                    </motion.div>
                  ))}
                  {students.length > 6 && (
                    <div className="px-3 py-1.5 bg-white/20 backdrop-blur rounded-lg text-white text-sm font-bold">
                      +{students.length - 6}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 결과 */}
        <AnimatePresence>
          {showResult && groups.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black gradient-text flex items-center gap-2">
                  <Check size={22} className="text-green-500" />
                  조 편성 결과
                </h3>
                <button
                  onClick={reshuffle}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/40 text-sm font-bold hover:border-primary/30 hover:text-primary transition-all"
                >
                  <RefreshCw size={15} />
                  다시 뽑기
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {groups.map((group) => (
                  <AnimatePresence key={group.id}>
                    {revealedGroups.has(group.id) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.7, rotateY: 90 }}
                        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className="glass rounded-2xl p-4 border border-white/40 space-y-3"
                      >
                        <div className="text-center">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring' }}
                            className="text-3xl mb-1"
                          >
                            {['🔵', '🔴', '🟢', '🟡', '🟣', '🟠', '⚫', '⚪'][group.id % 8]}
                          </motion.div>
                          <h4 className="font-black text-on-surface text-lg">{group.name}</h4>
                          <p className="text-xs text-on-surface-variant">{group.members.length}명</p>
                        </div>

                        <div className="space-y-1">
                          {group.members.map((member) => (
                            <div
                              key={member.id}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${
                                group.leader?.id === member.id
                                  ? 'bg-amber-50 border border-amber-200'
                                  : 'bg-surface-container-low/50'
                              }`}
                            >
                              {group.leader?.id === member.id && (
                                <Crown size={12} className="text-amber-500 shrink-0" />
                              )}
                              <span className="font-bold text-on-surface truncate">{member.name}</span>
                              {group.leader?.id === member.id && (
                                <span className="ml-auto text-[9px] text-amber-600 font-black shrink-0">조장</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 발표 모드 */}
      <AnimatePresence>
        {presentMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-auto"
          >
            <div className="min-h-screen p-8 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-black text-white">🎯 조 편성 결과</h1>
                <button
                  onClick={() => setPresentMode(false)}
                  className="p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
                >
                  <Minimize2 size={22} />
                </button>
              </div>

              <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 content-start">
                {groups.map((group) => (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: group.id * 0.1 }}
                    className="bg-white/10 backdrop-blur rounded-3xl p-6 border border-white/20 space-y-4"
                  >
                    <div className="text-center">
                      <div className="text-5xl mb-2">
                        {['🔵', '🔴', '🟢', '🟡', '🟣', '🟠', '⚫', '⚪'][group.id % 8]}
                      </div>
                      <h4 className="font-black text-white text-2xl">{group.name}</h4>
                      <p className="text-white/50 text-sm">{group.members.length}명</p>
                    </div>

                    <div className="space-y-2">
                      {group.members.map((member) => (
                        <div
                          key={member.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
                            group.leader?.id === member.id
                              ? 'bg-amber-500/20 border border-amber-500/40'
                              : 'bg-white/10'
                          }`}
                        >
                          {group.leader?.id === member.id && (
                            <Crown size={14} className="text-amber-400 shrink-0" />
                          )}
                          <span className="font-bold text-white text-base">{member.name}</span>
                          {group.leader?.id === member.id && (
                            <span className="ml-auto text-[10px] text-amber-400 font-black shrink-0">조장</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GroupPicker;
