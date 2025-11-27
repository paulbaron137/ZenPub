import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Menu, BookOpen, Settings, Download, Plus, Trash2, 
  ChevronLeft, ChevronRight, PenTool, Edit3, Save, 
  MoreVertical, FileText, Wand2, X, Image as ImageIcon,
  Search, HelpCircle, Globe, ExternalLink, CheckCircle, AlertCircle,
  Bold, Italic, Heading1, Heading2, List, Quote, Link, Minus, 
  MessageSquare, StickyNote, Type, Undo, Redo, AlignVerticalJustifyCenter,
  Smartphone, Monitor, File as FileIcon, History, Clock, Upload, FileDown, RotateCcw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookMetadata, Chapter, ViewMode, AIState, SearchResult, Snapshot, PreviewConfig } from './types';
import { exportToEpub, exportToMarkdown, exportToPdf, importEpub } from './services/epubService';
import { generateWritingSuggestion, performResearch } from './services/geminiService';

// --- Constants & Defaults ---

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
## Markdown 写作指南
- **加粗**: \`**文本**\`
- *斜体*: \`*文本*\`
- 标题: \`# 标题1\`, \`## 标题2\`
- 列表: \`- 项目\`
- 引用: \`> 引用\`
- 代码块: \`\`\`代码\`\`\`
- 脚注: \`[^1]\` 和 \`[^1]: 说明\`
- 图片: \`![描述](链接)\`

## v2.0.3 新特性
- **自动保存**: 内容变更自动存入快照。
- **图片插入**: 支持上传本地图片或输入网络链接。
- **链接优化**: 更智能的链接插入交互。
`;

