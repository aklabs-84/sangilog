import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const FREE_AI_DAILY_LIMIT = 10;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  const { mode, model = 'flash', prompt, systemInstruction, history, message, files } = req.body;

  if (!mode) {
    return res.status(400).json({ error: 'mode is required' });
  }

  // ── 플랜 체크 (Authorization 헤더가 있을 때만) ──────────────────────────────
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey);

        // JWT에서 유저 ID 추출
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (!authError && user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('plan, ai_daily_count, ai_daily_date')
            .eq('id', user.id)
            .single();

          if (profile && profile.plan === 'free') {
            const today = new Date().toISOString().split('T')[0];
            const isNewDay = profile.ai_daily_date !== today;
            const currentCount = isNewDay ? 0 : (profile.ai_daily_count ?? 0);

            if (currentCount >= FREE_AI_DAILY_LIMIT) {
              return res.status(402).json({
                error: 'AI_LIMIT_EXCEEDED',
                message: `무료 플랜은 AI를 하루 ${FREE_AI_DAILY_LIMIT}회까지 사용할 수 있습니다. 자정 이후 초기화됩니다.`,
                used: currentCount,
                limit: FREE_AI_DAILY_LIMIT,
              });
            }

            // AI 호출 후 카운트 증가 (비동기 - 응답 블로킹 안 함)
            const newCount = currentCount + 1;
            supabase.from('profiles').update({
              ai_daily_count: newCount,
              ai_daily_date: today,
            }).eq('id', user.id).then(() => {});
          }
        }
      } catch (planCheckError) {
        // 플랜 체크 실패해도 AI 호출은 허용 (서비스 안정성 우선)
        console.warn('[api/gemini] plan check failed:', planCheckError);
      }
    }
  }

  // ── AI 호출 ────────────────────────────────────────────────────────────────
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelId = model === 'pro' ? 'gemini-3.1-pro-preview' : 'gemini-3.1-flash-lite-preview';
    const generativeModel = genAI.getGenerativeModel({
      model: modelId,
      generationConfig: model === 'pro'
        ? { temperature: 0.7, topP: 0.95, topK: 64, maxOutputTokens: 8192 }
        : { temperature: 0.4, topP: 0.8, topK: 40, maxOutputTokens: 2048 },
    });

    let result: string;

    if (mode === 'generate') {
      const parts: any[] = [{ text: prompt ?? '' }];
      if (files && files.length > 0) parts.push(...files);
      const contentParts = systemInstruction ? [{ text: systemInstruction }, ...parts] : parts;
      const { response } = await generativeModel.generateContent(contentParts);
      result = response.text();

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

    } else {
      return res.status(400).json({ error: `Unknown mode: ${mode}` });
    }

    return res.status(200).json({ result });

  } catch (error: any) {
    console.error('[api/gemini] error:', error?.message);
    return res.status(500).json({ error: error?.message ?? 'AI 처리 중 오류가 발생했습니다.' });
  }
}
