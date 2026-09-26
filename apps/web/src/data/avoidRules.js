/**
 * 피하고 싶은 인상(확인 단계에서 hard가 된 것) → 넘으면 안 되는 축 범위.
 * 3안에서 이 범위를 벗어난 grammar는 후보에서 빠지고, 토큰을 만들 때 축 값도 이 범위로 잘린다.
 * lightBg: 어두운 배경 grammar 제외.
 * 사전에 없는 단어(직접 입력)는 아직 규칙이 없어 적용되지 않는다 — 나중엔 Claude API가 범위를 제안.
 */
export const AVOID_RULES = {
  "딱딱한": { warmth: { min: 35 } },
  "유치한": { playfulness: { max: 65 } },
  "산만한": { visual_complexity: { max: 65 }, motion_intensity: { max: 70 } },
  "차가운": { warmth: { min: 35 } },
  "밋밋한": { expressiveness: { min: 30 } },
  "과한": { expressiveness: { max: 80 }, visual_complexity: { max: 70 } },
  "무거운": { density: { max: 65 }, lightBg: true },
  "가벼운": { playfulness: { max: 60 } },
  "흔한": { conventionality: { max: 70 } },
  "어두운": { lightBg: true },
};
