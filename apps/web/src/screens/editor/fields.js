/** 편집 캔버스의 칸 이름(data-pf-field) → 사람이 읽는 이름 */
export function fieldLabel(field) {
  const m = /^project\.(\d+)(?:\.(title|summary))?$/.exec(field);
  if (m) return `${+m[1] + 1}번째 작업${m[2] === "title" ? " 제목" : m[2] === "summary" ? " 설명" : ""}`;
  const l = /^links\.(\d+)$/.exec(field);
  if (l) return `${+l[1] + 1}번째 링크`;
  return { name: "이름", headline: "한 줄 소개", bio: "소개글" }[field] ?? field;
}
