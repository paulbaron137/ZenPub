import { useState, useRef, useCallback } from 'react';

interface DragItem {
  index: number;
  id: string;
}

interface DragResult {
  draggedIndex: number;
  targetIndex: number;
}

export const useDragAndDrop = (
  items: any[],
  onReorder: (fromIndex: number, toIndex: number) => void
) => {
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number, id: string) => {
    dragItem.current = index;
    setDraggedItem({ index, id });
    
    // 设置拖拽图像（可选）
    const dragImage = new Image();
    dragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    // 设置拖拽数据
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverItem.current = index;
    setDragOverIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // 确保不是拖拽到子元素上
    if (e.currentTarget === e.target) {
      dragOverItem.current = null;
      setDragOverIndex(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    const dragIndex = dragItem.current;
    const dropIndex = dragOverItem.current;
    
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      onReorder(dragIndex, dropIndex);
    }
    
    // 重置状态
    dragItem.current = null;
    dragOverItem.current = null;
    setDraggedItem(null);
    setDragOverIndex(null);
  }, [onReorder]);

  const handleDragEnd = useCallback(() => {
    // 重置状态
    dragItem.current = null;
    dragOverItem.current = null;
    setDraggedItem(null);
    setDragOverIndex(null);
  }, []);

  return {
    draggedItem,
    dragOverIndex,
    handleDragStart,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
};