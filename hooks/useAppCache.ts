import { useState, useEffect, useCallback, useRef } from 'react';
import { BookMetadata, Chapter, ViewMode, PreviewConfig } from '../types';
import cacheService from '../services/cacheService';

// 应用状态的接口定义
interface UseAppCacheProps {
  metadata: BookMetadata;
  chapters: Chapter[];
  activeChapterId: string;
  viewMode: ViewMode;
  sidebarOpen: boolean;
  memoOpen: boolean;
  theme: 'light' | 'dark';
  sidebarWidth: number;
  editorWidthPercent: number;
  previewConfig: PreviewConfig;
  
  // 更新状态的函数
  setMetadata: (metadata: BookMetadata) => void;
  setChapters: (chapters: Chapter[]) => void;
  setActiveChapterId: (id: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setSidebarOpen: (open: boolean) => void;
  setMemoOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setSidebarWidth: (width: number) => void;
  setEditorWidthPercent: (percent: number) => void;
  setPreviewConfig: (config: PreviewConfig) => void;
  
  // 滚动位置引用
  editorRef: React.RefObject<HTMLTextAreaElement>;
  previewRef?: React.RefObject<HTMLDivElement>;
  
  // 可选配置
  autoRestore?: boolean; // 是否自动恢复状态，默认为true
}

export const useAppCache = ({
  metadata,
  chapters,
  activeChapterId,
  viewMode,
  sidebarOpen,
  memoOpen,
  theme,
  sidebarWidth,
  editorWidthPercent,
  previewConfig,
  setMetadata,
  setChapters,
  setActiveChapterId,
  setViewMode,
  setSidebarOpen,
  setMemoOpen,
  setTheme,
  setSidebarWidth,
  setEditorWidthPercent,
  setPreviewConfig,
  editorRef,
  previewRef,
  autoRestore = true
}: UseAppCacheProps) => {
  // 状态管理
  const [isRestoring, setIsRestoring] = useState(true);
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);
  
  // 自动保存状态的函数
  const saveAppState = useCallback(async () => {
    if (!isInitializedRef.current) return;
    
    try {
      // 获取滚动位置
      const editorScrollPosition = editorRef.current?.scrollTop || 0;
      const previewScrollPosition = previewRef?.current?.scrollTop || 0;
      
      // 获取光标位置
      const cursorStart = editorRef.current?.selectionStart || 0;
      const cursorEnd = editorRef.current?.selectionEnd || 0;
      
      // 保存用户状态
      await cacheService.saveUserState({
        lastOpenTime: Date.now(),
        activeChapterId,
        scrollPosition: {
          editor: editorScrollPosition,
          preview: previewScrollPosition
        },
        cursorPosition: {
          start: cursorStart,
          end: cursorEnd
        },
        viewMode,
        sidebarOpen,
        memoOpen,
        theme,
        sidebarWidth,
        editorWidthPercent,
        previewConfig
      });
      
      // 保存项目数据
      await cacheService.saveProjectData({
        metadata,
        chapters,
        lastModified: Date.now()
      });
      
      setLastSaveTime(Date.now());
      console.log('Application state saved successfully');
    } catch (error) {
      console.error('Failed to save application state:', error);
    }
  }, [
    metadata,
    chapters,
    activeChapterId,
    viewMode,
    sidebarOpen,
    memoOpen,
    theme,
    sidebarWidth,
    editorWidthPercent,
    previewConfig,
    editorRef,
    previewRef
  ]);
  
