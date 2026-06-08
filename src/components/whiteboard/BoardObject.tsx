import type { BoardObject as BoardObjectType } from './types';
import StickyNote from './objects/StickyNote';
import TextBox from './objects/TextBox';
import ImageCard from './objects/ImageCard';
import ShapeBlock from './objects/ShapeBlock';
import SectionBlock from './objects/SectionBlock';
import ArrowLine from './objects/ArrowLine';

interface Props {
  obj: BoardObjectType;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (changes: Partial<BoardObjectType>) => void;
  onDelete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  allObjects: BoardObjectType[];
  zoom: number;
}

export default function BoardObject({ obj, isSelected, onSelect, onUpdate, onDelete, onDragStart, allObjects, zoom }: Props) {
  const commonProps = { obj, isSelected, onSelect, onUpdate, onDelete, onDragStart };

  switch (obj.type) {
    case 'sticky':  return <StickyNote {...commonProps} />;
    case 'text':    return <TextBox {...commonProps} />;
    case 'image':   return <ImageCard {...commonProps} />;
    case 'shape':   return <ShapeBlock {...commonProps} />;
    case 'section': return <SectionBlock obj={obj} isSelected={isSelected} onSelect={onSelect} onUpdate={onUpdate} onDragStart={onDragStart} />;
    case 'arrow':   return <ArrowLine {...commonProps} allObjects={allObjects} zoom={zoom} />;
    default:        return null;
  }
}
