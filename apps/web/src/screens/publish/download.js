/** 브라우저에서 파일 내려받기 (사용자가 버튼을 눌렀을 때만 호출) */
export function downloadFile(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 파일 이름: 주소가 있으면 주소, 없으면 "portfolio" (한글 이름은 파일 시스템마다 달라서 쓰지 않음) */
export function fileBase(slug) {
  const s = (slug ?? "").trim().toLowerCase();
  return /^[a-z0-9-]{1,30}$/.test(s) ? s : "portfolio";
}
