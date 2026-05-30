import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { geminiPro, SYSTEM_INSTRUCTIONS } from '../../lib/gemini';
import { useAuth } from '../../lib/auth';
import {
  ChevronDown, ChevronUp, Check, RotateCw, Sparkles,
  Download, AlertCircle, Search, Save, FileSpreadsheet,
} from 'lucide-react';

interface StudentRow {
  id: string;
  full_name: string;
  student_number: string;
  obs_count: number;
  observations: { activity_name: string; content: string }[];
  eval_id?: string;
  achievement_level: '상' | '중' | '하' | null;
  setech_content: string;
  status: 'empty' | 'draft' | 'final';
  isDirty: boolean;
}

const STATUS_LABELS = { empty: '미작성', draft: '초안', final: '완료' };
const STATUS_COLORS: Record<string, string> = {
  empty: 'text-neutral-400 bg-neutral-50 border border-neutral-200',
  draft: 'text-amber-600 bg-amber-50 border border-amber-200',
  final: 'text-emerald-600 bg-emerald-50 border border-emerald-200',
};
const LEVEL_COLORS: Record<string, string> = {
  상: 'bg-blue-50 border-blue-200 text-blue-700',
  중: 'bg-amber-50 border-amber-200 text-amber-700',
  하: 'bg-rose-50 border-rose-200 text-rose-700',
};

