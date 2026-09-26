import { useId, useState } from "react";

/**
 * 칩 모양 선택지 묶음. 실제로는 네이티브 checkbox/radio라 키보드·스크린리더로 그대로 조작된다.
 * single: 하나만 고르기(radio) / max: 여러 개 고를 때 최대 개수 / customLabel: 직접 입력 칸
 */
export default function ChipPicker({ legend, options, selected, onChange, single = false, max = Infinity, customLabel, disabled = false }) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false); // 직접 입력 칸은 필요할 때만 연다
  const name = useId();
  const custom = selected.filter((v) => !options.includes(v));
  const full = !single && selected.length >= max;

  const toggle = (v) => {
    if (single) onChange([v]);
    else onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };
  const add = () => {
    const t = draft.trim();
    if (!t || full) return;
    if (!selected.includes(t)) onChange(single ? [t] : [...selected, t]);
    setDraft("");
    setAdding(false);
  };

  return (
    <fieldset className="iv-field" disabled={disabled}>
      <legend>
        {legend}
        {!single && Number.isFinite(max) && <span className="iv-count" aria-live="polite"> {selected.length}/{max}</span>}
      </legend>
      <div className="iv-chips">
        {[...options, ...custom].map((v) => {
          const on = selected.includes(v);
          return (
            <label key={v} className="iv-chip">
              <input type={single ? "radio" : "checkbox"} name={name} checked={on} disabled={!on && full} onChange={() => toggle(v)} />
              <span>{v}</span>
            </label>
          );
        })}
        {customLabel && !adding && (
          <button type="button" className="iv-chip iv-chip-add" onClick={() => setAdding(true)} disabled={full}>
            + {customLabel}
          </button>
        )}
      </div>
      {customLabel && adding && (
        <div className="iv-custom">
          <input
            type="text"
            aria-label={`${legend} ${customLabel}`}
            placeholder={customLabel}
            value={draft}
            maxLength={20}
            disabled={full}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); add(); }
              if (e.key === "Escape") { setDraft(""); setAdding(false); }
            }}
          />
          <button type="button" className="iv-btn iv-btn-quiet" onClick={add} disabled={full || !draft.trim()}>추가</button>
        </div>
      )}
    </fieldset>
  );
}
