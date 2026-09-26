/**
 * 이메일 6자리 코드 로그인 + 세션 + 나이 확인·보호자 동의.
 * - 코드: 10분 유효, 5번까지 시도, 새 코드를 받으면 이전 코드는 무효. 이메일당 시간당 5번, IP당 20번까지 요청.
 * - 코드 요청 응답은 가입 여부와 상관없이 같다(이메일로 가입 여부를 알아낼 수 없게).
 * - 세션: 30일, 쿠키엔 토큰, DB엔 해시. 상태를 바꾸는 요청은 Origin + CSRF 토큰 검사.
 */
import { randomCode, randomToken, sha256, hmac, safeEqual } from "./lib/crypto.js";
import { json, fail, html, esc, readJson, readSessionCookie, sessionCookie, clearSessionCookie, fromApp, clientIp } from "./lib/http.js";
import { sendMail, loginCodeMail, guardianMail } from "./lib/mail.js";

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const CODE_TTL = 10 * MIN, CODE_TRIES = 5;
const SESSION_TTL = 30 * DAY;
const GUARDIAN_TTL = 7 * DAY;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normalizeEmail(v) {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}
/** 보호자에게 보여줄 때: se***@gmail.com */
const maskEmail = (e) => e.replace(/^(.{1,2})[^@]*/, (_, head) => `${head}***`);

function publicUser(u) {
  return {
    email: u.email,
    ageStatus: u.age_status,
    canPublish: u.age_status === "ok" || u.age_status === "guardian_ok",
    guardianEmail: u.guardian_email ? maskEmail(u.guardian_email) : null,
  };
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true; // 설정 전(로컬 개발 등)에는 생략
  if (!token) return false;
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
  });
  return (await r.json().catch(() => ({}))).success === true;
}

