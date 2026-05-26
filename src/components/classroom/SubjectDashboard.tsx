import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Grid,
  List,
  Search,
  QrCode,
  BookOpen,
  Download,
  Plus,
  Key,
  Pencil,
  Trash2,
  ArrowRight,
  ArrowLeftRight,
  Link as LinkIcon,
  Check,
  X,
  CheckCheck,
  CheckCircle2,
  Clock as ClockIcon,
  BarChart2,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Eye,
  EyeOff,
  Save,
  Megaphone
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface SubjectDashboardProps {
  classInfo: any;
  students: any[];
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenQR: () => void;
  onOpenResources: () => void;
  onExport: () => void;
  onAddStudent: () => void;
  onLinkClass: () => void;
  onEditStudent: (id: string, number: string, name: string) => Promise<void>;
  onDeleteStudent: (id: string) => void;
  onNavigateAI: (studentId: string) => void;
  sortConfig: { key: string, direction: 'asc' | 'desc' };
  onSort: (key: any) => void;
  onCopyLink: () => void;
  copySuccess: boolean;
  selectedIds: string[];
  onSelectStudent: (id: string) => void;
  onSelectAll: (isSelect: boolean) => void;
  onBulkApprove: () => void;
  onResetPin: (id: string) => void;
}

const SubjectDashboard = ({
  classInfo,
  students,
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  onOpenQR,
  onOpenResources,
  onExport,
  onAddStudent,
  onLinkClass,
  onEditStudent,
  onDeleteStudent,
  onNavigateAI,
  sortConfig,
  onSort,
  onCopyLink,
  copySuccess,
  selectedIds,
  onSelectStudent,
  onSelectAll,
  onBulkApprove,
  onResetPin
}: SubjectDashboardProps) => {
  const navigate = useNavigate();
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedActivityWeek, setSelectedActivityWeek] = useState<number | null>(null);
  const [pinPopupId, setPinPopupId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleStartEdit = (e: React.MouseEvent, s: any) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditNumber(s.number === '-' ? '' : s.number.toString());
    setEditName(s.name);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingId) return;
    setSaving(true);
    await onEditStudent(editingId, editNumber, editName);
    setSaving(false);
    setEditingId(null);
  };

  // 주차별 제출 통계
  const [showStats, setShowStats] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedStatsWeek, setSelectedStatsWeek] = useState<number | null>(null);
  const [rawObs, setRawObs] = useState<Array<{created_at: string, student_id: string, activity_name: string}>>([]);
  const [rawResults, setRawResults] = useState<Array<{created_at: string, student_id: string, week_number: number | null}>>([]);
  const [suggestionCounts, setSuggestionCounts] = useState<Record<string, number>>({});

  // 주차 목록: weekly_plan + 실제 제출된 주차 union
  const weeklyPlan: {week: number, topic: string}[] = classInfo?.weekly_plan || [];
  const submittedWeekNums = [...new Set(rawResults.map(r => r.week_number).filter((w): w is number => w !== null))];
  const statsWeeks = [...new Set([...weeklyPlan.map(p => p.week), ...submittedWeekNums])].sort((a, b) => a - b);

  const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

  // 주차별 제출 학생 ID 집합 (결과제출 + 관찰기록 합산 — 주차 칩 카운트용)
  const getSubmittedOnWeek = (week: number | null): Set<string> => {
    if (week === null) return new Set();
    const weekTopic = weeklyPlan.find(p => p.week === week)?.topic;
    const resultIds = rawResults.filter(r => r.week_number === week).map(r => r.student_id);
    const obsIds = weekTopic ? rawObs.filter(r => norm(r.activity_name) === norm(weekTopic)).map(r => r.student_id) : [];
    return new Set([...resultIds, ...obsIds]);
  };

  // 테이블용 — 관찰기록 / 결과제출 각각 분리
  const getObsOnWeek = (week: number | null): Set<string> => {
    if (week === null) return new Set();
    const weekTopic = weeklyPlan.find(p => p.week === week)?.topic;
    if (!weekTopic) return new Set();
    return new Set(rawObs.filter(r => norm(r.activity_name) === norm(weekTopic)).map(r => r.student_id));
  };
  const getResultsOnWeek = (week: number | null): Set<string> =>
    week === null ? new Set() : new Set(rawResults.filter(r => r.week_number === week).map(r => r.student_id));

  const obsOnWeek = getObsOnWeek(selectedStatsWeek);
  const resultsOnWeek = getResultsOnWeek(selectedStatsWeek);

  useEffect(() => {
    const fetchStats = async () => {
      if (!classInfo?.id || students.length === 0) return;
      setStatsLoading(true);
      try {
        const studentIds = students.map((s: any) => s.id);
        // student_results: class_id가 아닌 student_id로 조회
        // → 학생은 담임반 입장코드로 로그인하므로 저장 class_id = 담임반 ID
        //   과목반 ID로 조회하면 결과가 없어 주차별 결과제출이 항상 공백으로 표시됨
        //   HomeroomDashboard와 동일하게 student_id 기반 조회로 통일
        const [obsRes, resultsRes, suggRes] = await Promise.all([
          supabase.from('observations').select('created_at, student_id, activity_name').in('student_id', studentIds).eq('is_student_record', true),
          supabase.from('student_results').select('created_at, student_id, week_number').in('student_id', studentIds),
          supabase.from('student_suggestions').select('student_id').eq('class_id', classInfo.id).is('teacher_reply', null),
        ]);
        setRawObs(obsRes.data || []);
        setRawResults(resultsRes.data || []);
        const counts: Record<string, number> = {};
        (suggRes.data || []).forEach((r: { student_id: string }) => {
          counts[r.student_id] = (counts[r.student_id] || 0) + 1;
        });
        setSuggestionCounts(counts);
      } catch (err) {
        console.error('fetchStats error:', err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, [classInfo?.id, students.length]);

  const pendingCount = students.reduce((acc, s) => acc + (s.pending_obs_ids?.length || 0), 0);
  const isAllSelected = students.length > 0 && selectedIds.length === students.length;
  const filteredStudents = students.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.number?.toString().includes(searchQuery.toLowerCase())
  );
  const activeStudents = students.filter(s => s.activity && s.status !== '미작성');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <>
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12 font-pretendard"
    >
      {/* 1. Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4 py-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
              Subject Dashboard
            </span>
            {classInfo?.linked_class_id && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-secondary/10 text-secondary border border-secondary/20 rounded-full text-[9px] font-black uppercase tracking-[0.15em] whitespace-nowrap">
                <ArrowLeftRight size={10} /> Sync Active
              </span>
            )}
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl md:text-4xl font-black tracking-tightest leading-tight">
              <span className="gradient-text">{classInfo?.name}</span>
            </h1>
            <p className="text-on-surface-variant font-bold text-base mt-1 tracking-tight">{classInfo?.subject} 교과 대시보드</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate(`/suggestions?classId=${classInfo.id}`)}
            className="relative flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-sm border-2 border-rose-200 text-rose-500 hover:bg-rose-50 transition-all"
          >
            <Megaphone size={16} />
            <span>건의사항 관리</span>
            {Object.values(suggestionCounts).reduce((a, b) => a + b, 0) > 0 && (
              <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {Object.values(suggestionCounts).reduce((a, b) => a + b, 0)}
              </span>
            )}
          </button>
          <div className="flex p-1 glass rounded-2xl border border-white/40 shadow-soft">
            <button onClick={() => setViewMode('grid')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-primary shadow-soft' : 'text-on-surface-variant/40 hover:text-on-surface'}`}>
              <Grid size={18} />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white text-primary shadow-soft' : 'text-on-surface-variant/40 hover:text-on-surface'}`}>
              <List size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Stats Cards */}
      <section className="px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Total Students */}
          <div className="layered-card bg-white/80 rounded-3xl p-8 flex items-start gap-6 shadow-soft border border-white/60">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users size={26} className="text-primary/60" strokeWidth={1.8} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/40">Total Students</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black tracking-tight font-manrope">{students.length}</span>
                <span className="text-base font-bold text-on-surface-variant/60">명</span>
              </div>
              <span className="text-xs font-bold text-on-surface-variant/50 mt-0.5">전체 등록 인원</span>
            </div>
          </div>

          {/* Activity Rate */}
          <div
            onClick={() => setShowActivityModal(true)}
            className="layered-card bg-white/80 rounded-3xl p-8 flex items-start gap-6 shadow-soft border border-white/60 cursor-pointer hover:border-secondary/30 hover:bg-secondary/5 transition-all group"
          >
            <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0">
              <BookOpen size={26} className="text-secondary/70" strokeWidth={1.8} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/40">Activity Rate</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black tracking-tight font-manrope">{activeStudents.length}</span>
                <span className="text-base font-bold text-on-surface-variant/60">명</span>
              </div>
              <span className="text-xs font-bold text-on-surface-variant/50 mt-0.5">최근 활동 참여</span>
              <span className="text-[10px] font-black text-secondary/60 group-hover:text-secondary transition-colors mt-1">클릭하여 현황 보기 →</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Strategy & Search Bento Bar */}
      <section className="px-4">
        <div className="glass p-3 rounded-[2.5rem] border border-white/60 shadow-soft flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[280px] group">
            <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="학생 또는 번호 검색..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-10 py-4 bg-white border-2 border-neutral-200 hover:border-neutral-300 focus:border-primary/40 rounded-2xl text-sm font-bold text-neutral-900 outline-none transition-all placeholder:text-neutral-400 shadow-sm" 
            />
          </div>

          <div className="flex items-center gap-3 p-1.5 bg-white/20 rounded-2xl border border-white/40 backdrop-blur-md">
            <button onClick={onOpenQR} className="w-11 h-11 bg-white hover:bg-primary hover:text-white rounded-xl flex items-center justify-center text-on-surface-variant/60 transition-all shadow-soft group" title="QR 출결/입장">
              <QrCode size={18} />
            </button>
            <button onClick={onOpenResources} className="w-11 h-11 bg-white hover:bg-secondary hover:text-white rounded-xl flex items-center justify-center text-on-surface-variant/60 transition-all shadow-soft group" title="수업 자료실">
               <BookOpen size={18} />
            </button>
            <button onClick={onCopyLink} className={`w-11 h-11 bg-white hover:bg-primary hover:text-white rounded-xl flex items-center justify-center transition-all shadow-soft group ${copySuccess ? 'text-primary' : 'text-on-surface-variant/60'}`} title="학생 기록 URL 복사">
               {copySuccess ? <Check size={18} /> : <LinkIcon size={18} />}
            </button>
            <button onClick={onExport} className="w-11 h-11 bg-white hover:bg-on-surface hover:text-white rounded-xl flex items-center justify-center text-on-surface-variant/60 transition-all shadow-soft group" title="데이터 내보내기">
               <Download size={18} />
            </button>
          </div>

          {pendingCount > 0 && (
            <button
              onClick={onBulkApprove}
              className="px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-3 shadow-soft bg-amber-500 hover:bg-amber-600 text-white transition-all active:scale-95"
            >
              <CheckCheck size={18} strokeWidth={2.5} />
              <span>전체 승인</span>
              <span className="bg-white/30 text-white text-[10px] font-black px-2 py-0.5 rounded-lg">{pendingCount}건</span>
            </button>
          )}

          <button onClick={onAddStudent} className="btn-vibrant px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-3 shadow-soft">
            <Plus size={18} strokeWidth={3} />
            <span>학생 등록</span>
          </button>
        </div>
      </section>
      
      {/* 4. 주차별 제출 현황 통계 */}
      <section className="px-4">
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50/60 overflow-hidden">
          <button
            onClick={() => setShowStats(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-neutral-100/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <BarChart2 size={14} />
              </div>
              <span className="text-sm font-black text-on-surface">주차별 제출 현황</span>
              {statsWeeks.length > 0 && (
                <span className="text-[10px] font-bold text-on-surface-variant/50 bg-white px-2 py-0.5 rounded-md border border-neutral-200">
                  총 {statsWeeks.length}주차
                </span>
              )}
              {selectedStatsWeek !== null && (
                <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {selectedStatsWeek}주차 선택됨
                </span>
              )}
            </div>
            {showStats ? <ChevronUp size={16} className="text-on-surface-variant/40" /> : <ChevronDown size={16} className="text-on-surface-variant/40" />}
          </button>

          {showStats && (
            <div className="px-6 pb-5">
              {statsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <span className="text-xs font-bold text-on-surface-variant/40">불러오는 중...</span>
                </div>
              ) : statsWeeks.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs font-black text-on-surface-variant/30">등록된 주차 계획이 없습니다. 학급 설정에서 주차별 계획을 추가해 주세요.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {statsWeeks.map(week => {
                      const topic = weeklyPlan.find(p => p.week === week)?.topic;
                      const weekResultCount = getObsOnWeek(week).size;
                      const isSelected = selectedStatsWeek === week;
                      return (
                        <button
                          key={week}
                          onClick={() => setSelectedStatsWeek(isSelected ? null : week)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all border ${
                            isSelected
                              ? 'bg-primary text-white border-primary shadow-sm'
                              : 'bg-white text-neutral-400 border-neutral-200 hover:border-primary/40 hover:text-primary'
                          }`}
                        >
                          <span>{week}주차</span>
                          {topic && <span className={`text-[9px] ${isSelected ? 'text-white/70' : 'text-neutral-300'}`}>· {topic}</span>}
                          {weekResultCount > 0 && (
                            <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                              {weekResultCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {selectedStatsWeek !== null ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black bg-emerald-50 border-emerald-100 text-emerald-700">
                        <span>📋 제출완료</span>
                        <span className="text-base font-black">{obsOnWeek.size}</span>
                        <span className="font-bold opacity-60">명</span>
                      </div>
                      <p className="text-[10px] font-bold text-on-surface-variant/40 ml-1">아래 표에서 주차별 결과 제출 현황을 확인하세요</p>
                    </div>
                  ) : (
                    <p className="text-[11px] font-bold text-on-surface-variant/40">주차를 선택하면 해당 주차 결과 제출 현황이 아래 표에 표시됩니다.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 5. Student Content Area */}
      <section className="px-2 pb-20">
        {students.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center space-y-8 layered-card rounded-[3rem] border-dashed border-primary/20 bg-gradient-to-br from-white via-white to-primary/5">
            <div className="w-24 h-24 bg-primary/5 rounded-[2rem] flex items-center justify-center shadow-inner group">
               <Users size={40} className="text-primary/40 group-hover:scale-110 transition-all duration-700" />
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-2xl font-black tracking-tightest">등록된 학생이 없습니다.</h3>
              <p className="text-sm font-bold text-on-surface-variant leading-relaxed max-w-sm mx-auto">
                학생을 직접 추가하거나 <br /><span className="text-primary font-black underline decoration-primary/20 underline-offset-4">입장 코드</span>를 연동하세요.
              </p>
            </div>
            <div className="flex gap-4">
              <button onClick={onAddStudent} className="px-8 py-4 layered-card hover:bg-white rounded-2xl font-black text-sm flex items-center gap-3 transition-all">직접 추가</button>
              <button onClick={onLinkClass} className="btn-vibrant px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-3"><Key size={18} /> 학급 연동</button>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === 'list' ? (
              <motion.div 
                key="list"
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.01 }}
                className="layered-card rounded-3xl border-white/60 shadow-soft overflow-hidden bg-white/60"
              >
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-neutral-50 border-b border-neutral-100">
                        <th className="p-4 lg:p-6 text-center w-12 lg:w-16 whitespace-nowrap">
                          <label className="flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={isAllSelected}
                              onChange={(e) => onSelectAll(e.target.checked)}
                            />
                            <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${isAllSelected ? 'bg-primary border-primary' : 'border-neutral-300'}`}>
                              {isAllSelected && <Check size={14} className="text-white" strokeWidth={4} />}
                            </div>
                          </label>
                        </th>
                        <th className="p-4 lg:p-6 text-[11px] lg:text-[13px] font-black text-on-surface/80 uppercase tracking-widest whitespace-nowrap hidden sm:table-cell">
                          <button className="flex items-center gap-2 group" onClick={() => onSort('number')}>
                            NO. <ArrowRight size={14} className={`group-hover:text-primary transition-all rotate-90 ${sortConfig.key === 'number' ? 'text-primary' : 'opacity-20'}`} />
                          </button>
                        </th>
                        <th className="p-4 lg:p-6 text-[11px] lg:text-[13px] font-black text-on-surface/80 uppercase tracking-widest whitespace-nowrap">학생 정보</th>
                        <th className="p-4 lg:p-6 text-[11px] lg:text-[13px] font-black text-on-surface/80 uppercase tracking-widest whitespace-nowrap hidden lg:table-cell">활동 및 관찰 기록</th>
                        <th className="p-4 lg:p-6 text-[11px] lg:text-[13px] font-black text-on-surface/80 uppercase tracking-widest text-center whitespace-nowrap hidden md:table-cell">진행 상태</th>
                        <th className="p-4 lg:p-6 text-[11px] lg:text-[13px] font-black text-on-surface/80 uppercase tracking-widest text-center whitespace-nowrap">승인</th>
                        {selectedStatsWeek !== null && (
                          <>
                            <th className="p-4 lg:p-6 text-[11px] lg:text-[13px] font-black text-violet-600/80 uppercase tracking-widest text-center whitespace-nowrap">
                              {selectedStatsWeek}주차 관찰기록
                            </th>
                            <th className="p-4 lg:p-6 text-[11px] lg:text-[13px] font-black text-emerald-600/80 uppercase tracking-widest text-center whitespace-nowrap">
                              {selectedStatsWeek}주차 결과제출
                            </th>
                          </>
                        )}
                        <th className="p-4 lg:p-6 text-[11px] lg:text-[13px] font-black text-on-surface/80 uppercase tracking-widest text-right pr-8 lg:pr-12 whitespace-nowrap">관리</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-100">
                      {filteredStudents.map((s) => {
                        const isEditing = editingId === s.id;
                        return (
                        <motion.tr
                          key={s.id}
                          layout
                          onClick={() => !isEditing && onNavigateAI(s.id)}
                          className={`group hover:bg-neutral-50/50 transition-all ${isEditing ? 'bg-primary/[0.02] cursor-default' : 'cursor-pointer'} ${selectedIds.includes(s.id) ? 'bg-primary/[0.03]' : ''}`}
                        >
                          <td className="p-3 lg:p-6 text-center" onClick={(e) => e.stopPropagation()}>
                            <label className="flex items-center justify-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={selectedIds.includes(s.id)}
                                onChange={() => onSelectStudent(s.id)}
                              />
                              <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${selectedIds.includes(s.id) ? 'bg-primary border-primary' : 'border-neutral-300 group-hover:border-primary/40'}`}>
                                {selectedIds.includes(s.id) && <Check size={14} className="text-white" strokeWidth={4} />}
                              </div>
                            </label>
                          </td>
                          <td className="p-3 lg:p-6 w-20 lg:w-24 hidden sm:table-cell" onClick={(e) => isEditing && e.stopPropagation()}>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editNumber}
                                onChange={(e) => setEditNumber(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="번호"
                                className="w-16 px-3 py-2 bg-white border-2 border-primary/30 rounded-xl text-sm font-black text-primary focus:outline-none focus:border-primary"
                              />
                            ) : (
                              <span className="font-manrope font-black text-on-surface-variant/20 group-hover:text-primary transition-colors text-lg">
                                {s.number === '-' ? <span className="text-neutral-300 text-sm">미입력</span> : s.number.toString().padStart(2, '0')}
                              </span>
                            )}
                          </td>
                          <td className="p-3 lg:p-6" onClick={(e) => isEditing && e.stopPropagation()}>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="이름"
                                className="w-40 px-3 py-2 bg-white border-2 border-primary/30 rounded-xl text-sm font-black focus:outline-none focus:border-primary"
                              />
                            ) : (
                            <div className="flex items-center gap-3 lg:gap-4">
                              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center bg-primary/5 text-primary/40 shrink-0 shadow-sm border border-primary/10 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                <Users size={18} strokeWidth={2.5} />
                              </div>
                              <div className="flex flex-col">
                                <p className="text-sm font-black text-on-surface group-hover:text-primary transition-colors tracking-tight">{s.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-bold text-on-surface-variant/40">{s.tag || '학생'}</span>
                                  {suggestionCounts[s.id] > 0 && (
                                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-50 text-[8px] font-black text-rose-500 rounded border border-rose-100">
                                      💬 {suggestionCounts[s.id]}건
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            )}
                          </td>
                          <td className="p-3 lg:p-6 hidden lg:table-cell">
                             <div className="max-w-[400px]">
                                <p className="text-sm font-medium text-on-surface/80 group-hover:text-on-surface transition-colors line-clamp-1 italic">
                                  {s.activity ? `"${s.activity}"` : <span className="text-on-surface-variant/30 not-italic">최근 기록 없음</span>}
                                </p>
                             </div>
                          </td>
                          <td className="p-3 lg:p-6 text-center hidden md:table-cell">
                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border whitespace-nowrap ${
                              s.status === '발행됨' ? 'bg-secondary/5 text-secondary border-secondary/20' :
                              s.status === '미작성' ? 'bg-neutral-50 text-on-surface-variant/30 border-neutral-200' : 'bg-primary/5 text-primary border-primary/20'
                            }`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="p-6 text-center">
                            {s.status === '미작성' ? (
                              <span className="text-on-surface-variant/20 text-[10px] font-bold">—</span>
                            ) : (s.pending_obs_ids?.length > 0) ? (
                              <span className="px-3 py-1 rounded-lg text-[9px] font-black border bg-amber-50 text-amber-600 border-amber-200">승인 대기</span>
                            ) : (
                              <span className="px-3 py-1 rounded-lg text-[9px] font-black border bg-secondary/5 text-secondary border-secondary/20">승인 완료</span>
                            )}
                          </td>
                          {/* 주차별 관찰기록 / 결과제출 현황 셀 */}
                          {selectedStatsWeek !== null && (
                            <>
                              <td className="p-3 lg:p-6 text-center whitespace-nowrap">
                                {obsOnWeek.has(s.id) ? (
                                  <span className="px-2 py-1 rounded-md text-[9px] font-black bg-violet-50 text-violet-600 border border-violet-100 whitespace-nowrap">📝 제출</span>
                                ) : (
                                  <span className="text-neutral-300 font-bold text-sm">—</span>
                                )}
                              </td>
                              <td className="p-3 lg:p-6 text-center whitespace-nowrap">
                                {resultsOnWeek.has(s.id) ? (
                                  <span className="px-2 py-1 rounded-md text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 whitespace-nowrap">📁 제출</span>
                                ) : (
                                  <span className="text-neutral-300 font-bold text-sm">—</span>
                                )}
                              </td>
                            </>
                          )}

                          <td className="p-3 lg:p-6 text-right pr-6 lg:pr-10" onClick={(e) => e.stopPropagation()}>
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={handleSaveEdit}
                                  disabled={saving}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/80 active:scale-95 transition-all disabled:opacity-50"
                                >
                                  <Save size={13} />
                                  {saving ? '저장 중' : '저장'}
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-xl transition-all"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={(e) => handleStartEdit(e, s)} className="p-2 hover:bg-primary/10 text-neutral-400 hover:text-primary transition-all rounded-lg" title="편집"><Pencil size={14} /></button>
                              <button onClick={(e) => { e.stopPropagation(); onDeleteStudent(s.id); }} className="p-2 hover:bg-error/10 text-neutral-400 hover:text-error transition-all rounded-lg" title="삭제"><Trash2 size={14} /></button>
                              {/* PIN 보기 */}
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setPinPopupId(pinPopupId === s.id ? null : s.id); }}
                                  className="p-2 hover:bg-violet-50 text-neutral-400 hover:text-violet-500 transition-all rounded-lg"
                                  title="PIN 보기"
                                >
                                  {pinPopupId === s.id ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                                {pinPopupId === s.id && (
                                  <div className="absolute right-0 bottom-9 z-50 bg-neutral-900 text-white rounded-xl px-4 py-2.5 shadow-xl whitespace-nowrap">
                                    <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">PIN</p>
                                    <p className="text-lg font-black tracking-widest font-manrope">
                                      {s.pin ?? <span className="text-neutral-500 text-sm">미설정</span>}
                                    </p>
                                    <div className="absolute bottom-[-5px] right-4 w-2.5 h-2.5 bg-neutral-900 rotate-45" />
                                  </div>
                                )}
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); onResetPin(s.id); }} className="p-2 hover:bg-amber-50 text-neutral-400 hover:text-amber-500 transition-all rounded-lg" title="PIN 초기화"><KeyRound size={14} /></button>
                              <button onClick={(e) => { e.stopPropagation(); onNavigateAI(s.id); }} className="p-2 hover:bg-primary/10 text-primary/40 hover:text-primary transition-all rounded-lg" title="상세 보기"><ArrowRight size={16} /></button>
                            </div>
                            )}
                          </td>
                        </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="grid"
                variants={containerVariants}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 px-2"
              >
                {filteredStudents.map((s) => (
                  <motion.div 
                    key={s.id} 
                    variants={itemVariants}
                    onClick={() => onNavigateAI(s.id)}
                    className="layered-card p-10 rounded-[2.5rem] border-white/60 shadow-soft group cursor-pointer h-[400px] flex flex-col items-center justify-center text-center bg-white/60 hover:bg-white relative overflow-hidden"
                  >
                    <div className="relative mb-8">
                       <div className="w-28 h-28 rounded-[2rem] flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 text-primary/30 shadow-inner group-hover:scale-105 group-hover:from-primary/10 group-hover:to-secondary/10 group-hover:text-primary/50 transition-all duration-700">
                          <Users size={48} strokeWidth={1.5} />
                       </div>
                       <div className="absolute -top-3 -right-3 w-10 h-10 bg-on-surface text-surface rounded-xl flex items-center justify-center text-sm font-black shadow-lg group-hover:bg-primary transition-all">
                          {s.number.toString().padStart(2, '0')}
                       </div>
                    </div>

                    <div className="space-y-1.5 mb-8">
                      <h3 className="text-2xl font-black group-hover:text-primary transition-colors tracking-tight leading-tight">{s.name}</h3>
                      <span className="px-3 py-1 bg-primary/5 text-[9px] font-black text-primary/70 uppercase tracking-widest rounded-md border border-primary/10">{s.tag || 'Regular'}</span>
                    </div>

                    <div className="w-full p-6 layered-card bg-surface-container/30 border-transparent min-h-[90px] flex items-center justify-center mb-8 group-hover:bg-primary/5 transition-all">
                      <p className="text-sm font-bold text-on-surface-variant/70 leading-relaxed italic line-clamp-2">
                        {s.activity ? `"${s.activity}"` : '활동 기록 없음'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between w-full mt-auto">
                       <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] ${
                          s.status === '발행됨' ? 'bg-secondary/10 text-secondary border border-secondary/20' : 
                          s.status === '미작성' ? 'bg-on-surface/5 text-on-surface/30' : 'bg-primary/10 text-primary border border-primary/20'
                       }`}>
                         {s.status}
                       </span>
                       <ArrowRight size={20} className="text-primary transition-all" />
                    </div>

                    <div className="absolute top-6 left-6 flex flex-col gap-3">
                       <button onClick={(e) => { e.stopPropagation(); onNavigateAI(s.id); }} className="w-10 h-10 bg-white hover:bg-primary hover:text-white rounded-xl shadow-md flex items-center justify-center text-on-surface-variant/40 transition-all hover:scale-110"><Pencil size={16} /></button>
                       <button onClick={(e) => { e.stopPropagation(); onDeleteStudent(s.id); }} className="w-10 h-10 bg-white hover:bg-error hover:text-white rounded-xl shadow-md flex items-center justify-center text-error/30 transition-all hover:scale-110"><Trash2 size={16} /></button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </section>
    </motion.div>

    {/* 활동 참여 현황 모달 */}
    <AnimatePresence>
      {showActivityModal && (() => {
        // 주차 선택 여부에 따라 필터
        const submittedStudentIds = selectedActivityWeek !== null
          ? getSubmittedOnWeek(selectedActivityWeek)
          : null;

        const submitted = submittedStudentIds
          ? students.filter(s => submittedStudentIds.has(s.id))
          : students.filter(s => s.activity && s.activity !== '기록 없음');

        const notSubmitted = students.filter(s => !submitted.includes(s));

        const getActivityLabel = (s: any) => {
          if (selectedActivityWeek !== null) {
            return submittedStudentIds?.has(s.id) ? `${selectedActivityWeek}주차 제출완료` : s.activity;
          }
          return s.activity;
        };

        // 주차 목록 (모달용)
        const modalWeeks = statsWeeks;

        return (
          <div className="fixed inset-0 z-[900] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-10 py-7 border-b border-neutral-100">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-secondary uppercase tracking-[0.25em]">Activity Rate</p>
                  <h3 className="text-2xl font-black tracking-tight">
                    {classInfo?.name} {selectedActivityWeek !== null ? `${selectedActivityWeek}주차 ` : ''}활동 참여 현황
                  </h3>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3 text-right">
                    <div className="space-y-0.5">
                      <p className="text-2xl font-black text-secondary">{submitted.length}<span className="text-sm ml-1 opacity-50">명</span></p>
                      <p className="text-[9px] font-black text-secondary/60 uppercase tracking-widest">제출 완료</p>
                    </div>
                    <div className="w-px h-10 bg-neutral-100" />
                    <div className="space-y-0.5">
                      <p className="text-2xl font-black text-amber-500">{notSubmitted.length}<span className="text-sm ml-1 opacity-50">명</span></p>
                      <p className="text-[9px] font-black text-amber-500/60 uppercase tracking-widest">미제출</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowActivityModal(false); setSelectedActivityWeek(null); }}
                    className="p-2.5 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* 주차 필터 칩 */}
              {modalWeeks.length > 0 && (
                <div className="px-10 py-3 border-b border-neutral-100 flex items-center gap-2 overflow-x-auto custom-scrollbar">
                  <button
                    onClick={() => setSelectedActivityWeek(null)}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-[11px] font-black transition-all border ${
                      selectedActivityWeek === null
                        ? 'bg-secondary text-white border-secondary shadow-sm'
                        : 'bg-white text-neutral-400 border-neutral-200 hover:border-secondary/40'
                    }`}
                  >
                    전체
                  </button>
                  {modalWeeks.map(week => {
                    const topic = weeklyPlan.find(p => p.week === week)?.topic;
                    return (
                      <button
                        key={week}
                        onClick={() => setSelectedActivityWeek(week)}
                        className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-black transition-all border ${
                          selectedActivityWeek === week
                            ? 'bg-secondary text-white border-secondary shadow-sm'
                            : 'bg-white text-neutral-400 border-neutral-200 hover:border-secondary/40'
                        }`}
                      >
                        {week}주차{topic && <span className="opacity-60">· {topic}</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Modal Body */}
              <div className="flex-1 overflow-hidden grid grid-cols-2 divide-x divide-neutral-100">
                {/* 제출 완료 */}
                <div className="flex flex-col overflow-hidden">
                  <div className="px-8 py-4 bg-secondary/5 border-b border-secondary/10 flex items-center gap-2">
                    <CheckCheck size={14} className="text-secondary" />
                    <span className="text-[11px] font-black text-secondary uppercase tracking-widest">제출 완료 ({submitted.length}명)</span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar py-3">
                    {submitted.length > 0 ? (
                      submitted.map(s => (
                        <div key={s.id} className="flex items-center gap-3 px-8 py-3 hover:bg-secondary/5 transition-all group">
                          <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                            <Users size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black group-hover:text-secondary transition-colors">
                              {s.number && s.number !== '-' ? `${s.number}번 ` : ''}{s.name}
                            </p>
                            <p className="text-[10px] text-neutral-400 font-medium truncate">{getActivityLabel(s)}</p>
                          </div>
                          <CheckCircle2 size={14} className="text-secondary shrink-0" />
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full py-10 text-neutral-300 gap-2">
                        <CheckCheck size={32} />
                        <p className="text-xs font-bold">제출한 학생이 없습니다</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 미제출 */}
                <div className="flex flex-col overflow-hidden">
                  <div className="px-8 py-4 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                    <ClockIcon size={14} className="text-amber-500" />
                    <span className="text-[11px] font-black text-amber-600 uppercase tracking-widest">미제출 ({notSubmitted.length}명)</span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar py-3">
                    {notSubmitted.length > 0 ? (
                      notSubmitted.map(s => (
                        <div key={s.id} className="flex items-center gap-3 px-8 py-3 hover:bg-amber-50 transition-all group">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-400 shrink-0">
                            <Users size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black group-hover:text-amber-600 transition-colors">
                              {s.number && s.number !== '-' ? `${s.number}번 ` : ''}{s.name}
                            </p>
                            <p className="text-[10px] text-neutral-300 font-medium">기록 없음</p>
                          </div>
                          <ClockIcon size={14} className="text-amber-300 shrink-0" />
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full py-10 text-neutral-300 gap-2">
                        <ClockIcon size={32} />
                        <p className="text-xs font-bold">모두 제출 완료!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-10 py-5 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 bg-neutral-100 rounded-full w-40 overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full transition-all"
                      style={{ width: students.length > 0 ? `${(submitted.length / students.length) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-xs font-black text-on-surface-variant/60">
                    참여율 {students.length > 0 ? Math.round((submitted.length / students.length) * 100) : 0}%
                  </span>
                </div>
                <button
                  onClick={() => { setShowActivityModal(false); setSelectedActivityWeek(null); }}
                  className="px-6 py-2.5 bg-neutral-200 hover:bg-neutral-300 rounded-xl text-sm font-black text-neutral-600 transition-all"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}
    </AnimatePresence>
    </>
  );
};

export default SubjectDashboard;
