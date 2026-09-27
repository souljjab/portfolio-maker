/**
 * 계정 수명: 삭제(7일 유예) · 보호자 동의 철회 · 매일 정리.
 * - 삭제 요청: 이메일을 직접 입력해 확인 → 사이트는 바로 내리고, 7일 뒤 정리 작업(Cron)이 계정과 모든 데이터를 지운다.
 *   그 사이 다시 로그인하면 취소할 수 있고, 발행은 막는다.
 * - 동의 철회: 사이트를 내리고 서버에 둔 자녀의 초안·버전·이미지·AI 기록을 지운다. 계정은 "보호자 동의 전"으로 돌아간다.
 */
import { requireSession, DELETION_GRACE } from "./auth.js";
import { json, fail, readJson } from "./lib/http.js";
import { deletePrefix } from "./publish.js";

const DAY = 24 * 3_600_000;

/** 발행한 사이트를 내린다 (파일 + 주소) */
export async function removeSite(env, uid) {
  const mine = await env.DB.prepare("SELECT slug FROM sites WHERE user_id = ?").bind(uid).first();
  if (!mine) return;
  await deletePrefix(env, `sites/${mine.slug}/`);
  await env.DB.prepare("DELETE FROM sites WHERE user_id = ?").bind(uid).run();
}

/** 서버에 둔 작업을 모두 지운다 (사이트·초안·버전·올린 이미지·AI 기록). 계정·세션은 남긴다 */
export async function removeUserContent(env, uid) {
  await removeSite(env, uid);
  await deletePrefix(env, `uploads/${uid}/`);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM drafts WHERE user_id = ?").bind(uid),
    env.DB.prepare("DELETE FROM draft_versions WHERE user_id = ?").bind(uid),
    env.DB.prepare("DELETE FROM uploads WHERE user_id = ?").bind(uid),
    env.DB.prepare("DELETE FROM ai_calls WHERE user_id = ?").bind(uid),
  ]);
}

/** 계정 완전 삭제: 작업을 지우고, 사용자 행을 지우면 세션·보호자 토큰 등은 연결 삭제(ON DELETE CASCADE) */
export async function purgeAccount(env, user) {
  await removeUserContent(env, user.id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM login_codes WHERE email = ?").bind(user.email),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
  ]);
}

/**
 * 기한이 지난 기록 정리 (매일 Cron) — 개인정보처리방침의 보존 기간과 맞춘다.
 * 로그인 코드(해시·요청 IP)는 24시간 뒤, 만료된 세션·보호자 동의 요청 링크는 바로.
 * (코드 요청 제한은 최근 1시간만 보므로 24시간 뒤 지워도 영향 없음)
 */
export async function cleanupExpired(env, now = Date.now()) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM login_codes WHERE created_at < ?").bind(now - DAY),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now),
    env.DB.prepare("DELETE FROM guardian_tokens WHERE expires_at < ?").bind(now),
  ]);
}

/** 유예가 끝난 계정 정리 (매일 Cron). @returns 지운 계정 수 */
export async function purgeDueAccounts(env, now = Date.now()) {
  const { results } = await env.DB.prepare("SELECT id, email FROM users WHERE deletion_requested_at IS NOT NULL AND deletion_requested_at <= ? LIMIT 100")
    .bind(now - DELETION_GRACE).all();
  for (const u of results) await purgeAccount(env, u);
  return results.length;
}

// POST /api/account/delete { confirmEmail } — 삭제 예약 (사이트는 즉시 내림)
export async function requestDeletion(request, env) {
  const { session, error } = await requireSession(request, env);
  if (error) return error;
  const body = await readJson(request);
  const typed = typeof body?.confirmEmail === "string" ? body.confirmEmail.trim().toLowerCase() : "";
  if (typed !== session.user.email) return fail(400, "이메일 주소가 계정과 달라요. 정확히 입력해 주세요.");
  const now = session.user.deletion_requested_at ?? Date.now();
  await env.DB.prepare("UPDATE users SET deletion_requested_at = ? WHERE id = ?").bind(now, session.user.id).run();
  await removeSite(env, session.user.id);
  return json({ ok: true, deletionScheduledAt: now + DELETION_GRACE });
}

// POST /api/account/delete/cancel — 삭제 취소
export async function cancelDeletion(request, env) {
  const { session, error } = await requireSession(request, env);
  if (error) return error;
  await env.DB.prepare("UPDATE users SET deletion_requested_at = NULL WHERE id = ?").bind(session.user.id).run();
  return json({ ok: true });
}

// POST /api/dev/purge { days } — 로컬 검사 전용(EXPOSE_DEV_CODE=1): days일 뒤라고 치고 정리 작업을 돌린다
export async function devPurge(request, env) {
  if (env.EXPOSE_DEV_CODE !== "1") return fail(404, "없는 주소예요.");
  const body = await readJson(request);
  const days = Number(body?.days) || 0;
  const now = Date.now() + days * DAY;
  await cleanupExpired(env, now);
  return json({ ok: true, purged: await purgeDueAccounts(env, now) });
}
