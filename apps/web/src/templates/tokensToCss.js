/**
 * 디자인 토큰 → CSS 변수 객체 (React style에 그대로 넣는 순수 함수).
 * 토큰은 AI가 만든 값이므로 형식을 검사하고, 어긋나면 기본값으로 대체한다.
 * 값이 CSS 선언을 끊고 다른 속성을 끼워 넣지 못하게 하는 것이 목적.
 */
import { fontStack } from "./fonts.js";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const EASING = /^(?:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\(\s*-?[\d.]+\s*(?:,\s*-?[\d.]+\s*){3}\))$/;

const SANS = '"Pretendard Variable", Pretendard, system-ui, sans-serif';
const MONO = 'ui-monospace, "Pretendard Variable", monospace';

const color = (v, d) => (typeof v === "string" && HEX.test(v) ? v : d);
const num = (v, min, max, d) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const rem = (px) => `${+(px / 16).toFixed(4)}rem`;

/** @param {import("../schema/types.js").DesignTokens} tokens */
export function tokensToCssVars(tokens) {
  const c = tokens?.color ?? {}, t = tokens?.type ?? {}, s = tokens?.space ?? {}, r = tokens?.radius ?? {}, m = tokens?.motion ?? {};
  const base = num(t.baseSize, 14, 22, 17);
  const ratio = num(t.scaleRatio, 1.067, 1.618, 1.25);

  const vars = {
    "--c-bg": color(c.bg, "#FFFFFF"),
    "--c-surface": color(c.surface, "#F4F4F4"),
    "--c-text": color(c.text, "#111111"),
    "--c-muted": color(c.muted, "#555555"),
    "--c-accent": color(c.accent, "#1F46C8"),
    "--c-on-accent": color(c.onAccent, "#FFFFFF"),
    "--f-display": fontStack(t.display, SANS),
    "--f-body": fontStack(t.body, SANS),
    "--f-mono": fontStack(t.mono, MONO),
    "--space-unit": rem(num(s.unit, 4, 12, 8)),
    "--space-section": rem(num(s.section, 48, 200, 96)),
    "--radius-sm": rem(num(r.sm, 0, 24, 4)),
    "--radius-lg": rem(num(r.lg, 0, 48, 12)),
    "--motion-duration": m.level === "none" ? "0ms" : `${num(m.duration, 0, 1200, 200)}ms`,
    "--motion-easing": typeof m.easing === "string" && EASING.test(m.easing) ? m.easing : "ease-out",
  };
  // 글자 크기 단계: --fs-n1(작은 글자), --fs-0(본문) ~ --fs-6. 사용자 확대가 먹도록 rem 단위.
  vars["--fs-n1"] = rem(base / ratio);
  for (let i = 0; i <= 6; i++) vars[`--fs-${i}`] = rem(base * ratio ** i);
  return vars;
}
