/**
 * Design DNA → Safe·Core·Stretch 3안 (규칙 기반, 순수 함수).
 * api의 generateDirections 목업이 이 함수를 부르고, Claude API가 붙은 뒤에도
 * 결과 검증·대체값으로 쓸 수 있게 반환 모양은 Direction(types.js) 그대로 둔다.
 *
 * 순서: hard 제약 → 후보 grammar 거르기 → Core/Safe/Stretch 배정 → 토큰 조정 → 대비 자동 보정.
 * 템플릿 목록은 인자로 받는다(엔진이 JSX를 import하지 않도록).
 */
import { AXES } from "../schema/types.js";
import { GRAMMARS, grammarById } from "../data/grammars.js";
import { GRAMMAR_TOKENS } from "../data/grammarTokens.js";
import { AVOID_RULES } from "../data/avoidRules.js";
import { TEMPLATE_SIGNATURES } from "../data/signatures.js";
import { AXIS_PHRASES } from "../data/axisPhrases.js";
import { grammarDistance, decisiveness } from "./taste.js";
import { checkTokens, luminance } from "./contrast.js";
import { mix, shiftLightness, shiftSaturation } from "./color.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const HARD_PREFIX = "hard:avoid:";

/** 확인 단계에서 hard가 된 "피하고 싶은 인상" → 축 범위 (겹치면 가장 좁은 범위) */
export function hardLimits(dna) {
  const axes = {};
  let lightBg = false;
  const words = [];
  for (const h of dna.constraints.hard) {
    if (!h.id.startsWith(HARD_PREFIX)) continue;
    const word = h.id.slice(HARD_PREFIX.length);
    words.push(word);
    const rule = AVOID_RULES[word];
    if (!rule) continue;
    for (const [k, v] of Object.entries(rule)) {
      if (k === "lightBg") { lightBg = lightBg || v; continue; }
      const cur = axes[k] ?? { min: 0, max: 100 };
      axes[k] = { min: Math.max(cur.min, v.min ?? 0), max: Math.min(cur.max, v.max ?? 100) };
    }
  }
  return { axes, lightBg, words };
}

const isDark = (grammarId) => luminance(GRAMMAR_TOKENS[grammarId].color.bg) < 0.4;

/** hard 제약 범위를 벗어난 grammar인지 */
export function violates(grammarId, limits) {
  if (limits.lightBg && isDark(grammarId)) return true;
  const f = grammarById[grammarId].features;
  return Object.entries(limits.axes).some(([a, r]) => f[a] < r.min || f[a] > r.max);
}

/** 취향 벡터: 축 추정값을 hard 범위 안으로 자른 것 */
function tasteVector(dna, limits) {
  return Object.fromEntries(AXES.map((a) => {
    const v = dna.taste.axes[a].value, r = limits.axes[a];
    return [a, r ? clamp(v, r.min, r.max) : v];
  }));
}

/** 확신도 가중 거리 (computeGrammarMix와 같은 방식: 확신 있는 축에 더 큰 비중) */
function distance(grammarId, vec, dna) {
  let d = 0, w = 0;
  for (const a of AXES) {
    const wa = 0.2 + dna.taste.axes[a].confidence;
    d += wa * (grammarById[grammarId].features[a] - vec[a]) ** 2;
    w += wa;
  }
  return Math.sqrt(d / w);
}

const TEMPLATE_MARGIN = 6;

/** 템플릿이 없는 grammar는 구조가 가장 가까운 구현 템플릿으로 그린다 */
export function templateFor(grammarId, available) {
  if (available.includes(grammarId)) return grammarId;
  return [...available].sort((a, b) => grammarDistance(grammarId, a) - grammarDistance(grammarId, b))[0];
}

/**
 * Core: 취향에 가장 가까운 grammar / Safe: 익숙함 55 이상 중 가장 가까운 것 /
 * Stretch: 취향을 표현력 +20·익숙함 −20·타이포 +10으로 한 단계 민 벡터에 가장 가까운 것.
 * 싫어한 grammar와 hard 위반 grammar는 빼고, 세 안이 서로 다른 템플릿으로 그려지게 하되
 * 거리 차이가 TEMPLATE_MARGIN 이내일 때만 그렇게 한다 — 취향 충실도가 다양성보다 우선.
 * (마진 없이 다양성을 강제하면 따뜻·여백 취향에 레트로 웹이 Stretch로 나오는 식으로 크게 어긋났음)
 */
