/**
 * 규칙 기반 취향 추론 엔진 (MVP).
 * 나중에 pairwise logistic 모델로 교체해도 입출력 모양은 유지.
 * 순수 함수만 두고 DNA를 직접 바꾸지 않는다(새 객체 반환).
 */
import { AXES } from "../schema/types.js";
import { GRAMMARS, grammarById, CARD_ORDER } from "../data/grammars.js";
import { AXIS_PHRASES } from "../data/axisPhrases.js";
import { VAGUE_TERMS } from "../data/vagueTerms.js";
import { DIRECTION_KINDS } from "../data/interviewOptions.js";

// 신호 출처별 신뢰 가중치 — 리서치 충돌 규칙: 직접 고른 이미지 > 형용사
export const SOURCE_WEIGHT = { card: 1.0, pairwise: 1.2, text: 0.6, edit: 1.5, confirm: 1.3 };

/** 한 신호를 축 추정치에 반영 (confidence 가중 이동평균) */
export function applyToAxis(est, target, weight) {
  const w = Math.max(0, weight);
  const total = est.evidence + w;
  const value = total === 0 ? est.value : (est.value * est.evidence + target * w) / total;
  const confidence = 1 - Math.exp(-0.45 * total); // 신호가 쌓일수록 1에 수렴
  return { value: Math.round(value), confidence: +confidence.toFixed(2), evidence: +total.toFixed(2) };
}

/**
 * 카드 반응 반영. reaction: "like" | "dislike" | "neutral"
 * dislike는 반대쪽으로 끌어당긴다 (싫어함은 강한 정보).
 */
export function applyCardReaction(dna, grammarId, reaction) {
  const g = grammarById[grammarId];
  if (!g || reaction === "neutral") return logSignal(dna, grammarId, reaction);
  const axes = { ...dna.taste.axes };
  for (const axis of AXES) {
    const f = g.features[axis];
    const extremity = Math.abs(f - 50) / 50; // 중간값 feature는 정보가 적음
    if (extremity < 0.2) continue;
    const target = reaction === "like" ? f : 100 - f;
    const weight = SOURCE_WEIGHT.card * extremity * (reaction === "dislike" ? 1.1 : 1);
    axes[axis] = applyToAxis(axes[axis], target, weight);
  }
  const selected = reaction === "like" ? [...dna.taste.selectedRefs, grammarId] : dna.taste.selectedRefs;
  const rejected = reaction === "dislike" ? [...dna.taste.rejectedRefs, grammarId] : dna.taste.rejectedRefs;
  const next = { ...dna, taste: { ...dna.taste, axes, selectedRefs: selected, rejectedRefs: rejected } };
  return logSignal(next, grammarId, reaction);
}

/** A/B 비교 반영: 두 안의 feature 차이가 큰 축만 업데이트 */
export function applyPairwise(dna, winnerId, loserId) {
  const w = grammarById[winnerId], l = grammarById[loserId];
  if (!w || !l) return dna;
  const axes = { ...dna.taste.axes };
  for (const axis of AXES) {
    const diff = w.features[axis] - l.features[axis];
    if (Math.abs(diff) < 20) continue;
    axes[axis] = applyToAxis(axes[axis], w.features[axis], SOURCE_WEIGHT.pairwise * (Math.abs(diff) / 100));
  }
  const next = { ...dna, taste: { ...dna.taste, axes } };
  return {
    ...next,
    signals: [...next.signals, {
      id: crypto.randomUUID(), kind: "preference", source: "pairwise",
      statement: `${w.name}을(를) ${l.name}보다 선호`, confidence: 0.7,
    }],
  };
}

function logSignal(dna, grammarId, reaction) {
  const g = grammarById[grammarId];
  const verb = { like: "좋아함", dislike: "싫어함", neutral: "상관없음" }[reaction];
  return {
    ...dna,
    signals: [...dna.signals, {
      id: crypto.randomUUID(), kind: "preference", source: "card",
      statement: `${g?.name ?? grammarId} 카드: ${verb}`, confidence: reaction === "neutral" ? 0.2 : 0.6,
    }],
  };
}

