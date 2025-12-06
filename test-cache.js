// 这个文件用于测试缓存功能
// 在浏览器控制台中运行这段代码来测试缓存服务

async function testCache() {
  console.log('开始测试缓存功能...');
  
  try {
    // 检查IndexedDB是否可用
    if (!window.indexedDB) {
      console.error('IndexedDB不可用');
      return;
    }
    
    // 打开数据库
    const request = indexedDB.open('ZenPubCache', 1);
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      console.log('IndexedDB数据库打开成功');
      
      // 检查对象存储是否存在
      if (db.objectStoreNames.contains('userState')) {
        console.log('用户状态存储已存在');
        
        // 读取用户状态
        const transaction = db.transaction(['userState'], 'readonly');
        const store = transaction.objectStore('userState');
        const getRequest = store.get('current');
        
        getRequest.onsuccess = function() {
          const result = getRequest.result;
          if (result) {
            console.log('用户状态已缓存:', result);
          } else {
            console.log('用户状态未缓存');
          }
        };
      }
      
      if (db.objectStoreNames.contains('projectData')) {
        console.log('项目数据存储已存在');
      }
      
      if (db.objectStoreNames.contains('fileHistory')) {
        console.log('文件历史存储已存在');
      }
    };
    
    request.onerror = function(event) {
      console.error('打开IndexedDB数据库失败:', event);
    };
    
    // 检查Service Worker是否已注册
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        console.log('已注册的Service Workers:', registrations);
        if (registrations.length > 0) {
          console.log('Service Worker已注册');
          registrations.forEach(registration => {
            console.log('Service Worker状态:', registration.active ? '激活' : '未激活');
            console.log('Service Worker URL:', registration.scope);
          });
        } else {
          console.log('未注册Service Worker');
        }
      });
    } else {
      console.error('Service Worker不可用');
    }
    
  } catch (error) {
    console.error('测试缓存功能时出错:', error);
  }
}

// 导出测试函数
window.testCache = testCache;

console.log('缓存测试脚本已加载，请在控制台运行 testCache() 来测试缓存功能');