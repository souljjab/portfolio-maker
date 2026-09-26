/**
 * 목업 이미지 저장소 — api/index.js만 사용한다(화면에서 직접 부르지 않음).
 * 브라우저에서 줄인 이미지를 IndexedDB에 Blob으로 저장하고, 초안에는 "img:<id>" 참조만 남긴다.
 * 백엔드 단계에서는 R2 업로드로 바뀌고 cover에 https 주소가 들어간다.
 */
const DB_NAME = "pf-images";
const STORE = "images";

export const MAX_SIDE = 1600;              // 긴 변 최대 픽셀
export const QUALITY = 0.82;
export const MAX_INPUT = 15 * 1024 * 1024; // 올릴 수 있는 원본 최대 크기

let dbPromise = null;
function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
const done = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const store = async (mode) => (await openDb()).transaction(STORE, mode).objectStore(STORE);

const cache = new Map(); // id → data URL (같은 이미지를 매번 다시 읽지 않도록)

export async function putBlob(id, blob) { return done((await store("readwrite")).put(blob, id)); }
export async function getBlob(id) { return done((await store("readonly")).get(id)); }

/** 쓰지 않는 이미지 지우기 (초안을 불러올 때 호출 — 지운 작업을 되돌릴 수 있도록 즉시 지우지 않음) */
export async function prune(keepIds) {
  const ids = await done((await store("readonly")).getAllKeys());
  const drop = ids.filter((id) => !keepIds.includes(id));
  if (!drop.length) return;
  // await 사이에 트랜잭션이 끝날 수 있으므로 삭제는 새 트랜잭션에서 한 번에
  const s = await store("readwrite");
  await Promise.all(drop.map((id) => done(s.delete(id))));
  for (const id of drop) cache.delete(id);
}

const toBlob = (canvas, type) => new Promise((r) => canvas.toBlob(r, type, QUALITY));

/** 긴 변 MAX_SIDE로 줄여 WebP로(지원 안 하면 흰 바탕 JPEG) */
export async function resizeImage(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0, w, h);
  let blob = await toBlob(canvas, "image/webp");
  if (!blob || blob.type !== "image/webp") {
    // JPEG는 투명을 못 담으므로 흰 바탕에 다시 그린다
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    blob = await toBlob(canvas, "image/jpeg");
  }
  bmp.close?.();
  if (!blob) throw new Error("encode failed");
  return { blob, width: w, height: h };
}

/** 저장된 이미지를 data URL로 (없으면 null). 샌드박스 iframe에서도 그려지도록 blob: 대신 data: */
export async function dataUrlFor(id) {
  if (cache.has(id)) return cache.get(id);
  const blob = await getBlob(id);
  if (!blob) return null;
  const url = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
  cache.set(id, url);
  return url;
}