  // 恢复应用状态的函数
  const restoreAppState = useCallback(async () => {
    try {
      console.log('[useAppCache] Starting state restoration...');
      setIsRestoring(true);
      
      // 设置超时，防止永久卡在恢复状态
      const restorationTimeout = setTimeout(() => {
        console.warn('[useAppCache] Restoration timeout, forcing completion');
        setIsRestoring(false);
        isInitializedRef.current = true;
      }, 5000); // 5秒超时
      
      // 尝试恢复用户状态和项目数据
      const [userState, projectData] = await Promise.all([
        cacheService.getUserState().catch(err => {
          console.error('[useAppCache] Failed to get user state:', err);
          return null;
        }),
        cacheService.getProjectData().catch(err => {
          console.error('[useAppCache] Failed to get project data:', err);
          return null;
        })
      ]);
      
      // 恢复项目数据
      if (projectData && projectData.metadata && projectData.chapters) {
        setMetadata(projectData.metadata);
        setChapters(projectData.chapters);
        console.log('[useAppCache] Project data restored successfully');
      } else {
        console.warn('[useAppCache] Invalid or missing project data');
      }
      
      // 恢复用户状态
      if (userState && userState.activeChapterId) {
        setActiveChapterId(userState.activeChapterId);
        setViewMode(userState.viewMode || 'split');
        setSidebarOpen(userState.sidebarOpen !== undefined ? userState.sidebarOpen : true);
        setMemoOpen(userState.memoOpen !== undefined ? userState.memoOpen : false);
        setTheme(userState.theme || 'light');
        setSidebarWidth(userState.sidebarWidth || 256);
        setEditorWidthPercent(userState.editorWidthPercent || 50);
        setPreviewConfig(userState.previewConfig || DEFAULT_PREVIEW_CONFIG);
        
        console.log('[useAppCache] User state restored successfully');
        
        // 延迟恢复滚动位置和光标位置，确保DOM已渲染
        setTimeout(() => {
          try {
            if (editorRef.current) {
              editorRef.current.scrollTop = userState.scrollPosition?.editor || 0;
              
              // 恢复光标位置
              const cursorStart = userState.cursorPosition?.start || 0;
              const cursorEnd = userState.cursorPosition?.end || cursorStart;
              
              // 设置光标位置
              editorRef.current.focus();
              editorRef.current.setSelectionRange(cursorStart, cursorEnd);
            }
            
            if (previewRef?.current) {
              previewRef.current.scrollTop = userState.scrollPosition?.preview || 0;
            }
          } catch (error) {
            console.error('[useAppCache] Error restoring cursor/scroll position:', error);
          } finally {
            // 确保恢复完成后更新状态
            clearTimeout(restorationTimeout);
            setIsRestoring(false);
            isInitializedRef.current = true;
            console.log('[useAppCache] State restoration completed');
          }
        }, 100);
      } else {
        console.warn('[useAppCache] Invalid or missing user state');
        // 如果没有用户状态，也需要重置恢复状态
        clearTimeout(restorationTimeout);
        setIsRestoring(false);
        isInitializedRef.current = true;
      }
    } catch (error) {
      console.error('[useAppCache] Failed to restore application state:', error);
      // 即使出错也要重置恢复状态
      setIsRestoring(false);
      isInitializedRef.current = true;
    }
  }, [
    setMetadata,
    setChapters,
    setActiveChapterId,
    setViewMode,
    setSidebarOpen,
    setMemoOpen,
    setTheme,
    setSidebarWidth,
    setEditorWidthPercent,
    setPreviewConfig,
    editorRef,
    previewRef,
    DEFAULT_PREVIEW_CONFIG
  ]);
  
  // 防抖保存函数
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = window.setTimeout(() => {
      saveAppState();
    }, 2000); // 2秒后保存
  }, [saveAppState]);
  
  // 页面加载时尝试恢复状态
  useEffect(() => {
    if (autoRestore) {
      restoreAppState();
    }
    
    // 清理函数
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [restoreAppState, autoRestore]);
  
  // 监听状态变化并自动保存
  useEffect(() => {
    if (!isRestoring && isInitializedRef.current) {
      debouncedSave();
    }
  }, [
    metadata,
    chapters,
    activeChapterId,
    viewMode,
    sidebarOpen,
    memoOpen,
    theme,
    sidebarWidth,
    editorWidthPercent,
    previewConfig,
    isRestoring,
    debouncedSave
  ]);
  
  // 监听滚动位置变化
  useEffect(() => {
    if (isRestoring || !isInitializedRef.current) return;
    
    const handleScroll = () => {
      debouncedSave();
    };
    
    if (editorRef.current) {
      editorRef.current.addEventListener('scroll', handleScroll);
    }
    
    if (previewRef?.current) {
      previewRef.current.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      if (editorRef.current) {
        editorRef.current.removeEventListener('scroll', handleScroll);
      }
      if (previewRef?.current) {
        previewRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, [isRestoring, editorRef, previewRef, debouncedSave]);
  
  // 页面卸载前保存状态
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isInitializedRef.current) {
        saveAppState();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveAppState]);
  
  // 监听页面可见性变化，页面隐藏时保存状态
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isInitializedRef.current) {
        saveAppState();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveAppState]);
  
  // 手动清除缓存的函数
  const clearCache = useCallback(async () => {
    try {
      await cacheService.clearCache();
      console.log('Cache cleared successfully');
      // 重新加载页面以清除状态
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }, []);
  
  // 清理旧历史记录
  useEffect(() => {
    const cleanupHistory = async () => {
      try {
        await cacheService.cleanupOldHistory();
      } catch (error) {
        console.error('Failed to cleanup history:', error);
      }
    };
    
    // 每天清理一次旧历史记录
    const intervalId = setInterval(cleanupHistory, 24 * 60 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  return {
    isRestoring,
    lastSaveTime,
    saveAppState,
    clearCache,
    restoreAppState // 导出恢复状态函数
  };
};