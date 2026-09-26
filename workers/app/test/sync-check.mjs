// 초안 동기화 검증 — workers/app(npm run dev, :8787)을 띄운 뒤 npm run test:sync
const API = "http://127.0.0.1:8787";
const ORIGIN = "http://localhost:5173";
let problems = 0;
const check = (label, cond, extra = "") => { if (!cond) problems++; console.log(`${cond ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`); };

/** 기기 하나 = 로그인 세션 하나 (같은 계정으로 여러 번 로그인하면 여러 기기) */
async function device(email, over14 = true) {
  let cookie = "", csrf = "";
  const call = async (method, path, { body, raw, type, noCsrf } = {}) => {
    const headers = { Origin: ORIGIN };
    if (cookie) headers.Cookie = cookie;
    if (csrf && method !== "GET" && !noCsrf) headers["X-CSRF-Token"] = csrf;
    if (body !== undefined) headers["content-type"] = "application/json";
    if (raw) headers["content-type"] = type;
    const r = await fetch(API + path, { method, headers, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    const sc = r.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    const ct = r.headers.get("content-type") ?? "";
    return { status: r.status, headers: r.headers, data: ct.includes("json") ? await r.json() : new Uint8Array(await r.arrayBuffer()) };
  };
  const s = await call("POST", "/api/auth/start", { body: { email } });
  const v = await call("POST", "/api/auth/verify", { body: { email, code: s.data.devCode } });
  csrf = v.data.csrfToken;
  if (v.data.user.ageStatus === "unknown") {
    await call("POST", "/api/account/age", { body: over14 ? { over14: true } : { over14: false, guardianEmail: `parent-${email}` } });
  }
  return call;
}

const stamp = Date.now().toString(36);
const email = `sync-${stamp}@example.com`;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const phone = await device(email);
const empty = await phone("GET", "/api/drafts");
check("처음엔 서버 초안 없음(version 0)", empty.data.ok && empty.data.version === 0);
const p1 = await phone("PUT", "/api/drafts", { body: { baseVersion: 0, portfolio: { person: { name: "폰에서" } }, interview: { step: "cards" } } });
check("처음 저장 → version 1", p1.data.ok && p1.data.version === 1);
const again0 = await phone("PUT", "/api/drafts", { body: { baseVersion: 0, portfolio: { person: { name: "x" } }, interview: null } });
check("처음 저장을 또 하면 충돌(다른 기기가 먼저 올린 경우)", again0.status === 409 && again0.data.conflict && again0.data.version === 1);
const p2 = await phone("PUT", "/api/drafts", { body: { baseVersion: 1, portfolio: { person: { name: "폰에서 고침" } }, interview: { step: "done" } } });
check("이어 저장 → version 2", p2.data.version === 2);

const laptop = await device(email); // 같은 계정, 다른 기기
const got = await laptop("GET", "/api/drafts");
check("다른 기기에서 받기", got.data.version === 2 && got.data.portfolio.person.name === "폰에서 고침" && got.data.interview.step === "done");
const stale = await laptop("PUT", "/api/drafts", { body: { baseVersion: 1, portfolio: { person: { name: "노트북 옛 버전" } }, interview: null } });
check("옛 버전 위에 저장하면 충돌 — 덮어쓰지 않음", stale.status === 409 && (await laptop("GET", "/api/drafts")).data.portfolio.person.name === "폰에서 고침");
const resolved = await laptop("PUT", "/api/drafts", { body: { baseVersion: 2, portfolio: { person: { name: "노트북으로 결정" } }, interview: null } });
check("충돌 뒤 최신 버전을 알고 저장하면 됨", resolved.data.version === 3);
check("CSRF 없으면 저장 거부", (await laptop("PUT", "/api/drafts", { body: { baseVersion: 3, portfolio: null, interview: null }, noCsrf: true })).status === 403);
check("형식이 틀리면 거부", (await laptop("PUT", "/api/drafts", { body: { baseVersion: "3", portfolio: [], interview: null } })).status === 400);
const big = await laptop("PUT", "/api/drafts", { body: { baseVersion: 3, portfolio: { blob: "x".repeat(520 * 1024) }, interview: null } });
check("너무 큰 초안 거부", big.status === 413 || big.status === 400, String(big.status));

// 이미지
const up = await phone("POST", "/api/images", { raw: PNG, type: "image/png" });
const img = await laptop("GET", `/api/images/${up.data.key}`);
check("다른 기기에서 내 이미지 받기", img.status === 200 && img.headers.get("content-type") === "image/png" && img.data.length === PNG.length && /private/.test(img.headers.get("cache-control")));
const other = await device(`other-${stamp}@example.com`);
check("다른 사람의 이미지는 못 받음", (await other("GET", `/api/images/${up.data.key}`)).status === 404);
// fetch는 ../를 미리 정리하므로, 서버에 그대로 닿도록 인코딩해서 보낸다
check("경로를 벗어나는 이미지 이름 거부", (await laptop("GET", `/api/images/..%2F..%2Fsites%2Fx%2Findex.html`)).status === 404);
check("다른 사람 폴더를 가리키는 이름 거부", (await laptop("GET", `/api/images/${"a".repeat(64)}.png%2F..%2F..`)).status === 404);
check("다른 사람의 초안은 안 보임", (await other("GET", "/api/drafts")).data.version === 0);

// 만 14세 미만(보호자 동의 전)
const kid = await device(`kid-${stamp}@example.com`, false);
check("보호자 동의 전엔 서버에 초안을 두지 않음", (await kid("GET", "/api/drafts")).status === 403 && (await kid("PUT", "/api/drafts", { body: { baseVersion: 0, portfolio: { person: { name: "아이" } }, interview: null } })).status === 403);

console.log(problems ? `\n문제 ${problems}건` : "\n모두 통과");
process.exitCode = problems ? 1 : 0;
