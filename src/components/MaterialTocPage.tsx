export interface TocSection {
  level: number; // 1~3 (마크다운 #/##/### 깊이)
  text: string;
}

interface MaterialTocPageProps {
  title: string;
  sections: TocSection[];
}

// 수업 자료 PDF 목차 페이지 — 본문 소제목(#~###)을 순서대로 나열.
// Chrome이 target-counter()를 지원하지 않아 항목별 페이지 번호는 표시하지 않는다.
export default function MaterialTocPage({ title, sections }: MaterialTocPageProps) {
  return (
    <div className="relative w-full h-full flex flex-col px-10 py-12 bg-white">
      <p className="text-xs font-black text-primary tracking-widest mb-2">CONTENTS</p>
      <h1 className="text-2xl font-black text-on-surface mb-8 break-keep">{title}</h1>
      <ol className="space-y-3 overflow-hidden">
        {sections.map((s, i) => (
          <li key={i} className="flex items-baseline gap-2" style={{ paddingLeft: `${(s.level - 1) * 1.25}rem` }}>
            <span
              className={`shrink-0 rounded-full ${s.level === 1 ? 'w-1.5 h-1.5 bg-primary' : 'w-1 h-1 bg-on-surface-variant'}`}
            />
            <span className={s.level === 1 ? 'font-black text-base text-on-surface' : 'font-bold text-sm text-on-surface-variant'}>
              {s.text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
