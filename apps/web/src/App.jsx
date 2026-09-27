import { useEffect, useState } from "react";
import { createEmptyDNA, AXES } from "./schema/types.js";
import { GRAMMARS } from "./data/grammars.js";
import { applyCardReaction, pickUncertainAxis, pickPairFor, applyPairwise, computeGrammarMix } from "./engine/taste.js";
import GrammarLab from "./screens/GrammarLab.jsx";
import Interview from "./screens/interview/Interview.jsx";
import Editor from "./screens/editor/Editor.jsx";
import Publish from "./screens/publish/Publish.jsx";
import SyncStatus from "./screens/SyncStatus.jsx";
import StartGate from "./screens/start/StartGate.jsx";
import { onRemoteApplied, onAccountChange, getAccount, cancelAccountDeletion } from "./api/index.js";

/**
 * 임시 개발용 셸: 인터뷰 / 편집기 / 발행 / 템플릿 비교 / 엔진 디버그를 탭으로 전환.
 * 로그인한 사람만 쓴다 — 처음엔 "무료로 시작하기"(가입·로그인·나이 확인) 화면.
 */
export default function App() {
  const [account, setAccount] = useState(undefined); // undefined: 확인 중, null: 로그인 안 함
  const [minorContinue, setMinorContinue] = useState(false); // 보호자 동의 전 만 14세 미만이 "먼저 만들어 보기"를 누름
  useEffect(() => onAccountChange(setAccount), []);
  useEffect(() => { getAccount().then((r) => { if (!r.ok) setAccount(null); }); }, []);

  if (account === undefined) return <p role="status" style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>불러오는 중…</p>;
  const needsStart = !account || account.ageStatus === "unknown" || (!account.canPublish && !minorContinue);
  if (needsStart) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 16px", colorScheme: "light", color: "#111" }}>
        <StartGate onChange={setAccount} onContinueMinor={() => setMinorContinue(true)} />
      </div>
    );
  }
  return (
    <>
      {account.deletionScheduledAt && <DeletionBanner at={account.deletionScheduledAt} />}
      <Workspace />
    </>
  );
}

/** 삭제 예약 중인 계정: 모든 화면 위에 알리고 바로 취소할 수 있게 */
function DeletionBanner({ at }) {
  const [busy, setBusy] = useState(false);
  const date = new Date(at).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  return (
    <div role="alert" style={{ maxWidth: 1280, margin: "0 auto", padding: "12px 24px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
      background: "#FFF6F5", borderBottom: "1px solid #B3261E", color: "#1A1A1A", fontFamily: "system-ui, sans-serif" }}>
      <span>이 계정은 <strong>{date}</strong>에 삭제돼요. 사이트는 이미 내려갔고, 발행은 할 수 없어요.</span>
      <button type="button" disabled={busy} style={{ minHeight: 40, padding: "0 14px", borderRadius: 8, border: "1px solid #B3261E", background: "#fff", color: "#8A1C15", fontWeight: 700, cursor: "pointer" }}
        onClick={async () => { setBusy(true); await cancelAccountDeletion(); setBusy(false); }}>삭제 취소</button>
    </div>
  );
}

function Workspace() {
  const [view, setView] = useState("interview");
  const [editorFocus, setEditorFocus] = useState(null); // 발행 화면의 "고치러 가기" → 편집기에서 focus할 칸
  // 다른 기기의 내용을 가져오면 열려 있던 화면을 새로 불러온다(오래된 화면이 새 내용을 덮어쓰지 않게)
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => onRemoteApplied(() => setReloadKey((k) => k + 1)), []);
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif", colorScheme: "light", background: "#fff", color: "#111" }}>
      <nav style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button aria-pressed={view === "interview"} onClick={() => setView("interview")}>인터뷰</button>
        <button aria-pressed={view === "editor"} onClick={() => setView("editor")}>편집기</button>
        <button aria-pressed={view === "publish"} onClick={() => setView("publish")}>발행</button>
        <button aria-pressed={view === "lab"} onClick={() => setView("lab")}>템플릿 비교</button>
        <button aria-pressed={view === "engine"} onClick={() => setView("engine")}>엔진 디버그</button>
        <a href="/landing.html" style={{ alignSelf: "center", marginInlineStart: "auto" }}>랜딩 페이지 ↗</a>
      </nav>
      <SyncStatus />
      <div key={reloadKey}>
      {view === "interview" && <Interview onOpenEditor={() => setView("editor")} />}
      {view === "editor" && (
        <Editor
          initialFocus={editorFocus}
          onGoInterview={() => setView("interview")}
          onPublish={() => setView("publish")}
        />
      )}
      {view === "publish" && <Publish onEdit={(fieldId) => { setEditorFocus(fieldId); setView("editor"); }} />}
      {view === "lab" && <GrammarLab />}
      {view === "engine" && <EngineDebug />}
      </div>
    </div>
  );
}

/**
 * 엔진이 제대로 도는지 확인하는 디버그 패널.
 * 실제 인터뷰 화면은 src/screens/ 에 단계별로 만들 예정.
 */
function EngineDebug() {
  const [dna, setDna] = useState(createEmptyDNA);
  const axis = pickUncertainAxis(dna);
  const pair = axis ? pickPairFor(axis) : null;
  const mix = computeGrammarMix(dna);

  return (
    <div style={{ maxWidth: 960 }}>
      <h1>취향 엔진 디버그</h1>

      <h2>카드 반응</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
        {GRAMMARS.map((g) => (
          <div key={g.id} style={{ border: "1px solid #ccc", padding: 12 }}>
            <strong>{g.name}</strong>
            <p style={{ margin: "4px 0 8px" }}>{g.blurb}</p>
            {["like", "neutral", "dislike"].map((r) => (
              <button key={r} onClick={() => setDna((d) => applyCardReaction(d, g.id, r))}>
                {{ like: "좋아요", neutral: "상관없음", dislike: "싫어요" }[r]}
              </button>
            ))}
          </div>
        ))}
      </div>

      {pair && (
        <>
          <h2>다음 A/B 질문 (불확실한 축: {axis})</h2>
          <button onClick={() => setDna((d) => applyPairwise(d, pair.a, pair.b))}>{pair.a}</button>{" "}
          <button onClick={() => setDna((d) => applyPairwise(d, pair.b, pair.a))}>{pair.b}</button>
        </>
      )}

      <h2>축 추정치</h2>
      <table>
        <tbody>
          {AXES.map((a) => (
            <tr key={a}>
              <td>{a}</td>
              <td>{dna.taste.axes[a].value}</td>
              <td>확신 {dna.taste.axes[a].confidence}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>grammar 혼합 비율</h2>
      <pre>{JSON.stringify(mix, null, 2)}</pre>

      <h2>신호 로그</h2>
      <ul>{dna.signals.map((s) => <li key={s.id}>[{s.kind}/{s.source}] {s.statement}</li>)}</ul>

      <button onClick={() => setDna(createEmptyDNA())}>초기화</button>
    </div>
  );
}
