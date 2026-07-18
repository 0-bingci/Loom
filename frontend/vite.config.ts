import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 开发时把 API 请求转给后端进程,前端代码里只写相对路径(和未来部署形态一致)
    proxy: {
      '/tasks': 'http://localhost:8787',
      '/dashboard': 'http://localhost:8787',
      '/notifications': 'http://localhost:8787',
      '/calendar': 'http://localhost:8787',
      '/notes': 'http://localhost:8787',
    },
  },
})
