import { motion } from 'framer-motion';
import { Plus, GraduationCap, Settings2, Trash2, Archive } from 'lucide-react';

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
  return (
    <nav className="w-full glass border-b border-white/10 px-6 py-3 shrink-0 z-50 sticky top-0 shadow-soft backdrop-blur-2xl">
      <div className="max-w-[1600px] mx-auto flex items-center gap-6">
        {/* Brand/Label */}
        <div className="hidden lg:flex flex-col items-start shrink-0 mr-4">
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary/40 leading-none">Classboard</span>
          <h2 className="text-[11px] font-black font-manrope text-on-surface tracking-tight mt-0.5">Management</h2>
        </div>

        <div className="w-px h-6 bg-on-surface/5 hidden lg:block" />

        {/* Class List (Horizontal) */}
        <div className="flex-1 flex items-center gap-3 overflow-x-auto no-scrollbar py-1 px-1">
          {classes.map(c => {
            const isActive = activeClassId === c.id;
            
            if (isActive) {
              return (
                <div 
                  key={c.id}
                  className="relative px-6 py-2.5 rounded-2xl flex items-center gap-4 transition-all duration-500 bg-primary/5 border border-primary/20 shadow-sm shrink-0"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                    <GraduationCap size={18} strokeWidth={2.5} />
                  </div>
                  
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-black tracking-tight text-on-surface">
                      {c.name}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-primary/60">
                      {c.subject}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 ml-2">
                    <button 
                      onClick={() => onEditClass(c)}
                      className="p-2 hover:bg-primary/10 rounded-lg text-primary/40 hover:text-primary transition-all group/edit"
                      title="학급 정보 수정"
                    >
                      <Settings2 size={16} className="group-hover/edit:rotate-45 transition-transform" />
                    </button>
                    <button 
                      onClick={() => onDeleteClass(c.id)}
                      className="p-2 hover:bg-error/10 rounded-lg text-error/40 hover:text-error transition-all group/delete"
                      title="학급 삭제(아카이브)"
                    >
                      <Trash2 size={16} className="group-hover/delete:scale-110 transition-transform" />
                    </button>
                  </div>

                  <motion.div 
                    layoutId="active-nav-glow"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]"
                  />
                </div>
              );
            }

            return (
              <button 
                key={c.id} 
                onClick={() => onSelectClass(c.id)}
                className="relative px-5 py-2.5 rounded-xl flex items-center gap-3.5 transition-all duration-300 group shrink-0 border bg-white/40 hover:bg-white text-on-surface-variant/60 border-white/40 hover:border-primary/10 hover:shadow-sm"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 bg-primary/5 text-primary group-hover:bg-primary/10">
                  <GraduationCap size={16} strokeWidth={2.5} />
                </div>
                
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-black tracking-tight whitespace-nowrap text-on-surface">
                    {c.name}
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-[0.1em] whitespace-nowrap text-on-surface-variant/30 group-hover:text-primary/40">
                    {c.subject}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-3 shrink-0 pl-6 border-l border-on-surface/5">
          <button 
              onClick={onOpenArchive}
              className="w-10 h-10 rounded-xl bg-white border border-white/60 hover:border-secondary/20 text-on-surface hover:text-secondary transition-all active:scale-90 group shadow-sm hover:shadow-soft flex items-center justify-center"
              title="아카이브함 열기"
            >
              <Archive size={18} className="group-hover:-translate-y-0.5 transition-transform" />
          </button>
          <button 
              onClick={onCreateClass}
              className="w-10 h-10 rounded-xl bg-white border border-white/60 hover:border-primary/20 text-on-surface hover:text-primary transition-all active:scale-90 group shadow-sm hover:shadow-soft flex items-center justify-center"
              title="새 학급 추가"
            >
              <Plus size={18} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-500" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default ClassSelector;
