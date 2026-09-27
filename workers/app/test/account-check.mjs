// 계정 삭제(7일 유예)·보호자 동의 철회 검증 — API(:8787)·라우터(:8788)를 띄운 뒤 npm run test:account
// 유예 7일은 기다릴 수 없어서, 로컬 전용 /api/dev/purge { days }로 "며칠 뒤"라고 치고 정리 작업을 돌린다.
import http from "node:http";
const API = "http://127.0.0.1:8787";
const ORIGIN = "http://localhost:5173";
let problems = 0;
const check = (label, cond, extra = "") => { if (!cond) problems++; console.log(`${cond ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`); };

async function login(email, age = "over14") {
  let cookie = "", csrf = "";
  const call = async (method, path, { body, raw, type, form, origin = ORIGIN } = {}) => {
    const headers = {};
    if (origin) headers.Origin = origin;
    if (cookie) headers.Cookie = cookie;
    if (csrf && method !== "GET") headers["X-CSRF-Token"] = csrf;
    if (body !== undefined) headers["content-type"] = "application/json";
    if (raw) headers["content-type"] = type;
    if (form) headers["content-type"] = "application/x-www-form-urlencoded";
    const r = await fetch(API + path, { method, headers, redirect: "manual", body: form ? new URLSearchParams(form) : raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    const sc = r.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    const ct = r.headers.get("content-type") ?? "";
    return { status: r.status, data: ct.includes("json") ? await r.json() : await r.text() };
  };
  const s = await call("POST", "/api/auth/start", { body: { turnstileToken: "XXXX.DUMMY.TOKEN.XXXX", email } });
  const v = await call("POST", "/api/auth/verify", { body: { email, code: s.data.devCode } });
  csrf = v.data.csrfToken;
  let ageRes;
  if (age === "over14") ageRes = await call("POST", "/api/account/age", { body: { over14: true } });
  if (age === "minor") ageRes = await call("POST", "/api/account/age", { body: { over14: false, guardianEmail: `parent-${email}` } });
  return { call, age: ageRes };
}
function site(slug) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: 8788, path: "/", headers: { Host: `${slug}.localhost:8788` } }, (res) => {
      res.resume(); res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject); req.end();
  });
}
const TOKENS = { color: { bg: "#FBFAF7", surface: "#F1EEE6", text: "#1D1C1A", muted: "#57534B", accent: "#8A3B2E", onAccent: "#FFFFFF" },
  type: { display: "Noto Serif KR", body: "Pretendard", mono: null, scaleRatio: 1.333, baseSize: 17 },
  space: { unit: 8, section: 128 }, radius: { sm: 2, lg: 4 }, motion: { duration: 320, easing: "ease-out", level: "subtle" } };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const portfolio = (cover) => ({
  person: { name: "테스트", headline: "한 줄", bio: "소개", links: [{ label: "GitHub", url: "https://github.com/" }] },
  projects: [{ id: "a", title: "작업", summary: "요약", role: "", year: "2026", tags: [], cover, coverAlt: "" }],
  sections: ["hero", "projects", "about", "contact"], template: "quiet-editorial", grammar: "quiet-editorial", tokens: TOKENS,
});
const stamp = Date.now().toString(36);
const purge = (days) => fetch(`${API}/api/dev/purge`, { method: "POST", headers: { Origin: ORIGIN, "content-type": "application/json" }, body: JSON.stringify({ days }) }).then((r) => r.json());

/* ── 계정 삭제 (7일 유예) ─────────────────────────────────────────── */
console.log("— 계정 삭제");
const email = `del-${stamp}@example.com`, slug = `del-${stamp}`;
let A = await login(email);
const img = await A.call("POST", "/api/images", { raw: PNG, type: "image/png" });
const pub = await A.call("POST", "/api/publish", { body: { slug, portfolio: portfolio(`upload:${img.data.key}`) } });
await A.call("PUT", "/api/drafts", { body: { baseVersion: 0, portfolio: { person: { name: "초안" } }, interview: null } });
await A.call("POST", "/api/versions", { body: { label: "v", portfolio: { a: 1 } } });
check("준비: 발행한 사이트가 열림", pub.status === 200 && (await site(slug)) === 200);

check("이메일이 다르면 삭제 안 됨", (await A.call("POST", "/api/account/delete", { body: { confirmEmail: "other@example.com" } })).status === 400);
check("다른 출처에서 온 삭제 요청 거부", (await A.call("POST", "/api/account/delete", { body: { confirmEmail: email }, origin: "http://evil.localhost:5173" })).status === 403);
const del = await A.call("POST", "/api/account/delete", { body: { confirmEmail: ` ${email.toUpperCase()} ` } });
const days = (del.data.deletionScheduledAt - Date.now()) / 86_400_000;
check("삭제 예약: 7일 뒤로 잡힘 (대소문자·공백 무시)", del.status === 200 && days > 6.9 && days <= 7, days.toFixed(3));
check("사이트는 바로 내려감", (await site(slug)) === 404 && (await A.call("GET", "/api/site")).data.site === null);
const me1 = (await A.call("GET", "/api/auth/me")).data.user;
check("계정 정보에 삭제 예정일 표시", me1.deletionScheduledAt === del.data.deletionScheduledAt);
check("유예 중엔 발행 불가", (await A.call("POST", "/api/publish", { body: { slug, portfolio: portfolio(null) } })).status === 403);
check("유예 중에도 초안은 남아 있음(취소 대비)", (await A.call("GET", "/api/drafts")).data.portfolio?.person?.name === "초안");

