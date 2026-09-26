# 포트폴리오 메이커 (프론트엔드)

```
npm install
npm run dev
```

src/schema/types.js   데이터 구조(Design DNA, 토큰, 3안, 포트폴리오) — source of truth
src/data/grammars.js  style grammar 10종과 축별 feature 값
src/data/mock.js      백엔드 전까지 쓰는 목업 데이터
src/engine/taste.js   규칙 기반 취향 추론(카드 반응, A/B, 혼합 비율)
src/engine/contrast.js WCAG 대비 계산·접근성 게이트
src/api/index.js      화면이 부르는 유일한 API 계층 (지금은 목업)
src/App.jsx           임시 디버그 화면
src/screens/          실제 화면이 들어갈 자리
