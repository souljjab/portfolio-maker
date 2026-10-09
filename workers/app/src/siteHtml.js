/**
 * 블루펜슬로 다듬은 HTML을 발행 전에 거른다 (HTMLRewriter — 브라우저가 보낸 HTML은 믿지 않는다).
 * 사이트 CSP(script-src 'none', img-src 'self' data:, form-action 'none')가 한 번 더 막지만,
 * 저장되는 파일 자체에도 스크립트·이벤트 속성·위험한 주소·외부 리소스가 남지 않게 한다.
 */

// 통째로 지우는 요소 (스크립트·다른 문서 끼워 넣기·이동·입력 양식)
const DROP = ["script", "iframe", "frame", "frameset", "object", "embed", "applet", "portal", "base",
  "form", "input", "select", "textarea", "noscript", "template", "audio", "video", "source", "track"];
// 글꼴 스타일시트는 fonts.js 허용 목록과 같은 두 곳만 (사이트 CSP style-src와 같음)
const STYLESHEET_OK = /^https:\/\/(?:fonts\.googleapis\.com|cdn\.jsdelivr\.net)\//;
const LINK_OK = /^(?:https?:|mailto:|tel:|#|\/(?!\/))/i;
const DATA_IMAGE = /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i;
const URL_ATTRS = new Set(["href", "xlink:href", "action", "formaction", "poster", "background", "ping", "cite", "longdesc", "usemap"]);
export const UPLOAD_REF = /upload:([a-f0-9]{64}\.(?:webp|jpg|png|gif))/g;

/**
 * @param {string} html  블루펜슬이 내보낸 HTML 문서 (이미지는 upload:<key>)
 * @param {Set<string>} keys  이 계정이 올린 이미지 key — 이것만 /img/<key>로, 나머지 이미지 주소는 지운다
 * @returns {Promise<string>}
 */
export async function sanitizeSiteHtml(html, keys) {
  const rw = new HTMLRewriter()
    .on(DROP.join(","), { element(el) { el.remove(); } })
    .on("meta", {
      element(el) {
        const name = (el.getAttribute("name") ?? "").toLowerCase();
        if (!el.hasAttribute("charset") && name !== "viewport") el.remove();
      },
    })
    .on("link", {
      element(el) {
        const rel = (el.getAttribute("rel") ?? "").toLowerCase().split(/\s+/);
        if (!rel.includes("stylesheet") || !STYLESHEET_OK.test(el.getAttribute("href") ?? "")) el.remove();
      },
    })
    // SVG 애니메이션으로 링크 주소를 바꾸는 우회 막기
    .on("set,animate", { element(el) { if (/href/i.test(el.getAttribute("attributeName") ?? "")) el.remove(); } })
    .on("*", {
      element(el) {
        for (const [name] of [...el.attributes]) {
          const n = name.toLowerCase();
          const v = (el.getAttribute(name) ?? "").trim();
          if (n.startsWith("on") || n === "srcdoc" || n === "srcset" || n === "data-pf-field" || n === "http-equiv") { el.removeAttribute(name); continue; }
          if (URL_ATTRS.has(n) && el.tagName !== "link" && !LINK_OK.test(v)) { el.removeAttribute(name); continue; }
          if (n === "src") {
            const m = /^upload:([a-f0-9]{64}\.(?:webp|jpg|png|gif))$/.exec(v);
            if (m && keys.has(m[1])) el.setAttribute("src", `/img/${m[1]}`);
            else if (!DATA_IMAGE.test(v) || el.tagName !== "img") el.removeAttribute(name);
          }
        }
      },
    });
  return rw.transform(new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })).text();
}
