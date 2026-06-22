// 프로덕션: /api/gemini 서버 프록시 사용 (키 노출 방지)
// 개발(npm run dev): VITE_GEMINI_API_KEY로 직접 호출

import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase';

export const SYSTEM_INSTRUCTIONS = {
  BASE: `
    당신은 대한민국 교육부의 '2026 학교생활기록부 기재요령'을 완벽하게 숙지한 전문 교육용 AI 어시스턴트입니다.
    선생님들의 업무를 보조하며, 학생의 성장을 돕는 객관적이고 교육적인 필치를 유지하세요.
  `,
  SEATUK_GUIDE: `
    [세특/생기부 작성 절대 원칙]
    1. '~함', '~임', '~보임' 등 명사형/개조식 종결 어미를 사용하십시오.
    2. 공인어학시험, 교외 수상실적, 사교육 유발 요소(어학연수 등)는 절대 기재하지 마십시오.
    3. 구체적인 점수나 등급 대신, 학생의 실질적인 행동 변화와 성취 과정을 서술하십시오.
    4. 사실 중심(Evidence-based)으로 작성하되, 학생의 개별성이 드러나도록 하십시오.
  `,
  PARENT_REPORT_GUIDE: `
    [학부모 성장 보고서 작성 원칙]
    1. 학부모가 읽기 쉬운 친근하고 따뜻한 문어체로 작성하세요.
    2. '~했습니다', '~보였습니다' 등 완성형 종결어미를 사용하세요.
    3. 학생의 성장과 노력 과정을 긍정적이고 구체적으로 서술하세요.
    4. 구체적인 활동명과 에피소드를 포함해 생생하게 작성하세요.
    5. 앞으로의 발전 가능성과 응원의 메시지로 마무리하세요.
    6. 분량은 200~300자 내외로 작성하세요.
  `,
  PRIVACY: `
    [개인정보 보호]
    - 학생의 실명, 주민번호, 주소 등 민감 정보는 답변에 직접 노출하지 마십시오.
    - 분석 시 데이터에 포함된 정보는 교육적 피드백 용도로만 활용하십시오.
  `
};

function getModelId(model: 'pro' | 'flash') {
  return model === 'pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
}

async function callDirect(body: any): Promise<string> {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY가 .env에 없습니다.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const { mode, model = 'flash', prompt, systemInstruction, history, message, files } = body;
  const generativeModel = genAI.getGenerativeModel({
    model: getModelId(model),
    generationConfig: model === 'pro'
      ? { temperature: 0.7, topP: 0.95, topK: 64, maxOutputTokens: 8192 }
      : { temperature: 0.4, topP: 0.8, topK: 40, maxOutputTokens: 8192 },
  });

  if (mode === 'generate') {
    const parts: any[] = [{ text: prompt ?? '' }];
    if (files?.length) parts.push(...files);
    const contentParts = systemInstruction ? [{ text: systemInstruction }, ...parts] : parts;
    const { response } = await generativeModel.generateContent(contentParts);
    return response.text();
  }

  if (mode === 'chat') {
    const chat = generativeModel.startChat({
      history: (history ?? []).map((h: any) => ({
        role: h.role as 'user' | 'model',
        parts: Array.isArray(h.parts) ? h.parts : [{ text: h.text ?? '' }],
      })),
      systemInstruction,
    });
    const promptParts: any[] = [{ text: message ?? '' }];
    if (files?.length) promptParts.push(...files);
    const { response } = await chat.sendMessage(promptParts);
    return response.text();
  }

  throw new Error(`Unknown mode: ${mode}`);
}

async function callProxy(body: object): Promise<string> {
  // 개발 환경: 브라우저에서 직접 Gemini 호출
  if ((import.meta as any).env?.DEV) {
    return callDirect(body);
  }

  // 프로덕션: 서버 프록시 사용
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data.error === 'AI_LIMIT_EXCEEDED') {
      throw new Error('AI_LIMIT_EXCEEDED');
    }
    throw new Error(data.error ?? 'AI API 오류');
  }
  return data.result as string;
}

