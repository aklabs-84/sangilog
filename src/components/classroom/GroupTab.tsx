import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Shuffle, X, Check, Loader2,
  Users, UserPlus, ChevronDown, Bell,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Student {
  id: string;
  name: string;
  number: string;
}

interface ClassGroup {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

interface GroupTabProps {
  classId: string;
  students: Student[];
  onGroupsChanged?: () => void;
}

const GROUP_COLORS = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#EF4444', '#8B5CF6', '#06B6D4',
];

const GroupTab = ({ classId, students, onGroupsChanged }: GroupTabProps) => {
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  // student_id → group_id
  const [memberMap, setMemberMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // 새 조 추가
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  // 균등 배분
  const [autoCount, setAutoCount] = useState(4);
  const [autoLoading, setAutoLoading] = useState(false);

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // 알림 보내기
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState(false);

  useEffect(() => {
    if (classId) load();
  }, [classId]);

  const load = async () => {
    setLoading(true);
    const [{ data: gData }, { data: mData }] = await Promise.all([
      supabase
        .from('class_groups')
        .select('id, name, color, sort_order')
        .eq('class_id', classId)
        .order('sort_order'),
      supabase
        .from('class_group_members')
        .select('group_id, student_id')
        .in(
          'group_id',
          // 조회 후 필터 — 빈 배열 방지용 더미
          ['__placeholder__']
        ),
    ]);

    const grps: ClassGroup[] = gData || [];
    setGroups(grps);

    if (grps.length > 0) {
      const { data: members } = await supabase
        .from('class_group_members')
        .select('group_id, student_id')
        .in('group_id', grps.map(g => g.id));

      const map: Record<string, string> = {};
      (members || []).forEach(m => { map[m.student_id] = m.group_id; });
      setMemberMap(map);
    } else {
      setMemberMap({});
    }
    setLoading(false);
  };

  const addGroup = async () => {
    const name = newName.trim();
    if (!name) return;
    setAddLoading(true);
    const color = GROUP_COLORS[groups.length % GROUP_COLORS.length];
    const { data, error } = await supabase
      .from('class_groups')
      .insert({ class_id: classId, name, color, sort_order: groups.length })
      .select()
      .single();
    setAddLoading(false);
    if (error) { alert(error.message); return; }
    setGroups(prev => [...prev, data]);
    setNewName('');
    setAdding(false);
    onGroupsChanged?.();
  };

  const deleteGroup = async (groupId: string) => {
    // 멤버들 미배정으로 전환
    const newMap = { ...memberMap };
    Object.keys(newMap).forEach(sid => {
      if (newMap[sid] === groupId) delete newMap[sid];
    });
    setMemberMap(newMap);
    setGroups(prev => prev.filter(g => g.id !== groupId));
    await supabase.from('class_groups').delete().eq('id', groupId);
    setDeleteTarget(null);
    onGroupsChanged?.();
  };

  const assignStudent = async (studentId: string, groupId: string | null) => {
    setSaving(studentId);
    const prevGroupId = memberMap[studentId];

    // 낙관적 업데이트
    setMemberMap(prev => {
      const next = { ...prev };
      if (groupId) next[studentId] = groupId;
      else delete next[studentId];
      return next;
    });

    // 기존 멤버십 삭제
    await supabase
      .from('class_group_members')
      .delete()
      .eq('student_id', studentId)
      .in('group_id', groups.map(g => g.id));

    // 새 조에 추가
    if (groupId) {
      const { error } = await supabase
        .from('class_group_members')
        .insert({ group_id: groupId, student_id: studentId });
      if (error) {
        // 롤백
        setMemberMap(prev => {
          const next = { ...prev };
          if (prevGroupId) next[studentId] = prevGroupId;
          else delete next[studentId];
          return next;
        });
      }
    }
    setSaving(null);
    onGroupsChanged?.();
  };

  const autoAssign = async () => {
    if (groups.length === 0) {
      alert('먼저 조를 만들어주세요.');
      return;
    }
    setAutoLoading(true);

    // 모든 멤버십 삭제
    await supabase
      .from('class_group_members')
      .delete()
      .in('group_id', groups.map(g => g.id));

    // 셔플 후 균등 배분
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const newMap: Record<string, string> = {};
    const inserts: { group_id: string; student_id: string }[] = [];

    shuffled.forEach((student, idx) => {
      const groupIdx = idx % groups.length;
      const gid = groups[groupIdx].id;
      newMap[student.id] = gid;
      inserts.push({ group_id: gid, student_id: student.id });
    });

    if (inserts.length > 0) {
      await supabase.from('class_group_members').insert(inserts);
    }
    setMemberMap(newMap);
    setAutoLoading(false);
    onGroupsChanged?.();
  };

  const clearAll = async () => {
    if (!confirm('모든 조 배정을 초기화하시겠습니까?')) return;
    await supabase
      .from('class_group_members')
      .delete()
      .in('group_id', groups.map(g => g.id));
    setMemberMap({});
    onGroupsChanged?.();
  };

  const sendGroupNotifications = async () => {
    const assignedCount = Object.keys(memberMap).length;
    if (assignedCount === 0) {
      alert('배정된 학생이 없습니다.');
      return;
    }
    setNotifLoading(true);

    // 조별 멤버 이름 미리 계산
    const groupMemberNames: Record<string, string[]> = {};
    groups.forEach(g => {
      const members = students.filter(s => memberMap[s.id] === g.id);
      groupMemberNames[g.id] = members.map(s => s.name);
    });

    // 배정된 학생마다 알림 삽입
    const notifications = Object.entries(memberMap).map(([studentId, groupId]) => {
      const group = groups.find(g => g.id === groupId);
      const names = groupMemberNames[groupId] || [];
      return {
        student_id: studentId,
        class_id: classId,
        type: 'group_assignment',
        title: `📋 조 편성 완료 — ${group?.name ?? ''}`,
        content: `조원: ${names.join(', ')}`,
        is_read: false,
      };
    });

    await supabase.from('student_notifications').insert(notifications);
    setNotifLoading(false);
    setNotifSuccess(true);
    setTimeout(() => setNotifSuccess(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const unassigned = students.filter(s => !memberMap[s.id]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">조 편성</h3>
          <p className="text-xs text-on-surface-variant/60 mt-0.5">
            학생을 각 조에 배정하세요. 배정 결과는 실시간으로 저장됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {groups.length > 0 && (
            <>
              <button
                onClick={clearAll}
                className="px-3 py-2 text-xs font-bold text-neutral-500 hover:text-red-500 border border-neutral-200 hover:border-red-200 rounded-xl transition-colors"
              >
                배정 초기화
              </button>
              <button
                onClick={autoAssign}
                disabled={autoLoading}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-black bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {autoLoading ? <Loader2 size={13} className="animate-spin" /> : <Shuffle size={13} />}
                균등 배분
              </button>
              <button
                onClick={sendGroupNotifications}
                disabled={notifLoading || notifSuccess}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl transition-colors disabled:opacity-60 ${
                  notifSuccess
                    ? 'bg-emerald-500 text-white'
                    : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                }`}
              >
                {notifLoading ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
                {notifSuccess ? '알림 전송 완료!' : '학생에게 알림'}
              </button>
            </>
          )}
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-black bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} />
            조 추가
          </button>
        </div>
      </div>

      {/* 새 조 추가 인라인 폼 */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 p-4 bg-primary/5 border border-primary/20 rounded-2xl"
          >
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="조 이름 (예: 1조, 빨간팀)"
              className="flex-1 px-3 py-2 text-sm font-bold bg-white border border-primary/20 rounded-xl focus:outline-none focus:border-primary"
            />
            <button onClick={addGroup} disabled={addLoading || !newName.trim()} className="px-4 py-2 text-xs font-black bg-primary text-white rounded-xl disabled:opacity-50">
              {addLoading ? <Loader2 size={13} className="animate-spin" /> : '추가'}
            </button>
            <button onClick={() => { setAdding(false); setNewName(''); }} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-xl">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 조가 없을 때 안내 */}
      {groups.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant/40">
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-black text-sm">조가 없습니다</p>
          <p className="text-xs mt-1">위의 "조 추가" 버튼으로 첫 번째 조를 만들어보세요</p>
        </div>
      )}

      {/* 조 카드 그리드 */}
      {groups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {groups.map(group => {
            const members = students.filter(s => memberMap[s.id] === group.id);
            return (
              <motion.div
                key={group.id}
                layout
                className="bg-white border-2 rounded-2xl overflow-hidden shadow-sm"
                style={{ borderColor: group.color + '40' }}
              >
                {/* 조 헤더 */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ backgroundColor: group.color + '18' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                    <span className="font-black text-sm">{group.name}</span>
                    <span className="text-xs font-bold opacity-50">{members.length}명</span>
                  </div>
                  {deleteTarget === group.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => deleteGroup(group.id)} className="px-2 py-1 text-[10px] font-black bg-red-500 text-white rounded-lg">삭제</button>
                      <button onClick={() => setDeleteTarget(null)} className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg"><X size={12} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteTarget(group.id)} className="p-1 text-neutral-300 hover:text-red-400 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* 멤버 목록 */}
                <div className="p-3 space-y-1.5 min-h-[60px]">
                  {members.length === 0 && (
                    <p className="text-center text-[11px] text-neutral-300 py-3">아직 배정된 학생이 없어요</p>
                  )}
                  {members.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-2.5 py-1.5 bg-neutral-50 rounded-xl group">
                      <span className="text-xs font-bold">
                        <span className="text-neutral-400 mr-1.5">{s.number}</span>{s.name}
                      </span>
                      <button
                        onClick={() => assignStudent(s.id, null)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-red-400 transition-all rounded"
                        title="조에서 제거"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 미배정 학생 */}
      {students.length > 0 && (
        <div className="border-t border-neutral-100 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={16} className="text-neutral-400" />
            <span className="text-sm font-black text-neutral-600">미배정</span>
            <span className="text-xs font-bold text-neutral-400">{unassigned.length}명</span>
          </div>

          {unassigned.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold">
              <Check size={16} />
              모든 학생이 조에 배정되었습니다
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {unassigned.map(s => (
                <StudentGroupSelector
                  key={s.id}
                  student={s}
                  groups={groups}
                  saving={saving === s.id}
                  onAssign={(gid) => assignStudent(s.id, gid)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 미배정 학생 카드 — 클릭 시 조 선택 드롭다운
const StudentGroupSelector = ({
  student, groups, saving, onAssign,
}: {
  student: Student;
  groups: ClassGroup[];
  saving: boolean;
  onAssign: (groupId: string) => void;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-1 px-3 py-2.5 bg-white border border-neutral-200 hover:border-primary/40 rounded-xl text-left transition-colors"
      >
        <div className="min-w-0">
          <p className="text-[10px] text-neutral-400">{student.number}</p>
          <p className="text-xs font-black truncate">{student.name}</p>
        </div>
        {saving ? <Loader2 size={12} className="animate-spin text-primary shrink-0" /> : <ChevronDown size={12} className="text-neutral-300 shrink-0" />}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute top-full mt-1 left-0 z-20 min-w-[140px] bg-white border border-neutral-200 rounded-2xl shadow-lg overflow-hidden"
            >
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => { onAssign(g.id); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-neutral-50 text-left"
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                  <span className="text-xs font-bold">{g.name}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GroupTab;
