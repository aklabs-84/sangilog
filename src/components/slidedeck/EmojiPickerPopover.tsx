const EMOJI_LIST = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '🤩', '😎', '🤔', '😅',
  '😭', '😡', '🥳', '😴', '🤯', '🥰', '😇', '🙄', '😱', '🤗',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '✌️', '🤝', '👋', '🤟',
  '❤️', '💛', '💚', '💙', '💜', '🔥', '⭐', '✨', '💯', '🎉',
  '🎊', '🎈', '🏆', '🥇', '📌', '📍', '✅', '❌', '❓', '❗',
  '💡', '📚', '📝', '✏️', '📊', '📈', '🎯', '⏰', '📅', '🔔',
  '🚀', '🌟', '🌈', '☀️', '🌙', '⚡', '🍀', '🌸', '🐶', '🐱',
  '🎵', '🎨', '⚽', '🏀', '🎮', '📱', '💻', '🔑', '🔒', '💰',
];

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPickerPopover({ onSelect, onClose }: Props) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000 }} />
      <div
        style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 2001,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          padding: 10, width: 260, display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}
      >
        {EMOJI_LIST.map(e => (
          <button
            key={e}
            onClick={() => { onSelect(e); onClose(); }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, padding: 4, borderRadius: 6, lineHeight: 1 }}
            onMouseEnter={ev => (ev.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={ev => (ev.currentTarget.style.background = 'none')}
          >
            {e}
          </button>
        ))}
      </div>
    </>
  );
}