/** 다음에 물어볼 축: 확신도가 가장 낮은 축 (confidence ≤ 0.65만 대상) */
export function pickUncertainAxis(dna) {
  const candidates = AXES
    .map((axis) => ({ axis, ...dna.taste.axes[axis] }))
    .filter((a) => a.confidence <= 0.65)
    .sort((a, b) => a.confidence - b.confidence);
  return candidates[0]?.axis ?? null;
}

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * 불확실한 축을 가르는 A/B 쌍 고르기:
 * 그 축에서 차이가 크고(25 이상), 나머지 축에선 차이가 작은 두 grammar.
 * exclude: 제외할 grammar / usedPairs: 이미 물어본 쌍(pairKey)
 */
export function pickPairFor(axis, exclude = [], usedPairs = new Set()) {
  let best = null;
  for (const a of GRAMMARS) for (const b of GRAMMARS) {
    if (a.id >= b.id || exclude.includes(a.id) || exclude.includes(b.id) || usedPairs.has(pairKey(a.id, b.id))) continue;
    const target = Math.abs(a.features[axis] - b.features[axis]);
    if (target < 25) continue;
    const noise = AXES.filter((x) => x !== axis)
      .reduce((s, x) => s + Math.abs(a.features[x] - b.features[x]), 0) / (AXES.length - 1);
    const score = target - 0.6 * noise;
    if (!best || score > best.score) best = { a: a.id, b: b.id, score };
  }
  return best;
}

/** 현재 취향 벡터와 각 grammar의 거리 → 혼합 비율 (가까울수록 높음) */
export function computeGrammarMix(dna, top = 3) {
  const scored = GRAMMARS.map((g) => {
    let d = 0, wsum = 0;
    for (const axis of AXES) {
      const est = dna.taste.axes[axis];
      const w = 0.2 + est.confidence; // 확신 있는 축에 더 큰 비중
      d += w * (g.features[axis] - est.value) ** 2;
      wsum += w;
    }
    const penalty = dna.taste.rejectedRefs.includes(g.id) ? 4 : 1;
    return { id: g.id, dist: Math.sqrt(d / wsum) * penalty };
  }).sort((a, b) => a.dist - b.dist).slice(0, top);
  const inv = scored.map((s) => 1 / (s.dist + 1));
  const sum = inv.reduce((a, b) => a + b, 0);
  return Object.fromEntries(scored.map((s, i) => [s.id, Math.round((inv[i] / sum) * 100)]));
}

/** 두 grammar의 성격 거리 (축별 차이의 제곱평균근, 0~100) */
export function grammarDistance(aId, bId) {
  const a = grammarById[aId].features, b = grammarById[bId].features;
  return Math.sqrt(AXES.reduce((s, x) => s + (a[x] - b[x]) ** 2, 0) / AXES.length);
}

// 이 거리 이하면 "아주 비슷한" grammar (swiss–technical 15, quiet-editorial–warm-minimal 16 등)
const SIMILAR = 17;

/**
 * 다음 시각 카드 고르기. 최근 두 장을 연달아 싫어했으면(피로·강한 거부 신호)
 * 지금까지 싫어한 카드 중 하나와 아주 비슷한 카드는 건너뛴다.
 * (카드 순서가 비슷한 grammar를 멀리 떨어뜨려 두므로 "직전 두 장"만 보면 거의 발동하지 않음)
 * @param {{ id: string, reaction: "like"|"dislike"|"neutral"|"skipped" }[]} reactions 지금까지의 반응(건너뜀 포함)
 * @returns {{ next: string|null, skipped: string[] }}
 */
export function pickNextCard(reactions) {
  const seen = new Set(reactions.map((r) => r.id));
  const real = reactions.filter((r) => r.reaction !== "skipped");
  const lastTwo = real.slice(-2);
  const streak = lastTwo.length === 2 && lastTwo.every((r) => r.reaction === "dislike");
  const disliked = streak ? real.filter((r) => r.reaction === "dislike").map((r) => r.id) : [];
  const skipped = [];
  for (const id of CARD_ORDER) {
    if (seen.has(id)) continue;
    if (disliked.some((d) => grammarDistance(d, id) <= SIMILAR)) { skipped.push(id); continue; }
    return { next: id, skipped };
  }
  return { next: null, skipped };
}

/** A/B 답 목록 반영. winner가 null("잘 모르겠어요")이면 건너뛴다 */
export function applyPairwiseChoices(dna, choices) {
  return choices.reduce((d, c) => (c.winner ? applyPairwise(d, c.winner, c.winner === c.a ? c.b : c.a) : d), dna);
}

