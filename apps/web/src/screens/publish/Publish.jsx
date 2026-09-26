import { useCallback, useEffect, useRef, useState } from "react";
import { loadDraft, checkSlug, publish, resolveImages, getSite, unpublish } from "../../api/index.js";
import { validatePortfolio, publishWarnings } from "../../engine/content.js";
import { downloadFile, fileBase } from "./download.js";
import AccountStep from "./AccountStep.jsx";
import "../interview/interview.css";
import "./publish.css";

/** 사이트 도메인 (배포: YOUR_DOMAIN, 로컬: localhost:8788) */
const SITE_DOMAIN = import.meta.env.VITE_SITE_DOMAIN || "YOUR_DOMAIN";

/** 검증 경로 → 편집기 칸 id (고치러 가기) */
function fieldIdFor(path, portfolio) {
  if (path === "person.name") return "ed-name";
  const [list, i, key] = path.split(".");
  if (list === "projects") return `ed-p-${portfolio.projects[Number(i)].id}-${key}`;
  if (list === "links") return `ed-l-${i}-${key}`;
  return null;
}

/**
 * 발행: 점검 → 주소 → 계정(보통 이미 로그인됨 — 나이 확인·보호자 동의 상태 확인) → 발행 → 내려받기.
 * 서버가 같은 템플릿으로 HTML을 만들어 주소.도메인에 공개한다. 계정당 사이트 하나(다른 주소로 발행하면 옮겨 감).
 * 정적 HTML·JSON은 발행과 상관없이 언제든 내려받을 수 있다("포트폴리오는 사용자의 것").
 */
