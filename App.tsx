import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
// ... existing imports ...
import { 
  Menu, BookOpen, Settings, Download, Plus, Trash2, 
  ChevronLeft, ChevronRight, PenTool, Edit3, Save, 
  MoreVertical, FileText, X, Image as ImageIcon,
  HelpCircle, ExternalLink, CheckCircle, AlertCircle,
  Bold, Italic, Heading1, Heading2, Heading3, List, Quote, Link, Minus, 
  MessageSquare, StickyNote, Type, Undo, Redo, AlignVerticalJustifyCenter,
  Smartphone, Monitor, File as FileIcon, History, Clock, Upload, FileDown, RotateCcw,
  Search as SearchIcon, Replace, ArrowDown, ArrowUp, XCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookMetadata, Chapter, ViewMode, Snapshot, PreviewConfig } from './types';
import { exportToEpub, exportToMarkdown, exportToPdf, importEpub } from './services/epubService';
import { useAppCache } from './hooks/useAppCache';
import RestorePrompt from './components/RestorePrompt';
import cacheService from './services/cacheService';
import { useDragAndDrop } from './hooks/useDragAndDrop';

// ... Constants ...
const DEFAULT_CHAPTER: Chapter = {
  id: '1',
  title: '第一章：启程',
  content: '# 第一章：启程\n\n这是一个关于梦想与冒险的故事。在此处开始你的创作……\n\n添加一个脚注[^1]试试看。\n\n[^1]: 这是一个脚注的示例。',
  memo: '在此处记录本章大纲、灵感或人物小传（不会导出到电子书中）...',
  order: 0
};

const DEFAULT_METADATA: BookMetadata = {
  title: '未命名作品',
  author: '佚名',
  publisher: '',
  description: '',
  language: 'zh-CN',
  tags: []
};

const DEFAULT_PREVIEW_CONFIG: PreviewConfig = {
  viewMode: 'desktop',
  fontSize: 16,
  lineHeight: 1.8,
  indent: 2
};

const HELP_CONTENT = `
## ⌨️ 快捷键指南
- **撤销**: \`Ctrl + Z\`
- **重做**: \`Ctrl + Shift + Z\` 或 \`Ctrl + Y\`
- **保存快照**: \`Ctrl + S\`
- **加粗**: \`Ctrl + B\`
- **斜体**: \`Ctrl + I\`
- **插入链接**: \`Ctrl + K\`
- **查找替换**: \`Ctrl + F\`
- **标题 1**: \`Ctrl + 1\`
- **标题 2**: \`Ctrl + 2\`
- **标题 3**: \`Ctrl + 3\`

## 📝 Markdown 基础语法
- **加粗**: \`**文本**\`
- *斜体*: \`*文本*\`
- 标题: \`# 一级标题\`, \`## 二级标题\`
- 列表: \`- 项目符号\` 或 \`1. 有序列表\`
- 引用: \`> 引用文本\`
- 链接: \`[显示文本](链接地址)\`
- 图片: \`![描述](图片链接)\`
- 代码块:
  \`\`\`
  代码内容
  \`\`\`
- 分割线: \`---\`
- 脚注: 这是一个脚注[^1]
  \`[^1]: 脚注解释内容\`

## v2.3.0 新特性
- **PWA升级**: 升级为完整的PWA应用，支持离线使用和安装到主屏幕。
- **智能缓存**: 新增恢复提示框，可选择恢复上次编辑状态和光标位置。
- **状态恢复**: 精准恢复编辑位置、滚动位置和光标位置，提升工作效率。
`;

// ... rest of the App.tsx logic remains same ...
// (I will output the full file content to ensure consistency)

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => (
  <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 z-[70] animate-fade-in-up ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'}`}>
    {type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
    <span className="text-sm font-medium">{message}</span>
  </div>
);

// Resizer Component
const Resizer: React.FC<{ onMouseDown: (e: React.MouseEvent) => void, vertical?: boolean }> = ({ onMouseDown, vertical = true }) => (
  <div 
    className={`z-20 flex-none hover:bg-indigo-500/50 transition-colors select-none bg-gray-200 dark:bg-slate-700 ${vertical ? 'w-1 cursor-col-resize hover:w-1.5 -mr-0.5 -ml-0.5' : 'h-1 cursor-row-resize hover:h-1.5 -mt-0.5 -mb-0.5'}`} 
    onMouseDown={onMouseDown}
  />
);

// Helper component for highlighting matching text
const HighlightedText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
  if (!highlight.trim()) {
    return <>{text}</>;
  }
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span key={i} className="bg-yellow-200 dark:bg-yellow-900/60 text-indigo-700 dark:text-indigo-300 font-bold rounded-[1px] px-0.5">{part}</span>
        ) : (
          part
        )
      )}
    </>
  );
};