// Compatible wrappers matching the @google/generative-ai interface used in the codebase
function makeModelWrapper(model: 'pro' | 'flash', feature = 'unknown', jsonMode = false) {
  return {
    generateContent: async (input: string | any[], options?: { class_id?: string }) => {
      const parts = typeof input === 'string' ? [{ text: input }] : input;
      const textParts = parts.filter((p: any) => 'text' in p);
      const fileParts = parts.filter((p: any) => 'inlineData' in p);
      const prompt = textParts.map((p: any) => p.text).join('\n');
      const result = await callProxy({
        mode: 'generate',
        model,
        feature,
        prompt,
        ...(jsonMode && { jsonMode: true }),
        ...(fileParts.length > 0 && { files: fileParts }),
        ...(options?.class_id && { class_id: options.class_id }),
      });
      return { response: { text: () => result } };
    },
  };
}

export const geminiFlash = makeModelWrapper('flash');
export const geminiPro   = makeModelWrapper('pro');

// 기능별 named wrapper (비용 추적용)
export const promptValidatorAI    = makeModelWrapper('flash', 'prompt_validate', true);
export const seatukDraftAI        = makeModelWrapper('pro',   'seatuk_draft');
export const seatukRefineAI       = makeModelWrapper('pro',   'seatuk_refine');
export const seatukCompressAI     = makeModelWrapper('pro',   'seatuk_compress');
export const achievementSuggestAI = makeModelWrapper('pro',   'achievement_suggest');
export const transcriptionAI      = makeModelWrapper('flash', 'transcription_analysis');
export const quizGeneratorAI      = makeModelWrapper('flash', 'quiz_generator', true);
export const surveyAnalysisAI     = makeModelWrapper('flash', 'survey_analysis');
export const observationReviewAI  = makeModelWrapper('flash', 'observation_review');
export const studentAnalysisAI    = makeModelWrapper('flash', 'student_analysis');

/**
 * 파일을 Gemini API 파트로 변환 (Base64) - 브라우저에서 실행, 결과를 서버로 전달
 */
export async function fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = (reader.result as string).split(',')[1];
      resolve({ inlineData: { data: base64Data, mimeType: file.type } });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function validateStudentGuidePrompt(
  prompt: string
): Promise<{ feasible: boolean; message: string; guide?: string }> {
  const validationPrompt = `당신은 AI 학생 활동 기록 검토 시스템의 지침 검증 전문가입니다.
교사가 "학생 활동 가이드"에 입력한 내용이 AI가 학생 제출물을 실제로 판단할 수 있는 기준인지 평가하세요.

[시스템 동작 방식]
- 학생이 활동 기록(제목 + 내용 + 느낀 점)을 제출하면 AI가 이 가이드 기준으로 품질을 분석
- 기준 미충족 시 자동 반려(학생에게 사유와 개선 안내 제공)
- 글자수 제한·금지어는 별도 시스템이 이미 처리하므로 가이드에서 불필요

[AI가 판단 가능한 기준]
- 구체적 활동 서술 요구 (예: "단순 감상이 아닌 본인의 역할과 과정을 써야 함")
- 특정 내용 포함 요구 (예: "배운 개념을 실생활에 연결하여 작성")
- 작성 태도 기준 (예: "반복 문장으로 분량만 채운 경우 반려")
- 수업 연관성 확인 (예: "수업 내용과 무관한 내용은 반려")

[AI가 판단할 수 없는 기준]
- 사실 여부 확인 (예: "실제로 수업에 참여했는지 확인")
- 외부 데이터 비교 (예: "지난주보다 발전했는지")
- 글자수·맞춤법 기준 (별도 시스템에서 이미 처리)
- 표절 검사
- 지나치게 주관적인 기준 (예: "창의적이지 않으면 반려" — 창의성은 AI가 일관되게 판단 불가)

[교사가 작성한 가이드]
"${prompt}"

반드시 아래 JSON 형식으로만 응답하세요:
{"feasible":true,"message":"성공 메시지"}
또는
{"feasible":false,"message":"안 되는 이유","guide":"대신 이렇게 작성하세요"}`;

  try {
    const result = await promptValidatorAI.generateContent(validationPrompt);
    const raw = result.response.text().trim().replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(raw);
    return {
      feasible: Boolean(parsed.feasible),
      message: String(parsed.message || ''),
      guide: parsed.guide ? String(parsed.guide) : undefined,
    };
  } catch {
    return { feasible: true, message: '검증 중 오류가 발생했습니다. 지침은 저장됩니다.' };
  }
}

