/** 응답·쿠키·요청 검사 공통 */

const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "Cache-Control": "no-store",
};

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...SECURITY, ...headers },
  });
}

export const fail = (status, reason) => json({ ok: false, reason }, status);

/** 서버가 직접 그리는 작은 HTML (보호자 동의 페이지). 스크립트는 전혀 허용하지 않는다 */
export function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      ...SECURITY,
    },
  });
}

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

const SESSION = "__Host-session";

export function readSessionCookie(request) {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION) return v.join("=");
  }
  return null;
}

/** __Host- 접두사: Secure·Path=/·Domain 없음이 강제된다 → 사용자 서브도메인이 이 쿠키를 덮어쓸 수 없다(cookie tossing 방지) */
export function sessionCookie(token, maxAgeSec) {
  return `${SESSION}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}
export const clearSessionCookie = () => `${SESSION}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

/**
 * 상태를 바꾸는 요청은 Origin이 정확히 앱 주소여야 한다.
 * 사용자 사이트(*.도메인)와 앱은 같은 사이트(same-site)라 SameSite 쿠키만으로는 CSRF를 막지 못하기 때문.
 */
export function fromApp(request, env) {
  return request.headers.get("Origin") === env.APP_ORIGIN;
}

/** JSON 본문 읽기 (크기 제한). 형식이 틀리면 null */
export async function readJson(request, maxBytes = 4096) {
  const text = await request.text();
  if (text.length > maxBytes) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") ?? "local";
}
