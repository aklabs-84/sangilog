import { Wifi, WifiOff, Radio, Loader } from 'lucide-react';
import type { ConnectionStatus as StatusType } from '../types';

interface Props { status: StatusType }

export default function ConnectionStatus({ status }: Props) {
  const config = {
    connecting:    { icon: <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />, label: '연결 중...', color: '#6B7280' },
    connected:     { icon: <Wifi size={13} />,    label: '실시간 연결', color: '#10B981' },
    polling:       { icon: <Radio size={13} />,   label: '동기화 중',  color: '#F59E0B' },
    disconnected:  { icon: <WifiOff size={13} />, label: '연결 끊김',  color: '#6B7280' },
  }[status];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 11, color: config.color,
    }}>
      {config.icon}
      <span>{config.label}</span>
      {status === 'connected' && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#10B981',
          animation: 'pulse 2s infinite',
          display: 'inline-block',
        }} />
      )}
    </div>
  );
}
