/**
 * 서버(workers/app)용 번들 진입점 — 앱과 똑같은 템플릿·검증 코드로 발행 HTML을 만든다.
 * 빌드: apps/web에서 npm run build:render → workers/app/src/generated/render.js
 */
import { TEMPLATES } from "../templates/index.js";

export { renderPortfolioHtml } from "../templates/renderHtml.js";
export { validatePortfolio, normalizeForPublish, slugProblem, tokensShapeOk } from "../engine/content.js";
export const TEMPLATE_IDS = Object.keys(TEMPLATES);

// Claude 3안: 입력 정리·프롬프트·출력 스키마·출력 검증 (앱·평가와 같은 코드)
export { normalizeDna, buildSystemPrompt, buildDirectionsRequest, readDirectionsResponse, acceptAiDirections, DEFAULT_MODEL, DEFAULT_EFFORT } from "../engine/aiDirections.js";

// Claude로 다듬기 (편집기 메모·대화)
export { normalizeEditRequest, buildEditSystemPrompt, buildEditRequest, acceptAiEdits } from "../engine/aiEdits.js";