check("삭제 취소", (await A.call("POST", "/api/account/delete/cancel")).status === 200 && (await A.call("GET", "/api/auth/me")).data.user.deletionScheduledAt === null);
check("취소하면 다시 발행 가능", (await A.call("POST", "/api/publish", { body: { slug, portfolio: portfolio(null) } })).status === 200 && (await site(slug)) === 200);

await A.call("POST", "/api/account/delete", { body: { confirmEmail: email } });
const p6 = await purge(6);
check("6일째엔 아직 안 지움", p6.ok && (await A.call("GET", "/api/auth/me")).data.user?.email === email);
const p8 = await purge(8);
check("7일이 지나면 정리 작업이 지움 (세션도 끝남)", p8.purged >= 1 && (await A.call("GET", "/api/auth/me")).data.user === null);
A = await login(email);
check("같은 이메일로 다시 가입하면 빈 새 계정", (await A.call("GET", "/api/drafts")).data.version === 0 && (await A.call("GET", "/api/versions")).data.versions.length === 0);
check("예전에 올린 이미지는 못 받음", (await A.call("GET", `/api/images/${img.data.key}`)).status === 404);

/* ── 보호자 동의 철회 ─────────────────────────────────────────────── */
console.log("— 보호자 동의 철회");
const kidEmail = `kid-${stamp}@example.com`, kidSlug = `kid-${stamp}`;
const K = await login(kidEmail, "minor");
const consentToken = new URL(K.age.data.devLink).searchParams.get("token");
const done = await K.call("POST", "/api/guardian/consent", { form: { token: consentToken } });
const withdrawLink = /href="([^"]*\/api\/guardian\/withdraw\?token=[^"]+)"/.exec(done.data)?.[1];
check("동의 완료 페이지에 철회 링크", done.status === 200 && Boolean(withdrawLink));
const wToken = new URL(withdrawLink.replace(/&amp;/g, "&")).searchParams.get("token");
const kimg = await K.call("POST", "/api/images", { raw: PNG, type: "image/png" });
await K.call("POST", "/api/publish", { body: { slug: kidSlug, portfolio: portfolio(`upload:${kimg.data.key}`) } });
await K.call("PUT", "/api/drafts", { body: { baseVersion: 0, portfolio: { person: { name: "아이 초안" } }, interview: null } });
await K.call("POST", "/api/versions", { body: { label: "v", portfolio: { a: 1 } } });
check("준비: 동의 뒤 발행·동기화", (await site(kidSlug)) === 200 && (await K.call("GET", "/api/drafts")).data.version === 1);

const wpage = await K.call("GET", `/api/guardian/withdraw?token=${encodeURIComponent(wToken)}`);
check("철회 페이지: 지워지는 것 안내 + 버튼", wpage.status === 200 && wpage.data.includes("동의를 철회합니다") && wpage.data.includes("script-src") === false);
check("링크를 여는 것만으론 철회 안 됨", (await K.call("GET", "/api/auth/me")).data.user.canPublish === true && (await site(kidSlug)) === 200);
const badOrigin = await K.call("POST", "/api/guardian/withdraw", { form: { token: wToken }, origin: "http://evil.localhost:5173" });
check("다른 출처의 철회 요청 거부", !badOrigin.data.includes("철회했어요") && (await K.call("GET", "/api/auth/me")).data.user.canPublish === true);
check("틀린 토큰은 거부", (await K.call("POST", "/api/guardian/withdraw", { form: { token: "x".repeat(40) } })).data.includes("쓸 수 없는 링크"));

const w = await K.call("POST", "/api/guardian/withdraw", { form: { token: wToken } });
check("철회 완료", w.status === 200 && w.data.includes("철회했어요"));
const kme = (await K.call("GET", "/api/auth/me")).data.user;
check("아이 계정은 남고 '동의 전'으로 (철회 표시)", kme.email === kidEmail && kme.ageStatus === "pending_guardian" && kme.canPublish === false && kme.guardianWithdrawn === true);
check("사이트 내려감", (await site(kidSlug)) === 404);
check("서버 초안·버전은 막히고 지워짐", (await K.call("GET", "/api/drafts")).status === 403 && (await K.call("GET", "/api/versions")).status === 403);
check("올린 이미지도 지워짐", (await K.call("GET", `/api/images/${kimg.data.key}`)).status === 404);
check("같은 철회 링크는 다시 못 씀", (await K.call("GET", `/api/guardian/withdraw?token=${encodeURIComponent(wToken)}`)).data.includes("쓸 수 없는 링크"));

const again = await K.call("POST", "/api/account/age", { body: { over14: false, guardianEmail: `parent-${kidEmail}` } });
const t2 = new URL(again.data.devLink).searchParams.get("token");
const done2 = await K.call("POST", "/api/guardian/consent", { form: { token: t2 } });
const w2 = /withdraw\?token=([^"&]+)/.exec(done2.data)?.[1];
check("다시 동의 요청·동의 가능, 새 철회 링크", again.status === 200 && done2.data.includes("고마워요") && w2 && decodeURIComponent(w2) !== wToken);
const kme2 = (await K.call("GET", "/api/auth/me")).data.user;
check("다시 동의하면 공개 가능, 예전 데이터는 없음", kme2.canPublish && !kme2.guardianWithdrawn && (await K.call("GET", "/api/drafts")).data.version === 0);

console.log(problems ? `\n문제 ${problems}건` : "\n모두 통과");
process.exitCode = problems ? 1 : 0;
