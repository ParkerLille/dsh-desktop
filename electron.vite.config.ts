import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: { build: { outDir: 'dist-electron/main', rollupOptions: { input: resolve(__dirname, 'src/main/index.ts') } } },
  preload: { build: { outDir: 'dist-electron/preload', rollupOptions: { input: resolve(__dirname, 'src/preload/index.ts'), output: { format: 'cjs', entryFileNames: 'index.js' } } } },
  renderer: { root: '.', plugins: [react()], build: { outDir: 'dist', rollupOptions: { input: resolve(__dirname, 'index.html') } } },
})
