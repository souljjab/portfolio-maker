/** 토큰 조정용 색 계산 (순수 함수). 입력·출력 모두 #RRGGBB */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

export function hslToHex([h, s, l]) {
  const hh = ((h % 360) + 360) % 360, ss = clamp(s, 0, 100) / 100, ll = clamp(l, 0, 100) / 100;
  const k = (n) => (n + hh / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

/** a와 b를 t(0~1) 비율로 섞기 */
export function mix(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex(x.map((v, i) => v + (y[i] - v) * clamp(t, 0, 1)));
}

/** 명도(L)를 d만큼 이동 (-100~100) */
export function shiftLightness(hex, d) {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex([h, s, l + d]);
}

/** 채도(S)를 d만큼 이동 */
export function shiftSaturation(hex, d) {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex([h, s + d, l]);
}