export async function validateTeacherPrompt(
  prompt: string
): Promise<{ feasible: boolean; message: string; guide?: string }> {
  const validationPrompt = `당신은 AI 생기부 초안 작성 시스템의 지침 검증 전문가입니다.
교사가 "AI 행특/세특 초안 작성 지침"에 입력한 내용이 시스템에서 실제로 동작 가능한지 판별하세요.

[시스템이 AI에게 제공하는 데이터]
- 학생의 활동 기록 (활동명 + 학생이 직접 작성한 내용 텍스트)
- 가장 최신 주차(week_number 기준)의 기록만 전달됨

[시스템이 절대 할 수 없는 것]
- 날짜/기간으로 필터링 (날짜 정보가 전달되지 않음)
- 성적·점수 반영 (성적 데이터 없음)
- 출석·결석 반영 (출석 데이터 없음)
- 특정 주차 범위 선택 (자동으로 최신 1개 주차만 필터링)
- 다른 학생과 비교 (학생 1명씩 개별 처리)
- 외부 액션(알림 발송 등)

[동작 가능한 지침 예시]
- 문체·어미·분량·강조점 지침 (예: "~함, ~임 어미 사용", "500자 이내")
- 특정 역량·내용 강조 (예: "협업 태도 강조", "성장 가능성 위주로")
- AI로 작성한 것 같은 표현 검토 요청
- 학생의 활동 내용 기반 성취 판단

[교사가 작성한 지침]
"${prompt}"

반드시 아래 JSON 형식으로만 응답하세요:
{"feasible":true,"message":"성공 메시지"}
또는
{"feasible":false,"message":"안 되는 이유","guide":"대신 이렇게 작성하세요"}`;

  try {
    const result = await promptValidatorAI.generateContent(validationPrompt);
    const raw = result.response.text().trim().replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(raw);
    return {
      feasible: Boolean(parsed.feasible),
      message: String(parsed.message || ''),
      guide: parsed.guide ? String(parsed.guide) : undefined,
    };
  } catch {
    return { feasible: true, message: '검증 중 오류가 발생했습니다. 지침은 저장됩니다.' };
  }
}

export async function generateFeedbackDraft(
  type: 'obs' | 'result',
  title: string,
  content: string,
  classId?: string
): Promise<string> {
  const typeLabel = type === 'obs' ? '활동 기록' : '결과 제출물';
  const prompt = `학생이 제출한 ${typeLabel}에 대한 선생님 피드백 초안을 작성해줘.

[제출 내용]
제목: ${title}
내용: ${content}

[작성 기준]
- 학생의 노력과 성장을 인정하되, 개선 방향도 구체적으로 제시
- 2~3문장으로 간결하게
- 따뜻하고 교육적인 어조
- 학생의 제출 내용에서 구체적인 요소를 언급
- "~하면 좋겠습니다", "~가 인상적입니다" 등 완성형 어미 사용
- 피드백 문장만 출력 (별도 설명, 제목, 따옴표 없이)`;

  return callProxy({
    mode: 'generate',
    model: 'flash',
    feature: 'feedback_draft',
    systemInstruction: SYSTEM_INSTRUCTIONS.BASE + SYSTEM_INSTRUCTIONS.PRIVACY,
    prompt,
    ...(classId && { class_id: classId }),
  });
}

export async function generateClassInsight(className: string, observations: any[], classId?: string) {
  // 실제 데이터 기반 통계 추출
  const total = observations.length;
  const uniqueStudents = new Set(observations.map(o => o.student_id)).size;
  const recentObs = observations
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);
  const activityCounts: Record<string, number> = {};
  for (const o of observations) {
    const name = o.activity_name || '기타';
    activityCounts[name] = (activityCounts[name] || 0) + 1;
  }
  const topActivities = Object.entries(activityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `"${name}" (${count}건)`)
    .join(', ');
  const pendingCount = observations.filter(o => o.status === 'pending').length;
  const approvedCount = observations.filter(o => o.status === 'approved').length;

  const prompt = `
학급명: ${className}

[실제 집계 데이터]
- 전체 활동 기록 수: ${total}건
- 참여 학생 수: ${uniqueStudents}명
- 가장 많이 기록된 활동: ${topActivities || '데이터 없음'}
- 승인 완료: ${approvedCount}건 / 승인 대기: ${pendingCount}건
- 최근 20건 활동 내용 샘플: ${JSON.stringify(recentObs.map(o => ({ 활동: o.activity_name, 내용요약: (o.content || '').slice(0, 80) })))}

[작성 지침]
- 위 실제 수치와 활동명을 반드시 언급할 것 (추상적 표현 금지)
- 예시처럼 구체적 숫자/활동명을 포함하여 2문장 이내로 작성
- 예시: "${uniqueStudents}명의 학생이 '${Object.keys(activityCounts)[0] || '활동'}' 등 ${total}건의 기록을 제출했습니다. 특히 [구체적 활동명]에서 [구체적 특징]이 두드러졌습니다."
- 클리셰 표현("논리적 분석력이 향상" 등) 사용 금지
  `;
  return callProxy({
    mode: 'generate',
    model: 'flash',
    feature: 'class_insight',
    systemInstruction: SYSTEM_INSTRUCTIONS.BASE + SYSTEM_INSTRUCTIONS.PRIVACY,
    prompt,
    ...(classId && { class_id: classId }),
  });
}

