// Service Worker for ZenPub PWA - Optimized for Vercel
const CACHE_NAME = 'zenpub-cache-v1';
const DYNAMIC_CACHE_NAME = 'zenpub-dynamic-v1';

// 静态资源缓存列表 - 只缓存核心资源，减少首次加载时间
// 使用绝对路径，确保在Vercel环境中正确缓存
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  // Icons and images
  '/Gemini_Generated_Image_xueq52xueq52xueq.png',
  // 外部字体资源延迟加载，不缓存
  'https://cdn.tailwindcss.com'
];

// 延迟缓存资源 - 在页面加载后再缓存
// 使用绝对路径，确保在Vercel环境中正确缓存
const DEFERRED_ASSETS = [
  '/index.css',
  // App scripts and styles
  '/index.tsx',
  '/App.tsx',
  '/types.ts',
  // 外部字体资源
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@300;400;700&family=JetBrains+Mono&display=swap'
];

// Vercel环境检测和适配
const isVercelEnvironment = self.location.hostname.includes('vercel.app') || 
                            self.location.hostname.includes('vercel.com');

// 安装事件 - 预缓存核心静态资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...', isVercelEnvironment ? '(Vercel Environment)' : '');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching core static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Core assets cached, skipping waiting to activate immediately');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
        // 在Vercel环境中，某些资源可能无法缓存，但不应该阻止Service Worker安装
        if (isVercelEnvironment) {
          console.warn('[SW] Vercel environment detected, some caching errors may be expected');
        }
      })
  );
});

// 延迟缓存非关键资源 - 在激活后执行
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching deferred assets');
        return cache.addAll(DEFERRED_ASSETS);
      })
      .then(() => {
        console.log('[SW] Deferred assets cached successfully');
      })
      .catch((error) => {
        console.error('[SW] Failed to cache deferred assets:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...', isVercelEnvironment ? '(Vercel Environment)' : '');
  
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
              // 在Vercel环境中，延迟更新缓存以避免频繁的重新验证
              if (isVercelEnvironment) {
                setTimeout(() => fetchAndUpdateCache(request), 1000);
              } else {
                fetchAndUpdateCache(request);
              }
            }
            return cachedResponse;
          }
          
          // 没有缓存，则从网络获取
          return fetchAndUpdateCache(request);
        })
        .catch((error) => {
          console.error('[SW] Fetch failed:', error);
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
  // 处理ping消息，用于检查Service Worker是否响应
  if (event.data && event.data.type === 'PING') {
    console.log('[SW] Ping received, responding...');
    event.ports[0].postMessage({ type: 'PONG', timestamp: Date.now() });
    return;
  }
  
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