import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  Users,
  BookOpen,
  LayoutDashboard,
  Search,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  ArrowLeftRight,
  UserPlus,
  Plus,
  Check,
  Pencil,
  X,
  Save,
  Maximize2,
  CheckCheck,
  Clock as ClockIcon,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface HomeroomDashboardProps {
  classInfo: any;
  students: any[];
  onInviteTeachers: () => void;
  onSelectStudent: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  copySuccess: boolean;
  onCopyCode: () => void;
  selectedIds: string[];
  onSelectStudentToggle: (id: string) => void;
  onSelectAll: (isSelect: boolean) => void;
  onAddStudent: () => void;
  linkedClasses: any[];
  onSelectClass: (id: string) => void;
  onEditStudent: (id: string, number: string, name: string) => Promise<void>;
  onDeleteStudent: (id: string) => void;
  onBulkApprove: () => void;
}

const HomeroomDashboard = ({
  classInfo,
  students,
  onInviteTeachers,
  onSelectStudent: onNavigateToStudent,
  searchQuery,
  setSearchQuery,
  copySuccess,
  onCopyCode,
  selectedIds,
  onSelectStudentToggle,
  onSelectAll,
  onAddStudent,
  linkedClasses,
  onSelectClass: _onSelectClass,
  onEditStudent,
  onDeleteStudent,
  onBulkApprove
}: HomeroomDashboardProps) => {
  const isAllSelected = students.length > 0 && selectedIds.length === students.length;
  const filteredStudents = students.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.number?.toString().includes(searchQuery.toLowerCase())
  );

  const [showCodeModal, setShowCodeModal] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowCodeModal(false); setShowFullscreen(false); }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  // ── 날짜별 제출 통계 ──
  const [showStats, setShowStats] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedStatsDate, setSelectedStatsDate] = useState<string | null>(null);
  const [rawObs, setRawObs] = useState<Array<{created_at: string, student_id: string}>>([]);
  const [rawResults, setRawResults] = useState<Array<{created_at: string, student_id: string}>>([]);
  const [rawSuggestions, setRawSuggestions] = useState<Array<{created_at: string, student_id: string}>>([]);

  const toDate = (d: string) => new Date(d).toISOString().slice(0, 10);

  // 데이터 있는 날짜 목록 (내림차순, 최대 14일)
  const statsDates = [...new Set([
    ...rawObs.map(r => toDate(r.created_at)),
    ...rawResults.map(r => toDate(r.created_at)),
    ...rawSuggestions.map(r => toDate(r.created_at))
  ])].sort((a, b) => b.localeCompare(a)).slice(0, 14);

  // 선택 날짜 기준 student_id Set
  const obsOnDate    = new Set(rawObs.filter(r => toDate(r.created_at) === selectedStatsDate).map(r => r.student_id));
  const resultsOnDate = new Set(rawResults.filter(r => toDate(r.created_at) === selectedStatsDate).map(r => r.student_id));
  const suggestOnDate = new Set(rawSuggestions.filter(r => toDate(r.created_at) === selectedStatsDate).map(r => r.student_id));

  useEffect(() => {
    const fetchActivityStats = async () => {
      if (!classInfo?.id || students.length === 0) return;
      setStatsLoading(true);
      try {
        const studentIds = students.map((s: any) => s.id);
        const [obsRes, resultsRes, suggestRes] = await Promise.all([
          supabase.from('observations').select('created_at, student_id').in('student_id', studentIds).eq('is_student_record', true),
          supabase.from('student_results').select('created_at, student_id').eq('class_id', classInfo.id),
          supabase.from('student_suggestions').select('created_at, student_id').eq('class_id', classInfo.id)
        ]);
        setRawObs(obsRes.data || []);
        setRawResults(resultsRes.data || []);
        setRawSuggestions(suggestRes.data || []);
      } catch (err) {
        console.error('fetchActivityStats error:', err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchActivityStats();
  }, [classInfo?.id, students.length]);
  const [selectedActivityDate, setSelectedActivityDate] = useState<string | null>(null);
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
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
              Homeroom Dashboard
            </span>
            {classInfo?.linked_class_id && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-secondary/10 text-secondary border border-secondary/20 rounded-full text-[9px] font-black uppercase tracking-[0.15em] whitespace-nowrap">
                <ArrowLeftRight size={10} /> Live Synced
              </span>
            )}
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl md:text-4xl font-black tracking-tightest leading-tight">
              <span className="gradient-text">{classInfo?.name}</span>
            </h1>
            <p className="text-on-surface-variant font-bold text-base mt-1 tracking-tight">담임 학급 관리 시스템</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onInviteTeachers}
            className="btn-vibrant group px-6 py-3.5 rounded-2xl font-black text-sm flex items-center gap-3 transition-all"
          >
            <UserPlus size={18} className="group-hover:rotate-12 transition-transform" />
            <span>교과 선생님 초대</span>
          </button>
        </div>
      </header>

      {/* 2. Bento Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 px-4">
        <motion.div variants={itemVariants} className="layered-card p-6 flex flex-col justify-between min-h-[200px] group relative overflow-hidden">
          <div className="absolute -top-8 -left-8 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
          <div className="flex items-center justify-between relative z-10">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-sm"><Users size={20} /></div>
            <span className="text-[9px] font-black text-on-surface-variant/40 tracking-[0.15em] uppercase">Total Students</span>
          </div>
          <div className="relative z-10">
            <h3 className="text-4xl font-black tracking-tighter">{students.length}<span className="text-base ml-1.5 opacity-40">명</span></h3>
            <p className="text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-wide">학급 전체 인원</p>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          onClick={() => setShowActivityModal(true)}
          className="layered-card p-6 flex flex-col justify-between min-h-[200px] group relative overflow-hidden cursor-pointer hover:shadow-lg hover:border-secondary/30 transition-all"
        >
          <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-secondary/5 rounded-full blur-3xl group-hover:bg-secondary/10 transition-colors" />
          <div className="flex items-center justify-between relative z-10">
            <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary group-hover:scale-110 transition-transform shadow-sm"><BookOpen size={20} /></div>
            <span className="text-[9px] font-black text-on-surface-variant/40 tracking-[0.15em] uppercase">Activity Rate</span>
          </div>
          <div className="relative z-10">
            <h3 className="text-4xl font-black tracking-tighter">
              {students.filter(s => s.activity && s.activity !== '기록 없음').length}<span className="text-base ml-1.5 opacity-40">명</span>
            </h3>
            <p className="text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-wide">최근 활동 참여</p>
            <p className="text-[9px] font-black text-secondary/40 mt-1 uppercase tracking-widest group-hover:text-secondary transition-colors">클릭하여 현황 보기 →</p>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="layered-card p-6 col-span-1 md:col-span-2 flex flex-col justify-between min-h-[200px] group relative overflow-hidden border-primary/5 bg-gradient-to-br from-white via-white to-primary/5">
          <div className="absolute -top-10 -right-10 text-primary/5 group-hover:scale-110 transition-all duration-1000"><Sparkles size={200} /></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent shadow-sm"><CheckCircle2 size={20} /></div>
            <button
              onClick={() => { onCopyCode(); setShowCodeModal(true); }}
              className="px-6 py-2.5 bg-on-surface text-surface rounded-xl text-[10px] font-black uppercase tracking-[0.12em] hover:bg-primary transition-all shadow-soft active:scale-95"
            >
              {copySuccess ? 'Copied! ✨' : `Code: ${classInfo.entry_code}`}
            </button>
          </div>
          <div className="relative z-10 space-y-2 max-w-sm">
             <p className="text-sm font-bold text-on-surface leading-snug">
               학생들에게 참여 코드를 공유하여 <span className="text-primary font-black underline decoration-primary/20 underline-offset-4">수업 기록</span>을 시작하세요.
             </p>
             <p className="text-[10px] font-black text-on-surface-variant/50 tracking-[0.15em] uppercase">Student Entry Code • 학생 전용</p>
          </div>
        </motion.div>
      </div>

      {/* 3. Student Data Center - Full Width */}
      <section className="px-4 pb-16">
        <div className="layered-card p-8 bg-white flex flex-col">
           <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
              <div className="space-y-1">
                <h2 className="text-2xl font-black flex items-center gap-4 tracking-tight">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary"><LayoutDashboard size={20} /></div>
                  학급 데이터 센터
                </h2>
                <p className="text-xs font-bold text-on-surface-variant/60 ml-14">실시간 연동 데이터 기반 학생 프로필</p>
              </div>

              <div className="flex items-center gap-4">
                 <div className="relative group flex-1 max-w-sm">
                   <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary transition-colors" />
                   <input
                     type="text"
                     placeholder="학생 검색..."
                     value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                     className="bg-white border-2 border-neutral-200 hover:border-neutral-300 focus:border-primary/40 text-sm font-bold text-neutral-900 outline-none pl-14 pr-8 py-4 rounded-2xl w-full transition-all placeholder:text-neutral-400 shadow-sm"
                   />
                 </div>
                 <button
                   onClick={() => setShowFullscreen(true)}
                   className="p-4 rounded-2xl border-2 border-neutral-200 hover:border-primary/40 hover:bg-primary/5 text-neutral-400 hover:text-primary transition-all"
                   title="전체화면으로 보기"
                 >
                   <Maximize2 size={18} />
                 </button>
                 {(() => {
                   const pendingCount = students.reduce((acc, s) => acc + (s.pending_obs_ids?.length || 0), 0);
                   return pendingCount > 0 ? (
                     <button
                       onClick={onBulkApprove}
                       className="flex items-center gap-2 px-6 py-4 rounded-2xl font-black text-sm bg-amber-50 border-2 border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all"
                       title={`승인 대기 ${pendingCount}건 일괄 승인`}
                     >
                       <CheckCheck size={16} />
                       <span>일괄 승인 ({pendingCount})</span>
                     </button>
                   ) : null;
                 })()}
                 <button
                  onClick={onAddStudent}
                  className="btn-vibrant group flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm transition-all"
                 >
                   <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" />
                   <span>학생 등록</span>
                 </button>
               </div>
           </div>

           {/* ── 날짜별 제출 현황 통계 ── */}
           <div className="mb-6 rounded-2xl border border-neutral-100 bg-neutral-50/60 overflow-hidden">
             <button
               onClick={() => setShowStats(v => !v)}
               className="w-full flex items-center justify-between px-6 py-4 hover:bg-neutral-100/60 transition-colors"
             >
               <div className="flex items-center gap-3">
                 <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                   <BarChart2 size={14} />
                 </div>
                 <span className="text-sm font-black text-on-surface">날짜별 제출 현황</span>
                 {statsDates.length > 0 && (
                   <span className="text-[10px] font-bold text-on-surface-variant/50 bg-white px-2 py-0.5 rounded-md border border-neutral-200">
                     최근 {statsDates.length}일
                   </span>
                 )}
                 {selectedStatsDate && (
                   <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                     {(() => { const [, m, d] = selectedStatsDate.split('-'); return `${parseInt(m)}월 ${parseInt(d)}일 선택됨`; })()}
                   </span>
                 )}
               </div>
               {showStats ? <ChevronUp size={16} className="text-on-surface-variant/40" /> : <ChevronDown size={16} className="text-on-surface-variant/40" />}
             </button>

             {showStats && (
               <div className="px-6 pb-5">
                 {statsLoading ? (
                   <div className="flex items-center justify-center py-6 text-on-surface-variant/40">
                     <span className="text-xs font-bold">불러오는 중...</span>
                   </div>
                 ) : statsDates.length === 0 ? (
                   <div className="text-center py-6 text-on-surface-variant/30">
                     <p className="text-xs font-black">제출된 데이터가 없습니다.</p>
                   </div>
                 ) : (
                   <div className="space-y-4">
                     {/* 날짜 칩 */}
                     <div className="flex items-center gap-2 flex-wrap">
                       {statsDates.map(date => {
                         const [, m, d] = date.split('-');
                         const label = `${parseInt(m)}/${parseInt(d)}`;
                         const isSelected = selectedStatsDate === date;
                         return (
                           <button
                             key={date}
                             onClick={() => setSelectedStatsDate(isSelected ? null : date)}
                             className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all border ${
                               isSelected
                                 ? 'bg-primary text-white border-primary shadow-sm'
                                 : 'bg-white text-neutral-400 border-neutral-200 hover:border-primary/40 hover:text-primary'
                             }`}
                           >
                             {label}
                           </button>
                         );
                       })}
                     </div>

                     {/* 선택 날짜 카테고리 요약 */}
                     {selectedStatsDate ? (
                       <div className="flex items-center gap-3 flex-wrap">
                         {[
                           { label: '📝 활동 기록', count: obsOnDate.size, colorClass: 'bg-violet-50 border-violet-100 text-violet-700' },
                           { label: '📁 결과 제출', count: resultsOnDate.size, colorClass: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
                           { label: '💬 건의사항', count: suggestOnDate.size, colorClass: 'bg-rose-50 border-rose-100 text-rose-700' },
                         ].map(({ label, count, colorClass }) => (
                           <div key={label} className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black ${colorClass}`}>
                             <span>{label}</span>
                             <span className="text-base font-black">{count}</span>
                             <span className="font-bold opacity-60">명</span>
                           </div>
                         ))}
                         <p className="text-[10px] font-bold text-on-surface-variant/40 ml-1">아래 표에서 제출 현황을 확인하세요</p>
                       </div>
                     ) : (
                       <p className="text-[11px] font-bold text-on-surface-variant/40">날짜를 선택하면 해당일 제출 현황이 아래 표에 표시됩니다.</p>
                     )}
                   </div>
                 )}
               </div>
             )}
           </div>

           <div className="overflow-x-auto bg-white rounded-3xl border border-neutral-100 shadow-sm">
             <table className="w-full text-left border-collapse min-w-[700px]">
               <thead className="sticky top-0 z-10">
                 <tr className="bg-neutral-50 border-b border-neutral-100">
                   <th className="p-6 text-center w-16">
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
                   <th className="p-6 text-[13px] font-black text-on-surface/80 uppercase tracking-widest">NO.</th>
                   <th className="p-6 text-[13px] font-black text-on-surface/80 uppercase tracking-widest">학생 정보</th>
                   <th className="p-6 text-[13px] font-black text-on-surface/80 uppercase tracking-widest text-center">연동 과목</th>
                   <th className="p-6 text-[13px] font-black text-on-surface/80 uppercase tracking-widest text-center">승인</th>
                   {selectedStatsDate && (
                     <th className="p-6 text-[13px] font-black text-primary/80 uppercase tracking-widest text-center">
                       {(() => { const [, m, d] = selectedStatsDate.split('-'); return `${parseInt(m)}/${parseInt(d)} 제출`; })()}
                     </th>
                   )}
                   <th className="p-6 text-[13px] font-black text-on-surface/80 uppercase tracking-widest text-right pr-12">관리</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-neutral-100">
                 {filteredStudents.length > 0 ? (
                   filteredStudents.map((s) => {
                     const isEditing = editingId === s.id;
                     return (
                       <motion.tr
                         key={s.id}
                         layout
                         onClick={() => !isEditing && onNavigateToStudent(s.id)}
                         className={`group hover:bg-neutral-50/50 transition-all ${isEditing ? 'bg-primary/[0.02] cursor-default' : 'cursor-pointer'} ${selectedIds.includes(s.id) ? 'bg-primary/[0.03]' : ''}`}
                       >
                         <td className="p-6 text-center" onClick={(e) => e.stopPropagation()}>
                           <label className="flex items-center justify-center cursor-pointer">
                             <input
                               type="checkbox"
                               className="hidden"
                               checked={selectedIds.includes(s.id)}
                               onChange={() => onSelectStudentToggle(s.id)}
                             />
                             <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${selectedIds.includes(s.id) ? 'bg-primary border-primary' : 'border-neutral-300 group-hover:border-primary/40'}`}>
                               {selectedIds.includes(s.id) && <Check size={14} className="text-white" strokeWidth={4} />}
                             </div>
                           </label>
                         </td>

                         {/* NO. 셀 */}
                         <td className="p-6 w-24" onClick={(e) => isEditing && e.stopPropagation()}>
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

                         {/* 학생 정보 셀 */}
                         <td className="p-6" onClick={(e) => isEditing && e.stopPropagation()}>
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
                             <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/5 text-primary/40 shrink-0 shadow-sm border border-primary/10 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                 <Users size={18} strokeWidth={2.5} />
                               </div>
                               <div className="flex flex-col">
                                 <p className="text-sm font-black text-on-surface group-hover:text-primary transition-colors tracking-tight">{s.name}</p>
                                 <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="px-1.5 py-0.5 bg-primary/5 text-[8px] font-black text-primary/70 uppercase tracking-wider rounded border border-primary/10">{s.tag || '학생'}</span>
                                 </div>
                               </div>
                             </div>
                           )}
                         </td>

                         <td className="p-6 text-center">
                             <div className="flex items-center justify-center gap-1.5 overflow-hidden">
                               {linkedClasses.length > 0 ? (
                                 linkedClasses.map((linkedClass) => (
                                   <div
                                     key={linkedClass.id}
                                     title={linkedClass.subject}
                                     className="w-8 h-8 rounded-lg border border-neutral-200 bg-white flex items-center justify-center text-[10px] font-black text-on-surface-variant/40 group-hover:border-primary/20 group-hover:text-primary transition-all shadow-sm shrink-0"
                                   >
                                     {linkedClass.subject.charAt(0)}
                                   </div>
                                 ))
                               ) : (
                                 <span className="text-[10px] font-bold text-on-surface-variant/20 italic">No linked subjects</span>
                               )}
                             </div>
                         </td>

                         {/* 승인 셀 */}
                         <td className="p-6 text-center">
                           {(!s.activity || s.activity === '기록 없음') ? (
                             <span className="text-on-surface-variant/20 text-[10px] font-bold">—</span>
                           ) : (s.pending_obs_ids?.length > 0) ? (
                             <span className="px-3 py-1 rounded-lg text-[9px] font-black border bg-amber-50 text-amber-600 border-amber-200">승인 대기</span>
                           ) : (
                             <span className="px-3 py-1 rounded-lg text-[9px] font-black border bg-secondary/5 text-secondary border-secondary/20">승인 완료</span>
                           )}
                         </td>

                         {/* 날짜별 제출 현황 셀 */}
                         {selectedStatsDate && (
                           <td className="p-6 text-center">
                             <div className="flex items-center justify-center gap-1 flex-wrap">
                               {obsOnDate.has(s.id) && (
                                 <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-violet-50 text-violet-600 border border-violet-100 whitespace-nowrap">📝활동</span>
                               )}
                               {resultsOnDate.has(s.id) && (
                                 <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 whitespace-nowrap">📁결과</span>
                               )}
                               {suggestOnDate.has(s.id) && (
                                 <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-rose-50 text-rose-600 border border-rose-100 whitespace-nowrap">💬건의</span>
                               )}
                               {!obsOnDate.has(s.id) && !resultsOnDate.has(s.id) && !suggestOnDate.has(s.id) && (
                                 <span className="text-neutral-300 font-bold text-sm">—</span>
                               )}
                             </div>
                           </td>
                         )}

                         {/* 관리 셀 */}
                         <td className="p-6 text-right pr-10" onClick={(e) => e.stopPropagation()}>
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
                             <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                               <button
                                 onClick={(e) => handleStartEdit(e, s)}
                                 className="p-2 text-neutral-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                 title="학생 정보 편집"
                               >
                                 <Pencil size={16} />
                               </button>
                               <button
                                 onClick={(e) => { e.stopPropagation(); onDeleteStudent(s.id); }}
                                 className="p-2 text-neutral-400 hover:text-error hover:bg-error/10 rounded-xl transition-all"
                                 title="학생 삭제"
                               >
                                 <Trash2 size={16} />
                               </button>
                               <button
                                 onClick={(e) => { e.stopPropagation(); onNavigateToStudent(s.id); }}
                                 className="p-2 text-primary/40 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                 title="상세 보기"
                               >
                                 <ArrowRight size={18} />
                               </button>
                             </div>
                           )}
                         </td>
                       </motion.tr>
                     );
                   })
                 ) : (
                    <tr>
                      <td colSpan={selectedStatsDate ? 7 : 6} className="py-24 text-center">
                        <div className="flex flex-col items-center justify-center text-on-surface-variant/20 gap-4">
                          <div className="p-6 bg-neutral-50 rounded-full shadow-inner"><Search size={40} /></div>
                          <p className="font-black text-xs tracking-widest uppercase">일치하는 학생이 없습니다</p>
                        </div>
                      </td>
                    </tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      </section>
    </motion.div>

    {/* 참여 코드 전체화면 모달 */}
    <AnimatePresence>
      {showCodeModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[900] flex flex-col items-center justify-center bg-[#0a0a0f]"
          onClick={() => setShowCodeModal(false)}
        >
          {/* 닫기 */}
          <button
            onClick={() => setShowCodeModal(false)}
            className="absolute top-8 right-8 p-3 rounded-2xl text-white/30 hover:text-white hover:bg-white/10 transition-all z-10"
          >
            <X size={24} />
          </button>

          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.25 }}
            className="flex flex-col items-center gap-10 px-8 w-full max-w-3xl"
            onClick={e => e.stopPropagation()}
          >
            {/* 상단 레이블 */}
            <div className="text-center space-y-2">
              <p className="text-xs font-black text-white/40 uppercase tracking-[0.5em]">학생 참여 코드</p>
              <p className="text-white/70 font-bold text-lg">{classInfo.name}</p>
            </div>

            {/* 코드 박스 — 진한 배경 + 노란색 코드 */}
            <div className="w-full bg-[#111118] border-2 border-yellow-400/30 rounded-[2.5rem] py-16 px-10 flex items-center justify-center shadow-[0_0_80px_rgba(250,204,21,0.15)] overflow-hidden">
              <p
                className="font-black font-manrope text-yellow-300 select-all text-center leading-none w-full"
                style={{ fontSize: 'clamp(3rem, 12vw, 7rem)', letterSpacing: '0.08em' }}
              >
                {classInfo.entry_code}
              </p>
            </div>

            {/* 안내 */}
            <p className="text-white/40 font-bold text-sm text-center leading-relaxed">
              학생들이 <span className="text-yellow-300 font-black">생기로그 → 수업 입장하기</span>에서<br />
              위 코드를 입력하면 바로 참여할 수 있습니다.
            </p>

            {/* 버튼 */}
            <button
              onClick={() => { onCopyCode(); }}
              className="px-12 py-5 btn-gradient rounded-2xl font-black text-base flex items-center justify-center gap-3 shadow-2xl shadow-primary/30 active:scale-95 transition-all"
            >
              {copySuccess ? '✨ 링크 복사 완료!' : '📋 학생 입장 링크 복사'}
            </button>

            <p className="text-white/15 text-[10px] font-bold uppercase tracking-widest">배경 클릭 또는 ESC로 닫기</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* 전체화면 학생 목록 모달 */}
    <AnimatePresence>
      {showFullscreen && (
        <div className="fixed inset-0 z-[950] flex flex-col bg-white">
          {/* Fullscreen Header */}
          <div className="flex items-center justify-between px-10 py-6 border-b border-neutral-100 bg-white shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <LayoutDashboard size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">{classInfo?.name} — 학급 학생 목록</h2>
                <p className="text-xs font-bold text-on-surface-variant/60">전체 {students.length}명</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="학생 검색..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-neutral-50 border border-neutral-200 text-sm font-bold text-neutral-900 outline-none pl-10 pr-6 py-3 rounded-xl w-64 transition-all focus:border-primary/40"
                />
              </div>
              <button
                onClick={() => setShowFullscreen(false)}
                className="p-3 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Fullscreen Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-8 py-5 text-[11px] font-black text-on-surface/60 uppercase tracking-widest w-20">NO.</th>
                  <th className="px-8 py-5 text-[11px] font-black text-on-surface/60 uppercase tracking-widest">학생 이름</th>
                  <th className="px-8 py-5 text-[11px] font-black text-on-surface/60 uppercase tracking-widest">최근 활동</th>
                  <th className="px-8 py-5 text-[11px] font-black text-on-surface/60 uppercase tracking-widest">연동 과목</th>
                  <th className="px-8 py-5 text-[11px] font-black text-on-surface/60 uppercase tracking-widest text-right">상세 보기</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredStudents.map((s, _idx) => (
                  <tr
                    key={s.id}
                    onClick={() => { onNavigateToStudent(s.id); setShowFullscreen(false); }}
                    className="hover:bg-primary/[0.02] cursor-pointer transition-all group"
                  >
                    <td className="px-8 py-4">
                      <span className="font-black text-on-surface-variant/30 text-base font-manrope">
                        {s.number === '-' ? <span className="text-neutral-300 text-sm">-</span> : s.number.toString().padStart(2, '0')}
                      </span>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/5 text-primary/40 shrink-0 border border-primary/10 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                          <Users size={16} strokeWidth={2.5} />
                        </div>
                        <span className="text-sm font-black group-hover:text-primary transition-colors">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      {s.activity && s.activity !== '기록 없음' ? (
                        <div className="flex items-center gap-2">
                          <CheckCheck size={14} className="text-secondary shrink-0" />
                          <span className="text-sm font-bold text-on-surface truncate max-w-[240px]">{s.activity}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-neutral-300 italic">기록 없음</span>
                      )}
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-1.5">
                        {linkedClasses.length > 0 ? (
                          linkedClasses.map((lc) => (
                            <div key={lc.id} title={lc.subject} className="w-7 h-7 rounded-lg border border-neutral-200 bg-white flex items-center justify-center text-[10px] font-black text-on-surface-variant/40 shadow-sm">
                              {lc.subject.charAt(0)}
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-neutral-300">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <ArrowRight size={16} className="text-primary/30 group-hover:text-primary ml-auto transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Fullscreen Footer */}
          <div className="px-10 py-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
            <p className="text-xs font-bold text-neutral-400">
              전체 {students.length}명 중 {filteredStudents.length}명 표시
              {searchQuery && ` — "${searchQuery}" 검색 결과`}
            </p>
            <button
              onClick={() => setShowFullscreen(false)}
              className="px-6 py-2.5 bg-neutral-200 hover:bg-neutral-300 rounded-xl text-sm font-black text-neutral-600 transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </AnimatePresence>

    {/* 활동 참여 현황 모달 */}
    <AnimatePresence>
      {showActivityModal && (() => {
        // 전체 날짜 추출 (중복 제거, 최신순)
        const allDates = [...new Set(
          students.flatMap(s => (s.all_observations || []).map((o: any) =>
            new Date(o.created_at).toISOString().slice(0, 10)
          ))
        )].sort((a, b) => b.localeCompare(a));

        const formatDate = (iso: string) => {
          const d = new Date(iso);
          return `${d.getMonth() + 1}/${d.getDate()}`;
        };

        const submitted = selectedActivityDate
          ? students.filter(s =>
              (s.all_observations || []).some((o: any) =>
                new Date(o.created_at).toISOString().slice(0, 10) === selectedActivityDate
              )
            )
          : students.filter(s => s.activity && s.activity !== '기록 없음');

        const notSubmitted = students.filter(s => !submitted.includes(s));

        const getActivityLabel = (s: any) => {
          if (!selectedActivityDate) return s.activity;
          const obs = (s.all_observations || []).find((o: any) =>
            new Date(o.created_at).toISOString().slice(0, 10) === selectedActivityDate
          );
          return obs?.activity_name || s.activity;
        };

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
                  <h3 className="text-2xl font-black tracking-tight">{classInfo?.name} 활동 참여 현황</h3>
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
                    onClick={() => { setShowActivityModal(false); setSelectedActivityDate(null); }}
                    className="p-2.5 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* 날짜 필터 칩 */}
              {allDates.length > 0 && (
                <div className="px-10 py-3 border-b border-neutral-100 flex items-center gap-2 overflow-x-auto custom-scrollbar">
                  <button
                    onClick={() => setSelectedActivityDate(null)}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-[11px] font-black transition-all border ${
                      selectedActivityDate === null
                        ? 'bg-secondary text-white border-secondary shadow-sm'
                        : 'bg-white text-neutral-400 border-neutral-200 hover:border-secondary/40'
                    }`}
                  >
                    전체
                  </button>
                  {allDates.map(date => (
                    <button
                      key={date}
                      onClick={() => setSelectedActivityDate(date)}
                      className={`shrink-0 px-4 py-1.5 rounded-full text-[11px] font-black transition-all border ${
                        selectedActivityDate === date
                          ? 'bg-secondary text-white border-secondary shadow-sm'
                          : 'bg-white text-neutral-400 border-neutral-200 hover:border-secondary/40'
                      }`}
                    >
                      {formatDate(date)}
                    </button>
                  ))}
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
                        <div
                          key={s.id}
                          onClick={() => { onNavigateToStudent(s.id); setShowActivityModal(false); setSelectedActivityDate(null); }}
                          className="flex items-center gap-3 px-8 py-3 hover:bg-secondary/5 cursor-pointer transition-all group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                            <Users size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black group-hover:text-secondary transition-colors">
                              {s.number !== '-' ? `${s.number}번 ` : ''}{s.name}
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
                        <div
                          key={s.id}
                          onClick={() => { onNavigateToStudent(s.id); setShowActivityModal(false); setSelectedActivityDate(null); }}
                          className="flex items-center gap-3 px-8 py-3 hover:bg-amber-50 cursor-pointer transition-all group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-400 shrink-0">
                            <Users size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black group-hover:text-amber-600 transition-colors">
                              {s.number !== '-' ? `${s.number}번 ` : ''}{s.name}
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
                  onClick={() => { setShowActivityModal(false); setSelectedActivityDate(null); }}
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

export default HomeroomDashboard;
