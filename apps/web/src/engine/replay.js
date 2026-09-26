/**
 * 인터뷰 답(+편집 기록) → DNA. 빈 DNA에서 아래 순서대로 모든 답을 다시 반영한다.
 * 카드·A/B·편집이 축 추정치를 누적시키므로, 어느 답이 바뀌어도 처음부터 계산해야 정확하다.
 * 화면(인터뷰 STEPS)과 분리해 두어 편집기도 같은 방식으로 DNA를 다시 계산할 수 있다.
 */
import { createEmptyDNA } from "../schema/types.js";
import { applyIntent, applyGoal, applyTraits, applyContentPriority } from "./interview.js";
import {
  applyCardReaction, applyPairwiseChoices, describeDirection, applyConfirmation,
  findVagueTerms, applyTermChoice, applyDirectionChoice,
} from "./taste.js";
import { applyEdits } from "./edits.js";

/** [답 id, 반영 함수] — 순서가 곧 반영 순서 */
export const APPLY_ORDER = [
  ["intent", (dna, v) => applyIntent(dna, v.text)],
  ["goal", applyGoal],
  ["traits", (dna, v) => applyTraits(dna, { target: v.target, avoid: v.avoid })],
  // 풀 단어 목록은 이 단계 직전 DNA에서 다시 찾는다 (앞 단계를 고치면 목록도 바뀜)
  ["terms", (dna, v) => findVagueTerms(dna).reduce((d, t) => applyTermChoice(d, t, v.choices[t.key] ?? []), dna)],
  ["priority", (dna, v) => applyContentPriority(dna, v.order)],
  ["cards", (dna, v) => v.reactions.reduce((d, r) => (r.reaction === "skipped" ? d : applyCardReaction(d, r.id, r.reaction)), dna)],
  ["pairwise", (dna, v) => applyPairwiseChoices(dna, v.choices)],
  // 확인 문장은 이 단계 직전 DNA에서 만들어지므로 같은 DNA로 다시 만들어 답을 맞춘다
  ["confirm", (dna, v) => describeDirection(dna).reduce((d, st) => (v.responses[st.id] ? applyConfirmation(d, st, v.responses[st.id]) : d), dna)],
  ["directions", applyDirectionChoice],
  // 편집기에서 고른 안의 디자인을 직접 고친 기록 (answers.edits.changes)
  ["edits", (dna, v) => applyEdits(dna, v.changes)],
];

/**
 * @param {Record<string, any>} answers
 * @param {string} [beforeId]  이 답 직전까지만 반영 (그 단계 화면이 받는 baseDna)
 */
export function replayAnswers(answers, beforeId) {
  let dna = createEmptyDNA();
  for (const [id, apply] of APPLY_ORDER) {
    if (id === beforeId) break;
    if (answers[id]) dna = apply(dna, answers[id]);
  }
  return dna;
}
