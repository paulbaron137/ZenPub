// vite.config.ts

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
            // ✨ 新增或修改此行 ✨
            // 将文件大小限制从默认的 2 MiB 增加到 10 MiB (10 * 1024 * 1024 字节)
            maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, 
          },
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
          manifest: {
            // ... (manifest 配置保持不变)
            name: 'ZenPub',
            short_name: 'ZenPub',
            description: 'A powerful markdown publishing tool',
            theme_color: '#ffffff',
            background_color: '#ffffff',
            display: 'standalone',
            icons: [
              {
                src: 'Gemini_Generated_Image_xueq52xueq52xueq.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'Gemini_Generated_Image_xueq52xueq52xueq.png',
                sizes: '512x512',
                type: 'image/png'
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
