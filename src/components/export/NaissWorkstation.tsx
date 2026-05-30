import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { geminiPro, SYSTEM_INSTRUCTIONS } from '../../lib/gemini';
import { useAuth } from '../../lib/auth';
import {
  ChevronDown, ChevronUp, Check, RotateCw, Sparkles,
  Download, AlertCircle, Search, Save, FileSpreadsheet,
  Settings2, RefreshCw, Undo2,
} from 'lucide-react';

interface ExportColumn {
  key: string;
  label: string;
  naissLabel: string; // 나이스 엑셀 실제 헤더명
  checked: boolean;
  required: boolean; // 필수 컬럼
}

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
  behavior_insight: string;
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

// 마지막 완전한 문장 단위로 500자 이내 자르기
const smartTrim = (text: string, limit = 500): string => {
  if (text.length <= limit) return text;
  const sub = text.slice(0, limit);
  // 마침표(.) 기준으로 마지막 완전한 문장 찾기
  const lastPeriod = sub.lastIndexOf('.');
  if (lastPeriod > limit * 0.5) return text.slice(0, lastPeriod + 1).trim();
  // 마침표 없으면 마지막 공백 기준
  const lastSpace = sub.lastIndexOf(' ');
  if (lastSpace > 0) return text.slice(0, lastSpace).trim();
  return sub;
};

interface Props {
  classes: any[];
}

const BehaviorInsightPanel = ({ insight, studentName }: { insight: string; studentName: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(insight);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="border-t border-surface-container px-4 py-4 bg-indigo-50/40">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">💡 행동특성 및 종합의견 초안</span>
          <span className="text-[9px] font-bold text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full">{studentName}</span>
        </div>
        <button
          onClick={copy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border ${
            copied
              ? 'bg-indigo-100 text-indigo-600 border-indigo-200'
              : 'bg-white text-indigo-500 border-indigo-200 hover:bg-indigo-50'
          }`}
        >
          {copied ? <><Check size={11} /> 복사됨!</> : <><Save size={11} /> 나이스 붙여넣기용 복사</>}
        </button>
      </div>
      <p className="text-xs text-on-surface/80 leading-relaxed whitespace-pre-wrap bg-white rounded-xl p-3 border border-indigo-100">
        {insight}
      </p>
    </div>
  );
};

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
  const [compressingId, setCompressingId] = useState<string | null>(null);
  const [dbError, setDbError] = useState(false);
  // 행 펼칠 때 setech_content 스냅샷 저장 (되돌리기용)
  const [undoSnapshots, setUndoSnapshots] = useState<Record<string, string>>({});

  const toggleExpand = (rowId: string, currentContent: string) => {
    if (expandedId !== rowId) {
      // 처음 펼칠 때만 스냅샷 저장
      setUndoSnapshots(prev => prev[rowId] !== undefined ? prev : { ...prev, [rowId]: currentContent });
    }
    setExpandedId(prev => prev === rowId ? null : rowId);
  };

  const undoRow = (rowId: string) => {
    const snapshot = undoSnapshots[rowId];
    if (snapshot === undefined) return;
    updateRow(rowId, { setech_content: snapshot, isDirty: false });
    setUndoSnapshots(prev => { const next = { ...prev }; delete next[rowId]; return next; });
  };
  const [showExportSettings, setShowExportSettings] = useState(false);
  const [isImportingDrafts, setIsImportingDrafts] = useState(false);
  const [exportColumns, setExportColumns] = useState<ExportColumn[]>([
    { key: 'class',    label: '반',               naissLabel: '반',                   checked: true,  required: false },
    { key: 'number',   label: '번호',              naissLabel: '번호',                  checked: true,  required: true  },
    { key: 'name',     label: '이름',              naissLabel: '이름',                  checked: true,  required: true  },
    { key: 'level',    label: '성취도 (상중하)',    naissLabel: '성취도',                checked: true,  required: false },
    { key: 'setech',   label: '세특 내용',          naissLabel: '세부능력및특기사항',    checked: true,  required: true  },
    { key: 'obs',      label: '관찰기록 수',        naissLabel: '관찰기록수',            checked: false, required: false },
    { key: 'chars',    label: '글자수',             naissLabel: '글자수',               checked: false, required: false },
    { key: 'status',   label: '완료 상태',          naissLabel: '상태',                  checked: false, required: false },
  ]);

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

      // behavior_insight 컬럼이 없을 수 있으므로 fallback 처리
      let students: any[] | null = null;
      const { data: s1, error: e1 } = await supabase
        .from('students').select('id, full_name, student_number, behavior_insight')
        .eq('class_id', targetClassId);
      if (!e1) {
        students = s1;
      } else {
        // behavior_insight 컬럼 없는 경우 fallback
        const { data: s2 } = await supabase
          .from('students').select('id, full_name, student_number')
          .eq('class_id', targetClassId);
        students = s2;
      }

      if (!students?.length) { setRows([]); return; }

      const ids = students.map((s: any) => s.id);

      const { data: obs } = await supabase
        .from('observations').select('student_id, activity_name, content')
        .in('student_id', ids).eq('is_student_record', true)
        .in('status', ['approved', 'pending']);

      const obsByStudent: Record<string, { activity_name: string; content: string }[]> = {};
      ids.forEach((id: string) => { obsByStudent[id] = []; });
      obs?.forEach((o: any) => { if (obsByStudent[o.student_id]) obsByStudent[o.student_id].push(o); });

      let evalMap: Record<string, any> = {};
      try {
        const { data: evals, error } = await supabase
          .from('student_evaluations').select('*')
          .in('student_id', ids).eq('class_id', classId).eq('academic_year', academicYear);
        if (error) setDbError(true);
        evals?.forEach((e: any) => { evalMap[e.student_id] = e; });
      } catch { setDbError(true); }

      setRows(
        students
          .sort((a: any, b: any) => (parseInt(a.student_number) || 999) - (parseInt(b.student_number) || 999))
          .map((s: any) => {
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
              behavior_insight: s.behavior_insight || '',
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
      const content = smartTrim(result.response.text().trim());
      updateRow(row.id, { setech_content: content, status: 'draft' });
    } catch { alert('AI 생성 중 오류가 발생했습니다.'); }
    finally { setGeneratingId(null); }
  };

  const aiCompress = async (row: StudentRow) => {
    if (!row.setech_content) return;
    setCompressingId(row.id);
    try {
      const prompt = `다음 세특 문구를 500자 이내로 자연스럽게 압축해주세요.
핵심 내용과 학생의 역량이 잘 드러나도록 유지하면서, 문장이 자연스럽게 마무리되게 해주세요.
문구만 출력하고 설명은 쓰지 마세요.

원본:
${row.setech_content}`;
      const result = await geminiPro.generateContent(prompt);
      const compressed = smartTrim(result.response.text().trim());
      updateRow(row.id, { setech_content: compressed, isDirty: true });
    } catch { alert('AI 압축 중 오류가 발생했습니다.'); }
    finally { setCompressingId(null); }
  };

  const saveAllDirty = async () => {
    const dirtyRows = rows.filter(r => r.isDirty);
    for (const row of dirtyRows) await saveRow(row);
  };

  // AI 초안 DB에서 불러오기 (AI 초안 페이지에서 저장된 것)
  const importFromAIDrafts = async () => {
    setIsImportingDrafts(true);
    try {
      let updated = 0;
      const newRows = [...rows];
      for (let i = 0; i < newRows.length; i++) {
        const r = newRows[i];
        if (r.setech_content) continue; // 이미 내용 있으면 스킵
        // student_evaluations에 AI가 저장한 draft 찾기
        const { data } = await supabase
          .from('student_evaluations')
          .select('setech_content, achievement_level, status, id')
          .eq('student_id', r.id)
          .eq('class_id', selectedClassId)
          .eq('academic_year', academicYear)
          .single();
        if (data?.setech_content && !r.setech_content) {
          newRows[i] = {
            ...r,
            setech_content: data.setech_content,
            achievement_level: data.achievement_level || r.achievement_level,
            status: data.status || 'draft',
            eval_id: data.id,
            isDirty: false,
          };
          updated++;
        }
      }
      setRows(newRows);
      if (updated > 0) alert(`${updated}명의 AI 초안을 불러왔습니다.`);
      else alert('불러올 새 AI 초안이 없습니다.\nAI 초안 페이지에서 먼저 생성해주세요.');
    } finally {
      setIsImportingDrafts(false);
    }
  };

  const exportToExcel = () => {
    const cls = classes.find(c => c.id === selectedClassId);
    const checkedCols = exportColumns.filter(c => c.checked);
    const wb = XLSX.utils.book_new();

    // 컬럼 선택 기반 데이터 빌드
    const buildRow = (r: StudentRow) => {
      const obj: Record<string, string | number> = {};
      checkedCols.forEach(col => {
        switch (col.key) {
          case 'class':   obj[col.naissLabel] = cls?.name || ''; break;
          case 'number':  obj[col.naissLabel] = r.student_number; break;
          case 'name':    obj[col.naissLabel] = r.full_name; break;
          case 'level':   obj[col.naissLabel] = r.achievement_level || ''; break;
          case 'setech':  obj[col.naissLabel] = sanitizeForNaiss(r.setech_content); break;
          case 'obs':     obj[col.naissLabel] = r.obs_count; break;
          case 'chars':   obj[col.naissLabel] = charCount(r.setech_content); break;
          case 'status':  obj[col.naissLabel] = STATUS_LABELS[r.status]; break;
        }
      });
      return obj;
    };

    // 시트 1: 선택한 컬럼만 — 나이스 제출용
    const naissData = rows.map(buildRow);
    const ws1 = XLSX.utils.json_to_sheet(naissData);
    const colWidths = checkedCols.map(c => ({ wch: c.key === 'setech' ? 65 : c.key === 'name' ? 12 : 10 }));
    ws1['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws1, '나이스제출');

    // 시트 2: 전체 현황 (고정)
    const fullData = rows.map(r => ({
      '반': cls?.name || '', '번호': r.student_number, '이름': r.full_name,
      '성취도': r.achievement_level || '',
      '세특내용': r.setech_content,
      '글자수': charCount(r.setech_content), '바이트': byteCount(r.setech_content),
      '관찰기록수': r.obs_count, '상태': STATUS_LABELS[r.status],
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
          <button onClick={importFromAIDrafts} disabled={isImportingDrafts || !rows.length}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-black text-xs transition-all disabled:opacity-40">
            {isImportingDrafts ? <RotateCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            <span className="hidden sm:inline">AI 초안 불러오기</span>
            <span className="sm:hidden">초안 불러오기</span>
          </button>
          {dirtyCount > 0 && (
            <button onClick={saveAllDirty} disabled={!!savingId}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs transition-all">
              <Save size={13} />
              전체 저장 ({dirtyCount})
            </button>
          )}
          <button onClick={() => setShowExportSettings(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border font-black text-xs transition-all ${showExportSettings ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container border-neutral-200 text-on-surface-variant hover:border-primary/20'}`}>
            <Settings2 size={13} />
            <span className="hidden sm:inline">컬럼 설정</span>
          </button>
          <button onClick={exportToExcel} disabled={!rows.length}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-white font-black text-xs transition-all shadow-sm disabled:opacity-40">
            <FileSpreadsheet size={14} />
            <span className="hidden sm:inline">나이스 엑셀 다운로드</span>
            <span className="sm:hidden">엑셀 다운로드</span>
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

      {/* 컬럼 선택 패널 */}
      <AnimatePresence>
        {showExportSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-primary uppercase tracking-widest">나이스 엑셀 — 포함할 컬럼 선택</p>
                <p className="text-[10px] text-on-surface-variant/50">시트1(나이스제출)에 반영 · 시트2(전체현황)는 항상 전체 포함</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {exportColumns.map((col, idx) => (
                  <button key={col.key}
                    onClick={() => {
                      if (col.required) return;
                      const updated = [...exportColumns];
                      updated[idx] = { ...col, checked: !col.checked };
                      setExportColumns(updated);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                      col.checked
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-on-surface-variant border-neutral-200 hover:border-primary/30'
                    } ${col.required ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {col.checked && <Check size={11} strokeWidth={3} />}
                    {col.label}
                    {col.required && <span className="text-[8px] opacity-60">필수</span>}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-on-surface-variant/50">
                나이스 헤더명: {exportColumns.filter(c => c.checked).map(c => c.naissLabel).join(' | ')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          {/* 컬럼 헤더 (데스크탑) */}
          <div className="hidden sm:grid grid-cols-[40px_32px_80px_72px_1fr_80px_48px_90px_80px] gap-2 px-4 text-[10px] font-black text-on-surface-variant/40 uppercase tracking-wider">
            <span></span><span>번호</span><span>이름</span><span>성취도</span><span>세특 내용</span>
            <span className="text-right">글자수</span><span className="text-center">기록</span><span className="text-center">상태</span><span></span>
          </div>

          {filtered.map(row => {
            const isExpanded = expandedId === row.id;
            const chars = charCount(row.setech_content);
            const bytes = byteCount(row.setech_content);
            const pct = Math.min((chars / 500) * 100, 100);
            const isOver     = chars > 500;
            const isDanger   = !isOver && chars > 480;
            const isWarning  = !isDanger && chars > 450;
            const isCaution  = !isWarning && chars > 400;
            const isNearLimit = chars > 440;
            const barColor = isOver ? 'bg-red-500' : isDanger ? 'bg-orange-400' : isWarning ? 'bg-amber-400' : isCaution ? 'bg-yellow-300' : 'bg-emerald-400';
            const textColor = isOver ? 'text-red-500' : isDanger ? 'text-orange-500' : isWarning ? 'text-amber-500' : isCaution ? 'text-yellow-600' : 'text-emerald-600';
            const isGenerating = generatingId === row.id;
            const isSavingThis = savingId === row.id;

            return (
              <div key={row.id} className={`layered-card overflow-hidden transition-all ${isExpanded ? 'shadow-ambient ring-2 ring-primary/10' : 'shadow-sm'}`}>
                {/* ── 모바일 요약 카드 (sm 미만) ── */}
                <div
                  className="sm:hidden flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-container/30 transition-all"
                  onClick={() => toggleExpand(row.id, row.setech_content)}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${row.status === 'final' ? 'bg-emerald-100 text-emerald-600' : row.status === 'draft' ? 'bg-amber-100 text-amber-500' : 'bg-neutral-100 text-neutral-300'}`}>
                    {row.status === 'final' ? <Check size={14} strokeWidth={3} /> : row.status === 'draft' ? '✏️' : '·'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black text-neutral-400 shrink-0">{row.student_number}</span>
                      <span className="text-sm font-black text-on-surface truncate">{row.full_name}</span>
                    </div>
                    {row.setech_content ? (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className={`text-[10px] font-black shrink-0 ${textColor}`}>{chars}/500</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-neutral-300 italic">미작성</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <select
                      value={row.achievement_level || ''}
                      onChange={e => updateRow(row.id, { achievement_level: e.target.value as any || null })}
                      className={`w-12 px-1 py-1 rounded-lg text-[10px] font-black border appearance-none outline-none text-center ${row.achievement_level ? LEVEL_COLORS[row.achievement_level] : 'bg-neutral-50 border-neutral-200 text-neutral-400'}`}
                    >
                      <option value="">-</option>
                      <option value="상">상</option>
                      <option value="중">중</option>
                      <option value="하">하</option>
                    </select>
                    <span className={`text-[9px] font-black px-2 py-1 rounded-full whitespace-nowrap ${STATUS_COLORS[row.status]}`}>
                      {STATUS_LABELS[row.status]}
                    </span>
                    {row.isDirty && (
                      <button onClick={() => saveRow(row)} disabled={!!savingId}
                        className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all">
                        {isSavingThis ? <RotateCw size={12} className="animate-spin" /> : <Save size={12} />}
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); toggleExpand(row.id, row.setech_content); }}
                      className="p-1.5 rounded-lg hover:bg-surface-container text-neutral-400 transition-all">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* ── 데스크탑 요약 행 (sm 이상) ── */}
                <div
                  className="hidden sm:grid grid-cols-[40px_32px_80px_72px_1fr_80px_48px_90px_80px] gap-2 items-center px-4 py-3 cursor-pointer hover:bg-surface-container/30 transition-all"
                  onClick={() => toggleExpand(row.id, row.setech_content)}
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
                  {/* 글자수 + 미니 진행바 */}
                  <div className="flex flex-col items-end gap-1 min-w-0">
                    <span className={`text-[10px] font-black ${textColor}`}>
                      {chars}<span className="font-bold text-neutral-300">/500</span>
                    </span>
                    <div className="w-full h-1 bg-neutral-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
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
                    <button onClick={e => { e.stopPropagation(); toggleExpand(row.id, row.setech_content); }}
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* 되돌리기 — 이번 세션에서 수정 전 내용으로 복원 */}
                              {row.isDirty && undoSnapshots[row.id] !== undefined && (
                                <button
                                  onClick={() => undoRow(row.id)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-black hover:bg-amber-100 transition-all"
                                  title="수정 전 내용으로 되돌리기 (이번 세션 시작 시점)"
                                >
                                  <Undo2 size={11} /> 되돌리기
                                </button>
                              )}
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

                          <textarea
                            value={row.setech_content}
                            onChange={e => updateRow(row.id, { setech_content: e.target.value })}
                            placeholder="세특 내용을 직접 입력하거나 AI 생성 버튼을 눌러주세요..."
                            className={`w-full min-h-[180px] p-3 pb-4 rounded-xl text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 transition-all border ${
                              isOver    ? 'border-red-300 focus:ring-red-200 bg-red-50/50' :
                              isDanger  ? 'border-orange-300 focus:ring-orange-200 bg-orange-50/30' :
                              isWarning ? 'border-amber-200 focus:ring-amber-200' :
                              'border-neutral-200 focus:ring-primary/20 bg-surface-container/40'
                            }`}
                          />

                          {/* 진행바 + 카운터 */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[11px] font-black ${textColor}`}>
                                  {chars} / 500자
                                </span>
                                <span className="text-[10px] font-bold text-neutral-400">
                                  {bytes} bytes
                                </span>
                                {isOver ? (
                                  <span className="text-[10px] font-black text-red-500 flex items-center gap-1">
                                    <AlertCircle size={10} /> {chars - 500}자 초과
                                  </span>
                                ) : (
                                  <span className={`text-[10px] font-bold ${isNearLimit ? textColor : 'text-neutral-400'}`}>
                                    남은 {500 - chars}자
                                  </span>
                                )}
                              </div>
                              {isOver && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => updateRow(row.id, { setech_content: smartTrim(row.setech_content), isDirty: true })}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[10px] font-black hover:bg-red-100 transition-all"
                                    title="500자 이내 마지막 완전한 문장까지 자르기"
                                  >
                                    <RefreshCw size={10} /> 문장 단위 자르기
                                  </button>
                                  <button
                                    onClick={() => aiCompress(row)}
                                    disabled={compressingId === row.id}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-200 text-violet-600 text-[10px] font-black hover:bg-violet-100 transition-all disabled:opacity-50"
                                    title="AI가 핵심 내용을 유지하며 500자 이내로 자연스럽게 압축"
                                  >
                                    {compressingId === row.id
                                      ? <RotateCw size={10} className="animate-spin" />
                                      : <Sparkles size={10} />}
                                    AI로 압축
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-200 ${barColor}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            {isOver && (
                              <p className="text-[10px] font-black text-red-500 flex items-center gap-1">
                                <AlertCircle size={11} /> 나이스 입력 시 오류 — <span className="font-bold">문장 단위 자르기</span>(빠름) 또는 <span className="font-bold">AI로 압축</span>(자연스러움)
                              </p>
                            )}
                          </div>

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

                      {/* 행동특성 및 종합의견 초안 패널 */}
                      {row.behavior_insight && (
                        <BehaviorInsightPanel insight={row.behavior_insight} studentName={row.full_name} />
                      )}
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
