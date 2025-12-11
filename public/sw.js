// Service Worker for ZenPub PWA - Simplified version without caching
// This version focuses on PWA features without caching functionality

// 安装事件 - 不执行任何缓存操作
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(self.skipWaiting());
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  // 清理所有可能存在的旧缓存
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => {
        console.log('[SW] All caches cleared');
        return self.clients.claim();
      })
      .catch((error) => {
        console.error('[SW] Activation failed:', error);
      })
  );
});

// 拦截网络请求 - 不执行缓存操作，直接从网络获取
self.addEventListener('fetch', (event) => {
  // 不拦截任何请求，直接使用网络
  return;
});

// 监听来自客户端的消息
self.addEventListener('message', (event) => {
  // 处理ping消息，用于检查Service Worker是否响应
  if (event.data && event.data.type === 'PING') {
    console.log('[SW] Ping received, responding...');
    event.ports[0].postMessage({ type: 'PONG', timestamp: Date.now() });
    return;
  }
});

// 后台同步事件（保留但不处理任何同步逻辑）
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered, but disabled in this version');
});

// 推送通知事件（保留基本功能）
self.addEventListener('push', (event) => {
  const options = {
    body: '您有新的内容更新',
    icon: '/Gemini_Generated_Image_xueq52xueq52xueq.png',
    badge: '/Gemini_Generated_Image_xueq52xueq52xueq.png'
  };
  
  event.waitUntil(
    self.registration.showNotification('ZenPub', options)
  );
});

// 点击通知事件
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});