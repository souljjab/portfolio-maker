/**
 * 실제 발행: 서버가 토큰 JSON + 앱과 같은 템플릿으로 직접 HTML을 만들어 R2 sites/{주소}/ 에 쓴다.
 * 클라이언트가 만든 HTML은 받지 않는다. 받은 내용은 normalizeForPublish로 정리하고 validatePortfolio로 다시 검사.
 * 이미지는 먼저 /api/images로 올리고(형식은 파일 앞 바이트로 확인), 발행 때 사이트 폴더로 복사한다.
 */
import {
  renderPortfolioHtml, TEMPLATE_IDS, normalizeForPublish, validatePortfolio, slugProblem, tokensShapeOk,
} from "./generated/render.js";
import { getSession, requireSession } from "./auth.js";
import { json, fail, readJson } from "./lib/http.js";
import { sha256Bytes } from "./lib/crypto.js";

const MAX_IMAGE = 3 * 1024 * 1024;  // 브라우저에서 줄여 오므로 넉넉한 상한
const MAX_UPLOADS = 100;            // 계정당 올려 둘 수 있는 이미지 수
const KEY_RE = /^[a-f0-9]{64}\.(?:webp|jpg|png|gif)$/;
const TYPES = { webp: "image/webp", jpg: "image/jpeg", png: "image/png", gif: "image/gif" };

const canPublish = (u) => u.age_status === "ok" || u.age_status === "guardian_ok";
const siteUrl = (env, slug) => env.SITE_URL.replace("{slug}", slug);

/** 파일 앞 바이트로 실제 형식 확인 (Content-Type 헤더는 믿지 않는다) */
function sniff(b) {
  const at = (i, s) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b.length > 12 && at(0, "RIFF") && at(8, "WEBP")) return "webp";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 8 && b[0] === 0x89 && at(1, "PNG") && b[4] === 0x0d && b[5] === 0x0a) return "png";
  if (b.length > 6 && (at(0, "GIF87a") || at(0, "GIF89a"))) return "gif";
  return null;
}

async function deletePrefix(env, prefix, keep = new Set()) {
  let cursor;
  do {
    const page = await env.SITES.list({ prefix, cursor });
    const drop = page.objects.map((o) => o.key).filter((k) => !keep.has(k));
    if (drop.length) await env.SITES.delete(drop);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

// POST /api/images (본문: 이미지 바이트)
export async function uploadImage(request, env) {
  const { session, error } = await requireSession(request, env);
  if (error) return error;
  if (!canPublish(session.user)) return fail(403, "나이 확인(보호자 동의)이 끝나야 이미지를 올릴 수 있어요.");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_IMAGE) return fail(413, "이미지가 너무 커요.");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_IMAGE) return fail(413, "이미지가 너무 커요.");
  const ext = sniff(bytes);
  if (!ext) return fail(415, "이미지 파일만 올릴 수 있어요.");

  const uid = session.user.id;
  const key = `${await sha256Bytes(bytes)}.${ext}`;
  const known = await env.DB.prepare("SELECT 1 AS x FROM uploads WHERE user_id = ? AND key = ?").bind(uid, key).first();
  if (!known) {
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM uploads WHERE user_id = ?").bind(uid).first("n");
    if (n >= MAX_UPLOADS) return fail(429, "올린 이미지가 너무 많아요.");
    await env.SITES.put(`uploads/${uid}/${key}`, bytes, { httpMetadata: { contentType: TYPES[ext] } });
    await env.DB.prepare("INSERT INTO uploads (user_id, key, size, created_at) VALUES (?, ?, ?, ?)").bind(uid, key, bytes.length, Date.now()).run();
  }
  return json({ ok: true, key });
}

// GET /api/slug?name=  — 형식·예약어·이미 쓰는지 (내 주소는 사용 가능)
export async function checkSlug(request, env) {
  const name = (new URL(request.url).searchParams.get("name") ?? "").trim().toLowerCase();
  const problem = slugProblem(name);
  if (problem) return json({ ok: false, reason: problem });
  const row = await env.DB.prepare("SELECT user_id FROM sites WHERE slug = ?").bind(name).first();
  if (row) {
    const s = await getSession(request, env);
    if (row.user_id !== s?.user.id) return json({ ok: false, reason: "이미 사용 중인 이름입니다." });
  }
  return json({ ok: true });
}

// GET /api/site — 내가 발행한 사이트
export async function mySite(request, env) {
  const s = await getSession(request, env);
  if (!s) return json({ ok: true, site: null });
  const row = await env.DB.prepare("SELECT * FROM sites WHERE user_id = ?").bind(s.user.id).first();
  return json({ ok: true, site: row ? { slug: row.slug, url: siteUrl(env, row.slug), publishedAt: row.published_at, updatedAt: row.updated_at } : null });
}

