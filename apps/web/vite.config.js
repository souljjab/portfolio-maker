import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 랜딩의 "시작하기" 주소 기본값 (.env는 저장소에서 제외되므로 여기서도 채운다)
process.env.VITE_APP_URL ??= '/'

// https://vite.dev/config/
// 페이지: index.html = 앱(app.도메인), landing.html = 서비스 랜딩(루트 도메인), terms.html·privacy.html = 약관·개인정보처리방침(정적)
export default defineConfig({
  plugins: [react()],
  server: {
    // 개발 중 /api는 로컬 Worker(workers/app, wrangler dev)로 — 배포 땐 같은 Worker가 앱과 /api를 함께 서빙
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        landing: resolve(import.meta.dirname, 'landing.html'),
        terms: resolve(import.meta.dirname, 'terms.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
      },
    },
  },
})
