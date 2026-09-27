import { useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile(자동 가입·코드 요청 남용 방지). 사이트 키(VITE_TURNSTILE_SITE_KEY)가 있을 때만 나온다.
 * 서버(POST /api/auth/start)가 TURNSTILE_SECRET으로 토큰을 다시 확인한다. 토큰은 한 번만 쓸 수 있어서
 * 요청할 때마다 resetKey를 바꿔 새로 확인받는다.
 * 로컬 개발은 Cloudflare 테스트 키(1x00000000000000000000AA — 항상 통과)를 쓴다.
 */
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

let loading = null;
function loadScript() {
  loading ??= new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = ok;
    s.onerror = () => { loading = null; fail(new Error("turnstile")); };
    document.head.append(s);
  });
  return loading;
}

/** @param {{ onToken: (token: string|null) => void, resetKey: number }} props */
export default function Turnstile({ onToken, resetKey }) {
  const box = useRef(null);
  const cb = useRef(onToken);
  const [failed, setFailed] = useState(false);
  useEffect(() => { cb.current = onToken; });

  useEffect(() => {
    if (!SITE_KEY) return undefined;
    let id, alive = true;
    cb.current(null);
    loadScript().then(() => {
      if (!alive || !box.current) return;
      id = window.turnstile.render(box.current, {
        sitekey: SITE_KEY,
        action: "login",
        language: "ko",
        theme: "light",
        size: "flexible",
        callback: (t) => cb.current(t),
        "expired-callback": () => cb.current(null),
        "error-callback": () => { cb.current(null); },
      });
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; if (id !== undefined) window.turnstile?.remove(id); };
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return (
    <div className="ts">
      <p className="iv-meta iv-left ts-cap">자동 가입을 막기 위한 확인이에요.</p>
      <div ref={box} className="ts-box" />
      {failed && <p role="alert" className="pb-bad">보안 확인을 불러오지 못했어요. 광고 차단 기능을 잠시 끄거나 새로고침해 주세요.</p>}
    </div>
  );
}
