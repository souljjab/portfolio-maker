/** 단계 하단 버튼: 이전 / 다음(제출) + 오류 안내 */
export default function StepActions({ onBack, submitLabel = "다음", busy = false, error = "" }) {
  return (
    <div className="iv-actions">
      <p className="iv-error" role="alert">{error}</p>
      <div className="iv-actions-row">
        {onBack && <button type="button" className="iv-btn iv-btn-quiet" onClick={onBack}>이전</button>}
        <button type="submit" className="iv-btn iv-btn-primary" disabled={busy}>{busy ? "읽는 중…" : submitLabel}</button>
      </div>
    </div>
  );
}
