/**
 * 메일 발송. MAIL_MODE=resend면 Resend HTTP API, log면 보내지 않고 로그로만(로컬 개발).
 * 메일 본문은 텍스트가 기본이고, HTML은 이스케이프한 같은 내용.
 */
import { esc } from "./http.js";

export async function sendMail(env, { to, subject, text }) {
  if (env.MAIL_MODE === "log") {
    console.log(`[mail] to=${to}\n[mail] subject=${subject}\n${text}`);
    return { ok: true };
  }
  if (env.MAIL_MODE === "resend") {
    if (!env.RESEND_API_KEY) return { ok: false };
    const html = `<div style="font-family:sans-serif;font-size:16px;line-height:1.6;white-space:pre-line">${esc(text)}</div>`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text, html }),
    });
    if (!r.ok) console.error("[mail] resend failed", r.status, await r.text().catch(() => ""));
    return { ok: r.ok };
  }
  console.error("[mail] unknown MAIL_MODE", env.MAIL_MODE);
  return { ok: false };
}

export function loginCodeMail(to, code) {
  return {
    to,
    subject: `[포트폴리오 메이커] 로그인 코드 ${code}`,
    text: `로그인 코드: ${code}\n\n10분 안에 입력해 주세요.\n요청하지 않았다면 이 메일은 무시하셔도 돼요. 코드가 없으면 누구도 로그인할 수 없어요.`,
  };
}

export function guardianMail(to, childEmail, link) {
  return {
    to,
    subject: "[포트폴리오 메이커] 자녀의 포트폴리오 공개 동의 요청",
    text: [
      "안녕하세요. 포트폴리오 메이커입니다.",
      "",
      `${childEmail} 계정을 쓰는 만 14세 미만 사용자가 보호자님의 이메일을 알려 주셨어요.`,
      "자기 포트폴리오 사이트를 인터넷에 공개하려면 법정대리인(보호자)의 동의가 필요해요.",
      "",
      "아래 주소에서 수집하는 정보와 쓰임을 확인하고 동의 여부를 정해 주세요. (7일 동안 유효)",
      link,
      "",
      "요청하신 적이 없거나 동의하지 않으시면 이 메일은 무시하셔도 돼요. 동의 전에는 공개되지 않아요.",
    ].join("\n"),
  };
}
