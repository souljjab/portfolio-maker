/**
 * API 계층 — 화면 코드는 반드시 이 파일의 함수만 부른다.
 * 지금은 목업, 백엔드 단계에서 각 함수 안쪽만 fetch로 교체.
 * 모든 함수는 async, 반환 모양은 백엔드 이후에도 동일하게 유지.
 */
import { MOCK_PORTFOLIO } from "../data/mock.js";
import { buildDirections } from "../engine/directions.js";
import { acceptAiDirections, normalizeDna } from "../engine/aiDirections.js";
import { validatePortfolio, slugProblem } from "../engine/content.js";
import { TEMPLATES } from "../templates/index.js";
import { createEmptySession } from "../schema/types.js";
import * as images from "./images.js";

const USE_MOCK = true;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY = "pf:draft";
const SESSION_KEY = "pf:interview";
const IMG_PREFIX = "img:";       // 이 기기에만 있는 이미지 (IndexedDB id)
const UPLOAD_PREFIX = "upload:"; // 서버에 올린 이미지 (내용 해시 key) — 동기화·발행 뒤

/** 자유 입력 문장 → 의미 분해 (나중엔 Claude API) */
export async function interpretIntent(text) {
  if (USE_MOCK) {
    await wait(600);
    // 목업: 실제 해석 대신 모호한 단어만 표시
    const vague = ["깔끔", "고급", "힙", "감성", "따뜻", "전문", "심플", "독특"].filter((w) => text.includes(w));
    return {
      goalSignals: [],
      unresolvedTerms: vague,
      negativeConstraints: [],
      summary: "입력하신 문장을 바탕으로 몇 가지를 더 여쭤볼게요.",
    };
  }
}

/**
 * Design DNA → Safe·Core·Stretch 3안.
 * 로그인 + 나이 확인이 끝난 계정은 Claude가 만들고(서버 경유), 받은 결과도 규칙 엔진이 다시 검사한다.
 * 그 밖의 경우나 Claude가 실패하면(키 없음·사용량 제한·거절·시간 초과) 규칙 엔진 결과를 쓴다 — 화면은 차이를 몰라도 된다.
 */
export async function generateDirections(dna) {
  const available = Object.keys(TEMPLATES);
  if (ACTIVE.includes(syncStatus.state)) {
    const r = await apiFetch("/api/ai/directions", { method: "POST", body: { dna } });
    if (r.ok && Array.isArray(r.directions)) {
      const byKind = Object.fromEntries(r.directions.map((d) => [d?.kind, d]));
      return acceptAiDirections(byKind, normalizeDna(dna), available).directions;
    }
  } else {
    await wait(600);
  }
  return buildDirections(dna, available);
}

/**
 * 편집기에서 Claude에게 다듬기 부탁 (미리보기 메모 + 대화). 로그인 + 나이 확인이 끝난 계정만.
 * 돌아온 변경(ops)은 화면이 acceptAiEdits로 자기 초안에 다시 검사해 적용한다. 이미지 참조는 보내지 않는다.
 * @param {{ portfolio, notes: {target: string, request: string}[], message: string }} req
 * @returns {Promise<{ ok: boolean, reply?: string, ops?: {target: string, value: string}[], reason?: string }>}
 */
export async function requestAiEdit({ portfolio, notes, message }) {
  if (!ACTIVE.includes(syncStatus.state)) return { ok: false, reason: "나이 확인(보호자 동의)이 끝나면 Claude에게 부탁할 수 있어요." };
  const slim = { ...portfolio, projects: portfolio.projects.map((p) => ({ ...p, cover: null })) };
  return apiFetch("/api/ai/edit", { method: "POST", body: { portfolio: slim, notes, message } });
}

/** 인터뷰 세션 불러오기. 없거나 형식이 다르면 새 세션 */
export async function loadInterview() {
  if (USE_MOCK) {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      const s = raw ? JSON.parse(raw) : null;
      return s?.version === 1 ? s : createEmptySession();
    } catch {
      return createEmptySession();
    }
  }
}

