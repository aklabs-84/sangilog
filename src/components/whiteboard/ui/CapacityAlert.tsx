import { Users, Eye, X } from 'lucide-react';

interface Props {
  onAcceptViewer: () => void;
  onDecline: () => void;
  maxEditors?: number;
  currentEditors?: number;
}

export default function CapacityAlert({ onAcceptViewer, onDecline, maxEditors, currentEditors }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#1e1e1e', borderRadius: 16,
        padding: '32px 28px', maxWidth: 400, width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        border: '1px solid #333',
      }}>
        {/* 아이콘 */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(234,179,8,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <Users size={24} color="#EAB308" />
        </div>

        <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', margin: 0, marginBottom: 8 }}>
          편집자 정원이 가득 찼어요
        </h3>
        <p style={{ color: '#9CA3AF', fontSize: 13, lineHeight: 1.6, margin: 0, marginBottom: 24 }}>
          {maxEditors
            ? <>이 보드는 현재 {currentEditors ?? maxEditors}명 / 최대 {maxEditors}명이 편집 중입니다.</>
            : <>이 보드의 편집 정원이 가득 찼습니다.</>
          }<br />
          뷰어로 입장하면 내용을 볼 수 있지만 편집은 제한됩니다.
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onAcceptViewer}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              background: '#3B82F6', border: 'none', color: '#fff',
              fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Eye size={15} /> 뷰어로 입장
          </button>
          <button
            onClick={onDecline}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              background: '#374151', border: 'none', color: '#9CA3AF',
              fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <X size={15} /> 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
