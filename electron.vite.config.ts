import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['uiohook-napi']
      }
    }
  },
  preload: {},
  renderer: {
    root: 'src/renderer',
    plugins: [react()]
  }
})
