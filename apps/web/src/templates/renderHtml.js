/**
 * 포트폴리오 → 완결된 정적 HTML 문서.
 * 미리보기(iframe srcdoc)와 나중의 publish·export가 같은 함수를 쓴다 — 미리보기가 곧 발행 결과.
 * 스크립트는 넣지 않는다. 사용자 텍스트는 React가 이스케이프하고, <head>에 넣는 값은 esc()로 이스케이프.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getTemplate } from "./index.js";
import { FONTS } from "./fonts.js";
import { activeAddons, addonById } from "./addons.js";
import { tokensToCssVars } from "./tokensToCss.js";

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/** 토큰(과 켠 개성 포인트)이 쓰는 폰트의 스타일시트 주소 (fonts.js 허용 목록에 있는 것만) */
export function fontHrefs(tokens) {
  const addonFonts = activeAddons(tokens).map((id) => addonById[id].font);
  const names = [tokens.type.display, tokens.type.body, tokens.type.mono, ...addonFonts].filter(Boolean);
  return [...new Set(names.map((n) => FONTS[n]?.href).filter(Boolean))];
}

/**
 * @param {{ portfolio: import("../schema/types.js").Portfolio, tokens: import("../schema/types.js").DesignTokens,
 *           template: string, preview?: boolean }} opts
 *   preview: 미리보기용이면 링크를 새 창으로 열도록 <base target="_blank">를 넣는다(iframe 안에서 이동 방지)
 */
export function renderPortfolioHtml({ portfolio, tokens, template, preview = false }) {
  const Template = getTemplate(template);
  if (!Template) throw new Error(`템플릿 없음: ${template}`);
  const body = renderToStaticMarkup(createElement(Template, { portfolio, tokens }));
  const bg = tokensToCssVars(tokens)["--c-bg"]; // 검증된 값만 사용
  const links = fontHrefs(tokens).map((h) => `<link rel="stylesheet" href="${esc(h)}">`).join("");
  return "<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\">"
    + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
    + `<title>${esc(portfolio.person.name)}</title>${links}`
    + (preview ? "<base target=\"_blank\">" : "")
    + `<style>html{background:${bg}}body{margin:0}</style></head><body>${body}</body></html>`;
}
