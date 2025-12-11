import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollableToolbarProps {
  children: React.ReactNode;
  isDark: boolean;
  className?: string;
}

const ScrollableToolbar: React.FC<ScrollableToolbarProps> = ({ children, isDark, className = '' }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollTimeout, setScrollTimeout] = useState<number | null>(null);

  // 检查滚动位置
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5); // 5px 容差
  }, []);

  // 滚动到指定位置
  const scrollTo = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200; // 每次滚动的像素
    const newScrollLeft = direction === 'left' 
      ? Math.max(0, container.scrollLeft - scrollAmount)
      : Math.min(container.scrollWidth - container.clientWidth, container.scrollLeft + scrollAmount);
    
    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  }, []);

  // 处理鼠标滚轮事件
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // 检查是否可以水平滚动
    const { scrollLeft, scrollWidth, clientWidth } = container;
    const canHorizontallyScroll = scrollWidth > clientWidth;
    
    if (canHorizontallyScroll) {
      e.preventDefault();
      
      // 垂直滚轮映射到水平滚动
      const scrollDelta = e.deltaY * 0.5; // 调整滚动速度
      const newScrollLeft = Math.max(0, Math.min(scrollWidth - clientWidth, scrollLeft + scrollDelta));
      
      container.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  }, []);

  // 处理滚动开始
  const handleScrollStart = useCallback(() => {
    setIsScrolling(true);
    
    // 清除之前的超时
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
    
    // 设置新的超时
    const timeout = window.setTimeout(() => {
      setIsScrolling(false);
    }, 150);
    
    setScrollTimeout(timeout);
  }, [scrollTimeout]);

  // 监听滚动事件
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      checkScrollPosition();
      handleScrollStart();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // 初始检查
    checkScrollPosition();
    
    // 监听窗口大小变化
    const handleResize = () => {
      checkScrollPosition();
    };
    
    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [checkScrollPosition, handleScrollStart]);

  // 清理超时
  useEffect(() => {
    return () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [scrollTimeout]);

  return (
    <div className={`relative group ${className}`}>
      {/* 左侧滚动指示器 */}
      {canScrollLeft && (
        <button
          onClick={() => scrollTo('left')}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full shadow-md transition-all duration-200 ${
            isDark 
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
              : 'bg-white text-gray-700 hover:bg-gray-100'
          } ${isScrolling ? 'opacity-50' : 'opacity-80'} group-hover:opacity-100`}
          aria-label="向左滚动"
        >
          <ChevronLeft size={16} />
        </button>
      )}
      
      {/* 右侧滚动指示器 */}
      {canScrollRight && (
        <button
          onClick={() => scrollTo('right')}
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full shadow-md transition-all duration-200 ${
            isDark 
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
              : 'bg-white text-gray-700 hover:bg-gray-100'
          } ${isScrolling ? 'opacity-50' : 'opacity-80'} group-hover:opacity-100`}
          aria-label="向右滚动"
        >
          <ChevronRight size={16} />
        </button>
      )}
      
      {/* 滚动容器 */}
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        className={`flex items-center overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth ${
          isScrolling ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
          WebkitScrollbar: 'none', // Chrome/Safari
          scrollBehavior: 'smooth'
        }}
      >
        {children}
      </div>
      
      {/* 渐变阴影效果 */}
      {canScrollLeft && (
        <div className={`absolute left-0 top-0 bottom-0 w-6 pointer-events-none z-0 ${
          isDark 
            ? 'bg-gradient-to-r from-slate-800 to-transparent' 
            : 'bg-gradient-to-r from-white to-transparent'
        }`} />
      )}
      
      {canScrollRight && (
        <div className={`absolute right-0 top-0 bottom-0 w-6 pointer-events-none z-0 ${
          isDark 
            ? 'bg-gradient-to-l from-slate-800 to-transparent' 
            : 'bg-gradient-to-l from-white to-transparent'
        }`} />
      )}
    </div>
  );
};

export default ScrollableToolbar;