export async function saveInterview(session) {
  if (USE_MOCK) {
    const savedAt = new Date().toISOString();
    if (writesLocked) return { ok: false, savedAt };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, updatedAt: savedAt })); } catch { /* 저장 실패는 무시 */ }
    markDirty();
    return { ok: true, savedAt };
  }
}

/** 인터뷰 처음부터: 저장분을 지우고 새 세션을 돌려줌 */
export async function clearInterview() {
  if (USE_MOCK) {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* 무시 */ }
    markDirty();
    return createEmptySession();
  }
}

export async function loadDraft() {
  if (USE_MOCK) {
    let draft;
    try {
      const raw = localStorage.getItem(KEY);
      draft = raw ? JSON.parse(raw) : structuredClone(MOCK_PORTFOLIO);
    } catch {
      draft = structuredClone(MOCK_PORTFOLIO);
    }
    // 초안이 더 이상 쓰지 않는 이미지 정리 (실패해도 초안 불러오기엔 영향 없음)
    // 이 기기에만 저장된 버전이 쓰는 이미지도 남긴다(되돌렸을 때 사진이 사라지지 않게)
    images.prune([...localImageIds(draft), ...readLocalVersions().flatMap((v) => localImageIds(v.portfolio))]).catch(() => {});
    return draft;
  }
}

/**
 * 이미지 올리기: 브라우저에서 줄여(긴 변 1600px, WebP) 저장하고, cover에 넣을 참조를 돌려준다.
 * 백엔드 이후엔 R2에 올리고 https 주소를 돌려준다(반환 모양 동일).
 * @returns {Promise<{ ok: true, ref: string, width: number, height: number, size: number } | { ok: false, reason: string }>}
 */
export async function uploadImage(file) {
  if (!file?.type?.startsWith("image/")) return { ok: false, reason: "이미지 파일만 올릴 수 있어요." };
  if (file.size > images.MAX_INPUT) return { ok: false, reason: "15MB보다 작은 이미지를 골라 주세요." };
  if (USE_MOCK) {
    try {
      const { blob, width, height } = await images.resizeImage(file);
      const id = crypto.randomUUID();
      await images.putBlob(id, blob);
      return { ok: true, ref: `${IMG_PREFIX}${id}`, width, height, size: blob.size };
    } catch {
      return { ok: false, reason: "이미지를 읽지 못했어요. 다른 파일로 해 주세요." };
    }
  }
}

/**
 * 그리기용 사본: 초안의 이미지 참조(img:…)를 화면에 그릴 수 있는 주소로 바꾼다.
 * 결과는 미리보기·내려받기에만 쓰고 저장하지 않는다(data URL이 커서 초안에 넣으면 안 됨).
 * 백엔드 이후엔 cover가 이미 https 주소라 그대로 돌려준다.
 */
export async function resolveImages(portfolio) {
  const isRef = (c) => c?.startsWith(IMG_PREFIX) || c?.startsWith(UPLOAD_PREFIX);
  if (!portfolio.projects.some((p) => isRef(p.cover))) return portfolio;
  const projects = await Promise.all(portfolio.projects.map(async (p) => {
    if (p.cover?.startsWith(IMG_PREFIX)) return { ...p, cover: await images.dataUrlFor(p.cover.slice(IMG_PREFIX.length)).catch(() => null) };
    if (p.cover?.startsWith(UPLOAD_PREFIX)) return { ...p, cover: await serverImageUrl(p.cover.slice(UPLOAD_PREFIX.length)) };
    return p;
  }));
  return { ...portfolio, projects };
}

/** 서버에 올린 이미지(upload:<key>): 이 기기에 캐시가 없으면 받아서 캐시(srv-<key>) */
async function serverImageUrl(key) {
  const cacheId = `srv-${key}`;
  const cached = await images.dataUrlFor(cacheId).catch(() => null);
  if (cached) return cached;
  try {
    const r = await fetch(`/api/images/${encodeURIComponent(key)}`, { credentials: "same-origin" });
    if (!r.ok) return null; // 로그아웃 상태 등 — 이미지 자리로 표시
    await images.putBlob(cacheId, await r.blob());
    return await images.dataUrlFor(cacheId);
  } catch {
    return null;
  }
}

