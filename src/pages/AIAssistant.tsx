import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Search,
  RotateCw,
  ChevronDown,
  Check,
  Copy,
  Printer,
  Trash2,
  Users,
  FileText,
  ArrowRight,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { geminiPro, SYSTEM_INSTRUCTIONS } from '../lib/gemini';

const AIAssistant = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [loading, setLoading] = useState(true);
  const [obsCount, setObsCount] = useState(0);
  const [recentObsTime, setRecentObsTime] = useState<string | null>(null);
  const [savedDrafts, setSavedDrafts] = useState<any[]>([]);

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const isHomeroom = selectedClass?.class_type === 'homeroom';

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedClassId) fetchObsStats(selectedClassId);
  }, [selectedClassId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: classesData } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user?.id);

      if (classesData) {
        setClasses(classesData);
        if (classesData.length > 0) {
          setSelectedClassId(classesData[0].id);
          fetchStudents(classesData[0].id);
        }
      }

      // 저장된 AI 초안 조회
      const { data: drafts } = await supabase
        .from('ai_drafts')
        .select('*')
        .eq('teacher_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(3);
      if (drafts) setSavedDrafts(drafts);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (classId: string) => {
    try {
      const cls = classes.find(c => c.id === classId);
      const targetClassId = cls?.linked_class_id || classId;
      const { data } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', targetClassId);
      if (data) setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchObsStats = async (classId: string) => {
    try {
      const cls = classes.find(c => c.id === classId);
      const targetClassId = cls?.linked_class_id || classId;

      const { data: studentIds } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', targetClassId);

      if (!studentIds || studentIds.length === 0) {
        setObsCount(0);
        setRecentObsTime(null);
        return;
      }

      const ids = studentIds.map(s => s.id);
      const { count, data: recent } = await supabase
        .from('observations')
        .select('created_at', { count: 'exact' })
        .in('student_id', ids)
        .order('created_at', { ascending: false })
        .limit(1);

      setObsCount(count || 0);
      if (recent && recent.length > 0) {
        const d = new Date(recent[0].created_at);
        const diff = Math.floor((Date.now() - d.getTime()) / 60000);
        if (diff < 60) setRecentObsTime(`${diff}분 전`);
        else if (diff < 1440) setRecentObsTime(`${Math.floor(diff / 60)}시간 전`);
        else setRecentObsTime(`${Math.floor(diff / 1440)}일 전`);
      } else {
        setRecentObsTime(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedClassId(id);
    fetchStudents(id);
  };

  const filteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGenerate = async () => {
    if (!selectedClassId) return;
    setIsGenerating(true);

    try {
      const cls = classes.find(c => c.id === selectedClassId);
      const targetClassId = cls?.linked_class_id || selectedClassId;

      const { data: studentIds } = await supabase
        .from('students')
        .select('id, full_name')
        .eq('class_id', targetClassId)
        .ilike('full_name', searchQuery ? `%${searchQuery}%` : '%');

      if (!studentIds || studentIds.length === 0) {
        alert('선택한 학급에 학생이 없거나 검색 결과가 없습니다.');
        setIsGenerating(false);
        return;
      }

      const ids = studentIds.map(s => s.id);
      const nameMap: Record<string, string> = {};
      studentIds.forEach(s => { nameMap[s.id] = s.full_name; });

      const { data: records, error } = await supabase
        .from('observations')
        .select('content, activity_name, student_id')
        .in('student_id', ids);

      if (error) throw error;

      let recordsText = '';
      if (records && records.length > 0) {
        recordsText = records
          .map(r => `[학생명: ${nameMap[r.student_id] || '학생'}]\n활동명: ${r.activity_name}\n내용: ${r.content}`)
          .join('\n---\n');
      } else {
        recordsText = "작성된 활동 기록이 없습니다.";
      }

      const teacherPrompt = selectedClass?.teacher_report_prompt || "";
      const docType = isHomeroom ? '행동특성 및 종합의견(행특)' : '교과 세부능력 및 특기사항(세특)';

      const fullPrompt = `
${SYSTEM_INSTRUCTIONS.BASE}
${SYSTEM_INSTRUCTIONS.SEATUK_GUIDE}
${SYSTEM_INSTRUCTIONS.PRIVACY}

[선생님의 커스텀 추가 지침]
${teacherPrompt}

당신의 역할:
선생님을 도와주기 위해, 학생의 활동 기록을 모아 하나의 매끄러운 ${docType} 문구를 작성해야 합니다.
학생의 능동적인 역량, 변화, 학습 태도를 중점적으로 반영하세요.
문구만 온전히 반환하고, 추가적인 마크다운 요약이나 부가 설명은 생략하세요.

[학생들의 관찰 기록 데이터]
${recordsText}
`;

      const result = await geminiPro.generateContent(fullPrompt);
      const text = result.response.text();
      setDraftText(text);
      setShowDraft(true);
    } catch (err) {
      console.error(err);
      alert('AI 초안 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const applyRefine = async (refineType: string) => {
    if (!draftText) return;
    setIsGenerating(true);
    try {
      const prompt = `다음 학생 기록 초안을 "${refineType}" 해주세요. 결과물 텍스트만 출력하세요.\n\n원본:\n${draftText}`;
      const result = await geminiPro.generateContent(prompt);
      setDraftText(result.response.text());
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(draftText);
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<pre style="font-family:sans-serif;line-height:1.8;white-space:pre-wrap">${draftText}</pre>`);
      w.print();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-10"
    >
      {/* Header */}
      <div className="px-2">
        <p className="text-primary font-bold text-xs uppercase tracking-widest mb-3">Intelligence Engine</p>
        <h1 className="text-4xl font-extrabold font-manrope mb-4">
          {isHomeroom ? 'AI 종합 생기부/행특 초안 생성' : 'AI 교과 세특 초안 생성'}
        </h1>
        <p className="text-on-surface-variant text-base max-w-2xl leading-relaxed">
          {isHomeroom
            ? '다른 교과 선생님들의 세특과 반 활동 기록을 모아 학생의 종합적인 행동특성 및 종합의견을 작성합니다.'
            : '교실 활동 기록을 전문적인 과목별 생기부 문구로 변환합니다. AI가 작성한 초안을 검토하고 수정하여 완성하세요.'}
        </p>
      </div>

      <div className="grid grid-cols-12 gap-10">
        {/* Left Control Panel */}
        <div className="col-span-12 lg:col-span-5 space-y-8">
          <div className="surface-card p-10 shadow-ambient border-l-4 border-primary">
            <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
              <Users size={24} className="text-primary" />
              대상 학급 선택
            </h2>

            <div className="space-y-8">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">대상 학급 선택</label>
                <div className="relative group">
                  <select
                    value={selectedClassId}
                    onChange={handleClassChange}
                    className="w-full pl-4 pr-10 py-4 bg-surface-container rounded-xl text-sm font-bold appearance-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    {loading ? (
                      <option>로딩 중...</option>
                    ) : classes.length > 0 ? (
                      classes.map(c => (
                        <option key={c.id} value={c.id}>[{c.class_type === 'homeroom' ? '담임반' : '교과반'}] {c.name} - {c.subject}</option>
                      ))
                    ) : (
                      <option>등록된 학급이 없습니다</option>
                    )}
                  </select>
                  <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">학생 선택 (선택 사항)</label>
                <div className="relative group">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    placeholder="학생 이름 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-surface-container rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                    <Users size={18} />
                  </div>
                </div>

                {searchQuery && (
                  <div className="mt-2 bg-surface-container-low rounded-xl border border-surface-container-high max-h-40 overflow-y-auto shadow-sm">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setSearchQuery(s.full_name)}
                          className="w-full text-left px-4 py-3 hover:bg-surface-container text-xs font-bold transition-all border-b border-surface-container last:border-0"
                        >
                          {s.full_name} ({s.student_number || '번호 없음'})
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-xs text-on-surface-variant">검색 결과가 없습니다.</div>
                    )}
                  </div>
                )}
              </div>

              {/* 관찰 기록 현황 - 실제 데이터 */}
              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-surface-container-high">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">관찰 기록 현황</p>
                  <p className="text-xs text-on-surface-variant font-medium">
                    {recentObsTime ? `최근 기록: ${recentObsTime}` : '기록 없음'}
                  </p>
                </div>
                <div className={`px-3 py-1.5 rounded-xl text-[11px] font-black tracking-tighter ${obsCount > 0 ? 'bg-primary-container text-primary' : 'bg-surface-container text-on-surface-variant/50'}`}>
                  {obsCount}개 기록
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || obsCount === 0}
                className="w-full btn-gradient py-5 rounded-2xl font-black text-base flex items-center justify-center gap-3 shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <RotateCw size={22} className="animate-spin" />
                ) : (
                  <>
                    <Sparkles size={22} />
                    <span>{isHomeroom ? '종합 행특 AI로 생성하기' : '교과 세특 AI로 생성하기'}</span>
                  </>
                )}
              </button>
              {obsCount === 0 && (
                <p className="text-center text-xs text-on-surface-variant/60">활동 기록을 먼저 등록해야 생성할 수 있습니다.</p>
              )}
            </div>
          </div>

          <div className="p-8 bg-surface-container-low rounded-3xl flex items-start gap-4 border border-surface-container-high opacity-80">
            <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary mt-1">
              <Check size={20} />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-sm">인간 협업 안내</h3>
              <p className="text-[13px] text-on-surface-variant leading-relaxed font-medium">
                AI 초안은 제안만 하며, 교사의 검토가 필요합니다. 생성된 모든 콘텐츠는 공식 기록으로 확정되기 전 반드시 정확성을 검토하고 확인해야 합니다.
              </p>
            </div>
          </div>
        </div>

        {/* Right Output Area - Draft Editor */}
        <div className="col-span-12 lg:col-span-7">
          <AnimatePresence mode="wait">
            {showDraft ? (
              <motion.div
                key="draft"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                className="surface-card shadow-ambient min-h-[700px] flex flex-col relative"
              >
                <div className="p-8 border-b border-surface-container flex items-center justify-between">
                  <h2 className="text-xl font-bold font-manrope flex items-center gap-3">
                    <FileText size={22} className="text-primary" />
                    학생 기록 초안
                  </h2>
                  <div className="flex items-center gap-2">
                    <button onClick={handleCopy} className="p-2.5 rounded-xl hover:bg-surface-container-high transition-all text-on-surface-variant" title="복사">
                      <Copy size={18} />
                    </button>
                    <button onClick={handlePrint} className="p-2.5 rounded-xl hover:bg-surface-container-high transition-all text-on-surface-variant" title="인쇄">
                      <Printer size={18} />
                    </button>
                    <button
                      onClick={() => { setShowDraft(false); setDraftText(''); }}
                      className="p-2.5 rounded-xl hover:bg-red-50 text-red-400 transition-all ml-2 font-bold px-4 flex items-center gap-2"
                    >
                      <Trash2 size={18} />
                      <span className="text-[11px]">삭제</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 p-10 space-y-10">
                  <div className="relative group flex-1">
                    <div className="absolute -left-6 top-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors rounded-full" />
                    <textarea
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      className="w-full h-full min-h-[350px] p-4 text-base font-bold leading-relaxed bg-transparent resize-none focus:outline-none custom-scrollbar border border-transparent focus:border-primary/20 rounded-2xl"
                      placeholder="생성된 초안이 위치하는 곳입니다..."
                    />
                  </div>

                  {/* AI Refine Toolbar */}
                  <div className="bg-surface-container-lowest glass rounded-2xl shadow-ambient p-3 flex items-center justify-center gap-6 border border-surface-container-high w-fit mx-auto sticky bottom-10 z-10 transition-all hover:scale-[1.02]">
                    <button onClick={() => applyRefine('어문 규범에 맞게 교정하고 단어들을 더 자연스럽게 수정')} className="flex items-center gap-2 px-4 py-2 hover:bg-surface-container rounded-xl transition-all font-bold text-[12px] group">
                      <RotateCw size={16} className={`text-primary transition-transform duration-500 ${isGenerating ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                      부드럽게 교정
                    </button>
                    <div className="w-px h-6 bg-surface-container-high" />
                    <button onClick={() => applyRefine('핵심만 50% 분량으로 축소')} className="flex items-center gap-2 px-4 py-2 hover:bg-surface-container rounded-xl transition-all font-bold text-[12px]">
                      <ArrowRight size={16} className="rotate-180 text-on-surface-variant" />
                      내용 축소
                    </button>
                    <div className="w-px h-6 bg-surface-container-high" />
                    <button onClick={() => applyRefine('명사형 종결어미(~함, ~임)를 사용하고 객관적 관찰자 시점의 전문적인 어조로 수정')} className="flex items-center gap-2 px-4 py-2 hover:bg-surface-container rounded-xl transition-all font-bold text-[12px]">
                      <Sparkles size={16} className="text-primary" />
                      전문적인 어조
                    </button>
                  </div>
                </div>

                <div className="p-8 border-t border-surface-container bg-surface-container-low/50 flex items-center justify-end gap-4 rounded-b-3xl">
                  <button
                    onClick={handleCopy}
                    className="px-6 py-3 font-bold text-sm text-on-surface-variant hover:text-on-surface transition-all"
                  >
                    클립보드 복사
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-8 py-3 bg-primary text-white font-bold text-sm rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    인쇄하기
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="surface-card shadow-ambient min-h-[400px] flex flex-col items-center justify-center gap-6 text-center p-16"
              >
                <div className="w-20 h-20 bg-primary/8 rounded-3xl flex items-center justify-center">
                  <BookOpen size={36} className="text-primary/40" />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-black text-on-surface/60">아직 생성된 초안이 없습니다</p>
                  <p className="text-sm text-on-surface-variant/50">학급과 학생을 선택한 뒤<br/>생성 버튼을 눌러주세요.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom History Section - 실제 저장된 초안 */}
      {savedDrafts.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold font-manrope px-2">최근 AI 초안</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {savedDrafts.map((item, _i) => (
              <div
                key={item.id}
                onClick={() => { setDraftText(item.content); setShowDraft(true); }}
                className="p-8 surface-card shadow-ambient hover:translate-y-[-4px] transition-all cursor-pointer border-t-4 border-primary/20 hover:border-primary"
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">{item.class_name || '학급'}</span>
                  <span className="text-[10px] font-bold text-on-surface-variant">
                    {new Date(item.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <h3 className="text-sm font-bold mb-4 line-clamp-3 leading-snug text-on-surface-variant">{item.content?.slice(0, 80)}...</h3>
                <div className="flex items-center justify-between mt-auto">
                  <span className="flex items-center gap-2 text-[11px] font-bold text-primary">
                    <Check size={14} />
                    저장됨
                  </span>
                  <ArrowRight size={14} className="text-on-surface-variant/40" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default AIAssistant;