// POST /api/publish { slug, portfolio }
export async function publish(request, env) {
  const { session, error } = await requireSession(request, env);
  if (error) return error;
  const user = session.user;
  if (!canPublish(user)) return fail(403, "나이 확인(보호자 동의)이 끝나야 발행할 수 있어요.");
  const body = await readJson(request, 256 * 1024);
  if (!body) return fail(400, "보낸 내용을 읽지 못했어요.");

  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const problem = slugProblem(slug);
  if (problem) return fail(400, problem);

  const p = normalizeForPublish(body.portfolio);
  if (!TEMPLATE_IDS.includes(p.template) || !tokensShapeOk(p.tokens)) return fail(400, "디자인 정보가 올바르지 않아요. 인터뷰에서 안을 다시 골라 주세요.");
  if (Object.keys(validatePortfolio(p)).length) return fail(400, "고칠 곳이 남아 있어요.");

  // 이미지: 올려 둔 것만 사이트 이미지로. 다른 주소(외부 이미지)는 싣지 않는다 — 사이트 CSP는 img-src 'self'
  const images = [];
  for (const proj of p.projects) {
    const key = proj.cover?.startsWith("upload:") ? proj.cover.slice(7) : null;
    if (key && KEY_RE.test(key)) {
      images.push(key);
      proj.cover = `/img/${key}`;
    } else {
      proj.cover = null;
    }
  }
  for (const key of images) {
    const ok = await env.DB.prepare("SELECT 1 AS x FROM uploads WHERE user_id = ? AND key = ?").bind(user.id, key).first();
    if (!ok) return fail(400, "이미지를 다시 올려 주세요.");
  }

  // 렌더링은 주소를 차지하기 전에 (실패해도 주소가 묶이지 않게)
  const html = renderPortfolioHtml({ portfolio: p, tokens: p.tokens, template: p.template });

  // 주소 차지: 기본 키·UNIQUE 제약이 동시 요청 경쟁을 막는다
  const now = Date.now();
  const mine = await env.DB.prepare("SELECT slug FROM sites WHERE user_id = ?").bind(user.id).first();
  try {
    if (!mine) {
      await env.DB.prepare("INSERT INTO sites (slug, user_id, published_at, updated_at) VALUES (?, ?, ?, ?)").bind(slug, user.id, now, now).run();
    } else {
      await env.DB.prepare("UPDATE sites SET slug = ?, updated_at = ? WHERE user_id = ?").bind(slug, now, user.id).run();
    }
  } catch {
    return fail(409, "이미 사용 중인 이름입니다.");
  }

  // 파일 쓰기: 이미지 → HTML 순서 (HTML이 먼저 보이면 이미지가 잠깐 깨질 수 있으므로)
  const prefix = `sites/${slug}/`;
  for (const key of images) {
    const dest = `${prefix}img/${key}`;
    if (await env.SITES.head(dest)) continue;
    const obj = await env.SITES.get(`uploads/${user.id}/${key}`);
    if (!obj) return fail(400, "이미지를 다시 올려 주세요.");
    await env.SITES.put(dest, obj.body, { httpMetadata: { contentType: TYPES[key.split(".").pop()] } });
  }
  await env.SITES.put(`${prefix}index.html`, html, { httpMetadata: { contentType: "text/html; charset=utf-8" } });
  // 더 이상 쓰지 않는 이미지, 다른 주소에서 옮겨 왔다면 예전 주소의 파일 정리
  await deletePrefix(env, `${prefix}img/`, new Set(images.map((k) => `${prefix}img/${k}`)));
  if (mine && mine.slug !== slug) await deletePrefix(env, `sites/${mine.slug}/`);

  return json({ ok: true, url: siteUrl(env, slug), publishedAt: now });
}

// POST /api/site/unpublish — 비공개로 (파일을 지우고 주소를 놓는다. 다시 발행하면 돌아온다)
export async function unpublish(request, env) {
  const { session, error } = await requireSession(request, env);
  if (error) return error;
  const mine = await env.DB.prepare("SELECT slug FROM sites WHERE user_id = ?").bind(session.user.id).first();
  if (!mine) return json({ ok: true });
  await deletePrefix(env, `sites/${mine.slug}/`);
  await env.DB.prepare("DELETE FROM sites WHERE user_id = ?").bind(session.user.id).run();
  return json({ ok: true });
}