/** 초안이 쓰는 이 기기의 이미지 저장소 id (정리할 때 남길 것) */
function localImageIds(draft) {
  return draft.projects.map((p) => p.cover).flatMap((c) => (
    c?.startsWith(IMG_PREFIX) ? [c.slice(IMG_PREFIX.length)] : c?.startsWith(UPLOAD_PREFIX) ? [`srv-${c.slice(UPLOAD_PREFIX.length)}`] : []
  ));
}

export async function saveDraft(portfolio) {
  if (USE_MOCK) {
    if (writesLocked) return { ok: false, savedAt: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(portfolio)); } catch { /* 저장 실패는 무시 */ }
    markDirty();
    return { ok: true, savedAt: new Date().toISOString() };
  }
}

/** 주소 검사: 형식·예약어는 바로(앱과 서버가 같은 규칙), 이미 쓰는지는 서버에 (내 주소는 사용 가능) */
export async function checkSlug(slug) {
  const problem = slugProblem(slug);
  if (problem) return { ok: false, reason: problem };
  return apiFetch(`/api/slug?name=${encodeURIComponent(slug.trim().toLowerCase())}`);
}

/* ── 계정: 발행할 때만 로그인 (이메일 6자리 코드) ─────────────────────────────
 * 실제 서버(workers/app)와 통신한다. 개발 중엔 Vite가 /api를 로컬 Worker(:8787)로 넘긴다.
 * 세션은 HttpOnly 쿠키라 화면 코드에서 볼 수 없고, 상태를 바꾸는 요청엔 CSRF 토큰을 헤더로 보낸다.
 */
let csrfToken = null;
const OFFLINE = { ok: false, reason: "서버에 연결할 수 없어요. 잠시 뒤 다시 시도해 주세요." };

async function apiFetch(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body) headers["content-type"] = "application/json";
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;
  try {
    const r = await fetch(path, { method, headers, credentials: "same-origin", body: body ? JSON.stringify(body) : undefined });
    return (await r.json().catch(() => null)) ?? OFFLINE;
  } catch {
    return OFFLINE;
  }
}

const accountListeners = new Set();
let writesLocked = false; // 로그아웃 뒤: 초안·인터뷰 저장을 받지 않는다
function emitAccount(user) { for (const fn of accountListeners) fn(user); }

/**
 * 로그인 상태가 바뀔 때(로그인·나이 확인·로그아웃) 알림. 앱은 로그인한 사람만 쓸 수 있어서 첫 화면 전환에 쓴다.
 * @returns 구독 해제 함수
 */
export function onAccountChange(fn) {
  accountListeners.add(fn);
  return () => accountListeners.delete(fn);
}

/** 지금 로그인한 계정. @returns {Promise<{ ok: boolean, user: null | { email, ageStatus, canPublish, guardianEmail }, reason?: string }>} */
export async function getAccount() {
  const r = await apiFetch("/api/auth/me");
  if (r.ok) { csrfToken = r.csrfToken; emitAccount(r.user ?? null); }
  return r;
}

/** 로그인 코드 메일 보내기 (가입도 같은 흐름). 로컬 개발에선 devCode가 함께 온다 */
export async function requestLoginCode(email) {
  return apiFetch("/api/auth/start", { method: "POST", body: { email } });
}

export async function verifyLoginCode(email, code) {
  const r = await apiFetch("/api/auth/verify", { method: "POST", body: { email, code } });
  if (r.ok) { csrfToken = r.csrfToken; writesLocked = false; emitAccount(r.user); syncNow(); }
  return r;
}

/** 나이 확인: 만 14세 미만이면 보호자 이메일로 동의 요청 (로컬 개발에선 devLink가 함께 온다) */
export async function setAccountAge({ over14, guardianEmail }) {
  const r = await apiFetch("/api/account/age", { method: "POST", body: { over14, guardianEmail } });
  if (r.ok) { emitAccount(r.user); syncNow(); }
  return r;
}

