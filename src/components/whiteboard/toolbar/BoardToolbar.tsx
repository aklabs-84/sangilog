import { MousePointer2, StickyNote, Type, Image, Square, ArrowRight, LayoutPanelTop, Trash2 } from 'lucide-react';
import type { ActiveTool } from '../types';

interface Props {
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
}

const TOOLS: { id: ActiveTool; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { id: 'select',  icon: <MousePointer2 size={20} />, label: '선택',      shortcut: 'V' },
  { id: 'sticky',  icon: <StickyNote size={20} />,    label: '포스트잇',  shortcut: 'S' },
  { id: 'text',    icon: <Type size={20} />,           label: '텍스트',   shortcut: 'T' },
  { id: 'image',   icon: <Image size={20} />,          label: '이미지',   shortcut: 'I' },
  { id: 'shape',   icon: <Square size={20} />,         label: '도형',     shortcut: 'R' },
  { id: 'arrow',   icon: <ArrowRight size={20} />,     label: '화살표',   shortcut: 'A' },
  { id: 'section', icon: <LayoutPanelTop size={20} />, label: '구역',     shortcut: 'G' },
];

export default function BoardToolbar({ activeTool, onToolChange, onDeleteSelected, hasSelection }: Props) {
  return (
    <div style={{
      position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
      display: 'flex', flexDirection: 'column', gap: 4, zIndex: 1000,
      background: '#1e1e1e', borderRadius: 12, padding: '8px 6px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      maxHeight: 'calc(100vh - 100px)', overflowY: 'auto',
    }}>
      {TOOLS.map(tool => (
        <button
          key={tool.id}
          title={`${tool.label} (${tool.shortcut})`}
          onClick={() => onToolChange(tool.id)}
          style={{
            width: 40, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: activeTool === tool.id ? '#3B82F6' : 'transparent',
            color: activeTool === tool.id ? '#fff' : '#9CA3AF',
            transition: 'all 0.15s',
          }}
        >
          {tool.icon}
        </button>
      ))}
      {hasSelection && (
        <>
          <div style={{ height: 1, background: '#333', margin: '2px 0' }} />
          <button
            title="삭제 (Del)"
            onClick={onDeleteSelected}
            style={{ width: 40, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: '#EF4444' }}
          >
            <Trash2 size={18} />
          </button>
        </>
      )}
    </div>
  );
}
