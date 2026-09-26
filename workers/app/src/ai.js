/**
 * Claude로 3안 만들기 — POST /api/ai/directions { dna }
 *
 * - 로그인 + 나이 확인(보호자 동의)이 끝난 계정만. 그 외엔 앱이 규칙 엔진 결과를 쓴다.
 * - 받은 DNA는 normalizeDna로 다시 만들고, Claude 출력은 acceptAiDirections(규칙 엔진)가 안별로 검사한다.
 * - 실패(키 없음·제한·거절·시간 초과·형식 오류)는 모두 ok:false로 돌려주고, 앱은 조용히 규칙 결과를 쓴다.
 * - 호출 기록은 남기지만 사용자가 쓴 글과 모델 출력은 저장하지 않는다.
 */
import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "./auth.js";
import { json, fail, readJson } from "./lib/http.js";
import {
  normalizeDna, buildSystemPrompt, buildDirectionsRequest, readDirectionsResponse, acceptAiDirections, TEMPLATE_IDS,
  DEFAULT_MODEL, DEFAULT_EFFORT,
} from "./generated/render.js";

const HOUR = 3_600_000, DAY = 24 * HOUR;
const canUse = (u) => u.age_status === "ok" || u.age_status === "guardian_ok";
// 시스템 프롬프트는 고정 — 요청마다 같은 바이트여야 prompt caching이 맞는다
const SYSTEM = buildSystemPrompt(TEMPLATE_IDS);

export async function aiDirections(request, env) {
  const { session, error } = await requireSession(request, env);
  if (error) return error;
  if (!canUse(session.user)) return fail(403, "나이 확인(보호자 동의)이 끝나면 쓸 수 있어요.");
  if (!env.ANTHROPIC_API_KEY) return fail(503, "AI 연결이 아직 설정되지 않았어요.");
  const body = await readJson(request, 64 * 1024);
  if (!body || typeof body.dna !== "object" || body.dna === null) return fail(400, "보낸 내용을 읽지 못했어요.");

  // 사용량 제한: 사용자별 시간당, 서비스 전체 하루 (비용 상한)
  const now = Date.now(), uid = session.user.id;
  const perUser = Number(env.AI_USER_HOURLY) || 10;
  const perDay = Number(env.AI_DAILY_LIMIT) || 300;
  const mine = await env.DB.prepare("SELECT COUNT(*) AS n FROM ai_calls WHERE user_id = ? AND created_at > ?").bind(uid, now - HOUR).first();
  if (mine.n >= perUser) return fail(429, "방향을 너무 자주 새로 만들었어요. 잠시 뒤에 다시 해 주세요.");
  const all = await env.DB.prepare("SELECT COUNT(*) AS n FROM ai_calls WHERE created_at > ?").bind(now - DAY).first();
  if (all.n >= perDay) return fail(503, "오늘은 AI 사용량이 많아 기본 방식으로 만들게요.");

  const row = await env.DB.prepare("INSERT INTO ai_calls (user_id, kind, created_at) VALUES (?, 'directions', ?) RETURNING id").bind(uid, now).first();
  const record = (fields) => {
    const keys = Object.keys(fields);
    return env.DB.prepare(`UPDATE ai_calls SET ${keys.map((k) => `${k} = ?`).join(", ")}, ms = ? WHERE id = ?`)
      .bind(...keys.map((k) => fields[k]), Date.now() - now, row.id).run();
  };

  const dna = normalizeDna(body.dna);
  const model = env.AI_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    baseURL: env.ANTHROPIC_BASE_URL || undefined, // 로컬 검사용 가짜 서버
    timeout: Number(env.AI_TIMEOUT_MS) || 60_000,
    maxRetries: 1,
  });

  let res;
  try {
    res = await client.beta.messages.create(buildDirectionsRequest(dna, SYSTEM, { model, effort: env.AI_EFFORT || DEFAULT_EFFORT }));
  } catch (e) {
    const timeout = e instanceof Anthropic.APIConnectionTimeoutError;
    console.error("Claude 호출 실패", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    await record({ outcome: timeout ? "timeout" : "error", model });
    return fail(502, "AI가 지금 응답하지 않아 기본 방식으로 만들게요.");
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
    return fail(502, failure === "refused" ? "AI가 이 요청을 처리하지 않아 기본 방식으로 만들게요." : "AI 답을 읽지 못해 기본 방식으로 만들게요.");
  }

  const { directions, issues } = acceptAiDirections(raw, dna, TEMPLATE_IDS);
  await record({ ...usage, outcome: issues.length ? "partial" : "ok", issues: issues.length ? JSON.stringify(issues) : null });
  return json({ ok: true, directions });
}
