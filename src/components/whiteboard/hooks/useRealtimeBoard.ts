import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import type { BoardObject, SessionMember, ConnectionStatus, RemoteCursor } from '../types';

const AVATAR_COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4'];
const MAX_EDITORS = 5;
const HEARTBEAT_MS = 15_000;
const CURSOR_FADE_MS = 5_000;
const POLLING_MS = 3_000;
const CURSOR_THROTTLE_MS = 50;

function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getDisplayName(user: { email?: string; id: string; displayName?: string }): string {
  if (user.displayName) return user.displayName.slice(0, 10);
  if (user.email) return user.email.split('@')[0].slice(0, 8);
  return `사용자${user.id.slice(0, 4)}`;
}

export interface UseRealtimeBoardReturn {
  members: SessionMember[];
  connectionStatus: ConnectionStatus;
  remoteCursors: Record<string, RemoteCursor>;
  isViewer: boolean;
  showCapacityAlert: boolean;
  onAcceptViewer: () => void;
  onDeclineViewer: () => void;
  emitObjectCreated: (obj: BoardObject) => void;
  emitObjectUpdated: (id: string, changes: Partial<BoardObject>) => void;
  emitObjectDeleted: (id: string) => void;
  emitCursorMove: (canvasX: number, canvasY: number) => void;
}

