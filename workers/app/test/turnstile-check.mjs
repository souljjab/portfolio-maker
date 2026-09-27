// Turnstile 서버 확인 검증 — 별도 wrangler dev(:8796)를 Cloudflare 테스트 비밀 키로 띄워 실제 siteverify까지 확인한다.
// (인터넷 연결 필요) workers/app에서 npm run test:turnstile. API(:8787)와 같은 로컬 DB를 쓴다.
import { spawn, spawnSync } from "node:child_process";

const PORT = 8796, API = `http://127.0.0.1:${PORT}`, ORIGIN = "http://localhost:5173";
const DUMMY = "XXXX.DUMMY.TOKEN.XXXX"; // 테스트 사이트 키가 만드는 토큰
let problems = 0;
const check = (label, cond, extra = "") => { if (!cond) problems++; console.log(`${cond ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`); };

async function withServer(secret, fn) {
  const cmd = `npx wrangler dev --port ${PORT} --inspector-port 9249 --persist-to ../../.wrangler/state --var TURNSTILE_SECRET:${secret}`;
  const w = spawn(cmd, { cwd: new URL("..", import.meta.url), shell: true, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  w.stdout.on("data", (d) => { log += d; });
  w.stderr.on("data", (d) => { log += d; });
  try {
    for (let i = 0; ; i++) {
      if (i > 60) throw new Error(`wrangler dev가 뜨지 않음\n${log.slice(-1500)}`);
      try { if ((await fetch(`${API}/api/auth/me`)).ok) break; } catch { /* 아직 */ }
      await new Promise((ok) => setTimeout(ok, 1000));
    }
    await fn();
  } finally {
    process.platform === "win32" ? spawnSync("taskkill", ["/pid", String(w.pid), "/T", "/F"]) : w.kill();
  }
}
const start = (body) => fetch(`${API}/api/auth/start`, { method: "POST", headers: { Origin: ORIGIN, "content-type": "application/json" }, body: JSON.stringify(body) })
  .then(async (r) => ({ status: r.status, data: await r.json() }));
const stamp = Date.now().toString(36);

console.log("— 항상 통과하는 테스트 비밀 키");
await withServer("1x0000000000000000000000000000000AA", async () => {
  const none = await start({ email: `ts-a-${stamp}@example.com` });
  check("토큰 없이 코드 요청하면 거부", none.status === 400 && none.data.reason.includes("자동 가입 방지"), none.data.reason);
  const ok = await start({ email: `ts-b-${stamp}@example.com`, turnstileToken: DUMMY });
  check("확인 토큰이 있으면 코드 발송", ok.status === 200 && ok.data.ok, JSON.stringify(ok.data));
});
console.log("— 항상 실패하는 테스트 비밀 키");
await withServer("2x0000000000000000000000000000000AA", async () => {
  const bad = await start({ email: `ts-c-${stamp}@example.com`, turnstileToken: DUMMY });
  check("Cloudflare가 거부한 토큰이면 코드를 보내지 않음", bad.status === 400, String(bad.status));
});

console.log(problems ? `\n문제 ${problems}건` : "\n모두 통과");
process.exitCode = problems ? 1 : 0;
