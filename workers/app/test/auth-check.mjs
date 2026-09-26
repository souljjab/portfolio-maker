// 로컬 Worker 인증 흐름 검증 — 먼저 npm run dev(:8787, .dev.vars의 EXPOSE_DEV_CODE=1) 후 npm run test:auth
const BASE = "http://127.0.0.1:8787";
const ORIGIN = "http://localhost:5173";
let cookie = "";
let problems = 0;
const check = (label, cond, extra = "") => { if (!cond) problems++; console.log(`${cond ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`); };

async function call(method, path, { body, origin = ORIGIN, csrf, form, useCookie = true } = {}) {
  const headers = {};
  if (origin) headers.Origin = origin;
  if (csrf) headers["X-CSRF-Token"] = csrf;
  if (useCookie && cookie) headers.Cookie = cookie;
  let payload;
  if (form) { payload = new URLSearchParams(form); }
  else if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
  const r = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
  const setCookie = r.headers.get("set-cookie");
  const type = r.headers.get("content-type") ?? "";
  const data = type.includes("json") ? await r.json() : await r.text();
  return { status: r.status, data, setCookie, headers: r.headers };
}

const email = `test${Date.now()}@example.com`;

// 1. 코드 요청
check("Origin 없는 요청 거부", (await call("POST", "/api/auth/start", { body: { email }, origin: null })).status === 403);
check("다른 Origin 거부(사용자 서브도메인 흉내)", (await call("POST", "/api/auth/start", { body: { email }, origin: "http://evil.localhost:5173" })).status === 403);
check("잘못된 이메일 거부", (await call("POST", "/api/auth/start", { body: { email: "not-an-email" } })).status === 400);
const start = await call("POST", "/api/auth/start", { body: { email: `  ${email.toUpperCase()} ` } });
check("코드 요청 성공(대소문자·공백 정리)", start.status === 200 && /^\d{6}$/.test(start.data.devCode ?? ""), JSON.stringify(start.data));
const code = start.data.devCode;

// 2. 코드 확인
const wrong = code === "000000" ? "111111" : "000000";
const w1 = await call("POST", "/api/auth/verify", { body: { email, code: wrong } });
check("틀린 코드 → 남은 횟수 안내", w1.status === 400 && w1.data.reason.includes("4번"), w1.data.reason);
check("형식이 틀린 코드 거부", (await call("POST", "/api/auth/verify", { body: { email, code: "12ab56" } })).status === 400);
const ok = await call("POST", "/api/auth/verify", { body: { email, code } });
check("맞는 코드 → 로그인", ok.status === 200 && ok.data.user?.email === email && ok.data.user.ageStatus === "unknown", JSON.stringify(ok.data.user));
check("세션 쿠키 속성(__Host-, HttpOnly, Secure, SameSite=Lax, Domain 없음)",
  /^__Host-session=[\w-]{40,};/.test(ok.setCookie ?? "") && /HttpOnly/.test(ok.setCookie) && /Secure/.test(ok.setCookie) && /SameSite=Lax/.test(ok.setCookie) && !/Domain=/i.test(ok.setCookie),
  ok.setCookie?.replace(/=[\w-]{20,}/, "=<token>"));
cookie = ok.setCookie.split(";")[0];
const csrf = ok.data.csrfToken;
check("같은 코드 재사용 불가", (await call("POST", "/api/auth/verify", { body: { email, code } })).status === 400);

// 3. 내 정보
const meRes = await call("GET", "/api/auth/me");
check("내 정보", meRes.data.user?.email === email && meRes.data.csrfToken === csrf);
check("쿠키 없으면 로그인 안 됨", (await call("GET", "/api/auth/me", { useCookie: false })).data.user === null);
check("응답 캐시 금지", meRes.headers.get("cache-control") === "no-store");

