export type ObjectType = 'sticky' | 'text' | 'image' | 'shape' | 'arrow' | 'section';
export type ActiveTool = 'select' | ObjectType;
export type ConnectionStatus = 'connecting' | 'connected' | 'polling' | 'disconnected';

export interface BoardObject {
  id: string;
  board_id: string;
  type: ObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  content: Record<string, unknown>;
  style: Record<string, unknown>;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Whiteboard {
  id: string;
  class_id?: string;
  title: string;
  template: string;
  group_name?: string;
  created_by: string;
  share_token: string;
  is_public: boolean;
  snapshot_url?: string;
  created_at: string;
  updated_at: string;
}

export interface SessionMember {
  userId: string;
  displayName: string;
  avatarColor: string;
  lastPing: string;
}

export interface RemoteCursor {
  userId: string;
  canvasX: number;
  canvasY: number;
  displayName: string;
  avatarColor: string;
  lastSeen: number;
}

export type TemplateKey = 'blank' | 'brainstorm' | 'kwl' | 'tchart' | 'mindmap' | 'timeline' | 'group';

export interface TemplateConfig {
  key: TemplateKey;
  label: string;
  description: string;
  sections: { title: string; color?: string; x: number; y: number; width: number; height: number }[];
}

export const TEMPLATES: TemplateConfig[] = [
  {
    key: 'blank',
    label: '빈 보드',
    description: '자유롭게 시작하기',
    sections: [],
  },
  {
    key: 'brainstorm',
    label: '브레인스토밍',
    description: '아이디어를 자유롭게 펼쳐보세요',
    sections: [
      { title: '🧠 아이디어', color: '#FFF9C4', x: 100, y: 100, width: 1400, height: 800 },
    ],
  },
  {
    key: 'kwl',
    label: 'KWL 차트',
    description: '알고있는 것 / 알고싶은 것 / 배운 것',
    sections: [
      { title: 'K — 알고 있는 것', color: '#E3F2FD', x: 60, y: 80, width: 460, height: 700 },
      { title: 'W — 알고 싶은 것', color: '#F3E5F5', x: 570, y: 80, width: 460, height: 700 },
      { title: 'L — 배운 것', color: '#E8F5E9', x: 1080, y: 80, width: 460, height: 700 },
    ],
  },
  {
    key: 'tchart',
    label: 'T 차트',
    description: '두 가지를 비교 분석',
    sections: [
      { title: '좌측', color: '#FFF3E0', x: 60, y: 80, width: 700, height: 700 },
      { title: '우측', color: '#E8F5E9', x: 840, y: 80, width: 700, height: 700 },
    ],
  },
  {
    key: 'mindmap',
    label: '마인드맵',
    description: '중심 주제에서 가지 뻗기',
    sections: [
      { title: '중심 주제', color: '#FCE4EC', x: 600, y: 380, width: 400, height: 120 },
    ],
  },
  {
    key: 'timeline',
    label: '타임라인',
    description: '시간 순서로 정리',
    sections: [
      { title: '시작', color: '#E3F2FD', x: 60, y: 300, width: 380, height: 300 },
      { title: '중간', color: '#F3E5F5', x: 610, y: 300, width: 380, height: 300 },
      { title: '끝', color: '#E8F5E9', x: 1160, y: 300, width: 380, height: 300 },
    ],
  },
  {
    key: 'group',
    label: '조별 보드',
    description: '조별 활동 공간 자동 구성',
    sections: [
      { title: '1조', color: '#FFF9C4', x: 60, y: 60, width: 460, height: 380 },
      { title: '2조', color: '#FCE4EC', x: 570, y: 60, width: 460, height: 380 },
      { title: '3조', color: '#E3F2FD', x: 1080, y: 60, width: 460, height: 380 },
      { title: '4조', color: '#E8F5E9', x: 60, y: 500, width: 460, height: 380 },
      { title: '5조', color: '#F3E5F5', x: 570, y: 500, width: 460, height: 380 },
      { title: '6조', color: '#FFF3E0', x: 1080, y: 500, width: 460, height: 380 },
    ],
  },
];

export const STICKY_COLORS = [
  { key: 'yellow', bg: '#FFF9C4', border: '#F9A825' },
  { key: 'pink',   bg: '#FCE4EC', border: '#E91E63' },
  { key: 'blue',   bg: '#E3F2FD', border: '#1E88E5' },
  { key: 'green',  bg: '#E8F5E9', border: '#43A047' },
  { key: 'purple', bg: '#F3E5F5', border: '#8E24AA' },
  { key: 'orange', bg: '#FFF3E0', border: '#FB8C00' },
];

export const SHAPE_TYPES = ['rect', 'circle', 'diamond'] as const;
export type ShapeType = typeof SHAPE_TYPES[number];
