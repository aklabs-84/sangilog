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
  BookOpen,
  ChevronUp,
} from 'lucide-react';
import { useAuth, checkIsPro, getAiMonthlyLimit } from '../lib/auth';
import { seatukDraftAI, seatukRefineAI, SYSTEM_INSTRUCTIONS } from '../lib/gemini';
import UpgradeModal from '../components/UpgradeModal';


interface StudentDraft {
  studentId: string;
  name: string;
  content: string;
  isExpanded: boolean;
  isCopied: boolean;
  isDeleting?: boolean;
}

const AIAssistant = () => {
  const { user, profile } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingName, setGeneratingName] = useState('');
  const [showDraft, setShowDraft] = useState(false);
  const [draftResults, setDraftResults] = useState<StudentDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [obsCount, setObsCount] = useState(0);
  const [recentObsTime, setRecentObsTime] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<'ai_bulk' | 'ai_limit' | 'ai_free_block'>('ai_bulk');
  const [monthAiCount, setMonthAiCount] = useState(0);
  const [reportMode, setReportMode] = useState<'school' | 'academy'>('school');
  const [savedDrafts, setSavedDrafts] = useState<any[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const isHomeroom = selectedClass?.class_type === 'homeroom';
  const aiMonthlyLimit = getAiMonthlyLimit(profile);

  useEffect(() => { fetchInitialData(); }, []);
  useEffect(() => { if (selectedClassId) fetchObsStats(selectedClassId); }, [selectedClassId]);
  useEffect(() => {
    if (!profile?.ai_monthly_reset) { setMonthAiCount(0); return; }
    const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    setMonthAiCount(profile.ai_monthly_reset === thisMonth ? (profile.ai_monthly_count ?? 0) : 0);
  }, [profile]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: classesData } = await supabase.from('classes').select('*').eq('teacher_id', user?.id);
      if (classesData) {
        setClasses(classesData);
        if (classesData.length > 0) {
          setSelectedClassId(classesData[0].id);
          fetchStudents(classesData[0].id);
        }
      }
      const { data: drafts } = await supabase.from('ai_drafts').select('*').eq('teacher_id', user?.id).order('created_at', { ascending: false }).limit(3);
      if (drafts) setSavedDrafts(drafts);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (classId: string) => {
    try {
      const cls = classes.find(c => c.id === classId) || classes[0];
      const targetClassId = cls?.linked_class_id || classId;
      const { data } = await supabase.from('students').select('*').eq('class_id', targetClassId)
        .order('student_number', { ascending: true });
      if (data) {
        setStudents(data);
        setSelectedStudentIds(data.map((s: any) => s.id));
        await loadSavedDrafts(classId, data);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const loadSavedDrafts = async (classId: string, studentList: any[]) => {
    try {
      const ids = studentList.map((s: any) => s.id);
      const { data: evals } = await supabase
        .from('student_evaluations')
        .select('student_id, setech_content, status')
        .in('student_id', ids)
        .eq('class_id', classId)
        .eq('academic_year', new Date().getFullYear())
        .neq('setech_content', '');
      if (evals && evals.length > 0) {
        const drafts: StudentDraft[] = evals
          .filter(e => e.setech_content)
          .map(e => {
            const stu = studentList.find((s: any) => s.id === e.student_id);
            return { studentId: e.student_id, name: stu?.full_name || '알 수 없음', content: e.setech_content, isExpanded: false, isCopied: false };
          });
        if (drafts.length > 0) { setDraftResults(drafts); setShowDraft(true); }
      }
    } catch { /* 조용히 실패 */ }
  };

  const fetchObsStats = async (classId: string) => {
    try {
      const cls = classes.find(c => c.id === classId);
      const targetClassId = cls?.linked_class_id || classId;
      const { data: studentIds } = await supabase.from('students').select('id').eq('class_id', targetClassId);
      if (!studentIds || studentIds.length === 0) { setObsCount(0); setRecentObsTime(null); return; }
      const ids = studentIds.map(s => s.id);
      const { count, data: recent } = await supabase.from('observations').select('created_at', { count: 'exact' }).in('student_id', ids).order('created_at', { ascending: false }).limit(1);
      setObsCount(count || 0);
      if (recent && recent.length > 0) {
        const diff = Math.floor((Date.now() - new Date(recent[0].created_at).getTime()) / 60000);
        if (diff < 60) setRecentObsTime(`${diff}분 전`);
        else if (diff < 1440) setRecentObsTime(`${Math.floor(diff / 60)}시간 전`);
        else setRecentObsTime(`${Math.floor(diff / 1440)}일 전`);
      } else { setRecentObsTime(null); }
    } catch (e) { console.error(e); }
  };

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedClassId(id);
    setStudents([]);
    setSelectedStudentIds([]);
    setSearchQuery('');
    fetchStudents(id);
    setShowDraft(false);
    setDraftResults([]);
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const filtered = students.filter(s =>
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredIds = filtered.map(s => s.id);
    const allSelected = filteredIds.every(id => selectedStudentIds.includes(id));
    if (allSelected) {
      setSelectedStudentIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedStudentIds(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };


  // 학생 1명씩 Gemini 호출
  const generateForStudent = async (
    _studentName: string,
    observations: { activity_name: string; content: string }[],
    docType: string,
    teacherPrompt: string,
    mode: 'school' | 'academy' = 'school'
  ): Promise<string> => {
    const obsText = observations.length > 0
      ? observations.map(o => `활동명: ${o.activity_name}\n내용: ${o.content}`).join('\n---\n')
      : '제출된 관찰 기록이 없습니다.';

    const isAcademy = mode === 'academy';
    const prompt = isAcademy
      ? `
당신은 학원·교습소에서 학부모에게 학생의 성장을 안내하는 전문 AI 어시스턴트입니다.
${SYSTEM_INSTRUCTIONS.PARENT_REPORT_GUIDE}
${SYSTEM_INSTRUCTIONS.PRIVACY}

${teacherPrompt ? `[강사 추가 지침]\n${teacherPrompt}\n` : ''}

아래는 수강생의 수업 관찰 기록입니다.
이 기록을 바탕으로 학부모에게 전달할 학원 성장 보고서를 작성해주세요.

[보고서 구성 — 하나의 자연스러운 문단으로]
1. 이번 기간 주요 학습 성취 및 활동
2. 수업 태도 및 참여도
3. 두드러진 강점 및 성장한 부분
4. 앞으로의 학습 방향과 응원 메시지

문구만 출력하고 학생 이름, 마크다운, 번호 목록, 설명 등은 포함하지 마세요.

[수강생 관찰 기록]
${obsText}
`
      : `
${SYSTEM_INSTRUCTIONS.BASE}
${SYSTEM_INSTRUCTIONS.SEATUK_GUIDE}
${SYSTEM_INSTRUCTIONS.PRIVACY}

${teacherPrompt ? `[선생님 추가 지침]\n${teacherPrompt}\n` : ''}

아래는 학생의 관찰 기록입니다.
이 기록을 바탕으로 ${docType} 초안을 작성해주세요.
문구만 출력하고 학생 이름, 마크다운, 설명 등은 포함하지 마세요.

[학생 관찰 기록]
${obsText}
`;
    const result = await seatukDraftAI.generateContent(prompt);
    return result.response.text().trim();
  };

  const handleGenerate = async () => {
    if (!selectedClassId) return;

    const isNotPro = !checkIsPro(profile);

    if (isNotPro) {
      // Pro 미만 — 다중 학생 일괄 생성 차단
      if (selectedStudentIds.length > 1) {
        setUpgradeReason('ai_bulk');
        setUpgradeOpen(true);
        return;
      }
      // 플랜별 월별 한도 체크 (free=20, basic=100, pro=500)
      const monthlyLimit = getAiMonthlyLimit(profile);
      if (monthAiCount >= monthlyLimit) {
        setUpgradeReason('ai_limit');
        setUpgradeOpen(true);
        return;
      }
    }

    setIsGenerating(true);
    setShowDraft(false);
    setDraftResults([]);
    setProgress({ current: 0, total: 0 });

    let localAiCount = monthAiCount;

    try {
      const docType = isHomeroom ? '행동특성 및 종합의견(행특)' : '교과 세부능력 및 특기사항(세특)';
      const teacherPrompt = selectedClass?.teacher_report_prompt || '';

      // 선택된 학생 목록 사용 (selectedStudentIds 기반)
      const studentList = students
        .filter(s => selectedStudentIds.includes(s.id))
        .map(s => ({ id: s.id, full_name: s.full_name }));

      if (studentList.length === 0) {
        alert('생성할 학생을 1명 이상 선택해주세요.');
        setIsGenerating(false);
        return;
      }

      const ids = studentList.map(s => s.id);

      // 전체 관찰기록 한 번에 조회
      const { data: allObs, error } = await supabase
        .from('observations')
        .select('content, activity_name, student_id')
        .in('student_id', ids);
      if (error) throw error;

      // 학생별 관찰기록 그룹화
      const obsByStudent: Record<string, { activity_name: string; content: string }[]> = {};
      studentList.forEach(s => { obsByStudent[s.id] = []; });
      allObs?.forEach(o => {
        if (obsByStudent[o.student_id]) obsByStudent[o.student_id].push(o);
      });

      // 관찰기록 있는 학생만
      const targetStudents = studentList.filter(s => obsByStudent[s.id].length > 0);
      if (targetStudents.length === 0) {
        alert('관찰 기록이 있는 학생이 없습니다.');
        setIsGenerating(false);
        return;
      }

      setProgress({ current: 0, total: targetStudents.length });
      const results: StudentDraft[] = [];

      // 학생별 순차 생성
      for (let i = 0; i < targetStudents.length; i++) {
        const student = targetStudents[i];
        setGeneratingName(student.full_name);
        setProgress({ current: i + 1, total: targetStudents.length });

        const content = await generateForStudent(
          student.full_name,
          obsByStudent[student.id],
          docType,
          teacherPrompt,
          reportMode
        );
        results.push({ studentId: student.id, name: student.full_name, content, isExpanded: true, isCopied: false });
        setDraftResults([...results]);
        setShowDraft(true);

        // student_evaluations에 자동 저장
        try {
          await supabase.from('student_evaluations').upsert({
            student_id: student.id,
            class_id: selectedClassId,
            teacher_id: user?.id,
            academic_year: new Date().getFullYear(),
            setech_content: content,
            status: 'draft',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'student_id,class_id,academic_year' });
        } catch { /* 저장 실패해도 생성 계속 */ }

        // 행특(homeroom)이면 students.behavior_insight에도 저장
        if (isHomeroom) {
          try {
            await supabase.from('students').update({ behavior_insight: content }).eq('id', student.id);
          } catch { /* 조용히 실패 */ }
        }

        // 카운트는 서버(api/gemini.ts)가 처리 — 클라이언트는 로컬 표시만 업데이트
        localAiCount += 1;
        setMonthAiCount(localAiCount);
      }
    } catch (err) {
      console.error(err);
      alert('AI 초안 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
      setGeneratingName('');
    }
  };

  const applyRefineForStudent = async (index: number, refineType: string) => {
    const draft = draftResults[index];
    if (!draft) return;
    setIsGenerating(true);
    try {
      const prompt = `다음 학생 기록 초안을 "${refineType}" 해주세요. 결과물 텍스트만 출력하세요.\n\n원본:\n${draft.content}`;
      const result = await seatukRefineAI.generateContent(prompt);
      const updated = [...draftResults];
      updated[index] = { ...draft, content: result.response.text().trim() };
      setDraftResults(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyStudent = (index: number) => {
    navigator.clipboard.writeText(draftResults[index].content);
    const updated = [...draftResults];
    updated[index] = { ...updated[index], isCopied: true };
    setDraftResults(updated);
    setTimeout(() => {
      const reset = [...draftResults];
      reset[index] = { ...reset[index], isCopied: false };
      setDraftResults(reset);
    }, 1500);
  };

  const handleDeleteDraft = async (index: number) => {
    const draft = draftResults[index];
    if (!draft) return;
    setDraftResults(prev => prev.map((d, i) => i === index ? { ...d, isDeleting: true } : d));
    try {
      await supabase.from('student_evaluations').update({
        setech_content: '',
        status: 'empty',
        updated_at: new Date().toISOString(),
      }).eq('student_id', draft.studentId).eq('class_id', selectedClassId).eq('academic_year', new Date().getFullYear());
      if (isHomeroom) {
        await supabase.from('students').update({ behavior_insight: '' }).eq('id', draft.studentId);
      }
      setDraftResults(prev => prev.filter((_, i) => i !== index));
      if (draftResults.length <= 1) setShowDraft(false);
    } catch {
      setDraftResults(prev => prev.map((d, i) => i === index ? { ...d, isDeleting: false } : d));
    }
  };

  const toggleExpand = (index: number) => {
    const updated = [...draftResults];
    updated[index] = { ...updated[index], isExpanded: !updated[index].isExpanded };
    setDraftResults(updated);
  };

  const updateContent = (index: number, content: string) => {
    const updated = [...draftResults];
    updated[index] = { ...updated[index], content };
    setDraftResults(updated);
  };

  const handlePrintAll = () => {
    const w = window.open('', '_blank');
    if (w) {
      const printLabel = reportMode === 'academy' ? '학원 학부모 보고서' : (isHomeroom ? '행동특성 및 종합의견' : '교과 세부능력 및 특기사항');
      const html = draftResults.map(d => `
        <div style="margin-bottom:40px;border-bottom:1px solid #eee;padding-bottom:40px">
          <h3 style="font-size:16px;font-weight:bold;margin-bottom:12px">${d.name} — ${printLabel}</h3>
          <p style="line-height:2;font-size:14px;white-space:pre-wrap">${d.content}</p>
        </div>
      `).join('');
      w.document.write(`<html><body style="font-family:sans-serif;padding:40px;max-width:800px;margin:auto">${html}</body></html>`);
      w.print();
    }
  };

  const docType = isHomeroom ? '행동특성 및 종합의견(행특)' : '교과 세부능력 및 특기사항(세특)';
  const displayType = reportMode === 'academy' ? '학원 학부모 보고서' : docType;

  // School 플랜 차단
  if (profile?.plan === 'school') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md text-center space-y-5 p-10 bg-white rounded-3xl border border-violet-100 shadow-xl">
          <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto text-3xl">🏫</div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-violet-900">School 플랜 — 열람 전용</h2>
            <p className="text-sm text-violet-700 leading-relaxed">
              School 플랜은 초대된 클래스를 열람하는 관찰자 역할입니다.<br />
              AI 세특 기능은 Free 또는 Pro 플랜에서 사용 가능합니다.
            </p>
          </div>
          <a href="mailto:aklabs84@naver.com?subject=생기로그 플랜 문의"
            className="inline-block px-6 py-3 bg-violet-500 text-white text-sm font-bold rounded-xl hover:bg-violet-600 transition-colors">
            플랜 문의하기
          </a>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
      {/* Header */}
      <div className="px-2">
        <p className="text-primary font-bold text-xs uppercase tracking-widest mb-3">Intelligence Engine</p>
        <h1 className="text-xl md:text-4xl font-extrabold font-manrope mb-4">
          {isHomeroom ? 'AI 종합 생기부/행특 초안 생성' : 'AI 교과 세특 초안 생성'}
        </h1>
        <p className="text-on-surface-variant text-base max-w-2xl leading-relaxed">
          {isHomeroom
            ? '학생별 관찰 기록을 바탕으로 행동특성 및 종합의견 초안을 학생 1명씩 생성합니다.'
            : '학생별 관찰 기록을 바탕으로 교과 세부능력 및 특기사항 초안을 학생 1명씩 생성합니다.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
        {/* 왼쪽: 설정 패널 */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="surface-card p-5 md:p-8 shadow-ambient border-l-4 border-primary">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-3">
              <Users size={22} className="text-primary" /> 대상 학급 선택
            </h2>

            <div className="space-y-6">
              {/* 학급 선택 */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">학급</label>
                <div className="relative">
                  <select value={selectedClassId} onChange={handleClassChange}
                    className="w-full pl-4 pr-10 py-3 bg-surface-container rounded-xl text-sm font-bold appearance-none focus:ring-2 focus:ring-primary/20 transition-all">
                    {loading ? <option>로딩 중...</option>
                      : classes.length > 0 ? classes.map(c => (
                        <option key={c.id} value={c.id}>[{c.class_type === 'homeroom' ? '담임반' : '교과반'}] {c.name} - {c.subject}</option>
                      )) : <option>등록된 학급이 없습니다</option>}
                  </select>
                  <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                </div>
              </div>

              {/* 학생 선택 목록 */}
              {students.length > 0 && (
                <div className="space-y-2">
                  {/* 검색 + 전체 선택 헤더 */}
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                      학생 선택
                      <span className="ml-1.5 text-primary font-black">
                        {selectedStudentIds.length}/{students.length}명
                      </span>
                    </label>
                    <button onClick={toggleAll}
                      className="text-[10px] font-black text-primary hover:text-secondary transition-colors">
                      {students.filter(s => s.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .every(s => selectedStudentIds.includes(s.id)) ? '전체 해제' : '전체 선택'}
                    </button>
                  </div>

                  {/* 검색 */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
                    <input type="text" placeholder="이름 검색..." value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 bg-surface-container rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary/20 transition-all" />
                  </div>

                  {/* 학생 체크박스 목록 */}
                  <div className="max-h-52 overflow-y-auto rounded-2xl border border-surface-container-high bg-surface-container-low custom-scrollbar">
                    {students
                      .filter(s => s.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((s, idx) => {
                        const isSelected = selectedStudentIds.includes(s.id);
                        return (
                          <button key={s.id} onClick={() => toggleStudent(s.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all border-b border-surface-container last:border-0 ${isSelected ? 'bg-primary/5' : 'hover:bg-surface-container'}`}>
                            <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-primary border-primary' : 'border-neutral-300'}`}>
                              {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                            </div>
                            <span className="text-[10px] text-on-surface-variant/40 w-5 shrink-0">
                              {s.student_number || idx + 1}
                            </span>
                            <span className={`text-xs font-bold flex-1 ${isSelected ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>
                              {s.full_name}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* 관찰 현황 */}
              <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-2xl border border-surface-container-high">
                <div>
                  <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">관찰 기록 현황</p>
                  <p className="text-xs text-on-surface-variant/60 mt-0.5">{recentObsTime ? `최근: ${recentObsTime}` : '기록 없음'}</p>
                </div>
                <div className={`px-3 py-1.5 rounded-xl text-[11px] font-black ${obsCount > 0 ? 'bg-primary-container text-primary' : 'bg-surface-container text-on-surface-variant/50'}`}>
                  {obsCount}개
                </div>
              </div>

              {/* 용도 선택 */}
              <div className="p-3 bg-surface-container-low rounded-2xl border border-surface-container-high">
                <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">사용 목적</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { value: 'school', label: '🏫 학교 세특/행특', desc: '생활기록부용' },
                    { value: 'academy', label: '📋 학원 보고서', desc: '학부모 전달용' },
                  ].map(({ value, label, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setReportMode(value as 'school' | 'academy')}
                      className={`px-3 py-2.5 rounded-xl text-left transition-all border ${
                        reportMode === value
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'bg-white border-surface-container-high text-on-surface-variant/60 hover:bg-surface-container'
                      }`}
                    >
                      <p className="text-[11px] font-black">{label}</p>
                      <p className="text-[9px] mt-0.5 opacity-70">{desc}</p>
                    </button>
                  ))}
                </div>

                {/* 학원 보고서 형식 미리보기 */}
                {reportMode === 'academy' && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1.5">보고서 형식 예시</p>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      이번 달 ○○ 학생은 수업 중 적극적으로 질문하며 개념 이해도가 크게 향상되었습니다.
                      특히 문제 풀이 후 오답 원인을 스스로 분석하는 습관이 자리 잡혀 눈에 띄는 성장을 보였습니다.
                      앞으로도 현재 페이스를 유지한다면 목표 달성이 충분히 가능합니다. 함께 응원하겠습니다!
                    </p>
                    <p className="text-[9px] text-blue-500 mt-2">· 친근한 문어체 · 200~300자 · 성장 중심 서술</p>
                  </div>
                )}
              </div>

              {/* 생성 타입 안내 */}
              <div className="p-3 bg-primary/5 rounded-2xl border border-primary/10">
                <p className="text-[11px] font-black text-primary uppercase tracking-widest mb-1">생성 유형</p>
                <p className="text-xs font-bold text-on-surface-variant">
                  {reportMode === 'academy' ? '학원 학부모 성장 보고서' : docType}
                </p>
                <p className="text-[10px] text-on-surface-variant/50 mt-1">학생 1명 × 1개 초안 순차 생성</p>
              </div>

              {/* 생성 버튼 */}
              <button onClick={handleGenerate}
                disabled={isGenerating || obsCount === 0 || selectedStudentIds.length === 0}
                className="w-full btn-gradient py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {isGenerating ? (
                  <>
                    <RotateCw size={18} className="animate-spin" />
                    <span>{generatingName ? `${generatingName} (${progress.current}/${progress.total})` : '준비 중...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>
                      {reportMode === 'academy' ? '학원 보고서' : (isHomeroom ? '행특' : '세특')} 초안 생성
                      {selectedStudentIds.length > 0 && ` (${selectedStudentIds.length}명)`}
                    </span>
                  </>
                )}
              </button>
              {selectedStudentIds.length === 0 && <p className="text-center text-xs text-on-surface-variant/60">학생을 1명 이상 선택해주세요.</p>}
              {obsCount === 0 && selectedStudentIds.length > 0 && <p className="text-center text-xs text-on-surface-variant/60">활동 기록을 먼저 등록해야 합니다.</p>}

              {/* AI 데이터 처리 안내 */}
              <div className="flex items-start gap-2 px-3 py-2 bg-blue-50/60 border border-blue-100 rounded-xl">
                <svg className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11H9v2h2V7zm0 4H9v4h2v-4z" clipRule="evenodd"/></svg>
                <p className="text-[10px] text-blue-500 leading-relaxed">
                  학생 이름은 AI에 전송되지 않으며, 입력 데이터는 AI 모델 학습에 사용되지 않습니다.
                </p>
              </div>

              {/* 이번 달 AI 사용량 표시 */}
              {!checkIsPro(profile) && (
                <div className={`px-4 py-3 rounded-2xl border ${
                  monthAiCount >= aiMonthlyLimit
                    ? 'bg-red-50 border-red-200'
                    : monthAiCount >= aiMonthlyLimit * 0.8
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-surface-container-low border-surface-container-high'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={13} className={
                        monthAiCount >= aiMonthlyLimit ? 'text-red-400' :
                        monthAiCount >= aiMonthlyLimit * 0.8 ? 'text-amber-400' : 'text-primary/50'
                      } />
                      <span className="text-[11px] font-bold text-on-surface-variant">이번 달 AI 사용량</span>
                    </div>
                    <span className={`text-[11px] font-black ${
                      monthAiCount >= aiMonthlyLimit ? 'text-red-500' :
                      monthAiCount >= aiMonthlyLimit * 0.8 ? 'text-amber-500' : 'text-on-surface-variant'
                    }`}>
                      {monthAiCount}/{aiMonthlyLimit}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        monthAiCount >= aiMonthlyLimit ? 'bg-red-400' :
                        monthAiCount >= aiMonthlyLimit * 0.8 ? 'bg-amber-400' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min((monthAiCount / aiMonthlyLimit) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-on-surface-variant/60 mt-1">매월 1일 자동 초기화</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-5 bg-surface-container-low rounded-3xl flex items-start gap-3 border border-surface-container-high opacity-80">
            <div className="w-8 h-8 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary mt-0.5 shrink-0">
              <Check size={16} />
            </div>
            <div>
              <h3 className="font-bold text-sm mb-1">검토 필요</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">AI 초안은 제안 사항이며, 공식 기록 전 교사의 검토가 필요합니다.</p>
            </div>
          </div>
        </div>

        {/* 오른쪽: 학생별 초안 목록 */}
        <div className="col-span-12 lg:col-span-8">
          <AnimatePresence mode="wait">
            {showDraft && draftResults.length > 0 ? (
              <motion.div key="drafts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-4">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <FileText size={20} className="text-primary" />
                      {displayType} 초안
                    </h2>
                    <p className="text-xs text-on-surface-variant/60 mt-0.5">
                      {draftResults.length}명 생성됨
                      {isGenerating && progress.total > 0 && ` · ${progress.current}/${progress.total} 진행 중`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handlePrintAll}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-xs font-bold transition-all">
                      <Printer size={14} /> 전체 인쇄
                    </button>
                    <button onClick={() => { setShowDraft(false); setDraftResults([]); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-red-50 text-red-400 text-xs font-bold transition-all">
                      <Trash2 size={14} /> 초기화
                    </button>
                  </div>
                </div>

                {/* 학생별 카드 */}
                {draftResults.map((draft, index) => (
                  <motion.div key={`${draft.name}-${index}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="surface-card shadow-ambient border-l-4 border-primary/30 overflow-hidden">

                    {/* 카드 헤더 */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-surface-container">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-black text-sm">{draft.name}</p>
                          <p className="text-[10px] text-on-surface-variant/50 font-bold">{displayType}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => copyStudent(index)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${draft.isCopied ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container text-on-surface-variant'}`}>
                          {draft.isCopied ? <Check size={13} /> : <Copy size={13} />}
                          {draft.isCopied ? '복사됨' : '복사'}
                        </button>
                        <button onClick={() => handleDeleteDraft(index)} disabled={draft.isDeleting}
                          className="p-1.5 rounded-xl hover:bg-red-50 hover:text-red-500 text-on-surface-variant/40 transition-all disabled:opacity-50" title="초안 삭제">
                          {draft.isDeleting ? <ArrowRight size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                        <button onClick={() => toggleExpand(index)}
                          className="p-1.5 rounded-xl hover:bg-surface-container text-on-surface-variant transition-all">
                          {draft.isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* 초안 본문 */}
                    <AnimatePresence>
                      {draft.isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }} className="overflow-hidden">
                          <div className="px-5 pt-4">
                            <textarea value={draft.content} onChange={e => updateContent(index, e.target.value)}
                              className="w-full min-h-[180px] p-3 text-sm font-medium leading-relaxed bg-surface-container/40 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-transparent focus:border-primary/20"
                            />
                          </div>

                          {/* 다듬기 툴바 */}
                          <div className="px-5 pb-4 pt-2 flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest mr-1">다듬기</span>
                            {[
                              { label: '부드럽게 교정', cmd: '어문 규범에 맞게 교정하고 더 자연스럽게 수정' },
                              { label: '내용 축소', cmd: '핵심만 50% 분량으로 축소' },
                              { label: '전문적인 어조', cmd: '명사형 종결어미(~함, ~임)를 사용하고 객관적 관찰자 시점의 전문적인 어조로 수정' },
                            ].map(({ label, cmd }) => (
                              <button key={label} disabled={isGenerating} onClick={() => applyRefineForStudent(index, cmd)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-[11px] font-bold transition-all disabled:opacity-40">
                                <RotateCw size={12} className={isGenerating ? 'animate-spin' : ''} />
                                {label}
                              </button>
                            ))}
                            <button onClick={() => applyRefineForStudent(index, '더 구체적인 사례와 역량 중심으로 보완')}
                              disabled={isGenerating}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-[11px] font-bold transition-all disabled:opacity-40">
                              <Sparkles size={12} className="text-primary" />
                              구체화
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}

                {/* 생성 중 스켈레톤 */}
                {isGenerating && (
                  <div className="surface-card shadow-ambient border-l-4 border-primary/20 p-5 flex items-center gap-4 animate-pulse">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <RotateCw size={16} className="text-primary animate-spin" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-on-surface/60">{generatingName} 초안 생성 중...</p>
                      <p className="text-xs text-on-surface-variant/40">{progress.current}/{progress.total}번째 학생</p>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="surface-card shadow-ambient min-h-[400px] flex flex-col items-center justify-center gap-6 text-center p-16">
                <div className="w-20 h-20 bg-primary/8 rounded-3xl flex items-center justify-center">
                  <BookOpen size={36} className="text-primary/40" />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-black text-on-surface/60">아직 생성된 초안이 없습니다</p>
                  <p className="text-sm text-on-surface-variant/50">학급을 선택한 뒤<br/>생성 버튼을 눌러주세요.</p>
                  <p className="text-xs text-on-surface-variant/40 mt-2">학생별로 개별 초안이 생성됩니다</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 최근 저장 초안 */}
      {savedDrafts.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold font-manrope px-2">최근 AI 초안</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {savedDrafts.map((item) => (
              <div key={item.id}
                onClick={() => {
                  setDraftResults([{ studentId: '', name: '불러온 초안', content: item.content, isExpanded: true, isCopied: false }]);
                  setShowDraft(true);
                }}
                className="p-6 surface-card shadow-ambient hover:translate-y-[-4px] transition-all cursor-pointer border-t-4 border-primary/20 hover:border-primary">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRight size={16} className="text-primary" />
                  <span className="text-xs font-bold text-primary">{item.class_name || '저장된 초안'}</span>
                </div>
                <p className="text-sm font-medium text-on-surface-variant/70 line-clamp-4 leading-relaxed">{item.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason={upgradeReason}
      />
    </motion.div>
  );
};

export default AIAssistant;