function anonymizeObservations(observations: any[]) {
  return observations.map(o => ({
    activity_name: o.activity_name,
    content: o.content,
    status: o.status,
    created_at: o.created_at,
  }));
}

export async function generateDetailedReport(className: string, observations: any[], classId?: string) {
  const prompt = `
    학급명: ${className}
    전체 관찰 기록: ${JSON.stringify(anonymizeObservations(observations))}

    위 데이터를 바탕으로 다음 항목을 포함한 심층 분석 보고서를 작성해줘:
    1. 학급 전체 성취도 요약
    2. 주요 핵심 역량 발현 키워드 (Top 3)
    3. 과목별/활동별 참여도 분석
    4. 향후 지도 가이드 및 제언

    작성 시 교육적인 전문 용어를 사용하고, 구체적인 사례(활동명 등)를 언급해줘.
    마크다운 형식을 사용해줘.
  `;
  return callProxy({
    mode: 'generate',
    model: 'pro',
    feature: 'detailed_report',
    systemInstruction: SYSTEM_INSTRUCTIONS.BASE + SYSTEM_INSTRUCTIONS.SEATUK_GUIDE + SYSTEM_INSTRUCTIONS.PRIVACY,
    prompt,
    ...(classId && { class_id: classId }),
  });
}

export async function extractTextFromFiles(files: { inlineData: { data: string; mimeType: string } }[]) {
  if (!files || files.length === 0) return [];
  try {
    return await callProxy({
      mode: 'generate',
      model: 'flash',
      feature: 'file_extract',
      prompt: `첨부된 파일(이미지, PDF, 엑셀 캡처 등)에서 텍스트 내용을 최대한 정확하게 추출해줘.
- 표 형태의 데이터라면 구조를 최대한 유지해서 텍스트로 변환해.
- 학생의 이름, 점수, 활동 내용 등 핵심 정보를 빠짐없이 포함해.
- 별도의 설명 없이 추출된 텍스트 데이터만 반환해.`,
      files,
    });
  } catch (error) {
    console.error('Text Extraction Error:', error);
    return '파일에서 텍스트를 추출하는 데 실패했습니다.';
  }
}

export async function chatWithClassData(
  className: string,
  observations: any[],
  history: { role: string; text: string }[],
  message: string,
  files?: { inlineData: { data: string; mimeType: string } }[],
  extractedText?: string,
  classId?: string
) {
  const systemInstruction = `${SYSTEM_INSTRUCTIONS.BASE}${SYSTEM_INSTRUCTIONS.SEATUK_GUIDE}${SYSTEM_INSTRUCTIONS.PRIVACY}
당신은 '${className}'의 학급 데이터를 파악하고 있는 AI 어시스턴트입니다.
선생님이 제공한 데이터와 첨부된 파일의 추출 텍스트를 바탕으로 답변하세요.

[학급 데이터 환경 (관찰 기록)]
${JSON.stringify(anonymizeObservations(observations.slice(0, 100)))}

[첨부 파일에서 추출된 텍스트 정보]
${extractedText || '첨부된 파일이 없거나 아직 추출되지 않았습니다.'}

[답변 가이드라인]
1. 데이터에 기반하여 답변하되, 파일의 내용을 참고했다면 "[파일 참고]"라고 명시하세요.
2. 학생 성장에 도움이 되는 교육적이고 긍정적인 방향으로 조언하세요.
3. 세특이나 행특 문구 작성을 요청받으면 기재요령을 준수하여 작성하세요.`;

  return callProxy({
    mode: 'chat',
    model: 'pro',
    feature: 'ai_chat',
    systemInstruction,
    history: history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }],
    })),
    message,
    ...(files && files.length > 0 && { files }),
    ...(classId && { class_id: classId }),
  });
}
