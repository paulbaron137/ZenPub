// Service Worker for ZenPub PWA
const CACHE_NAME = 'zenpub-cache-v1';
const DYNAMIC_CACHE_NAME = 'zenpub-dynamic-v1';

// 静态资源缓存列表
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/index.css',
  // App scripts and styles
  '/index.tsx',
  '/App.tsx',
  '/types.ts',
  // Icons and images
  '/Gemini_Generated_Image_xueq52xueq52xueq.png',
  // External resources
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@300;400;700&family=JetBrains+Mono&display=swap',
  'https://cdn.tailwindcss.com'
];

// 安装事件 - 预缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.filter((cacheName) => {
            return cacheName !== CACHE_NAME && 
                   cacheName !== DYNAMIC_CACHE_NAME;
          }).map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
      .catch((error) => {
        console.error('[SW] Activation failed:', error);
      })
  );
});

// 拦截网络请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 只处理同源请求或特定外部资源
  if (url.origin === location.origin || 
      url.origin === 'https://fonts.googleapis.com' ||
      url.origin === 'https://cdn.tailwindcss.com') {
    
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          // 如果有缓存，优先使用缓存
          if (cachedResponse) {
            // 对于导航请求，仍在后台更新缓存
            if (request.mode === 'navigate') {
              fetchAndUpdateCache(request);
            }
            return cachedResponse;
          }
          
          // 没有缓存，则从网络获取
          return fetchAndUpdateCache(request);
        })
        .catch(() => {
          // 网络请求失败，尝试返回离线页面
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          
          // 对于其他请求，返回错误
          return new Response('Offline', { status: 503 });
        })
    );
  }
  
  // 不缓存其他请求（例如API请求）
  return;
});

// 从网络获取资源并更新缓存
function fetchAndUpdateCache(request) {
  const url = new URL(request.url);
  
  return fetch(request)
    .then((response) => {
      // 检查响应是否有效
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }
      
      // 决定使用哪个缓存
      const cacheName = url.origin === location.origin ? CACHE_NAME : DYNAMIC_CACHE_NAME;
      
      // 克隆响应，因为响应流只能使用一次
      const responseClone = response.clone();
      
      // 异步更新缓存
      caches.open(cacheName)
        .then((cache) => {
          // 只缓存GET请求
          if (request.method === 'GET') {
            cache.put(request, responseClone);
          }
        })
        .catch((error) => {
          console.error('[SW] Cache update failed:', error);
        });
      
      return response;
    })
    .catch((error) => {
      console.error('[SW] Network request failed:', error);
      throw error;
    });
}

// 监听来自客户端的消息（用于手动控制缓存）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urlsToCache = event.data.urls;
    
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => {
          console.log('[SW] Manually caching URLs:', urlsToCache);
          return cache.addAll(urlsToCache);
        })
        .catch((error) => {
          console.error('[SW] Manual cache failed:', error);
        })
    );
  }
  
  // 清理缓存的消息
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(DYNAMIC_CACHE_NAME)
        .then(() => {
          console.log('[SW] Dynamic cache cleared');
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          console.error('[SW] Cache clear failed:', error);
          event.ports[0].postMessage({ success: false, error: error.message });
        })
    );
  }
});

// 后台同步事件（将来可以用于同步数据）
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[SW] Background sync triggered');
    // 在这里可以执行数据同步逻辑
  }
});

// 推送通知事件（将来可以用于提醒用户）
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