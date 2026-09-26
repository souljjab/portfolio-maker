import { CONTENT_SECTIONS, PRIMARY_GOALS } from "../data/interviewOptions.js";

/**
 * 인터뷰 답변 → DNA 반영 (순수 함수, 새 객체 반환).
 * 같은 단계를 다시 답하면 그 단계에서 만든 신호만 교체한다(신호 id 접두사로 구분).
 * 여기서 만드는 신호는 사용자가 직접 말한 것이므로 kind는 preference.
 * 피하고 싶은 인상은 hard 후보지만, 확인 단계에서 동의받기 전까지는 preference로 둔다.
 */

function replaceSignals(dna, prefix, signals) {
  return { ...dna, signals: [...dna.signals.filter((s) => !s.id.startsWith(`${prefix}:`)), ...signals] };
}

const textSignal = (id, statement, confidence) => ({ id, kind: "preference", source: "text", statement, confidence });

/** 1단계: 자유 입력 문장 */
export function applyIntent(dna, text) {
  const t = text.trim();
  const next = { ...dna, identity: { ...dna.identity, selfDescription: t } };
  return replaceSignals(next, "intent", t ? [textSignal("intent:text", `자기 설명: "${t}"`, 0.5)] : []);
}

/** 2단계: 목적·대상·방문자가 마지막에 할 일 */
export function applyGoal(dna, { primaryGoal, audience, conversionGoal }) {
  const next = { ...dna, goal: { ...dna.goal, primaryGoal, audience, conversionGoal } };
  return replaceSignals(next, "goal", [
    textSignal("goal:primary", `목적: ${primaryGoal}`, 0.9),
    textSignal("goal:audience", `주로 보는 사람: ${audience}`, 0.9),
    textSignal("goal:conversion", `방문자가 마지막에 할 일: ${conversionGoal}`, 0.8),
  ]);
}

/** 3단계: 원하는 인상(최대 3) / 피하고 싶은 인상 */
export function applyTraits(dna, { target, avoid }) {
  const next = { ...dna, identity: { ...dna.identity, traitsTarget: [...target], traitsAvoid: [...avoid] } };
  return replaceSignals(next, "traits", [
    ...target.map((w) => textSignal(`traits:target:${w}`, `기억되고 싶은 인상: ${w}`, 0.6)),
    ...avoid.map((w) => textSignal(`traits:avoid:${w}`, `피하고 싶은 인상: ${w} (확인 후 hard 후보)`, 0.8)),
  ]);
}

/**
 * 목적에 맞춘 섹션 순서 제안 (5단계 기본값). 외주·협업이면 연락을 앞으로 당긴다.
 * 제안일 뿐이며 사용자가 바꾼 순서가 항상 우선한다.
 */
export function suggestContentOrder(goal) {
  if (goal.primaryGoal === PRIMARY_GOALS[1]) return ["projects", "contact", "about"];
  return CONTENT_SECTIONS.map((s) => s.id);
}

/** 5단계: 콘텐츠 우선순위 */
export function applyContentPriority(dna, order) {
  const label = (id) => CONTENT_SECTIONS.find((s) => s.id === id)?.label ?? id;
  const next = { ...dna, goal: { ...dna.goal, contentPriority: [...order] } };
  return replaceSignals(next, "priority", [
    textSignal("priority:order", `보여줄 순서: ${order.map(label).join(" > ")}`, 0.9),
  ]);
}
