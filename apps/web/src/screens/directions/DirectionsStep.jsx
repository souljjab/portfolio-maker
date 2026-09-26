import { useEffect, useMemo, useRef, useState } from "react";
import { generateDirections, loadDraft, saveDraft } from "../../api/index.js";
import { mixTokens } from "../../engine/directions.js";
import { DIRECTION_KINDS, DIRECTION_REASONS, CONTENT_SECTIONS } from "../../data/interviewOptions.js";
import PreviewFrame from "./PreviewFrame.jsx";
import { useResolvedPortfolio } from "../useResolvedPortfolio.js";
import ChipPicker from "../interview/ChipPicker.jsx";
import "./directions.css";

const DEFAULT_ORDER = CONTENT_SECTIONS.map((s) => s.id);

/**
 * 인터뷰 마지막 단계: DNA로 만든 Safe·Core·Stretch 3안을 비교하고 하나를 고른다.
 * - 미리보기는 발행될 정적 HTML과 같은 문서를 iframe에 넣어 보여준다.
 * - 이름·한 줄 소개를 넣으면 세 안 모두 내 이름으로 바뀐다(초안에 저장). 작업 목록은 예시.
 * - 고르면 "어디가 마음에 들었나요?"를 묻고, 원하면 다른 안의 색·글꼴을 섞은 뒤 초안(grammar·template·tokens)으로 저장.
 * value: 이전에 고른 결과 { kind, grammar, template, others, reasons, mix: { color, type } }
 */