export function useRealtimeBoard(
  boardId: string,
  user: { id: string; email?: string; displayName?: string },
  onRemoteChange: (event: 'created' | 'updated' | 'deleted', data: unknown) => void,
  onPollSync: (objects: BoardObject[]) => void,
): UseRealtimeBoardReturn {
  const [members, setMembers] = useState<SessionMember[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [showCapacityAlert, setShowCapacityAlert] = useState(false);
  const [isViewer, setIsViewer] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cursorTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const sessionIdRef = useRef<string | null>(null);
  const isViewerRef = useRef(false);
  const lastCursorEmit = useRef(0);

  const avatarColor = getAvatarColor(user.id);
  const displayName = getDisplayName(user);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    setConnectionStatus('polling');
    pollingRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('board_objects').select('*').eq('board_id', boardId).order('z_index');
      if (data) onPollSync(data as BoardObject[]);
    }, POLLING_MS);
  }, [boardId, onPollSync]);

  const registerSession = useCallback(async () => {
    const { data } = await supabase
      .from('whiteboard_sessions')
      .insert({ board_id: boardId, user_id: user.id, display_name: displayName, avatar_color: avatarColor })
      .select('id').single();
    if (data) sessionIdRef.current = data.id;
  }, [boardId, user.id, displayName, avatarColor]);

  const removeSession = useCallback(async () => {
    if (!sessionIdRef.current) return;
    await supabase.from('whiteboard_sessions').delete().eq('id', sessionIdRef.current);
    sessionIdRef.current = null;
  }, []);

  const fetchMembers = useCallback(async () => {
    const cutoff = new Date(Date.now() - 30_000).toISOString();
    const { data } = await supabase
      .from('whiteboard_sessions').select('user_id, display_name, avatar_color, last_ping')
      .eq('board_id', boardId).gte('last_ping', cutoff);
    if (!data) return;
    const map = new Map<string, SessionMember>();
    for (const s of data) {
      map.set(s.user_id, {
        userId: s.user_id,
        displayName: s.display_name ?? s.user_id.slice(0, 6),
        avatarColor: s.avatar_color ?? '#6B7280',
        lastPing: s.last_ping,
      });
    }
    setMembers(Array.from(map.values()));
  }, [boardId]);

  // Subscribe to Realtime channel (viewer or editor)
  const subscribe = useCallback((asViewer: boolean) => {
    const channel = supabase.channel(`board:${boardId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'object:created' }, ({ payload }) => {
        if ((payload as { userId?: string }).userId === user.id) return;
        onRemoteChange('created', payload);
      })
      .on('broadcast', { event: 'object:updated' }, ({ payload }) => {
        if ((payload as { userId?: string }).userId === user.id) return;
        onRemoteChange('updated', payload);
      })
      .on('broadcast', { event: 'object:deleted' }, ({ payload }) => {
        if ((payload as { userId?: string }).userId === user.id) return;
        onRemoteChange('deleted', payload);
      })
      .on('broadcast', { event: 'cursor:move' }, ({ payload }) => {
        const p = payload as { userId: string; canvasX: number; canvasY: number; displayName: string; avatarColor: string };
        if (p.userId === user.id) return;
        setRemoteCursors(prev => ({
          ...prev,
          [p.userId]: { ...p, lastSeen: Date.now() },
        }));
        if (cursorTimers.current[p.userId]) clearTimeout(cursorTimers.current[p.userId]);
        cursorTimers.current[p.userId] = setTimeout(() => {
          setRemoteCursors(prev => { const n = { ...prev }; delete n[p.userId]; return n; });
        }, CURSOR_FADE_MS);
      })
      .on('broadcast', { event: 'member:join' }, ({ payload }) => {
        const p = payload as SessionMember;
        setMembers(prev => [...prev.filter(m => m.userId !== p.userId), { ...p, lastPing: new Date().toISOString() }]);
      })
      .on('broadcast', { event: 'member:leave' }, ({ payload }) => {
        const p = payload as { userId: string };
        setMembers(prev => prev.filter(m => m.userId !== p.userId));
        setRemoteCursors(prev => { const n = { ...prev }; delete n[p.userId]; return n; });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          stopPolling();
          setConnectionStatus('connected');
          await fetchMembers();
          if (!asViewer) {
            channel.send({ type: 'broadcast', event: 'member:join',
              payload: { userId: user.id, displayName, avatarColor, lastPing: new Date().toISOString() } });
            heartbeatRef.current = setInterval(async () => {
              if (sessionIdRef.current) {
                await supabase.from('whiteboard_sessions')
                  .update({ last_ping: new Date().toISOString() }).eq('id', sessionIdRef.current);
              }
            }, HEARTBEAT_MS);
          }
        } else if (['CLOSED', 'CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
          setConnectionStatus('polling');
          startPolling();
          if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
          // 30초 후 재연결 시도
          setTimeout(() => {
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
            subscribe(asViewer);
          }, 30_000);
        }
      });

    channelRef.current = channel;
  }, [boardId, user.id, displayName, avatarColor, fetchMembers, onRemoteChange, startPolling, stopPolling]);

  // Initial connect: check capacity → register session → subscribe
  const connect = useCallback(async () => {
    const cutoff = new Date(Date.now() - 30_000).toISOString();
    const { data } = await supabase
      .from('whiteboard_sessions').select('user_id')
      .eq('board_id', boardId).neq('user_id', user.id).gte('last_ping', cutoff);

    const uniqueEditors = new Set((data ?? []).map((s: { user_id: string }) => s.user_id)).size;
    if (uniqueEditors >= MAX_EDITORS) {
      setShowCapacityAlert(true);
      // Connect as viewer immediately so they can see board while deciding
      subscribe(true);
      return;
    }

    await registerSession();
    subscribe(false);
  }, [boardId, user.id, registerSession, subscribe]);

  useEffect(() => {
    // boardId가 '__none__'이면 보드가 아직 준비 안 됨 → 연결 안 함
    if (!boardId || boardId === '__none__') {
      setConnectionStatus('connecting');
      return;
    }
    connect();
    return () => {
      // Announce leave
      channelRef.current?.send({ type: 'broadcast', event: 'member:leave', payload: { userId: user.id } });
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      stopPolling();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      Object.values(cursorTimers.current).forEach(clearTimeout);
      removeSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // Capacity alert handlers
  const onAcceptViewer = useCallback(() => {
    setShowCapacityAlert(false);
    setIsViewer(true);
    isViewerRef.current = true;
  }, []);

  const onDeclineViewer = useCallback(() => {
    setShowCapacityAlert(false);
    // Parent handles navigation
  }, []);

  // Emit helpers
  const emitObjectCreated = useCallback((obj: BoardObject) => {
    if (isViewerRef.current) return;
    channelRef.current?.send({ type: 'broadcast', event: 'object:created', payload: { userId: user.id, object: obj } });
  }, [user.id]);

  const emitObjectUpdated = useCallback((id: string, changes: Partial<BoardObject>) => {
    if (isViewerRef.current) return;
    channelRef.current?.send({ type: 'broadcast', event: 'object:updated', payload: { userId: user.id, id, changes } });
  }, [user.id]);

  const emitObjectDeleted = useCallback((id: string) => {
    if (isViewerRef.current) return;
    channelRef.current?.send({ type: 'broadcast', event: 'object:deleted', payload: { userId: user.id, id } });
  }, [user.id]);

  const emitCursorMove = useCallback((canvasX: number, canvasY: number) => {
    const now = Date.now();
    if (now - lastCursorEmit.current < CURSOR_THROTTLE_MS) return;
    lastCursorEmit.current = now;
    channelRef.current?.send({
      type: 'broadcast', event: 'cursor:move',
      payload: { userId: user.id, canvasX, canvasY, displayName, avatarColor },
    });
  }, [user.id, displayName, avatarColor]);

  return {
    members, connectionStatus, remoteCursors,
    isViewer, showCapacityAlert,
    onAcceptViewer, onDeclineViewer,
    emitObjectCreated, emitObjectUpdated, emitObjectDeleted, emitCursorMove,
  };
}