/**
 * 로그아웃. 이 기기의 작업(초안·인터뷰·이미지)은 지운다 — 같은 기기에서 다른 계정이 로그인했을 때 넘겨받지 않게.
 * 서버에 다 올라가지 않은 작업(보호자 동의 전·오프라인)이 있으면 지우기 전에 { unsynced: true }로 멈춘다.
 * @param {{ force?: boolean }} [opts]  force: 올리지 못한 작업이 있어도 지우고 로그아웃
 */
export async function logout({ force = false } = {}) {
  if (!force && hasLocalWork()) {
    await syncNow();
    const m = readMeta();
    if (syncStatus.state !== "synced" || !m || m.dirtySeq !== m.pushedSeq) {
      return { ok: false, unsynced: true, reason: "이 기기에만 있고 서버에 저장되지 않은 작업이 있어요. 로그아웃하면 이 기기에서 지워져요." };
    }
  }
  const r = await apiFetch("/api/auth/logout", { method: "POST" });
  if (r.ok) {
    csrfToken = null;
    clearTimeout(syncTimer);
    writesLocked = true; // 닫히는 화면의 자동 저장이 지운 뒤에 다시 쓰지 않게 (다음 로그인까지)
    await clearLocalWork();
    setStatus({ state: "local" });
    emitAccount(null);
  }
  return r;
}

/**
 * 발행: 로컬 이미지를 먼저 올리고(서버가 형식 확인), 내용 JSON을 보낸다.
 * 서버가 앱과 같은 템플릿으로 직접 HTML을 만들어 공개한다 — 클라이언트 HTML은 보내지 않는다.
 * @returns {Promise<{ ok: true, url: string, publishedAt: number } | { ok: false, reason: string }>}
 */
export async function publish(portfolio, slug) {
  const problem = slugProblem(slug);
  if (problem) return { ok: false, reason: problem };
  if (Object.keys(validatePortfolio(portfolio)).length) return { ok: false, reason: "고칠 곳이 남아 있어요." };
  const account = await getAccount();
  if (!account.ok) return { ok: false, reason: account.reason };
  if (!account.user) return { ok: false, reason: "발행하려면 로그인이 필요해요." };
  if (!account.user.canPublish) return { ok: false, reason: "나이 확인(보호자 동의)이 끝나야 발행할 수 있어요." };

  // 이미지: img:<id>(IndexedDB) → 서버에 올리고 upload:<key>로. 올리지 못한 이미지는 빼고 발행하지 않고 멈춘다
  const projects = [];
  for (const p of portfolio.projects) {
    let cover = p.cover?.startsWith(UPLOAD_PREFIX) ? p.cover : null; // 동기화로 이미 올린 이미지
    if (p.cover?.startsWith(IMG_PREFIX)) {
      const blob = await images.getBlob(p.cover.slice(IMG_PREFIX.length)).catch(() => null);
      if (blob) {
        const up = await uploadBlob(blob);
        if (!up.ok) return { ok: false, reason: `‘${p.title}’ 이미지를 올리지 못했어요. ${up.reason}` };
        cover = `upload:${up.key}`;
      }
    }
    projects.push({ ...p, cover });
  }

  const r = await apiFetch("/api/publish", { method: "POST", body: { slug: slug.trim().toLowerCase(), portfolio: { ...portfolio, projects } } });
  if (!r.ok) return r;
  await saveDraft({ ...portfolio, slug: slug.trim().toLowerCase(), status: "published", publishedAt: r.publishedAt });
  return r;
}

async function uploadBlob(blob) {
  try {
    const r = await fetch("/api/images", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": blob.type || "application/octet-stream", ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) },
      body: blob,
    });
    return (await r.json().catch(() => null)) ?? OFFLINE;
  } catch {
    return OFFLINE;
  }
}

/** 내가 발행한 사이트 (없으면 site: null) */
export async function getSite() {
  return apiFetch("/api/site");
}

/** 비공개로: 공개 파일을 지우고 주소를 놓는다. 다시 발행하면 돌아온다 */
export async function unpublish() {
  const r = await apiFetch("/api/site/unpublish", { method: "POST" });
  if (r.ok) {
    const draft = await loadDraft();
    await saveDraft({ ...draft, status: "draft" });
  }
  return r;
}