const App: React.FC = () => {
  // --- State ---
  const [metadata, setMetadata] = useState<BookMetadata>(DEFAULT_METADATA);
  const [chapters, setChapters] = useState<Chapter[]>([DEFAULT_CHAPTER]);
  const [activeChapterId, setActiveChapterId] = useState<string>('1');
  const [viewMode, setViewMode] = useState<ViewMode>('split'); 
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [memoOpen, setMemoOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Layout State
  const [sidebarWidth, setSidebarWidth] = useState(256); // Initial 64rem (w-64) approx 256px
  const [editorWidthPercent, setEditorWidthPercent] = useState(50); // 50% split by default
  const isResizing = useRef<'sidebar' | 'editor' | null>(null);

  // Feature States
  const [isTypewriterMode, setIsTypewriterMode] = useState(false);
  const [previewConfig, setPreviewConfig] = useState<PreviewConfig>(DEFAULT_PREVIEW_CONFIG);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Search & Replace State (Editor Content)
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  // Chapter Search State (Sidebar)
  const [chapterSearchQuery, setChapterSearchQuery] = useState('');

  // Undo/Redo
  const [history, setHistory] = useState<string[]>([]);
  const [historyPtr, setHistoryPtr] = useState(-1);
  const historyTimeoutRef = useRef<number | null>(null);
  const snapshotTimeoutRef = useRef<number | null>(null);

  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Toast State
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);
  
  // 恢复提示框状态
  const [showRestorePrompt, setShowRestorePrompt] = useState(true);
  const [hasRestorableState, setHasRestorableState] = useState(false);
  const [isRestoringState, setIsRestoringState] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreChecked, setRestoreChecked] = useState(false);
  
  // 使用拖拽排序Hook
  const {
    draggedItem,
    dragOverIndex,
    handleDragStart,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd
  } = useDragAndDrop(chapters, (fromIndex, toIndex) => {
    // 重新排序章节
    const newChapters = [...chapters];
    const [movedChapter] = newChapters.splice(fromIndex, 1);
    newChapters.splice(toIndex, 0, movedChapter);
    
    // 更新order属性
    const reorderedChapters = newChapters.map((chapter, index) => ({
      ...chapter,
      order: index
    }));
    
    setChapters(reorderedChapters);
    
    // 如果移动的是当前活动章节，需要更新活动章节ID
    if (activeChapterId === movedChapter.id) {
      // 检查移动后是否有相同ID的章节
      const newActiveChapter = reorderedChapters.find(c => c.id === activeChapterId);
      if (newActiveChapter) {
        setActiveChapterId(newActiveChapter.id);
      }
    }
    
    showToast(`章节 "${movedChapter.title}" 已移动到位置 ${toIndex + 1}`, "success");
  });

  // Refs
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // --- Derived State ---
  const activeChapter = chapters.find(c => c.id === activeChapterId) || chapters[0];
  
  // Filtered Chapters for Sidebar
  const filteredChapters = useMemo(() => {
    if (!chapterSearchQuery.trim()) return chapters;
    return chapters.filter(c => c.title.toLowerCase().includes(chapterSearchQuery.toLowerCase()));
  }, [chapters, chapterSearchQuery]);

  // Word Count
  const wordCounts = useMemo(() => {
    const currentText = activeChapter.content.replace(/[#*>\-`\[\]\(\)\n]/g, '');
    const currentCount = currentText.length;
    const totalCount = chapters.reduce((acc, curr) => acc + curr.content.replace(/[#*>\-`\[\]\(\)\n]/g, '').length, 0);
    return { current: currentCount, total: totalCount };
  }, [activeChapter.content, chapters]);

  // --- Effects ---
  
  // Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;

      if (isResizing.current === 'sidebar') {
        const newWidth = Math.max(200, Math.min(450, e.clientX)); // Min 200px, Max 450px
        setSidebarWidth(newWidth);
      } else if (isResizing.current === 'editor' && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const relativeX = e.clientX - containerRect.left;
        const newPercent = (relativeX / containerRect.width) * 100;
        // Clamp between 20% and 80%
        setEditorWidthPercent(Math.max(20, Math.min(80, newPercent)));
      }
    };

    const handleMouseUp = () => {
      isResizing.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
       window.addEventListener('mousemove', handleMouseMove);
       window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResizingSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = 'sidebar';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const startResizingEditor = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = 'editor';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewMode('editor');
        setSidebarOpen(false);
        setMemoOpen(false);
      } else {
        setViewMode('split');
        setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Reset history when chapter changes
  useEffect(() => {
    setHistory([activeChapter.content]);
    setHistoryPtr(0);
    if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
  }, [activeChapterId]);

  // Search Effect
  useEffect(() => {
    if (!findText || !editorRef.current) {
      setMatchCount(0);
      setCurrentMatchIndex(-1);
      return;
    }
    const content = activeChapter.content;
    const matches = content.split(findText).length - 1;
    setMatchCount(matches);
    if (matches > 0 && currentMatchIndex === -1) {
       setCurrentMatchIndex(0);
    }
  }, [findText, activeChapter.content]);

  // 检查是否有可恢复的状态
  useEffect(() => {
    const checkRestorableState = async () => {
      try {
        const hasState = await cacheService.hasRestorableState();
        setHasRestorableState(hasState);
        setRestoreChecked(true);
      } catch (error) {
        console.error('检查可恢复状态时出错:', error);
        setHasRestorableState(false);
        setRestoreChecked(true);
      }
    };
    
    checkRestorableState();
  }, []);

  // --- Handlers ---

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const updateChapterContent = (newContent: string) => {
     setChapters(prev => prev.map(c => 
      c.id === activeChapterId ? { ...c, content: newContent } : c
    ));
  };

  const handleContentInput = (newContent: string) => {
    updateChapterContent(newContent);

    // Typewriter Logic
    if (isTypewriterMode && editorRef.current) {
        const textarea = editorRef.current;
        const val = textarea.value;
        const selStart = textarea.selectionStart;
        const linesBefore = val.substring(0, selStart).split('\n').length;
        const lineHeight = window.innerWidth < 768 ? 24 : 20;
        const estimatedTop = linesBefore * lineHeight;
        const containerHeight = textarea.clientHeight;
        textarea.scrollTop = estimatedTop - (containerHeight / 2);
    }

    // History Debounce
    if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
    historyTimeoutRef.current = window.setTimeout(() => {
      setHistory(prev => {
        const newHistory = prev.slice(0, historyPtr + 1);
        newHistory.push(newContent);
        return newHistory;
      });
      setHistoryPtr(prev => prev + 1);
    }, 600);

    // Snapshot Timer
    if (snapshotTimeoutRef.current) clearTimeout(snapshotTimeoutRef.current);
    snapshotTimeoutRef.current = window.setTimeout(() => {
        createSnapshot(newContent, "自动备份");
    }, 2 * 60 * 1000);
  };

  const createSnapshot = (content: string, desc: string) => {
      const newSnap: Snapshot = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          content,
          chapterId: activeChapterId,
          description: desc
      };
      setSnapshots(prev => [newSnap, ...prev].slice(0, 50));
      if (desc !== "自动备份") showToast("快照已保存");
  };

  const restoreSnapshot = (snap: Snapshot) => {
      if(confirm("恢复此版本将覆盖当前内容，确定吗？")) {
          updateChapterContent(snap.content);
          setShowSnapshotModal(false);
          showToast("已恢复历史版本");
      }
  };

  const handleResetApp = () => {
    if (confirm("确定要重置应用吗？这将清除所有当前内容并恢复到默认状态。")) {
        setMetadata(DEFAULT_METADATA);
        setChapters([DEFAULT_CHAPTER]);
        setActiveChapterId(DEFAULT_CHAPTER.id);
        setSnapshots([]);
        setHistory([]);
        setHistoryPtr(-1);
        setShowSettingsModal(false);
        showToast("应用已重置");
    }
  };

  const handleUndo = () => {
    if (historyPtr > 0) {
      const newPtr = historyPtr - 1;
      const content = history[newPtr];
      setHistoryPtr(newPtr);
      updateChapterContent(content);
      showToast("已撤销");
    }
  };

  const handleRedo = () => {
    if (historyPtr < history.length - 1) {
      const newPtr = historyPtr + 1;
      const content = history[newPtr];
      setHistoryPtr(newPtr);
      updateChapterContent(content);
      showToast("已重做");
    }
  };

  // Search & Replace Logic
  const handleFindNext = () => {
    if (!findText || matchCount === 0) return;
    const nextIndex = (currentMatchIndex + 1) % matchCount;
    setCurrentMatchIndex(nextIndex);
    scrollToMatch(nextIndex);
  };

  const handleFindPrev = () => {
    if (!findText || matchCount === 0) return;
    const prevIndex = (currentMatchIndex - 1 + matchCount) % matchCount;
    setCurrentMatchIndex(prevIndex);
    scrollToMatch(prevIndex);
  };

  const scrollToMatch = (index: number) => {
     if (!editorRef.current || !findText) return;
     const textarea = editorRef.current;
     const content = textarea.value;
     let pos = -1;
     for (let i = 0; i <= index; i++) {
       pos = content.indexOf(findText, pos + 1);
     }
     if (pos !== -1) {
       textarea.focus();
       textarea.setSelectionRange(pos, pos + findText.length);
       const lineHeight = 20;
       const lines = content.substring(0, pos).split('\n').length;
       textarea.scrollTop = lines * lineHeight - textarea.clientHeight / 2;
     }
  };

  const handleReplace = () => {
    if (!findText || !editorRef.current) return;
    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    
    if (selected === findText) {
       const newContent = textarea.value.substring(0, start) + replaceText + textarea.value.substring(end);
       handleContentInput(newContent);
       setTimeout(handleFindNext, 0);
    } else {
       handleFindNext();
    }
  };

  const handleReplaceAll = () => {
    if (!findText) return;
    const newContent = activeChapter.content.replaceAll(findText, replaceText);
    handleContentInput(newContent);
    showToast("已全部替换");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch(e.key.toLowerCase()) {
        case 'z':
          e.preventDefault();
          e.shiftKey ? handleRedo() : handleUndo();
          break;
        case 'y':
          e.preventDefault();
          handleRedo();
          break;
        case 's':
          e.preventDefault();
          createSnapshot(activeChapter.content, "手动保存");
          break;
        case 'b':
          e.preventDefault();
          insertSyntax('**', '**');
          break;
        case 'i':
          e.preventDefault();
          insertSyntax('*', '*');
          break;
        case 'k':
          e.preventDefault();
          handleInsertLink();
          break;
        case 'f':
          e.preventDefault();
          setShowSearchPanel(true);
          break;
        case '1':
          e.preventDefault();
          insertSyntax('# ');
          break;
        case '2':
          e.preventDefault();
          insertSyntax('## ');
          break;
        case '3':
          e.preventDefault();
          insertSyntax('### ');
          break;
      }
    }
  };

  const handleUpdateMemo = (newMemo: string) => {
    setChapters(prev => prev.map(c => 
      c.id === activeChapterId ? { ...c, memo: newMemo } : c
    ));
  };

  const handleUpdateTitle = (newTitle: string) => {
    setChapters(prev => prev.map(c => 
      c.id === activeChapterId ? { ...c, title: newTitle } : c
    ));
  };

  const insertSyntax = (prefix: string, suffix: string = '') => {
    if (!editorRef.current) return;
    const textarea = editorRef.current;
    const scrollTop = textarea.scrollTop;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selection = text.substring(start, end);
    const newText = text.substring(0, start) + prefix + selection + suffix + text.substring(end);
    
    updateChapterContent(newText);
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyPtr + 1);
      newHistory.push(newText);
      return newHistory;
    });
    setHistoryPtr(prev => prev + 1);
    
    setTimeout(() => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      const newCursorPos = start + prefix.length + selection.length + suffix.length;
      editorRef.current.setSelectionRange(start + prefix.length, newCursorPos);
      editorRef.current.scrollTop = scrollTop;
    }, 0);
  };

  const handleInsertLink = () => {
    const url = prompt("请输入链接地址 (URL):", "https://");
    if (url) {
      if (!editorRef.current) return;
      const textarea = editorRef.current;
      const scrollTop = textarea.scrollTop;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selection = textarea.value.substring(start, end);
      const linkText = selection || prompt("请输入链接文本:", "链接") || "链接";
      const markdownLink = `[${linkText}](${url})`;
      const newText = textarea.value.substring(0, start) + markdownLink + textarea.value.substring(end);
      handleContentInput(newText);
      
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();
          editorRef.current.setSelectionRange(start + markdownLink.length, start + markdownLink.length);
          editorRef.current.scrollTop = scrollTop;
        }
      }, 0);
    }
  };

  const handleInsertImage = () => {
    if (confirm("点击“确定”上传本地图片，点击“取消”输入网络图片地址")) {
       imageInputRef.current?.click();
    } else {
       const url = prompt("请输入图片地址 (URL):", "https://");
       if (url) {
         insertSyntax(`![图片描述](${url})`);
       }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
           const base64 = reader.result as string;
           insertSyntax(`![本地图片](${base64})`);
           showToast("图片已插入");
        };
        reader.readAsDataURL(file);
     }
     if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const addChapter = () => {
    const newId = crypto.randomUUID();
    const newChapter: Chapter = {
      id: newId,
      title: `新章节 ${chapters.length + 1}`,
      content: `# 第 ${chapters.length + 1} 章\n\n`,
      memo: '',
      order: chapters.length
    };
    setChapters([...chapters, newChapter]);
    setActiveChapterId(newId);
    setChapterSearchQuery(''); // Clear search to show new chapter
    if (window.innerWidth < 768) setSidebarOpen(false);
    showToast("章节已添加");
  };

  const deleteChapter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (chapters.length <= 1) {
      showToast("至少需要保留一个章节", "error");
      return;
    }
    if (confirm("确定要删除这个章节吗？此操作无法撤销。")) {
      const newChapters = chapters.filter(c => c.id !== id);
      setChapters(newChapters);
      if (activeChapterId === id) {
        setActiveChapterId(newChapters[0].id);
      }
      showToast("章节已删除");
    }
  };

  const handleExport = async (format: 'epub' | 'pdf' | 'md') => {
    setShowExportMenu(false);
    try {
      showToast(`正在导出 ${format.toUpperCase()}...`, "success");
      if (format === 'epub') await exportToEpub(metadata, chapters);
      else if (format === 'pdf') await exportToPdf(metadata, chapters);
      else if (format === 'md') await exportToMarkdown(metadata, chapters);
      showToast("导出成功！", "success");
    } catch (e) {
      console.error(e);
      showToast("导出失败，请重试。", "error");
    }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMetadata({
          ...metadata,
          coverData: reader.result as string,
          coverMimeType: file.type
        });
        showToast("封面上传成功");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImportEpub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    showToast("正在解析 EPUB...", "success");
    importEpub(file).then(result => {
      setMetadata(result.metadata);
      setChapters(result.chapters);
      if (result.chapters.length > 0) setActiveChapterId(result.chapters[0].id);
      setShowRestorePrompt(false); // 导入后关闭恢复提示
      showToast("导入成功！", "success");
    }).catch(err => {
      console.error(err);
      showToast("EPUB 格式不支持或损坏", "error");
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 恢复状态处理函数
  const handleRestoreState = async () => {
    setIsRestoringState(true);
    setRestoreError(null);
    
    try {
      console.log('[App] Starting state restoration...');
      
      // 调用缓存Hook中的恢复函数
      await restoreState();
      
      // 等待状态恢复完成
      let attempts = 0;
      while (isRestoring && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
      
      // 检查恢复是否成功
      if (isRestoring) {
        console.warn('[App] State restoration is taking too long, proceeding anyway');
      }
      
      setShowRestorePrompt(false);
      showToast("状态已恢复", "success");
    } catch (error) {
      console.error('[App] 恢复状态时出错:', error);
      setRestoreError("无法恢复上次编辑状态，请开始新文档");
    } finally {
      setIsRestoringState(false);
    }
  };

  // 新建文档处理函数
  const handleNewDocument = () => {
    setShowRestorePrompt(false);
    // 重置到默认状态
    setMetadata(DEFAULT_METADATA);
    setChapters([DEFAULT_CHAPTER]);
    setActiveChapterId(DEFAULT_CHAPTER.id);
    setViewMode('split');
    setSidebarOpen(true);
    setMemoOpen(false);
    setTheme('light');
    setSidebarWidth(256);
    setEditorWidthPercent(50);
    setPreviewConfig(DEFAULT_PREVIEW_CONFIG);
    
    // 清除缓存
    cacheService.clearCache().catch(error => {
      console.error('清除缓存时出错:', error);
    });
    
    showToast("已创建新文档", "success");
  };

  const isDark = theme === 'dark';

  // 使用应用缓存Hook
  const { isRestoring, lastSaveTime, saveAppState, clearCache, restoreAppState: restoreState } = useAppCache({
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
    autoRestore: false // 禁用自动恢复，我们将在恢复提示框中手动触发
  });

  // Calculate Styles for Split View
  const sidebarStyle = { width: sidebarOpen ? (window.innerWidth < 768 ? '18rem' : `${sidebarWidth}px`) : '0px' };
  const editorStyle = viewMode === 'split' ? { width: `${editorWidthPercent}%` } : { width: '100%' };
  const previewStyle = viewMode === 'split' ? { width: `${100 - editorWidthPercent}%` } : { width: '100%' };

  return (
    <div className={`h-[100dvh] w-full flex flex-col overflow-hidden transition-colors duration-300 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-gray-50 text-slate-900'}`}>
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* 恢复提示框 */}
      {restoreChecked && (
        <RestorePrompt
          isVisible={showRestorePrompt}
          hasValidState={hasRestorableState}
          onRestore={handleRestoreState}
          onNewDocument={handleNewDocument}
          isRestoring={isRestoringState}
          restoreError={restoreError}
        />
      )}
      <input type="file" ref={fileInputRef} onChange={handleImportEpub} accept=".epub" className="hidden" />
      <input type="file" ref={imageInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

      {/* Top Bar */}
      <header className={`h-14 flex-none flex items-center justify-between px-3 sm:px-4 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} shadow-sm z-30`}>
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 rounded-md transition ${isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-black/5 text-gray-600'}`}><Menu size={20} /></button>
          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
            <BookOpen size={24} className="hidden xs:block" />
            <h1 className="font-bold text-lg font-serif tracking-tight">ZenPub <span className="text-[10px] uppercase font-sans font-medium opacity-50 ml-0.5 tracking-wider bg-indigo-100 dark:bg-indigo-900/50 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-300">v2.3.0</span></h1>
            {isRestoring && (
              <div className="flex items-center ml-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs ml-1 text-gray-500 dark:text-gray-400">恢复中...</span>
              </div>
            )}
            {lastSaveTime && !isRestoring && (
              <div className="flex items-center ml-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-xs ml-1 text-gray-500 dark:text-gray-400">已保存</span>
              </div>
            )}
          </div>
        </div>
        <div className={`hidden sm:flex rounded-lg p-1 mx-2 ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
          <button onClick={() => setViewMode('editor')} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'editor' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>编辑</button>
          <button onClick={() => setViewMode('split')} className={`hidden md:block px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'split' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>分屏</button>
          <button onClick={() => setViewMode('preview')} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'preview' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>预览</button>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2 relative">
          <button onClick={() => setViewMode(v => v === 'editor' ? 'preview' : 'editor')} className={`sm:hidden p-2 rounded-full transition ${viewMode === 'preview' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500'}`}>{viewMode === 'editor' ? <BookOpen size={20} /> : <Edit3 size={20} />}</button>
          <button onClick={() => setShowHelpModal(true)} className={`p-2 rounded-full transition ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-black/5 text-gray-500'}`}><HelpCircle size={20} /></button>
          <button onClick={() => setShowSettingsModal(true)} className={`p-2 rounded-full transition ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-black/5 text-gray-500'}`}><Settings size={20} /></button>
          <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} className={`p-2 rounded-full transition ${isDark ? 'hover:bg-white/10 text-yellow-400' : 'hover:bg-black/5 text-slate-600'}`}>{isDark ? '🌙' : '☀️'}</button>
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="flex items-center space-x-1 sm:space-x-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition shadow-sm ring-offset-2 focus:ring-2 ring-indigo-500"><Download size={16} /><span className="hidden sm:inline">导出</span></button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg z-20 ring-1 ring-black ring-opacity-5 py-1 ${isDark ? 'bg-slate-800 ring-slate-700' : 'bg-white'}`}>
                  <button onClick={() => handleExport('epub')} className={`w-full text-left px-4 py-2 text-sm flex items-center ${isDark ? 'hover:bg-slate-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'}`}><BookOpen size={14} className="mr-2"/> EPUB 电子书</button>
                  <button onClick={() => handleExport('pdf')} className={`w-full text-left px-4 py-2 text-sm flex items-center ${isDark ? 'hover:bg-slate-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'}`}><FileIcon size={14} className="mr-2"/> PDF 文档 (A4)</button>
                  <button onClick={() => handleExport('md')} className={`w-full text-left px-4 py-2 text-sm flex items-center ${isDark ? 'hover:bg-slate-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'}`}><FileDown size={14} className="mr-2"/> Markdown 源码</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Sidebar */}
        <div className={`flex-none flex flex-col h-full bg-white dark:bg-slate-900 border-r ${isDark ? 'border-slate-700' : 'border-gray-200'} ${!sidebarOpen && 'hidden'}`} style={{ width: window.innerWidth >= 768 ? sidebarWidth : '18rem', position: window.innerWidth < 768 ? 'absolute' : 'relative', zIndex: 40 }}>
          <div className="p-3 flex justify-between items-center border-b border-dashed border-gray-200 dark:border-slate-700">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">目录</h2>
              <div className="flex space-x-1">
                 <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600 dark:hover:bg-indigo-900/30 dark:text-indigo-400 transition flex items-center text-xs font-medium"><Upload size={14} className="mr-1"/>导入</button>
                 <button onClick={addChapter} className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600 dark:hover:bg-indigo-900/30 dark:text-indigo-400 transition"><Plus size={16} /></button>
              </div>
            </div>
            
            {/* Search Bar */}
            <div className={`px-3 pb-3 border-b border-dashed ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
               <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
                  <input 
                     type="text" 
                     value={chapterSearchQuery}
                     onChange={(e) => setChapterSearchQuery(e.target.value)}
                     placeholder="搜索章节..."
                     className={`w-full pl-8 pr-7 py-1.5 text-xs rounded-md border outline-none transition-colors ${isDark ? 'bg-slate-800 border-slate-700 focus:border-indigo-500 text-gray-200 placeholder-gray-500' : 'bg-gray-50 border-gray-200 focus:border-indigo-500 text-gray-700'}`}
                  />
                  {chapterSearchQuery && (
                    <button onClick={() => setChapterSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X size={12} />
                    </button>
                  )}
               </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {filteredChapters.length === 0 && (
                 <div className="text-center text-gray-400 text-xs py-4">未找到匹配章节</div>
              )}
              {filteredChapters.map((chapter, idx) => (
                <div 
                  key={chapter.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx, chapter.id)}
                  onDragEnter={(e) => handleDragEnter(e, idx)}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  onClick={() => { setActiveChapterId(chapter.id); if (window.innerWidth < 768) setSidebarOpen(false); }} 
                  className={`group relative flex items-center px-4 py-3 cursor-pointer text-sm border-l-4 transition-colors ${
                    activeChapterId === chapter.id 
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100 font-medium' 
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'
                  } ${
                    draggedItem?.index === idx ? 'opacity-50' : ''
                  } ${
                    dragOverIndex === idx ? 'bg-indigo-100 dark:bg-indigo-900/40' : ''
                  }`}
                  style={{ cursor: draggedItem ? 'grabbing' : 'grab' }}
                >
                  <span className="w-6 text-xs text-gray-400 dark:text-gray-600 font-mono mr-2">{idx + 1}.</span>
                  <span className="truncate flex-1 py-1">
                    <HighlightedText text={chapter.title} highlight={chapterSearchQuery} />
                  </span>
                  <button 
                    onClick={(e) => deleteChapter(chapter.id, e)} 
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-all absolute right-2"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div onClick={() => setShowSettingsModal(true)} className={`p-4 border-t cursor-pointer transition-colors ${isDark ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-gray-100 bg-gray-100 hover:bg-gray-100'}`}>
               <div className="flex items-center space-x-3">
                  <div className={`w-10 h-14 shadow-sm flex-none bg-white dark:bg-slate-700 border dark:border-slate-600 flex items-center justify-center overflow-hidden rounded-sm`}>{metadata.coverData ? <img src={metadata.coverData} className="w-full h-full object-cover"/> : <BookOpen size={16} className="text-gray-300"/>}</div>
                  <div className="flex-1 min-w-0"><div className="text-sm font-bold truncate text-gray-800 dark:text-gray-200">{metadata.title || '无标题'}</div><div className="text-xs text-gray-500 truncate">{metadata.author || '未设置作者'}</div></div>
               </div>
               <div className="mt-3 flex justify-between text-[10px] text-gray-400 font-mono"><span>本章: {wordCounts.current}</span><span>全书: {wordCounts.total}</span></div>
            </div>
        </div>

        {/* Sidebar Resizer */}
        {sidebarOpen && window.innerWidth >= 768 && <Resizer onMouseDown={startResizingSidebar} />}
        
        {sidebarOpen && window.innerWidth < 768 && <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-35 md:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Editor & Preview Container */}
        <div className="flex-1 flex overflow-hidden bg-gray-100 dark:bg-black/20 relative" ref={containerRef}>
          {/* Editor */}
          <div className={`flex flex-col h-full overflow-hidden transition-all duration-0 relative ${viewMode === 'preview' ? 'hidden' : 'flex'} bg-white dark:bg-slate-900`} style={editorStyle}>
            <div className={`h-12 flex-none flex items-center justify-between px-2 sm:px-4 border-b space-x-2 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
               <div className="flex items-center flex-1 overflow-x-auto no-scrollbar space-x-1 pr-2">
                  <button onClick={handleUndo} disabled={historyPtr <= 0} className={`p-1.5 rounded transition ${historyPtr > 0 ? (isDark ? 'hover:bg-slate-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600') : 'opacity-30 cursor-not-allowed text-gray-400'}`} title="撤销 (Ctrl+Z)"><Undo size={16}/></button>
                  <button onClick={handleRedo} disabled={historyPtr >= history.length - 1} className={`p-1.5 rounded transition ${historyPtr < history.length - 1 ? (isDark ? 'hover:bg-slate-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600') : 'opacity-30 cursor-not-allowed text-gray-400'}`} title="重做 (Ctrl+Y)"><Redo size={16}/></button>
                  <div className="w-px h-4 bg-gray-200 dark:bg-slate-600 mx-1 flex-none"></div>
                  <button onClick={() => insertSyntax('**', '**')} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title="加粗 (Ctrl+B)"><Bold size={16}/></button>
                  <button onClick={() => insertSyntax('*', '*')} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title="斜体 (Ctrl+I)"><Italic size={16}/></button>
                  <div className="w-px h-4 bg-gray-200 dark:bg-slate-600 mx-1 flex-none"></div>
                  <button onClick={() => insertSyntax('# ')} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title="标题1 (Ctrl+1)"><Heading1 size={16}/></button>
                  <button onClick={() => insertSyntax('## ')} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title="标题2 (Ctrl+2)"><Heading2 size={16}/></button>
                  <button onClick={() => insertSyntax('### ')} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title="标题3 (Ctrl+3)"><Heading3 size={16}/></button>
                  <div className="w-px h-4 bg-gray-200 dark:bg-slate-600 mx-1 flex-none"></div>
                  <button onClick={() => insertSyntax('- ')} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title="列表"><List size={16}/></button>
                  <button onClick={() => insertSyntax('> ')} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title="引用"><Quote size={16}/></button>
                  <button onClick={() => insertSyntax('\n---\n')} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title="分割线"><Minus size={16}/></button>
                  <div className="w-px h-4 bg-gray-200 dark:bg-slate-600 mx-1 flex-none"></div>
                  <button onClick={handleInsertLink} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title="插入链接 (Ctrl+K)"><Link size={16}/></button>
                  <button onClick={handleInsertImage} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`}><ImageIcon size={16}/></button>
                  <button onClick={() => setShowSearchPanel(!showSearchPanel)} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'} ${showSearchPanel ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600' : ''}`} title="查找替换 (Ctrl+F)"><SearchIcon size={16}/></button>
               </div>
               <div className="flex items-center space-x-2 pl-2 border-l dark:border-slate-700 flex-none">
                  <button onClick={() => setIsTypewriterMode(!isTypewriterMode)} className={`p-2 rounded transition ${isTypewriterMode ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`} title="打字机模式"><AlignVerticalJustifyCenter size={18} /></button>
                  <button onClick={() => setMemoOpen(!memoOpen)} className={`p-2 rounded transition relative ${memoOpen ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' : 'hover:bg-gray-100 text-gray-400 dark:hover:bg-slate-700'}`}><StickyNote size={18}/>{activeChapter.memo && activeChapter.memo.trim().length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-800"></span>}</button>
               </div>
            </div>

            {/* Search Panel */}
            {showSearchPanel && (
              <div className={`flex-none px-4 py-2 border-b flex items-center space-x-2 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                 <div className="flex items-center border rounded px-2 py-1 bg-white dark:bg-slate-700 dark:border-slate-600">
                    <SearchIcon size={14} className="text-gray-400 mr-2"/>
                    <input type="text" value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="查找..." className="outline-none bg-transparent text-sm w-32 text-gray-800 dark:text-white"/>
                 </div>
                 <div className="flex items-center border rounded px-2 py-1 bg-white dark:bg-slate-700 dark:border-slate-600">
                    <Replace size={14} className="text-gray-400 mr-2"/>
                    <input type="text" value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="替换为..." className="outline-none bg-transparent text-sm w-32 text-gray-800 dark:text-white"/>
                 </div>
                 <div className="flex items-center space-x-1">
                    <button onClick={handleFindPrev} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded"><ArrowUp size={14}/></button>
                    <button onClick={handleFindNext} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded"><ArrowDown size={14}/></button>
                 </div>
                 <span className="text-xs text-gray-400 w-16 text-center">{matchCount > 0 ? `${currentMatchIndex + 1}/${matchCount}` : '0/0'}</span>
                 <button onClick={handleReplace} className="text-xs px-2 py-1 bg-white border rounded hover:bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white">替换</button>
                 <button onClick={handleReplaceAll} className="text-xs px-2 py-1 bg-white border rounded hover:bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white">全部替换</button>
                 <button onClick={() => setShowSearchPanel(false)} className="ml-auto text-gray-400 hover:text-red-500"><XCircle size={16}/></button>
              </div>
            )}

            <div className={`flex-none px-4 sm:px-6 pt-6 pb-2 ${isDark ? 'bg-slate-900' : 'bg-white'}`}><input type="text" value={activeChapter.title} onChange={(e) => handleUpdateTitle(e.target.value)} className={`w-full text-2xl font-bold bg-transparent border-none focus:ring-0 placeholder-gray-300 dark:placeholder-slate-700 p-0 ${isDark ? 'text-white' : 'text-gray-900'}`} placeholder="输入章节标题..." /></div>
            <textarea ref={editorRef} className={`flex-1 w-full px-4 sm:px-6 py-4 resize-none outline-none font-mono text-base sm:text-sm leading-7 custom-scrollbar ${isDark ? 'bg-slate-900 text-slate-300 selection:bg-indigo-500/30' : 'bg-white text-slate-700 selection:bg-indigo-100'}`} value={activeChapter.content} onChange={(e) => handleContentInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="在此处开始您的创作..." spellCheck={false} />
          </div>
          
          {/* Editor/Preview Resizer */}
          {viewMode === 'split' && window.innerWidth >= 768 && <Resizer onMouseDown={startResizingEditor} />}

          {/* Memo Panel */}
          <div className={`absolute top-0 right-0 bottom-0 z-40 w-72 transform transition-transform duration-300 border-l shadow-xl ${memoOpen ? 'translate-x-0' : 'translate-x-full'} ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-yellow-50 border-yellow-200'}`}>
             <div className="flex flex-col h-full bg-[#fdfbf7] dark:bg-slate-800">
                <div className={`p-3 border-b flex justify-between items-center ${isDark ? 'border-slate-700' : 'border-yellow-200/50 bg-yellow-100/50'}`}><h3 className={`text-xs font-bold uppercase flex items-center ${isDark ? 'text-yellow-500' : 'text-yellow-700'}`}><StickyNote size={14} className="mr-2"/> 章节备注</h3><button onClick={() => setMemoOpen(false)} className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 ${isDark ? 'text-slate-400' : 'text-yellow-700/50'}`}><X size={16}/></button></div>
                <textarea className={`flex-1 p-4 resize-none outline-none text-sm leading-6 bg-transparent custom-scrollbar ${isDark ? 'text-slate-200 placeholder-slate-600' : 'text-gray-700 placeholder-yellow-700/30'}`} placeholder="在此处记录本章大纲、灵感等..." value={activeChapter.memo || ''} onChange={(e) => handleUpdateMemo(e.target.value)}/>
             </div>
          </div>

          {/* Preview */}
          <div className={`flex-col h-full overflow-hidden transition-all duration-0 shadow-inner ${viewMode === 'editor' ? 'hidden' : 'flex'} bg-[#f8f5f1] dark:bg-[#151515] ${viewMode === 'split' ? 'border-l dark:border-slate-700' : ''}`} style={previewStyle}>
             <div className={`h-12 flex-none flex items-center justify-between px-4 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-[#f0ede9] border-[#e5e2de]'}`}>
               <div className="flex items-center space-x-1">
                 <button onClick={() => setPreviewConfig({...previewConfig, viewMode: 'mobile'})} className={`p-1.5 rounded ${previewConfig.viewMode === 'mobile' ? (isDark ? 'bg-white/10' : 'bg-black/5') : ''}`} title="手机视图"><Smartphone size={16} className="text-gray-500"/></button>
                 <button onClick={() => setPreviewConfig({...previewConfig, viewMode: 'desktop'})} className={`p-1.5 rounded ${previewConfig.viewMode === 'desktop' ? (isDark ? 'bg-white/10' : 'bg-black/5') : ''}`} title="电脑视图"><Monitor size={16} className="text-gray-500"/></button>
                 <button onClick={() => setPreviewConfig({...previewConfig, viewMode: 'a4'})} className={`p-1.5 rounded ${previewConfig.viewMode === 'a4' ? (isDark ? 'bg-white/10' : 'bg-black/5') : ''}`} title="A4 打印"><FileIcon size={16} className="text-gray-500"/></button>
               </div>
               <div className="flex items-center space-x-2">
                  <button onClick={() => setPreviewConfig(p => ({...p, fontSize: Math.max(12, p.fontSize - 1)}))} className="text-gray-400 hover:text-gray-600"><Minus size={12}/></button>
                  <span className="text-xs text-gray-500 font-mono w-4 text-center">{previewConfig.fontSize}</span>
                  <button onClick={() => setPreviewConfig(p => ({...p, fontSize: Math.min(24, p.fontSize + 1)}))} className="text-gray-400 hover:text-gray-600"><Plus size={12}/></button>
               </div>
               <button onClick={() => setViewMode('editor')} className="sm:hidden p-2 text-gray-500 hover:text-red-500 transition"><X size={18} /></button>
             </div>
             
             <div ref={previewRef} className="flex-1 overflow-y-auto custom-scrollbar bg-gray-100 dark:bg-black/30">
               <div className="preview-container-wrapper">
                 <div 
                    className={`
                      transition-all duration-300
                      ${previewConfig.viewMode === 'mobile' ? 'preview-mobile' : ''}
                      ${previewConfig.viewMode === 'a4' ? 'preview-a4' : ''}
                      ${previewConfig.viewMode === 'desktop' ? 'preview-desktop' : ''}
                    `}
                    style={{
                      fontSize: `${previewConfig.fontSize}px`,
                      lineHeight: previewConfig.lineHeight
                    }}
                 >
                   <h1 className={`font-serif text-3xl md:text-4xl mb-12 text-center font-bold pb-4 border-b ${isDark && previewConfig.viewMode === 'desktop' ? 'border-white/10 text-gray-100' : 'border-black/5 text-gray-900'}`}>{activeChapter.title}</h1>
                   <div className={`prose prose-lg ${isDark && previewConfig.viewMode === 'desktop' ? 'prose-invert' : 'prose-slate'} font-serif max-w-none`}>
                     <ReactMarkdown remarkPlugins={[remarkGfm]} components={{p: ({node, ...props}) => <p className="mb-6 text-justify" style={{textIndent: `${previewConfig.indent}em`}} {...props} />, h1: ({node, ...props}) => <h1 className="font-sans font-bold text-2xl mt-8 mb-4 text-center" {...props} />, blockquote: ({node, ...props}) => <blockquote className="not-italic border-l-4 border-gray-300 pl-4 py-1 my-6 text-gray-500 bg-gray-50 dark:bg-white/5 dark:border-gray-600 pr-2" {...props} />}}>{activeChapter.content}</ReactMarkdown>
                   </div>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      {/* ... (Keep existing modals) ... */}
      {showSnapshotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
             <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
               <h3 className="font-bold text-lg flex items-center"><History size={20} className="mr-2 text-orange-500"/> 本地时光机</h3>
               <button onClick={() => setShowSnapshotModal(false)}><X size={20} className="text-gray-400" /></button>
             </div>
             <div className="max-h-[60vh] overflow-y-auto p-2">
               {snapshots.length === 0 && <div className="p-4 text-center text-gray-500 text-sm">暂无历史快照</div>}
               {snapshots.map(snap => (
                 <div key={snap.id} className={`p-3 border-b last:border-0 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-slate-700/50 dark:border-slate-700`}>
                    <div>
                       <div className="text-xs font-bold text-gray-500 flex items-center"><Clock size={12} className="mr-1"/> {new Date(snap.timestamp).toLocaleString()}</div>
                       <div className="text-sm font-medium mt-1">{snap.description}</div>
                       <div className="text-xs text-gray-400 mt-0.5 truncate w-48">{snap.content.substring(0, 30)}...</div>
                    </div>
                    <button onClick={() => restoreSnapshot(snap)} className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300">恢复</button>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden transform transition-all ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className="p-5 border-b dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
              <h3 className="font-bold text-lg flex items-center"><Settings size={20} className="mr-2 text-indigo-500"/> 书籍信息</h3>
              <button onClick={() => setShowSettingsModal(false)} className="hover:bg-gray-200 dark:hover:bg-slate-700 p-1 rounded-full transition"><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
               <div className="grid grid-cols-2 gap-5">
                 <div className="col-span-2 sm:col-span-1 space-y-1.5"><label className="block text-xs font-bold text-gray-500 uppercase">书名</label><input type="text" value={metadata.title} onChange={(e) => setMetadata({...metadata, title: e.target.value})} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition ${isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-gray-300'}`} /></div>
                 <div className="col-span-2 sm:col-span-1 space-y-1.5"><label className="block text-xs font-bold text-gray-500 uppercase">作者</label><input type="text" value={metadata.author} onChange={(e) => setMetadata({...metadata, author: e.target.value})} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition ${isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-gray-300'}`} /></div>
                 <div className="col-span-2 space-y-1.5"><label className="block text-xs font-bold text-gray-500 uppercase">出版社</label><input type="text" value={metadata.publisher || ''} onChange={(e) => setMetadata({...metadata, publisher: e.target.value})} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition ${isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-gray-300'}`} /></div>
                 <div className="col-span-2 sm:col-span-1 space-y-1.5"><label className="block text-xs font-bold text-gray-500 uppercase">ISBN</label><input type="text" value={metadata.isbn || ''} onChange={(e) => setMetadata({...metadata, isbn: e.target.value})} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition ${isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-gray-300'}`} /></div>
                 <div className="col-span-2 space-y-1.5"><label className="block text-xs font-bold text-gray-500 uppercase">标签 (逗号分隔)</label><input type="text" value={metadata.tags?.join(', ') || ''} onChange={(e) => setMetadata({...metadata, tags: e.target.value.split(',').map(t => t.trim())})} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition ${isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-gray-300'}`} /></div>
                 <div className="col-span-2 space-y-1.5"><label className="block text-xs font-bold text-gray-500 uppercase">简介</label><textarea value={metadata.description || ''} onChange={(e) => setMetadata({...metadata, description: e.target.value})} className={`w-full px-3 py-2 border rounded-lg h-24 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-none ${isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-gray-300'}`} /></div>
                 <div className="col-span-2 pt-2 border-t border-dashed dark:border-slate-700"><label className="block text-xs font-bold text-gray-500 uppercase mb-3">封面设计</label><div className="flex items-start space-x-5"><div className={`w-28 h-40 flex-none rounded-lg shadow-md flex items-center justify-center overflow-hidden border-2 border-dashed ${metadata.coverData ? 'border-transparent' : 'border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700'}`}>{metadata.coverData ? <img src={metadata.coverData} alt="Cover" className="w-full h-full object-cover" /> : <ImageIcon className="text-gray-400" size={32} />}</div><div className="flex-1 space-y-3"><label className="inline-block"><span className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 text-sm font-medium py-2 px-4 rounded-lg cursor-pointer transition shadow-sm">选择图片...</span><input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden"/></label><p className="text-xs text-gray-500 leading-relaxed">建议比例 1:1.5 (例如 1600x2400 像素)。<br/>支持 JPG, PNG 格式，最大 2MB。</p>{metadata.coverData && (<button onClick={() => setMetadata({...metadata, coverData: undefined, coverMimeType: undefined})} className="text-xs text-red-500 hover:underline">移除封面</button>)}</div></div></div>
               </div>
            </div>
            <div className={`p-4 border-t ${isDark ? 'border-slate-700 bg-slate-800' : 'bg-gray-50'} flex justify-between items-center`}>
              <div className="flex items-center space-x-3">
                <button onClick={handleResetApp} className="text-red-500 text-xs font-bold flex items-center hover:underline"><RotateCcw size={14} className="mr-1"/> 重置应用</button>
                <button onClick={clearCache} className="text-orange-500 text-xs font-bold flex items-center hover:underline"><FileDown size={14} className="mr-1"/> 清理缓存</button>
              </div>
              <div className="flex items-center space-x-4">
                <button onClick={() => { setShowSnapshotModal(true); setShowSettingsModal(false); }} className="text-indigo-500 text-xs font-bold flex items-center hover:underline"><History size={14} className="mr-1"/> 历史版本</button>
                <button onClick={() => setShowSettingsModal(false)} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition transform active:scale-95">保存设置</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
             <div className="p-5 border-b dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
               <h3 className="font-bold text-lg flex items-center"><HelpCircle size={20} className="mr-2 text-indigo-500"/> 使用指南</h3>
               <button onClick={() => setShowHelpModal(false)} className="hover:bg-gray-200 dark:hover:bg-slate-700 p-1 rounded-full transition"><X size={20} className="text-gray-400" /></button>
             </div>
             <div className="p-8 overflow-y-auto max-h-[60vh] custom-scrollbar">
               <div className={`prose prose-sm ${isDark ? 'prose-invert' : 'prose-indigo'}`}><ReactMarkdown>{HELP_CONTENT}</ReactMarkdown></div>
             </div>
             <div className={`p-4 border-t text-center text-xs text-gray-400 ${isDark ? 'border-slate-700' : 'bg-gray-50'}`}>ZenPub v2.2.1 &copy; 2024</div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