/** A/B로 물어볼 축: 화면 인상에 영향이 큰 축만 (질문 수를 줄이기 위해) */
export const PAIRWISE_AXES = ["density", "expressiveness", "typography_drama", "warmth", "image_dominance"];
export const MAX_PAIRWISE = 4;

/**
 * 축이 얼마나 분명한지 (0~1) = 확신도 × 중간(50)에서 떨어진 정도.
 * 지금 confidence는 신호 개수만 반영하므로, 서로 어긋난 신호가 쌓여 값이 중간에 모인 축도
 * confidence가 높게 나온다. 그런 축은 실제로는 불확실하므로 이 값으로 판단한다.
 */
export function decisiveness(est) {
  return est.confidence * (Math.abs(est.value - 50) / 50);
}
const UNCLEAR = 0.25;

/**
 * 다음 A/B 질문. 분명하지 않은 축 중 덜 물어본 축 → 덜 분명한 축 순으로,
 * 싫어한 grammar와 이미 본 쌍은 빼고 고른다.
 * @param {import("../schema/types.js").DesignDNA} dna  지금까지의 답이 반영된 DNA
 * @param {{ axis: string, a: string, b: string }[]} asked  이미 물어본 질문
 * @returns {{ axis: string, a: string, b: string } | null}  더 물을 게 없으면 null
 */
export function pickPairwiseQuestion(dna, asked) {
  if (asked.length >= MAX_PAIRWISE) return null;
  const used = new Set(asked.map((q) => pairKey(q.a, q.b)));
  const times = (axis) => asked.filter((q) => q.axis === axis).length;
  const candidates = PAIRWISE_AXES
    .map((axis) => ({ axis, d: decisiveness(dna.taste.axes[axis]) }))
    .filter((c) => c.d < UNCLEAR)
    .sort((x, y) => times(x.axis) - times(y.axis) || x.d - y.d);
  for (const c of candidates) {
    const pair = pickPairFor(c.axis, dna.taste.rejectedRefs, used);
    if (pair) return { axis: c.axis, a: pair.a, b: pair.b };
  }
  return null;
}

/**
 * "제가 이해한 방향" 확인 문장 만들기.
 * axis: 확신도가 어느 정도 있고 한쪽으로 치우친 축 (최대 4개, 확신도×치우침 순)
 * avoid: 피하고 싶다고 한 인상 — 동의하면 hard 제약이 된다
 * id에 방향을 넣어 두어, 앞 단계 답이 바뀌어 방향이 뒤집히면 이전 확인 답이 적용되지 않게 한다.
 */
export function describeDirection(dna) {
  const axes = AXES
    .map((axis) => ({ axis, ...dna.taste.axes[axis] }))
    .filter((c) => c.confidence >= 0.35 && Math.abs(c.value - 50) >= 12)
    .sort((x, y) => decisiveness(y) - decisiveness(x))
    .slice(0, 4)
    .map((c) => {
      const side = c.value >= 50 ? "high" : "low";
      const other = side === "high" ? "low" : "high";
      return {
        id: `axis:${c.axis}:${side}`, type: "axis", axis: c.axis, value: c.value,
        text: `${AXIS_PHRASES[c.axis][side]} 쪽을 좋아하시는 것 같아요.`,
        opposite: AXIS_PHRASES[c.axis][other],
      };
    });
  const avoid = dna.identity.traitsAvoid.map((w) => ({
    id: `avoid:${w}`, type: "avoid", word: w,
    text: `‘${w}’ 느낌은 절대 나오지 않게 할게요.`,
  }));
  return [...axes, ...avoid];
}

/**
 * 확인 답 반영. answer: "yes" | "no" | "no-opposite" | "no-middle"
 * 명시적 거부는 추론보다 강하다(리서치 충돌 규칙) — "아니에요"는 지금까지 쌓인 근거의 3배로 반영해
 * 정정한 쪽으로 확실히 넘어가게 한다(1.5배로는 27→54처럼 중간에 머물렀음).
 */
