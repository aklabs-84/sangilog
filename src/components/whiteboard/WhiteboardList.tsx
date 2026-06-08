import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, LayoutPanelTop, Trash2, Clock, AlertTriangle, Users, Play, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { v4 as uuidv4 } from 'uuid';
import StartSessionModal from './ui/StartSessionModal';

interface BoardMeta {
  id: string;
  title: string;
  template: string;
  group_name?: string;
  updated_at: string;
  snapshot_url?: string;
  class_id?: string;
  class_name?: string;
}

export default function WhiteboardList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showStartSession, setShowStartSession] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('whiteboards')
        .select('id, title, template, group_name, updated_at, snapshot_url, class_id')
        .eq('created_by', user.id)
        .order('updated_at', { ascending: false });

      if (!data) { setLoading(false); return; }

      // 연결된 클래스명 조회
      const classIds = [...new Set(data.filter(b => b.class_id).map(b => b.class_id as string))];
      let classMap: Record<string, string> = {};
      if (classIds.length > 0) {
        const { data: classes } = await supabase
          .from('classes').select('id, name').in('id', classIds);
        if (classes) classMap = Object.fromEntries(classes.map(c => [c.id, c.name]));
      }

      setBoards(data.map(b => ({ ...b, class_name: b.class_id ? classMap[b.class_id] : undefined })));
      setLoading(false);
    })();
  }, [user]);

  const handleCreate = () => navigate(`/whiteboard/${uuidv4()}`);

  const handleDeleteConfirm = async (id: string) => {
    setDeletingId(id);
    await supabase.from('whiteboards').delete().eq('id', id);
    setBoards(prev => prev.filter(b => b.id !== id));
    setConfirmId(null);
    setDeletingId(null);
    setHoveredId(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) return <div style={{ padding: 24, color: '#6B7280', fontSize: 14 }}>불러오는 중...</div>;

  return (
    <div style={{ padding: '4px 0' }}>
      {/* 수업 시작 배너 */}
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setShowStartSession(true)}
        style={{
          width: '100%', marginBottom: 14, padding: '14px 20px',
          background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)',
          border: 'none', borderRadius: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Play size={18} color="#fff" />
        </div>
        <div style={{ textAlign: 'left' }}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0 }}>수업 보드 시작</p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, margin: 0 }}>클래스 선택 → 조별 보드 자동 생성 → 학생 실시간 참여</p>
        </div>
        <ArrowRight style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.7)', flexShrink: 0 }} size={18} />
      </motion.button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>

        {/* 새 보드 만들기 */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCreate}
          style={{
            background: 'none', border: '2px dashed #D1D5DB', borderRadius: 12, cursor: 'pointer',
            height: 140, display: 'flex', flexDirection: 'column', alignItems: 'center',
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
          {boards.map(board => {
            const isHovered = hoveredId === board.id;
            const isConfirming = confirmId === board.id;
            const isDeleting = deletingId === board.id;

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
                  borderRadius: 12, cursor: isConfirming ? 'default' : 'pointer',
                  height: 140, overflow: 'hidden', position: 'relative',
                  boxShadow: isHovered ? '0 4px 12px rgba(59,130,246,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
                  transition: 'all 0.15s',
                }}
              >
                {/* 썸네일 */}
                <div style={{ height: 88, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {board.snapshot_url
                    ? <img src={board.snapshot_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <LayoutPanelTop size={28} color="#D1D5DB" />
                  }
                </div>

                {/* 메타 정보 */}
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {board.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2, flexWrap: 'wrap' }}>
                    <Clock size={10} /> {formatDate(board.updated_at)}
                    {board.group_name && (
                      <span style={{ marginLeft: 4, background: '#EFF6FF', color: '#3B82F6', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>
                        {board.group_name}
                      </span>
                    )}
                    {board.class_name && (
                      <span style={{ marginLeft: 4, background: '#EEF2FF', color: '#4338CA', borderRadius: 4, padding: '1px 5px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Users size={8} /> {board.class_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* 삭제 버튼 (hover 시 표시) */}
                {isHovered && !isConfirming && (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmId(board.id); }}
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: 6,
                      color: '#fff', cursor: 'pointer', padding: '4px 6px',
                      display: 'flex', alignItems: 'center', gap: 3, fontSize: 11,
                    }}
                  >
                    <Trash2 size={12} /> 삭제
                  </button>
                )}

                {/* 삭제 확인 오버레이 */}
                {isConfirming && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(255,255,255,0.95)',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 10,
                      borderRadius: 12,
                    }}
                  >
                    <AlertTriangle size={20} color="#EF4444" />
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
                      보드를 삭제할까요?<br />
                      <span style={{ fontWeight: 400, color: '#6B7280' }}>되돌릴 수 없습니다</span>
                    </p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setConfirmId(null)}
                        style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#374151' }}
                      >
                        취소
                      </button>
                      <button
                        onClick={() => handleDeleteConfirm(board.id)}
                        disabled={isDeleting}
                        style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#EF4444', cursor: 'pointer', fontSize: 12, color: '#fff', fontWeight: 600 }}
                      >
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

      {showStartSession && (
        <StartSessionModal onClose={() => setShowStartSession(false)} />
      )}
    </div>
  );
}
