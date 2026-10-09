/**
 * 블루펜슬로 다듬은 페이지(초안의 pencil = { html, base, updatedAt })에 쓰는 순수 함수.
 * html은 블루펜슬이 내보낸 HTML 문서이고, 이미지는 초안과 같은 참조(img:<id> / upload:<key>)로 저장한다(data URL은 저장하지 않음).
 * base는 HTML을 만들 때의 내용·디자인 지문 — 내용 입력에서 무언가 바뀌면 달라져서 "아직 반영 안 됨"을 알 수 있다.
 */

/** HTML 속 이미지 참조 */
export const IMAGE_REF = /img:[0-9a-f-]{36}|upload:[a-f0-9]{64}\.(?:webp|jpg|png|gif)/g;
export const PENCIL_HTML_MAX = 200_000; // 버전 기록(256KB)·동기화(512KB)·발행 본문에 들어가도록

/** 내용·디자인 지문 (짧은 해시) */
export function pencilBase(d) {
  const s = JSON.stringify([d.person, d.projects, d.sections, d.template, d.tokens]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${h.toString(36)}-${s.length.toString(36)}`;
}

/** 다듬은 페이지가 있는데 그 뒤 내용 입력에서 바뀐 곳이 있음 */
export const isPencilStale = (d) => Boolean(d?.pencil?.html) && d.pencil.base !== pencilBase(d);
