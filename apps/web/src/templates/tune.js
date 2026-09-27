/**
 * 영역별 조절값 (블루펜슬의 맞춤 슬라이더를 토큰으로) — 토큰의 `tune`에 숫자로 저장하고, tokensToCssVars가
 * 범위를 잘라 CSS 변수(--tune-*)로 넣는다. 템플릿은 이 변수만 읽는다(요소별 자유 CSS 없음).
 * - 제목·한 줄 소개 크기: base.css가 공통 훅 클래스에 zoom으로 적용
 * - 카드 간격·콘텐츠 폭: 각 템플릿 CSS가 자기 값에 곱한다 (bold-type은 폭 제한이 없는 디자인이라 폭 조절 없음)
 * - 줄 간격: base.css
 * signal: 값을 키웠을 때 끌어당길 취향 축 [축, 작을 때 목표, 클 때 목표] (engine/edits.js)
 */
export const TUNE = {
  heroSize: { label: "첫 화면 제목 크기", min: 0.7, max: 1.4, step: 0.05, def: 1, low: "작게", high: "크게", css: "--tune-hero", signal: ["typography_drama", 25, 90] },
  headlineSize: { label: "한 줄 소개 크기", min: 0.8, max: 1.4, step: 0.05, def: 1, low: "작게", high: "크게", css: "--tune-headline", signal: ["typography_drama", 35, 75] },
  cardGap: { label: "작업 사이 간격", min: 0.5, max: 2, step: 0.1, def: 1, low: "촘촘하게", high: "넉넉하게", css: "--tune-gap", signal: ["density", 80, 20] },
  contentWidth: { label: "콘텐츠 폭", min: 0.85, max: 1.2, step: 0.05, def: 1, low: "좁게", high: "넓게", css: "--tune-width", signal: ["density", 30, 65], noWidth: ["bold-type"] },
  leading: { label: "본문 줄 간격", min: 1.4, max: 2, step: 0.05, def: 1.65, low: "빽빽하게", high: "여유 있게", css: "--tune-leading", signal: ["density", 75, 25] },
};

/** 범위 안으로 자른 값 (없거나 이상하면 기본값) */
export function tuneValue(tokens, key) {
  const t = TUNE[key], v = tokens?.tune?.[key];
  return typeof v === "number" && Number.isFinite(v) ? Math.min(t.max, Math.max(t.min, v)) : t.def;
}

/** 이 템플릿에서 쓸 수 있는 조절값인지 */
export const tuneSupported = (key, template) => !(TUNE[key].noWidth ?? []).includes(template);

/**
 * 누른 칸에 맞는 조절 (맞춤 슬라이더 자동 선택). tokenKnobs는 기존 토큰 중 함께 보여 줄 것.
 * @returns {{ title: string, tune: string[], token: ("space.section"|"radius.lg"|"type.scaleRatio")[] }}
 */
export function knobsFor(field) {
  if (field === "name") return { title: "첫 화면 제목", tune: ["heroSize"], token: ["type.scaleRatio"] };
  if (field === "headline") return { title: "한 줄 소개", tune: ["headlineSize", "heroSize"], token: [] };
  if (field === "bio") return { title: "소개글", tune: ["leading", "contentWidth"], token: [] };
  if (/^project\.\d+/.test(field)) return { title: "작업", tune: ["cardGap"], token: ["radius.lg", "space.section"] };
  return { title: "페이지 전체", tune: ["contentWidth", "leading"], token: ["space.section"] };
}
