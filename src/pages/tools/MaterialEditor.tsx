import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import ReactMarkdown from 'react-markdown';
import {
  Bold, Italic, List, ListOrdered, Quote, Code,
  Link2, ImageIcon, Save, Trash2, Copy, Plus,
  Loader2, ChevronDown, Globe, Lock, Minus,
  BookOpen, Pencil, ArrowLeft, Eye, EyeOff,
  ExternalLink, Users,
} from 'lucide-react';

interface Material {
  id: string;
  class_id: string;
  week_number: number;
  title: string;
  content: string;
  url: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  view_count?: number;
}

// ── 마크다운 컴포넌트 렌더러 ──────────────────────────────────────────────────
const mdComponents: any = {
  h1: ({ children }: any) => <h1 className="text-2xl font-black mb-4 mt-6 text-on-surface">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-xl font-black mb-3 mt-5 text-on-surface">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-lg font-black mb-2 mt-4 text-on-surface">{children}</h3>,
  p: ({ children }: any) => <p className="mb-3 leading-relaxed text-sm text-on-surface">{children}</p>,
  ul: ({ children }: any) => <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>,
  li: ({ children }: any) => <li className="text-sm text-on-surface">{children}</li>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-primary pl-4 italic text-on-surface-variant my-3 bg-surface-container-low py-2 rounded-r-xl">
      {children}
    </blockquote>
  ),
  code: ({ children, className }: any) => {
    const isBlock = !!className;
    return isBlock
      ? <code className="block bg-surface-container p-4 rounded-xl text-sm font-mono mb-3 overflow-auto whitespace-pre-wrap">{children}</code>
      : <code className="bg-surface-container px-1.5 py-0.5 rounded text-sm font-mono text-primary">{children}</code>;
  },
  pre: ({ children }: any) => <pre className="mb-3">{children}</pre>,
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-70">
      {children}
    </a>
  ),
  img: ({ src, alt }: any) => (
    <img src={src} alt={alt} className="max-w-full rounded-xl my-3 shadow" />
  ),
  hr: () => <hr className="border-surface-container my-5" />,
  strong: ({ children }: any) => <strong className="font-black">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  table: ({ children }: any) => (
    <div className="overflow-auto mb-3">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="border border-surface-container px-3 py-2 bg-surface-container font-black text-left">{children}</th>
  ),
  td: ({ children }: any) => (
    <td className="border border-surface-container px-3 py-2">{children}</td>
  ),
};

