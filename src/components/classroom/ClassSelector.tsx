import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, GraduationCap, Settings2, Trash2, Archive, ChevronDown, Check } from 'lucide-react';

interface ClassSelectorProps {
  classes: any[];
  activeClassId: string | null;
  onSelectClass: (id: string) => void;
  onCreateClass: () => void;
  onEditClass: (classInfo: any) => void;
  onDeleteClass: (id: string) => void;
  onOpenArchive: () => void;
}

const ClassSelector = ({
  classes,
  activeClassId,
  onSelectClass,
  onCreateClass,
  onEditClass,
  onDeleteClass,
  onOpenArchive
}: ClassSelectorProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeClass = classes.find(c => c.id === activeClassId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    onSelectClass(id);
    setOpen(false);
  };

  return (
    <nav className="w-full glass border-b border-white/10 px-6 py-3 shrink-0 z-50 sticky top-0 shadow-soft backdrop-blur-2xl">
      <div className="max-w-[1600px] mx-auto flex items-center gap-6">
        {/* Brand/Label */}
        <div className="hidden lg:flex flex-col items-start shrink-0 mr-2">
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary/40 leading-none">Classboard</span>
          <h2 className="text-[11px] font-black font-manrope text-on-surface tracking-tight mt-0.5">Management</h2>
        </div>

        <div className="w-px h-6 bg-on-surface/5 hidden lg:block" />

        {/* 현재 선택된 반 + 드롭다운 */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-primary/5 border border-primary/20 shadow-sm hover:bg-primary/10 transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
              <GraduationCap size={18} strokeWidth={2.5} />
            </div>

            {activeClass ? (
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-black tracking-tight text-on-surface">
                  {activeClass.name}
                </span>
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-primary/60">
                  {activeClass.subject}
                </span>
              </div>
            ) : (
              <span className="text-sm font-black text-on-surface-variant">반 선택</span>
            )}

            <ChevronDown
              size={16}
              className={`text-primary/50 ml-1 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />

            {/* active indicator */}
            <motion.div
              layoutId="active-nav-glow"
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]"
            />
          </button>

          {/* 드롭다운 메뉴 */}
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-3 w-72 glass rounded-2xl shadow-elevated border border-white/60 overflow-hidden z-[100]"
              >
                {/* 헤더 */}
                <div className="px-5 py-3 border-b border-neutral-100/60">
                  <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.2em]">
                    전체 학급 목록 ({classes.length})
                  </p>
                </div>

                {/* 학급 리스트 */}
                <div className="py-2 max-h-[320px] overflow-y-auto custom-scrollbar">
                  {classes.map(c => {
                    const isActive = c.id === activeClassId;
                    return (
                      <div
                        key={c.id}
                        className={`flex items-center justify-between px-4 py-3 mx-2 rounded-xl transition-all group/item ${
                          isActive
                            ? 'bg-primary/5 border border-primary/15'
                            : 'hover:bg-surface-container/60 cursor-pointer'
                        }`}
                        onClick={() => !isActive && handleSelect(c.id)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                            isActive ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-primary/5 text-primary/50 group-hover/item:bg-primary/10'
                          }`}>
                            <GraduationCap size={16} strokeWidth={2.5} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={`text-sm font-black tracking-tight truncate ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                              {c.name}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-variant/40">
                              {c.subject}
                            </span>
                          </div>
                        </div>

                        {isActive ? (
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <Check size={14} className="text-primary mr-1" />
                            <button
                              onClick={(e) => { e.stopPropagation(); onEditClass(c); setOpen(false); }}
                              className="p-1.5 hover:bg-primary/10 rounded-lg text-primary/40 hover:text-primary transition-all"
                              title="학급 수정"
                            >
                              <Settings2 size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDeleteClass(c.id); setOpen(false); }}
                              className="p-1.5 hover:bg-error/10 rounded-lg text-error/30 hover:text-error transition-all"
                              title="학급 삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-neutral-200 group-hover/item:border-primary/30 transition-all shrink-0 ml-2" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 푸터 액션 */}
                <div className="px-4 py-3 border-t border-neutral-100/60 flex gap-2">
                  <button
                    onClick={() => { onCreateClass(); setOpen(false); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary/90 active:scale-95 transition-all shadow-md shadow-primary/20"
                  >
                    <Plus size={14} strokeWidth={3} />
                    새 학급 추가
                  </button>
                  <button
                    onClick={() => { onOpenArchive(); setOpen(false); }}
                    className="px-4 py-2.5 bg-surface-container rounded-xl text-xs font-black text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all"
                    title="아카이브"
                  >
                    <Archive size={14} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 우측 여백 채우기 */}
        <div className="flex-1" />

        {/* Global Actions (드롭다운 외부에도 유지) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenArchive}
            className="w-9 h-9 rounded-xl bg-white border border-white/60 hover:border-secondary/20 text-on-surface hover:text-secondary transition-all active:scale-90 group shadow-sm hover:shadow-soft flex items-center justify-center"
            title="아카이브함 열기"
          >
            <Archive size={16} className="group-hover:-translate-y-0.5 transition-transform" />
          </button>
          <button
            onClick={onCreateClass}
            className="w-9 h-9 rounded-xl bg-white border border-white/60 hover:border-primary/20 text-on-surface hover:text-primary transition-all active:scale-90 group shadow-sm hover:shadow-soft flex items-center justify-center"
            title="새 학급 추가"
          >
            <Plus size={16} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-500" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default ClassSelector;
