/**
 * Claude 호출 두 가지. 공통: 로그인 + 나이 확인(보호자 동의)이 끝난 계정만, 사용량 제한, 호출 기록(사용자 글·출력은 저장 안 함).
 * - POST /api/ai/directions { dna } — 3안. 실패하면 ok:false, 앱은 조용히 규칙 엔진 결과를 쓴다.
 * - POST /api/ai/edit { portfolio, notes, message } — 편집기에서 메모·대화로 다듬기. 변경 목록(ops)만 돌려준다.
 * 받은 입력은 normalize* 로 다시 만들고, Claude 출력은 accept* (규칙 엔진·대비 게이트)가 검사한다.
 */
import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "./auth.js";
import { json, fail, readJson } from "./lib/http.js";
import {
  normalizeDna, buildSystemPrompt, buildDirectionsRequest, readDirectionsResponse, acceptAiDirections, TEMPLATE_IDS,
  normalizeEditRequest, buildEditSystemPrompt, buildEditRequest, acceptAiEdits, normalizeForPublish, tokensShapeOk,
  DEFAULT_MODEL, DEFAULT_EFFORT,
} from "./generated/render.js";

const HOUR = 3_600_000, DAY = 24 * HOUR;
const canUse = (u) => u.age_status === "ok" || u.age_status === "guardian_ok";
// 시스템 프롬프트는 고정 — 요청마다 같은 바이트여야 prompt caching이 맞는다
const SYSTEM = { directions: buildSystemPrompt(TEMPLATE_IDS), edit: buildEditSystemPrompt() };

/**
 * 공통 흐름: 검사 → 제한 → 기록 시작 → 호출 → 응답 읽기. 성공하면 { raw, record }, 실패면 { error }.
 * @param {{ kind: "directions"|"edit", bodyLimit: number, parse: (body) => any, build: (input, system, opts) => object,
 *           hourly: number, text: { limited: string, busy: string, down: string, refused: string, invalid: string } }} spec
 */
async function callClaude(request, env, spec) {
  const { session, error } = await requireSession(request, env);
  if (error) return { error };
  if (!canUse(session.user)) return { error: fail(403, "나이 확인(보호자 동의)이 끝나면 쓸 수 있어요.") };
  if (session.user.ai_opt_out) return { error: fail(403, "AI를 꺼 두셨어요. 계정 설정에서 켤 수 있어요.") };
  if (!env.ANTHROPIC_API_KEY) return { error: fail(503, "AI 연결이 아직 설정되지 않았어요.") };
  const body = await readJson(request, spec.bodyLimit);
  const input = body ? spec.parse(body) : null;
  if (!input) return { error: fail(400, "보낸 내용을 읽지 못했어요.") };

  // 사용량 제한: 사용자별 시간당(종류별), 서비스 전체 하루 (비용 상한)
  const now = Date.now(), uid = session.user.id;
  const mine = await env.DB.prepare("SELECT COUNT(*) AS n FROM ai_calls WHERE user_id = ? AND kind = ? AND created_at > ?").bind(uid, spec.kind, now - HOUR).first();
  if (mine.n >= spec.hourly) return { error: fail(429, spec.text.limited) };
  const all = await env.DB.prepare("SELECT COUNT(*) AS n FROM ai_calls WHERE created_at > ?").bind(now - DAY).first();
  if (all.n >= (Number(env.AI_DAILY_LIMIT) || 300)) return { error: fail(503, spec.text.busy) };

  const row = await env.DB.prepare("INSERT INTO ai_calls (user_id, kind, created_at) VALUES (?, ?, ?) RETURNING id").bind(uid, spec.kind, now).first();
  const record = (fields) => {
    const keys = Object.keys(fields);
    return env.DB.prepare(`UPDATE ai_calls SET ${keys.map((k) => `${k} = ?`).join(", ")}, ms = ? WHERE id = ?`)
      .bind(...keys.map((k) => fields[k]), Date.now() - now, row.id).run();
  };

  const model = env.AI_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    baseURL: env.ANTHROPIC_BASE_URL || undefined, // 로컬 검사용 가짜 서버
    timeout: Number(env.AI_TIMEOUT_MS) || 60_000,
    maxRetries: 1,
  });
  let res;
  try {
    res = await client.beta.messages.create(spec.build(input, SYSTEM[spec.kind], { model, effort: env.AI_EFFORT || DEFAULT_EFFORT }));
  } catch (e) {
    const timeout = e instanceof Anthropic.APIConnectionTimeoutError;
    console.error("Claude 호출 실패", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    await record({ outcome: timeout ? "timeout" : "error", model });
    return { error: fail(502, spec.text.down) };
  }
  const usage = {
    model: res.model ?? model,
    input_tokens: res.usage?.input_tokens ?? null,
    output_tokens: res.usage?.output_tokens ?? null,
    cache_read_tokens: res.usage?.cache_read_input_tokens ?? null,
    cache_write_tokens: res.usage?.cache_creation_input_tokens ?? null,
  };
  const { raw, failure, detail } = readDirectionsResponse(res);
  if (failure) {
    await record({ ...usage, outcome: failure, issues: JSON.stringify([detail]) });
    return { error: fail(502, failure === "refused" ? spec.text.refused : spec.text.invalid) };
  }
  return { raw, input, record: (fields) => record({ ...usage, ...fields }) };
}

