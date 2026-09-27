/**
 * 초안 동기화: 계정당 포트폴리오 초안 + 인터뷰 세션 한 벌, 버전으로 충돌을 막는다(낙관적 잠금).
 * 나이 확인이 끝난 계정만 — 만 14세 미만의 개인정보(이름·작업·사진)는 보호자 동의 전에 서버에 두지 않는다.
 * 올린 이미지는 주인만 받을 수 있다(GET /api/images/<key>).
 */
import { getSession, requireSession } from "./auth.js";
import { json, fail, readJson } from "./lib/http.js";

const MAX_DRAFT = 512 * 1024; // 두 JSON 합친 최대 크기
const KEY_RE = /^[a-f0-9]{64}\.(?:webp|jpg|png|gif)$/;
const TYPES = { webp: "image/webp", jpg: "image/jpeg", png: "image/png", gif: "image/gif" };
const canSync = (u) => u.age_status === "ok" || u.age_status === "guardian_ok";
const SYNC_OFF = "나이 확인(보호자 동의)이 끝나면 다른 기기와 이어 쓸 수 있어요.";

const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

// GET /api/drafts — 서버에 있는 초안 (없으면 version 0)
export async function getDraft(request, env) {
  const s = await getSession(request, env);
  if (!s) return fail(401, "로그인이 필요해요.");
  if (!canSync(s.user)) return fail(403, SYNC_OFF);
  const row = await env.DB.prepare("SELECT * FROM drafts WHERE user_id = ?").bind(s.user.id).first();
  if (!row) return json({ ok: true, version: 0, updatedAt: null, portfolio: null, interview: null });
  return json({ ok: true, version: row.version, updatedAt: row.updated_at, portfolio: parse(row.portfolio_json), interview: parse(row.interview_json) });
}

// PUT /api/drafts { baseVersion, portfolio, interview }
export async function putDraft(request, env) {
  const { session, error } = await requireSession(request, env);
  if (error) return error;
  if (!canSync(session.user)) return fail(403, SYNC_OFF);
  const body = await readJson(request, MAX_DRAFT + 1024);
  if (!body || !Number.isInteger(body.baseVersion) || body.baseVersion < 0) return fail(400, "보낸 내용을 읽지 못했어요.");
  const isObj = (v) => v === null || (typeof v === "object" && !Array.isArray(v));
  if (!isObj(body.portfolio ?? null) || !isObj(body.interview ?? null)) return fail(400, "보낸 내용을 읽지 못했어요.");
  const portfolio = body.portfolio ? JSON.stringify(body.portfolio) : null;
  const interview = body.interview ? JSON.stringify(body.interview) : null;
  if ((portfolio?.length ?? 0) + (interview?.length ?? 0) > MAX_DRAFT) return fail(413, "초안이 너무 커요.");

  const uid = session.user.id, now = Date.now();
  let res;
  if (body.baseVersion === 0) {
    // 처음 저장: 이미 있으면(다른 기기가 먼저 올림) 충돌
    res = await env.DB.prepare(
      "INSERT INTO drafts (user_id, portfolio_json, interview_json, version, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT (user_id) DO NOTHING",
    ).bind(uid, portfolio, interview, now).run();
  } else {
    res = await env.DB.prepare(
      "UPDATE drafts SET portfolio_json = ?, interview_json = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND version = ?",
    ).bind(portfolio, interview, now, uid, body.baseVersion).run();
  }
  if (!res.meta.changes) {
    const cur = await env.DB.prepare("SELECT version, updated_at FROM drafts WHERE user_id = ?").bind(uid).first();
    return json({ ok: false, conflict: true, reason: "다른 기기에서 먼저 저장했어요.", version: cur?.version ?? 0, updatedAt: cur?.updated_at ?? null }, 409);
  }
  return json({ ok: true, version: body.baseVersion + 1, updatedAt: now });
}