/** 요청의 세션과 사용자 (없으면 null) */
export async function getSession(request, env) {
  const token = readSessionCookie(request);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT s.id_hash, s.csrf, u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id_hash = ? AND s.expires_at > ?`,
  ).bind(await sha256(token), Date.now()).first();
  return row ? { idHash: row.id_hash, csrf: row.csrf, user: row } : null;
}

/** 로그인이 필요하고 상태를 바꾸는 요청: 세션 + Origin + CSRF 토큰 */
export async function requireSession(request, env) {
  if (!fromApp(request, env)) return { error: fail(403, "잘못된 요청이에요.") };
  const s = await getSession(request, env);
  if (!s) return { error: fail(401, "로그인이 필요해요.") };
  if (!safeEqual(request.headers.get("X-CSRF-Token") ?? "", s.csrf)) return { error: fail(403, "잘못된 요청이에요. 새로고침한 뒤 다시 해 주세요.") };
  return { session: s };
}

// POST /api/auth/start { email, turnstileToken? }
export async function startLogin(request, env) {
  if (!fromApp(request, env)) return fail(403, "잘못된 요청이에요.");
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  if (!email) return fail(400, "이메일 주소를 확인해 주세요.");
  const ip = clientIp(request);
  if (!(await verifyTurnstile(env, body?.turnstileToken, ip))) return fail(400, "잠시 뒤 다시 시도해 주세요.");

  const now = Date.now();
  await env.DB.prepare("DELETE FROM login_codes WHERE created_at < ?").bind(now - DAY).run();
  const count = (sql, v) => env.DB.prepare(sql).bind(v, now - HOUR).first("n");
  const [byEmail, byIp] = await Promise.all([
    count("SELECT COUNT(*) AS n FROM login_codes WHERE email = ? AND created_at > ?", email),
    count("SELECT COUNT(*) AS n FROM login_codes WHERE ip = ? AND created_at > ?", ip),
  ]);
  // IP 제한은 기본 20 — 로컬 개발(모든 요청이 한 IP)에서만 .dev.vars의 LOGIN_IP_LIMIT로 넉넉하게
  const ipLimit = Number(env.LOGIN_IP_LIMIT) || 20;
  if (byEmail >= 5 || byIp >= ipLimit) return fail(429, "코드를 너무 자주 요청했어요. 한 시간쯤 뒤에 다시 해 주세요.");

  const code = randomCode();
  await env.DB.batch([
    env.DB.prepare("UPDATE login_codes SET used = 1 WHERE email = ? AND used = 0").bind(email), // 새 코드만 유효
    env.DB.prepare("INSERT INTO login_codes (email, code_hash, ip, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
      .bind(email, await hmac(env.CODE_PEPPER, `${email}:${code}`), ip, now, now + CODE_TTL),
  ]);
  const sent = await sendMail(env, loginCodeMail(email, code));
  if (!sent.ok) return fail(502, "메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  // devCode: 로컬 개발(.dev.vars의 EXPOSE_DEV_CODE=1)에서만. 배포 설정에는 이 값이 없다.
  return json({ ok: true, ...(env.EXPOSE_DEV_CODE === "1" ? { devCode: code } : {}) });
}

// POST /api/auth/verify { email, code }
export async function verifyLogin(request, env) {
  if (!fromApp(request, env)) return fail(403, "잘못된 요청이에요.");
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!email || !/^\d{6}$/.test(code)) return fail(400, "6자리 숫자 코드를 입력해 주세요.");

  const now = Date.now();
  const row = await env.DB.prepare(
    "SELECT * FROM login_codes WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1",
  ).bind(email).first();
  if (!row || row.expires_at < now) return fail(400, "코드가 만료됐어요. 새 코드를 받아 주세요.");
  if (row.attempts >= CODE_TRIES) return fail(429, "여러 번 틀려서 이 코드는 더 쓸 수 없어요. 새 코드를 받아 주세요.");

  if (!safeEqual(await hmac(env.CODE_PEPPER, `${email}:${code}`), row.code_hash)) {
    await env.DB.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?").bind(row.id).run();
    const left = CODE_TRIES - row.attempts - 1;
    return fail(400, left > 0 ? `코드가 맞지 않아요. ${left}번 더 시도할 수 있어요.` : "여러 번 틀려서 이 코드는 더 쓸 수 없어요. 새 코드를 받아 주세요.");
  }

  await env.DB.prepare("UPDATE login_codes SET used = 1 WHERE id = ?").bind(row.id).run();
  let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (!user) {
    await env.DB.prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)").bind(crypto.randomUUID(), email, now).run();
    user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  }
  const token = randomToken();
  const csrf = randomToken(16);
  await env.DB.prepare("INSERT INTO sessions (id_hash, user_id, csrf, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(await sha256(token), user.id, csrf, now, now + SESSION_TTL).run();
  return json({ ok: true, user: publicUser(user), csrfToken: csrf }, 200, { "Set-Cookie": sessionCookie(token, SESSION_TTL / 1000) });
}

// GET /api/auth/me
export async function me(request, env) {
  const s = await getSession(request, env);
  return json({ ok: true, user: s ? publicUser(s.user) : null, csrfToken: s?.csrf ?? null });
}

// POST /api/auth/logout
export async function logout(request, env) {
  const { session, error } = await requireSession(request, env);
  if (error) return error;
  await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(session.idHash).run();
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}

// POST /api/account/age { over14: boolean, guardianEmail?: string }
export async function setAge(request, env) {
  const { session, error } = await requireSession(request, env);
  if (error) return error;
  const u = session.user;
  if (u.age_status === "ok" || u.age_status === "guardian_ok") return json({ ok: true, user: publicUser(u) });
  const body = await readJson(request);
  const now = Date.now();

  if (body?.over14 === true) {
    // 한번 만 14세 미만이라고 답했으면 스스로 바꿔서 보호자 동의를 건너뛸 수 없다(바로잡기는 문의로)
    if (u.age_status === "pending_guardian") return fail(400, "만 14세 미만이라고 알려 주셨어요. 공개하려면 보호자 동의가 필요해요.");
    await env.DB.prepare("UPDATE users SET age_status = 'ok' WHERE id = ?").bind(u.id).run();
    return json({ ok: true, user: publicUser({ ...u, age_status: "ok" }) });
  }
  if (body?.over14 !== false) return fail(400, "나이를 골라 주세요.");

  const guardian = normalizeEmail(body.guardianEmail);
  if (!guardian) return fail(400, "보호자 이메일 주소를 확인해 주세요.");
  if (guardian === u.email) return fail(400, "보호자의 이메일 주소를 적어 주세요. 내 이메일과 달라야 해요.");
  if (u.guardian_requested_at && now - u.guardian_requested_at < 10 * MIN) {
    return fail(429, "보호자에게 방금 메일을 보냈어요. 10분 뒤에 다시 보낼 수 있어요.");
  }
  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM guardian_tokens WHERE user_id = ?").bind(u.id), // 이전 요청 링크는 무효
    env.DB.prepare("INSERT INTO guardian_tokens (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(await sha256(token), u.id, now, now + GUARDIAN_TTL),
    env.DB.prepare("UPDATE users SET age_status = 'pending_guardian', guardian_email = ?, guardian_requested_at = ? WHERE id = ?")
      .bind(guardian, now, u.id),
  ]);
  const link = `${env.APP_ORIGIN}/api/guardian/consent?token=${encodeURIComponent(token)}`;
  const sent = await sendMail(env, guardianMail(guardian, maskEmail(u.email), link));
  if (!sent.ok) return fail(502, "보호자에게 메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  return json({
    ok: true,
    user: publicUser({ ...u, age_status: "pending_guardian", guardian_email: guardian }),
    ...(env.EXPOSE_DEV_CODE === "1" ? { devLink: link } : {}),
  });
}

const page = (title, body) => html(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{margin:0;background:#FAFAF8;color:#1A1A1A;font:17px/1.65 system-ui,sans-serif;word-break:keep-all}main{max-width:36rem;margin:0 auto;padding:3rem 1.25rem}h1{font-size:1.5rem;line-height:1.3}ul{padding-left:1.25rem}button{min-height:48px;padding:0 1.5rem;border:0;border-radius:12px;background:#2745D6;color:#fff;font:inherit;font-weight:700;cursor:pointer}button:focus-visible{outline:3px solid #2745D6;outline-offset:3px}.muted{color:#5C5C5C}</style></head><body><main>${body}</main></body></html>`);

