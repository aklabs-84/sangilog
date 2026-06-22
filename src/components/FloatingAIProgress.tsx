import { useAiGenStore } from '../lib/aiGenerationStore';
import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

const FloatingAIProgress = () => {
  const { isGenerating, current, total, generatingName, completedCount, hasError, justCompleted } = useAiGenStore();

  if (!isGenerating && !justCompleted) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] pointer-events-none">
      {isGenerating && (
        <div className="flex items-center gap-3 px-4 py-3 bg-white border border-primary/20 rounded-2xl shadow-xl min-w-[220px]">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-primary animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-primary truncate">
              {generatingName ? `${generatingName} 초안 생성 중...` : 'AI 초안 생성 중...'}
            </p>
            {total > 0 && (
              <>
                <div className="mt-1.5 h-1 bg-primary/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((current / total) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-on-surface-variant/50 mt-0.5 font-bold">
                  {current}/{total}명 완료
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {!isGenerating && justCompleted && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border ${
          hasError
            ? 'bg-red-50 border-red-200'
            : 'bg-emerald-50 border-emerald-200'
        }`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            hasError ? 'bg-red-100' : 'bg-emerald-100'
          }`}>
            {hasError
              ? <AlertCircle size={16} className="text-red-600" />
              : <CheckCircle2 size={16} className="text-emerald-600" />
            }
          </div>
          <div>
            <p className={`text-[11px] font-black ${hasError ? 'text-red-700' : 'text-emerald-700'}`}>
              {hasError ? 'AI 초안 생성 중 오류가 발생했습니다.' : `AI 초안 생성 완료! (${completedCount}명)`}
            </p>
            {!hasError && (
              <p className="text-[10px] text-emerald-600/70 font-bold mt-0.5">결과가 자동 저장되었습니다.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FloatingAIProgress;
