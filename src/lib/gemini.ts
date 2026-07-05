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
  const { mode, model = 'flash', prompt, systemInstruction, history, message, files, jsonMode } = body;
  const generativeModel = genAI.getGenerativeModel({
    model: getModelId(model),
    generationConfig: {
      ...(model === 'pro'
        ? { temperature: 0.7, topP: 0.95, topK: 64, maxOutputTokens: 8192 }
        : { temperature: 0.4, topP: 0.8, topK: 40, maxOutputTokens: 8192 }),
      ...(jsonMode && {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      }),
    },
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
export const materialReorganizeAI = makeModelWrapper('flash', 'material_reorganize');
export const slideDeckDraftAI      = makeModelWrapper('flash', 'slidedeck_ai_draft', true);

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
- 교사가 선택한 주차(전체 주차 또는 특정 주차)의 기록이 전달됨

[시스템이 절대 할 수 없는 것]
- 날짜/기간으로 필터링 (날짜 정보가 전달되지 않음)
- 성적·점수 반영 (성적 데이터 없음)
- 출석·결석 반영 (출석 데이터 없음)
- 다른 학생과 비교 (학생 1명씩 개별 처리)
- 외부 액션(알림 발송 등)
- 기록이 없는 학생을 자동 식별하여 최저 평가 부여 (기록 없는 학생은 초안 생성 대상에서 제외됨)

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

// ── 수업 자료 AI 재구성 (학습 가이드 / 발표 자료) ─────────────────────────────

// 선생님이 UI에서 그대로 읽을 수 있도록 작성된 기본 프롬프트 (투명 공개용)
export const MATERIAL_REORG_PROMPTS: Record<'guide' | 'presentation', string> = {
  guide: `학생이 이 내용을 스스로 단계별로 따라가며 학습할 수 있는 '학습 가이드' 형식으로 재구성합니다.
- 도입부에 "이번 시간 학습 목표"를 2~3문장으로 정리합니다.
- 내용을 논리적 순서에 따라 "## STEP 1. ~", "## STEP 2. ~" 형식의 단계로 나눕니다.
- 각 단계는 소제목과 설명으로 구성하고, 필요하면 "확인해보기" 질문을 덧붙입니다.
- 마지막에 "정리 체크리스트" 섹션을 불릿으로 추가합니다.
- 원문에 없는 정보를 임의로 추가하거나 빼지 않습니다.
- {{IMG:n}} 형태의 자리표시자는 텍스트를 바꾸지 말고 문맥에 맞는 위치로만 재배치합니다.`,

  presentation: `이 내용을 발표 화면(16:9 프레젠테이션)에서 스크롤 없이 한 화면에 다 보이도록 슬라이드 자료로 재구성합니다.
- 슬라이드는 빈 줄 다음 "---" 한 줄로 구분합니다.
- 각 슬라이드의 맨 첫 줄에는 반드시 아래 형식의 메타 주석을 작성합니다 (화면에는 보이지 않고, 배경색·아이콘 지정에만 쓰입니다):
  <!-- meta: bg=키워드 icon=이모지1개 -->
  · bg는 슬라이드 주제 분위기에 맞춰 다음 중 하나만: purple, blue, teal, green, amber, rose, dark
  · icon은 슬라이드 내용을 함축하는 이모지 1개만 (예: 🎯 💡 ✅ 👥 📌 ⚙️ 🚀). 장식용이므로 화려한 조합이나 여러 개를 쓰지 않습니다.
- 첫 슬라이드는 제목 슬라이드로, 수업 주제를 한 줄로 담습니다.
- 한 슬라이드에는 소제목 1개와 핵심 불릿 최대 4개(불릿당 12단어 이내, 1줄)만 담아 16:9 화면에 여유 있게 다 들어가도록 합니다. 절대 스크롤이 필요할 만큼 길게 쓰지 않습니다.
- 내용이 많으면 슬라이드를 여러 장으로 나누고, 한 슬라이드에 모든 내용을 몰아넣지 않습니다.
- 텍스트가 많은 슬라이드에는 이미지를 넣지 않고, 이미지는 관련 내용이 있는 별도 슬라이드에 배치합니다.
- 원문에 없는 정보를 임의로 추가하거나 빼지 않습니다.
- {{IMG:n}} 형태의 자리표시자는 텍스트를 바꾸지 말고 적절한 슬라이드 위치로만 재배치합니다.`,
};

// 이미지 마크다운을 자리표시자로 치환 — AI가 URL을 직접 다루지 않도록 함
export function extractImagePlaceholders(content: string): { replaced: string; map: string[] } {
  const map: string[] = [];
  const replaced = content.replace(/!\[[^\]]*\]\([^)]+\)/g, (match) => {
    map.push(match);
    return `{{IMG:${map.length - 1}}}`;
  });
  return { replaced, map };
}

