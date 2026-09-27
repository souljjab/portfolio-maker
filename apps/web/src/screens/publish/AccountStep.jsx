import { useEffect, useRef, useState } from "react";
import { getAccount, requestLoginCode, verifyLoginCode, setAccountAge, logout, onAccountChange, requestAccountDeletion, cancelAccountDeletion, setAiEnabled } from "../../api/index.js";

const day = (t) => new Date(t).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

/**
 * 계정 단계 — 첫 화면(무료로 시작하기)·발행 화면·동기화 상태 줄에서 함께 쓴다.
 * 이메일 → 6자리 코드(처음이면 이대로 가입) → (처음이면) 나이 확인 → 만 14세 미만이면 보호자 동의 대기.
 * onChange(user): 계정 상태가 바뀔 때마다 알린다(user.canPublish로 발행 버튼 판단).
 * intro: 로그인 전 안내 문장. idPrefix: 한 화면에 두 번 나올 때 id가 겹치지 않게.
 */
export default function AccountStep({ onChange, intro = "발행하려면 로그인이 필요해요. 처음이면 같은 방법으로 가입돼요. 비밀번호는 없어요.", idPrefix = "pb", children }) {
  const [user, setUser] = useState(undefined);  // undefined: 확인 중, null: 로그인 안 함
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);      // 코드를 보냈는지
  const [code, setCode] = useState("");
  const [over14, setOver14] = useState(null);
  const [guardian, setGuardian] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [dev, setDev] = useState(null);         // 로컬 개발에서만 서버가 주는 코드·링크
  const [confirmOut, setConfirmOut] = useState(false); // 서버에 없는 작업이 지워진다는 확인
  const [delEmail, setDelEmail] = useState("");         // 계정 삭제 확인용으로 직접 입력한 이메일
  const codeRef = useRef(null);

  const update = (u) => { setUser(u); onChange(u); };
  useEffect(() => {
    getAccount().then((r) => {
      if (!r.ok) setError(r.reason);
      setUser(r.user ?? null);
      onChange(r.user ?? null);
    });
  }, [onChange]);
  // 다른 곳(상태 줄·발행 화면)에서 로그인·로그아웃해도 같은 상태를 보여 준다
  useEffect(() => onAccountChange((u) => setUser(u)), []);
  useEffect(() => { if (sent) codeRef.current?.focus(); }, [sent]);

  const run = async (fn) => {
    setBusy(true); setError(""); setInfo("");
    try { await fn(); } finally { setBusy(false); }
  };

  const sendCode = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await requestLoginCode(email);
      if (!r.ok) return setError(r.reason);
      setSent(true); setCode("");
      setInfo(`${email.trim()} 로 6자리 코드를 보냈어요. 메일이 안 보이면 스팸함도 확인해 주세요.`);
      setDev(r.devCode ? { code: r.devCode } : null);
    });
  };
  const verify = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await verifyLoginCode(email, code);
      if (!r.ok) return setError(r.reason);
      setDev(null); setSent(false);
      update(r.user);
    });
  };
  const submitAge = (e) => {
    e.preventDefault();
    if (over14 === null) return setError("나이를 골라 주세요.");
    run(async () => {
      const r = await setAccountAge({ over14, guardianEmail: guardian });
      if (!r.ok) return setError(r.reason);
      setDev(r.devLink ? { link: r.devLink } : null);
      update(r.user);
    });
  };
  const resendGuardian = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await setAccountAge({ over14: false, guardianEmail: guardian });
      if (!r.ok) return setError(r.reason);
      setDev(r.devLink ? { link: r.devLink } : null);
      setInfo("보호자께 동의 요청 메일을 다시 보냈어요.");
      update(r.user);
    });
  };
  const askDelete = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await requestAccountDeletion(delEmail);
      if (!r.ok) return setError(r.reason);
      setDelEmail("");
      setInfo(`계정 삭제를 예약했어요. ${day(r.deletionScheduledAt)}에 모두 지워지고, 그 전엔 취소할 수 있어요.`);
    });
  };
  const undoDelete = () => run(async () => {
    const r = await cancelAccountDeletion();
    if (!r.ok) return setError(r.reason);
    setInfo("계정 삭제를 취소했어요.");
  });
  const deletion = user?.deletionScheduledAt ? (
    <div className="pb-warn" role="alert">
      <p>이 계정은 <strong>{day(user.deletionScheduledAt)}</strong>에 삭제돼요. 사이트는 이미 내려갔어요.</p>
      <button type="button" className="iv-btn iv-btn-quiet pb-start" onClick={undoDelete} disabled={busy}>삭제 취소</button>
    </div>
  ) : (
    <details className="pb-delacct">
      <summary>계정 삭제</summary>
      <p className="iv-meta iv-left">사이트를 바로 내리고, 7일 뒤 초안·버전 기록·올린 이미지·계정을 모두 지워요. 7일 안에 다시 로그인하면 취소할 수 있어요. 지우기 전에 발행 화면에서 HTML·JSON으로 내려받아 둘 수 있어요.</p>
      <form className="pb-form" onSubmit={askDelete} noValidate>
        <label htmlFor={`${idPrefix}-del`} className="pb-label">확인을 위해 이메일 주소({user?.email})를 입력해 주세요</label>
        <div className="pb-inline">
          <input id={`${idPrefix}-del`} type="email" autoComplete="off" value={delEmail} onChange={(e) => setDelEmail(e.target.value)} />
          <button type="submit" className="iv-btn iv-btn-quiet pb-del" disabled={busy || !delEmail.trim()}>계정 삭제 예약</button>
        </div>
      </form>
    </details>
  );

  const toggleAi = (enabled) => run(async () => {
    const r = await setAiEnabled(enabled);
    if (!r.ok) return setError(r.reason);
    setInfo(enabled ? "AI 추천·다듬기를 켰어요." : "AI 추천·다듬기를 껐어요. 디자인 추천은 AI 없이 만들어요.");
  });
  const aiSetting = user && (
    <div className="pb-ai">
      <label className="pb-ai-toggle">
        <input type="checkbox" checked={user.aiEnabled !== false} disabled={busy} onChange={(e) => toggleAi(e.target.checked)}
          aria-describedby={`${idPrefix}-ai-desc`} />
        AI 추천·다듬기 쓰기
      </label>
      <p id={`${idPrefix}-ai-desc`} className="iv-meta iv-left">
        켜 두면 디자인 방향 추천과 “Claude에게 부탁하기”에 AI(Anthropic, 미국)를 써요. 내가 쓴 글 일부를 연락처를 가린 채 보내고, 링크·이미지는 보내지 않아요.
        끄면 AI 없이 추천해요. <a href="/privacy.html#p5" target="_blank" rel="noopener">자세히</a>
      </p>
    </div>
  );

  const refresh = () => run(async () => {
    const r = await getAccount();
    if (!r.ok) return setError(r.reason);
    update(r.user);
    if (r.user && !r.user.canPublish) setInfo("아직 보호자 동의 전이에요.");
  });
  const signOut = (force = false) => run(async () => {
    const r = await logout({ force });
    if (r.unsynced) return setConfirmOut(true);
    setConfirmOut(false);
    if (!r.ok) return setError(r.reason);
    setEmail(""); update(null);
  });
  const signOutButton = confirmOut ? (
    <div className="pb-warn" role="alert">
      <p>이 기기에만 있고 서버에 저장되지 않은 작업이 있어요. 로그아웃하면 이 기기에서 지워지고 되돌릴 수 없어요.</p>
      <div className="pb-files">
        <button type="button" className="iv-btn iv-btn-quiet" onClick={() => setConfirmOut(false)} disabled={busy}>취소</button>
        <button type="button" className="iv-btn iv-btn-quiet" onClick={() => signOut(true)} disabled={busy}>지우고 로그아웃</button>
      </div>
    </div>
  ) : (
    <button type="button" className="iv-btn iv-btn-quiet pb-start" onClick={() => signOut()} disabled={busy}>로그아웃</button>
  );

  if (user === undefined) return <p role="status">계정을 확인하는 중…</p>;

  const messages = (
    <>
      <p role="alert" className="pb-bad">{error}</p>
      <p role="status" className="iv-meta iv-left">{info}</p>
    </>
  );

  // 로그인 전
  if (!user) {
    return (
      <div className="pb-account">
        <p>{intro}</p>
        {!sent ? (
          <form className="pb-form" onSubmit={sendCode} noValidate>
            <label htmlFor={`${idPrefix}-email`} className="pb-label">이메일</label>
            <div className="pb-inline">
              <input id={`${idPrefix}-email`} type="email" inputMode="email" autoComplete="email" required maxLength={254}
                value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="submit" className="iv-btn iv-btn-primary" disabled={busy || !email.trim()}>{busy ? "보내는 중…" : "코드 받기"}</button>
            </div>
          </form>
        ) : (
          <form className="pb-form" onSubmit={verify} noValidate>
            <label htmlFor={`${idPrefix}-code`} className="pb-label">메일로 받은 6자리 코드</label>
            <div className="pb-inline">
              <input id={`${idPrefix}-code`} ref={codeRef} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                pattern="\d{6}" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                aria-describedby={`${idPrefix}-code-hint`} />
              <button type="submit" className="iv-btn iv-btn-primary" disabled={busy || code.length !== 6}>{busy ? "확인하는 중…" : "로그인"}</button>
            </div>
            <p id={`${idPrefix}-code-hint`} className="iv-meta iv-left">코드는 10분 동안 쓸 수 있어요.</p>
            <div className="pb-files">
              <button type="button" className="iv-btn iv-btn-quiet" onClick={sendCode} disabled={busy}>코드 다시 받기</button>
              <button type="button" className="iv-btn iv-btn-quiet" onClick={() => { setSent(false); setInfo(""); setError(""); setDev(null); }}>이메일 바꾸기</button>
            </div>
            {dev?.code && <p className="pb-dev">개발 모드: 코드 {dev.code}</p>}
          </form>
        )}
        {messages}
      </div>
    );
  }

  // 로그인했지만 나이를 아직 안 밝힘
  if (user.ageStatus === "unknown") {
    return (
      <form className="pb-account pb-form" onSubmit={submitAge} noValidate>
        <p>{user.email} 로 로그인했어요.</p>
        <fieldset className="iv-field">
          <legend>나이를 알려 주세요</legend>
          <div className="iv-chips">
            {[[true, "만 14세 이상이에요"], [false, "만 14세 미만이에요"]].map(([v, label]) => (
              <label key={label} className="iv-chip">
                <input type="radio" name={`${idPrefix}-age`} checked={over14 === v} onChange={() => { setOver14(v); setError(""); }} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {over14 === false && (
          <div className="pb-form">
            <label htmlFor={`${idPrefix}-guardian`} className="pb-label">보호자 이메일</label>
            <input id={`${idPrefix}-guardian`} type="email" inputMode="email" maxLength={254} value={guardian}
              onChange={(e) => setGuardian(e.target.value)} aria-describedby={`${idPrefix}-guardian-hint`} />
            <p id={`${idPrefix}-guardian-hint`} className="iv-meta iv-left">만 14세 미만은 사이트를 공개하려면 보호자(법정대리인)의 동의가 필요해요. 보호자께 동의 요청 메일을 보내 드려요.</p>
          </div>
        )}
        <button type="submit" className="iv-btn iv-btn-primary pb-start" disabled={busy}>{over14 === false ? "보호자께 요청 보내기" : "확인"}</button>
        {messages}
      </form>
    );
  }

  // 보호자 동의 대기
  if (!user.canPublish) {
    return (
      <div className="pb-account">
        {user.guardianWithdrawn ? (
          <p>보호자께서 동의를 철회하셔서 사이트를 내리고 서버에 저장된 작업을 지웠어요. 이 기기의 작업은 그대로 있어요. 다시 공개하려면 보호자께 동의를 다시 요청해 주세요.</p>
        ) : (
          <p>보호자({user.guardianEmail})께 동의 요청 메일을 보냈어요. 보호자가 동의하시면 발행할 수 있어요.</p>
        )}
        <div className="pb-files">
          <button type="button" className="iv-btn iv-btn-quiet" onClick={refresh} disabled={busy}>동의했는지 다시 확인</button>
        </div>
        <form className="pb-form" onSubmit={resendGuardian} noValidate>
          <label htmlFor={`${idPrefix}-guardian2`} className="pb-label">{user.guardianWithdrawn ? "보호자께 다시 요청하기" : "요청 메일 다시 보내기"}</label>
          <div className="pb-inline">
            <input id={`${idPrefix}-guardian2`} type="email" inputMode="email" maxLength={254} placeholder="보호자 이메일" value={guardian} onChange={(e) => setGuardian(e.target.value)} />
            <button type="submit" className="iv-btn iv-btn-quiet" disabled={busy || !guardian.trim()}>보내기</button>
          </div>
        </form>
        {signOutButton}
        {children}
        {dev?.link && <p className="pb-dev">개발 모드: <a href={dev.link} target="_blank" rel="noreferrer">보호자 동의 페이지 열기</a></p>}
        {deletion}
        {messages}
      </div>
    );
  }

  return (
    <div className="pb-account">
      <p className="pb-good">{user.email} 로 로그인했어요.</p>
      {aiSetting}
      {signOutButton}
      {deletion}
      {messages}
    </div>
  );
}
