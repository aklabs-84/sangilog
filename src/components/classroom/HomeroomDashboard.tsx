import { motion } from 'framer-motion';
import { useState } from 'react';
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
  Save
} from 'lucide-react';

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
  onSelectClass,
  onEditStudent
}: HomeroomDashboardProps) => {
  const isAllSelected = students.length > 0 && selectedIds.length === students.length;
  const filteredStudents = students.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.number?.toString().includes(searchQuery.toLowerCase())
  );

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

        <motion.div variants={itemVariants} className="layered-card p-6 flex flex-col justify-between min-h-[200px] group relative overflow-hidden">
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
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="layered-card p-6 col-span-1 md:col-span-2 flex flex-col justify-between min-h-[200px] group relative overflow-hidden border-primary/5 bg-gradient-to-br from-white via-white to-primary/5">
          <div className="absolute -top-10 -right-10 text-primary/5 group-hover:scale-110 transition-all duration-1000"><Sparkles size={200} /></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent shadow-sm"><CheckCircle2 size={20} /></div>
            <button
              onClick={onCopyCode}
              className="px-6 py-2.5 bg-on-surface text-surface rounded-xl text-[10px] font-black uppercase tracking-[0.12em] hover:bg-primary transition-all shadow-soft active:scale-95"
            >
              {copySuccess ? 'Copied! ✨' : `Code: ${classInfo.entry_code}`}
            </button>
          </div>
          <div className="relative z-10 space-y-2 max-w-sm">
             <p className="text-sm font-bold text-on-surface leading-snug">
               동료 교사에게 학급 코드를 공유하여 <span className="text-primary font-black underline decoration-primary/20 underline-offset-4">실시간 협업</span>을 시작하세요.
             </p>
             <p className="text-[10px] font-black text-on-surface-variant/50 tracking-[0.15em] uppercase">Collaboration Hub • Unified Data</p>
          </div>
        </motion.div>
      </div>

      {/* 3. Main Bento Content Section */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 px-4 pb-16">
        {/* Left Column: Linked Subjects */}
        <div className="xl:col-span-4 space-y-6">
          <div className="layered-card p-8 space-y-8">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-[0.2em]">Linked Subjects</h4>
              <span className="text-[9px] bg-secondary/10 text-secondary px-3 py-1 rounded-full font-black border border-secondary/20">{linkedClasses.length} Linked</span>
            </div>

            <div className="space-y-3">
               {linkedClasses.length > 0 ? (
                 linkedClasses.map((linkedClass) => (
                   <motion.div
                     key={linkedClass.id}
                     whileHover={{ x: 6, scale: 1.01 }}
                     whileTap={{ scale: 0.98 }}
                     onClick={() => onSelectClass(linkedClass.id)}
                     className="flex items-center justify-between p-4 bg-surface-container/30 rounded-2xl group hover:bg-white hover:shadow-soft transition-all cursor-pointer border border-transparent hover:border-primary/10 shadow-sm"
                   >
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all"><BookOpen size={18} /></div>
                       <div className="flex flex-col">
                         <span className="text-lg font-black group-hover:text-primary transition-colors tracking-tight">{linkedClass.subject}</span>
                         <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest">{linkedClass.teacher_profile?.full_name} 선생님</span>
                       </div>
                     </div>
                     <ArrowRight size={16} className="text-primary opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                   </motion.div>
                 ))
               ) : (
                 <div className="p-10 text-center border-2 border-dashed border-neutral-100 rounded-2xl">
                   <p className="text-xs font-bold text-neutral-400">연동된 교과 수업이 없습니다.</p>
                 </div>
               )}

               <button
                onClick={onInviteTeachers}
                className="w-full p-6 border-2 border-dashed border-primary/10 rounded-2xl text-[10px] font-black text-primary/40 hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all mt-4 uppercase tracking-[0.2em] flex items-center justify-center gap-2 group"
               >
                 <Plus size={16} className="group-hover:rotate-90 transition-transform duration-500" />
                 <span>교과 연동 요청하기</span>
               </button>
            </div>
          </div>

          <div className="layered-card p-8 bg-gradient-to-br from-secondary/5 via-white to-white relative overflow-hidden group border-secondary/5">
             <div className="absolute top-[-20%] right-[-10%] p-8 text-secondary/5 rotate-12 group-hover:rotate-45 transition-transform duration-1000"><Sparkles size={150} /></div>
             <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-secondary"><Sparkles size={20} /></div>
                <h5 className="text-[11px] font-black tracking-widest uppercase text-secondary">AI Smart Analytics</h5>
             </div>
             <p className="text-[13px] font-bold text-on-surface-variant leading-relaxed mb-6 relative z-10">
                누적된 과목별 활동 성향을 AI가 분석하여, <span className="text-on-surface font-black">학생별 맞춤형 세특 초안</span>을 생성합니다.
             </p>
             <button className="w-full py-4 bg-white border border-secondary/20 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] text-secondary shadow-soft hover:bg-secondary hover:text-white transition-all relative z-10">
                리포트 대시보드 열기
             </button>
          </div>
        </div>

        {/* Right Column: Student Data Center */}
        <div className="xl:col-span-8 layered-card p-8 bg-white flex flex-col min-h-[700px]">
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
                  onClick={onAddStudent}
                  className="btn-vibrant group flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm transition-all"
                 >
                   <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" />
                   <span>학생 등록</span>
                 </button>
               </div>
           </div>

           <div className="flex-1 overflow-x-auto custom-scrollbar bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
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
                             <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                               <button
                                 onClick={(e) => handleStartEdit(e, s)}
                                 className="p-2 text-neutral-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                 title="학생 정보 편집"
                               >
                                 <Pencil size={16} />
                               </button>
                               <div className="p-2 text-primary/40"><ArrowRight size={18} /></div>
                             </div>
                           )}
                         </td>
                       </motion.tr>
                     );
                   })
                 ) : (
                    <tr>
                      <td colSpan={5} className="py-24 text-center">
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
  );
};

export default HomeroomDashboard;