// 마크다운 이미지에서 URL만 뽑아낸 목록 (순서대로) — 슬라이드 초안 생성 시 인덱스로 참조
// 자료 에디터는 ![alt](url "width:123") 형식으로 너비를 저장하므로, 괄호 안 전체가 아니라
// URL 부분만 분리해야 한다 (title 부분을 그대로 넣으면 이미지가 깨진다).
export function extractImageUrls(content: string): string[] {
  const urls: string[] = [];
  const re = /!\[[^\]]*\]\((\S+?)(?:\s+["'][^"']*["'])?\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) urls.push(m[1]);
  return urls;
}

// 펜스 코드블록을 자리표시자로 치환 — AI가 코드를 지어내지 않고 원문에 실제 있는 코드만 참조하게 함
export function extractCodePlaceholders(content: string): { replaced: string; blocks: { lang: string; code: string }[] } {
  const blocks: { lang: string; code: string }[] = [];
  const replaced = content.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    blocks.push({ lang: String(lang).trim(), code: String(code).replace(/\n$/, '') });
    return `{{CODE:${blocks.length - 1}}}`;
  });
  return { replaced, blocks };
}

// 자리표시자를 원본 이미지 마크다운으로 복원 — 응답에서 누락된 이미지는 하단에 폴백으로 추가
function restoreImagePlaceholders(result: string, map: string[]): string {
  const used = new Set<number>();
  let restored = result.replace(/\{\{IMG:(\d+)\}\}/g, (_, i) => {
    const idx = Number(i);
    used.add(idx);
    return map[idx] ?? '';
  });
  const missing = map.filter((_, i) => !used.has(i));
  if (missing.length > 0) {
    restored += '\n\n---\n\n' + missing.join('\n\n');
  }
  return restored;
}

// [[FEEDBACK]]...[[/FEEDBACK]] 블록 — 선생님 추가 요청사항이 기본 규칙과 충돌해
// 완전히 반영되지 못했을 때만 AI가 응답 맨 앞에 붙이는 반영 여부 안내
const FEEDBACK_BLOCK_RE = /^\s*\[\[FEEDBACK\]\]\s*\n?([\s\S]*?)\n?\s*\[\[\/FEEDBACK\]\]\s*\n?/;

