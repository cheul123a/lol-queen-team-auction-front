import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // 일반 API 요청 프록시
      '/api': {
        target: 'http://localhost:28281',
        changeOrigin: true,
      },
      // 웹소켓(STOMP) 요청 프록시
      '/ws': {
        target: 'ws://localhost:28281',
        ws: true,
      },
    },
  },
})
