// 缓存服务 - 处理用户状态的保存和恢复
import { BookMetadata, Chapter, ViewMode, PreviewConfig } from '../types';

interface UserState {
  lastOpenTime: number;
  activeChapterId: string;
  scrollPosition: {
    editor: number;
    preview: number;
  };
  viewMode: ViewMode;
  sidebarOpen: boolean;
  memoOpen: boolean;
  theme: 'light' | 'dark';
  sidebarWidth: number;
  editorWidthPercent: number;
  previewConfig: PreviewConfig;
}

interface ProjectData {
  metadata: BookMetadata;
  chapters: Chapter[];
  lastModified: number;
}

class CacheService {
  private dbName = 'ZenPubCache';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private readonly storeNames = {
    userState: 'userState',
    projectData: 'projectData',
    fileHistory: 'fileHistory'
  };

  // 初始化IndexedDB
  async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event);
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        console.log('IndexedDB opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建用户状态存储
        if (!db.objectStoreNames.contains(this.storeNames.userState)) {
          const userStateStore = db.createObjectStore(this.storeNames.userState, { keyPath: 'id' });
          userStateStore.createIndex('lastOpenTime', 'lastOpenTime', { unique: false });
        }

        // 创建项目数据存储
        if (!db.objectStoreNames.contains(this.storeNames.projectData)) {
          const projectStore = db.createObjectStore(this.storeNames.projectData, { keyPath: 'id' });
          projectStore.createIndex('lastModified', 'lastModified', { unique: false });
        }

        // 创建文件历史存储
        if (!db.objectStoreNames.contains(this.storeNames.fileHistory)) {
          const historyStore = db.createObjectStore(this.storeNames.fileHistory, { keyPath: 'id', autoIncrement: true });
          historyStore.createIndex('timestamp', 'timestamp', { unique: false });
          historyStore.createIndex('filePath', 'filePath', { unique: false });
        }
      };
    });
  }

  // 保存用户状态
  async saveUserState(state: UserState): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeNames.userState], 'readwrite');
      const store = transaction.objectStore(this.storeNames.userState);

      // 使用固定ID 'current' 来保存当前状态
      const request = store.put({ id: 'current', ...state });

      request.onsuccess = () => {
        console.log('User state saved successfully');
        resolve();
      };

      request.onerror = (event) => {
        console.error('Failed to save user state:', event);
        reject(new Error('Failed to save user state'));
      };
    });
  }

  // 获取用户状态
  async getUserState(): Promise<UserState | null> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeNames.userState], 'readonly');
      const store = transaction.objectStore(this.storeNames.userState);
      const request = store.get('current');

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          console.log('User state retrieved successfully');
          // 移除id字段，只返回实际的状态数据
          const { id, ...state } = result;
          resolve(state);
        } else {
          resolve(null);
        }
      };

      request.onerror = (event) => {
        console.error('Failed to retrieve user state:', event);
        reject(new Error('Failed to retrieve user state'));
      };
    });
  }

  // 保存项目数据
  async saveProjectData(projectData: ProjectData): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeNames.projectData], 'readwrite');
      const store = transaction.objectStore(this.storeNames.projectData);

      // 使用固定ID 'current' 来保存当前项目
      const request = store.put({ id: 'current', ...projectData });

      request.onsuccess = () => {
        console.log('Project data saved successfully');
        resolve();
      };

      request.onerror = (event) => {
        console.error('Failed to save project data:', event);
        reject(new Error('Failed to save project data'));
      };
    });
  }

  // 获取项目数据
  async getProjectData(): Promise<ProjectData | null> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeNames.projectData], 'readonly');
      const store = transaction.objectStore(this.storeNames.projectData);
      const request = store.get('current');

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          console.log('Project data retrieved successfully');
          // 移除id字段，只返回实际的项目数据
          const { id, ...data } = result;
          resolve(data);
        } else {
          resolve(null);
        }
      };

      request.onerror = (event) => {
        console.error('Failed to retrieve project data:', event);
        reject(new Error('Failed to retrieve project data'));
      };
    });
  }

  // 添加文件到历史记录
  async addFileToHistory(filePath: string, lastAccessed: number): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeNames.fileHistory], 'readwrite');
      const store = transaction.objectStore(this.storeNames.fileHistory);

      const request = store.add({
        filePath,
        timestamp: lastAccessed
      });

      request.onsuccess = () => {
        console.log('File added to history successfully');
        resolve();
      };

      request.onerror = (event) => {
        console.error('Failed to add file to history:', event);
        reject(new Error('Failed to add file to history'));
      };
    });
  }

  // 获取文件历史记录
  async getFileHistory(): Promise<Array<{ id: number; filePath: string; timestamp: number }>> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeNames.fileHistory], 'readonly');
      const store = transaction.objectStore(this.storeNames.fileHistory);
      const index = store.index('timestamp');
      const request = index.getAll(); // 按时间戳排序获取所有记录

      request.onsuccess = () => {
        const results = request.result;
        // 按时间戳降序排序（最新的在前）
        results.sort((a, b) => b.timestamp - a.timestamp);
        console.log('File history retrieved successfully');
        resolve(results);
      };

      request.onerror = (event) => {
        console.error('Failed to retrieve file history:', event);
        reject(new Error('Failed to retrieve file history'));
      };
    });
  }

  // 清理缓存
  async clearCache(): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const stores = [
        this.storeNames.userState,
        this.storeNames.projectData,
        this.storeNames.fileHistory
      ];

      const transaction = this.db!.transaction(stores, 'readwrite');
      
      let completed = 0;
      const total = stores.length;

      stores.forEach(storeName => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          console.log(`${storeName} cleared successfully`);
          completed++;
          if (completed === total) {
            console.log('All caches cleared successfully');
            resolve();
          }
        };

        request.onerror = (event) => {
          console.error(`Failed to clear ${storeName}:`, event);
          reject(new Error(`Failed to clear ${storeName}`));
        };
      });
    });
  }

  // 清理旧的文件历史记录（只保留最近的10条）
  async cleanupOldHistory(): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeNames.fileHistory], 'readwrite');
      const store = transaction.objectStore(this.storeNames.fileHistory);
      const index = store.index('timestamp');

      const request = index.getAll();
      request.onsuccess = () => {
        const allEntries = request.result;
        
        // 如果历史记录少于10条，不需要清理
        if (allEntries.length <= 10) {
          resolve();
          return;
        }

        // 按时间戳降序排序，保留最新的10条
        allEntries.sort((a, b) => b.timestamp - a.timestamp);
        const entriesToDelete = allEntries.slice(10);

        // 删除旧记录
        let completed = 0;
        entriesToDelete.forEach(entry => {
          const deleteRequest = store.delete(entry.id);
          
          deleteRequest.onsuccess = () => {
            completed++;
            if (completed === entriesToDelete.length) {
              console.log('Old file history cleaned up successfully');
              resolve();
            }
          };

          deleteRequest.onerror = (event) => {
            console.error('Failed to delete old history entry:', event);
            reject(new Error('Failed to delete old history entry'));
          };
        });
      };

      request.onerror = (event) => {
        console.error('Failed to retrieve file history for cleanup:', event);
        reject(new Error('Failed to retrieve file history for cleanup'));
      };
    });
  }
}

// 创建单例实例
const cacheService = new CacheService();

export default cacheService;