import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, CalendarDays, Users,
  CheckCircle2, XCircle, Clock, LogOut, Shield, Loader2,
  Download, FileSpreadsheet
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

interface AttendanceTabProps {
  classId: string;
  students: any[];
}

const STATUSES = [
  { key: 'present',     label: '출석', short: '출',  icon: CheckCircle2, color: 'emerald' },
  { key: 'absent',      label: '결석', short: '결',  icon: XCircle,      color: 'rose'    },
  { key: 'late',        label: '지각', short: '지',  icon: Clock,        color: 'amber'   },
  { key: 'early_leave', label: '조퇴', short: '조',  icon: LogOut,       color: 'orange'  },
  { key: 'excused',     label: '공결', short: '공',  icon: Shield,       color: 'violet'  },
] as const;

type StatusKey = (typeof STATUSES)[number]['key'];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  emerald: { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-400' },
  rose:    { bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-rose-200',    ring: 'ring-rose-400'    },
  amber:   { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',   ring: 'ring-amber-400'   },
  orange:  { bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-200',  ring: 'ring-orange-400'  },
  violet:  { bg: 'bg-violet-50',   text: 'text-violet-700',  border: 'border-violet-200',  ring: 'ring-violet-400'  },
};

// toISOString()은 UTC 기준이라 한국(UTC+9) 환경에서 날짜가 밀림
// → 로컬 날짜 컴포넌트로 직접 조합
const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const today = toDateStr(new Date());

const formatDisplayDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
};

export default function AttendanceTab({ classId, students }: AttendanceTabProps) {
  const [selectedDate, setSelectedDate] = useState(today);
  const [records, setRecords] = useState<Record<string, StatusKey>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dlLoading, setDlLoading] = useState(false);

  const fetchAttendance = useCallback(async (date: string) => {
    if (!classId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('class_id', classId)
        .eq('date', date);

      const map: Record<string, StatusKey> = {};
      (data || []).forEach((r: any) => { map[r.student_id] = r.status; });
      setRecords(map);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchAttendance(selectedDate);
  }, [selectedDate, fetchAttendance]);

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(toDateStr(d));
  };

  const handleStatus = async (studentId: string, status: StatusKey) => {
    setSavingId(studentId);
    const isToggle = records[studentId] === status;

    // Optimistic update
    setRecords(prev => {
      const next = { ...prev };
      if (isToggle) delete next[studentId];
      else next[studentId] = status;
      return next;
    });

    try {
      if (isToggle) {
        await supabase.from('attendance')
          .delete()
          .eq('class_id', classId)
          .eq('student_id', studentId)
          .eq('date', selectedDate);
      } else {
        await supabase.from('attendance').upsert({
          class_id: classId,
          student_id: studentId,
          date: selectedDate,
          status,
        }, { onConflict: 'class_id,student_id,date' });
      }
    } catch {
      // rollback
      fetchAttendance(selectedDate);
    } finally {
      setSavingId(null);
    }
  };

  const handleMarkAll = async (status: StatusKey) => {
    const upserts = students.map(s => ({
      class_id: classId,
      student_id: s.id,
      date: selectedDate,
      status,
    }));
    const optimistic: Record<string, StatusKey> = {};
    students.forEach(s => { optimistic[s.id] = status; });
    setRecords(optimistic);
    await supabase.from('attendance').upsert(upserts, { onConflict: 'class_id,student_id,date' });
  };

  const handleClearAll = async () => {
    setRecords({});
    await supabase.from('attendance').delete()
      .eq('class_id', classId)
      .eq('date', selectedDate);
  };

  const STATUS_LABEL: Record<string, string> = {
    present: '출석', absent: '결석', late: '지각', early_leave: '조퇴', excused: '공결',
  };

  // 선택 날짜 출석 다운로드
  const downloadDay = async () => {
    setDlLoading(true);
    try {
      const { data } = await supabase.from('attendance').select('student_id, status')
        .eq('class_id', classId).eq('date', selectedDate);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.student_id] = r.status; });

      const rows = students.map(s => ({
        '번호': s.number === '-' ? '' : s.number,
        '이름': s.name,
        '출석상태': STATUS_LABEL[map[s.id]] || '미기록',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      // 열 너비 설정
      ws['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '출석');
      XLSX.writeFile(wb, `출석_${selectedDate}.xlsx`);
    } finally {
      setDlLoading(false);
    }
  };

  // 선택 날짜가 속한 달 전체 출석 다운로드 (행: 학생, 열: 날짜)
  const downloadMonth = async () => {
    setDlLoading(true);
    try {
      const [year, month] = selectedDate.split('-').map(Number);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const { data } = await supabase.from('attendance').select('student_id, date, status')
        .eq('class_id', classId).gte('date', startDate).lte('date', endDate);

      // 기록된 날짜 목록 수집 (오름차순)
      const dateSet = new Set<string>();
      (data || []).forEach((r: any) => dateSet.add(r.date));
      const dates = [...dateSet].sort();

      // 학생별·날짜별 피벗 맵
      const pivotMap: Record<string, Record<string, string>> = {};
      students.forEach(s => { pivotMap[s.id] = {}; });
      (data || []).forEach((r: any) => {
        if (pivotMap[r.student_id]) pivotMap[r.student_id][r.date] = r.status;
      });

      const rows = students.map(s => {
        const row: Record<string, any> = {
          '번호': s.number === '-' ? '' : s.number,
          '이름': s.name,
        };
        dates.forEach(d => {
          const dayNum = parseInt(d.split('-')[2]);
          row[`${month}/${dayNum}`] = STATUS_LABEL[pivotMap[s.id]?.[d]] || '';
        });
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const colWidths = [{ wch: 6 }, { wch: 12 }, ...dates.map(() => ({ wch: 5 }))];
      ws['!cols'] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${year}년 ${month}월 출석`);
      XLSX.writeFile(wb, `출석_${year}년_${month}월.xlsx`);
    } finally {
      setDlLoading(false);
    }
  };

  // Summary counts
  const counts = STATUSES.reduce((acc, s) => {
    acc[s.key] = Object.values(records).filter(v => v === s.key).length;
    return acc;
  }, {} as Record<string, number>);
  const unmarked = students.length - Object.keys(records).length;
  const isToday = selectedDate === today;

  return (
    <div className="space-y-8">
      {/* Date navigation */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => changeDate(-1)}
            className="w-10 h-10 rounded-xl bg-surface-container hover:bg-white hover:shadow-soft transition-all flex items-center justify-center text-on-surface-variant"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-2xl shadow-soft border border-white/60 min-w-[260px] justify-center">
            <CalendarDays size={18} className="text-primary/60" />
            <span className="font-black text-sm tracking-tight">{formatDisplayDate(selectedDate)}</span>
            {isToday && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-black rounded-full uppercase tracking-widest">오늘</span>
            )}
          </div>

          <button
            onClick={() => changeDate(1)}
            disabled={selectedDate >= today}
            className="w-10 h-10 rounded-xl bg-surface-container hover:bg-white hover:shadow-soft transition-all flex items-center justify-center text-on-surface-variant disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={20} />
          </button>

          {!isToday && (
            <button
              onClick={() => setSelectedDate(today)}
              className="px-4 py-2 text-xs font-black text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-all"
            >
              오늘로
            </button>
          )}
        </div>

        {/* Summary badges */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {STATUSES.map(s => {
            const c = COLOR_MAP[s.color];
            const count = counts[s.key] || 0;
            return (
              <div key={s.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${c.bg} ${c.text} ${c.border} text-xs font-black`}>
                <s.icon size={13} />
                {s.label} <span className="font-manrope">{count}</span>명
              </div>
            );
          })}
          {unmarked > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-neutral-50 text-neutral-400 border-neutral-200 text-xs font-black">
              <Users size={13} />
              미기록 <span className="font-manrope">{unmarked}</span>명
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center justify-between gap-3 px-1 flex-wrap">
        {/* 일괄 설정 + 초기화 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-on-surface-variant/50 uppercase tracking-widest">일괄 설정</span>
          <button
            onClick={() => handleMarkAll('present')}
            className="px-3 py-1.5 text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all"
          >
            전체 출석
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-1.5 text-[11px] font-black bg-neutral-50 text-neutral-400 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition-all"
          >
            전체 초기화
          </button>
        </div>

        {/* 다운로드 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-on-surface-variant/50 uppercase tracking-widest flex items-center gap-1">
            <Download size={11} />다운로드
          </span>
          <button
            onClick={downloadDay}
            disabled={dlLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all disabled:opacity-50"
            title="선택 날짜 출석 엑셀 다운로드"
          >
            {dlLoading ? <Loader2 size={11} className="animate-spin" /> : <FileSpreadsheet size={11} />}
            선택일
          </button>
          <button
            onClick={downloadMonth}
            disabled={dlLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-all disabled:opacity-50"
            title="선택 날짜가 속한 달 전체 출석 엑셀 다운로드"
          >
            {dlLoading ? <Loader2 size={11} className="animate-spin" /> : <FileSpreadsheet size={11} />}
            이번 달
          </button>
        </div>
      </div>

      {/* Attendance table */}
      <div className="layered-card rounded-[2rem] overflow-hidden border border-white/60">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-100">
              <th className="p-5 text-left text-[11px] font-black text-on-surface/60 uppercase tracking-widest w-16">NO.</th>
              <th className="p-5 text-left text-[11px] font-black text-on-surface/60 uppercase tracking-widest">이름</th>
              {STATUSES.map(s => (
                <th key={s.key} className="p-5 text-center text-[11px] font-black text-on-surface/60 uppercase tracking-widest">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            <AnimatePresence>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Loader2 size={24} className="animate-spin text-primary/40 mx-auto" />
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-on-surface-variant/30 text-sm font-black">
                    학생이 없습니다
                  </td>
                </tr>
              ) : (
                students.map((s, idx) => {
                  const currentStatus = records[s.id] as StatusKey | undefined;
                  const isSaving = savingId === s.id;

                  return (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className={`transition-colors ${currentStatus ? 'bg-white' : 'bg-neutral-50/30'}`}
                    >
                      {/* 번호 */}
                      <td className="p-5">
                        <span className="font-manrope font-black text-on-surface-variant/30 text-lg">
                          {s.number === '-' ? '—' : String(s.number).padStart(2, '0')}
                        </span>
                      </td>

                      {/* 이름 */}
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <span className={`font-black text-sm ${currentStatus ? 'text-on-surface' : 'text-on-surface/50'}`}>
                            {s.name}
                          </span>
                          {isSaving && <Loader2 size={12} className="animate-spin text-primary/40" />}
                        </div>
                      </td>

                      {/* 상태 버튼들 */}
                      {STATUSES.map(st => {
                        const isActive = currentStatus === st.key;
                        const c = COLOR_MAP[st.color];
                        return (
                          <td key={st.key} className="p-5 text-center">
                            <button
                              onClick={() => handleStatus(s.id, st.key)}
                              disabled={isSaving}
                              className={`
                                w-10 h-10 rounded-xl border-2 flex items-center justify-center mx-auto
                                transition-all duration-200 active:scale-90 disabled:opacity-50
                                ${isActive
                                  ? `${c.bg} ${c.text} ${c.border} shadow-sm ring-2 ${c.ring}/30 scale-110`
                                  : 'bg-white border-neutral-100 text-neutral-300 hover:border-neutral-200 hover:text-neutral-400'
                                }
                              `}
                              title={st.label}
                            >
                              {isActive
                                ? <st.icon size={16} strokeWidth={2.5} />
                                : <span className="text-[10px] font-black">{st.short}</span>
                              }
                            </button>
                          </td>
                        );
                      })}
                    </motion.tr>
                  );
                })
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <p className="text-center text-[10px] font-bold text-on-surface-variant/30 tracking-widest uppercase pb-4">
        상태를 클릭하면 자동 저장됩니다 · 다시 클릭하면 미기록으로 초기화
      </p>
    </div>
  );
}
