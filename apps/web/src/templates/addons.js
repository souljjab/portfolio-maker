/**
 * 개성 포인트 — 템플릿 위에 얹는 작은 장식. 토큰의 `addons`(id 목록)로 켜고 끈다.
 * CSS는 전부 여기 개발자가 쓴 것만 들어간다(사용자·AI 문자열은 id로만 들어오고, 모르는 id는 무시).
 * 모든 템플릿이 공통 훅 클래스(pf-hero-title·pf-headline·pf-card·pf-links)를 달고 있어서 한 번만 쓴다.
 * 발행 사이트 CSP: 그레인·커서는 data: 이미지라 라우터가 img-src data:를 허용한다. 스크립트는 없다.
 * signal: 켰을 때 취향 축을 어느 쪽으로 약하게 끌어당길지 (edit 신호, engine/edits.js).
 */
import { luminance, contrastRatio } from "../engine/contrast.js";
import { mix } from "../engine/color.js";

const GRAIN = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";
const cursorSvg = (stroke) => `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='7' fill='none' stroke='%23${stroke}' stroke-width='2'/><circle cx='12' cy='12' r='2' fill='%23${stroke}'/></svg>`;

const MARKER_MIX = 0.3; // 형광펜 띠 = 배경에 강조색 30%

export const ADDONS = [
  {
    id: "grain", label: "필름 그레인", desc: "종이·필름 같은 질감",
    signal: { warmth: 70, visual_complexity: 55 },
    css: () => `.pf.pf-addon-grain{position:relative}.pf.pf-addon-grain::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:50;opacity:.12;mix-blend-mode:multiply;background-image:url("${GRAIN}")}`,
  },
  {
    id: "marker", label: "형광펜 강조", desc: "첫 화면 제목에 형광펜을 그은 듯",
    signal: { expressiveness: 65, playfulness: 60 },
    css: () => `.pf.pf-addon-marker .pf-hero-title{display:inline;background:linear-gradient(transparent 58%, color-mix(in srgb, var(--c-accent) ${MARKER_MIX * 100}%, transparent) 58% 92%, transparent 92%);box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:0 .08em}`,
  },
  {
    id: "hand", label: "손글씨 포인트", desc: "한 줄 소개를 손글씨체로", font: "Nanum Pen Script",
    signal: { playfulness: 70, warmth: 70 },
    css: () => `.pf.pf-addon-hand .pf-headline{font-family:"Nanum Pen Script",cursive;font-weight:400;font-size:1.35em;letter-spacing:0;line-height:1.35}`,
  },
  {
    id: "tilt", label: "살짝 기우는 카드", desc: "작업에 마우스를 올리면 살짝 반응", needsMotion: true,
    signal: { motion_intensity: 60, playfulness: 60 },
    css: () => `@media (prefers-reduced-motion: no-preference){.pf.pf-addon-tilt .pf-card{transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s}.pf.pf-addon-tilt .pf-card:hover{transform:translateY(-4px) rotate(-.8deg);box-shadow:0 18px 40px -18px rgb(0 0 0 / .28)}}`,
  },
  {
    id: "wavy", label: "물결 밑줄 링크", desc: "링크에 물결 밑줄",
    signal: { playfulness: 65 },
    css: () => `.pf.pf-addon-wavy .pf-links a{text-decoration:underline wavy;text-decoration-color:var(--c-accent);text-underline-offset:5px;text-decoration-thickness:1.5px}`,
  },
  {
    id: "cursor", label: "동그란 커서", desc: "마우스 커서를 작은 원으로",
    signal: { playfulness: 60, expressiveness: 60 },
    css: (t) => `.pf.pf-addon-cursor{cursor:url("${cursorSvg(luminance(t.color.bg) > 0.4 ? "222222" : "F2F2F2")}") 12 12, auto}`,
  },
];

export const addonById = Object.fromEntries(ADDONS.map((a) => [a.id, a]));

/**
 * 이 토큰에서 켤 수 없는 이유 (없으면 null). 편집기는 이유를 보여 주고, 렌더러는 조용히 뺀다.
 * - 형광펜: 띠 위 제목 글자가 큰 글자 기준 3:1을 넘어야 한다
 * - 움직이는 장식: 움직임 "없음"이면 끈다
 */
export function addonProblem(id, tokens) {
  if (id === "marker") {
    const band = mix(tokens.color.bg, tokens.color.accent, MARKER_MIX);
    if (contrastRatio(tokens.color.text, band) < 3) return "이 색 조합에선 형광펜 위 글자가 잘 안 읽혀요.";
  }
  if (addonById[id]?.needsMotion && tokens.motion?.level === "none") return "움직임을 ‘없음’으로 두면 쓸 수 없어요.";
  return null;
}

/** 실제로 그릴 개성 포인트 id (허용 목록에 있고, 지금 토큰에서 문제없는 것만, 중복 없이) */
export function activeAddons(tokens) {
  const ids = Array.isArray(tokens?.addons) ? tokens.addons : [];
  return [...new Set(ids)].filter((id) => addonById[id] && !addonProblem(id, tokens));
}

/** 켠 개성 포인트의 CSS */
export function addonCss(tokens) {
  return activeAddons(tokens).map((id) => addonById[id].css(tokens)).join("");
}