export function applyConfirmation(dna, statement, answer) {
  const signal = (statementText, kind = "preference") => ({
    id: `confirm:${statement.id}`, kind, source: "confirm", statement: statementText, confidence: 0.9,
  });
  if (statement.type === "avoid") {
    if (answer === "yes") {
      const hard = { ...signal(`‘${statement.word}’ 인상 금지`, "hard"), id: `hard:avoid:${statement.word}` };
      return {
        ...dna,
        constraints: { ...dna.constraints, hard: [...dna.constraints.hard.filter((h) => h.id !== hard.id), hard] },
        signals: [...dna.signals, hard],
      };
    }
    return { ...dna, signals: [...dna.signals, signal(`‘${statement.word}’은(는) 가능하면 피하는 정도`)] };
  }
  const est = dna.taste.axes[statement.axis];
  let target = statement.value, weight = SOURCE_WEIGHT.confirm, text = `확인: ${statement.text}`;
  if (answer === "no-opposite") {
    target = 100 - statement.value;
    weight = Math.max(SOURCE_WEIGHT.confirm, est.evidence * 3);
    text = `정정: ${statement.opposite} 쪽`;
  } else if (answer === "no-middle") {
    target = 50;
    weight = Math.max(SOURCE_WEIGHT.confirm, est.evidence * 3);
    const p = AXIS_PHRASES[statement.axis];
    text = `정정: 중간쯤 (${p.low} ↔ ${p.high})`;
  } else if (answer !== "yes") {
    return dna;
  }
  const axes = { ...dna.taste.axes, [statement.axis]: applyToAxis(est, target, weight) };
  return { ...dna, taste: { ...dna.taste, axes }, signals: [...dna.signals, signal(text)] };
}

/**
 * 자기 설명·기억되고 싶은 인상에서 모호한 형용사 찾기 (사전 순서대로).
 * @returns {typeof VAGUE_TERMS}
 */
export function findVagueTerms(dna) {
  const sources = [dna.identity.selfDescription, ...dna.identity.traitsTarget];
  return VAGUE_TERMS.filter((t) => t.stems.some((stem) => sources.some((src) => src.includes(stem))));
}

/**
 * 모호한 단어를 풀어 고른 뜻 반영. 형용사 해석은 직접 고른 이미지보다 약하므로 text 가중치(0.6),
 * 단어→축 대응은 우리 쪽 해석이라 kind는 hypothesis. 뜻을 여러 개 골랐으면 가중치를 나눠 가진다.
 * @param {string[]} optionIds  고른 뜻 id (비어 있으면 "잘 모르겠어요")
 */
export function applyTermChoice(dna, term, optionIds) {
  const chosen = term.options.filter((o) => optionIds.includes(o.id));
  if (!chosen.length) return dna;
  const axes = { ...dna.taste.axes };
  const weight = SOURCE_WEIGHT.text / chosen.length;
  for (const o of chosen) for (const [axis, target] of Object.entries(o.effects)) {
    axes[axis] = applyToAxis(axes[axis], target, weight);
  }
  return {
    ...dna,
    taste: { ...dna.taste, axes },
    signals: [...dna.signals, {
      id: `term:${term.key}`, kind: "hypothesis", source: "text",
      statement: `‘${term.word}’의 뜻: ${chosen.map((o) => o.label).join(", ")}`, confidence: 0.5,
    }],
  };
}

/**
 * 3안 중 하나를 고른 것 반영: 고른 grammar가 나머지 둘을 이긴 비교로 반영하고,
 * 좋았던 점(색·글자 등)과 섞기 요청("색은 A안에서")은 편집기 조정에 쓸 수 있게 신호로 남긴다.
 * 섞기 요청은 리서치상 고품질 신호.
 * @param {{ kind: string, grammar: string, others: string[], reasons: string[], mix?: { color: string, type: string } }} choice
 */
export function applyDirectionChoice(dna, { kind, grammar, others, reasons, mix }) {
  const d = others.filter((o) => o !== grammar).reduce((x, o) => applyPairwise(x, grammar, o), dna);
  const name = (k) => DIRECTION_KINDS[k]?.label ?? k;
  const mixed = [
    mix?.color && mix.color !== kind ? `색은 ${name(mix.color)}에서` : null,
    mix?.type && mix.type !== kind ? `글꼴은 ${name(mix.type)}에서` : null,
  ].filter(Boolean);
  return {
    ...d,
    signals: [...d.signals, {
      id: "choice:direction", kind: "preference", source: "choice",
      statement: `3안 중 ${name(kind)} 선택 (${grammarById[grammar].name})`
        + (reasons.length ? ` — 좋았던 점: ${reasons.join(", ")}` : "")
        + (mixed.length ? ` — 섞기: ${mixed.join(", ")}` : ""),
      confidence: 0.9,
    }],
  };
}