// 선생님이 입력한 "추가 요청사항"이 정적 마크다운 결과물로 실제 구현 가능한지 생성 전에 미리 검증
export async function validateReorganizeInstruction(
  instruction: string,
  mode: 'guide' | 'presentation'
): Promise<{ feasible: boolean; message: string; guide?: string }> {
  const modeLabel = mode === 'guide' ? '학습 가이드' : '발표 슬라이드';
  const validationPrompt = `당신은 AI 수업 자료 정리 시스템의 요청사항 검증 전문가입니다.
교사가 "${modeLabel} AI 정리" 기능에 입력한 추가 요청사항이 실제로 구현 가능한지 판별하세요.

[시스템이 만들어내는 결과물]
- 순수 텍스트 마크다운 문서입니다 (제목, 문단, 불릿/번호 목록, 표, 인용구, 토글 블록, 콜아웃 강조 박스, 원문에 이미 있던 이미지로만 구성)
- ${mode === 'presentation' ? '16:9 슬라이드로 나뉘며 슬라이드마다 배경 테마 1개·이모지 아이콘 1개만 지정 가능합니다' : '학생이 순서대로 따라가는 STEP 단계 구조로 나뉩니다'}
- 화면에 그려진 뒤에는 움직이지 않는 정적 문서입니다

[시스템이 절대 할 수 없는 것]
- 애니메이션, 전환 효과, 움직이거나 반짝이는 요소
- 이미지 생성·편집·교체 (원문에 없던 새 이미지를 만들거나 기존 이미지를 다른 것으로 바꿀 수 없음 — 배치 위치 조정만 가능)
- 클릭/호버 상호작용, 버튼, 게임·퀴즈 자동 채점 등 앱 기능
- 동영상 삽입/재생, 오디오, 외부 스크립트 실행
- 실시간 데이터 연동
- 원문에 없는 사실 정보의 임의 추가

[동작 가능한 요청 예시]
- 말투·어조, 강조점, 분량 조절 (예: 중학생 눈높이로, 간결하게)
- 특정 섹션 강조, 순서 변경, 원문 내용 범위 안에서 예시 보강
- 표/불릿/토글/콜아웃 등 형식 활용, 소제목 구성 방식 조정
- 톤앤매너 지정 (친근하게, 격식있게 등)

[교사가 입력한 추가 요청사항]
"${instruction}"

반드시 아래 JSON 형식으로만 응답하세요:
{"feasible":true,"message":"성공 메시지"}
또는
{"feasible":false,"message":"안 되는 이유","guide":"대신 이렇게 요청해보세요"}`;

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
    return { feasible: true, message: '검증 중 오류가 발생했습니다. 요청사항을 반영해 진행합니다.' };
  }
}

export async function reorganizeMaterialContent(
  rawContent: string,
  mode: 'guide' | 'presentation',
  userInstruction?: string,
  classId?: string
): Promise<{ content: string; feedback: string | null }> {
  const { replaced, map } = extractImagePlaceholders(rawContent);

  const trimmedInstruction = userInstruction?.trim();
  const instructionBlock = trimmedInstruction
    ? `\n\n[선생님 추가 요청사항 — 위 기본 규칙과 충돌하지 않는 선에서 반영]\n${trimmedInstruction}`
    : '';
  const feedbackInstruction = trimmedInstruction
    ? `\n\n[요청사항 반영 여부 안내]\n위 선생님 추가 요청사항이 기본 형식 규칙(단계 구조, 슬라이드 분할/메타 규칙 등)과 충돌해 완전히 반영하지 못했다면, 응답 맨 앞줄에 아래 형식으로 짧게 안내를 붙이세요.\n[[FEEDBACK]]\n(반영되지 않은 부분을 1문장으로) (대신 이렇게 요청해보세요: 로 시작하는 대안 1문장)\n[[/FEEDBACK]]\n요청사항을 완전히 반영했다면 이 블록을 절대 넣지 마세요. 블록 다음 줄부터는 곧바로 실제 정리된 본문만 이어서 작성하세요.`
    : '';

  const prompt = `${MATERIAL_REORG_PROMPTS[mode]}${instructionBlock}${feedbackInstruction}\n\n[원문]\n${replaced}`;

  const result = await materialReorganizeAI.generateContent(
    prompt,
    classId ? { class_id: classId } : undefined
  );
  const raw = result.response.text().trim();
  const feedbackMatch = raw.match(FEEDBACK_BLOCK_RE);
  const feedback = feedbackMatch ? feedbackMatch[1].trim() : null;
  const bodyRaw = feedbackMatch ? raw.slice(feedbackMatch[0].length) : raw;

  return { content: restoreImagePlaceholders(bodyRaw.trim(), map), feedback };
}