export default function Publish({ onEdit }) {
  const [draft, setDraft] = useState(null);
  const [slug, setSlug] = useState("");
  const [checked, setChecked] = useState(null);     // 마지막 검사 결과 { slug, r }
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);       // publish 결과
  const [fileMsg, setFileMsg] = useState("");
  const [account, setAccount] = useState(null);     // 로그인한 계정
  const [site, setSite] = useState(null);           // 지금 공개 중인 내 사이트
  const [confirmOff, setConfirmOff] = useState(false);
  const [offMsg, setOffMsg] = useState("");
  // 계정이 바뀌면 그 계정의 사이트를 다시 불러오고, 발행할 수 없게 되면(로그아웃·다른 계정) 이전 결과는 지운다
  const onAccount = useCallback((u) => {
    setAccount(u);
    if (!u?.canPublish) setResult(null);
    if (!u) { setSite(null); return; }
    getSite().then((r) => {
      setSite(r.site ?? null);
      if (r.site) setSlug((s) => s || r.site.slug);
    });
  }, []);
  const doneRef = useRef(null);

  useEffect(() => {
    loadDraft().then((d) => {
      setDraft(d);
      if (d.slug) setSlug(d.slug);
    });
  }, []);

  // 주소 검사: 입력이 멈추면. "확인 중"은 마지막 검사한 주소가 지금 입력과 다른지로 판단(렌더링 중 계산)
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    const t = setTimeout(() => checkSlug(slug).then((r) => { if (alive) setChecked({ slug, r }); }), 400);
    return () => { alive = false; clearTimeout(t); };
  }, [slug]);
  const slugState = !slug ? null : checked?.slug === slug ? checked.r : { checking: true };

  useEffect(() => { if (result?.ok) doneRef.current?.focus(); }, [result]);

  if (!draft) return <p role="status">불러오는 중…</p>;

  if (!draft.tokens || !draft.template) {
    return (
      <div className="iv pb">
        <h1 className="iv-question">아직 고른 안이 없어요</h1>
        <p className="iv-hint">인터뷰에서 안을 고르고 내용을 채운 뒤 발행할 수 있어요.</p>
      </div>
    );
  }

  const errors = Object.entries(validatePortfolio(draft));
  const warnings = publishWarnings(draft);
  const canPublish = !errors.length && slugState?.ok === true && account?.canPublish === true && !busy;
  const blocker = errors.length ? "먼저 고칠 곳을 채워 주세요."
    : slugState?.ok !== true ? "사용할 수 있는 주소를 정하면 발행할 수 있어요."
    : !account ? "로그인하면 발행할 수 있어요."
    : !account.canPublish ? "나이 확인(보호자 동의)이 끝나면 발행할 수 있어요." : "";

  const doPublish = async () => {
    setBusy(true);
    const r = await publish(draft, slug);
    setBusy(false);
    setResult(r);
    if (r.ok) {
      setDraft((d) => ({ ...d, slug: slug.trim().toLowerCase(), status: "published", publishedAt: r.publishedAt }));
      setSite({ slug: slug.trim().toLowerCase(), url: r.url, publishedAt: r.publishedAt });
      setOffMsg("");
    }
  };
  const doUnpublish = async () => {
    setBusy(true);
    const r = await unpublish();
    setBusy(false);
    setConfirmOff(false);
    if (!r.ok) { setOffMsg(r.reason); return; }
    setSite(null); setResult(null);
    setDraft((d) => ({ ...d, status: "draft" }));
    setOffMsg("비공개로 바꿨어요. 다시 발행하면 공개돼요.");
  };

  /** 내려받기: 이미지를 파일 안에 넣은 사본으로 (HTML 한 파일로 어디서나 열리게) */
  const download = async (kind) => {
    const drawable = await resolveImages(draft);
    const base = fileBase(draft.slug || slug);
    if (kind === "html") {
      const { renderPortfolioHtml } = await import("../../templates/renderHtml.js");
      downloadFile(`${base}.html`, renderPortfolioHtml({ portfolio: drawable, tokens: drawable.tokens, template: drawable.template }), "text/html");
    } else {
      downloadFile(`${base}.json`, JSON.stringify({ format: "portfolio-maker/1", portfolio: drawable }, null, 2), "application/json");
    }
    setFileMsg(`${base}.${kind} 파일을 내려받았어요.`);
  };

  const address = `${slug.trim().toLowerCase() || "주소"}.${SITE_DOMAIN}`;
  const moving = site && slug.trim().toLowerCase() && site.slug !== slug.trim().toLowerCase();

  return (
    <div className="iv pb">
      <h1 className="iv-question">발행하기</h1>
      <p className="iv-hint">발행하면 정한 주소로 바로 공개돼요. 다시 발행하면 공개된 사이트가 새 내용으로 바뀌어요.</p>

      <section className="pb-sec" aria-labelledby="pb-check-h">
        <h2 id="pb-check-h">1. 확인</h2>
        {errors.length ? (
          <>
            <p className="pb-bad">발행하기 전에 고칠 곳이 {errors.length}군데 있어요.</p>
            <ul className="pb-list">
              {errors.map(([path, msg]) => (
                <li key={path}>
                  <span>{msg}</span>
                  <button type="button" className="iv-btn iv-btn-quiet" onClick={() => onEdit(fieldIdFor(path, draft))}>고치러 가기</button>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="pb-good">꼭 필요한 내용은 모두 채워졌어요.</p>}
        {warnings.length > 0 && (
          <>
            <p className="pb-warn-h">한번 더 확인해 보세요 (발행은 할 수 있어요)</p>
            <ul className="pb-list pb-warn">{warnings.map((w) => <li key={w}><span>{w}</span></li>)}</ul>
            <button type="button" className="iv-btn iv-btn-quiet" onClick={() => onEdit(null)}>편집기로 돌아가기</button>
          </>
        )}
      </section>

      <section className="pb-sec" aria-labelledby="pb-slug-h">
        <h2 id="pb-slug-h">2. 주소</h2>
        <label htmlFor="pb-slug" className="pb-label">사이트 주소</label>
        <div className="pb-slug">
          <input id="pb-slug" type="text" inputMode="url" autoCapitalize="off" autoComplete="off" spellCheck={false}
            maxLength={30} value={slug} placeholder="예: seoyun"
            aria-describedby="pb-slug-hint pb-slug-msg" aria-invalid={slugState?.ok === false ? true : undefined}
            onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/\s/g, "")); setResult(null); }} />
          <span aria-hidden="true">.{SITE_DOMAIN}</span>
        </div>
        <p id="pb-slug-hint" className="iv-meta iv-left">영문 소문자·숫자·하이픈, 3~30자.</p>
        <p id="pb-slug-msg" role="status" className={slugState?.ok === false ? "pb-bad" : "pb-good"}>
          {slugState?.checking ? "확인하는 중…" : slugState?.ok === false ? slugState.reason : slugState?.ok ? `쓸 수 있는 주소예요: ${address}` : ""}
        </p>
      </section>

      <section className="pb-sec" aria-labelledby="pb-account-h">
        <h2 id="pb-account-h">3. 계정</h2>
        <AccountStep onChange={onAccount} />
      </section>

      <section className="pb-sec" aria-labelledby="pb-go-h">
        <h2 id="pb-go-h">4. 발행</h2>
        {result?.ok ? (
          <div className="pb-done">
            <p ref={doneRef} tabIndex={-1} className="pb-done-h">발행했어요</p>
            <p>주소: <a href={result.url} target="_blank" rel="noopener noreferrer">{result.url}</a></p>
            <p className="iv-meta iv-left">내용을 고친 뒤 다시 발행하면 이 주소의 사이트가 바뀌어요.</p>
          </div>
        ) : (
          <>
            {site && (
              <p className="pb-live">
                지금 공개 중: <a href={site.url} target="_blank" rel="noopener noreferrer">{site.url}</a>
                {moving && <span className="pb-bad"> · 다른 주소로 발행하면 지금 주소({site.slug})는 내려가요.</span>}
              </p>
            )}
            {result?.ok === false && <p className="pb-bad" role="alert">{result.reason}</p>}
            <button type="button" className="iv-btn iv-btn-primary" disabled={!canPublish} onClick={doPublish}>
              {busy ? "발행하는 중…" : "발행하기"}
            </button>
            {!canPublish && !busy && <p className="iv-meta iv-left">{blocker}</p>}
          </>
        )}
        {site && account && (
          confirmOff ? (
            <div className="pb-off" role="group" aria-label="비공개로 바꾸기 확인">
              <p>{site.url} 을(를) 내릴까요? 방문자는 더 이상 볼 수 없고, 다시 발행하면 돌아와요.</p>
              <div className="pb-files">
                <button type="button" className="iv-btn iv-btn-quiet pb-danger" onClick={doUnpublish} disabled={busy}>비공개로 바꾸기</button>
                <button type="button" className="iv-btn iv-btn-quiet" onClick={() => setConfirmOff(false)}>취소</button>
              </div>
            </div>
          ) : (
            <button type="button" className="iv-btn iv-btn-quiet pb-start" onClick={() => setConfirmOff(true)}>비공개로 바꾸기…</button>
          )
        )}
        <p role="status" className="iv-meta iv-left">{offMsg}</p>
      </section>

      <section className="pb-sec" aria-labelledby="pb-file-h">
        <h2 id="pb-file-h">내 사이트 파일</h2>
        <p className="iv-meta iv-left">발행과 상관없이 언제든 받을 수 있어요. HTML 한 파일에 이미지까지 들어 있어서 어디서나 열려요.</p>
        <div className="pb-files">
          <button type="button" className="iv-btn iv-btn-quiet" onClick={() => download("html")}>HTML 파일 받기</button>
          <button type="button" className="iv-btn iv-btn-quiet" onClick={() => download("json")}>JSON 데이터 받기</button>
        </div>
        <p role="status" className="iv-meta iv-left">{fileMsg}</p>
      </section>

      <button type="button" className="iv-btn iv-btn-quiet pb-back" onClick={() => onEdit(null)}>← 편집으로 돌아가기</button>
    </div>
  );
}
