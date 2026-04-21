// Gemini API calls are proxied through /api/gemini (server-side key, never exposed to browser)

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
  PRIVACY: `
    [개인정보 보호]
    - 학생의 실명, 주민번호, 주소 등 민감 정보는 답변에 직접 노출하지 마십시오.
    - 분석 시 데이터에 포함된 정보는 교육적 피드백 용도로만 활용하십시오.
  `
};

async function callProxy(body: object): Promise<string> {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'AI API 오류');
  return data.result as string;
}

// Compatible wrappers matching the @google/generative-ai interface used in the codebase
function makeModelWrapper(model: 'pro' | 'flash') {
  return {
    generateContent: async (input: string | any[]) => {
      const parts = typeof input === 'string' ? [{ text: input }] : input;
      const textParts = parts.filter((p: any) => 'text' in p);
      const fileParts = parts.filter((p: any) => 'inlineData' in p);
      const prompt = textParts.map((p: any) => p.text).join('\n');
      const result = await callProxy({
        mode: 'generate',
        model,
        prompt,
        ...(fileParts.length > 0 && { files: fileParts }),
      });
      return { response: { text: () => result } };
    },
  };
}

export const geminiFlash = makeModelWrapper('flash');
export const geminiPro = makeModelWrapper('pro');

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

export async function generateClassInsight(className: string, observations: any[]) {
  const prompt = `
    학급명: ${className}
    최근 관찰 기록 데이터: ${JSON.stringify(observations.slice(0, 50))}

    위 데이터를 바탕으로 우리 반의 최근 수업 분위기와 주요 활동 성과를 2문장 이내로 요약해줘.
    매우 긍정적이고 분석적인 톤으로 작성해줘.
    형식: "이번 주 학급 전체 데이터 분석 결과, [주요 성과]. 특히 [특이점]이 눈에 띄게 증가했습니다."
  `;
  return callProxy({
    mode: 'generate',
    model: 'flash',
    systemInstruction: SYSTEM_INSTRUCTIONS.BASE + SYSTEM_INSTRUCTIONS.PRIVACY,
    prompt,
  });
}

export async function generateDetailedReport(className: string, observations: any[]) {
  const prompt = `
    학급명: ${className}
    전체 관찰 기록: ${JSON.stringify(observations)}

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
    systemInstruction: SYSTEM_INSTRUCTIONS.BASE + SYSTEM_INSTRUCTIONS.SEATUK_GUIDE + SYSTEM_INSTRUCTIONS.PRIVACY,
    prompt,
  });
}

export async function extractTextFromFiles(files: { inlineData: { data: string; mimeType: string } }[]) {
  if (!files || files.length === 0) return [];
  try {
    return await callProxy({
      mode: 'generate',
      model: 'flash',
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
  extractedText?: string
) {
  const systemInstruction = `${SYSTEM_INSTRUCTIONS.BASE}${SYSTEM_INSTRUCTIONS.SEATUK_GUIDE}${SYSTEM_INSTRUCTIONS.PRIVACY}
당신은 '${className}'의 학급 데이터를 파악하고 있는 AI 어시스턴트입니다.
선생님이 제공한 데이터와 첨부된 파일의 추출 텍스트를 바탕으로 답변하세요.

[학급 데이터 환경 (관찰 기록)]
${JSON.stringify(observations.slice(0, 100))}

[첨부 파일에서 추출된 텍스트 정보]
${extractedText || '첨부된 파일이 없거나 아직 추출되지 않았습니다.'}

[답변 가이드라인]
1. 데이터에 기반하여 답변하되, 파일의 내용을 참고했다면 "[파일 참고]"라고 명시하세요.
2. 학생 성장에 도움이 되는 교육적이고 긍정적인 방향으로 조언하세요.
3. 세특이나 행특 문구 작성을 요청받으면 기재요령을 준수하여 작성하세요.`;

  return callProxy({
    mode: 'chat',
    model: 'pro',
    systemInstruction,
    history: history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }],
    })),
    message,
    ...(files && files.length > 0 && { files }),
  });
}
