import type { SessionMember } from '../types';

interface Props {
  members: SessionMember[];
  currentUserId: string;
}

export default function MembersBar({ members, currentUserId }: Props) {
  const MAX_SHOW = 4;
  const shown = members.slice(0, MAX_SHOW);
  const extra = members.length - MAX_SHOW;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {shown.map((m, i) => (
        <div
          key={m.userId}
          title={m.userId === currentUserId ? `${m.displayName} (나)` : m.displayName}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: m.avatarColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 'bold', color: '#fff',
            border: m.userId === currentUserId ? '2px solid #fff' : '2px solid #1e1e1e',
            marginLeft: i > 0 ? -6 : 0,
            zIndex: MAX_SHOW - i,
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {m.displayName[0].toUpperCase()}
        </div>
      ))}
      {extra > 0 && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: '#374151',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: '#9CA3AF',
          border: '2px solid #1e1e1e',
          marginLeft: -6,
          flexShrink: 0,
        }}>
          +{extra}
        </div>
      )}
      {members.length > 1 && (
        <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 4, whiteSpace: 'nowrap' }}>
          {members.length}명 접속 중
        </span>
      )}
    </div>
  );
}
