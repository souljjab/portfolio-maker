import { useEffect, useId, useState } from "react";
import { listVersions } from "../../api/index.js";

const when = (t) => new Date(t).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * 버전 기록: 지금 버전 저장(이름 선택) + 목록 + 되돌리기. 되돌리기 전 상태도 자동으로 버전이 되므로 언제든 다시 돌아갈 수 있다.
 * 자동으로 남는 때: Claude 다듬기 전, 되돌리기 전, 3안 다시 고르기 전, 편집 10분마다.
 * @param {{ onSave: (label: string) => Promise<{ok, reason?}>, onRestore: (id, label) => Promise<{ok, reason?}>, refreshKey: number }} props
 */
export default function VersionPanel({ onSave, onRestore, refreshKey }) {
  const id = useId();
  const [data, setData] = useState(null); // { versions, where } | { error }
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    listVersions().then((r) => { if (alive) setData(r.ok ? r : { error: r.reason }); });
    return () => { alive = false; };
  }, [refreshKey]);

  const run = async (fn, done) => {
    setBusy(true); setMsg("");
    const r = await fn();
    setBusy(false);
    setMsg(r.ok ? done : r.reason ?? "하지 못했어요.");
  };

  return (
    <details className="vp">
      <summary>버전 기록{data?.versions ? ` (${data.versions.length})` : ""}</summary>
      <p className="iv-meta iv-left">
        {data?.where === "device" ? "보호자 동의 전이라 이 기기에만 저장돼요(최근 30개)." : "최근 30개를 저장해요. 다른 기기에서도 되돌릴 수 있어요."} Claude 다듬기 전·되돌리기 전·3안 다시 고르기 전과 편집 10분마다 자동으로 남아요.
      </p>
      <form className="vp-save" onSubmit={(e) => { e.preventDefault(); run(() => onSave(name.trim() || "직접 저장"), "지금 버전을 저장했어요."); setName(""); }}>
        <label htmlFor={`${id}-name`} className="iv-sr">저장할 버전 이름 (선택)</label>
        <input id={`${id}-name`} type="text" maxLength={40} value={name} placeholder="이름 (선택) 예: 발행 전" onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="iv-btn iv-btn-quiet" disabled={busy}>지금 버전 저장</button>
      </form>
      {data?.error && <p className="pb-bad">{data.error}</p>}
      {data?.versions?.length === 0 && <p className="iv-meta iv-left">아직 저장한 버전이 없어요.</p>}
      {data?.versions?.length > 0 && (
        <ol className="vp-list">
          {data.versions.map((v) => (
            <li key={v.id}>
              <span><strong>{v.label}</strong> <span className="iv-meta">{when(v.createdAt)}</span></span>
              <button type="button" className="iv-btn iv-btn-quiet" disabled={busy}
                onClick={() => run(() => onRestore(v.id, v.label), `‘${v.label}’ 버전으로 되돌렸어요. 되돌리기 전 상태도 버전으로 남겼어요.`)}>
                되돌리기<span className="iv-sr">: {v.label}, {when(v.createdAt)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <p role="status" className="iv-meta iv-left">{msg}</p>
    </details>
  );
}
