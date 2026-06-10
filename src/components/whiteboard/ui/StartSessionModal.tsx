import { useState, useEffect, useRef } from 'react';
import { X, Users, Play, Square, Copy, Check, ChevronUp, ChevronDown, Sparkles, RotateCcw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { v4 as uuidv4 } from 'uuid';

interface ClassItem {
  id: string;
  name: string;
  subject?: string;
}

interface ClassGroup {
  id: string;
  name: string;
  sort_order: number;
  memberCount: number;
}

interface SessionBoard {
  id: string;
  group_number: number;
  group_name: string;
  memberCount: number;
}

interface Props {
  onClose: () => void;
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genCode() {
  return Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
}

const GROUP_NAMES = [
  '1조', '2조', '3조', '4조', '5조', '6조', '7조', '8조', '9조', '10조',
  '11조', '12조', '13조', '14조', '15조', '16조', '17조', '18조', '19조', '20조',
];

export default function StartSessionModal({ onClose }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<'config' | 'active'>('config');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [groupCount, setGroupCount] = useState(6);
  const [groupSize, setGroupSize] = useState(5);
  const [starting, setStarting] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [className, setClassName] = useState('');
  const [boards, setBoards] = useState<SessionBoard[]>([]);
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [useClassGroups, setUseClassGroups] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('classes').select('id, name, subject').eq('teacher_id', user.id).order('name')
      .then(({ data }) => setClasses(data || []));
  }, [user]);

  // 클래스 선택 시 class_groups 자동 조회
  useEffect(() => {
    if (!selectedClassId) {
      setClassGroups([]);
      setUseClassGroups(false);
      return;
    }

    const fetchGroups = async () => {
      setLoadingGroups(true);
      const { data: grps } = await supabase
        .from('class_groups')
        .select('id, name, sort_order')
        .eq('class_id', selectedClassId)
        .order('sort_order');

      if (!grps || grps.length === 0) {
        setClassGroups([]);
        setUseClassGroups(false);
        setLoadingGroups(false);
        return;
      }

      const { data: members } = await supabase
        .from('class_group_members')
        .select('group_id, student_id')
        .in('group_id', grps.map(g => g.id));

      const countMap: Record<string, number> = {};
      (members || []).forEach(m => {
        countMap[m.group_id] = (countMap[m.group_id] ?? 0) + 1;
      });

      const enriched: ClassGroup[] = grps.map(g => ({
        id: g.id,
        name: g.name,
        sort_order: g.sort_order,
        memberCount: countMap[g.id] ?? 0,
      }));

      setClassGroups(enriched);
      setGroupCount(enriched.length);
      const maxMembers = Math.max(...enriched.map(g => g.memberCount), 2);
      setGroupSize(maxMembers > 0 ? maxMembers : 5);
      setUseClassGroups(true);
      setLoadingGroups(false);
    };

    fetchGroups();
  }, [selectedClassId]);

  // 참여 인원 폴링 (3초)
  useEffect(() => {
    if (step !== 'active' || boards.length === 0) return;
    const boardIds = boards.map(b => b.id);

    const poll = async () => {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { data } = await supabase
        .from('whiteboard_sessions')
        .select('board_id, user_id')
        .in('board_id', boardIds)
        .gte('last_ping', cutoff);

      if (!data) return;
      const countMap: Record<string, Set<string>> = {};
      data.forEach(s => {
        if (!countMap[s.board_id]) countMap[s.board_id] = new Set();
        countMap[s.board_id].add(s.user_id);
      });
      setBoards(prev => prev.map(b => ({ ...b, memberCount: countMap[b.id]?.size ?? 0 })));
    };

    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, boards.length]);

  const handleStart = async () => {
    if (!user || !selectedClassId) return;
    setStarting(true);

    const cls = classes.find(c => c.id === selectedClassId);
    if (!cls) { setStarting(false); return; }

    // 같은 클래스의 기존 활성 세션 먼저 정리
    const { data: oldSessions } = await supabase
      .from('class_board_sessions')
      .select('id')
      .eq('class_id', selectedClassId)
      .eq('status', 'active');
    if (oldSessions && oldSessions.length > 0) {
      const oldIds = oldSessions.map(s => s.id);
      await Promise.all([
        supabase.from('class_board_sessions').update({ status: 'ended' }).in('id', oldIds),
        supabase.from('whiteboards').update({ is_public: false }).in('session_id', oldIds),
      ]);
    }

    const code = genCode();
    const { data: session, error } = await supabase
      .from('class_board_sessions')
      .insert({
        class_id: selectedClassId,
        class_name: cls.name,
        session_code: code,
        created_by: user.id,
        group_count: groupCount,
        group_size: groupSize,
      })
      .select('id').single();

    if (error || !session) { setStarting(false); return; }

    const boardInserts = Array.from({ length: groupCount }, (_, i) => {
      const groupName = useClassGroups && classGroups[i]
        ? classGroups[i].name
        : (GROUP_NAMES[i] ?? `${i + 1}조`);
      return {
        id: uuidv4(),
        title: groupName,
        template: 'blank',
        group_name: groupName,
        created_by: user.id,
        share_token: uuidv4(),
        is_public: true,
        class_id: selectedClassId,
        session_id: session.id,
        group_number: i + 1,
      };
    });

    await supabase.from('whiteboards').insert(boardInserts);

    setSessionId(session.id);
    setSessionCode(code);
    setClassName(cls.name);
    setBoards(boardInserts.map((b, i) => ({
      id: b.id,
      group_number: i + 1,
      group_name: b.group_name,
      memberCount: 0,
    })));
    setStep('active');
    setStarting(false);
  };

  const handleEnd = async () => {
    if (!sessionId || ending) return;
    setEnding(true);
    await supabase.rpc('end_board_session', { p_session_id: sessionId });
    setEnding(false);
    onClose();
  };

  const handleClose = () => {
    if (step === 'active') {
      handleEnd();
    } else {
      onClose();
    }
  };

  const joinUrl = `${window.location.origin}/wb-join`;

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalStudents = groupCount * groupSize;
  const totalJoined = boards.reduce((s, b) => s + b.memberCount, 0);

  return (
    <div
      onClick={e => e.target === e.currentTarget && handleClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
      }}
    >
      <div style={{
        background: '#111827', borderRadius: 20, width: step === 'active' ? 600 : 480,
        maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
        padding: 28, boxShadow: '0 32px 80px rgba(0,0,0,0.6)', border: '1px solid #1F2937',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: '#1D4ED8', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={18} color="#fff" />
            </div>
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, margin: 0 }}>수업 보드 시작</p>
              {step === 'active' && <p style={{ color: '#60A5FA', fontSize: 12, margin: 0 }}>{className} · {totalJoined}명 참여 중</p>}
            </div>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {step === 'config' ? (
          <>
            {/* 클래스 선택 */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: '#9CA3AF', fontSize: 12, display: 'block', marginBottom: 6 }}>클래스 선택</label>
              {classes.length === 0 ? (
                <p style={{ color: '#6B7280', fontSize: 13, background: '#1F2937', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                  등록된 클래스가 없습니다
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {classes.map(cls => (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClassId(cls.id)}
                      style={{
                        padding: '10px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                        background: selectedClassId === cls.id ? '#1D4ED8' : '#1F2937',
                        border: `1px solid ${selectedClassId === cls.id ? '#3B82F6' : '#374151'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ color: '#fff', fontSize: 14 }}>{cls.name}</span>
                      {cls.subject && <span style={{ color: '#93C5FD', fontSize: 11 }}>{cls.subject}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 클래스 조 자동 불러오기 배너 */}
            {selectedClassId && (
              <div style={{ marginBottom: 16 }}>
                {loadingGroups ? (
                  <div style={{ background: '#1F2937', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#6B7280', fontSize: 12 }}>조 정보 불러오는 중...</span>
                  </div>
                ) : classGroups.length > 0 ? (
                  <div style={{ background: useClassGroups ? '#052e16' : '#1F2937', border: `1px solid ${useClassGroups ? '#166534' : '#374151'}`, borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={13} color={useClassGroups ? '#4ADE80' : '#6B7280'} />
                        <span style={{ color: useClassGroups ? '#4ADE80' : '#9CA3AF', fontSize: 12, fontWeight: 600 }}>
                          {useClassGroups
                            ? `클래스 조 자동 적용 (${classGroups.length}개 조)`
                            : `클래스에 저장된 조 ${classGroups.length}개 발견`}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (useClassGroups) {
                            setUseClassGroups(false);
                            setGroupCount(6);
                            setGroupSize(5);
                          } else {
                            setUseClassGroups(true);
                            setGroupCount(classGroups.length);
                            const maxM = Math.max(...classGroups.map(g => g.memberCount), 2);
                            setGroupSize(maxM > 0 ? maxM : 5);
                          }
                        }}
                        style={{
                          background: useClassGroups ? '#374151' : '#166534',
                          border: 'none', borderRadius: 6, padding: '4px 10px',
                          color: '#fff', fontSize: 11, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        {useClassGroups ? <><RotateCcw size={10} /> 수동으로</> : <><Sparkles size={10} /> 자동 적용</>}
                      </button>
                    </div>
                    {useClassGroups && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                        {classGroups.map(g => (
                          <span key={g.id} style={{ background: '#166534', borderRadius: 4, padding: '2px 8px', color: '#86EFAC', fontSize: 11 }}>
                            {g.name}{g.memberCount > 0 ? ` (${g.memberCount}명)` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* 조 설정 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ color: '#9CA3AF', fontSize: 12, display: 'block', marginBottom: 6 }}>
                  조 수 {useClassGroups && <span style={{ color: '#4ADE80' }}>(자동)</span>}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => { setGroupCount(Math.max(2, groupCount - 1)); if (useClassGroups) setUseClassGroups(false); }}
                    disabled={useClassGroups}
                    style={{ width: 32, height: 32, background: useClassGroups ? '#1F2937' : '#374151', border: 'none', borderRadius: 6, color: useClassGroups ? '#4B5563' : '#fff', cursor: useClassGroups ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ChevronDown size={16} />
                  </button>
                  <span style={{ color: '#fff', fontSize: 20, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>{groupCount}</span>
                  <button
                    onClick={() => { setGroupCount(Math.min(20, groupCount + 1)); if (useClassGroups) setUseClassGroups(false); }}
                    disabled={useClassGroups}
                    style={{ width: 32, height: 32, background: useClassGroups ? '#1F2937' : '#374151', border: 'none', borderRadius: 6, color: useClassGroups ? '#4B5563' : '#fff', cursor: useClassGroups ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <span style={{ color: '#6B7280', fontSize: 12 }}>조 (최대 20)</span>
                </div>
              </div>
              <div>
                <label style={{ color: '#9CA3AF', fontSize: 12, display: 'block', marginBottom: 6 }}>
                  조당 인원 (최대) {useClassGroups && classGroups.some(g => g.memberCount > 0) && <span style={{ color: '#4ADE80' }}>(자동)</span>}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setGroupSize(Math.max(2, groupSize - 1))} style={{ width: 32, height: 32, background: '#374151', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronDown size={16} />
                  </button>
                  <span style={{ color: '#fff', fontSize: 20, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>{groupSize}</span>
                  <button onClick={() => setGroupSize(Math.min(15, groupSize + 1))} style={{ width: 32, height: 32, background: '#374151', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronUp size={16} />
                  </button>
                  <span style={{ color: '#6B7280', fontSize: 12 }}>명</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#1F2937', borderRadius: 8, padding: '10px 14px', marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#9CA3AF', fontSize: 13 }}>총 {groupCount}개 보드 생성 예정</span>
              <span style={{ color: '#60A5FA', fontSize: 13, fontWeight: 600 }}>최대 {totalStudents}명</span>
            </div>

            <button
              onClick={handleStart}
              disabled={starting || !selectedClassId}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                background: selectedClassId ? '#2563EB' : '#374151',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: selectedClassId ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: starting ? 0.7 : 1,
              }}
            >
              <Play size={16} /> {starting ? '생성 중...' : '수업 시작'}
            </button>
          </>
        ) : (
          <>
            {/* 학생 입장 코드 */}
            <div style={{ background: '#0F172A', border: '1px solid #1E3A5F', borderRadius: 14, padding: 20, marginBottom: 20, textAlign: 'center' }}>
              <p style={{ color: '#60A5FA', fontSize: 12, marginBottom: 8 }}>학생들에게 알려주세요</p>
              <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 12 }}>
                {joinUrl} 접속 후 아래 코드 입력
              </p>
              <div style={{ fontSize: 42, fontWeight: 900, color: '#fff', letterSpacing: 8, fontFamily: 'monospace', marginBottom: 12 }}>
                {sessionCode}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button
                  onClick={() => handleCopy(sessionCode)}
                  style={{ background: copied ? '#059669' : '#1E3A5F', border: 'none', borderRadius: 8, padding: '6px 16px', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {copied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> 코드 복사</>}
                </button>
                <button
                  onClick={() => handleCopy(`${joinUrl}?code=${sessionCode}`)}
                  style={{ background: '#1E3A5F', border: 'none', borderRadius: 8, padding: '6px 16px', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Copy size={12} /> 링크 복사
                </button>
              </div>
            </div>

            {/* 조별 보드 현황 */}
            <p style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 10 }}>
              실시간 참여 현황 <span style={{ color: '#60A5FA', fontWeight: 600 }}>{totalJoined}명</span> / 최대 {totalStudents}명
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
              {boards.map(board => {
                const isFull = board.memberCount >= groupSize;
                return (
                  <div
                    key={board.id}
                    style={{
                      background: '#1F2937', borderRadius: 10, padding: '12px 14px',
                      border: `1px solid ${isFull ? '#065F46' : '#374151'}`,
                    }}
                  >
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{board.group_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={11} color={isFull ? '#10B981' : '#6B7280'} />
                      <span style={{ fontSize: 12, color: isFull ? '#10B981' : '#9CA3AF' }}>
                        {board.memberCount}/{groupSize}명
                        {isFull && ' 🔒'}
                      </span>
                    </div>
                    {/* 멤버 도트 */}
                    <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                      {Array.from({ length: groupSize }, (_, i) => (
                        <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < board.memberCount ? '#3B82F6' : '#374151' }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleEnd}
              disabled={ending}
              style={{
                width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #374151',
                background: ending ? '#374151' : 'transparent',
                color: ending ? '#9CA3AF' : '#EF4444', fontSize: 14, fontWeight: 600,
                cursor: ending ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Square size={14} /> {ending ? '종료 중...' : '수업 종료'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
