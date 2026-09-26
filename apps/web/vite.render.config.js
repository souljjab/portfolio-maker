import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 서버(workers/app)용 렌더러 번들: 템플릿·검증 코드를 Worker에서 쓸 수 있는 ES 모듈 하나로.
// React도 함께 묶고, react-dom/server는 Workers용(workerd 조건 → server.edge.js)을 쓴다.
export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ['workerd', 'worker', 'browser'] },
  ssr: {
    target: 'webworker',
    noExternal: true,
    resolve: { conditions: ['workerd', 'worker', 'browser'], externalConditions: ['workerd', 'worker'] },
  },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    ssr: resolve(import.meta.dirname, 'src/server/entry.js'),
    outDir: resolve(import.meta.dirname, '../../workers/app/src/generated'),
    emptyOutDir: true,
    minify: false,
    rollupOptions: { output: { entryFileNames: 'render.js', format: 'es' } },
  },
})
