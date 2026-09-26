/** WCAG 2.2 대비 계산 — 접근성 게이트(탈락 기준)에 사용 */
function channel(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export function luminance(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrastRatio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return +((l1 + 0.05) / (l2 + 0.05)).toFixed(2);
}
/**
 * 토큰 세트 검사: 실패 항목 목록을 돌려줌 (빈 배열 = 통과).
 * fg/bg는 color 토큰의 키 — 자동 보정(engine/directions.js)이 어느 색을 고칠지 판단하는 데 쓴다.
 */
export function checkTokens(tokens) {
  const c = tokens.color, fails = [];
  const rules = [
    ["본문 텍스트", "text", "bg", 4.5],
    ["보조 텍스트", "muted", "bg", 4.5],
    ["카드 위 텍스트", "text", "surface", 4.5],
    ["카드 위 보조 텍스트", "muted", "surface", 4.5],
    ["버튼 텍스트", "onAccent", "accent", 4.5],
    ["강조색(큰 글자·아이콘)", "accent", "bg", 3],
  ];
  for (const [label, fg, bg, min] of rules) {
    const r = contrastRatio(c[fg], c[bg]);
    if (r < min) fails.push({ label, ratio: r, min, fg, bg });
  }
  return fails;
}
