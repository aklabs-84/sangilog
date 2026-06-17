import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const PLAN_MONTHLY_LIMIT: Record<string, number> = {
  free:   20,
  basic:  100,
  pro:    500,
  school: 500,
};

// 2026-06 Gemini 단가 (USD per 1M tokens)
const PRICING: Record<string, { input: number; output: number; thinking: number }> = {
  'gemini-2.5-flash': { input: 0.30, output: 2.50, thinking: 3.50 },
  'gemini-2.5-pro':   { input: 1.25, output: 10.00, thinking: 3.50 },
};

function calcCostUsd(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  thinkingTokens: number
): number {
  const p = PRICING[modelId];
  if (!p) return 0;
  return (
    (inputTokens   * p.input    / 1_000_000) +
    (outputTokens  * p.output   / 1_000_000) +
    (thinkingTokens * p.thinking / 1_000_000)
  );
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  const {
    mode, model = 'flash', prompt, systemInstruction, history, message, files,
    feature = 'unknown',
  } = req.body;

  if (!mode) {
    return res.status(400).json({ error: 'mode is required' });
  }

  // ── 플랜 체크 ──────────────────────────────────────────────────────────────
  let userId: string | null = null;
  const authHeader = req.headers['authorization'];
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 인증 없는 익명 AI 호출 차단
  if (!authHeader || !supabaseUrl || !serviceKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (authHeader && supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey);
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!authError && user) {
        userId = user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan, beta_expires_at, ai_daily_count, ai_daily_date, ai_monthly_count, ai_monthly_reset')
          .eq('id', user.id)
          .single();

        if (profile) {
          const plan = profile.plan ?? 'free';
          const isBetaActive = profile.beta_expires_at && new Date(profile.beta_expires_at) > new Date();
          const isAdmin = plan === 'admin';

          // admin과 유효한 beta는 한도 체크 제외
          if (!isAdmin && !isBetaActive) {
            const thisMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
            const isNewMonth = profile.ai_monthly_reset !== thisMonth;
            const monthlyUsed = isNewMonth ? 0 : (profile.ai_monthly_count ?? 0);
            const monthlyLimit = PLAN_MONTHLY_LIMIT[plan] ?? 20;

            if (monthlyUsed >= monthlyLimit) {
              return res.status(402).json({
                error: 'AI_LIMIT_EXCEEDED',
                message: `이번 달 AI 사용 한도(${monthlyLimit}회)에 도달했습니다. 다음 달 1일에 자동으로 초기화됩니다.`,
                used: monthlyUsed,
                limit: monthlyLimit,
              });
            }

            // 사용량 카운트 업데이트 (비동기, 응답 블로킹 없음)
            supabase.from('profiles').update({
              ai_monthly_count: monthlyUsed + 1,
              ai_monthly_reset: thisMonth,
              // free 플랜은 일별 카운트도 병행 유지
              ...(plan === 'free' ? {
                ai_daily_count: (() => {
                  const today = new Date().toISOString().split('T')[0];
                  const isNewDay = profile.ai_daily_date !== today;
                  return isNewDay ? 1 : (profile.ai_daily_count ?? 0) + 1;
                })(),
                ai_daily_date: new Date().toISOString().split('T')[0],
              } : {}),
            }).eq('id', user.id).then(() => {});
          }
        }
      }
    } catch (planCheckError) {
      console.warn('[api/gemini] plan check failed:', planCheckError);
    }
  }

  // ── AI 호출 ────────────────────────────────────────────────────────────────
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelId = model === 'pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const generativeModel = genAI.getGenerativeModel({
      model: modelId,
      generationConfig: model === 'pro'
        ? { temperature: 0.7, topP: 0.95, topK: 64, maxOutputTokens: 8192 }
        : { temperature: 0.4, topP: 0.8, topK: 40, maxOutputTokens: 8192 },
    });

    let result: string;
    let usageMeta: any = null;

    if (mode === 'generate') {
      const parts: any[] = [{ text: prompt ?? '' }];
      if (files && files.length > 0) parts.push(...files);
      const contentParts = systemInstruction ? [{ text: systemInstruction }, ...parts] : parts;
      const { response } = await generativeModel.generateContent(contentParts);
      result = response.text();
      usageMeta = response.usageMetadata ?? null;

    } else if (mode === 'chat') {
      const chat = generativeModel.startChat({
        history: (history ?? []).map((h: any) => ({
          role: h.role as 'user' | 'model',
          parts: Array.isArray(h.parts) ? h.parts : [{ text: h.text ?? '' }],
        })),
        systemInstruction: systemInstruction,
      });
      const promptParts: any[] = [{ text: message ?? '' }];
      if (files && files.length > 0) promptParts.push(...files);
      const { response } = await chat.sendMessage(promptParts);
      result = response.text();
      usageMeta = response.usageMetadata ?? null;

    } else {
      return res.status(400).json({ error: `Unknown mode: ${mode}` });
    }

    // ── 비용 계산 & 로깅 (비동기, 응답 블로킹 없음) ──────────────────────────
    if (usageMeta && supabaseUrl && serviceKey) {
      const inputTokens    = usageMeta.promptTokenCount       ?? 0;
      const outputTokens   = usageMeta.candidatesTokenCount   ?? 0;
      const thinkingTokens = usageMeta.thoughtsTokenCount     ?? 0;
      const costUsd = calcCostUsd(modelId, inputTokens, outputTokens, thinkingTokens);

      const supabase = createClient(supabaseUrl, serviceKey);
      supabase.from('ai_usage_logs').insert({
        user_id:         userId,
        feature_name:    feature,
        model_name:      modelId,
        input_tokens:    inputTokens,
        output_tokens:   outputTokens,
        thinking_tokens: thinkingTokens,
        cost_usd:        costUsd,
      }).then(({ error }) => {
        if (error) console.warn('[api/gemini] usage log insert failed:', error.message);
      });
    }

    return res.status(200).json({ result });

  } catch (error: any) {
    console.error('[api/gemini] error:', error?.message);
    return res.status(500).json({ error: error?.message ?? 'AI 처리 중 오류가 발생했습니다.' });
  }
}
