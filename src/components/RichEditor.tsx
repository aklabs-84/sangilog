import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import LinkExtension from '@tiptap/extension-link';
import ImageExtension from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, List, ListOrdered, Quote, Code, Code2,
  Link2, ImageIcon, Minus, Loader2,
} from 'lucide-react';

interface RichEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  uploading?: boolean;
  minHeight?: string;
}

const RichEditor = ({ value, onChange, onUploadImage, uploading, minHeight = '440px' }: RichEditorProps) => {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMarkdownRef = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: '-',
        transformPastedText: true,
        transformCopiedText: false,
      }),
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension,
      Placeholder.configure({
        placeholder: '내용을 입력하세요...\n\n# 제목은 #으로 시작\n- 목록은 - 로 시작\n--- 로 슬라이드를 구분하세요',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (editor.storage as any).markdown.getMarkdown();
      lastMarkdownRef.current = md;
      onChange(md);
    },
    editorProps: {
      attributes: {
        class: 'rich-editor-content outline-none',
      },
    },
  });

  // 외부 value가 변경될 때 (다른 자료 편집 등) 에디터 내용 갱신
  useEffect(() => {
    if (!editor) return;
    if (value !== lastMarkdownRef.current) {
      editor.commands.setContent(value);
      lastMarkdownRef.current = value;
    }
  }, [value, editor]);

  const handleInsertLink = () => {
    if (!editor || !linkUrl.trim()) return;
    editor
      .chain()
      .focus()
      .setLink({ href: linkUrl.trim() })
      .insertContent(linkText.trim() || linkUrl.trim())
      .run();
    setLinkDialogOpen(false);
    setLinkText('');
    setLinkUrl('');
  };

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { alert('이미지 파일만 업로드 가능합니다.'); return; }
    if (!onUploadImage) return;
    try {
      const url = await onUploadImage(file);
      editor?.chain().focus().setImage({ src: url, alt: file.name.split('.')[0] }).run();
    } catch {
      alert('이미지 업로드에 실패했습니다.');
    }
  };

  if (!editor) return null;

  const isActive = (name: string, attrs?: object) => editor.isActive(name, attrs);

  const btnCls = (active: boolean) =>
    `p-1.5 rounded-lg transition-colors ${
      active
        ? 'bg-primary/10 text-primary'
        : 'text-on-surface-variant hover:bg-surface-container hover:text-primary'
    }`;

  const textBtnCls = (active: boolean) =>
    `px-2 py-1 rounded-lg text-xs font-black transition-colors ${
      active
        ? 'bg-primary text-white'
        : 'text-on-surface-variant hover:bg-surface-container hover:text-primary'
    }`;

  const sep = <div className="w-px h-4 bg-surface-container mx-1" />;

  return (
    <div className="relative">
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-0.5 px-4 py-2 border-b border-surface-container bg-surface-container-low/30">
        <button onClick={() => editor.chain().focus().toggleBold().run()} title="굵게" className={btnCls(isActive('bold'))}>
          <Bold size={15} />
        </button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} title="기울임" className={btnCls(isActive('italic'))}>
          <Italic size={15} />
        </button>
        {sep}
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="제목 1" className={textBtnCls(isActive('heading', { level: 1 }))}>H1</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="제목 2" className={textBtnCls(isActive('heading', { level: 2 }))}>H2</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="제목 3" className={textBtnCls(isActive('heading', { level: 3 }))}>H3</button>
        {sep}
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} title="글머리 목록" className={btnCls(isActive('bulletList'))}>
          <List size={15} />
        </button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()} title="번호 목록" className={btnCls(isActive('orderedList'))}>
          <ListOrdered size={15} />
        </button>
        <button onClick={() => editor.chain().focus().toggleBlockquote().run()} title="인용구" className={btnCls(isActive('blockquote'))}>
          <Quote size={15} />
        </button>
        <button onClick={() => editor.chain().focus().toggleCode().run()} title="인라인 코드" className={btnCls(isActive('code'))}>
          <Code size={15} />
        </button>
        <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="코드 블록" className={btnCls(isActive('codeBlock'))}>
          <Code2 size={15} />
        </button>
        {sep}
        <button onClick={() => editor.chain().focus().setHorizontalRule().run()} title="구분선 (슬라이드 구분)" className={btnCls(false)}>
          <Minus size={15} />
        </button>
        <button onClick={() => setLinkDialogOpen(true)} title="링크 삽입" className={btnCls(isActive('link'))}>
          <Link2 size={15} />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          title={uploading ? '업로드 중...' : '이미지 삽입 / 드래그앤드롭'}
          disabled={uploading}
          className={btnCls(false) + ' disabled:opacity-50'}
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { handleImageFile(f); e.target.value = ''; } }}
        />
        <span className="ml-auto text-[10px] text-on-surface-variant font-bold opacity-60">이미지 드래그앤드롭 가능</span>
      </div>

      {/* 에디터 본문 */}
      <div
        style={{ minHeight }}
        className={`relative transition-colors cursor-text ${isDragging ? 'bg-primary/5 ring-2 ring-primary ring-inset' : ''}`}
        onClick={() => editor.commands.focus()}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={async e => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) await handleImageFile(file);
        }}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="bg-primary/10 rounded-2xl px-8 py-5 font-black text-primary text-sm border-2 border-dashed border-primary">
              📷 이미지를 여기에 놓으세요
            </div>
          </div>
        )}
        <EditorContent editor={editor} className="p-6" />
      </div>

      {/* 링크 삽입 다이얼로그 */}
      {linkDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-3xl p-6 shadow-2xl w-80 space-y-4">
            <h3 className="font-black text-base">🔗 링크 삽입</h3>
            <div className="space-y-2">
              <input
                type="text"
                value={linkText}
                onChange={e => setLinkText(e.target.value)}
                placeholder="표시할 텍스트 (선택)"
                className="w-full px-4 py-2.5 bg-surface-container rounded-xl text-sm font-bold focus:outline-none"
                autoFocus
              />
              <input
                type="url"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2.5 bg-surface-container rounded-xl text-sm font-bold focus:outline-none"
                onKeyDown={e => e.key === 'Enter' && handleInsertLink()}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setLinkDialogOpen(false); setLinkText(''); setLinkUrl(''); }}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleInsertLink}
                className="flex-1 py-2.5 btn-gradient rounded-xl font-black text-sm text-white"
              >
                삽입
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RichEditor;
