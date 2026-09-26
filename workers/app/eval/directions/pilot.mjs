// 무료 파일럿: 24개 페르소나 전체(입력 검토용)와 규칙 엔진 3안의 자동 채점을 한 페이지로.
// 실행(workers/app에서): node eval/directions/pilot.mjs → ../../.claude/hillclimb/directions/pilot/index.html
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { interviewFor, autoGrade, describeAnswers, previewPage, bundle, buildDirections } from "./lib.mjs";

const out = new URL("../../../../.claude/hillclimb/directions/pilot/", import.meta.url);
mkdirSync(new URL("previews/", out), { recursive: true });
const cases = JSON.parse(readFileSync(new URL("cases.json", import.meta.url), "utf8"));
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

const rows = [];
const totals = { core_fit: 0, hard_ok: 0, safety_ok: 0, distinct: 0 };
for (const c of cases) {
  const { answers, dna } = interviewFor(c);
  const nd = bundle.normalizeDna(dna);
  const directions = buildDirections(nd, bundle.TEMPLATE_IDS);
  const { grade, explanation } = autoGrade(c, nd, directions, null);
  for (const k of Object.keys(totals)) totals[k] += grade[k];
  writeFileSync(new URL(`previews/${c.id}.html`, out), previewPage(c, directions, `${c.id} · 규칙 엔진`));
  const ab = answers.pairwise.choices.map((q) => `${q.axis}: ${q.winner ?? "잘 모르겠어요"}`).join(", ") || "없음";
  const cf = Object.entries(answers.confirm.responses).map(([k, v]) => `${k} → ${v}`).join(", ") || "건너뜀";
  rows.push(`<section><h2>${esc(c.id)} <small>${esc(c.tags.join(" · "))}</small></h2>
<p><b>페르소나(심사 기준)</b> ${esc(c.persona)}</p>
<pre>${esc(describeAnswers(c))}</pre>
<p><b>진짜 취향 축</b> ${esc(JSON.stringify(c.truth))} · <b>hard</b> ${esc((c.hardAvoid ?? []).join(", ") || "없음")}${c.checks ? ` · <b>검사</b> ${esc(c.checks.join(", "))}` : ""}${c.injection ? ` · <b>인젝션</b> ${esc(JSON.stringify(c.injection))}` : ""}</p>
<p><b>시뮬레이션</b> A/B: ${esc(ab)}<br>확인: ${esc(cf)}</p>
<p><b>규칙 엔진 3안</b> ${directions.map((d) => esc(`${d.kind}=${d.grammar}`)).join(" / ")} — <a href="previews/${esc(c.id)}.html">화면 보기</a><br>
추천안 적합도 ${grade.core_fit} · 금지 지킴 ${grade.hard_ok} (${esc(explanation.hard_ok)}) · 안전 ${grade.safety_ok} · 화면 다양성 ${grade.distinct}</p></section>`);
}
const n = cases.length;
const summary = Object.entries(totals).map(([k, v]) => `${k} ${(v / n).toFixed(3)}`).join(" · ");
writeFileSync(new URL("index.html", out), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>3안 평가 입력·파일럿</title>
<style>body{font-family:system-ui,sans-serif;max-width:960px;margin:24px auto;padding:0 16px;color:#111;line-height:1.55}
section{border-top:1px solid #ddd;padding:12px 0}h2{font-size:18px}small{color:#666;font-weight:400}pre{white-space:pre-wrap;background:#f6f6f4;padding:8px;border-radius:6px}</style></head>
<body><h1>3안 평가 — 입력 ${n}개와 규칙 엔진 파일럿</h1><p>규칙 엔진 평균: ${esc(summary)}</p>${rows.join("\n")}</body></html>`);
console.log(`페르소나 ${n}개 · 규칙 엔진 평균 ${summary}`);
console.log(`→ ${new URL("index.html", out).pathname}`);
