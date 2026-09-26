import { useEffect, useState } from "react";
import { onSyncStatus, syncNow, resolveConflict } from "../api/index.js";
import AccountStep from "./publish/AccountStep.jsx";
import "./interview/interview.css";
import "./publish/publish.css";
import "./sync.css";

const when = (t) => (t ? new Date(t).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const noop = () => {};

/**
 * 앱 위쪽 동기화 상태 줄 + 계정(로그아웃·보호자 동의 확인) 칸.
 * 앱은 로그인한 사람만 쓰므로 보통 "모든 기기에 저장됨". 보호자 동의 전이면 이 기기에만 저장된다.
 * 양쪽이 다 바뀐 충돌이면 무엇이 사라지는지 적고 고르게 한다.
 */
export default function SyncStatus() {
  const [s, setS] = useState({ state: "local" });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => onSyncStatus(setS), []);
  useEffect(() => { syncNow(); }, []);

  const choose = async (choice) => {
    setBusy(true);
    await resolveConflict(choice);
    setBusy(false);
  };
  const retry = () => syncNow();

  if (s.state === "conflict") {
    return (
      <div className="sy sy-conflict" role="alert">
        <p><strong>다른 기기에서 {when(s.remoteUpdatedAt)}에 저장한 내용이 있어요.</strong> 이 기기에도 아직 올리지 않은 변경이 있어요. 어느 쪽으로 할까요?</p>
        <div className="sy-btns">
          <button type="button" className="iv-btn iv-btn-quiet" disabled={busy} onClick={() => choose("remote")}>
            다른 기기 내용 가져오기<span className="sy-sub">이 기기의 변경은 사라져요</span>
          </button>
          <button type="button" className="iv-btn iv-btn-quiet" disabled={busy} onClick={() => choose("local")}>
            이 기기 내용으로 저장<span className="sy-sub">다른 기기의 변경은 사라져요</span>
          </button>
        </div>
      </div>
    );
  }

  const text = {
    local: "확인하는 중…",
    "local-minor": "보호자 동의가 끝나면 다른 기기와 이어 쓸 수 있어요.",
    syncing: "저장하는 중…",
    synced: `모든 기기에 저장됨${s.syncedAt ? ` · ${when(s.syncedAt)}` : ""}`,
    offline: "서버에 연결할 수 없어 이 기기에만 저장했어요.",
    error: `다른 기기에 저장하지 못했어요. ${s.reason ?? ""}`,
  }[s.state];

  return (
    <div className={`sy is-${s.state}`}>
      <p role="status" className="sy-text">{text}</p>
      <button type="button" className="iv-btn iv-btn-quiet sy-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>계정</button>
      {(s.state === "offline" || s.state === "error") && (
        <button type="button" className="iv-btn iv-btn-quiet" onClick={retry}>다시 시도</button>
      )}
      {open && (
        <div className="sy-panel">
          <AccountStep idPrefix="sy" onChange={noop} />
        </div>
      )}
    </div>
  );
}