const MaterialEditor = () => {
  const { user } = useAuth();

  // 클래스
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);

  // 자료 목록
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  // 에디터 열림 여부
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  // 폼 필드
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [isPublished, setIsPublished] = useState(false);

  // UI 상태
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) fetchClasses();
  }, [user]);

  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, class_type, weekly_plan')
      .eq('teacher_id', user!.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    if (data) setClasses(data);
  };

  const fetchMaterials = async (classId: string) => {
    setMaterialsLoading(true);
    try {
      const { data } = await supabase
        .from('class_materials')
        .select('*')
        .eq('class_id', classId)
        .order('week_number', { ascending: true });

      if (data && data.length > 0) {
        // 열람 수 집계
        const { data: viewData } = await supabase
          .from('student_material_views')
          .select('material_id')
          .in('material_id', data.map(m => m.id));

        const viewCounts: Record<string, number> = {};
        viewData?.forEach(v => {
          viewCounts[v.material_id] = (viewCounts[v.material_id] || 0) + 1;
        });

        setMaterials(data.map(m => ({ ...m, view_count: viewCounts[m.id] || 0 })));
      } else {
        setMaterials(data || []);
      }
    } finally {
      setMaterialsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle(''); setContent(''); setUrl('');
    setWeekNumber(1); setIsPublished(false);
    setEditingMaterial(null); setViewMode('edit');
  };

  const handleNew = () => {
    resetForm();
    setIsEditorOpen(true);
  };

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    setTitle(material.title || '');
    setContent(material.content || '');
    setUrl(material.url || '');
    setWeekNumber(material.week_number || 1);
    setIsPublished(material.is_published || false);
    setViewMode('edit');
    setIsEditorOpen(true);
  };

  // ── 커서 위치에 텍스트 삽입 ──────────────────────────────────────────────
  const insertAtCursor = useCallback((before: string, after = '', placeholder = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.substring(start, end) || placeholder;
    const next = content.substring(0, start) + before + selected + after + content.substring(end);
    setContent(next);
    setTimeout(() => {
      el.focus();
      const pos = start + before.length + selected.length + after.length;
      el.setSelectionRange(pos, pos);
    }, 10);
  }, [content]);

  const insertLinePrefix = useCallback((prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = content.indexOf('\n', start);
    const end = lineEnd === -1 ? content.length : lineEnd;
    const line = content.substring(lineStart, end);
    const toggled = line.startsWith(prefix) ? line.substring(prefix.length) : prefix + line;
    setContent(content.substring(0, lineStart) + toggled + content.substring(end));
    setTimeout(() => el.focus(), 10);
  }, [content]);

  // ── 이미지 업로드 ──────────────────────────────────────────────────────────
  const uploadAndInsert = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith('image/')) { alert('이미지 파일만 업로드 가능합니다.'); return; }
    if (file.size > 20 * 1024 * 1024) { alert('20MB 이하 파일만 업로드 가능합니다.'); return; }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `materials/${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('student-attachments').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('student-attachments').getPublicUrl(path);
      insertAtCursor(`\n![${file.name.split('.')[0]}](${data.publicUrl})\n`, '', '');
    } catch { alert('이미지 업로드에 실패했습니다.'); }
    finally { setUploading(false); }
  };

  // ── 드래그앤드롭 ──────────────────────────────────────────────────────────
  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop      = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await uploadAndInsert(file);
  };

  // ── 링크 삽입 ──────────────────────────────────────────────────────────────
  const handleInsertLink = () => {
    if (linkUrl.trim()) insertAtCursor(`[${linkText || linkUrl}](${linkUrl})`, '', '');
    setLinkDialogOpen(false); setLinkText(''); setLinkUrl('');
  };

  // ── 저장 ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedClass) { alert('클래스를 선택해주세요.'); return; }
    if (!title.trim()) { alert('제목을 입력해주세요.'); return; }
    setSaving(true);
    try {
      const payload = {
        class_id: selectedClass.id,
        week_number: weekNumber,
        title: title.trim(),
        content: content.trim(),
        url: url.trim(),
        is_published: isPublished,
        updated_at: new Date().toISOString(),
      };
      if (editingMaterial) {
        const { error } = await supabase.from('class_materials').update(payload).eq('id', editingMaterial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('class_materials').insert(payload);
        if (error) throw error;
      }
      await fetchMaterials(selectedClass.id);
      setIsEditorOpen(false);
      resetForm();
    } catch { alert('저장 중 오류가 발생했습니다.'); }
    finally { setSaving(false); }
  };

  // ── 삭제 ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('이 수업 자료를 삭제하시겠습니까?')) return;
    await supabase.from('class_materials').delete().eq('id', id);
    await fetchMaterials(selectedClass.id);
  };

  // ── 복사 ──────────────────────────────────────────────────────────────────
  const handleCopy = async (material: Material) => {
    const weekStr = prompt(`복사할 주차를 입력하세요 (현재: ${material.week_number}주차):`, String(material.week_number + 1));
    if (!weekStr) return;
    const targetWeek = parseInt(weekStr);
    if (isNaN(targetWeek) || targetWeek < 1) { alert('올바른 주차를 입력해주세요.'); return; }
    const { error } = await supabase.from('class_materials').insert({
      class_id: selectedClass.id,
      week_number: targetWeek,
      title: `${material.title} (복사)`,
      content: material.content,
      url: material.url,
      is_published: false,
    });
    if (!error) await fetchMaterials(selectedClass.id);
  };

  // ── 공개/비공개 토글 ──────────────────────────────────────────────────────
  const handleTogglePublish = async (material: Material) => {
    const next = !material.is_published;
    const { error } = await supabase
      .from('class_materials')
      .update({ is_published: next, updated_at: new Date().toISOString() })
      .eq('id', material.id);
    if (!error) setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, is_published: next } : m));
  };

  // ── 주차 옵션 ──────────────────────────────────────────────────────────────
  const weekOptions: { week: number; label: string }[] =
    selectedClass?.weekly_plan?.length > 0
      ? selectedClass.weekly_plan.map((p: any) => ({ week: p.week, label: `${p.week}주차${p.topic ? `: ${p.topic}` : ''}` }))
      : Array.from({ length: 16 }, (_, i) => ({ week: i + 1, label: `${i + 1}주차` }));

  // ── 툴바 버튼 정의 ──────────────────────────────────────────────────────────
  type ToolbarItem =
    | { type: 'sep' }
    | { type: 'icon'; icon: any; title: string; action: () => void; loading?: boolean }
    | { type: 'text'; label: string; title: string; action: () => void };

  const toolbar: ToolbarItem[] = [
    { type: 'icon', icon: Bold,         title: '굵게',           action: () => insertAtCursor('**', '**', '굵은 텍스트') },
    { type: 'icon', icon: Italic,       title: '기울임',         action: () => insertAtCursor('*', '*', '기울임 텍스트') },
    { type: 'sep' },
    { type: 'text', label: 'H1',        title: '제목 1',         action: () => insertLinePrefix('# ') },
    { type: 'text', label: 'H2',        title: '제목 2',         action: () => insertLinePrefix('## ') },
    { type: 'text', label: 'H3',        title: '제목 3',         action: () => insertLinePrefix('### ') },
    { type: 'sep' },
    { type: 'icon', icon: List,         title: '글머리 목록',    action: () => insertLinePrefix('- ') },
    { type: 'icon', icon: ListOrdered,  title: '번호 목록',      action: () => insertLinePrefix('1. ') },
    { type: 'icon', icon: Quote,        title: '인용구',         action: () => insertLinePrefix('> ') },
    { type: 'icon', icon: Code,         title: '인라인 코드',    action: () => insertAtCursor('`', '`', '코드') },
    { type: 'sep' },
    { type: 'icon', icon: Minus,        title: '구분선',         action: () => insertAtCursor('\n\n---\n\n', '', '') },
    { type: 'icon', icon: Link2,        title: '링크 삽입',      action: () => setLinkDialogOpen(true) },
    { type: 'icon', icon: ImageIcon,    title: uploading ? '업로드 중...' : '이미지 삽입 / 드래그앤드롭', action: () => imageInputRef.current?.click(), loading: uploading },
  ];

  return (
    <div className="space-y-5">
      {/* ── 상단: 클래스 선택 + 새 자료 버튼 ── */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setClassDropdownOpen(o => !o)}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container rounded-2xl border-2 border-transparent hover:border-primary/20 transition-all font-black text-sm"
          >
            {selectedClass ? selectedClass.name : '클래스 선택'}
            <ChevronDown size={15} className="text-on-surface-variant" />
          </button>
          {classDropdownOpen && (
            <div className="absolute top-full mt-2 left-0 bg-white rounded-2xl shadow-xl border border-surface-container z-50 min-w-[200px] overflow-hidden">
              {classes.length === 0 ? (
                <p className="px-4 py-3 text-sm text-on-surface-variant font-bold">클래스 없음</p>
              ) : classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => { setSelectedClass(cls); setClassDropdownOpen(false); fetchMaterials(cls.id); setIsEditorOpen(false); resetForm(); }}
                  className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors text-sm font-bold"
                >
                  {cls.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedClass && !isEditorOpen && (
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2.5 btn-gradient rounded-2xl font-black text-sm text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={15} /> 새 자료 작성
          </button>
        )}
      </div>

      {/* ── 에디터 패널 ── */}
      {isEditorOpen && (
        <div className="bg-white rounded-3xl border border-surface-container overflow-hidden shadow-sm">

          {/* 에디터 헤더 */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-container bg-surface-container-low">
            <button
              onClick={() => { setIsEditorOpen(false); resetForm(); }}
              className="p-1.5 rounded-xl hover:bg-surface-container transition-colors text-on-surface-variant"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="font-black text-sm flex-1">{editingMaterial ? '수업 자료 수정' : '새 수업 자료 작성'}</span>
            {/* 뷰 모드 토글 */}
            <div className="flex items-center gap-0.5 bg-surface-container rounded-xl p-1">
              {(['edit', 'split', 'preview'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={mode === 'edit' ? '편집 모드' : mode === 'split' ? '분할 보기' : '미리보기'}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition-all ${
                    viewMode === mode
                      ? 'bg-white shadow text-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {mode === 'edit' ? <><Code size={12}/> 편집</> : mode === 'split' ? '분할' : <><Eye size={12}/> 미리보기</>}
                </button>
              ))}
            </div>
          </div>

          {/* 메타 정보 입력 */}
          <div className="flex flex-wrap gap-2.5 px-5 py-3 border-b border-surface-container bg-surface-container-low/50">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="자료 제목을 입력하세요 *"
              className="flex-1 min-w-[180px] px-4 py-2 bg-white rounded-xl border border-surface-container font-black text-sm focus:outline-none focus:border-primary/40"
            />
            <select
              value={weekNumber}
              onChange={e => setWeekNumber(parseInt(e.target.value))}
              className="px-3 py-2 bg-white rounded-xl border border-surface-container font-bold text-sm focus:outline-none focus:border-primary/40"
            >
              {weekOptions.map(w => (
                <option key={w.week} value={w.week}>{w.label}</option>
              ))}
            </select>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="🔗 외부 링크 URL (선택)"
              className="flex-1 min-w-[180px] px-4 py-2 bg-white rounded-xl border border-surface-container font-bold text-sm focus:outline-none focus:border-blue-300"
            />
          </div>

          {/* 마크다운 툴바 */}
          <div className="flex flex-wrap items-center gap-0.5 px-4 py-2 border-b border-surface-container bg-surface-container-low/30">
            {toolbar.map((item, i) => {
              if (item.type === 'sep') return <div key={i} className="w-px h-4 bg-surface-container mx-1" />;
              if (item.type === 'text') return (
                <button
                  key={i}
                  onClick={item.action}
                  title={item.title}
                  className="px-2 py-1 rounded-lg text-xs font-black text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                >
                  {item.label}
                </button>
              );
              const Icon = item.icon;
              return (
                <button
                  key={i}
                  onClick={item.action}
                  title={item.title}
                  disabled={item.loading}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors disabled:opacity-50"
                >
                  {item.loading ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
                </button>
              );
            })}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { uploadAndInsert(f); e.target.value = ''; } }}
            />
            <span className="ml-auto text-[10px] text-on-surface-variant font-bold opacity-60">이미지 드래그앤드롭 가능</span>
          </div>

          {/* 편집 / 미리보기 영역 */}
          <div className={`${viewMode === 'split' ? 'grid grid-cols-2 divide-x divide-surface-container' : ''}`}>
            {/* 편집창 */}
            {(viewMode === 'edit' || viewMode === 'split') && (
              <div
                className={`relative transition-colors ${isDragging ? 'bg-primary/5 ring-2 ring-primary ring-inset' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isDragging && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <div className="bg-primary/10 rounded-2xl px-8 py-5 font-black text-primary text-sm border-2 border-dashed border-primary">
                      📷 이미지를 여기에 놓으세요
                    </div>
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={`마크다운으로 수업 자료를 작성하세요...

## 학습 목표
- 목표를 입력하세요

## 핵심 개념
내용을 작성하세요.

> 💡 팁: 이미지를 에디터에 드래그앤드롭하면 자동으로 업로드됩니다.`}
                  className="w-full min-h-[440px] p-6 font-mono text-sm bg-transparent focus:outline-none resize-y leading-relaxed"
                />
              </div>
            )}

            {/* 미리보기창 */}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className="min-h-[440px] p-6 overflow-auto bg-white">
                {content.trim() ? (
                  <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30">
                    <EyeOff size={32} />
                    <p className="text-sm font-bold">편집창에 내용을 작성하면 미리보기가 표시됩니다</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 하단 액션 바 */}
          <div className="flex items-center gap-3 px-5 py-4 border-t border-surface-container bg-surface-container-low/50">
            {/* 공개 토글 */}
            <button
              onClick={() => setIsPublished(p => !p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-black text-sm transition-all ${
                isPublished
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-surface-container text-on-surface-variant hover:border-primary/20'
              }`}
            >
              {isPublished ? <><Globe size={14} /> 학생 공개 중</> : <><Lock size={14} /> 비공개</>}
            </button>
            <p className="text-xs font-bold text-on-surface-variant opacity-60">
              {isPublished ? '학생이 수업자료 탭에서 볼 수 있습니다' : '저장 후 공개 여부를 설정하세요'}
            </p>
            <div className="flex-1" />
            <button
              onClick={() => { setIsEditorOpen(false); resetForm(); }}
              className="px-4 py-2 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 btn-gradient rounded-xl font-black text-sm text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {editingMaterial ? '수정 완료' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* ── 링크 삽입 다이얼로그 ── */}
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

      {/* ── 자료 목록 ── */}
      {selectedClass && !isEditorOpen && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
              {selectedClass.name} 수업 자료 ({materials.length}개)
            </p>
          </div>

          {materialsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center py-16 space-y-3 opacity-30">
              <BookOpen size={48} />
              <p className="font-black">아직 작성된 수업 자료가 없습니다.</p>
              <p className="text-sm font-bold">위의 '새 자료 작성' 버튼을 눌러 시작하세요.</p>
            </div>
          ) : (
            materials.map(material => (
              <div key={material.id} className="bg-white rounded-2xl border border-surface-container overflow-hidden transition-all hover:border-primary/20 hover:shadow-sm">
                {/* 자료 헤더 */}
                <div className="flex items-center gap-3 p-4">
                  {/* 주차 뱃지 */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black ${
                    material.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-container text-on-surface-variant'
                  }`}>
                    {material.week_number}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm truncate">{material.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {material.is_published
                        ? <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">● 공개 중</span>
                        : <span className="text-[10px] font-black text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">● 비공개</span>
                      }
                      {material.content && <span className="text-[10px] font-bold text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full">📝 내용 있음</span>}
                      {material.url && <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">🔗 링크</span>}
                      {(material.view_count ?? 0) > 0 && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Users size={9} /> {material.view_count}명 열람
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* 미리보기 토글 */}
                    <button
                      onClick={() => setExpandedId(expandedId === material.id ? null : material.id)}
                      title="내용 미리보기"
                      className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
                    >
                      {expandedId === material.id ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    {/* 공개/비공개 */}
                    <button
                      onClick={() => handleTogglePublish(material)}
                      title={material.is_published ? '비공개로 전환' : '학생에게 공개'}
                      className={`p-2 rounded-xl transition-colors ${
                        material.is_published
                          ? 'text-emerald-600 hover:bg-emerald-50'
                          : 'text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {material.is_published ? <Globe size={15} /> : <Lock size={15} />}
                    </button>
                    {/* 복사 */}
                    <button
                      onClick={() => handleCopy(material)}
                      title="다른 주차로 복사"
                      className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
                    >
                      <Copy size={15} />
                    </button>
                    {/* 수정 */}
                    <button
                      onClick={() => handleEdit(material)}
                      title="수정"
                      className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    {/* 삭제 */}
                    <button
                      onClick={() => handleDelete(material.id)}
                      title="삭제"
                      className="p-2 rounded-xl text-red-400 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* 내용 미리보기 (확장) */}
                {expandedId === material.id && (
                  <div className="border-t border-surface-container">
                    {material.url && (
                      <a
                        href={material.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors border-b border-surface-container"
                      >
                        <ExternalLink size={14} /> {material.url}
                      </a>
                    )}
                    {material.content ? (
                      <div className="p-5 max-h-80 overflow-y-auto">
                        <ReactMarkdown components={mdComponents}>{material.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="px-5 py-4 text-sm font-bold text-on-surface-variant opacity-50">작성된 내용이 없습니다.</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 클래스 미선택 안내 */}
      {!selectedClass && !isEditorOpen && (
        <div className="flex flex-col items-center py-24 space-y-3 opacity-30">
          <BookOpen size={56} />
          <p className="font-black text-lg">클래스를 선택하세요</p>
          <p className="text-sm font-bold">위에서 클래스를 선택하면 수업 자료를 관리할 수 있습니다.</p>
        </div>
      )}
    </div>
  );
};

export default MaterialEditor;