const charCount = (text: string) => text.length;
const byteCount = (text: string) => {
  let b = 0;
  for (const ch of text) b += ch.charCodeAt(0) > 127 ? 3 : 1;
  return b;
};
const sanitizeForNaiss = (text: string) =>
  text.replace(/[<>&"'\\]/g, ' ').replace(/\s+/g, ' ').trim();

interface Props {
  classes: any[];
}

const NaissWorkstation = ({ classes }: Props) => {
  const { user } = useAuth();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'empty' | 'draft' | 'final'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [dbError, setDbError] = useState(false);

  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) setSelectedClassId(classes[0].id);
  }, [classes]);

  useEffect(() => {
    if (selectedClassId) fetchData(selectedClassId);
  }, [selectedClassId, academicYear]);

  const fetchData = async (classId: string) => {
    setIsLoading(true);
    setDbError(false);
    try {
      const cls = classes.find(c => c.id === classId);
      const targetClassId = cls?.linked_class_id || classId;

      const { data: students } = await supabase
        .from('students').select('id, full_name, student_number')
        .eq('class_id', targetClassId);

      if (!students?.length) { setRows([]); return; }

      const ids = students.map(s => s.id);

      const { data: obs } = await supabase
        .from('observations').select('student_id, activity_name, content')
        .in('student_id', ids).eq('is_student_record', true)
        .in('status', ['approved', 'pending']);

      const obsByStudent: Record<string, { activity_name: string; content: string }[]> = {};
      ids.forEach(id => { obsByStudent[id] = []; });
      obs?.forEach(o => { if (obsByStudent[o.student_id]) obsByStudent[o.student_id].push(o); });

      let evalMap: Record<string, any> = {};
      try {
        const { data: evals, error } = await supabase
          .from('student_evaluations').select('*')
          .in('student_id', ids).eq('class_id', classId).eq('academic_year', academicYear);
        if (error) setDbError(true);
        evals?.forEach(e => { evalMap[e.student_id] = e; });
      } catch { setDbError(true); }

      setRows(
        students
          .sort((a, b) => (parseInt(a.student_number) || 999) - (parseInt(b.student_number) || 999))
          .map(s => {
            const ev = evalMap[s.id];
            return {
              id: s.id,
              full_name: s.full_name,
              student_number: s.student_number || '-',
              obs_count: obsByStudent[s.id].length,
              observations: obsByStudent[s.id],
              eval_id: ev?.id,
              achievement_level: ev?.achievement_level || null,
              setech_content: ev?.setech_content || '',
              status: ev?.status || 'empty',
              isDirty: false,
            };
          })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const updateRow = (id: string, changes: Partial<StudentRow>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...changes, isDirty: true } : r));
  };

  const saveRow = async (row: StudentRow) => {
    setSavingId(row.id);
    try {
      const newStatus: StudentRow['status'] = row.setech_content
        ? (row.status === 'final' ? 'final' : 'draft') : 'empty';
      const { data, error } = await supabase.from('student_evaluations').upsert({
        ...(row.eval_id ? { id: row.eval_id } : {}),
        student_id: row.id,
        class_id: selectedClassId,
        teacher_id: user?.id,
        academic_year: academicYear,
        achievement_level: row.achievement_level,
        setech_content: row.setech_content,
        status: newStatus,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,class_id,academic_year' }).select().single();
      if (!error && data) {
        setRows(prev => prev.map(r => r.id === row.id
          ? { ...r, eval_id: data.id, status: newStatus, isDirty: false } : r));
      }
    } finally {
      setSavingId(null);
    }
  };

  const markFinal = async (row: StudentRow) => {
    const updated: StudentRow = { ...row, status: 'final' };
    setRows(prev => prev.map(r => r.id === row.id ? updated : r));
    await saveRow(updated);
  };

  const generateAI = async (row: StudentRow) => {
    if (!row.observations.length) { alert('관찰 기록이 없는 학생입니다.'); return; }
    setGeneratingId(row.id);
    try {
      const cls = classes.find(c => c.id === selectedClassId);
      const docType = cls?.class_type === 'homeroom'
        ? '행동특성 및 종합의견(행특)' : '교과 세부능력 및 특기사항(세특)';
      const obsText = row.observations.map(o => `활동명: ${o.activity_name}\n내용: ${o.content}`).join('\n---\n');
      const prompt = `${SYSTEM_INSTRUCTIONS.BASE}\n${SYSTEM_INSTRUCTIONS.SEATUK_GUIDE}\n아래는 ${row.full_name} 학생의 관찰 기록입니다.\n이를 바탕으로 ${docType} 초안을 500자 이내로 작성하세요.\n문구만 출력하세요.\n\n${obsText}`;
      const result = await geminiPro.generateContent(prompt);
      const content = result.response.text().trim().slice(0, 500);
      updateRow(row.id, { setech_content: content, status: 'draft' });
    } catch { alert('AI 생성 중 오류가 발생했습니다.'); }
    finally { setGeneratingId(null); }
  };

  const saveAllDirty = async () => {
    const dirtyRows = rows.filter(r => r.isDirty);
    for (const row of dirtyRows) await saveRow(row);
  };

  const exportToExcel = () => {
    const cls = classes.find(c => c.id === selectedClassId);
    const wb = XLSX.utils.book_new();

    // 시트 1: 나이스 제출용
    const naissData = rows.map(r => ({
      '반': cls?.name || '',
      '번호': r.student_number,
      '이름': r.full_name,
      '성취도': r.achievement_level || '',
      '세부능력및특기사항': sanitizeForNaiss(r.setech_content),
    }));
    const ws1 = XLSX.utils.json_to_sheet(naissData);
    ws1['!cols'] = [{ wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 65 }];
    XLSX.utils.book_append_sheet(wb, ws1, '나이스제출');

    // 시트 2: 전체 현황
    const fullData = rows.map(r => ({
      '반': cls?.name || '',
      '번호': r.student_number,
      '이름': r.full_name,
      '성취도': r.achievement_level || '',
      '세특내용': r.setech_content,
      '글자수': charCount(r.setech_content),
      '바이트': byteCount(r.setech_content),
      '관찰기록수': r.obs_count,
      '상태': STATUS_LABELS[r.status],
    }));
    const ws2 = XLSX.utils.json_to_sheet(fullData);
    ws2['!cols'] = [{ wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 55 }, { wch: 7 }, { wch: 7 }, { wch: 9 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws2, '전체현황');

    XLSX.writeFile(wb, `${cls?.name || '학급'}_나이스세특_${academicYear}.xlsx`);
  };

  // 필터
  const filtered = rows.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (searchQuery && !r.full_name.includes(searchQuery) && !r.student_number.includes(searchQuery)) return false;
    return true;
  });

  const completedCount = rows.filter(r => r.status === 'final').length;
  const draftCount = rows.filter(r => r.status === 'draft').length;
  const emptyCount = rows.filter(r => r.status === 'empty').length;
  const dirtyCount = rows.filter(r => r.isDirty).length;
  const progressPct = rows.length > 0 ? Math.round((completedCount / rows.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* DB 테이블 없음 안내 */}
      {dbError && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm">
          <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-black text-amber-800">student_evaluations 테이블을 먼저 만들어야 합니다</p>
            <p className="text-amber-700 mt-1">Supabase 대시보드 → SQL Editor에서 아래 SQL을 실행하세요:</p>
            <pre className="mt-2 p-3 bg-amber-100 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`CREATE TABLE student_evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES auth.users(id),
  academic_year SMALLINT NOT NULL DEFAULT 2025,
  achievement_level TEXT CHECK (achievement_level IN ('상','중','하')),
  setech_content TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'empty',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, class_id, academic_year)
);
ALTER TABLE student_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher_own" ON student_evaluations
  FOR ALL USING (teacher_id = auth.uid());`}
            </pre>
            <p className="text-amber-600 text-xs mt-2">테이블 생성 후 페이지를 새로고침하면 저장 기능이 활성화됩니다. 그 전까지는 편집만 가능합니다.</p>
          </div>
        </div>
      )}

      {/* 상단 컨트롤 */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
            className="pl-3 pr-8 py-2.5 bg-white border-2 border-neutral-200 rounded-xl text-sm font-bold appearance-none focus:border-primary/40 outline-none">
            {classes.map(c => <option key={c.id} value={c.id}>[{c.class_type === 'homeroom' ? '담임' : '교과'}] {c.name} - {c.subject}</option>)}
          </select>
          <select value={academicYear} onChange={e => setAcademicYear(Number(e.target.value))}
            className="pl-3 pr-8 py-2.5 bg-white border-2 border-neutral-200 rounded-xl text-sm font-bold appearance-none focus:border-primary/40 outline-none">
            {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}학년도</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {dirtyCount > 0 && (
            <button onClick={saveAllDirty} disabled={!!savingId}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs transition-all">
              <Save size={13} />
              전체 저장 ({dirtyCount})
            </button>
          )}
          <button onClick={exportToExcel} disabled={!rows.length}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-white font-black text-xs transition-all shadow-sm disabled:opacity-40">
            <FileSpreadsheet size={14} />
            나이스 엑셀 다운로드
          </button>
        </div>
      </div>

      {/* 완성도 바 */}
      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant">
            <div className="flex items-center gap-4">
              <span className="text-emerald-600">✅ 완료 {completedCount}명</span>
              <span className="text-amber-500">✏️ 초안 {draftCount}명</span>
              <span className="text-neutral-400">⚪ 미작성 {emptyCount}명</span>
            </div>
            <span className="font-black text-primary">{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* 필터 + 검색 */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-1 bg-surface-container p-1 rounded-xl">
          {([['all', '전체'], ['empty', '미작성'], ['draft', '초안'], ['final', '완료']] as [string, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setFilterStatus(k as typeof filterStatus)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${filterStatus === k ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant/60 hover:text-on-surface'}`}>
              {l} <span className="ml-0.5 opacity-60">
                {k === 'all' ? rows.length : k === 'empty' ? emptyCount : k === 'draft' ? draftCount : completedCount}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="이름/번호 검색..." className="pl-8 pr-4 py-2 bg-surface-container rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none w-44" />
        </div>
      </div>

      {/* 학생 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RotateCw size={24} className="animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant/40 font-bold">
          학급을 선택하면 학생 목록이 표시됩니다
        </div>
      ) : (
        <div className="space-y-2">
          {/* 컬럼 헤더 */}
          <div className="hidden md:grid grid-cols-[40px_32px_80px_72px_1fr_80px_48px_90px_80px] gap-2 px-4 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-wider">
            <span></span><span>번호</span><span>이름</span><span>성취도</span><span>세특 내용</span>
            <span className="text-right">글자수</span><span className="text-center">기록</span><span className="text-center">상태</span><span></span>
          </div>

          {filtered.map(row => {
            const isExpanded = expandedId === row.id;
            const chars = charCount(row.setech_content);
            const bytes = byteCount(row.setech_content);
            const isOver = chars > 500;
            const isNearLimit = chars > 440;
            const isGenerating = generatingId === row.id;
            const isSavingThis = savingId === row.id;

            return (
              <div key={row.id} className={`layered-card overflow-hidden transition-all ${isExpanded ? 'shadow-ambient ring-2 ring-primary/10' : 'shadow-sm'}`}>
                {/* 요약 행 */}
                <div
                  className="grid grid-cols-[40px_32px_80px_72px_1fr_80px_48px_90px_80px] gap-2 items-center px-4 py-3 cursor-pointer hover:bg-surface-container/30 transition-all"
                  onClick={() => setExpandedId(isExpanded ? null : row.id)}
                >
                  {/* 체크 아이콘 */}
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black ${row.status === 'final' ? 'bg-emerald-100 text-emerald-600' : row.status === 'draft' ? 'bg-amber-100 text-amber-500' : 'bg-neutral-100 text-neutral-300'}`}>
                    {row.status === 'final' ? <Check size={13} strokeWidth={3} /> : row.status === 'draft' ? '✏️' : '·'}
                  </div>
                  {/* 번호 */}
                  <span className="text-xs font-black text-on-surface-variant/30 text-center">{row.student_number}</span>
                  {/* 이름 */}
                  <span className="text-sm font-black truncate">{row.full_name}</span>
                  {/* 성취도 드롭다운 */}
                  <div onClick={e => e.stopPropagation()}>
                    <select
                      value={row.achievement_level || ''}
                      onChange={e => updateRow(row.id, { achievement_level: e.target.value as any || null })}
                      className={`w-full px-2 py-1 rounded-lg text-xs font-black border appearance-none outline-none text-center ${row.achievement_level ? LEVEL_COLORS[row.achievement_level] : 'bg-neutral-50 border-neutral-200 text-neutral-400'}`}
                    >
                      <option value="">-</option>
                      <option value="상">상</option>
                      <option value="중">중</option>
                      <option value="하">하</option>
                    </select>
                  </div>
                  {/* 세특 미리보기 */}
                  <p className="text-xs text-on-surface-variant/60 truncate">
                    {row.setech_content || <span className="text-neutral-300 italic">미작성</span>}
                  </p>
                  {/* 글자수 */}
                  <span className={`text-[10px] font-black text-right ${isOver ? 'text-red-500' : isNearLimit ? 'text-amber-500' : 'text-neutral-400'}`}>
                    {chars}/500
                  </span>
                  {/* 관찰 수 */}
                  <span className="text-[10px] font-bold text-center text-on-surface-variant/40">{row.obs_count}건</span>
                  {/* 상태 배지 */}
                  <span className={`text-[9px] font-black px-2 py-1 rounded-full text-center ${STATUS_COLORS[row.status]}`}>
                    {STATUS_LABELS[row.status]}
                  </span>
                  {/* 저장/펼치기 */}
                  <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                    {row.isDirty && (
                      <button onClick={() => saveRow(row)} disabled={!!savingId}
                        className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all">
                        {isSavingThis ? <RotateCw size={12} className="animate-spin" /> : <Save size={12} />}
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : row.id); }}
                      className="p-1.5 rounded-lg hover:bg-surface-container text-neutral-400 transition-all">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* 펼침 영역 */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                      className="overflow-hidden border-t border-surface-container"
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-2">
                        {/* 세특 편집 패널 */}
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">세특 내용 작성</p>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => generateAI(row)} disabled={!!generatingId || !row.obs_count}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-black hover:bg-primary/20 transition-all disabled:opacity-40">
                                {isGenerating ? <RotateCw size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                AI 생성
                              </button>
                              <button onClick={() => { updateRow(row.id, { setech_content: sanitizeForNaiss(row.setech_content) }); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface-variant text-[10px] font-black hover:bg-surface-container-high transition-all">
                                특수문자 정제
                              </button>
                              <button onClick={() => markFinal(row)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-black hover:bg-emerald-100 transition-all">
                                <Check size={11} /> 최종 확정
                              </button>
                            </div>
                          </div>

                          <div className="relative">
                            <textarea
                              value={row.setech_content}
                              onChange={e => updateRow(row.id, { setech_content: e.target.value })}
                              placeholder="세특 내용을 직접 입력하거나 AI 생성 버튼을 눌러주세요..."
                              className={`w-full min-h-[180px] p-3 rounded-xl text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 transition-all border ${isOver ? 'border-red-300 focus:ring-red-200 bg-red-50' : 'border-neutral-200 focus:ring-primary/20 bg-surface-container/40'}`}
                            />
                            {/* 글자수/바이트 카운터 */}
                            <div className={`absolute bottom-2 right-3 text-[10px] font-black ${isOver ? 'text-red-500' : isNearLimit ? 'text-amber-500' : 'text-neutral-400'}`}>
                              {chars}/500자 · {bytes}/1500bytes
                            </div>
                          </div>

                          {isOver && (
                            <p className="text-[10px] font-black text-red-500 flex items-center gap-1">
                              <AlertCircle size={11} /> {chars - 500}자 초과 — 나이스 입력 시 오류가 발생합니다
                            </p>
                          )}

                          {/* 저장 버튼 */}
                          {row.isDirty && (
                            <button onClick={() => saveRow(row)} disabled={!!savingId}
                              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white font-black text-sm hover:bg-primary/80 transition-all">
                              {isSavingThis ? <RotateCw size={14} className="animate-spin" /> : <Save size={14} />}
                              저장하기
                            </button>
                          )}
                        </div>

                        {/* 관찰 기록 참고 패널 */}
                        <div className="p-4 bg-surface-container/30 border-t lg:border-t-0 lg:border-l border-surface-container space-y-2">
                          <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                            관찰 기록 ({row.obs_count}건) — 참고용
                          </p>
                          {row.observations.length > 0 ? (
                            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                              {row.observations.map((o, i) => (
                                <div key={i} className="p-3 bg-white rounded-xl border border-surface-container text-xs group">
                                  <p className="font-black text-on-surface mb-1 truncate">{o.activity_name}</p>
                                  <p className="text-on-surface-variant/60 leading-relaxed line-clamp-3">{o.content}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-8 text-center text-xs text-neutral-400 italic">관찰 기록이 없습니다</div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-on-surface-variant/40 font-bold">조건에 맞는 학생이 없습니다</div>
          )}
        </div>
      )}

      {/* 엑셀 다운로드 안내 */}
      {rows.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/10 rounded-2xl text-xs">
          <Download size={16} className="text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-primary mb-1">나이스 엑셀 다운로드 시트 구성</p>
            <p className="text-on-surface-variant/70">
              <strong>시트1 나이스제출</strong>: 반·번호·이름·성취도·세부능력및특기사항 — 나이스 일괄 업로드용<br />
              <strong>시트2 전체현황</strong>: 글자수·바이트수·관찰기록수·상태 포함 전체 현황
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NaissWorkstation;