/* ── 다른 기기에서 이어 쓰기 (초안·인터뷰 동기화) ──────────────────────────────
 * 로그인하고 나이 확인이 끝난 계정만 (만 14세 미만의 개인정보는 보호자 동의 전에 서버에 두지 않는다).
 * 기기마다 "마지막으로 맞춘 서버 버전"과 "아직 안 올린 변경(dirtySeq ≠ pushedSeq)"을 기록한다.
 * - 저장할 때마다 변경 표시 → 2초 뒤 모아서 올린다. 서버 버전이 그대로일 때만 성공.
 * - 서버 내용을 가져오는 건 앱을 열 때·로그인 직후·충돌에서 고를 때만. 편집 중엔 올리기만 한다.
 * - 양쪽이 다 바뀌었으면 조용히 덮어쓰지 않고 사용자에게 묻는다(state: "conflict").
 */
const SYNC_KEY = "pf:sync";
const statusListeners = new Set();
const remoteListeners = new Set();
let syncStatus = { state: "local" };
let syncTimer = null;
let syncRunning = null;
let pendingRemote = null;

function readMeta() { try { return JSON.parse(localStorage.getItem(SYNC_KEY)); } catch { return null; } }
function writeMeta(m) { try { localStorage.setItem(SYNC_KEY, JSON.stringify(m)); } catch { /* 무시 */ } }
/** 이 기기에 아직 안 올린 작업이 있으면 변경 있음으로 시작 */
function hasLocalWork() {
  return localStorage.getItem(KEY) !== null || localStorage.getItem(SESSION_KEY) !== null || localStorage.getItem(VERSIONS_KEY) !== null;
}
/** 이 기기의 작업을 모두 지운다 (로그아웃, 다른 계정의 작업이 남아 있을 때) */
async function clearLocalWork() {
  for (const k of [KEY, SESSION_KEY, SYNC_KEY, VERSIONS_KEY]) { try { localStorage.removeItem(k); } catch { /* 무시 */ } }
  await images.prune([]).catch(() => {});
}
function freshMeta(email, prev) {
  const hasWork = hasLocalWork();
  const seq = prev?.dirtySeq ?? 0;
  return { email, version: 0, dirtySeq: hasWork ? seq + 1 : seq, pushedSeq: hasWork ? seq : seq, syncedAt: null };
}
function setStatus(s) {
  syncStatus = s;
  for (const fn of statusListeners) fn(s);
  return s;
}
const ACTIVE = ["synced", "syncing", "offline", "error"];

function markDirty() {
  const m = readMeta() ?? freshMeta(null, null);
  m.dirtySeq += 1;
  writeMeta(m);
  if (ACTIVE.includes(syncStatus.state)) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { syncNow(); }, 2000);
  }
}

/**
 * 동기화 상태 구독.
 * state: local(로그인 안 함) | local-minor(보호자 동의 전) | syncing | synced | offline | error | conflict
 * @returns 구독 해제 함수
 */
export function onSyncStatus(fn) {
  statusListeners.add(fn);
  fn(syncStatus);
  return () => statusListeners.delete(fn);
}

/** 서버 내용을 이 기기에 가져왔을 때 (화면은 다시 불러와야 한다) */
export function onRemoteApplied(fn) {
  remoteListeners.add(fn);
  return () => remoteListeners.delete(fn);
}

/** 지금 맞추기 (동시에 여러 번 불러도 한 번만 돈다) */
export function syncNow() {
  syncRunning ??= runSync().finally(() => { syncRunning = null; });
  return syncRunning;
}

