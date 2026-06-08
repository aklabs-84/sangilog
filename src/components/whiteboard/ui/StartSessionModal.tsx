import { useState, useEffect, useRef } from 'react';
import { X, Users, Play, Square, Copy, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { v4 as uuidv4 } from 'uuid';

interface ClassItem {
  id: string;
  name: string;
  subject?: string;
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

const GROUP_NAMES = ['1조', '2조', '3조', '4조', '5조', '6조', '7조', '8조', '9조', '10조'];

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
  const [confirmEnd, setConfirmEnd] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('classes').select('id, name, subject').eq('teacher_id', user.id).order('name')
      .then(({ data }) => setClasses(data || []));
  }, [user]);

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

    // 조별 보드 N개 생성
    const boardInserts = Array.from({ length: groupCount }, (_, i) => ({
      id: uuidv4(),
      title: GROUP_NAMES[i] ?? `${i + 1}조`,
      template: 'blank',
      group_name: GROUP_NAMES[i] ?? `${i + 1}조`,
      created_by: user.id,
      share_token: uuidv4(),
      is_public: true,
      class_id: selectedClassId,
      session_id: session.id,
      group_number: i + 1,
    }));

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
    if (!sessionId) return;
    // 세션 종료 + 연결된 보드 비공개 처리 (동시 실행)
    await Promise.all([
      supabase.from('class_board_sessions').update({ status: 'ended' }).eq('id', sessionId),
      supabase.from('whiteboards').update({ is_public: false }).eq('session_id', sessionId),
    ]);
    onClose();
  };

  // active 상태에서 닫기 시도 → 세션 종료 처리
  const handleClose = () => {
    if (step === 'active') {
      setConfirmEnd(true);
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

            {/* 조 설정 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ color: '#9CA3AF', fontSize: 12, display: 'block', marginBottom: 6 }}>조 수</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setGroupCount(Math.max(2, groupCount - 1))} style={{ width: 32, height: 32, background: '#374151', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronDown size={16} />
                  </button>
                  <span style={{ color: '#fff', fontSize: 20, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>{groupCount}</span>
                  <button onClick={() => setGroupCount(Math.min(10, groupCount + 1))} style={{ width: 32, height: 32, background: '#374151', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronUp size={16} />
                  </button>
                  <span style={{ color: '#6B7280', fontSize: 12 }}>조</span>
                </div>
              </div>
              <div>
                <label style={{ color: '#9CA3AF', fontSize: 12, display: 'block', marginBottom: 6 }}>조당 인원 (최대)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setGroupSize(Math.max(2, groupSize - 1))} style={{ width: 32, height: 32, background: '#374151', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronDown size={16} />
                  </button>
                  <span style={{ color: '#fff', fontSize: 20, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>{groupSize}</span>
                  <button onClick={() => setGroupSize(Math.min(10, groupSize + 1))} style={{ width: 32, height: 32, background: '#374151', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

            {confirmEnd ? (
              <div style={{ background: '#1F2937', border: '1px solid #EF4444', borderRadius: 10, padding: '14px 16px' }}>
                <p style={{ color: '#F87171', fontSize: 13, fontWeight: 600, margin: '0 0 12px', textAlign: 'center' }}>
                  수업을 종료하면 학생들이 더 이상 입장할 수 없습니다.<br />
                  <span style={{ color: '#9CA3AF', fontWeight: 400 }}>작업한 보드 내용은 목록에서 계속 확인할 수 있습니다.</span>
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setConfirmEnd(false)}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #374151', background: 'transparent', color: '#9CA3AF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    계속하기
                  </button>
                  <button
                    onClick={handleEnd}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Square size={13} /> 수업 종료
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmEnd(true)}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #374151',
                  background: 'transparent', color: '#EF4444', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Square size={14} /> 수업 종료
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
