// 발행 흐름 검증 — workers/app(npm run dev, :8787)과 workers/router(npm run dev, :8788)를 띄운 뒤 npm run test:publish
// 두 Worker는 ../../.wrangler/state 를 함께 써서, 여기서 발행한 사이트를 라우터로 바로 열어 볼 수 있다.
import http from "node:http";

const API = "http://127.0.0.1:8787";
const ORIGIN = "http://localhost:5173";
let problems = 0;
const check = (label, cond, extra = "") => { if (!cond) problems++; console.log(`${cond ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`); };

/** 계정 하나: 쿠키·CSRF를 들고 다니는 요청기 */
async function login(email, over14 = true) {
  let cookie = "", csrf = "";
  const call = async (method, path, { body, raw, type } = {}) => {
    const headers = { Origin: ORIGIN };
    if (cookie) headers.Cookie = cookie;
    if (csrf && method !== "GET") headers["X-CSRF-Token"] = csrf;
    if (body !== undefined) headers["content-type"] = "application/json";
    if (raw) headers["content-type"] = type;
    const r = await fetch(API + path, { method, headers, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    const sc = r.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    return { status: r.status, data: await r.json() };
  };
  const s = await call("POST", "/api/auth/start", { body: { email } });
  const v = await call("POST", "/api/auth/verify", { body: { email, code: s.data.devCode } });
  csrf = v.data.csrfToken;
  await call("POST", "/api/account/age", { body: over14 ? { over14: true } : { over14: false, guardianEmail: `parent-${email}` } });
  return { call, setCsrf: (v) => { csrf = v; } };
}

/** 라우터(:8788)에 Host 헤더를 붙여 요청 (주소.localhost) */
function site(slug, path = "/", extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: 8788, path, headers: { Host: `${slug}.localhost:8788`, ...extraHeaders } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

const TOKENS = { color: { bg: "#FBFAF7", surface: "#F1EEE6", text: "#1D1C1A", muted: "#57534B", accent: "#8A3B2E", onAccent: "#FFFFFF" },
  type: { display: "Noto Serif KR", body: "Pretendard", mono: null, scaleRatio: 1.333, baseSize: 17 },
  space: { unit: 8, section: 128 }, radius: { sm: 2, lg: 4 }, motion: { duration: 320, easing: "ease-out", level: "subtle" } };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const stamp = Date.now().toString(36);
const slugA = `pub-${stamp}`, slugA2 = `pub2-${stamp}`;
const portfolio = (cover) => ({
  person: { name: "<script>alert(1)</script>이도윤", headline: "한 줄", bio: "소개", links: [{ label: "GitHub", url: "https://github.com/" }, { label: "나쁜", url: "javascript:alert(1)" }] },
  projects: [{ id: "a", title: "작업", summary: "요약", role: "개발", year: "2026", tags: ["웹"], cover, coverAlt: "초록 점" }],
  sections: ["hero", "projects", "about", "contact"], template: "quiet-editorial", grammar: "quiet-editorial", tokens: TOKENS, secret: "무시돼야 함",
});

const A = await login(`a-${stamp}@example.com`);

// 이미지 업로드
const img = await A.call("POST", "/api/images", { raw: PNG, type: "image/png" });
check("이미지 업로드 (형식은 파일 앞 바이트로 확인)", img.status === 200 && /^[a-f0-9]{64}\.png$/.test(img.data.key), img.data.key);
check("같은 이미지는 같은 이름", (await A.call("POST", "/api/images", { raw: PNG, type: "image/png" })).data.key === img.data.key);
const fake = await A.call("POST", "/api/images", { raw: Buffer.from("<svg onload=alert(1)>"), type: "image/png" });
check("이미지인 척하는 파일 거부", fake.status === 415, fake.data.reason);

// 주소 검사
check("예약어 주소 거부", (await A.call("GET", "/api/slug?name=api")).data.ok === false);
check("빈 주소 사용 가능", (await A.call("GET", `/api/slug?name=${slugA}`)).data.ok === true);

// 잘못된 발행
check("템플릿 없으면 거부", (await A.call("POST", "/api/publish", { body: { slug: slugA, portfolio: { ...portfolio(null), template: "evil" } } })).status === 400);
check("이름이 비면 거부", (await A.call("POST", "/api/publish", { body: { slug: slugA, portfolio: { ...portfolio(null), person: { ...portfolio(null).person, name: "  " } } } })).status === 400);
check("올린 적 없는 이미지 거부", (await A.call("POST", "/api/publish", { body: { slug: slugA, portfolio: portfolio(`upload:${"c".repeat(64)}.png`) } })).status === 400);
// javascript: 링크는 편집기에서 막지만 서버도 다시 검사해야 한다 → 고칠 곳으로 거부
const badLink = await A.call("POST", "/api/publish", { body: { slug: slugA, portfolio: portfolio(null) } });
check("javascript: 링크가 있으면 서버도 거부", badLink.status === 400, badLink.data.reason);

// 정상 발행
const good = portfolio(`upload:${img.data.key}`);
good.person.links = good.person.links.slice(0, 1);
const pub = await A.call("POST", "/api/publish", { body: { slug: slugA, portfolio: good } });
check("발행", pub.status === 200 && pub.data.url === `http://${slugA}.localhost:8788`, pub.data.url ?? pub.data.reason);
check("내 사이트", (await A.call("GET", "/api/site")).data.site?.slug === slugA);

// 라우터로 실제 열기
const page = await site(slugA);
const htmlText = page.body.toString();
const csp = page.headers["content-security-policy"] ?? "";
check("사이트 열림", page.status === 200 && page.headers["content-type"].startsWith("text/html"));
check("CSP: 스크립트 전면 금지 + 이미지는 사이트 안만", csp.includes("script-src 'none'") && csp.includes("img-src 'self'") && csp.includes("cdn.jsdelivr.net"), csp);
check("HTML에 스크립트 없음 · 이름 이스케이프", !/<script/i.test(htmlText) && htmlText.includes("&lt;script&gt;"));
check("모르는 필드는 버림", !htmlText.includes("무시돼야 함"));
check("HTML은 매번 확인(no-cache) — 비공개가 바로 반영", page.headers["cache-control"] === "no-cache");
const again = await site(slugA, "/", { "If-None-Match": page.headers.etag });
check("바뀌지 않았으면 304(본문 없음)", again.status === 304 && again.body.length === 0, `etag ${page.headers.etag}`);
const imgPath = htmlText.match(/src="(\/img\/[a-f0-9]{64}\.png)"/)?.[1];
check("이미지가 사이트 안 경로로", Boolean(imgPath) && htmlText.includes('alt="초록 점"'), imgPath);
const imgRes = await site(slugA, imgPath);
check("이미지 서빙 + 영구 캐시", imgRes.status === 200 && imgRes.headers["content-type"] === "image/png" && /immutable/.test(imgRes.headers["cache-control"]));

// 다른 사람
const B = await login(`b-${stamp}@example.com`);
check("다른 사람에겐 이미 사용 중", (await B.call("GET", `/api/slug?name=${slugA}`)).data.reason === "이미 사용 중인 이름입니다.");
check("다른 사람이 같은 주소로 발행 불가", (await B.call("POST", "/api/publish", { body: { slug: slugA, portfolio: { ...good, projects: [] } } })).status === 409);
check("다른 사람의 이미지 키로 발행 불가", (await B.call("POST", "/api/publish", { body: { slug: `b-${stamp}`, portfolio: good } })).status === 400);
const C = await login(`c-${stamp}@example.com`, false);
check("보호자 동의 전이면 발행 불가", (await C.call("POST", "/api/publish", { body: { slug: `c-${stamp}`, portfolio: { ...good, projects: [] } } })).status === 403);

// 주소 옮기기 · 비공개
const moved = await A.call("POST", "/api/publish", { body: { slug: slugA2, portfolio: good } });
check("다른 주소로 다시 발행", moved.status === 200);
check("예전 주소는 내려감", (await site(slugA)).status === 404);
check("새 주소로 열림", (await site(slugA2)).status === 200);
check("예전 주소는 다시 쓸 수 있음", (await B.call("GET", `/api/slug?name=${slugA}`)).data.ok === true);
const off = await A.call("POST", "/api/site/unpublish");
check("비공개로 바꾸기", off.status === 200 && (await site(slugA2)).status === 404 && (await A.call("GET", "/api/site")).data.site === null);
A.setCsrf("");
check("CSRF 없이 발행 불가", (await A.call("POST", "/api/publish", { body: { slug: slugA, portfolio: good } })).status === 403);

console.log(problems ? `\n문제 ${problems}건` : "\n모두 통과");
process.exitCode = problems ? 1 : 0;
