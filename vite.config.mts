import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [
    vue({
      features: {
        vapor: true
      }
    })
  ],
  root: path.resolve(import.meta.dirname, 'src/webview/ui'),
  base: './',
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/webview'),
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: path.resolve(import.meta.dirname, 'src/webview/ui/index.html'),
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: 'index-[name].js',
        assetFileNames: 'index[extname]'
      }
    }
  }
});
