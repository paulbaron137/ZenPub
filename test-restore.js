// 这个文件用于测试恢复提示框功能
// 在浏览器控制台中运行这段代码来测试恢复功能

async function testRestorePrompt() {
  console.log('开始测试恢复提示框功能...');
  
  try {
    // 检查缓存服务是否可用
    if (!window.indexedDB) {
      console.error('IndexedDB不可用，无法测试恢复功能');
      return;
    }
    
    // 打开数据库
    const request = indexedDB.open('ZenPubCache', 1);
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      console.log('IndexedDB数据库打开成功');
      
      // 检查是否有可恢复的状态
      const userStateTransaction = db.transaction(['userState'], 'readonly');
      const userStateStore = userStateTransaction.objectStore('userState');
      const userStateRequest = userStateStore.get('current');
      
      userStateRequest.onsuccess = function() {
        const userState = userStateRequest.result;
        
        const projectDataTransaction = db.transaction(['projectData'], 'readonly');
        const projectDataStore = projectDataTransaction.objectStore('projectData');
        const projectDataRequest = projectDataStore.get('current');
        
        projectDataRequest.onsuccess = function() {
          const projectData = projectDataRequest.result;
          
          if (userState && projectData) {
            console.log('找到可恢复的状态:');
            console.log('- 用户状态:', userState);
            console.log('- 项目数据:', projectData);
            console.log('恢复提示框应该会显示');
          } else {
            console.log('没有找到可恢复的状态');
            console.log('- 用户状态:', userState ? '存在' : '不存在');
            console.log('- 项目数据:', projectData ? '存在' : '不存在');
            console.log('恢复提示框不应该显示');
          }
        };
      };
    };
    
    request.onerror = function(event) {
      console.error('打开IndexedDB数据库失败:', event);
    };
    
  } catch (error) {
    console.error('测试恢复功能时出错:', error);
  }
}

// 创建测试数据
function createTestData() {
  console.log('创建测试数据...');
  
  try {
    const request = indexedDB.open('ZenPubCache', 1);
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      
      // 创建用户状态测试数据
      const userStateTransaction = db.transaction(['userState'], 'readwrite');
      const userStateStore = userStateTransaction.objectStore('userState');
      
      const testUserState = {
        id: 'current',
        lastOpenTime: Date.now(),
        activeChapterId: '1',
        scrollPosition: {
          editor: 100,
          preview: 50
        },
        cursorPosition: {
          start: 50,
          end: 50
        },
        viewMode: 'split',
        sidebarOpen: true,
        memoOpen: false,
        theme: 'light',
        sidebarWidth: 256,
        editorWidthPercent: 50
      };
      
      userStateStore.put(testUserState);
      
      // 创建项目数据测试数据
      const projectDataTransaction = db.transaction(['projectData'], 'readwrite');
      const projectDataStore = projectDataTransaction.objectStore('projectData');
      
      const testProjectData = {
        id: 'current',
        metadata: {
          title: '测试文档',
          author: '测试用户',
          publisher: '',
          description: '这是一个测试文档',
          language: 'zh-CN',
          tags: ['测试']
        },
        chapters: [
          {
            id: '1',
            title: '第一章：测试章节',
            content: '# 第一章：测试章节\n\n这是一个测试章节的内容。\n\n## 小节\n\n这里有一些内容。',
            memo: '这是一个测试章节的备注',
            order: 0
          }
        ],
        lastModified: Date.now()
      };
      
      projectDataStore.put(testProjectData);
      
      console.log('测试数据创建成功');
      console.log('刷新页面后应该会显示恢复提示框');
    };
    
  } catch (error) {
    console.error('创建测试数据时出错:', error);
  }
}

// 清除测试数据
function clearTestData() {
  console.log('清除测试数据...');
  
  try {
    const request = indexedDB.open('ZenPubCache', 1);
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      
      // 清除用户状态
      const userStateTransaction = db.transaction(['userState'], 'readwrite');
      const userStateStore = userStateTransaction.objectStore('userState');
      userStateStore.delete('current');
      
      // 清除项目数据
      const projectDataTransaction = db.transaction(['projectData'], 'readwrite');
      const projectDataStore = projectDataTransaction.objectStore('projectData');
      projectDataStore.delete('current');
      
      console.log('测试数据清除成功');
      console.log('刷新页面后不应该显示恢复提示框');
    };
    
  } catch (error) {
    console.error('清除测试数据时出错:', error);
  }
}

// 导出测试函数
window.testRestorePrompt = testRestorePrompt;
window.createTestData = createTestData;
window.clearTestData = clearTestData;

console.log('恢复提示框测试脚本已加载，可以使用以下命令:');
console.log('- testRestorePrompt(): 测试恢复功能');
console.log('- createTestData(): 创建测试数据');
console.log('- clearTestData(): 清除测试数据');