import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

const Pagination = ({ page, totalPages, onChange }: PaginationProps) => {
  if (totalPages <= 1) return null;

  const WINDOW_SIZE = 5;
  const windowStart = Math.floor((page - 1) / WINDOW_SIZE) * WINDOW_SIZE + 1;
  const windowEnd = Math.min(windowStart + WINDOW_SIZE - 1, totalPages);
  const pageNumbers: number[] = [];
  for (let p = windowStart; p <= windowEnd; p++) pageNumbers.push(p);

  return (
    <div className="flex items-center justify-center gap-1.5 pt-6">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant/50 hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <ChevronLeft size={16} />
      </button>

      {pageNumbers.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-colors ${
            p === page ? 'bg-primary text-white' : 'text-on-surface-variant/60 hover:bg-surface-container'
          }`}
        >
          {p}
        </button>
      ))}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant/50 hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};

export default Pagination;
