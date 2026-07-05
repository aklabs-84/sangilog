import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, Type, Image as ImageIcon, Link2, Smile, Code2, Play, Trash2, Loader2, LayoutGrid, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import type { SlideDeck, DeckSlide, SlideObject, SlideObjectType, SlideLayoutKind } from '../../components/slidedeck/types';
import { SLIDE_TEMPLATES, getTemplate, instantiateSlide, getLayoutSlotSpec, buildDraftDeckSlides } from '../../components/slidedeck/templates';
import TemplateGallery from '../../components/slidedeck/TemplateGallery';
import SlideThumbnailRail from '../../components/slidedeck/SlideThumbnailRail';
import SlideStage from '../../components/slidedeck/SlideStage';
import PresentationView from '../../components/slidedeck/PresentationView';
import EmojiPickerPopover from '../../components/slidedeck/EmojiPickerPopover';
import ImportMaterialModal, { type ImportableMaterial } from '../../components/slidedeck/ImportMaterialModal';
import { generateSlideDeckDraft } from '../../lib/gemini';

type View = 'list' | 'template' | 'editor';

const ALL_LAYOUT_KINDS: SlideLayoutKind[] = ['title', 'textOnly', 'textImage1', 'textImagesMany'];

// class_materials.ai_versions 중 mode:'presentation' 최신본이 있으면 그걸, 없으면 원문(content)을 초안 원본으로 사용
const resolveSourceContent = (material: ImportableMaterial): string => {
  const presentationVersions = (material.ai_versions ?? []).filter(v => v.mode === 'presentation');
  if (presentationVersions.length > 0) {
    const latest = [...presentationVersions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return latest.content;
  }
  return material.content ?? '';
};

interface DeckListRow {
  id: string;
  title: string;
  thumbnail_url: string | null;
  updated_at: string;
}

export default function SlideDeckEditor() {
  const { user } = useAuth();
  const [view, setView] = useState<View>('list');
  const [decks, setDecks] = useState<DeckListRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeDeck, setActiveDeck] = useState<SlideDeck | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string>(SLIDE_TEMPLATES[0].id);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedMaterial, setImportedMaterial] = useState<ImportableMaterial | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDecks = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);
    const { data } = await supabase
      .from('slide_decks')
      .select('id, title, thumbnail_url, updated_at')
      .eq('teacher_id', user.id)
      .order('updated_at', { ascending: false });
    setDecks(data ?? []);
    setLoadingList(false);
  }, [user]);

  useEffect(() => { loadDecks(); }, [loadDecks]);

  // ── 자동 저장 ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeDeck) return;
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase
        .from('slide_decks')
        .update({ title: activeDeck.title, slides: activeDeck.slides, updated_at: new Date().toISOString() })
        .eq('id', activeDeck.id);
      setSaveState('saved');
    }, 900);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDeck?.title, activeDeck?.slides]);

  // ── 덱 생성 ────────────────────────────────────────────────────────────
  const handleCreateFromTemplate = async (templateId: string) => {
    if (!user) return;
    const template = getTemplate(templateId);
    const firstSlide = instantiateSlide(template, 'title');
    const { data, error } = await supabase
      .from('slide_decks')
      .insert({ teacher_id: user.id, title: '제목 없는 슬라이드', slides: [firstSlide] })
      .select()
      .single();
    if (error || !data) return;
    setActiveTemplateId(templateId);
    setActiveDeck(data as SlideDeck);
    setActiveSlideIndex(0);
    setSelectedObjectId(null);
    setView('editor');
    loadDecks();
  };

  // ── AI 초안 생성 (자료 에디터에서 가져오기) ────────────────────────────────
  const handleCreateDraftFromMaterial = async (templateId: string) => {
    if (!user || !importedMaterial) return;
    setAiGenerating(true);
    try {
      const template = getTemplate(templateId);
      const layoutSpecs = ALL_LAYOUT_KINDS.map(kind => getLayoutSlotSpec(template, kind));
      const sourceContent = resolveSourceContent(importedMaterial);
      const { slides: aiSlides, imageUrls, codeBlocks } = await generateSlideDeckDraft(
        sourceContent,
        layoutSpecs,
        importedMaterial.class_id ?? undefined
      );
      const draftSlides = buildDraftDeckSlides(template, aiSlides, imageUrls, codeBlocks);
      const { data, error } = await supabase
        .from('slide_decks')
        .insert({ teacher_id: user.id, title: importedMaterial.title || '제목 없는 슬라이드', slides: draftSlides })
        .select()
        .single();
      if (error || !data) return;
      setActiveTemplateId(templateId);
      setActiveDeck(data as SlideDeck);
      setActiveSlideIndex(0);
      setSelectedObjectId(null);
      setView('editor');
      loadDecks();
    } catch (err: any) {
      alert(err?.message === 'AI_LIMIT_EXCEEDED' ? '이번 달 AI 사용 한도에 도달했습니다.' : 'AI 초안 생성 중 오류가 발생했습니다.');
    } finally {
      setAiGenerating(false);
      setImportedMaterial(null);
    }
  };

  const handleOpenDeck = async (id: string) => {
    const { data } = await supabase.from('slide_decks').select('*').eq('id', id).single();
    if (!data) return;
    setActiveDeck(data as SlideDeck);
    setActiveSlideIndex(0);
    setSelectedObjectId(null);
    setView('editor');
  };

  const handleDeleteDeck = async (id: string) => {
    if (!confirm('이 슬라이드를 삭제할까요? 되돌릴 수 없습니다.')) return;
    await supabase.from('slide_decks').delete().eq('id', id);
    loadDecks();
  };

  const handleBackToList = () => {
    setActiveDeck(null);
    setView('list');
    loadDecks();
  };

  // ── 슬라이드 조작 ──────────────────────────────────────────────────────
  const updateSlides = (updater: (slides: DeckSlide[]) => DeckSlide[]) => {
    setActiveDeck(prev => prev ? { ...prev, slides: updater(prev.slides) } : prev);
  };

  const handleAddSlide = () => {
    const template = getTemplate(activeTemplateId);
    const newSlide = instantiateSlide(template, 'textOnly');
    updateSlides(slides => [...slides, newSlide]);
    setActiveSlideIndex(prev => (activeDeck?.slides.length ?? prev + 1));
    setSelectedObjectId(null);
  };

  const handleDuplicateSlide = (index: number) => {
    updateSlides(slides => {
      const src = slides[index];
      const clone: DeckSlide = {
        ...src,
        id: crypto.randomUUID(),
        objects: src.objects.map(o => ({ ...o, id: crypto.randomUUID() })),
      };
      const next = [...slides];
      next.splice(index + 1, 0, clone);
      return next;
    });
  };

  const handleDeleteSlide = (index: number) => {
    updateSlides(slides => slides.filter((_, i) => i !== index));
    setActiveSlideIndex(prev => Math.max(0, prev >= index ? prev - 1 : prev));
    setSelectedObjectId(null);
  };

  const currentSlide = activeDeck?.slides[activeSlideIndex];

  const handleUpdateObject = (id: string, changes: Partial<SlideObject>) => {
    updateSlides(slides => slides.map((s, i) => i !== activeSlideIndex ? s : {
      ...s, objects: s.objects.map(o => o.id === id ? { ...o, ...changes } : o),
    }));
  };

  const handleDeleteObject = (id: string) => {
    updateSlides(slides => slides.map((s, i) => i !== activeSlideIndex ? s : {
      ...s, objects: s.objects.filter(o => o.id !== id),
    }));
    setSelectedObjectId(null);
  };

  const addObject = (type: SlideObjectType, emoji?: string) => {
    if (!currentSlide) return;
    const maxZ = currentSlide.objects.reduce((m, o) => Math.max(m, o.zIndex), 0);
    const base = { id: crypto.randomUUID(), zIndex: maxZ + 1 };
    const obj: SlideObject =
      type === 'text' ? { ...base, type: 'text', x: 380, y: 300, width: 520, height: 140, text: '텍스트를 입력하세요', style: { fontSize: 26, align: 'left' } } :
      type === 'image' ? { ...base, type: 'image', x: 400, y: 260, width: 480, height: 320 } :
      type === 'link' ? { ...base, type: 'link', x: 420, y: 320, width: 380, height: 90, text: '링크 제목', href: 'https://' } :
      type === 'code' ? { ...base, type: 'code', x: 340, y: 240, width: 600, height: 280, text: '', codeLang: 'Python', style: { fontSize: 18 } } :
      { ...base, type: 'emoji', x: 500, y: 260, width: 160, height: 160, text: emoji ?? '🙂' };
    updateSlides(slides => slides.map((s, i) => i !== activeSlideIndex ? s : { ...s, objects: [...s.objects, obj] }));
    setSelectedObjectId(obj.id);
  };

  const selectedObject = currentSlide?.objects.find(o => o.id === selectedObjectId) ?? null;

  const updateSelectedStyle = (changes: Partial<NonNullable<SlideObject['style']>>) => {
    if (!selectedObject) return;
    handleUpdateObject(selectedObject.id, { style: { ...selectedObject.style, ...changes } });
  };

  // ── 렌더 ──────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div style={{ padding: '4px 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>슬라이드 만들기</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowImportModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#111827', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
            >
              <Sparkles size={16} /> AI로 자료 가져오기
            </button>
            <button
              onClick={() => setView('template')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
            >
              <Plus size={16} /> 새 슬라이드
            </button>
          </div>
        </div>
        {loadingList ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#9CA3AF' }}><Loader2 className="animate-spin" size={24} /></div>
        ) : decks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
            <LayoutGrid size={36} style={{ margin: '0 auto 12px' }} />
            <p>아직 만든 슬라이드가 없습니다. 새 슬라이드로 시작해보세요.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {decks.map(d => (
              <div key={d.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                <div onClick={() => handleOpenDeck(d.id)} style={{ height: 110, background: '#f3f4f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                  {d.thumbnail_url ? <img src={d.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <LayoutGrid size={28} />}
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                  <button onClick={() => handleDeleteDeck(d.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {showImportModal && (
          <ImportMaterialModal
            userId={user?.id ?? ''}
            onSelect={material => { setImportedMaterial(material); setView('template'); }}
            onClose={() => setShowImportModal(false)}
          />
        )}
      </div>
    );
  }

  if (view === 'template') {
    return (
      <div style={{ padding: '4px 2px', position: 'relative' }}>
        <button
          onClick={() => { setView('list'); setImportedMaterial(null); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, marginBottom: 16 }}
        >
          <ArrowLeft size={16} /> 목록으로
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>템플릿을 선택하세요</h2>
        {importedMaterial && (
          <p style={{ fontSize: 13, color: '#3B82F6', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} /> '{importedMaterial.title}' 자료로 AI 초안을 만듭니다
          </p>
        )}
        <TemplateGallery onSelect={importedMaterial ? handleCreateDraftFromMaterial : handleCreateFromTemplate} />
        {aiGenerating && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.85)', zIndex: 9995,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <Loader2 className="animate-spin" size={32} color="#3B82F6" />
            <p style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>AI가 슬라이드 초안을 만들고 있어요...</p>
          </div>
        )}
      </div>
    );
  }

  if (view === 'editor' && activeDeck && currentSlide) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <button onClick={handleBackToList} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><ArrowLeft size={18} /></button>
            <input
              value={activeDeck.title}
              onChange={e => setActiveDeck(prev => prev ? { ...prev, title: e.target.value } : prev)}
              style={{ fontSize: 16, fontWeight: 700, border: 'none', outline: 'none', flex: 1, minWidth: 0 }}
            />
          </div>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
            {saveState === 'saving' ? '저장 중...' : saveState === 'saved' ? '저장됨' : ''}
          </span>
          <button
            onClick={() => setPresenting(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111827', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            <Play size={14} /> 발표 시작
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <button onClick={() => addObject('text')} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            <Type size={14} /> 텍스트 추가
          </button>
          <button onClick={() => addObject('image')} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            <ImageIcon size={14} /> 이미지 추가
          </button>
          <button onClick={() => addObject('link')} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            <Link2 size={14} /> 링크 추가
          </button>
          <button onClick={() => addObject('code')} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            <Code2 size={14} /> 코드 추가
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setEmojiPickerOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              <Smile size={14} /> 이모지 추가
            </button>
            {emojiPickerOpen && (
              <EmojiPickerPopover
                onSelect={e => addObject('emoji', e)}
                onClose={() => setEmojiPickerOpen(false)}
              />
            )}
          </div>
          {selectedObject?.type === 'text' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8, paddingLeft: 8, borderLeft: '1px solid #e5e7eb' }}>
              <input
                type="number" min={12} max={120}
                value={selectedObject.style?.fontSize ?? 24}
                onChange={e => updateSelectedStyle({ fontSize: Number(e.target.value) })}
                style={{ width: 56, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', fontSize: 13 }}
              />
              <button onClick={() => updateSelectedStyle({ bold: !selectedObject.style?.bold })}
                style={{ fontWeight: 700, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', background: selectedObject.style?.bold ? '#111' : '#fff', color: selectedObject.style?.bold ? '#fff' : '#111', cursor: 'pointer' }}>
                B
              </button>
              {(['left', 'center', 'right'] as const).map(a => (
                <button key={a} onClick={() => updateSelectedStyle({ align: a })}
                  style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 12, background: selectedObject.style?.align === a ? '#111' : '#fff', color: selectedObject.style?.align === a ? '#fff' : '#111', cursor: 'pointer' }}>
                  {a === 'left' ? '왼쪽' : a === 'center' ? '가운데' : '오른쪽'}
                </button>
              ))}
              <input
                type="color"
                value={selectedObject.style?.color ?? '#ffffff'}
                onChange={e => updateSelectedStyle({ color: e.target.value })}
                style={{ width: 32, height: 30, border: '1px solid #e5e7eb', borderRadius: 6, padding: 0, cursor: 'pointer' }}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <SlideThumbnailRail
            slides={activeDeck.slides}
            activeIndex={activeSlideIndex}
            onSelect={i => { setActiveSlideIndex(i); setSelectedObjectId(null); }}
            onAdd={handleAddSlide}
            onDuplicate={handleDuplicateSlide}
            onDelete={handleDeleteSlide}
          />
          <div style={{ flex: 1, maxWidth: 960 }}>
            <SlideStage
              slide={currentSlide}
              editable
              selectedId={selectedObjectId}
              onSelect={setSelectedObjectId}
              onUpdateObject={handleUpdateObject}
              onDeleteObject={handleDeleteObject}
            />
          </div>
        </div>

        {presenting && (
          <PresentationView
            slides={activeDeck.slides}
            startIndex={activeSlideIndex}
            onClose={() => setPresenting(false)}
          />
        )}
      </div>
    );
  }

  return null;
}
