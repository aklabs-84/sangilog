import { GoogleGenerativeAI } from '@google/generative-ai';

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
