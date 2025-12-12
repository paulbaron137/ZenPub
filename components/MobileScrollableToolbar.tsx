import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MobileScrollableToolbarProps {
  children: React.ReactNode;
  isDark: boolean;
  className?: string;
}

const MobileScrollableToolbar: React.FC<MobileScrollableToolbarProps> = ({ children, isDark, className = '' }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollTimeout, setScrollTimeout] = useState<number | null>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  // 最小滑动距离阈值
  const minSwipeDistance = 30;

  // 检查滚动位置
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 5); // 5px 容差
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5); // 5px 容差
  }, []);

  // 滚动到指定位置
  const scrollTo = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // 在移动端减少滚动量，以便更精确控制
    const scrollAmount = window.innerWidth < 640 ? 120 : 180; // 根据屏幕宽度调整
    const newScrollLeft = direction === 'left' 
      ? Math.max(0, container.scrollLeft - scrollAmount)
      : Math.min(container.scrollWidth - container.clientWidth, container.scrollLeft + scrollAmount);
    
    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  }, []);

  // 处理触摸开始
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  }, []);

  // 处理触摸移动
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  }, []);

  // 处理触摸结束
  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart.x - touchEnd.x;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      scrollTo('right'); // 向左滑动，内容向右滚动
    }
    if (isRightSwipe) {
      scrollTo('left'); // 向右滑动，内容向左滚动
    }
  }, [touchStart, touchEnd, scrollTo]);

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
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full shadow-md transition-all duration-200 md:hidden ${
            isDark 
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
              : 'bg-white text-gray-700 hover:bg-gray-100'
          } ${isScrolling ? 'opacity-50' : 'opacity-80'}`}
          aria-label="向左滚动"
        >
          <ChevronLeft size={14} />
        </button>
      )}
      
      {/* 右侧滚动指示器 */}
      {canScrollRight && (
        <button
          onClick={() => scrollTo('right')}
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full shadow-md transition-all duration-200 md:hidden ${
            isDark 
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
              : 'bg-white text-gray-700 hover:bg-gray-100'
          } ${isScrolling ? 'opacity-50' : 'opacity-80'}`}
          aria-label="向右滚动"
        >
          <ChevronRight size={14} />
        </button>
      )}
      
      {/* 滚动容器 */}
      <div
        ref={scrollContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`flex items-center overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth snap-x snap-mandatory ${
          isScrolling ? '' : ''
        }`}
        style={{
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
          WebkitScrollbar: 'none', // Chrome/Safari
          scrollBehavior: 'smooth',
          touchAction: 'pan-y pinch-zoom' // 允许垂直滚动和缩放，但处理水平滑动
        }}
      >
        {children}
      </div>
      
      {/* 渐变阴影效果 */}
      {canScrollLeft && (
        <div className={`absolute left-0 top-0 bottom-0 w-4 pointer-events-none z-0 md:hidden ${
          isDark 
            ? 'bg-gradient-to-r from-slate-800 to-transparent' 
            : 'bg-gradient-to-r from-white to-transparent'
        }`} />
      )}
      
      {canScrollRight && (
        <div className={`absolute right-0 top-0 bottom-0 w-4 pointer-events-none z-0 md:hidden ${
          isDark 
            ? 'bg-gradient-to-l from-slate-800 to-transparent' 
            : 'bg-gradient-to-l from-white to-transparent'
        }`} />
      )}
      
      {/* 滚动提示点 */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex space-x-1 md:hidden">
        <div className={`w-1 h-1 rounded-full transition-opacity ${
          canScrollLeft ? 'opacity-50' : 'opacity-20'
        } ${isDark ? 'bg-slate-400' : 'bg-gray-400'}`} />
        <div className={`w-1 h-1 rounded-full transition-opacity ${
          canScrollRight ? 'opacity-50' : 'opacity-20'
        } ${isDark ? 'bg-slate-400' : 'bg-gray-400'}`} />
      </div>
    </div>
  );
};

export default MobileScrollableToolbar;