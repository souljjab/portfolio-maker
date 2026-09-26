/**
 * 편집기 입력 칸: 라벨·안내·오류를 aria-describedby로 묶고, 오류면 aria-invalid.
 * multiline이면 textarea + 글자 수 표시.
 */
export default function EdField({ id, label, value, onChange, onBlur, error, hint, required, maxLength, multiline, placeholder, rows = 4 }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  const common = {
    id, value, maxLength, placeholder,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-required": required || undefined,
    onChange: (e) => onChange(e.target.value),
    onBlur,
  };
  return (
    <div className={`ed-field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}{required && <span className="ed-req" aria-hidden="true"> *</span>}</label>
      {multiline ? <textarea rows={rows} {...common} /> : <input type="text" {...common} />}
      {(hint || (multiline && maxLength)) && (
        <p id={hintId} className="ed-hint">
          {hint}
          {multiline && maxLength && <span className="ed-count">{value.length}/{maxLength}</span>}
        </p>
      )}
      {error && <p id={errId} className="ed-error">{error}</p>}
    </div>
  );
}
