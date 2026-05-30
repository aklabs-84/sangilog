import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { Search, X, Loader2, ArrowRight, Users, GraduationCap } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  classes: any[];
}

const GlobalStudentSearch = ({ isOpen, onClose, classes }: Props) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // ESC 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 디바운스 검색
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }

    const timer = setTimeout(async () => {
      setLoading(true);
      const classIds = classes.map(c => c.id);
      if (classIds.length === 0) { setLoading(false); return; }

      const { data } = await supabase
        .from('students')
        .select('id, full_name, student_number, class_id')
        .in('class_id', classIds)
        .ilike('full_name', `%${query.trim()}%`)
        .order('full_name')
        .limit(30);

      const withClass = (data || []).map(s => ({
        ...s,
        classInfo: classes.find(c => c.id === s.class_id),
      }));

      setResults(withClass);
      setSelectedIdx(0);
      setLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [query, classes]);

  // 키보드 위아래 탐색
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      goToStudent(results[selectedIdx]);
    }
  };

  const goToStudent = (s: any) => {
    navigate(`/student-view/${s.id}`, { state: { fromClassId: s.class_id } });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-start justify-center pt-16 sm:pt-24 px-4">
          {/* 오버레이 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* 모달 */}
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100"
          >
            {/* 검색 입력 */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100">
              <Search size={17} className="text-neutral-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="전체 학급에서 학생 이름 검색..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 text-sm font-bold outline-none text-neutral-900 placeholder:text-neutral-400 bg-transparent"
              />
              {loading
                ? <Loader2 size={16} className="animate-spin text-neutral-400 shrink-0" />
                : query
                  ? <button onClick={() => setQuery('')} className="text-neutral-400 hover:text-neutral-600 shrink-0 transition-colors"><X size={16} /></button>
                  : null
              }
            </div>

            {/* 결과 목록 */}
            <div className="max-h-[380px] overflow-y-auto">
              {results.length > 0 ? (
                <div className="p-2">
                  {results.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => goToStudent(s)}
                      onMouseEnter={() => setSelectedIdx(i)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left ${
                        selectedIdx === i ? 'bg-primary/5' : 'hover:bg-neutral-50'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Users size={15} className="text-primary/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-neutral-900">
                          {s.student_number
                            ? <span className="text-primary/50 mr-1 font-bold">{s.student_number}번</span>
                            : null}
                          {s.full_name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <GraduationCap size={10} className="text-neutral-400 shrink-0" />
                          <p className="text-[11px] font-bold text-neutral-400 truncate">
                            {s.classInfo?.name}
                            {s.classInfo?.subject ? ` · ${s.classInfo.subject}` : ''}
                          </p>
                        </div>
                      </div>
                      <ArrowRight size={14} className={`shrink-0 transition-colors ${selectedIdx === i ? 'text-primary/50' : 'text-neutral-200'}`} />
                    </button>
                  ))}
                </div>
              ) : query.trim() && !loading ? (
                <div className="flex flex-col items-center py-10 gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-50 flex items-center justify-center mb-1">
                    <Search size={20} className="text-neutral-300" />
                  </div>
                  <p className="text-sm font-bold text-neutral-400">
                    "<span className="text-neutral-600">{query}</span>"에 해당하는 학생이 없습니다
                  </p>
                </div>
              ) : !query.trim() ? (
                <div className="flex flex-col items-center py-10 gap-1.5">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-50 flex items-center justify-center mb-1">
                    <Search size={20} className="text-neutral-300" />
                  </div>
                  <p className="text-sm font-bold text-neutral-500">학생 이름을 입력하세요</p>
                  <p className="text-[11px] text-neutral-400">전체 {classes.length}개 학급에서 검색합니다</p>
                </div>
              ) : null}
            </div>

            {/* 하단 힌트 */}
            <div className="px-5 py-2.5 border-t border-neutral-50 flex items-center gap-4">
              <span className="text-[10px] font-bold text-neutral-300">↑↓ 이동</span>
              <span className="text-[10px] font-bold text-neutral-300">Enter 선택</span>
              <span className="text-[10px] font-bold text-neutral-300">ESC 닫기</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default GlobalStudentSearch;