async function runSync() {
  const acc = await getAccount();
  if (!acc.ok) return setStatus({ state: "offline" });
  if (!acc.user) return setStatus({ state: "local" });
  if (!acc.user.canPublish) return setStatus({ state: "local-minor" });
  let meta = readMeta();
  // 이 기기에서 처음이거나 다른 계정이면 새로 시작(다른 계정의 버전을 기준으로 저장하면 안 됨)
  if (!meta || meta.email !== acc.user.email) {
    if (meta?.email) {
      // 다른 계정의 작업이 남아 있음(로그아웃이 끝까지 안 된 경우) → 이 계정으로 올리지 않고 비운 뒤 서버 내용을 받는다
      await clearLocalWork();
      for (const fn of remoteListeners) fn(); // 열린 화면이 예전 계정 내용을 다시 저장하지 않게 새로 불러온다
      meta = null;
    }
    // 계정 없이 만든 작업(meta.email null)은 이 계정의 것으로 이어 올린다
    meta = meta && meta.email === null ? { ...meta, email: acc.user.email } : freshMeta(acc.user.email, meta);
    writeMeta(meta);
  }
  setStatus({ state: "syncing", syncedAt: meta.syncedAt });
  const remote = await apiFetch("/api/drafts");
  if (!remote.ok) return setStatus({ state: "offline", syncedAt: meta.syncedAt });
  const dirty = meta.dirtySeq !== meta.pushedSeq;
  if (remote.version === meta.version) return dirty ? push(meta.version) : setStatus({ state: "synced", syncedAt: meta.syncedAt });
  if (remote.version === 0) return push(0);
  if (!dirty) return pull(remote);
  pendingRemote = remote;
  return setStatus({ state: "conflict", remoteUpdatedAt: remote.updatedAt });
}

/** 충돌에서 고르기: "local" = 이 기기 내용으로 서버를 덮기, "remote" = 서버 내용을 이 기기로 */
export async function resolveConflict(choice) {
  const remote = pendingRemote ?? (await apiFetch("/api/drafts"));
  pendingRemote = null;
  if (!remote.ok) return setStatus({ state: "offline" });
  setStatus({ state: "syncing" });
  return choice === "remote" ? pull(remote) : push(remote.version);
}

function pull(remote) {
  const put = (key, v) => { try { if (v) localStorage.setItem(key, JSON.stringify(v)); else localStorage.removeItem(key); } catch { /* 무시 */ } };
  put(KEY, remote.portfolio);
  put(SESSION_KEY, remote.interview);
  const m = readMeta();
  writeMeta({ ...m, version: remote.version, pushedSeq: m.dirtySeq, syncedAt: remote.updatedAt });
  for (const fn of remoteListeners) fn();
  return setStatus({ state: "synced", syncedAt: remote.updatedAt });
}

/**
 * 초안의 이 기기 이미지(img:<id>)를 서버에 올리고, 사본에만 upload:<key>로 바꿔 넣는다(원본은 그대로).
 * 이미 올린 이미지는 기록(uploaded: 로컬 id → 서버 key)으로 다시 올리지 않는다. 동기화·버전 저장이 함께 쓴다.
 * @returns {Promise<{ ok: true, portfolio, uploaded } | { ok: false, offline: boolean, reason: string }>}
 */
async function withServerImages(draft, uploadedIn) {
  const uploaded = { ...(uploadedIn ?? {}) };
  if (!draft) return { ok: true, portfolio: draft, uploaded };
  const projects = [];
  for (const p of draft.projects) {
    const id = p.cover?.startsWith(IMG_PREFIX) ? p.cover.slice(IMG_PREFIX.length) : null;
    if (!id) { projects.push(p); continue; }
    if (!uploaded[id]) {
      const blob = await images.getBlob(id).catch(() => null);
      if (!blob) { projects.push({ ...p, cover: null }); continue; }
      const up = await uploadBlob(blob);
      if (!up.ok) return { ok: false, offline: up === OFFLINE, reason: up.reason };
      uploaded[id] = up.key;
    }
    projects.push({ ...p, cover: `${UPLOAD_PREFIX}${uploaded[id]}` });
  }
  return { ok: true, portfolio: { ...draft, projects }, uploaded };
}