// 4. 나이 확인
check("CSRF 토큰 없으면 거부", (await call("POST", "/api/account/age", { body: { over14: false, guardianEmail: "p@example.com" } })).status === 403);
check("틀린 CSRF 토큰 거부", (await call("POST", "/api/account/age", { body: { over14: true }, csrf: "x".repeat(22) })).status === 403);
check("보호자 이메일이 내 이메일이면 거부", (await call("POST", "/api/account/age", { body: { over14: false, guardianEmail: email }, csrf })).status === 400);
const g = await call("POST", "/api/account/age", { body: { over14: false, guardianEmail: "parent@example.com" }, csrf });
check("만 14세 미만 → 보호자 동의 대기", g.status === 200 && g.data.user.ageStatus === "pending_guardian" && !g.data.user.canPublish && g.data.user.guardianEmail === "pa***@example.com", JSON.stringify(g.data.user));
check("미만이라고 답한 뒤 14세 이상으로 바꾸기 거부", (await call("POST", "/api/account/age", { body: { over14: true }, csrf })).status === 400);
check("보호자 메일 10분 안 재발송 제한", (await call("POST", "/api/account/age", { body: { over14: false, guardianEmail: "parent2@example.com" }, csrf })).status === 429);

// 5. 보호자 동의
const link = new URL(g.data.devLink);
const pageRes = await call("GET", link.pathname + link.search, { origin: null, useCookie: false });
check("동의 페이지: 여는 것만으로는 동의 안 됨 + 스크립트 금지 CSP",
  pageRes.status === 200 && pageRes.data.includes("동의합니다") && pageRes.headers.get("content-security-policy").includes("default-src 'none'"),
  pageRes.data.includes(email) ? "✗ 자녀 이메일이 그대로 노출됨" : "자녀 이메일은 가려서 표시");
check("아직 발행 불가", (await call("GET", "/api/auth/me")).data.user.canPublish === false);
const token = link.searchParams.get("token");
check("다른 Origin에서 온 동의 제출 거부", !(await call("POST", "/api/guardian/consent", { form: { token }, origin: "http://evil.example", useCookie: false })).data.includes("고마워요"));
const consent = await call("POST", "/api/guardian/consent", { form: { token }, useCookie: false });
check("보호자 동의 완료", consent.data.includes("고마워요"));
const after = (await call("GET", "/api/auth/me")).data.user;
check("동의 뒤 발행 가능", after.ageStatus === "guardian_ok" && after.canPublish === true, JSON.stringify(after));
check("동의 링크 재사용 불가", (await call("POST", "/api/guardian/consent", { form: { token }, useCookie: false })).data.includes("만료"));
check("가짜 토큰 거부", (await call("GET", "/api/guardian/consent?token=" + "a".repeat(43), { origin: null })).data.includes("만료"));

// 6. 로그아웃
const out = await call("POST", "/api/auth/logout", { csrf });
check("로그아웃 → 쿠키 삭제", out.status === 200 && /Max-Age=0/.test(out.setCookie ?? ""));
check("로그아웃한 세션으로는 로그인 안 됨", (await call("GET", "/api/auth/me")).data.user === null);

// 7. 시도 횟수·요청 횟수 제한
const email2 = `limit${Date.now()}@example.com`;
const s2 = await call("POST", "/api/auth/start", { body: { email: email2 } });
const bad = s2.data.devCode === "000000" ? "111111" : "000000";
let last;
for (let i = 0; i < 5; i++) last = await call("POST", "/api/auth/verify", { body: { email: email2, code: bad } });
const locked = await call("POST", "/api/auth/verify", { body: { email: email2, code: s2.data.devCode } });
check("5번 틀리면 맞는 코드도 거부", locked.status === 429, locked.data.reason);
for (let i = 0; i < 4; i++) await call("POST", "/api/auth/start", { body: { email: email2 } });
const sixth = await call("POST", "/api/auth/start", { body: { email: email2 } });
check("이메일당 시간당 5번 제한", sixth.status === 429, sixth.data.reason);
check("없는 주소 404", (await call("GET", "/api/nope")).status === 404);

console.log(problems ? `\n문제 ${problems}건` : "\n모두 통과");