export default function DirectionsStep({ value, baseDna, onSubmit, onBack, onGoTo }) {
  const [directions, setDirections] = useState(null);
  const [render, setRender] = useState(null);     // renderPortfolioHtml — 정적 렌더러는 무거워서 이 화면에서만 불러온다
  const [portfolio, setPortfolio] = useState(null);
  const [person, setPerson] = useState({ name: "", headline: "" }); // 입력 중인 값 (0.4초 뒤 반영)
  const [detail, setDetail] = useState(null);     // 크게 보는 안
  const [device, setDevice] = useState("desktop");
  const [choosing, setChoosing] = useState(null); // 이유를 묻는 중인 안
  const [reasons, setReasons] = useState(value?.reasons ?? []);
  const [mix, setMix] = useState(value?.mix ?? null); // { color, type }: 색·글꼴을 가져올 안
  // 이 단계가 열릴 때의 DNA로 한 번만 만든다. 앞 단계 답이 바뀌면 인터뷰를 거쳐 이 단계가 새로 열린다.
  const [dnaAtOpen] = useState(baseDna);
  const focusRef = useRef(null);
  const returnTo = useRef(null);

  useEffect(() => {
    let alive = true;
    Promise.all([generateDirections(dnaAtOpen), loadDraft(), import("../../templates/renderHtml.js")]).then(([d, p, mod]) => {
      if (!alive) return;
      setRender(() => mod.renderPortfolioHtml);
      setDirections(d);
      setPortfolio(p);
      setPerson({ name: p.person.name, headline: p.person.headline });
    });
    return () => { alive = false; };
  }, [dnaAtOpen]);

  // 이름·한 줄 소개: 입력이 멈추면 미리보기와 초안에 반영
  useEffect(() => {
    if (!portfolio) return;
    const t = setTimeout(() => {
      const name = person.name.trim() || "이름"; // 비워 두면 자리 표시 이름 (비교도 이 값으로 해야 반복 저장이 안 생김)
      if (name === portfolio.person.name && person.headline === portfolio.person.headline) return;
      const next = { ...portfolio, person: { ...portfolio.person, name, headline: person.headline } };
      setPortfolio(next);
      saveDraft(next);
    }, 400);
    return () => clearTimeout(t);
  }, [person, portfolio]);

  // 보기가 바뀌면 새로 나타난 제목으로 focus (스크린리더가 바뀐 화면을 읽도록)
  useEffect(() => { focusRef.current?.focus(); }, [detail, choosing]);
  useEffect(() => {
    if (!detail && !choosing && returnTo.current) {
      document.getElementById(`dr-card-${returnTo.current}`)?.focus();
      returnTo.current = null;
    }
  }, [detail, choosing]);

  const order = baseDna.goal.contentPriority?.length ? baseDna.goal.contentPriority : DEFAULT_ORDER;
  const orderKey = order.join(",");
  const preview = useMemo(
    () => portfolio && { ...portfolio, sections: ["hero", ...orderKey.split(",")] },
    [portfolio, orderKey],
  );
  const drawable = useResolvedPortfolio(preview); // 이미지 참조를 푼 그리기용 사본
  const htmls = useMemo(() => (directions && drawable && render
    ? Object.fromEntries(directions.map((d) => [d.kind, render({ portfolio: drawable, tokens: d.tokens, template: d.template, preview: true })]))
    : null), [directions, drawable, render]);

  if (!htmls) {
    return <p className="dr-loading" role="status">고르신 카드와 답으로 세 가지 방향을 만드는 중이에요…</p>;
  }

  const byKind = Object.fromEntries(directions.map((d) => [d.kind, d]));
  // 세 안 모두에 같은 안내(예: 지킨 hard 제약)는 카드마다 반복하지 않고 위에 한 번만
  const common = (directions[0].notes ?? []).filter((n) => directions.every((d) => (d.notes ?? []).includes(n)));
  const ownNotes = (d) => (d.notes ?? []).filter((n) => !common.includes(n));
  const label = (k) => DIRECTION_KINDS[k].label;
  const openDetail = (k) => { returnTo.current = k; setDetail(k); };
  const closeDetail = () => setDetail(null);
  const startChoose = (k) => {
    returnTo.current = k;
    // 지난번에 같은 안을 골랐으면 그때 섞은 설정을 되살리고, 아니면 섞지 않은 상태로 시작
    setMix(value?.kind === k && value.mix ? value.mix : { color: k, type: k });
    setChoosing(k);
  };
  const kindOfLabel = (l) => directions.find((x) => label(x.kind) === l).kind;

  // 고른 뒤: 이유 묻기 + 섞기
  if (choosing) {
    const d = byKind[choosing];
    const m = mix ?? { color: choosing, type: choosing };
    const mixed = m.color !== choosing || m.type !== choosing;
    const tokens = mixed ? mixTokens(d, byKind[m.color], byKind[m.type]) : d.tokens;
    const html = mixed ? render({ portfolio: drawable, tokens, template: d.template, preview: true }) : htmls[choosing];

    const confirm = async () => {
      await saveDraft({ ...preview, grammar: d.grammar, template: d.template, tokens, originTokens: tokens });
      onSubmit({
        kind: d.kind, grammar: d.grammar, template: d.template,
        others: directions.filter((x) => x.kind !== d.kind).map((x) => x.grammar),
        reasons, mix: m,
      });
    };

    return (
      <section className="dr-choose" aria-labelledby="dr-choose-h">
        <div className="dr-choose-preview">
          <PreviewFrame mode="thumb" html={html} title={`${label(choosing)} 미리보기${mixed ? " (섞은 결과)" : ""}`} />
          {mixed && <p className="iv-meta iv-left" aria-live="polite">섞은 결과예요. 배치와 간격은 {label(choosing)} 그대로예요.</p>}
        </div>
        <div className="dr-choose-body">
          <h2 id="dr-choose-h" ref={focusRef} tabIndex={-1}>{label(choosing)}을 고르셨어요</h2>
          <p className="dr-rationale">{d.rationale}</p>
          {(d.notes ?? []).map((n) => <p key={n} className="dr-note">{n}</p>)}
          <ChipPicker
            legend="어디가 마음에 드셨나요? 여러 개 골라도 돼요."
            options={DIRECTION_REASONS}
            selected={reasons}
            onChange={setReasons}
          />
          <p className="iv-meta iv-left">고르지 않아도 괜찮아요. 알려 주시면 다음 조정에 쓸게요.</p>
          <details className="dr-mix" open={mixed}>
            <summary>다른 안에서 색이나 글꼴 가져오기 (선택)</summary>
            <ChipPicker
              legend="색"
              options={directions.map((x) => label(x.kind))}
              single
              selected={[label(m.color)]}
              onChange={([l]) => setMix({ ...m, color: kindOfLabel(l) })}
            />
            <ChipPicker
              legend="글꼴"
              options={directions.map((x) => label(x.kind))}
              single
              selected={[label(m.type)]}
              onChange={([l]) => setMix({ ...m, type: kindOfLabel(l) })}
            />
          </details>
          <div className="iv-actions-row">
            <button type="button" className="iv-btn iv-btn-quiet" onClick={() => setChoosing(null)}>다시 볼게요</button>
            <button type="button" className="iv-btn iv-btn-primary" onClick={confirm}>이 안으로 정하기</button>
          </div>
        </div>
      </section>
    );
  }

  // 한 안을 크게
  if (detail) {
    const d = byKind[detail];
    return (
      <section className="dr-detail" aria-labelledby="dr-detail-h">
        <div className="dr-bar">
          <button type="button" className="iv-btn iv-btn-quiet" onClick={closeDetail}>← 세 안 모두 보기</button>
          <div className="dr-seg" role="group" aria-label="다른 안 보기">
            {directions.map((x) => (
              <button key={x.kind} type="button" aria-pressed={x.kind === detail} onClick={() => setDetail(x.kind)}>{label(x.kind)}</button>
            ))}
          </div>
          <div className="dr-seg" role="group" aria-label="화면 크기">
            {[["desktop", "데스크톱"], ["mobile", "모바일"]].map(([k, t]) => (
              <button key={k} type="button" aria-pressed={device === k} onClick={() => setDevice(k)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="dr-detail-head">
          <div>
            <h2 id="dr-detail-h" ref={focusRef} tabIndex={-1}>{label(detail)}</h2>
            <p className="dr-rationale">{d.rationale}</p>
              {(d.notes ?? []).map((n) => <p key={n} className="dr-note">{n}</p>)}
            <ul className="dr-sigs" aria-label="이 안의 특징">{d.signatures.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
          <button type="button" className="iv-btn iv-btn-primary" onClick={() => startChoose(detail)}>이 안으로 할게요</button>
        </div>
        <PreviewFrame key={`${detail}-${device}`} mode="full" device={device} html={htmls[detail]} title={`${label(detail)} 미리보기 (${device === "mobile" ? "모바일" : "데스크톱"})`} />
      </section>
    );
  }

  // 세 안 한눈에
  return (
    <div className="dr">
      <section className="dr-name" aria-labelledby="dr-name-h">
        <h2 id="dr-name-h">내 이름으로 보기 <span className="dr-optional">선택</span></h2>
        <div className="dr-name-fields">
          <label>이름
            <input type="text" maxLength={30} value={person.name} onChange={(e) => setPerson((p) => ({ ...p, name: e.target.value }))} />
          </label>
          <label>한 줄 소개
            <input type="text" maxLength={60} value={person.headline} onChange={(e) => setPerson((p) => ({ ...p, headline: e.target.value }))} />
          </label>
        </div>
        <p className="iv-meta iv-left">작업 목록은 예시예요. 고른 뒤 편집기에서 내 작업으로 바꿀 수 있어요.</p>
      </section>

      {common.map((n) => <p key={n} className="dr-note dr-note-common">{n}</p>)}
      <ul className="dr-grid">
        {directions.map((d) => (
          <li key={d.kind} className={`dr-card is-${d.kind}${value?.kind === d.kind ? " is-picked" : ""}`}>
            <PreviewFrame mode="thumb" html={htmls[d.kind]} title={`${label(d.kind)} 미리보기`} />
            <div className="dr-card-body">
              <h2 id={`dr-card-${d.kind}`} tabIndex={-1} className="dr-kind">
                {label(d.kind)}
                {value?.kind === d.kind && <span className="dr-badge">지난번 선택</span>}
              </h2>
              <p className="dr-kind-note">{DIRECTION_KINDS[d.kind].note}</p>
              <p className="dr-rationale">{d.rationale}</p>
              {ownNotes(d).map((n) => <p key={n} className="dr-note">{n}</p>)}
              <ul className="dr-sigs" aria-label="이 안의 특징">{d.signatures.map((s) => <li key={s}>{s}</li>)}</ul>
              <div className="dr-actions">
                <button type="button" className="iv-btn iv-btn-quiet" onClick={() => openDetail(d.kind)}>크게 보기</button>
                <button type="button" className="iv-btn iv-btn-primary" onClick={() => startChoose(d.kind)}>이 안으로 할게요</button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <section className="dr-retry" aria-labelledby="dr-retry-h">
        <h2 id="dr-retry-h">마음에 드는 안이 없나요?</h2>
        <p>다시 만들기 대신, 답을 고치면 세 안이 새로 만들어져요.</p>
        <div className="dr-retry-btns">
          <button type="button" className="iv-btn iv-btn-quiet" onClick={() => onGoTo("cards")}>카드 다시 고르기</button>
          <button type="button" className="iv-btn iv-btn-quiet" onClick={() => onGoTo("traits")}>원하는 인상 고치기</button>
          <button type="button" className="iv-btn iv-btn-quiet" onClick={onBack}>방향 확인 고치기</button>
        </div>
      </section>
    </div>
  );
}
