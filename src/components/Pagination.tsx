import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

const Pagination = ({ page, totalPages, onChange }: PaginationProps) => {
  if (totalPages <= 1) return null;

  const pageNumbers: (number | 'ellipsis')[] = [];
  const addPage = (p: number) => {
    if (!pageNumbers.includes(p)) pageNumbers.push(p);
  };

  addPage(1);
  for (let p = page - 1; p <= page + 1; p++) {
    if (p > 1 && p < totalPages) addPage(p);
  }
  addPage(totalPages);

  const withEllipsis: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of pageNumbers.sort((a, b) => (a as number) - (b as number))) {
    if (prev && (p as number) - prev > 1) withEllipsis.push('ellipsis');
    withEllipsis.push(p);
    prev = p as number;
  }

  return (
    <div className="flex items-center justify-center gap-1.5 pt-6">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant/50 hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <ChevronLeft size={16} />
      </button>

      {withEllipsis.map((p, idx) =>
        p === 'ellipsis' ? (
          <span key={`e-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs font-black text-on-surface-variant/30">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-colors ${
              p === page ? 'bg-primary text-white' : 'text-on-surface-variant/60 hover:bg-surface-container'
            }`}
          >
            {p}
          </button>
        )
      )}

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
