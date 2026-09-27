import { useId } from "react";
import { fieldLabel } from "./fields.js";
import { targetLabel } from "../../engine/aiEdits.js";

const SUGGESTIONS = ["전체 분위기를 조금 더 따뜻하게", "첫 화면 제목을 더 대담하게", "나에게 어울리는 개성 포인트 하나 더하기", "문구를 더 짧고 자연스럽게", "여백을 넉넉하게"];

/**
 * Claude에게 부탁하기: 캔버스에서 단 메모 + 페이지 전체 부탁 → 한 번에 반영, 결과는 되돌릴 수 있다.
 * Claude는 글·색·글꼴·크기·개성 포인트만 바꿀 수 있다(배치·링크·이미지는 그대로).
 * @param {{ notes: {target, request}[], onRemoveNote: (i) => void, message: string, onMessage: (v) => void,
 *           busy: boolean, onAsk: () => void, result: null | { reply, changes, skipped, error? }, onUndo: () => void,
 *           snippet: (field) => string }} props
 */
export default function AskPanel({ notes, onRemoveNote, message, onMessage, busy, onAsk, result, onUndo, snippet }) {
  const id = useId();
  const canAsk = !busy && (notes.length > 0 || message.trim().length > 0);

  return (
    <section className="ask" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="ask-h">Claude에게 부탁하기</h2>
      <p className="iv-meta iv-left">위 미리보기에서 “메모”를 누르고 바꿀 곳을 고르거나, 아래에 페이지 전체에 대한 부탁을 적어 주세요. 글·색·글꼴·크기·개성 포인트를 바꿔 줘요. 배치·링크·이미지는 그대로예요.</p>

      {notes.length > 0 && (
        <ol className="ask-notes">
          {notes.map((n, i) => (
            <li key={i}>
              <span className="ask-no" aria-hidden="true">{i + 1}</span>
              <span className="ask-note-body">
                <strong>{fieldLabel(n.target)}</strong>
                {snippet(n.target) && <span className="ask-snip"> “{snippet(n.target)}”</span>}
                <br />{n.request}
              </span>
              <button type="button" className="iv-btn iv-btn-quiet ask-del" onClick={() => onRemoveNote(i)}>
                지우기<span className="iv-sr">: {i + 1}번 메모</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="ask-field">
        <label htmlFor={`${id}-msg`} className="pb-label">페이지 전체에 부탁하기 (선택)</label>
        <textarea id={`${id}-msg`} rows={2} maxLength={500} value={message} placeholder="예: 조금 더 차분하고 믿음직하게"
          onChange={(e) => onMessage(e.target.value)} />
        <div className="ask-sugs" role="group" aria-label="부탁 예시">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="iv-chip ask-sug" onClick={() => onMessage(s)}>{s}</button>
          ))}
        </div>
      </div>

      <button type="button" className="iv-btn iv-btn-primary" disabled={!canAsk} onClick={onAsk}>
        {busy ? "Claude가 고치는 중…" : `Claude에게 반영 부탁하기${notes.length ? ` (메모 ${notes.length}개)` : ""}`}
      </button>

      <div role="status" aria-live="polite" className="ask-result-wrap">
        {result?.error && <p className="pb-bad">{result.error}</p>}
        {result && !result.error && (
          <div className="ask-result">
            {result.reply && <p className="ask-reply">{result.reply}</p>}
            {result.changes.length > 0 ? (
              <>
                <p className="iv-meta iv-left">바꾼 곳 {result.changes.length}군데: {[...new Set(result.changes.map((c) => targetLabel(c.target)))].join(", ")}</p>
                <button type="button" className="iv-btn iv-btn-quiet" onClick={onUndo}>모두 되돌리기</button>
              </>
            ) : (
              <p className="iv-meta iv-left">바뀐 곳은 없어요.</p>
            )}
            {result.skipped.length > 0 && (
              <p className="iv-meta iv-left">적용하지 않은 제안 {result.skipped.length}개 ({[...new Set(result.skipped.map((s) => s.reason))].join(", ")})</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
