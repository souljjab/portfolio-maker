// 서브도메인 → R2의 sites/{slug}/ 경로로 매핑하는 라우팅 Worker (PoC)

const RESERVED = new Set([
  "www", "app", "api", "admin", "mail", "static", "assets",
  "help", "support", "status", "blog", "docs", "dev", "test",
]);

// 영소문자·숫자·하이픈, 3~30자, 하이픈으로 시작/끝 불가
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

const TYPES = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  woff2: "font/woff2",
  ico: "image/x-icon",
};

// 사용자 사이트에 공통으로 붙일 보안 헤더
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  // 사이트는 서버가 템플릿으로 만든 정적 HTML이라 스크립트가 전혀 없다 → script-src 'none'.
  // 스타일은 템플릿의 <style>·CSS 변수 때문에 인라인 허용, 폰트는 fonts.js 허용 목록의 두 곳만.
  // 이미지는 사이트 안(/img/)과 data:(개성 포인트의 그레인·커서 무늬)만 — 외부 이미지로 방문자를 추적하지 못하게.
  "Content-Security-Policy": [
    "default-src 'none'",
    "img-src 'self' data:",
    "style-src 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "script-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'self'",
  ].join("; "),
};

function notFound(msg = "Not found") {
  return new Response(msg, {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", ...SECURITY_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const root = env.ROOT_DOMAIN;

    // host에서 slug 추출: minji.YOUR_DOMAIN → minji
    if (!url.hostname.endsWith("." + root)) return notFound();
    const slug = url.hostname.slice(0, -(root.length + 1));

    // 다단계 서브도메인(a.b.YOUR_DOMAIN)·예약어·형식 위반 차단
    if (slug.includes(".") || RESERVED.has(slug) || !SLUG_RE.test(slug)) {
      return notFound();
    }

    // 경로 정리: "/" → index.html, "/about" → about/index.html
    let path = decodeURIComponent(url.pathname);
    if (path.includes("..")) return notFound();
    if (path.endsWith("/")) path += "index.html";
    else if (!path.split("/").pop().includes(".")) path += "/index.html";

    const key = `sites/${slug}${path}`;
    // If-None-Match 등 조건부 요청은 R2가 직접 판단 → 바뀌지 않았으면 본문 없는 객체가 온다(304)
    const obj = await env.SITES.get(key, { onlyIf: request.headers });
    if (!obj) {
      return notFound(`사이트가 없거나 아직 공개되지 않았습니다: ${slug}`);
    }

    const ext = key.split(".").pop().toLowerCase();
    const headers = new Headers(SECURITY_HEADERS);
    headers.set("content-type", TYPES[ext] || "application/octet-stream");
    headers.set("etag", obj.httpEtag);
    // HTML은 매번 확인(비공개 전환·신고 처리·보호자 동의 철회가 바로 반영되도록, 바뀌지 않았으면 304라 가볍다)
    // /img/는 내용 해시 이름이라 영구 캐시, 나머지는 하루
    headers.set(
      "cache-control",
      ext === "html" ? "no-cache"
        : path.startsWith("/img/") ? "public, max-age=31536000, immutable"
        : "public, max-age=86400"
    );

    if (!("body" in obj)) return new Response(null, { status: 304, headers });
    return new Response(request.method === "HEAD" ? null : obj.body, { headers });
  },
};
