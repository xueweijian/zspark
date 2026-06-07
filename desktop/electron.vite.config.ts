import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: { build: { outDir: 'out/main', lib: { entry: 'src/main/index.ts' } } },
  preload: {
    build: {
      outDir: 'out/preload',
      lib: {
        entry: {
          index: 'src/preload/index.ts',
          'preview-preload': 'src/preload/preview-preload.ts',
          'preview-agent': 'src/preload/preview-agent.ts'
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react(), tailwindcss()],
    build: { outDir: 'out/renderer' }
  }
})
