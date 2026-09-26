import { useEffect, useRef, useState } from "react";
import { loadInterview, saveInterview, clearInterview } from "../../api/index.js";
import { replayAnswers } from "../../engine/replay.js";
import { CONTENT_SECTIONS, DIRECTION_KINDS } from "../../data/interviewOptions.js";
import IntentStep from "./IntentStep.jsx";
import GoalStep from "./GoalStep.jsx";
import TraitsStep from "./TraitsStep.jsx";
import TermsStep from "./TermsStep.jsx";
import PriorityStep from "./PriorityStep.jsx";
import CardsStep from "./CardsStep.jsx";
import PairwiseStep from "./PairwiseStep.jsx";
import ConfirmStep from "./ConfirmStep.jsx";
import DirectionsStep from "../directions/DirectionsStep.jsx";
import DoneStep from "./DoneStep.jsx";
import "./interview.css";

/** 전체 계획 단계 수 (자유 입력 → 목적 → 인상 → 단어 풀기 → 우선순위 → 카드 → A/B → 확인) */
const PLANNED_TOTAL = 8;

const cut = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * 단계 정의(화면). n: 인터뷰 번호(1~8) / summarize: 요약 칩 문구.
 * 답을 DNA에 반영하는 순서와 함수는 engine/replay.js (편집기도 같이 쓴다).
 * wide: 넓은 레이아웃(3안·결과) — 인터뷰 요약은 접어 둔다.
 * directions(3안 고르기)도 답의 하나라서 고른 결과가 DNA에 반영된다. done은 편집기 전까지의 마지막 화면.
 */
const STEPS = [
  {
    id: "intent", n: 1, title: "소개",
    question: "어떤 사람이고, 어떤 포트폴리오를 만들고 싶나요?",
    hint: "한두 문장이면 충분해요. 디자인 용어는 몰라도 괜찮아요.",
    Component: IntentStep,
    summarize: (v) => [`“${cut(v.text, 20)}”`],
  },
  {
    id: "goal", n: 2, title: "목적",
    question: "누구에게, 무엇을 위해 보여주나요?",
    hint: "가장 가까운 것을 하나씩 골라 주세요. 없으면 직접 적어도 돼요.",
    Component: GoalStep,
    summarize: (v) => [v.primaryGoal, v.audience],
  },
  {
    id: "traits", n: 3, title: "인상",
    question: "사이트를 본 사람에게 어떤 인상으로 남고 싶나요?",
    hint: "기억되고 싶은 인상은 최대 3개, 피하고 싶은 인상도 함께 골라 주세요. 피하고 싶은 쪽이 오히려 더 중요한 단서예요.",
    Component: TraitsStep,
    summarize: (v) => [...v.target, ...v.avoid.map((a) => `✕ ${a}`)],
  },
  {
    id: "terms", n: 4, title: "단어",
    question: "쓰신 말을 조금만 더 풀어볼게요",
    hint: "같은 단어도 사람마다 떠올리는 화면이 달라요. 가까운 뜻을 한두 개 골라 주세요.",
    Component: TermsStep,
    summarize: (v) => [`${Object.keys(v.choices).length}개 단어`],
  },
  {
    id: "priority", n: 5, title: "순서",
    question: "무엇을 먼저 보여줄까요?",
    hint: "첫 화면 다음에 나올 순서예요. 화살표로 바꿀 수 있어요.",
    Component: PriorityStep,
    summarize: (v) => [v.order.map((id) => CONTENT_SECTIONS.find((s) => s.id === id)?.label).join(" > ")],
  },
  {
    id: "cards", n: 6, title: "카드",
    question: "끌리는 사이트를 골라 주세요",
    hint: "이유는 몰라도 괜찮아요. 처음 봤을 때 느낌대로 빠르게 골라 주세요.",
    Component: CardsStep,
    summarize: (v) => {
      const count = (k) => v.reactions.filter((r) => r.reaction === k).length;
      return [`좋아요 ${count("like")}`, `별로 ${count("dislike")}`];
    },
  },
  {
    id: "pairwise", n: 7, title: "비교",
    question: "둘 중 어느 쪽이 더 끌리나요?",
    hint: "카드만으로는 헷갈린 부분만 몇 번 여쭤볼게요.",
    Component: PairwiseStep,
    summarize: (v) => [`${v.choices.length}번 비교`],
  },
  {
    id: "confirm", n: 8, title: "확인",
    question: "제가 이해한 방향이 맞나요?",
    hint: "틀린 건 바로잡아 주세요. 고쳐 주신 내용이 제 추측보다 우선이에요.",
    Component: ConfirmStep,
    summarize: (v) => {
      const rs = Object.values(v.responses);
      return [`맞아요 ${rs.filter((r) => r === "yes").length}`, `고침 ${rs.filter((r) => r !== "yes").length}`];
    },
  },
  {
    id: "directions", title: "3안", wide: true,
    question: "세 가지 방향을 만들었어요",
    hint: "고르신 카드와 답을 바탕으로 만든 세 안이에요. 크게 보고 비교한 뒤 하나를 골라 주세요.",
    Component: DirectionsStep,
    summarize: (v) => [DIRECTION_KINDS[v.kind].label],
  },
  {
    id: "done", title: "완료", wide: true,
    question: "이 안으로 시작할게요",
    hint: "인터뷰에서 이해한 내용과 고른 안이에요. 언제든 위의 답을 눌러 고칠 수 있어요.",
    final: true,
  },
];

