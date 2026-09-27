/**
 * 편집기에서 사용자가 직접 고친 디자인 → 취향 신호 (Manual Edit Distance).
 * 리서치상 가장 중요한 학습 신호이고, 가중치도 가장 크다(edit 1.5).
 * 고른 안의 원래 토큰(originTokens)과 지금 토큰을 비교해 바뀐 항목만 반영한다.
 */
import { applyToAxis, SOURCE_WEIGHT } from "./taste.js";
import { hexToHsl } from "./color.js";
import { addonById } from "../templates/addons.js";

const lerp = (v, a, b, ta, tb) => Math.round(ta + ((Math.min(Math.max(v, a), b) - a) / (b - a)) * (tb - ta));
const MOTION_TARGET = { none: 5, subtle: 35, expressive: 75 };

/** 배경색이 따뜻한지 차가운지 (중립이면 null) → warmth 목표값 */
function bgWarmth(hex) {
  const [h, s] = hexToHsl(hex);
  if (s < 8) return null;
  if (h >= 15 && h <= 70) return 80;
  if (h >= 170 && h <= 260) return 25;
  return null;
}

/**
 * 바뀐 항목 목록. 비교 대상은 사용자가 다듬기에서 만질 수 있는 값만.
 * @returns {{ key: string, from: any, to: any }[]}
 */
export function tokenEdits(origin, tokens) {
  if (!origin || !tokens) return [];
  const pairs = [
    ["color.accent", origin.color.accent, tokens.color.accent],
    ["color.bg", origin.color.bg, tokens.color.bg],
    ["type.display", origin.type.display, tokens.type.display],
    ["type.body", origin.type.body, tokens.type.body],
    ["type.scaleRatio", origin.type.scaleRatio, tokens.type.scaleRatio],
    ["space.section", origin.space.section, tokens.space.section],
    ["radius.lg", origin.radius.lg, tokens.radius.lg],
    ["motion.level", origin.motion.level, tokens.motion.level],
  ];
  const changes = pairs.filter(([, a, b]) => a !== b).map(([key, from, to]) => ({ key, from, to }));
  // 개성 포인트: 켠 것·끈 것 (원래 안에는 없으므로 보통 켠 것)
  const had = origin.addons ?? [], has = tokens.addons ?? [];
  for (const id of has) if (!had.includes(id)) changes.push({ key: `addon:${id}`, from: false, to: true });
  for (const id of had) if (!has.includes(id)) changes.push({ key: `addon:${id}`, from: true, to: false });
  return changes;
}

/**
 * 편집을 축에 반영. 각 편집이 가리키는 축 값을 목표로 edit 가중치로 끌어당긴다.
 * 글꼴 변경은 축으로 옮기기 애매해 신호로만 남긴다.
 */
export function applyEdits(dna, changes) {
  if (!changes?.length) return dna;
  const axes = { ...dna.taste.axes };
  const signals = [];
  const pull = (axis, target, weight = SOURCE_WEIGHT.edit) => { axes[axis] = applyToAxis(axes[axis], target, weight); };
  const note = (key, statement) => signals.push({ id: `edit:${key}`, kind: "preference", source: "edit", statement, confidence: 0.95 });
  const quirks = [];

  for (const c of changes) {
    if (c.key.startsWith("addon:")) {
      // 개성 포인트는 시그니처 층에 남기고, 켰을 때만 관련 축을 약하게 끌어당긴다(장식 하나로 취향을 단정하지 않게)
      const a = addonById[c.key.slice(6)];
      if (!a) continue;
      if (c.to) {
        quirks.push(a.label);
        for (const [axis, target] of Object.entries(a.signal)) pull(axis, target, SOURCE_WEIGHT.edit / 3);
      }
      note(c.key, `개성 포인트 ‘${a.label}’ ${c.to ? "켬" : "끔"}`);
      continue;
    }
    switch (c.key) {
      case "type.scaleRatio":
        pull("typography_drama", lerp(c.to, 1.125, 1.618, 20, 95));
        note(c.key, `글자 크기 차이를 ${c.to > c.from ? "키움" : "줄임"}`);
        break;
      case "space.section":
        pull("density", lerp(c.to, 48, 200, 85, 10));
        note(c.key, `여백을 ${c.to > c.from ? "넓힘" : "좁힘"}`);
        break;
      case "radius.lg":
        pull("warmth", lerp(c.to, 0, 48, 30, 75), SOURCE_WEIGHT.edit / 2); // 모서리는 따뜻함의 약한 단서
        note(c.key, `모서리를 ${c.to > c.from ? "둥글게" : "각지게"}`);
        break;
      case "motion.level":
        pull("motion_intensity", MOTION_TARGET[c.to] ?? 35);
        note(c.key, `움직임: ${{ none: "없음", subtle: "은은하게", expressive: "생동감 있게" }[c.to] ?? c.to}`);
        break;
      case "color.accent": {
        const [, s] = hexToHsl(c.to);
        pull("expressiveness", Math.round(20 + s * 0.65));
        note(c.key, `강조색을 ${c.to}(으)로`);
        break;
      }
      case "color.bg": {
        const w = bgWarmth(c.to);
        if (w !== null) pull("warmth", w);
        note(c.key, `배경 톤을 ${w === null ? "중립" : w > 50 ? "따뜻하게" : "차갑게"}`);
        break;
      }
      default:
        note(c.key, `${c.key === "type.display" ? "제목" : "본문"} 글꼴을 ${c.to}(으)로`);
    }
  }
  const signature = quirks.length ? { ...dna.signature, quirks: [...new Set([...dna.signature.quirks, ...quirks])] } : dna.signature;
  return { ...dna, taste: { ...dna.taste, axes }, signature, signals: [...dna.signals, ...signals] };
}
