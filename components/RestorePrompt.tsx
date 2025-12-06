import React from 'react';
import { RotateCcw, FileText, AlertCircle } from 'lucide-react';

interface RestorePromptProps {
  isVisible: boolean;
  hasValidState: boolean;
  onRestore: () => void;
  onNewDocument: () => void;
  isRestoring?: boolean;
  restoreError?: string | null;
}

const RestorePrompt: React.FC<RestorePromptProps> = ({
  isVisible,
  hasValidState,
  onRestore,
  onNewDocument,
  isRestoring = false,
  restoreError = null
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        {/* 标题区域 */}
        <div className="p-6 pb-4 text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
            {restoreError ? (
              <AlertCircle size={28} className="text-red-500 dark:text-red-400" />
            ) : (
              <FileText size={28} className="text-indigo-600 dark:text-indigo-400" />
            )}
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            欢迎回到 ZenPub
          </h3>
          
          {restoreError ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              恢复上次编辑状态时遇到问题
            </p>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              检测到您有未完成的编辑内容
            </p>
          )}
        </div>

        {/* 内容区域 */}
        <div className="px-6 pb-6">
          {restoreError ? (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">
                {restoreError}
              </p>
            </div>
          ) : hasValidState ? (
            <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
              <div className="flex items-center text-sm text-indigo-800 dark:text-indigo-200">
                <RotateCcw size={16} className="mr-2 flex-shrink-0" />
                <span>是否回到上次编辑状态？</span>
              </div>
              <p className="text-xs text-indigo-600 dark:text-indigo-300 mt-1 ml-6">
                我们将恢复您的编辑位置和上次的工作状态
              </p>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-lg">
              <p className="text-sm text-gray-800 dark:text-gray-200">
                没有可恢复的编辑记录
              </p>
            </div>
          )}

          {/* 按钮区域 */}
          <div className="flex flex-col sm:flex-row gap-3">
            {hasValidState && !restoreError ? (
              <>
                <button
                  onClick={onRestore}
                  disabled={isRestoring}
                  className="flex-1 flex items-center justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-indigo-400 text-white font-medium rounded-lg transition-all duration-200 transform active:scale-[0.98] shadow-lg shadow-indigo-500/25 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isRestoring ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                      恢复中...
                    </>
                  ) : (
                    <>
                      <RotateCcw size={18} className="mr-2" />
                      恢复
                    </>
                  )}
                </button>
                <button
                  onClick={onNewDocument}
                  disabled={isRestoring}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg border border-gray-300 dark:border-slate-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  新建文档
                </button>
              </>
            ) : (
              <button
                onClick={onNewDocument}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium rounded-lg transition-all duration-200 transform active:scale-[0.98] shadow-lg shadow-indigo-500/25"
              >
                开始新文档
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestorePrompt;