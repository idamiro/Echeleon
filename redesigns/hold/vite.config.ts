import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Static deploy under Vulcet redesigns
export default defineConfig({
  plugins: [react()],
  base: '/redesigns/hold/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
  },
})
