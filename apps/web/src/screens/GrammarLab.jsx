import { useEffect, useState } from "react";
import { loadDraft } from "../api/index.js";
import { TEMPLATES, getTemplate } from "../templates/index.js";
import { checkTokens } from "../engine/contrast.js";
import { GRAMMARS, grammarById } from "../data/grammars.js";
import { GRAMMAR_TOKENS } from "../data/grammarTokens.js";
import Thumbnail from "../thumbnails/Thumbnail.jsx";

/** 처음 보여줄 3개 패널: 성격이 가장 다른 grammar × 그에 맞는 토큰 */
const INITIAL_PANELS = [
  { template: "quiet-editorial", tokens: "quiet-editorial" },
  { template: "bold-type", tokens: "bold-type" },
  { template: "technical", tokens: "technical" },
];

// 토큰 출처: grammar 기본 토큰 10세트 (3안 토큰은 인터뷰 결과에서 만들어지므로 여기선 기본값만)
const TOKEN_SOURCES = Object.entries(GRAMMAR_TOKENS).map(([id, t]) => ({ key: id, label: `${grammarById[id].name} 기본`, tokens: t }));

/**
 * 개발용 화면: 같은 콘텐츠를 grammar × 토큰 조합으로 나란히 렌더링해
 * 토큰만 바꿔도 충분히 달라지는지 눈으로 확인한다.
 */
export default function GrammarLab() {
  const [portfolio, setPortfolio] = useState(null);
  const [narrow, setNarrow] = useState(false);
  const [panels, setPanels] = useState(INITIAL_PANELS);

  useEffect(() => {
    loadDraft().then(setPortfolio);
  }, []);

  if (!portfolio) return <p>불러오는 중…</p>;

  const update = (i, patch) => setPanels((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <div>
      <h2 style={{ fontSize: 18 }}>카드 썸네일 10종</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
        {GRAMMARS.map((g) => (
          <figure key={g.id} style={{ margin: 0 }}>
            <Thumbnail grammarId={g.id} />
            <figcaption style={{ fontSize: 13, marginTop: 6 }}><b>{g.name}</b> — {g.blurb}</figcaption>
          </figure>
        ))}
      </div>
      <p>
        <label>
          <input type="checkbox" checked={narrow} onChange={(e) => setNarrow(e.target.checked)} /> 모바일 폭(360px)으로 보기
        </label>
      </p>
      {panels.map((panel, i) => {
        const Template = getTemplate(panel.template);
        const source = TOKEN_SOURCES.find((s) => s.key === panel.tokens);
        const fails = source ? checkTokens(source.tokens) : [];
        return (
          <section key={i} style={{ marginBlock: 32 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
              <label>
                템플릿{" "}
                <select value={panel.template} onChange={(e) => update(i, { template: e.target.value })}>
                  {Object.keys(TEMPLATES).map((id) => <option key={id} value={id}>{grammarById[id]?.name ?? id}</option>)}
                </select>
              </label>
              <label>
                토큰{" "}
                <select value={panel.tokens} onChange={(e) => update(i, { tokens: e.target.value })}>
                  {TOKEN_SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
            </div>
            <p style={{ color: fails.length ? "#B00020" : "#1B6E3A", margin: "8px 0" }}>
              {fails.length
                ? `대비 실패: ${fails.map((f) => `${f.label} ${f.ratio}:1 (기준 ${f.min})`).join(", ")}`
                : "대비 검사 통과"}
            </p>
            <div style={{ width: narrow ? 360 : "100%", border: "1px solid #ccc", maxHeight: 720, overflow: "auto" }}>
              {Template && source && <Template portfolio={portfolio} tokens={source.tokens} />}
            </div>
          </section>
        );
      })}
    </div>
  );
}
