import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, LayoutPanelTop, Trash2, Clock, AlertTriangle, Users, Copy, Check, Link2, Unlink, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { v4 as uuidv4 } from 'uuid';
import StartSessionModal from './ui/StartSessionModal';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genCode() {
  return Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
}
import ClassLinkModal from './ui/ClassLinkModal';

interface BoardMeta {
  id: string;
  title: string;
  template: string;
  group_name?: string;
  updated_at: string;
  snapshot_url?: string;
  class_id?: string;
  class_name?: string;
  is_public: boolean;
}

interface ClassInfo {
  id: string;
  name: string;
}

interface ClassSession {
  code: string;
  id: string;
}

const ALL_TAB = '__all__';
const NO_CLASS_TAB = '__noclass__';

export default function WhiteboardList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [classInfos, setClassInfos] = useState<ClassInfo[]>([]);
  const [classSessions, setClassSessions] = useState<Record<string, ClassSession>>({});
  const [selectedClassId, setSelectedClassId] = useState<string>(ALL_TAB);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState<string | null>(null);
  const [showStartSession, setShowStartSession] = useState(false);
  const [classLinkBoardId, setClassLinkBoardId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadBoards = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from('whiteboards')
      .select('id, title, template, group_name, updated_at, snapshot_url, class_id, is_public')
      .eq('created_by', user.id)
      .order('updated_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    const classIds = [...new Set(data.filter(b => b.class_id).map(b => b.class_id as string))];
    let classMap: Record<string, string> = {};
    let fetchedClasses: ClassInfo[] = [];

    if (classIds.length > 0) {
      const { data: classes } = await supabase
        .from('classes').select('id, name').in('id', classIds);
      if (classes) {
        classMap = Object.fromEntries(classes.map(c => [c.id, c.name]));
        fetchedClasses = classes;
      }

      const { data: sessions } = await supabase
        .from('class_board_sessions')
        .select('id, class_id, session_code')
        .in('class_id', classIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (sessions) {
        const sessionMap: Record<string, ClassSession> = {};
        sessions.forEach(s => {
          if (s.class_id && !sessionMap[s.class_id]) {
            sessionMap[s.class_id] = { code: s.session_code, id: s.id };
          }
        });
        setClassSessions(sessionMap);
      }
    }

    setClassInfos(fetchedClasses);
    setBoards(data.map(b => ({
      ...b,
      is_public: b.is_public ?? false,
      class_name: b.class_id ? classMap[b.class_id] : undefined,
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadBoards(); }, [loadBoards]);

  // 선택된 클래스 탭이 비어지면 전체로 이동
  useEffect(() => {
    if (selectedClassId !== ALL_TAB && selectedClassId !== NO_CLASS_TAB) {
      const hasBoards = boards.some(b => b.class_id === selectedClassId);
      if (!hasBoards) setSelectedClassId(ALL_TAB);
    }
  }, [boards, selectedClassId]);

  const handleCreate = () => navigate(`/whiteboard/${uuidv4()}`);

  const handleDeleteConfirm = async (id: string) => {
    setDeletingId(id);
    await supabase.from('whiteboards').delete().eq('id', id);
    setBoards(prev => prev.filter(b => b.id !== id));
    setConfirmId(null);
    setDeletingId(null);
    setHoveredId(null);
  };

  // 보드 단일 공유 중지 — class_id 유지, is_public=false
  // 클래스 내 공유 중인 보드가 없으면 세션도 ended 처리
  const disconnectBoardClass = async (boardId: string) => {
    setDisconnecting(boardId);
    const board = boards.find(b => b.id === boardId);
    await supabase.from('whiteboards').update({ is_public: false }).eq('id', boardId);

    if (board?.class_id) {
      const remainingPublic = boards.filter(b => b.class_id === board.class_id && b.id !== boardId && b.is_public);
      if (remainingPublic.length === 0) {
        await supabase.from('class_board_sessions')
          .update({ status: 'ended' })
          .eq('class_id', board.class_id)
          .eq('status', 'active');
        setClassSessions(prev => { const next = { ...prev }; delete next[board.class_id!]; return next; });
      }
    }

    setBoards(prev => prev.map(b => b.id === boardId ? { ...b, is_public: false } : b));
    setDisconnecting(null);
  };

  // 보드 단일 공유 시작 — is_public=true, 세션도 재활성화
  const reconnectBoardClass = async (boardId: string) => {
    setDisconnecting(boardId);
    const board = boards.find(b => b.id === boardId);
    await supabase.from('whiteboards').update({ is_public: true }).eq('id', boardId);

    if (board?.class_id) {
      const { data: existing } = await supabase
        .from('class_board_sessions').select('id, status')
        .eq('class_id', board.class_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (existing && existing.status === 'ended') {
        await supabase.from('class_board_sessions')
          .update({ status: 'active', expires_at: new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString() })
          .eq('id', existing.id);
        await loadBoards();
      }
    }

    setBoards(prev => prev.map(b => b.id === boardId ? { ...b, is_public: true } : b));
    setDisconnecting(null);
  };

  // 클래스 전체 공유 중지 — class_id 유지, is_public=false, 세션 ended
  const disconnectAllClassBoards = async (classId: string) => {
    setDisconnecting(`class_${classId}`);
    const ids = boards.filter(b => b.class_id === classId).map(b => b.id);
    if (ids.length > 0) {
      await supabase.from('whiteboards').update({ is_public: false }).in('id', ids);
      await supabase.from('class_board_sessions')
        .update({ status: 'ended' })
        .eq('class_id', classId)
        .eq('status', 'active');
      setBoards(prev => prev.map(b => b.class_id === classId ? { ...b, is_public: false } : b));
      setClassSessions(prev => { const next = { ...prev }; delete next[classId]; return next; });
    }
    setDisconnecting(null);
  };

  // 클래스 전체 공유 시작 — is_public=true, 세션 재활성화
  const reconnectAllClassBoards = async (classId: string) => {
    if (!user) return;
    setReconnecting(classId);
    const ids = boards.filter(b => b.class_id === classId).map(b => b.id);
    if (ids.length > 0) {
      await supabase.from('whiteboards').update({ is_public: true }).in('id', ids);
      const { data: existing } = await supabase
        .from('class_board_sessions').select('id, status')
        .eq('class_id', classId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (existing) {
        await supabase.from('class_board_sessions')
          .update({ status: 'active', expires_at: new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString() })
          .eq('id', existing.id);
      } else {
        const cls = classInfos.find(c => c.id === classId);
        if (cls) {
          await supabase.from('class_board_sessions').insert({
            class_id: classId, class_name: cls.name, session_code: genCode(),
            created_by: user.id, group_count: ids.length, group_size: 30,
            expires_at: new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString(),
          });
        }
      }
      await loadBoards();
    }
    setReconnecting(null);
  };

  // 보드 뷰어 링크 복사 (/sb/{boardId})
  const copyBoardLink = async (boardId: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/sb/${boardId}`);
    setCopiedId(`link_${boardId}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const classesWithBoards = classInfos.filter(c => boards.some(b => b.class_id === c.id));
  const hasNoClassBoards = boards.some(b => !b.class_id);

  const filteredBoards = selectedClassId === ALL_TAB
    ? boards
    : selectedClassId === NO_CLASS_TAB
      ? boards.filter(b => !b.class_id)
      : boards.filter(b => b.class_id === selectedClassId);

  const selectedClass = selectedClassId !== ALL_TAB && selectedClassId !== NO_CLASS_TAB
    ? classInfos.find(c => c.id === selectedClassId)
    : null;

  const selectedSession = selectedClass ? classSessions[selectedClass.id] : null;
  const isDisconnectingAll = selectedClass ? disconnecting === `class_${selectedClass.id}` : false;
  const joinUrl = `${window.location.origin}/wb-join`;

  if (loading) return <div style={{ padding: 24, color: '#6B7280', fontSize: 14 }}>불러오는 중...</div>;

  return (
    <div style={{ padding: '4px 0' }}>
      {/* 조별 보드 만들기 버튼 */}
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setShowStartSession(true)}
        style={{
          width: '100%', marginBottom: 16, padding: '12px 20px',
          background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)',
          border: 'none', borderRadius: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Plus size={16} color="#fff" />
        </div>
        <div style={{ textAlign: 'left' }}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0 }}>조별 보드 만들기</p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, margin: 0 }}>클래스 선택 → 조별 보드 자동 생성 → 클래스 연결로 학생 입장</p>
        </div>
      </motion.button>

      {/* 클래스 탭 */}
      {(classesWithBoards.length > 0 || hasNoClassBoards) && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 2, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedClassId(ALL_TAB)}
            style={{
              padding: '5px 14px', borderRadius: 20,
              border: `1px solid ${selectedClassId === ALL_TAB ? '#2563EB' : '#E5E7EB'}`,
              background: selectedClassId === ALL_TAB ? '#2563EB' : '#F9FAFB',
              color: selectedClassId === ALL_TAB ? '#fff' : '#374151',
              cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            전체
            <span style={{ background: selectedClassId === ALL_TAB ? 'rgba(255,255,255,0.25)' : '#E5E7EB', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>
              {boards.length}
            </span>
          </button>

          {classesWithBoards.map(cls => {
            const count = boards.filter(b => b.class_id === cls.id).length;
            const connectedCount = boards.filter(b => b.class_id === cls.id).length;
            const isActive = selectedClassId === cls.id;
            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id)}
                style={{
                  padding: '5px 14px', borderRadius: 20,
                  border: `1px solid ${isActive ? '#2563EB' : '#E5E7EB'}`,
                  background: isActive ? '#2563EB' : '#F9FAFB',
                  color: isActive ? '#fff' : '#374151',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {cls.name}
                <span style={{ background: isActive ? 'rgba(255,255,255,0.25)' : '#E5E7EB', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>
                  {count}
                </span>
                {connectedCount > 0 && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#86EFAC' : '#22C55E', flexShrink: 0 }} title="학생 입장 가능" />
                )}
              </button>
            );
          })}

          {hasNoClassBoards && (
            <button
              onClick={() => setSelectedClassId(NO_CLASS_TAB)}
              style={{
                padding: '5px 14px', borderRadius: 20,
                border: `1px solid ${selectedClassId === NO_CLASS_TAB ? '#2563EB' : '#E5E7EB'}`,
                background: selectedClassId === NO_CLASS_TAB ? '#2563EB' : '#F9FAFB',
                color: selectedClassId === NO_CLASS_TAB ? '#fff' : '#6B7280',
                cursor: 'pointer', fontSize: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              연결 없음
              <span style={{ background: selectedClassId === NO_CLASS_TAB ? 'rgba(255,255,255,0.25)' : '#E5E7EB', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>
                {boards.filter(b => !b.class_id).length}
              </span>
            </button>
          )}
        </div>
      )}

      {/* 클래스 선택 시 — 학생 입장 정보 + 전체 연결 해제 */}
      {selectedClass && (
        <div style={{
          background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: 12,
          padding: '12px 16px', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            {/* 학생 입장 코드 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#1D4ED8', fontSize: 12, fontWeight: 600 }}>학생 입장 코드</span>
              {selectedSession ? (
                <>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 16, color: '#1e40af', letterSpacing: 2 }}>
                    {selectedSession.code}
                  </span>
                  <button
                    onClick={() => handleCopy(selectedSession.code, `code_${selectedClass.id}`)}
                    style={{ background: copiedId === `code_${selectedClass.id}` ? '#059669' : '#DBEAFE', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', color: copiedId === `code_${selectedClass.id}` ? '#fff' : '#1D4ED8', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    {copiedId === `code_${selectedClass.id}` ? <><Check size={11} /> 복사됨</> : <><Copy size={11} /> 코드 복사</>}
                  </button>
                  <button
                    onClick={() => handleCopy(`${joinUrl}?code=${selectedSession.code}`, `link_${selectedClass.id}`)}
                    style={{ background: copiedId === `link_${selectedClass.id}` ? '#059669' : '#DBEAFE', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', color: copiedId === `link_${selectedClass.id}` ? '#fff' : '#1D4ED8', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    {copiedId === `link_${selectedClass.id}` ? <><Check size={11} /> 복사됨</> : <><ExternalLink size={11} /> 링크 복사</>}
                  </button>
                </>
              ) : (
                <span style={{ color: '#6B7280', fontSize: 12 }}>— 보드를 만들면 코드가 생성됩니다</span>
              )}
            </div>

            {/* 전체 공유 중지 / 공유 시작 */}
            {filteredBoards.length > 0 && (
              selectedSession ? (
                <button
                  onClick={() => disconnectAllClassBoards(selectedClass.id)}
                  disabled={isDisconnectingAll}
                  style={{
                    padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#EF4444',
                    cursor: isDisconnectingAll ? 'default' : 'pointer',
                    opacity: isDisconnectingAll ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Unlink size={11} /> {isDisconnectingAll ? '처리 중...' : '전체 공유 중지'}
                </button>
              ) : (
                <button
                  onClick={() => reconnectAllClassBoards(selectedClass.id)}
                  disabled={reconnecting === selectedClass.id}
                  style={{
                    padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: '1px solid #86EFAC', background: '#F0FDF4', color: '#16A34A',
                    cursor: reconnecting === selectedClass.id ? 'default' : 'pointer',
                    opacity: reconnecting === selectedClass.id ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Link2 size={11} /> {reconnecting === selectedClass.id ? '처리 중...' : '전체 공유 시작'}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* 보드 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>

        {/* 새 보드 만들기 */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCreate}
          style={{
            background: 'none', border: '2px dashed #D1D5DB', borderRadius: 12, cursor: 'pointer',
            height: 148, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 8, color: '#6B7280', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.color = '#3B82F6'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#6B7280'; }}
        >
          <Plus size={28} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>새 보드 만들기</span>
        </motion.button>

        {/* 보드 카드 */}
        <AnimatePresence>
          {filteredBoards.map(board => {
            const isHovered = hoveredId === board.id;
            const isConfirming = confirmId === board.id;
            const isDeleting = deletingId === board.id;
            const isDisconnectingThis = disconnecting === board.id;
            const isConnected = !!board.class_id;
            const isSharing = board.is_public && !!board.class_id && !!classSessions[board.class_id];

            return (
              <motion.div
                key={board.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                onMouseEnter={() => setHoveredId(board.id)}
                onMouseLeave={() => { setHoveredId(null); if (!isDeleting) setConfirmId(null); }}
                onClick={() => !isConfirming && navigate(`/whiteboard/${board.id}`)}
                style={{
                  background: '#fff',
                  border: `1px solid ${isConfirming ? '#FCA5A5' : isHovered ? '#3B82F6' : '#E5E7EB'}`,
                  borderLeft: `3px solid ${isConnected ? '#22C55E' : '#E5E7EB'}`,
                  borderRadius: 12, cursor: isConfirming ? 'default' : 'pointer',
                  height: 148, overflow: 'hidden', position: 'relative',
                  boxShadow: isHovered ? '0 4px 12px rgba(59,130,246,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
                  transition: 'all 0.15s',
                }}
              >
                {/* 썸네일 */}
                <div style={{ height: 86, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {board.snapshot_url
                    ? <img src={board.snapshot_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <LayoutPanelTop size={28} color="#D1D5DB" />
                  }
                </div>

                {/* 메타 정보 */}
                <div style={{ padding: '8px 10px' }}>
                  {/* 타이틀 + 연결 상태 배지 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {board.title}
                    </div>
                    {/* 클래스 연결 상태 배지 */}
                    <span style={{
                      flexShrink: 0, padding: '2px 7px', borderRadius: 10,
                      background: isSharing ? '#DCFCE7' : isConnected ? '#FEF3C7' : '#F3F4F6',
                      color: isSharing ? '#16A34A' : isConnected ? '#B45309' : '#9CA3AF',
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: isSharing ? '#16A34A' : isConnected ? '#F59E0B' : '#D1D5DB' }} />
                      {isSharing ? '입장 가능' : isConnected ? '공유 중지' : '연결 없음'}
                    </span>
                  </div>

                  {/* 날짜 + 태그 */}
                  <div style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                    <Clock size={10} /> {formatDate(board.updated_at)}
                    {board.group_name && (
                      <span style={{ background: '#EFF6FF', color: '#3B82F6', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>
                        {board.group_name}
                      </span>
                    )}
                    {board.class_name && selectedClassId === ALL_TAB && (
                      <span style={{ background: '#EEF2FF', color: '#4338CA', borderRadius: 4, padding: '1px 5px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Users size={8} /> {board.class_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* 호버 시 액션 바 (하단) */}
                {isHovered && !isConfirming && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'rgba(15,23,42,0.88)', borderRadius: '0 0 11px 11px',
                      padding: '5px 8px', display: 'flex', gap: 4, justifyContent: 'flex-end',
                    }}
                  >
                    {/* 뷰어 링크 복사 */}
                    <button
                      onClick={() => copyBoardLink(board.id)}
                      style={{ background: '#334155', border: 'none', borderRadius: 5, padding: '3px 7px', color: '#CBD5E1', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 2 }}
                      title="뷰어 링크 복사"
                    >
                      {copiedId === `link_${board.id}` ? <><Check size={9} color="#4ADE80" /> 복사됨</> : <><Copy size={9} /> 링크</>}
                    </button>

                    {/* 클래스 공유 중지/시작 또는 연결 */}
                    {isConnected ? (
                      board.is_public ? (
                        <button
                          onClick={() => disconnectBoardClass(board.id)}
                          disabled={isDisconnectingThis}
                          style={{ background: '#7C2D12', border: 'none', borderRadius: 5, padding: '3px 7px', color: '#FCA5A5', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 2, opacity: isDisconnectingThis ? 0.6 : 1 }}
                        >
                          <Unlink size={9} /> {isDisconnectingThis ? '...' : '공유 중지'}
                        </button>
                      ) : (
                        <button
                          onClick={() => reconnectBoardClass(board.id)}
                          disabled={isDisconnectingThis}
                          style={{ background: '#14532D', border: 'none', borderRadius: 5, padding: '3px 7px', color: '#86EFAC', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 2, opacity: isDisconnectingThis ? 0.6 : 1 }}
                        >
                          <Link2 size={9} /> {isDisconnectingThis ? '...' : '공유 시작'}
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => setClassLinkBoardId(board.id)}
                        style={{ background: '#1E3A5F', border: 'none', borderRadius: 5, padding: '3px 7px', color: '#93C5FD', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 2 }}
                      >
                        <Link2 size={9} /> 클래스 연결
                      </button>
                    )}

                    {/* 삭제 */}
                    <button
                      onClick={() => setConfirmId(board.id)}
                      style={{ background: 'rgba(239,68,68,0.85)', border: 'none', borderRadius: 5, padding: '3px 7px', color: '#fff', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 2 }}
                    >
                      <Trash2 size={9} /> 삭제
                    </button>
                  </div>
                )}

                {/* 삭제 확인 오버레이 */}
                {isConfirming && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.95)',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 12,
                    }}
                  >
                    <AlertTriangle size={20} color="#EF4444" />
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
                      보드를 삭제할까요?<br />
                      <span style={{ fontWeight: 400, color: '#6B7280' }}>되돌릴 수 없습니다</span>
                    </p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setConfirmId(null)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#374151' }}>취소</button>
                      <button onClick={() => handleDeleteConfirm(board.id)} disabled={isDeleting} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#EF4444', cursor: 'pointer', fontSize: 12, color: '#fff', fontWeight: 600 }}>
                        {isDeleting ? '삭제 중...' : '삭제'}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* 빈 상태 */}
      {filteredBoards.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 13 }}>
          {selectedClassId === NO_CLASS_TAB
            ? '클래스에 연결되지 않은 보드가 없습니다.'
            : selectedClass
              ? `${selectedClass.name} 클래스에 보드가 없습니다. '조별 보드 만들기'로 생성해보세요.`
              : '아직 만든 보드가 없습니다.'}
        </div>
      )}

      {showStartSession && (
        <StartSessionModal
          onClose={() => setShowStartSession(false)}
          onCreated={() => loadBoards()}
        />
      )}

      {/* 클래스 연결 모달 (목록에서 연결 없는 보드에 연결 시) */}
      {classLinkBoardId && (
        <ClassLinkModal
          boardId={classLinkBoardId}
          currentClassId={boards.find(b => b.id === classLinkBoardId)?.class_id}
          onClose={() => setClassLinkBoardId(null)}
          onLinked={() => {
            setClassLinkBoardId(null);
            loadBoards();
          }}
        />
      )}
    </div>
  );
}
