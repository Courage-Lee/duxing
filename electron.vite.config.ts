import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['better-sqlite3', 'electron'],
        output: {
          // 阻止 Rollup 尝试 bundle 或转译原生模块的 dynamic require
          inlineDynamicImports: false,
        },
      },
      commonjsOptions: {
        // 让 better-sqlite3 自己的 require('.node') 保持原样
        ignoreDynamicRequires: true,
      },
    },
  },
  preload: {},
  renderer: {
    plugins: [react()],
  },
});
