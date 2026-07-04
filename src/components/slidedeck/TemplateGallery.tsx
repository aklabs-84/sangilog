import { SLIDE_TEMPLATES, instantiateSlide } from './templates';
import SlideStage from './SlideStage';

interface Props {
  onSelect: (templateId: string) => void;
}

export default function TemplateGallery({ onSelect }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
      {SLIDE_TEMPLATES.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          style={{
            textAlign: 'left', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden',
            background: '#fff', cursor: 'pointer', padding: 0,
          }}
        >
          <div style={{ background: t.swatch, pointerEvents: 'none' }}>
            <SlideStage slide={instantiateSlide(t, 'title')} editable={false} />
          </div>
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t.name}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{t.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