export async function aiDirections(request, env) {
  const r = await callClaude(request, env, {
    kind: "directions", bodyLimit: 64 * 1024, hourly: Number(env.AI_USER_HOURLY) || 10,
    parse: (b) => (b.dna && typeof b.dna === "object" ? normalizeDna(b.dna) : null),
    build: buildDirectionsRequest,
    text: {
      limited: "방향을 너무 자주 새로 만들었어요. 잠시 뒤에 다시 해 주세요.",
      busy: "오늘은 AI 사용량이 많아 기본 방식으로 만들게요.",
      down: "AI가 지금 응답하지 않아 기본 방식으로 만들게요.",
      refused: "AI가 이 요청을 처리하지 않아 기본 방식으로 만들게요.",
      invalid: "AI 답을 읽지 못해 기본 방식으로 만들게요.",
    },
  });
  if (r.error) return r.error;
  const { directions, issues } = acceptAiDirections(r.raw, r.input, TEMPLATE_IDS);
  await r.record({ outcome: issues.length ? "partial" : "ok", issues: issues.length ? JSON.stringify(issues) : null });
  return json({ ok: true, directions });
}

export async function aiEdit(request, env) {
  let body;
  const r = await callClaude(request, env, {
    kind: "edit", bodyLimit: 64 * 1024, hourly: Number(env.AI_EDIT_HOURLY) || 30,
    parse: (b) => { body = b; return normalizeEditRequest(b); },
    build: buildEditRequest,
    text: {
      limited: "한 시간에 부탁할 수 있는 횟수를 다 썼어요. 잠시 뒤에 다시 해 주세요.",
      busy: "오늘은 AI 사용량이 많아요. 내일 다시 부탁해 주세요.",
      down: "AI가 지금 응답하지 않아요. 잠시 뒤 다시 해 주세요.",
      refused: "AI가 이 부탁을 처리하지 않았어요. 표현을 바꿔 다시 해 보세요.",
      invalid: "AI 답을 읽지 못했어요. 다시 해 주세요.",
    },
  });
  if (r.error) return r.error;
  // 보낸 초안 기준으로 먼저 검사해서 통과한 변경만 돌려준다(앱이 자기 초안에 다시 검사해 적용)
  const draft = { ...normalizeForPublish(body.portfolio), tokens: tokensShapeOk(body.portfolio.tokens) ? body.portfolio.tokens : null };
  const { reply, ops, skipped } = acceptAiEdits(r.raw, draft);
  await r.record({ outcome: skipped.length ? "partial" : "ok", issues: skipped.length ? JSON.stringify(skipped.map((s) => `${s.target}: ${s.reason}`)) : null });
  return json({ ok: true, reply, ops });
}