// ── 슬라이드 만들기 도구: 자료 → AI 초안 생성 ────────────────────────────────
// slidedeck 쪽 SlideLayoutKind와 이름을 맞추되, 이 파일은 해당 타입을 import하지 않고
// 문자열 리터럴로만 다뤄 lib(gemini.ts)이 UI 레이어 타입에 결합되지 않도록 한다.
export type SlideDraftLayoutKind = 'title' | 'textOnly' | 'textImage1' | 'textImagesMany';

export interface SlideLayoutSpec {
  kind: SlideDraftLayoutKind;
  textSlots: { role: string; maxChars: number }[];
  imageSlotCount: number;
  codeSlotCount: number;
}

export interface AiDraftSlide {
  layout: SlideDraftLayoutKind;
  texts: string[];
  images: number[];
  code: number[];
}

// 선택한 템플릿의 레이아웃 스펙에 맞춰 원문을 슬라이드 초안(JSON)으로 재구성
export async function generateSlideDeckDraft(
  rawContent: string,
  layoutSpecs: SlideLayoutSpec[],
  classId?: string
): Promise<{ slides: AiDraftSlide[]; imageUrls: string[]; codeBlocks: { lang: string; code: string }[] }> {
  const { replaced: withoutImages } = extractImagePlaceholders(rawContent);
  const { replaced, blocks: codeBlocks } = extractCodePlaceholders(withoutImages);
  const imageUrls = extractImageUrls(rawContent);

  const layoutDescriptions = layoutSpecs.map(spec => {
    const textsDesc = spec.textSlots.length
      ? spec.textSlots.map((s, i) => `texts[${i}]=${s.role}(최대 ${s.maxChars}자)`).join(', ')
      : '텍스트 슬롯 없음';
    return `- "${spec.kind}": ${textsDesc} · 이미지 ${spec.imageSlotCount}개${spec.codeSlotCount ? ` · 코드 ${spec.codeSlotCount}개` : ''}`;
  }).join('\n');

  const prompt = `이 수업 자료를 16:9 슬라이드 초안으로 재구성합니다. 아래 4가지 레이아웃 중 각 슬라이드에 맞는 것을 골라 배치하세요.

[사용 가능한 레이아웃]
${layoutDescriptions}

[규칙]
- 반드시 첫 슬라이드는 "title" 레이아웃이어야 합니다 (수업 주제를 한 줄로).
- 각 슬라이드는 화면 하나에 스크롤 없이 다 들어가야 하므로, 레이아웃이 지정한 texts 개수와 글자 수 제한을 반드시 지키세요.
- 한 슬라이드에 모든 내용을 몰아넣지 말고, 내용이 많으면 여러 슬라이드로 나누세요.
- 원문에 없는 정보를 임의로 추가하거나 빼지 마세요.
- 원문에 {{IMG:n}} 표시가 있으면 관련 내용이 있는 슬라이드에서 이미지 슬롯이 있는 레이아웃을 골라 "images" 배열에 해당 번호(n)를 넣으세요. 이미지가 없는 슬라이드의 "images"는 빈 배열로 두세요. 같은 이미지 번호를 두 번 이상 쓰지 마세요.
- 원문에 {{CODE:n}} 표시가 있으면 코드 슬롯이 있는 레이아웃("textOnly"/"textImage1"/"textImagesMany" 중 codeSlotCount>0인 것)을 골라 "code" 배열에 번호를 넣으세요. 원문에 코드가 없으면 "code"는 항상 빈 배열로 두세요 (코드를 지어내지 마세요).
- 이미지/코드 슬롯 개수보다 배열 길이가 많으면 안 됩니다.

반드시 아래 JSON 배열 형식으로만 응답하세요 (설명 문구 없이 JSON만):
[{"layout":"title","texts":["...","..."],"images":[],"code":[]}, ...]

[원문]
${replaced}`;

  const result = await slideDeckDraftAI.generateContent(
    prompt,
    classId ? { class_id: classId } : undefined
  );
  const raw = result.response.text().trim().replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  const slides = JSON.parse(raw) as AiDraftSlide[];

  return { slides, imageUrls, codeBlocks };
}
