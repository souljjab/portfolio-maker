/**
 * grammar별 기본 토큰 — 3안 토큰(deriveTokens)의 출발점이자, 조정이 대비 게이트를 못 넘을 때의 대체값.
 * 모든 세트는 checkTokens(대비 게이트)를 통과해야 한다. 폰트는 templates/fonts.js 허용 목록 안에서만.
 * 카드 썸네일(src/thumbnails)의 색과 맞춰 두어 카드에서 고른 인상과 3안의 인상이 이어지게 한다.
 */
export const GRAMMAR_TOKENS = {
  "quiet-editorial": {
    color: { bg: "#FBFAF7", surface: "#F1EEE6", text: "#1D1C1A", muted: "#57534B", accent: "#8A3B2E", onAccent: "#FFFFFF" },
    type: { display: "Noto Serif KR", body: "Pretendard", mono: null, scaleRatio: 1.333, baseSize: 17 },
    space: { unit: 8, section: 128 }, radius: { sm: 2, lg: 4 },
    motion: { duration: 320, easing: "cubic-bezier(.2,.7,.2,1)", level: "subtle" },
  },
  "warm-minimal": {
    color: { bg: "#F6F4EF", surface: "#FFFFFF", text: "#23211E", muted: "#5E5A53", accent: "#2F5D50", onAccent: "#FFFFFF" },
    type: { display: "Pretendard", body: "Pretendard", mono: null, scaleRatio: 1.25, baseSize: 17 },
    space: { unit: 8, section: 96 }, radius: { sm: 8, lg: 20 },
    motion: { duration: 200, easing: "ease-out", level: "subtle" },
  },
  swiss: {
    color: { bg: "#FFFFFF", surface: "#F2F2F2", text: "#111111", muted: "#4D4D4D", accent: "#C8231A", onAccent: "#FFFFFF" },
    type: { display: "Pretendard", body: "Pretendard", mono: null, scaleRatio: 1.414, baseSize: 16 },
    space: { unit: 8, section: 96 }, radius: { sm: 0, lg: 0 },
    motion: { duration: 160, easing: "ease-out", level: "subtle" },
  },
  "bold-type": {
    color: { bg: "#EDEFF2", surface: "#FFFFFF", text: "#15181C", muted: "#4A515B", accent: "#1F46C8", onAccent: "#FFFFFF" },
    type: { display: "Pretendard", body: "Pretendard", mono: "JetBrains Mono", scaleRatio: 1.5, baseSize: 17 },
    space: { unit: 8, section: 112 }, radius: { sm: 0, lg: 0 },
    motion: { duration: 480, easing: "cubic-bezier(.7,0,.2,1)", level: "expressive" },
  },
  bento: {
    color: { bg: "#EEEEF1", surface: "#FFFFFF", text: "#1A1A1F", muted: "#52525E", accent: "#5238C7", onAccent: "#FFFFFF" },
    type: { display: "Pretendard", body: "Pretendard", mono: null, scaleRatio: 1.25, baseSize: 16 },
    space: { unit: 8, section: 80 }, radius: { sm: 12, lg: 24 },
    motion: { duration: 240, easing: "ease-out", level: "subtle" },
  },
  gallery: {
    color: { bg: "#F4F2EE", surface: "#FFFFFF", text: "#1E1E1E", muted: "#5A5751", accent: "#7A4E2D", onAccent: "#FFFFFF" },
    type: { display: "Pretendard", body: "Pretendard", mono: null, scaleRatio: 1.2, baseSize: 16 },
    space: { unit: 8, section: 112 }, radius: { sm: 2, lg: 4 },
    motion: { duration: 400, easing: "ease-out", level: "subtle" },
  },
  technical: {
    // 차갑고 정밀한 인상. 강조색은 네온 대신 깊은 청록(배경 대비 5.76:1)
    color: { bg: "#F5F6F7", surface: "#FFFFFF", text: "#0E1116", muted: "#4F5763", accent: "#0B6B74", onAccent: "#FFFFFF" },
    type: { display: "Pretendard", body: "Pretendard", mono: "JetBrains Mono", scaleRatio: 1.2, baseSize: 16 },
    space: { unit: 8, section: 72 }, radius: { sm: 2, lg: 4 },
    motion: { duration: 160, easing: "ease-out", level: "subtle" },
  },
  "retro-web": {
    color: { bg: "#FFF6C9", surface: "#FFFFFF", text: "#111111", muted: "#4A4A3A", accent: "#0000CC", onAccent: "#FFFFFF" },
    type: { display: "JetBrains Mono", body: "Pretendard", mono: "JetBrains Mono", scaleRatio: 1.333, baseSize: 16 },
    space: { unit: 8, section: 72 }, radius: { sm: 0, lg: 0 },
    motion: { duration: 200, easing: "linear", level: "expressive" },
  },
  organic: {
    color: { bg: "#EFE6D8", surface: "#F8F2E8", text: "#3A352B", muted: "#5E5647", accent: "#56662F", onAccent: "#FFFFFF" },
    type: { display: "Noto Serif KR", body: "Pretendard", mono: null, scaleRatio: 1.333, baseSize: 17 },
    space: { unit: 8, section: 112 }, radius: { sm: 16, lg: 32 },
    motion: { duration: 360, easing: "ease-out", level: "subtle" },
  },
  experimental: {
    color: { bg: "#161616", surface: "#232323", text: "#F2F2F2", muted: "#B0B0B0", accent: "#FF5A1F", onAccent: "#111111" },
    type: { display: "Pretendard", body: "Pretendard", mono: null, scaleRatio: 1.618, baseSize: 17 },
    space: { unit: 8, section: 128 }, radius: { sm: 0, lg: 0 },
    motion: { duration: 600, easing: "cubic-bezier(.7,0,.2,1)", level: "expressive" },
  },
};