async function findGuardianToken(env, token) {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  return env.DB.prepare(
    `SELECT g.token_hash, u.id AS user_id, u.email FROM guardian_tokens g JOIN users u ON u.id = g.user_id
     WHERE g.token_hash = ? AND g.expires_at > ?`,
  ).bind(await sha256(token), Date.now()).first();
}

const expired = () => page("링크가 만료됐어요", `<h1>링크가 만료됐거나 이미 사용됐어요</h1><p class="muted">자녀에게 다시 요청해 달라고 해 주세요.</p>`);

/**
 * GET /api/guardian/consent?token= — 안내와 동의 버튼만 보여준다.
 * 링크를 여는 것만으로는 동의되지 않는다(메일 보안 스캐너가 링크를 미리 열어 보는 경우가 있어서).
 */
export async function guardianPage(request, env) {
  const token = new URL(request.url).searchParams.get("token");
  const g = await findGuardianToken(env, token);
  if (!g) return expired();
  return page("보호자 동의", `<h1>자녀의 포트폴리오 공개 동의</h1>
<p><strong>${esc(maskEmail(g.email))}</strong> 계정의 사용자가 자기 포트폴리오 사이트를 공개하려고 해요.</p>
<p>동의하시면 아래 정보를 이렇게 써요.</p>
<ul>
<li>자녀의 이메일: 로그인과 안내 메일에만</li>
<li>자녀가 직접 쓴 이름·소개·작업·이미지: 자녀가 공개를 고른 사이트에 표시</li>
<li>보호자님의 이메일: 이 동의 확인에만</li>
</ul>
<p class="muted">동의는 언제든 철회할 수 있고, 철회하면 사이트는 비공개로 바뀌어요.</p>
<form method="post" action="/api/guardian/consent"><input type="hidden" name="token" value="${esc(token)}"><button type="submit">동의합니다</button></form>
<p class="muted">동의하지 않으시면 이 창을 닫으시면 돼요.</p>`);
}

// POST /api/guardian/consent (form)
export async function guardianConsent(request, env) {
  if (!fromApp(request, env)) return page("잘못된 요청", "<h1>잘못된 요청이에요</h1>");
  const form = await request.formData().catch(() => null);
  const g = await findGuardianToken(env, form?.get("token"));
  if (!g) return expired();
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET age_status = 'guardian_ok', guardian_consented_at = ? WHERE id = ?").bind(Date.now(), g.user_id),
    env.DB.prepare("DELETE FROM guardian_tokens WHERE user_id = ?").bind(g.user_id),
  ]);
  return page("동의 완료", `<h1>동의해 주셔서 고마워요</h1><p>이제 자녀가 포트폴리오를 공개할 수 있어요. 이 창은 닫으셔도 돼요.</p>`);
}
