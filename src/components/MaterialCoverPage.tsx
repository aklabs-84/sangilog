interface MaterialCoverPageProps {
  title: string;
  subtitle?: string | null;
  dateLabel?: string | null;
  imageUrl?: string | null;
  rounded?: boolean;
}

// 수업 자료 PDF/미리보기 공용 표지 — 이미지가 있으면 배경으로, 없으면 그라디언트 기본 템플릿으로 렌더링
export default function MaterialCoverPage({ title, subtitle, dateLabel, imageUrl, rounded = false }: MaterialCoverPageProps) {
  return (
    <div
      className={`relative w-full h-full overflow-hidden flex flex-col justify-end ${
        imageUrl ? 'bg-surface-container' : 'bg-gradient-to-br from-primary to-violet-700'
      } ${rounded ? 'rounded-2xl' : ''}`}
    >
      {imageUrl && (
        <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div
        className={`relative z-10 p-8 ${
          imageUrl ? 'bg-gradient-to-t from-black/75 via-black/25 to-transparent' : ''
        }`}
      >
        {subtitle && (
          <p className="text-white/80 font-black text-sm mb-2 tracking-wide">{subtitle}</p>
        )}
        <h1 className="text-white font-black text-3xl leading-tight break-keep">{title}</h1>
        {dateLabel && (
          <p className="text-white/70 font-bold text-xs mt-4">{dateLabel}</p>
        )}
      </div>
    </div>
  );
}