// GET /api/images/<key> — 내가 올린 이미지 받기 (다른 기기에서 초안을 이어 쓸 때)
export async function getImage(request, env) {
  const s = await getSession(request, env);
  if (!s) return fail(401, "로그인이 필요해요.");
  const key = new URL(request.url).pathname.slice("/api/images/".length);
  if (!KEY_RE.test(key)) return fail(404, "없는 이미지예요.");
  const owned = await env.DB.prepare("SELECT 1 AS x FROM uploads WHERE user_id = ? AND key = ?").bind(s.user.id, key).first();
  if (!owned) return fail(404, "없는 이미지예요.");
  const obj = await env.SITES.get(`uploads/${s.user.id}/${key}`);
  if (!obj) return fail(404, "없는 이미지예요.");
  return new Response(obj.body, {
    headers: {
      "content-type": TYPES[key.split(".").pop()],
      "cache-control": "private, max-age=31536000, immutable", // 내용 해시 이름 + 본인만
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/* ── 버전 기록: 계정당 최근 30개 (편집기 "버전 기록") ─────────────────────── */
const MAX_VERSIONS = 30;
const MAX_VERSION = 256 * 1024;
const cleanLabel = (v) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 40) : "") || "저장한 버전";

// GET /api/versions — 목록 (내용 없이)
export async function listVersions(request, env) {
  const s = await getSession(request, env);
  if (!s) return fail(401, "로그인이 필요해요.");
  if (!canSync(s.user)) return fail(403, SYNC_OFF);
  const { results } = await env.DB.prepare("SELECT id, label, created_at FROM draft_versions WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
    .bind(s.user.id, MAX_VERSIONS).all();
  return json({ ok: true, versions: results.map((r) => ({ id: r.id, label: r.label, createdAt: r.created_at })) });
}

// GET /api/versions/<id> — 한 버전의 초안 (내 것만)
export async function getVersion(request, env) {
  const s = await getSession(request, env);
  if (!s) return fail(401, "로그인이 필요해요.");
  if (!canSync(s.user)) return fail(403, SYNC_OFF);
  const id = Number(new URL(request.url).pathname.slice("/api/versions/".length));
  if (!Number.isSafeInteger(id) || id <= 0) return fail(404, "없는 버전이에요.");
  const row = await env.DB.prepare("SELECT id, label, created_at, portfolio_json FROM draft_versions WHERE id = ? AND user_id = ?").bind(id, s.user.id).first();
  if (!row) return fail(404, "없는 버전이에요.");
  return json({ ok: true, id: row.id, label: row.label, createdAt: row.created_at, portfolio: parse(row.portfolio_json) });
}

// POST /api/versions { label, portfolio } — 저장하고 오래된 것은 30개가 넘으면 지운다
export async function createVersion(request, env) {
  const { session, error } = await requireSession(request, env);
  if (error) return error;
  if (!canSync(session.user)) return fail(403, SYNC_OFF);
  const body = await readJson(request, MAX_VERSION + 1024);
  if (!body || !body.portfolio || typeof body.portfolio !== "object" || Array.isArray(body.portfolio)) return fail(400, "보낸 내용을 읽지 못했어요.");
  const text = JSON.stringify(body.portfolio);
  if (text.length > MAX_VERSION) return fail(413, "초안이 너무 커요.");
  // 이 기기에만 있는 이미지 참조(img:)는 다른 기기에서 쓸 수 없다 → 앱이 upload:로 바꿔 보내야 한다
  if (text.includes('"img:')) return fail(400, "이미지를 먼저 올린 뒤 저장해 주세요.");
  const uid = session.user.id, now = Date.now();
  const row = await env.DB.prepare("INSERT INTO draft_versions (user_id, created_at, label, portfolio_json) VALUES (?, ?, ?, ?) RETURNING id")
    .bind(uid, now, cleanLabel(body.label), text).first();
  await env.DB.prepare(`DELETE FROM draft_versions WHERE user_id = ? AND id NOT IN (
      SELECT id FROM draft_versions WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?)`).bind(uid, uid, MAX_VERSIONS).run();
  return json({ ok: true, id: row.id, createdAt: now });
}