export default function Interview({ onOpenEditor }) {
  const [session, setSession] = useState(null);
  const headingRef = useRef(null);

  useEffect(() => { loadInterview().then(setSession); }, []);
  // 단계가 바뀌면 질문 제목으로 focus 이동 (스크린리더가 새 질문을 읽도록)
  useEffect(() => { headingRef.current?.focus(); }, [session?.step]);

  if (!session) return <p>불러오는 중…</p>;

  const index = Math.max(0, STEPS.findIndex((s) => s.id === session.step));
  const step = STEPS[index];

  const commit = (patch) => {
    const next = { ...session, ...patch };
    setSession(next);
    saveInterview(next);
  };
  const submit = (value) => {
    const answers = { ...session.answers, [step.id]: value };
    // 3안을 다시 고르면 원래 토큰이 바뀌므로 이전 편집 기록은 더 이상 맞지 않는다
    if (step.id === "directions") delete answers.edits;
    commit({ answers, dna: replayAnswers(answers), step: STEPS[index + 1].id });
  };
  const goTo = (id) => commit({ step: id });
  const back = index > 0 ? () => goTo(STEPS[index - 1].id) : null;
  const reset = () => clearInterview().then(setSession);

  const answered = STEPS.slice(0, index).filter((s) => session.answers[s.id]);
  const headingId = `iv-q-${step.id}`;
  const progressLabel = step.n ? `${step.n}/${PLANNED_TOTAL} 단계` : step.final ? "완료" : "인터뷰 완료 · 3안 고르기";

  const trail = answered.length > 0 && (
    <nav className="iv-trail" aria-label="지금까지의 답 (눌러서 고치기)">
      <ul>
        {answered.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => goTo(s.id)} aria-label={`${s.title} 답 고치기: ${s.summarize(session.answers[s.id]).join(", ")}`}>
              <span className="iv-trail-title">{s.title}</span>
              {s.summarize(session.answers[s.id]).join(" · ")}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className={`iv${step.wide ? " iv-wide" : ""}`}>
      <div className="iv-progress">
        <label htmlFor="iv-progress-bar">{progressLabel}</label>
        <progress id="iv-progress-bar" value={step.n ? step.n - 1 : PLANNED_TOTAL} max={PLANNED_TOTAL} />
      </div>

      {trail && (step.wide ? (
        <details className="iv-trail-box">
          <summary>인터뷰 답 보기 · 고치기 ({answered.length})</summary>
          {trail}
        </details>
      ) : trail)}

      <h1 id={headingId} ref={headingRef} tabIndex={-1} className="iv-question">{step.question}</h1>
      <p className="iv-hint">{step.hint}</p>

      {step.final ? (
        <DoneStep session={session} onBack={back} onReset={reset} onOpenEditor={onOpenEditor} />
      ) : (
        <step.Component
          key={step.id}
          value={session.answers[step.id]}
          baseDna={replayAnswers(session.answers, step.id)}
          onSubmit={submit}
          onBack={back}
          onGoTo={goTo}
          labelledBy={headingId}
        />
      )}
    </div>
  );
}