export function pickGrammars(dna, available, limits = hardLimits(dna)) {
  const vec = tasteVector(dna, limits);
  const allowed = GRAMMARS.map((g) => g.id).filter((id) => !violates(id, limits));
  const preferred = allowed.filter((id) => !dna.taste.rejectedRefs.includes(id));
  // 싫어한 것까지 빼면 3개가 안 될 때만 싫어한 것도 허용. hard 위반은 끝까지 제외.
  const pool = preferred.length >= 3 ? preferred : allowed;
  const rank = (v) => [...pool].sort((a, b) => distance(a, v, dna) - distance(b, v, dna));

  const chosen = [], templates = new Set();
  const take = (candidates, v) => {
    const list = (candidates.length ? candidates : rank(v)).filter((id) => !chosen.includes(id));
    const best = list[0] ?? chosen[0]; // 후보가 바닥나면(hard 제약이 매우 좁을 때) 같은 grammar 재사용
    const limit = distance(best, v, dna) + TEMPLATE_MARGIN;
    const pick = list.find((id) => !templates.has(templateFor(id, available)) && distance(id, v, dna) <= limit) ?? best;
    chosen.push(pick);
    templates.add(templateFor(pick, available));
    return pick;
  };

  const core = take(rank(vec), vec);
  const safe = take(rank(vec).filter((id) => grammarById[id].features.conventionality >= 55), vec);
  const pushed = { ...vec };
  for (const [a, delta] of [["expressiveness", 20], ["conventionality", -20], ["typography_drama", 10]]) {
    const r = limits.axes[a] ?? { min: 0, max: 100 };
    pushed[a] = clamp(vec[a] + delta, r.min, r.max);
  }
  const stretch = take(rank(pushed), pushed);
  return { safe, core, stretch };
}

/** 안별 조정 강도: Safe는 grammar 기본에 가깝게, Stretch는 취향 쪽으로 더 */
const INTENSITY = { safe: 0.5, core: 1, stretch: 1.4 };

/**
 * grammar 기본 토큰을 취향 쪽으로 조정. 조정량 = (취향값 − grammar 값) × 확신도 × 안별 강도.
 * 확신 없는 축은 거의 움직이지 않는다. 결과는 대비 게이트를 통과해야 하며, 못 넘으면 기본 토큰.
 */
export function deriveTokens(grammarId, dna, kind, limits = hardLimits(dna)) {
  const base = GRAMMAR_TOKENS[grammarId];
  const f = grammarById[grammarId].features;
  const vec = tasteVector(dna, limits);
  const k = INTENSITY[kind];
  const d = (a) => ((vec[a] - f[a]) / 100) * dna.taste.axes[a].confidence * k;

  const t = structuredClone(base);
  const c = t.color;

  // 따뜻함: 밝은 배경은 따뜻/서늘한 색을 살짝 섞고, 강조색도 같은 쪽으로
  const dw = d("warmth");
  if (!isDark(grammarId) && Math.abs(dw) > 0.02) {
    const tint = dw > 0 ? "#F3E2C4" : "#D8E3EE";
    c.bg = mix(c.bg, tint, Math.abs(dw) * 0.6);
    c.surface = mix(c.surface, tint, Math.abs(dw) * 0.35);
  }
  if (Math.abs(dw) > 0.02) c.accent = mix(c.accent, dw > 0 ? "#B0502A" : "#2A58B0", Math.abs(dw) * 0.5);
  // 표현력: 강조색 채도
  c.accent = shiftSaturation(c.accent, d("expressiveness") * 40);

  // 타이포 극적 정도: 글자 크기 비율
  t.type.scaleRatio = +clamp(base.type.scaleRatio + d("typography_drama") * 0.3, 1.125, 1.618).toFixed(3);
  // 밀도: 섹션 간격 (8px 격자)
  t.space.section = clamp(Math.round((base.space.section * (1 - d("density") * 0.6)) / 8) * 8, 48, 200);
  // 따뜻함·장난스러움: 모서리 둥글기
  const soft = (d("warmth") + d("playfulness")) / 2;
  t.radius.lg = clamp(Math.round(base.radius.lg + soft * 24), 0, 48);
  t.radius.sm = clamp(Math.round(base.radius.sm + soft * 10), 0, 24);
  // 움직임: 단계 (reduced motion이면 항상 없음)
  const m = f.motion_intensity + (vec.motion_intensity - f.motion_intensity) * dna.taste.axes.motion_intensity.confidence * k;
  t.motion.level = dna.constraints.reducedMotion ? "none" : m < 20 ? "none" : m < 60 ? "subtle" : "expressive";

  return ensureContrast(t) ?? structuredClone(base);
}

/**
 * 대비 게이트를 통과할 때까지 글자색·강조색 명도를 배경에서 멀어지는 쪽으로 조금씩 옮긴다.
 * 25번 안에 못 넘으면 null (호출한 쪽이 기본 토큰으로 대체).
 */
