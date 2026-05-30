import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  GraduationCap,
  Printer,
  RefreshCw,
  Users,
  FileText,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  Loader2,
  StickyNote,
  CheckCircle2,
} from 'lucide-react';

interface StudentRow {
  id: string;
  full_name: string;
  student_number: number | null;
}

interface ObsRow {
  id: string;
  student_id: string;
  activity_name: string;
  content: string;
  created_at: string;
  week_number: number | null;
}

interface ResultRow {
  id: string;
  student_id: string;
  week_number: number | null;
  title: string;
  text_content: string;
  result_type: string;
  created_at: string;
  link_url?: string | null;
  file_url?: string | null;
  image_url?: string | null;
}

interface StudentData {
  student: StudentRow;
  obs: ObsRow[];
  results: ResultRow[];
}

const ShareClassView = () => {
  const { classId } = useParams<{ classId: string }>();
  const [classInfo, setClassInfo] = useState<any>(null);
  const [studentData, setStudentData] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [weekFilter, setWeekFilter] = useState<number | 'all'>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);

    try {
      const norm = (s: string) => s?.replace(/\s+/g, '').toLowerCase() || '';

      const { data: cls, error: clsErr } = await supabase
        .from('classes')
        .select('id, name, subject, weekly_plan, share_enabled')
        .eq('id', classId)
        .single();

      if (clsErr || !cls) {
        setError('공유 링크가 유효하지 않거나 접근할 수 없습니다.');
        return;
      }

      if (cls.share_enabled === false) {
        setError('이 공유 링크는 현재 비활성화되어 있습니다.\n담당 선생님께 문의해주세요.');
        return;
      }

      setClassInfo(cls);

      const topicWeekMap: Record<string, number> = {};
      ((cls.weekly_plan as any[]) || []).forEach((p: any) => {
        if (p.topic && p.week) topicWeekMap[norm(p.topic)] = Number(p.week);
      });

      const { data: students, error: stuErr } = await supabase
        .from('students')
        .select('id, full_name, student_number')
        .eq('class_id', classId)
        .order('student_number', { ascending: true });

      if (stuErr || !students) {
        setError('학생 데이터를 불러올 수 없습니다.\nSupabase 공유 권한 설정이 필요합니다.');
        return;
      }

      const studentIds = students.map((s) => s.id);

      if (studentIds.length === 0) {
        setStudentData([]);
        setLastUpdated(new Date());
        return;
      }

      const [{ data: obs }, { data: results }] = await Promise.all([
        supabase
          .from('observations')
          .select('id, student_id, activity_name, content, created_at')
          .in('student_id', studentIds)
          .eq('is_student_record', true)
          .eq('status', 'approved')
          .order('created_at', { ascending: false }),
        supabase
          .from('student_results')
          .select('id, student_id, week_number, title, text_content, result_type, created_at, link_url, storage_path')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false }),
      ]);

      const obsWithWeek: ObsRow[] = (obs || []).map((o: any) => ({
        ...o,
        week_number: topicWeekMap[norm(o.activity_name)] ?? null,
      }));

      const resultsWithUrls: ResultRow[] = (results || []).map((r: any) => {
        let image_url: string | null = null;
        let file_url: string | null = null;
        if (r.result_type === 'image' && r.storage_path) {
          const { data } = supabase.storage.from('student-attachments').getPublicUrl(r.storage_path);
          image_url = data?.publicUrl || null;
        } else if (r.result_type === 'file' && r.storage_path) {
          const { data } = supabase.storage.from('student-attachments').getPublicUrl(r.storage_path);
          file_url = data?.publicUrl || null;
        }
        return { ...r, image_url, file_url };
      });

      const grouped: StudentData[] = students.map((student) => ({
        student,
        obs: obsWithWeek.filter((o) => o.student_id === student.id),
        results: resultsWithUrls.filter((r) => r.student_id === student.id),
      }));

      setStudentData(grouped);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('ShareClassView fetch error:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(studentData.map((sd) => sd.student.id)));
  const collapseAll = () => setExpandedIds(new Set());

  const allWeeks = useMemo(() =>
    Array.from(
      new Set([
        ...studentData.flatMap((sd) => sd.obs.map((o) => o.week_number).filter(Boolean)),
        ...studentData.flatMap((sd) => sd.results.map((r) => r.week_number).filter(Boolean)),
      ] as number[])
    ).sort((a, b) => a - b),
    [studentData]
  );

  const filteredData = useMemo(() =>
    studentData.map((sd) => ({
      ...sd,
      obs: weekFilter === 'all' ? sd.obs : sd.obs.filter((o) => o.week_number === weekFilter),
      results: weekFilter === 'all' ? sd.results : sd.results.filter((r) => r.week_number === weekFilter),
    })),
    [studentData, weekFilter]
  );

  const totalObs = filteredData.reduce((a, sd) => a + sd.obs.length, 0);
  const totalResults = filteredData.reduce((a, sd) => a + sd.results.length, 0);
  const activeCount = filteredData.filter((sd) => sd.obs.length > 0 || sd.results.length > 0).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-indigo-500" />
          <p className="text-sm font-semibold text-gray-500">데이터 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-md p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <h2 className="text-xl font-black text-gray-800">접근할 수 없습니다</h2>
          <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white font-sans">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 print:static print:border-b-2 print:border-gray-300">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
              <GraduationCap size={20} className="text-indigo-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-gray-900 truncate">
                  {classInfo?.name}
                  {classInfo?.subject ? ` · ${classInfo.subject}` : ''}
                </h1>
                <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
                  선생님 공유 보기
                </span>
              </div>
              {lastUpdated && (
                <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                  {lastUpdated.toLocaleString('ko-KR')} 기준
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all"
              title="새로고침"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black transition-all"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">인쇄 / PDF</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
          {[
            { label: '전체 학생', value: studentData.length, unit: '명', icon: Users, color: 'blue' },
            { label: '활동 참여', value: activeCount, unit: '명', icon: CheckCircle2, color: 'green' },
            { label: '관찰기록', value: totalObs, unit: '건', icon: FileText, color: 'violet' },
            { label: '결과물', value: totalResults, unit: '건', icon: FolderOpen, color: 'amber' },
          ].map(({ label, value, unit, icon: Icon }) => (
            <div key={label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon size={13} className="text-gray-400" />
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-gray-900">{value}</span>
                <span className="text-sm font-bold text-gray-400">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 주차 필터 + 전체 열기/닫기 */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {allWeeks.length > 0 && (
            <>
              <span className="text-xs font-black text-gray-500 mr-1">주차:</span>
              <button
                onClick={() => setWeekFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  weekFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'
                }`}
              >
                전체
              </button>
              {allWeeks.map((w) => (
                <button
                  key={w}
                  onClick={() => setWeekFilter(w)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    weekFilter === w
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {w}주차
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={expandAll}
                  className="text-xs font-black text-gray-500 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-all"
                >
                  전체 열기
                </button>
                <button
                  onClick={collapseAll}
                  className="text-xs font-black text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-100 transition-all"
                >
                  전체 닫기
                </button>
              </div>
            </>
          )}
        </div>

        {/* 학생 목록 */}
        <div className="space-y-2">
          {filteredData.map(({ student, obs, results }) => {
            const isExpanded = expandedIds.has(student.id);
            const hasActivity = obs.length > 0 || results.length > 0;

            return (
              <div
                key={student.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all print:break-inside-avoid ${
                  hasActivity ? 'border-gray-200' : 'border-gray-100'
                }`}
              >
                {/* 학생 요약 행 */}
                <button
                  onClick={() => hasActivity && toggleExpand(student.id)}
                  disabled={!hasActivity}
                  className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${
                    hasActivity ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default opacity-50'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <span className="text-sm font-black text-gray-600">
                      {student.student_number ?? '—'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-900 text-sm">{student.full_name}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {obs.length > 0 && (
                        <span className="text-[10px] font-bold text-violet-600">
                          📝 관찰기록 {obs.length}건
                        </span>
                      )}
                      {results.length > 0 && (
                        <span className="text-[10px] font-bold text-emerald-600">
                          📁 결과물 {results.length}건
                        </span>
                      )}
                      {!hasActivity && (
                        <span className="text-[10px] font-bold text-gray-400">미제출</span>
                      )}
                    </div>
                  </div>
                  {hasActivity && (
                    <div className="shrink-0 text-gray-400">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  )}
                </button>

                {/* 상세 제출 내용 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50/50">
                    {obs.map((o) => (
                      <div key={o.id} className="bg-white rounded-xl border border-violet-100 p-4">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">
                            📝 관찰기록
                          </span>
                          {o.week_number && (
                            <span className="text-[10px] font-bold text-gray-400">{o.week_number}주차</span>
                          )}
                          <span className="text-[10px] font-bold text-gray-400 ml-auto">
                            {new Date(o.created_at).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                        {o.activity_name && (
                          <p className="text-[11px] font-semibold text-gray-500 mb-1.5">{o.activity_name}</p>
                        )}
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{o.content}</p>
                      </div>
                    ))}

                    {results.map((r) => (
                      <div key={r.id} className="bg-white rounded-xl border border-emerald-100 p-4">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            📁 결과물
                          </span>
                          {r.week_number && (
                            <span className="text-[10px] font-bold text-gray-400">{r.week_number}주차</span>
                          )}
                          <span className="text-[10px] font-bold text-gray-400 ml-auto">
                            {new Date(r.created_at).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                        {r.title && (
                          <p className="text-sm font-black text-gray-800 mb-1.5">{r.title}</p>
                        )}
                        {r.text_content && (
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{r.text_content}</p>
                        )}
                        {r.image_url && (
                          <img
                            src={r.image_url}
                            alt="결과물 이미지"
                            className="mt-2 rounded-lg max-h-56 object-cover w-full"
                          />
                        )}
                        {r.link_url && (
                          <a
                            href={r.link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            <ExternalLink size={12} /> 링크 열기
                          </a>
                        )}
                        {r.file_url && (
                          <a
                            href={r.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            <ExternalLink size={12} /> 파일 열기
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredData.length === 0 && (
          <div className="flex flex-col items-center py-20 space-y-3">
            <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center">
              <StickyNote size={32} className="text-gray-300" />
            </div>
            <p className="font-black text-gray-400 text-sm">등록된 학생이 없습니다</p>
          </div>
        )}

        {/* 푸터 */}
        <div className="text-center pt-4 pb-8 print:pt-8">
          <p className="text-[10px] text-gray-300 font-semibold">
            Scholar Metric — 학교 선생님 공유 보기 · {new Date().getFullYear()}
          </p>
        </div>
      </main>
    </div>
  );
};

export default ShareClassView;
