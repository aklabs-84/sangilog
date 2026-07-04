import type { SlideTemplate, DeckSlide, SlideLayoutKind } from './types';

// 4개 템플릿 — 수업/학원 학습활동에서 실제로 쓰는 발표 목적별로 구성.
// 색상/폰트뿐 아니라 오브젝트 구성 자체(코드블록, 이미지 프레임, 스텝 배지 등)가 서로 다르다.
// 좌표는 1280x720 디자인 캔버스 기준.

const MANROPE = "'Manrope', 'Pretendard Variable', sans-serif";
const PUBLIC_SANS = "'Public Sans', 'Pretendard Variable', sans-serif";
const PRETENDARD = "'Pretendard Variable', sans-serif";

export const SLIDE_TEMPLATES: SlideTemplate[] = [
  {
    id: 'bold-statement',
    name: '핵심 강조',
    description: '큰 타이포그래피로 핵심 문장 하나를 임팩트 있게 보여주는 스타일',
    bg: '#0f0f10',
    textColor: '#ffffff',
    accentColor: '#FACC15',
    swatch: '#0f0f10',
    layouts: {
      title: [
        { type: 'text', x: 600, y: 200, width: 80, height: 6, zIndex: 1,
          text: '', style: { background: '#FACC15' } },
        { type: 'text', x: 140, y: 190, width: 1000, height: 230, zIndex: 2,
          text: '핵심 메시지를\n입력하세요',
          style: { fontSize: 80, align: 'center', bold: true, fontFamily: MANROPE } },
        { type: 'text', x: 140, y: 440, width: 1000, height: 60, zIndex: 3,
          text: '부제목이나 발표자 정보를 입력하세요',
          style: { fontSize: 22, align: 'center', color: '#9CA3AF', fontFamily: MANROPE } },
      ],
      textOnly: [
        { type: 'text', x: 440, y: 120, width: 400, height: 36, zIndex: 1,
          text: 'KEY POINT',
          style: { fontSize: 16, align: 'center', bold: true, color: '#FACC15', fontFamily: MANROPE, background: 'rgba(250,204,21,0.12)', borderRadius: 18 } },
        { type: 'text', x: 140, y: 220, width: 1000, height: 320, zIndex: 2,
          text: '이 슬라이드의 핵심 문장을\n크고 굵게 입력하세요',
          style: { fontSize: 52, align: 'center', bold: true, color: '#FACC15', fontFamily: MANROPE } },
      ],
      textImage1: [
        { type: 'text', x: 100, y: 220, width: 560, height: 300, zIndex: 1,
          text: '핵심 문장을\n입력하세요',
          style: { fontSize: 40, align: 'left', bold: true, fontFamily: MANROPE } },
        { type: 'image', x: 700, y: 140, width: 480, height: 440, zIndex: 2, style: { frame: 'rounded' } },
      ],
      textImagesMany: [
        { type: 'text', x: 100, y: 200, width: 480, height: 340, zIndex: 1,
          text: '핵심 문장을\n입력하세요',
          style: { fontSize: 32, align: 'left', bold: true, fontFamily: MANROPE } },
        { type: 'image', x: 620, y: 110, width: 560, height: 230, zIndex: 2, style: { frame: 'rounded' } },
        { type: 'image', x: 620, y: 360, width: 560, height: 230, zIndex: 3, style: { frame: 'rounded' } },
      ],
    },
  },
  {
    id: 'image-focus',
    name: '이미지 강조',
    description: '폴라로이드·원형·풀블리드 등 다양한 프레임으로 이미지를 크게 보여주는 스타일',
    bg: '#fafaf9',
    textColor: '#27272a',
    accentColor: '#0EA5E9',
    swatch: '#e0f2fe',
    layouts: {
      title: [
        { type: 'image', x: 0, y: 0, width: 1280, height: 720, zIndex: 1, style: { frame: 'full' } },
        { type: 'text', x: 100, y: 560, width: 1080, height: 120, zIndex: 2,
          text: '슬라이드 제목을 입력하세요',
          style: { fontSize: 48, align: 'left', bold: true, color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: 12, fontFamily: PUBLIC_SANS } },
      ],
      textOnly: [
        { type: 'text', x: 100, y: 100, width: 80, height: 6, zIndex: 1,
          text: '', style: { background: '#0EA5E9' } },
        { type: 'text', x: 100, y: 130, width: 1080, height: 480, zIndex: 2,
          text: '제목을 입력하세요\n\n이미지에 대한 설명이나 활동 안내를 입력하세요',
          style: { fontSize: 30, align: 'left', fontFamily: PUBLIC_SANS } },
      ],
      textImage1: [
        { type: 'text', x: 100, y: 50, width: 1080, height: 60, zIndex: 1,
          text: '제목을 입력하세요',
          style: { fontSize: 28, align: 'left', bold: true, fontFamily: PUBLIC_SANS } },
        { type: 'image', x: 390, y: 130, width: 500, height: 420, zIndex: 2, style: { frame: 'polaroid', rotate: -3 } },
        { type: 'text', x: 390, y: 570, width: 500, height: 50, zIndex: 3,
          text: '사진 설명을 입력하세요',
          style: { fontSize: 18, align: 'center', color: '#6b7280', fontFamily: PUBLIC_SANS } },
      ],
      textImagesMany: [
        { type: 'text', x: 100, y: 50, width: 1080, height: 50, zIndex: 1,
          text: '제목을 입력하세요',
          style: { fontSize: 26, align: 'left', bold: true, fontFamily: PUBLIC_SANS } },
        { type: 'image', x: 100, y: 140, width: 280, height: 280, zIndex: 2, style: { frame: 'circle' } },
        { type: 'image', x: 460, y: 110, width: 360, height: 300, zIndex: 3, style: { frame: 'rounded', rotate: 2 } },
        { type: 'image', x: 880, y: 150, width: 300, height: 320, zIndex: 4, style: { frame: 'polaroid', rotate: -4 } },
        { type: 'text', x: 100, y: 470, width: 1080, height: 140, zIndex: 5,
          text: '각 이미지에 대한 설명을 입력하세요',
          style: { fontSize: 22, align: 'center', fontFamily: PUBLIC_SANS } },
      ],
    },
  },
  {
    id: 'code-practice',
    name: '코드 실습',
    description: '복사해서 바로 쓸 수 있는 코드블록 중심의 실습용 스타일',
    bg: '#1e1e2e',
    textColor: '#e2e2e8',
    accentColor: '#89b4fa',
    swatch: '#1e1e2e',
    layouts: {
      title: [
        { type: 'text', x: 490, y: 180, width: 300, height: 40, zIndex: 1,
          text: '🖥️ 코드 실습',
          style: { fontSize: 16, align: 'center', bold: true, color: '#89b4fa', background: 'rgba(137,180,250,0.12)', borderRadius: 20, fontFamily: PRETENDARD } },
        { type: 'text', x: 140, y: 250, width: 1000, height: 140, zIndex: 2,
          text: '실습 제목을 입력하세요',
          style: { fontSize: 56, align: 'center', bold: true, fontFamily: PRETENDARD } },
        { type: 'text', x: 140, y: 420, width: 1000, height: 50, zIndex: 3,
          text: '함께 실습해봐요',
          style: { fontSize: 20, align: 'center', color: '#a6adc8', fontFamily: PRETENDARD } },
      ],
      textOnly: [
        { type: 'text', x: 120, y: 80, width: 1040, height: 140, zIndex: 1,
          text: '실습 목표를 입력하세요\n- 목표 1\n- 목표 2',
          style: { fontSize: 24, align: 'left', fontFamily: PRETENDARD } },
        { type: 'code', x: 140, y: 250, width: 1000, height: 380, zIndex: 2,
          text: 'print("Hello, World!")', codeLang: 'Python', style: { fontSize: 20 } },
      ],
      textImage1: [
        { type: 'code', x: 90, y: 140, width: 620, height: 440, zIndex: 1,
          text: 'def greet(name):\n    print(f"안녕, {name}!")\n\ngreet("학생")', codeLang: 'Python', style: { fontSize: 18 } },
        { type: 'text', x: 740, y: 100, width: 460, height: 32, zIndex: 2,
          text: '실행 결과',
          style: { fontSize: 18, align: 'left', color: '#a6adc8', fontFamily: PRETENDARD } },
        { type: 'image', x: 740, y: 140, width: 460, height: 440, zIndex: 3, style: { frame: 'rounded' } },
      ],
      textImagesMany: [
        { type: 'code', x: 100, y: 90, width: 1080, height: 260, zIndex: 1,
          text: 'const students = ["지민", "서연", "하준"];\nstudents.forEach(name => console.log(name));', codeLang: 'JavaScript', style: { fontSize: 18 } },
        { type: 'image', x: 100, y: 380, width: 520, height: 260, zIndex: 2, style: { frame: 'rounded' } },
        { type: 'image', x: 660, y: 380, width: 520, height: 260, zIndex: 3, style: { frame: 'rounded' } },
      ],
    },
  },
  {
    id: 'step-by-step',
    name: '단계별 실습',
    description: 'STEP 배지로 실습 과정을 한 단계씩 순서대로 안내하는 스타일',
    bg: 'linear-gradient(160deg, #ecfdf5, #d1fae5)',
    textColor: '#065f46',
    accentColor: '#10B981',
    swatch: '#d1fae5',
    layouts: {
      title: [
        { type: 'text', x: 140, y: 240, width: 1000, height: 140, zIndex: 1,
          text: '실습 이름을 입력하세요',
          style: { fontSize: 56, align: 'center', bold: true, fontFamily: PRETENDARD } },
        { type: 'text', x: 140, y: 400, width: 1000, height: 50, zIndex: 2,
          text: '단계별 실습 가이드',
          style: { fontSize: 22, align: 'center', color: '#047857', fontFamily: PRETENDARD } },
      ],
      textOnly: [
        { type: 'text', x: 100, y: 90, width: 170, height: 52, zIndex: 1,
          text: 'STEP 1',
          style: { fontSize: 22, align: 'center', bold: true, color: '#fff', background: '#10B981', borderRadius: 26, fontFamily: PRETENDARD } },
        { type: 'text', x: 100, y: 170, width: 1080, height: 430, zIndex: 2,
          text: '이 단계에서 할 일을 설명하세요\n\n1. 세부 내용 1\n2. 세부 내용 2',
          style: { fontSize: 30, align: 'left', fontFamily: PRETENDARD } },
      ],
      textImage1: [
        { type: 'text', x: 100, y: 90, width: 170, height: 52, zIndex: 1,
          text: 'STEP 1',
          style: { fontSize: 22, align: 'center', bold: true, color: '#fff', background: '#10B981', borderRadius: 26, fontFamily: PRETENDARD } },
        { type: 'text', x: 100, y: 170, width: 520, height: 430, zIndex: 2,
          text: '이 단계에서 할 일을 설명하세요\n\n1. 세부 내용 1\n2. 세부 내용 2',
          style: { fontSize: 26, align: 'left', fontFamily: PRETENDARD } },
        { type: 'image', x: 660, y: 170, width: 520, height: 430, zIndex: 3, style: { frame: 'rounded' } },
      ],
      textImagesMany: [
        { type: 'text', x: 100, y: 90, width: 170, height: 52, zIndex: 1,
          text: 'STEP 1',
          style: { fontSize: 22, align: 'center', bold: true, color: '#fff', background: '#10B981', borderRadius: 26, fontFamily: PRETENDARD } },
        { type: 'text', x: 100, y: 170, width: 1080, height: 100, zIndex: 2,
          text: '이 단계에서 할 일을 설명하세요',
          style: { fontSize: 24, align: 'left', fontFamily: PRETENDARD } },
        { type: 'text', x: 100, y: 290, width: 500, height: 30, zIndex: 3,
          text: 'Before',
          style: { fontSize: 16, align: 'left', bold: true, color: '#047857', fontFamily: PRETENDARD } },
        { type: 'text', x: 680, y: 290, width: 500, height: 30, zIndex: 4,
          text: 'After',
          style: { fontSize: 16, align: 'left', bold: true, color: '#047857', fontFamily: PRETENDARD } },
        { type: 'image', x: 100, y: 330, width: 500, height: 280, zIndex: 5, style: { frame: 'rounded' } },
        { type: 'image', x: 680, y: 330, width: 500, height: 280, zIndex: 6, style: { frame: 'rounded' } },
      ],
    },
  },
];

export const getTemplate = (id: string): SlideTemplate =>
  SLIDE_TEMPLATES.find(t => t.id === id) ?? SLIDE_TEMPLATES[0];

// 템플릿의 레이아웃 원본(Omit<SlideObject,'id'>[])에 새 id를 부여해 실제 슬라이드로 인스턴스화
export const instantiateSlide = (template: SlideTemplate, kind: SlideLayoutKind): DeckSlide => ({
  id: crypto.randomUUID(),
  bg: template.bg,
  textColor: template.textColor,
  objects: template.layouts[kind].map(o => ({ ...o, id: crypto.randomUUID() })),
});