async function push(baseVersion) {
  // 1) 이 기기에만 있는 이미지(img:<id>)를 서버에 올리고, "서버로 보내는 사본"에만 upload:<key>로 바꿔 넣는다.
  //    이 기기의 초안은 건드리지 않는다 — 편집기가 들고 있는 초안과 어긋나면, 다음 자동 저장이 옛 참조로 되돌리는 사이
  //    이미지 정리가 로컬 파일을 지워 사진을 잃을 수 있다. 이미 올린 이미지는 기록(uploaded)으로 다시 올리지 않는다.
  const meta0 = readMeta();
  const seq = meta0.dirtySeq; // 초안을 읽기 전에 잡는다 — 올리는 동안의 편집은 "안 보낸 변경"으로 남아 한 번 더 올라간다
  const draft = JSON.parse(localStorage.getItem(KEY) ?? "null");
  const conv = await withServerImages(draft, meta0.uploaded);
  if (!conv.ok) return setStatus({ state: conv.offline ? "offline" : "error", reason: conv.reason, syncedAt: meta0.syncedAt });
  const { portfolio, uploaded } = conv;
  const interview = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");

  // 2) 서버에 저장 (버전이 그대로일 때만)
  const r = await apiFetch("/api/drafts", { method: "PUT", body: { baseVersion, portfolio, interview } });
  if (r.conflict) {
    pendingRemote = await apiFetch("/api/drafts");
    return setStatus({ state: "conflict", remoteUpdatedAt: r.updatedAt });
  }
  if (!r.ok) return setStatus({ state: r === OFFLINE ? "offline" : "error", reason: r.reason, syncedAt: readMeta().syncedAt });
  const m = readMeta();
  writeMeta({ ...m, version: r.version, pushedSeq: seq, syncedAt: r.updatedAt, uploaded });
  if (m.dirtySeq !== seq) markDirty(); // 올리는 동안 또 바뀌었으면 한 번 더
  return setStatus({ state: "synced", syncedAt: r.updatedAt });
}

/* ── 버전 기록 (편집기) ─────────────────────────────────────────────
 * 로그인 + 나이 확인이 끝난 계정은 서버(최근 30개, 다른 기기에서도), 보호자 동의 전이면 이 기기에만(최근 30개).
 * 서버로 보낼 땐 이미지를 먼저 올려 upload:<key>로 바꾼다 — 다른 기기에서 되돌려도 사진이 보이게.
 */
const VERSIONS_KEY = "pf:versions";
const MAX_LOCAL_VERSIONS = 30;
const readLocalVersions = () => { try { return JSON.parse(localStorage.getItem(VERSIONS_KEY)) ?? []; } catch { return []; } };

/** 지금 초안을 버전으로 저장. @returns {Promise<{ ok: boolean, reason?: string }>} */
export async function saveVersion(label, portfolio) {
  if (!portfolio?.tokens) return { ok: false, reason: "저장할 초안이 없어요." };
  if (!ACTIVE.includes(syncStatus.state)) {
    const list = [{ id: `l${Date.now()}`, label, createdAt: Date.now(), portfolio }, ...readLocalVersions()].slice(0, MAX_LOCAL_VERSIONS);
    try { localStorage.setItem(VERSIONS_KEY, JSON.stringify(list)); } catch { return { ok: false, reason: "이 기기에 저장할 공간이 부족해요." }; }
    return { ok: true };
  }
  const meta = readMeta();
  const conv = await withServerImages(portfolio, meta?.uploaded);
  if (!conv.ok) return { ok: false, reason: conv.reason };
  if (meta) writeMeta({ ...readMeta(), uploaded: conv.uploaded });
  return apiFetch("/api/versions", { method: "POST", body: { label, portfolio: conv.portfolio } });
}

/** 버전 목록 (내용 없이). @returns {Promise<{ ok: boolean, versions?: {id, label, createdAt}[], where?: "server"|"device", reason?: string }>} */
export async function listVersions() {
  if (!ACTIVE.includes(syncStatus.state)) {
    return { ok: true, where: "device", versions: readLocalVersions().map(({ id, label, createdAt }) => ({ id, label, createdAt })) };
  }
  const r = await apiFetch("/api/versions");
  return r.ok ? { ...r, where: "server" } : r;
}

/** 한 버전의 초안. @returns {Promise<{ ok: boolean, portfolio?, reason?: string }>} */
export async function loadVersion(id) {
  if (typeof id === "string" && id.startsWith("l")) {
    const v = readLocalVersions().find((x) => x.id === id);
    return v ? { ok: true, portfolio: v.portfolio } : { ok: false, reason: "없는 버전이에요." };
  }
  return apiFetch(`/api/versions/${encodeURIComponent(id)}`);
}