// --- Components ---

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => (
  <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 z-[70] animate-fade-in-up ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'}`}>
    {type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
    <span className="text-sm font-medium">{message}</span>
  </div>
);

const App: React.FC = () => {
  // --- State ---
  const [metadata, setMetadata] = useState<BookMetadata>(DEFAULT_METADATA);
  const [chapters, setChapters] = useState<Chapter[]>([DEFAULT_CHAPTER]);
  const [activeChapterId, setActiveChapterId] = useState<string>('1');
  const [viewMode, setViewMode] = useState<ViewMode>('split'); 
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [memoOpen, setMemoOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Feature States
  const [isTypewriterMode, setIsTypewriterMode] = useState(false);
  const [previewConfig, setPreviewConfig] = useState<PreviewConfig>(DEFAULT_PREVIEW_CONFIG);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Undo/Redo
  const [history, setHistory] = useState<string[]>([]);
  const [historyPtr, setHistoryPtr] = useState(-1);
  const historyTimeoutRef = useRef<number | null>(null);
  const snapshotTimeoutRef = useRef<number | null>(null);

  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTab, setAiTab] = useState<'write' | 'research'>('write');

  // AI State
  const [aiState, setAiState] = useState<AIState>({
    isLoading: false,
    error: null,
    suggestion: null,
    searchResults: []
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Toast State
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);

  // Refs
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null); // New ref for inline image upload

  // --- Derived State ---
  const activeChapter = chapters.find(c => c.id === activeChapterId) || chapters[0];
  
  // Word Count
  const wordCounts = useMemo(() => {
    const currentText = activeChapter.content.replace(/[#*>\-`\[\]\(\)\n]/g, '');
    const currentCount = currentText.length;
    const totalCount = chapters.reduce((acc, curr) => acc + curr.content.replace(/[#*>\-`\[\]\(\)\n]/g, '').length, 0);
    return { current: currentCount, total: totalCount };
  }, [activeChapter.content, chapters]);

  // --- Effects ---
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

  // --- Handlers ---

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const updateChapterContent = (newContent: string) => {
     setChapters(prev => prev.map(c => 
      c.id === activeChapterId ? { ...c, content: newContent } : c
    ));
  };

  // Main input handler with debounce for history and snapshots
  const handleContentInput = (newContent: string) => {
    updateChapterContent(newContent);

    // Typewriter Scrolling Logic
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

    // Debounce history
    if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
    historyTimeoutRef.current = window.setTimeout(() => {
      setHistory(prev => {
        const newHistory = prev.slice(0, historyPtr + 1);
        newHistory.push(newContent);
        return newHistory;
      });
      setHistoryPtr(prev => prev + 1);
    }, 600);

    // Snapshot Timer (Auto-save logic)
    if (snapshotTimeoutRef.current) clearTimeout(snapshotTimeoutRef.current);
    snapshotTimeoutRef.current = window.setTimeout(() => {
        createSnapshot(newContent, "自动保存");
    }, 2 * 60 * 1000); // Changed to 2 mins for better auto-save
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
      if (desc !== "自动保存") showToast("快照已保存");
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      handleRedo();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      createSnapshot(activeChapter.content, "手动保存");
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

  // Enhanced Syntax Insertion
  const insertSyntax = (prefix: string, suffix: string = '') => {
    if (!editorRef.current) return;
    const textarea = editorRef.current;
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
      if (selection.length > 0) {
           editorRef.current.setSelectionRange(start, start + prefix.length + selection.length + suffix.length);
      } else {
           editorRef.current.setSelectionRange(start + prefix.length, start + prefix.length);
      }
    }, 0);
  };

  const handleInsertLink = () => {
    const url = prompt("请输入链接地址 (URL):", "https://");
    if (url) {
      if (!editorRef.current) return;
      const textarea = editorRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selection = textarea.value.substring(start, end);
      const linkText = selection || prompt("请输入链接文本:", "链接") || "链接";
      
      const markdownLink = `[${linkText}](${url})`;
      const newText = textarea.value.substring(0, start) + markdownLink + textarea.value.substring(end);
      handleContentInput(newText); // Use main handler for history/debounce
      
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.focus();
          editorRef.current.setSelectionRange(start + markdownLink.length, start + markdownLink.length);
        }
      }, 0);
    }
  };

  const handleInsertImage = () => {
    // Option to upload or URL
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
           // Creating a concise reference if possible, but base64 inline is standard for simple tools
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
      showToast("导入成功！", "success");
    }).catch(err => {
      console.error(err);
      showToast("EPUB 格式不支持或损坏", "error");
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // AI Helpers
  const handleAiAssist = async (task: any) => {
    if (!editorRef.current) return;
    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const context = selectedText.length > 2 ? selectedText : textarea.value; 

    setAiState(prev => ({ ...prev, isLoading: true, error: null, suggestion: null }));
    
    try {
      const suggestion = await generateWritingSuggestion("Help me write", context, task);
      setAiState(prev => ({ ...prev, isLoading: false, error: null, suggestion }));
    } catch (err) {
      setAiState(prev => ({ ...prev, isLoading: false, error: "AI 服务暂时不可用", suggestion: null }));
    }
  };

  const handleAiSearch = async () => {
    if (!searchQuery.trim()) return;
    setAiState(prev => ({ ...prev, isLoading: true, error: null, searchResults: undefined }));
    try {
      const result = await performResearch(searchQuery);
      setAiState(prev => ({ 
        ...prev, 
        isLoading: false, 
        suggestion: result.text, 
        searchResults: result.sources.length > 0 ? result.sources : undefined 
      }));
    } catch (err) {
      setAiState(prev => ({ ...prev, isLoading: false, error: "搜索失败，请检查网络", suggestion: null }));
    }
  };

  const applyAiSuggestion = () => {
    if (!aiState.suggestion || !editorRef.current) return;
    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const currentContent = activeChapter.content;
    const selectedText = currentContent.substring(start, end);
    
    let newContent = "";
    if (selectedText.length > 2) {
      newContent = currentContent.substring(0, start) + aiState.suggestion + currentContent.substring(end);
    } else {
      newContent = currentContent + "\n\n" + aiState.suggestion;
    }

    updateChapterContent(newContent);
    setHistory(prev => {
        const newHistory = prev.slice(0, historyPtr + 1);
        newHistory.push(newContent);
        return newHistory;
      });
    setHistoryPtr(prev => prev + 1);

    setShowAiModal(false);
    setAiState(prev => ({ ...prev, isLoading: false, error: null, suggestion: null }));
    showToast("内容已应用");
  };

  const isDark = theme === 'dark';

  return (
    <div className={`h-[100dvh] w-full flex flex-col overflow-hidden transition-colors duration-300 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-gray-50 text-slate-900'}`}>
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <input type="file" ref={fileInputRef} onChange={handleImportEpub} accept=".epub" className="hidden" />
      <input type="file" ref={imageInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

      {/* Top Bar */}
      <header className={`h-14 flex-none flex items-center justify-between px-3 sm:px-4 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} shadow-sm z-30`}>
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 rounded-md transition ${isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-black/5 text-gray-600'}`}><Menu size={20} /></button>
          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
            <BookOpen size={24} className="hidden xs:block" />
            <h1 className="font-bold text-lg font-serif tracking-tight">ZenPub <span className="text-[10px] uppercase font-sans font-medium opacity-50 ml-0.5 tracking-wider bg-indigo-100 dark:bg-indigo-900/50 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-300">v2.0.3</span></h1>
          </div>
        </div>

        {/* Desktop View Toggle */}
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
          
          {/* Export Dropdown */}
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="flex items-center space-x-1 sm:space-x-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition shadow-sm ring-offset-2 focus:ring-2 ring-indigo-500">
              <Download size={16} /><span className="hidden sm:inline">导出</span>
            </button>
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
        <div className={`fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:w-64 flex-none border-r ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]'} ${!sidebarOpen && 'md:hidden'}`}>
          <div className="flex flex-col h-full bg-white dark:bg-slate-800">
            <div className="p-3 flex justify-between items-center border-b border-dashed border-gray-200 dark:border-slate-700">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">目录</h2>
              <div className="flex space-x-1">
                 <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600 dark:hover:bg-indigo-900/30 dark:text-indigo-400 transition flex items-center text-xs font-medium"><Upload size={14} className="mr-1"/>导入</button>
                 <button onClick={addChapter} className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600 dark:hover:bg-indigo-900/30 dark:text-indigo-400 transition"><Plus size={16} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {chapters.map((chapter, idx) => (
                <div key={chapter.id} onClick={() => { setActiveChapterId(chapter.id); if (window.innerWidth < 768) setSidebarOpen(false); }} className={`group relative flex items-center px-4 py-3 cursor-pointer text-sm border-l-4 transition-colors ${activeChapterId === chapter.id ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100 font-medium' : 'border-transparent hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'}`}>
                  <span className="w-6 text-xs text-gray-400 dark:text-gray-600 font-mono mr-2">{idx + 1}.</span>
                  <span className="truncate flex-1 py-1">{chapter.title}</span>
                  <button onClick={(e) => deleteChapter(chapter.id, e)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-all absolute right-2"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div onClick={() => setShowSettingsModal(true)} className={`p-4 border-t cursor-pointer transition-colors ${isDark ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}>
               <div className="flex items-center space-x-3">
                  <div className={`w-10 h-14 shadow-sm flex-none bg-white dark:bg-slate-700 border dark:border-slate-600 flex items-center justify-center overflow-hidden rounded-sm`}>{metadata.coverData ? <img src={metadata.coverData} className="w-full h-full object-cover"/> : <BookOpen size={16} className="text-gray-300"/>}</div>
                  <div className="flex-1 min-w-0"><div className="text-sm font-bold truncate text-gray-800 dark:text-gray-200">{metadata.title || '无标题'}</div><div className="text-xs text-gray-500 truncate">{metadata.author || '未设置作者'}</div></div>
               </div>
               <div className="mt-3 flex justify-between text-[10px] text-gray-400 font-mono"><span>本章: {wordCounts.current}</span><span>全书: {wordCounts.total}</span></div>
            </div>
          </div>
        </div>
        
        {sidebarOpen && <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-35 md:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Editor & Preview Container */}
        <div className="flex-1 flex overflow-hidden bg-gray-100 dark:bg-black/20 relative">
          {/* Editor */}
          <div className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 relative ${viewMode === 'preview' ? 'hidden' : 'flex'} ${viewMode === 'split' ? 'w-1/2 border-r dark:border-slate-700' : 'w-full'} bg-white dark:bg-slate-900`}>
            <div className={`h-12 flex-none flex items-center justify-between px-2 sm:px-4 border-b space-x-2 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
               <div className="flex items-center flex-1 overflow-x-auto no-scrollbar space-x-1 pr-2">
                  {/* Undo/Redo */}
                  <button onClick={handleUndo} disabled={historyPtr <= 0} className={`p-2 rounded transition ${historyPtr > 0 ? (isDark ? 'hover:bg-slate-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600') : 'opacity-30 cursor-not-allowed text-gray-400'}`}><Undo size={16}/></button>
                  <button onClick={handleRedo} disabled={historyPtr >= history.length - 1} className={`p-2 rounded transition ${historyPtr < history.length - 1 ? (isDark ? 'hover:bg-slate-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600') : 'opacity-30 cursor-not-allowed text-gray-400'}`}><Redo size={16}/></button>
                  <div className="w-px h-4 bg-gray-200 dark:bg-slate-600 mx-1 flex-none"></div>
                  
                  {/* Format */}
                  <button onClick={() => insertSyntax('**', '**')} className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`}><Bold size={16}/></button>
                  <button onClick={() => insertSyntax('*', '*')} className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`}><Italic size={16}/></button>
                  <div className="w-px h-4 bg-gray-200 dark:bg-slate-600 mx-1 flex-none"></div>
                  <button onClick={() => insertSyntax('# ')} className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`}><Heading1 size={16}/></button>
                  <button onClick={() => insertSyntax('## ')} className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`}><Heading2 size={16}/></button>
                  <div className="w-px h-4 bg-gray-200 dark:bg-slate-600 mx-1 flex-none"></div>
                  <button onClick={() => insertSyntax('- ')} className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`}><List size={16}/></button>
                  <button onClick={() => insertSyntax('> ')} className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`}><Quote size={16}/></button>
                  <button onClick={() => insertSyntax('\n---\n')} className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title="分割线"><Minus size={16}/></button>
                  <div className="w-px h-4 bg-gray-200 dark:bg-slate-600 mx-1 flex-none"></div>
                  
                  {/* Link (Optimized) */}
                  <button onClick={handleInsertLink} className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title="插入链接"><Link size={16}/></button>
                  {/* Image (New) */}
                  <button onClick={handleInsertImage} className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title="插入图片"><ImageIcon size={16}/></button>
                  
                  <button onClick={() => insertSyntax('[^1]')} className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition ${isDark ? 'text-gray-300' : 'text-gray-600'} font-mono text-xs`} title="插入脚注">[^1]</button>
               </div>
               
               <div className="flex items-center space-x-2 pl-2 border-l dark:border-slate-700 flex-none">
                  <button onClick={() => setIsTypewriterMode(!isTypewriterMode)} className={`p-2 rounded transition ${isTypewriterMode ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`} title="打字机模式"><AlignVerticalJustifyCenter size={18} /></button>
                  <button onClick={() => setShowAiModal(true)} className="group flex items-center space-x-1.5 text-xs font-medium bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-size-200 bg-pos-0 hover:bg-pos-100 text-white px-2.5 py-1.5 rounded-full transition-all"><Wand2 size={12} className="group-hover:rotate-12 transition-transform" /><span className="hidden xs:inline">AI</span></button>
                  <button onClick={() => setMemoOpen(!memoOpen)} className={`p-2 rounded transition relative ${memoOpen ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' : 'hover:bg-gray-100 text-gray-400 dark:hover:bg-slate-700'}`}><StickyNote size={18}/>{activeChapter.memo && activeChapter.memo.trim().length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-800"></span>}</button>
               </div>
            </div>
            <div className={`flex-none px-4 sm:px-6 pt-6 pb-2 ${isDark ? 'bg-slate-900' : 'bg-white'}`}><input type="text" value={activeChapter.title} onChange={(e) => handleUpdateTitle(e.target.value)} className={`w-full text-2xl font-bold bg-transparent border-none focus:ring-0 placeholder-gray-300 dark:placeholder-slate-700 p-0 ${isDark ? 'text-white' : 'text-gray-900'}`} placeholder="输入章节标题..." /></div>
            <textarea ref={editorRef} className={`flex-1 w-full px-4 sm:px-6 py-4 resize-none outline-none font-mono text-base sm:text-sm leading-7 custom-scrollbar ${isDark ? 'bg-slate-900 text-slate-300 selection:bg-indigo-500/30' : 'bg-white text-slate-700 selection:bg-indigo-100'}`} value={activeChapter.content} onChange={(e) => handleContentInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="在此处开始您的创作..." spellCheck={false} />
          </div>

          {/* Memo Panel */}
          <div className={`absolute top-0 right-0 bottom-0 z-40 w-72 transform transition-transform duration-300 border-l shadow-xl ${memoOpen ? 'translate-x-0' : 'translate-x-full'} ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-yellow-50 border-yellow-200'}`}>
             <div className="flex flex-col h-full bg-[#fdfbf7] dark:bg-slate-800">
                <div className={`p-3 border-b flex justify-between items-center ${isDark ? 'border-slate-700' : 'border-yellow-200/50 bg-yellow-100/50'}`}><h3 className={`text-xs font-bold uppercase flex items-center ${isDark ? 'text-yellow-500' : 'text-yellow-700'}`}><StickyNote size={14} className="mr-2"/> 章节备注</h3><button onClick={() => setMemoOpen(false)} className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 ${isDark ? 'text-slate-400' : 'text-yellow-700/50'}`}><X size={16}/></button></div>
                <textarea className={`flex-1 p-4 resize-none outline-none text-sm leading-6 bg-transparent custom-scrollbar ${isDark ? 'text-slate-200 placeholder-slate-600' : 'text-gray-700 placeholder-yellow-700/30'}`} placeholder="在此处记录本章大纲、灵感等..." value={activeChapter.memo || ''} onChange={(e) => handleUpdateMemo(e.target.value)}/>
             </div>
          </div>

          {/* Preview */}
          <div className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 shadow-inner ${viewMode === 'editor' ? 'hidden' : 'flex'} ${viewMode === 'split' ? 'w-1/2' : 'w-full'} bg-[#f8f5f1] dark:bg-[#151515]`}>
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
             
             <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-100 dark:bg-black/30">
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
                 {/* ... Other metadata inputs ... */}
                 <div className="col-span-2 pt-2 border-t border-dashed dark:border-slate-700"><label className="block text-xs font-bold text-gray-500 uppercase mb-3">封面设计</label><div className="flex items-start space-x-5"><div className={`w-28 h-40 flex-none rounded-lg shadow-md flex items-center justify-center overflow-hidden border-2 border-dashed ${metadata.coverData ? 'border-transparent' : 'border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700'}`}>{metadata.coverData ? <img src={metadata.coverData} alt="Cover" className="w-full h-full object-cover" /> : <ImageIcon className="text-gray-400" size={32} />}</div><div className="flex-1 space-y-3"><label className="inline-block"><span className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 text-sm font-medium py-2 px-4 rounded-lg cursor-pointer transition shadow-sm">选择图片...</span><input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden"/></label><p className="text-xs text-gray-500 leading-relaxed">建议比例 1:1.5 (例如 1600x2400 像素)。<br/>支持 JPG, PNG 格式，最大 2MB。</p>{metadata.coverData && (<button onClick={() => setMetadata({...metadata, coverData: undefined, coverMimeType: undefined})} className="text-xs text-red-500 hover:underline">移除封面</button>)}</div></div></div>
               </div>
            </div>
            <div className={`p-4 border-t ${isDark ? 'border-slate-700 bg-slate-800' : 'bg-gray-50'} flex justify-between items-center`}>
              <button onClick={handleResetApp} className="text-red-500 text-xs font-bold flex items-center hover:underline"><RotateCcw size={14} className="mr-1"/> 重置应用</button>
              <div className="flex items-center space-x-4">
                <button onClick={() => setShowSnapshotModal(true)} className="text-indigo-500 text-xs font-bold flex items-center hover:underline"><History size={14} className="mr-1"/> 历史版本</button>
                <button onClick={() => setShowSettingsModal(false)} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition transform active:scale-95">保存设置</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
             <div className={`p-4 border-t text-center text-xs text-gray-400 ${isDark ? 'border-slate-700' : 'bg-gray-50'}`}>ZenPub v2.0.3 &copy; 2024</div>
          </div>
        </div>
      )}
      
      {/* AI Modal - Same as previous */}
       {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center flex-none bg-gray-50/50 dark:bg-white/5">
              <div className="flex space-x-1 bg-gray-200 dark:bg-slate-700 p-1 rounded-lg">
                <button onClick={() => setAiTab('write')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${aiTab === 'write' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'}`}><span className="flex items-center"><Wand2 size={14} className="mr-1.5"/>写作辅助</span></button>
                <button onClick={() => setAiTab('research')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${aiTab === 'research' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'}`}><span className="flex items-center"><Search size={14} className="mr-1.5"/>AI 研究员</span></button>
              </div>
              <button onClick={() => setShowAiModal(false)} className="hover:bg-gray-200 dark:hover:bg-slate-700 p-1 rounded-full transition"><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              {aiTab === 'write' ? (
                 <div className="space-y-6">
                    {!aiState.suggestion ? (
                      <>
                        <div className="text-center py-4"><h4 className="text-lg font-bold mb-2">智能写作助手</h4><p className="text-sm text-gray-500">选中编辑器中的文本，点击下方功能进行优化。</p></div>
                        <div className="grid grid-cols-2 gap-4">
                          {[{id: 'grammar', label: '✍️ 语法修正', sub: '纠正错别字和语病'}, {id: 'expand', label: '✨ 扩写润色', sub: '丰富细节，提升文采'}, {id: 'summarize', label: '📝 总结摘要', sub: '提炼核心观点'}, {id: 'continue', label: '🚀 智能续写', sub: '根据上文继续创作'}].map(opt => (
                            <button key={opt.id} onClick={() => handleAiAssist(opt.id as any)} disabled={aiState.isLoading} className={`p-4 border rounded-xl hover:shadow-md transition text-left group ${isDark ? 'border-slate-700 hover:bg-slate-700' : 'border-gray-200 hover:border-indigo-200 hover:bg-indigo-50'}`}><span className="block font-bold text-gray-800 dark:text-gray-200 mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{opt.label}</span><span className="text-xs text-gray-500 dark:text-gray-400">{opt.sub}</span></button>
                          ))}
                        </div>
                        {aiState.isLoading && <div className="text-center text-sm text-indigo-500 mt-4 animate-pulse">正在思考中...</div>}
                      </>
                    ) : (
                      <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-gray-400 uppercase">AI 建议</span></div>
                        <div className={`p-5 rounded-xl text-sm leading-relaxed max-h-[40vh] overflow-y-auto border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-indigo-50/50 border-indigo-100'}`}><ReactMarkdown>{aiState.suggestion}</ReactMarkdown></div>
                        <div className="flex space-x-3 pt-2"><button onClick={() => setAiState({ ...aiState, suggestion: null })} className={`px-4 py-2 border rounded-lg text-sm font-medium transition ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-gray-300 hover:bg-gray-50'}`}>返回</button><button onClick={applyAiSuggestion} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-500/20">应用采纳</button></div>
                      </div>
                    )}
                 </div>
              ) : (
                <div className="space-y-5 h-full flex flex-col">
                   <div className="flex space-x-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()} placeholder="输入问题..." className={`w-full pl-10 pr-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-gray-50 border-gray-200'}`} /></div><button onClick={handleAiSearch} disabled={aiState.isLoading || !searchQuery.trim()} className="bg-indigo-600 text-white px-5 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition">搜索</button></div>
                   {aiState.isLoading && <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-3"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div><span className="text-sm">正在检索...</span></div>}
                   {!aiState.isLoading && !aiState.suggestion && <div className="flex-1 flex flex-col items-center justify-center text-gray-400 opacity-50"><Globe size={48} className="mb-4 stroke-1"/><p className="text-sm">AI 研究员</p></div>}
                   {aiState.suggestion && <div className="flex-1 overflow-y-auto space-y-4 pr-1 animate-fade-in"><div className={`p-5 rounded-xl text-sm leading-relaxed border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}><ReactMarkdown className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}>{aiState.suggestion}</ReactMarkdown></div>{aiState.searchResults && <div className="space-y-3 pl-1"><h4 className="text-xs font-bold uppercase text-gray-500 flex items-center"><ExternalLink size={12} className="mr-1"/> 参考来源</h4><div className="grid gap-2">{aiState.searchResults.map((source, idx) => (<a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className={`block p-3 rounded-lg text-xs transition border ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-gray-50 border-gray-100 hover:bg-white hover:shadow-sm hover:border-indigo-100'}`}><div className="font-medium text-indigo-500 mb-0.5 truncate">{source.title}</div><div className="text-gray-400 truncate">{source.uri}</div></a>))}</div></div>}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;