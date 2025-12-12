import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableToolbarProps {
  children: React.ReactNode;
  isDark: boolean;
  className?: string;
}

const ExpandableToolbar: React.FC<ExpandableToolbarProps> = ({ children, isDark, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMoreButton, setShowMoreButton] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkOverflow = () => {
      if (!toolbarRef.current) return;
      
      const container = toolbarRef.current;
      const hasOverflow = container.scrollWidth > container.clientWidth;
      setShowMoreButton(hasOverflow);
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [children]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`relative ${className}`}>
      <div
        ref={toolbarRef}
        className={`flex items-center transition-all duration-300 ${
          isExpanded 
            ? 'flex-wrap' 
            : 'overflow-hidden'
        }`}
        style={{
          maxHeight: isExpanded ? '120px' : '48px'
        }}
      >
        {children}
        
        {/* 扩展按钮 */}
        {showMoreButton && (
          <button
            onClick={toggleExpanded}
            className={`absolute right-0 bottom-0 z-10 p-1 rounded-tl-md transition-all duration-200 shadow-md ${
              isDark 
                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            aria-label={isExpanded ? '收起工具栏' : '展开更多工具'}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>
      
      {/* 渐变遮罩 - 未展开状态 */}
      {!isExpanded && showMoreButton && (
        <div
          className={`absolute right-0 bottom-0 left-0 h-8 pointer-events-none z-0 ${
            isDark 
              ? 'bg-gradient-to-t from-slate-800 to-transparent' 
              : 'bg-gradient-to-t from-white to-transparent'
          }`}
        />
      )}
    </div>
  );
};

export default ExpandableToolbar;