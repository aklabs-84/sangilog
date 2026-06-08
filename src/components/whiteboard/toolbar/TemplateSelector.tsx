import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { TemplateKey } from '../types';
import { TEMPLATES } from '../types';

interface Props {
  onSelect: (template: TemplateKey) => void;
  onClose: () => void;
}

const TEMPLATE_PREVIEW: Record<TemplateKey, React.ReactNode> = {
  blank: <div style={{ width: '100%', height: '100%', background: '#f9fafb', borderRadius: 4 }} />,
  brainstorm: (
    <div style={{ padding: 4 }}>
      <div style={{ background: '#FFF9C4', borderRadius: 4, height: 56, border: '1px solid #F9A825' }} />
    </div>
  ),
  kwl: (
    <div style={{ display: 'flex', gap: 3, padding: 4, height: '100%' }}>
      {['#E3F2FD','#F3E5F5','#E8F5E9'].map(c => <div key={c} style={{ flex: 1, background: c, borderRadius: 3 }} />)}
    </div>
  ),
  tchart: (
    <div style={{ display: 'flex', gap: 3, padding: 4, height: '100%' }}>
      {['#FFF3E0','#E8F5E9'].map(c => <div key={c} style={{ flex: 1, background: c, borderRadius: 3 }} />)}
    </div>
  ),
  mindmap: (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ background: '#FCE4EC', borderRadius: '50%', width: 36, height: 36, border: '2px solid #E91E63' }} />
    </div>
  ),
  timeline: (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: 4 }}>
      {['#E3F2FD','#F3E5F5','#E8F5E9'].map((c, i) => (
        <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 20, height: 32, background: c, borderRadius: 3 }} />
          {i < 2 && <div style={{ width: 8, height: 2, background: '#ccc' }} />}
        </div>
      ))}
    </div>
  ),
  group: (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, padding: 4, height: '100%' }}>
      {['#FFF9C4','#FCE4EC','#E3F2FD','#E8F5E9','#F3E5F5','#FFF3E0'].map(c => <div key={c} style={{ background: c, borderRadius: 3 }} />)}
    </div>
  ),
};

export default function TemplateSelector({ onSelect, onClose }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ background: '#fff', borderRadius: 16, padding: 28, width: 600, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', margin: 0 }}>보드 템플릿 선택</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {TEMPLATES.map(t => (
            <button
              key={t.key}
              onClick={() => onSelect(t.key)}
              style={{ background: 'none', border: '2px solid #e5e7eb', borderRadius: 10, padding: 0, cursor: 'pointer', overflow: 'hidden', textAlign: 'left', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#3B82F6')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
            >
              <div style={{ height: 72, background: '#f9fafb', overflow: 'hidden' }}>
                {TEMPLATE_PREVIEW[t.key]}
              </div>
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: '#1a1a1a' }}>{t.label}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{t.description}</div>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
