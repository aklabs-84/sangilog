import { v4 as uuidv4 } from 'uuid';
import type { BoardObject, TemplateKey } from './types';
import { TEMPLATES } from './types';

export function createTemplateObjects(boardId: string, templateKey: TemplateKey): BoardObject[] {
  const template = TEMPLATES.find(t => t.key === templateKey);
  if (!template || template.sections.length === 0) return [];
  return template.sections.map(sec => ({
    id: uuidv4(),
    board_id: boardId,
    type: 'section' as const,
    x: sec.x, y: sec.y,
    width: sec.width, height: sec.height,
    z_index: 0,
    content: { title: sec.title, body: '' },
    style: { bgColor: sec.color ?? '#F0F9FF', opacity: 0.55 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}
