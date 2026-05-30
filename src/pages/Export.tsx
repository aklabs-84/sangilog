import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Database,
  TrendingUp,
  Info,
  Settings2,
  Users,
  Loader2,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import NaissWorkstation from '../components/export/NaissWorkstation';

type Scope = 'all' | 'specific';
type Format = 'csv' | 'xlsx';

const Export = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [obsCount, setObsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [scope, setScope] = useState<Scope>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [format, setFormat] = useState<Format>('xlsx');
  const [startDate, setStartDate] = useState('2025-03-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState<'export' | 'naiss'>('naiss');

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user?.id);

      if (data) {
        setClasses(data);
        if (data.length > 0) {
          setSelectedClassId(data[0].id);
          fetchPreviewData(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreviewData = async (classId: string) => {
    try {
      const cls = classes.find(c => c.id === classId) || { linked_class_id: null };
      const targetId = cls.linked_class_id || classId;

      const { data: studs } = await supabase
        .from('students')
        .select('id, full_name, student_number, observations(count)')
        .eq('class_id', targetId)
        .limit(5);

      if (studs) {
        setStudents(studs);
        setPreviewData(studs.map(s => ({
          id: s.student_number ? `#${s.student_number}` : `#ST-${s.id.slice(0, 4)}`,
          name: s.full_name,
          cat: '최근 활동',
          score: `${(s.observations as any)?.[0]?.count ?? 0}건 기록`,
          trend: 'up'
        })));
      }

      const { data: allStuds } = await supabase.from('students').select('id').eq('class_id', targetId);
      const ids = allStuds?.map(s => s.id) || [];
      if (ids.length > 0) {
        const { count } = await supabase
          .from('observations')
          .select('*', { count: 'exact', head: true })
          .in('student_id', ids);
        setObsCount(count || 0);
      } else {
        setObsCount(0);
      }
    } catch (error) {
      console.error('Error fetching preview data:', error);
    }
  };

  const handleClassChange = (id: string) => {
    setSelectedClassId(id);
    setSelectedStudentIds([]);
    const cls = classes.find(c => c.id === id);
    fetchPreviewDataForClass(id, cls);
  };

  const fetchPreviewDataForClass = async (classId: string, cls: any) => {
    try {
      const targetId = cls?.linked_class_id || classId;
      const { data: studs } = await supabase
        .from('students')
        .select('id, full_name, student_number, observations(count)')
        .eq('class_id', targetId)
        .limit(5);

      if (studs) {
        setStudents(studs);
        setPreviewData(studs.map(s => ({
          id: s.student_number ? `#${s.student_number}` : `#ST-${s.id.slice(0, 4)}`,
          name: s.full_name,
          cat: '최근 활동',
          score: `${(s.observations as any)?.[0]?.count ?? 0}건 기록`,
          trend: 'up'
        })));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleStudentSelect = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleExport = async () => {
    if (!selectedClassId) return;
    setExporting(true);

    try {
      const cls = classes.find(c => c.id === selectedClassId);
      const targetId = cls?.linked_class_id || selectedClassId;

      let studentQuery = supabase.from('students').select('id, full_name, student_number').eq('class_id', targetId);
      const { data: allStuds } = await studentQuery;
      if (!allStuds || allStuds.length === 0) {
        alert('학급에 학생이 없습니다.');
        return;
      }

      const studentIds = scope === 'specific' && selectedStudentIds.length > 0
        ? selectedStudentIds
        : allStuds.map(s => s.id);

      const { data: obs } = await supabase
        .from('observations')
        .select('student_id, activity_name, content, status, created_at')
        .in('student_id', studentIds)
        .gte('created_at', new Date(startDate).toISOString())
        .lte('created_at', new Date(endDate + 'T23:59:59').toISOString())
        .order('created_at', { ascending: true });

      const studentMap: Record<string, { full_name: string; student_number: string }> = {};
      allStuds.forEach(s => { studentMap[s.id] = s; });

      const rows = (obs || []).map(o => ({
        '학생번호': studentMap[o.student_id]?.student_number || '',
        '학생이름': studentMap[o.student_id]?.full_name || '',
        '활동명': o.activity_name || '',
        '활동내용': o.content || '',
        '상태': o.status === 'approved' ? '승인' : o.status === 'pending' ? '대기' : o.status,
        '기록일시': new Date(o.created_at).toLocaleString('ko-KR'),
      }));

      if (rows.length === 0) {
        alert('해당 기간에 활동 기록이 없습니다.');
        return;
      }

      const className = cls?.name?.replace(/[/\\?%*:|"<>]/g, '-') || 'export';
      const fileName = `${className}_활동기록_${startDate}~${endDate}`;

      if (format === 'csv') {
        const headers = Object.keys(rows[0]);
        const csvContent = [
          headers.join(','),
          ...rows.map(r => headers.map(h => `"${String((r as any)[h]).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const bom = '﻿';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const ws = XLSX.utils.json_to_sheet(rows);
        const colWidths = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, 15) }));
        ws['!cols'] = colWidths;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '활동기록');
        XLSX.writeFile(wb, `${fileName}.xlsx`);
      }
    } catch (err) {
      console.error(err);
      alert('내보내기 중 오류가 발생했습니다.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-10"
    >
      <div className="px-2">
        <p className="text-primary font-bold text-xs uppercase tracking-widest mb-3">Workspace Utility</p>
        <h1 className="text-2xl md:text-4xl font-extrabold font-manrope mb-4">데이터 내보내기 센터</h1>
        <p className="text-on-surface-variant text-base leading-relaxed max-w-2xl">
          나이스 세특 제출 준비부터 활동기록 내보내기까지 관리합니다.
        </p>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 p-1.5 bg-surface-container/60 rounded-2xl w-fit border border-white/40 shadow-soft">
        <button
          onClick={() => setActiveTab('naiss')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === 'naiss' ? 'bg-white text-primary shadow-soft' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
        >
          <ClipboardList size={16} />
          나이스 제출 준비
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === 'export' ? 'bg-white text-primary shadow-soft' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
        >
          <Download size={16} />
          활동기록 내보내기
        </button>
      </div>

      {/* 나이스 제출 준비 탭 */}
      {activeTab === 'naiss' && (
        <NaissWorkstation classes={classes} />
      )}

      {/* 활동기록 내보내기 탭 */}
      {activeTab === 'export' && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 items-start">
        {/* Export Configuration */}
        <div className="col-span-12 lg:col-span-5 space-y-8">
          <div className="surface-card p-5 md:p-10 shadow-ambient border-l-4 border-primary">
            <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
              <Database size={24} className="text-primary" />
              내보내기 매개변수 설정
            </h2>

            <div className="space-y-8">
              {/* 학급 선택 */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">학급 선택</label>
                <div className="relative">
                  <select
                    value={selectedClassId}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className="w-full pl-4 pr-10 py-4 bg-surface-container rounded-xl text-sm font-bold appearance-none focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  >
                    {loading ? (
                      <option>로딩 중...</option>
                    ) : classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} - {c.subject}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 학생 범위 선택 */}
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">학생 범위 선택</label>
                <div className="flex bg-surface-container p-1 rounded-xl">
                  <button
                    onClick={() => setScope('all')}
                    className={`flex-1 py-3 px-4 font-bold text-[13px] rounded-lg transition-all ${scope === 'all' ? 'bg-primary-container text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    전체 학생
                  </button>
                  <button
                    onClick={() => setScope('specific')}
                    className={`flex-1 py-3 px-4 font-bold text-[13px] rounded-lg transition-all ${scope === 'specific' ? 'bg-primary-container text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    특정 학생 선택
                  </button>
                </div>

                {scope === 'specific' && (
                  <div className="bg-surface-container-low rounded-xl border border-surface-container max-h-40 overflow-y-auto">
                    {students.length > 0 ? students.map(s => (
                      <button
                        key={s.id}
                        onClick={() => toggleStudentSelect(s.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold border-b border-surface-container/50 last:border-0 transition-all ${selectedStudentIds.includes(s.id) ? 'bg-primary/5 text-primary' : 'hover:bg-surface-container'}`}
                      >
                        <span className="flex items-center gap-2">
                          <Users size={14} />
                          {s.full_name}
                        </span>
                        {selectedStudentIds.includes(s.id) && <span className="text-[10px] font-black text-primary">✓</span>}
                      </button>
                    )) : (
                      <p className="px-4 py-3 text-xs text-on-surface-variant">학생이 없습니다.</p>
                    )}
                  </div>
                )}
              </div>

              {/* 날짜 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">시작일</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full pl-11 pr-4 py-4 bg-surface-container rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">종료일</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full pl-11 pr-4 py-4 bg-surface-container rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>

              {/* 파일 형식 */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">파일 형식</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setFormat('csv')}
                    className={`p-6 text-center rounded-xl border-2 transition-all ${format === 'csv' ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent bg-surface-container hover:border-surface-container-high'}`}
                  >
                    <FileText size={36} className={`mx-auto mb-3 transition-colors ${format === 'csv' ? 'text-primary' : 'text-on-surface-variant/40'}`} />
                    <p className={`text-sm font-bold ${format === 'csv' ? 'text-primary' : ''}`}>CSV 형식</p>
                    <p className="text-[10px] text-on-surface-variant mt-1">범용 호환성</p>
                  </button>
                  <button
                    onClick={() => setFormat('xlsx')}
                    className={`p-6 text-center rounded-xl border-2 transition-all ${format === 'xlsx' ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent bg-surface-container hover:border-surface-container-high'}`}
                  >
                    <FileSpreadsheet size={36} className={`mx-auto mb-3 transition-colors ${format === 'xlsx' ? 'text-primary' : 'text-on-surface-variant/40'}`} />
                    <p className={`text-sm font-bold ${format === 'xlsx' ? 'text-primary' : ''}`}>XLSX 파일</p>
                    <p className="text-[10px] text-on-surface-variant mt-1 uppercase font-black">서식 포함</p>
                  </button>
                </div>
              </div>

              <div className="p-5 bg-surface-container-low rounded-2xl flex items-start gap-3 border border-surface-container">
                <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary mt-1">
                  <Info size={16} />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-black tracking-widest text-on-surface-variant">{obsCount}개의 기록 발견</p>
                  <p className="text-[11px] text-on-surface-variant/60 font-medium">활동명, 내용, 상태, 기록일시가 포함됩니다.</p>
                </div>
              </div>

              {/* 내보내기 버튼 */}
              <button
                onClick={handleExport}
                disabled={exporting || obsCount === 0}
                className="w-full btn-gradient py-5 rounded-2xl font-black text-base flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <>
                    <Loader2 size={22} className="animate-spin" />
                    내보내는 중...
                  </>
                ) : (
                  <>
                    <Download size={22} />
                    {format.toUpperCase()}로 내보내기
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse ml-2" />
                  </>
                )}
              </button>
              {obsCount === 0 && (
                <p className="text-center text-xs text-on-surface-variant/60">활동 기록이 없어 내보낼 데이터가 없습니다.</p>
              )}
            </div>
          </div>
        </div>

        {/* Data Preview */}
        <div className="col-span-12 lg:col-span-7">
          <div className="surface-card p-5 md:p-10 shadow-ambient">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-bold font-manrope">데이터 구조 미리보기</h2>
                <p className="text-[11px] text-on-surface-variant font-medium mt-1">현재 설정된 내보내기 구성의 실시간 샘플링</p>
              </div>
              <span className="px-3 py-1 bg-surface-container text-on-surface-variant font-black text-[10px] rounded-lg tracking-widest uppercase">미리보기 모드</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-on-surface-variant border-b border-surface-container">
                    <th className="py-4 font-bold">학생 ID</th>
                    <th className="py-4 font-bold">학생 성함</th>
                    <th className="py-4 font-bold">카테고리</th>
                    <th className="py-4 font-bold">기록 수</th>
                    <th className="py-4 font-bold text-right">추이</th>
                  </tr>
                </thead>
                <tbody className="font-medium text-on-surface">
                  {loading ? (
                    [1, 2, 3].map(i => <tr key={i} className="animate-pulse h-12 bg-surface-container/20 border-b border-surface-container" />)
                  ) : previewData.length > 0 ? (
                    previewData.map((row, i) => (
                      <tr key={i} className="border-b border-surface-container/30 hover:bg-surface-container-low transition-colors">
                        <td className="py-5 text-on-surface-variant font-mono text-xs">{row.id}</td>
                        <td className="py-5 font-bold">{row.name}</td>
                        <td className="py-5">
                          <span className="px-2 py-1 bg-primary-container/40 text-primary text-[10px] font-black rounded-md">{row.cat}</span>
                        </td>
                        <td className="py-5 font-bold text-primary">{row.score}</td>
                        <td className="py-5 text-right">
                          <TrendingUp size={18} className="text-primary ml-auto" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-on-surface-variant text-xs">데이터가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-8 pt-6 border-t border-surface-container flex items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 md:gap-10">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase">포함 열</p>
                  <p className="text-sm font-black">6개 선택됨</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase">총 기록</p>
                  <p className="text-sm font-black">{obsCount}건</p>
                </div>
              </div>
              <button className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline">
                열 관리 <Settings2 size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </motion.div>
  );
};

export default Export;
