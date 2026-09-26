import { useState } from "react";
import { interpretIntent } from "../../api/index.js";
import StepActions from "./StepActions.jsx";

const MAX = 300;

/** 1단계: 자유 입력 1~3문장 → interpretIntent로 모호한 단어 등 추출 */
export default function IntentStep({ value, onSubmit, onBack, labelledBy }) {
  const [text, setText] = useState(value?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (t.length < 5) return setError("한두 문장만 적어 주세요. 짧아도 괜찮아요.");
    setBusy(true);
    const interpretation = await interpretIntent(t);
    setBusy(false);
    onSubmit({ text: t, interpretation });
  };

  return (
    <form className="iv-form" onSubmit={submit} noValidate>
      <div className="iv-field">
        <textarea
          aria-labelledby={labelledBy}
          aria-describedby="iv-intent-count"
          rows={4}
          maxLength={MAX}
          value={text}
          placeholder="예: 학교에서 불편했던 걸 웹으로 고쳐 온 학생 개발자예요. 차분하지만 지루하지 않은 느낌이면 좋겠어요."
          onChange={(e) => { setText(e.target.value); setError(""); }}
        />
        <p id="iv-intent-count" className="iv-meta">{text.length}/{MAX}자</p>
      </div>
      <StepActions onBack={onBack} busy={busy} error={error} />
    </form>
  );
}