export function ensureContrast(tokens) {
  const t = structuredClone(tokens);
  const c = t.color;
  const away = (bgKey) => (luminance(c[bgKey]) > 0.4 ? -4 : 4); // 밝은 배경이면 어둡게
  for (let i = 0; i < 25; i++) {
    const fails = checkTokens(t);
    if (!fails.length) return t;
    for (const fl of fails) {
      if (fl.fg === "onAccent") {
        // 버튼 글자는 흰색/검정 중 대비가 큰 쪽, 그래도 모자라면 강조색 명도를 옮긴다
        c.onAccent = luminance(c.accent) > 0.18 ? "#111111" : "#FFFFFF";
        c.accent = shiftLightness(c.accent, c.onAccent === "#FFFFFF" ? -3 : 3);
      } else {
        c[fl.fg] = shiftLightness(c[fl.fg], away(fl.bg));
      }
    }
  }
  return checkTokens(t).length ? null : t;
}

/** 분명한 축을 사람 말로 (근거 문장용) */
function topPhrases(dna, n) {
  return AXES
    .map((a) => ({ a, est: dna.taste.axes[a] }))
    .filter(({ est }) => decisiveness(est) >= 0.15)
    .sort((x, y) => decisiveness(y.est) - decisiveness(x.est))
    .slice(0, n)
    .map(({ a, est }) => `‘${AXIS_PHRASES[a][est.value >= 50 ? "high" : "low"]}’`);
}

/** 이 안을 왜 이렇게 만들었는지 한 문장 */
function rationale(kind, dna) {
  const phrases = topPhrases(dna, 2);
  if (kind === "core") {
    return phrases.length
      ? `고르신 카드와 답에서 반복된 ${phrases.join(", ")} 쪽을 중심에 뒀어요.`
      : "지금까지의 답에 가장 가까운 방향이에요.";
  }
  if (kind === "safe") {
    return phrases.length
      ? `익숙한 구성은 그대로 두고, ${phrases[0]} 쪽만 조금 더했어요.`
      : "많이 본 익숙한 구성에 개성을 조금만 더했어요.";
  }
  return `한 단계 더 나아가 ‘${AXIS_PHRASES.expressiveness.high}’ 쪽으로 밀어 봤어요. 보여줄 순서와 내용은 그대로예요.`;
}

/** 부가 안내: 대체 템플릿을 쓴 사실, 지킨 hard 제약 */
export function directionNotes(grammar, template, limits) {
  const out = [];
  if (template !== grammar) {
    out.push(`‘${grammarById[grammar].name}’ 전용 화면은 준비 중이라, 구조가 가까운 ‘${grammarById[template].name}’ 화면에 색과 글꼴만 입혔어요.`);
  }
  if (limits.words.length) out.push(`${limits.words.map((w) => `‘${w}’`).join("·")} 느낌은 빼 두었어요.`);
  return out;
}

const SIGNATURE_COUNT = { safe: 1, core: 2, stretch: 3 };
/** 실제 템플릿 기준 시그니처 (Safe 1개, Core 2개, Stretch 3개) */
export const signaturesFor = (template, kind) => (TEMPLATE_SIGNATURES[template] ?? []).slice(0, SIGNATURE_COUNT[kind]);

/**
 * @param {import("../schema/types.js").DesignDNA} dna
 * @param {string[]} available  구현된 템플릿 id 목록
 * @returns {import("../schema/types.js").Direction[]}  safe, core, stretch 순
 */
export function buildDirections(dna, available) {
  const limits = hardLimits(dna);
  const picked = pickGrammars(dna, available, limits);
  return ["safe", "core", "stretch"].map((kind) => {
    const grammar = picked[kind];
    const template = templateFor(grammar, available);
    return {
      kind, grammar, template,
      tokens: deriveTokens(grammar, dna, kind, limits),
      rationale: rationale(kind, dna),
      notes: directionNotes(grammar, template, limits),
      signatures: signaturesFor(template, kind),
    };
  });
}

/**
 * 섞기: 고른 안(anchor)의 배치·간격·모서리·움직임은 두고, 색 묶음과 글꼴 묶음만 다른 안에서 가져온다.
 * 색은 묶음째 옮기므로 대비가 유지되지만, 안전하게 게이트를 다시 거친다(실패하면 anchor 그대로).
 * @param {import("../schema/types.js").Direction} anchor
 * @param {import("../schema/types.js").Direction} colorFrom
 * @param {import("../schema/types.js").Direction} typeFrom
 */
export function mixTokens(anchor, colorFrom, typeFrom) {
  const t = structuredClone(anchor.tokens);
  t.color = structuredClone(colorFrom.tokens.color);
  t.type = structuredClone(typeFrom.tokens.type);
  return ensureContrast(t) ?? structuredClone(anchor.tokens);
}
