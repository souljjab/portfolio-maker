/**
 * app.도메인 Worker: /api/* 는 여기서 처리하고, 나머지는 앱 정적 파일(assets)로.
 * (wrangler.jsonc의 run_worker_first가 /api/* 만 이 코드로 보낸다)
 */
import { fail } from "./lib/http.js";
import { startLogin, verifyLogin, me, logout, setAge, guardianPage, guardianConsent, guardianWithdrawPage, guardianWithdraw } from "./auth.js";
import { uploadImage, checkSlug, mySite, publish, unpublish } from "./publish.js";
import { getDraft, putDraft, getImage, listVersions, getVersion, createVersion } from "./drafts.js";
import { aiDirections, aiEdit } from "./ai.js";
import { requestDeletion, cancelDeletion, devPurge, purgeDueAccounts } from "./account.js";

const ROUTES = {
  "POST /api/auth/start": startLogin,
  "POST /api/auth/verify": verifyLogin,
  "GET /api/auth/me": me,
  "POST /api/auth/logout": logout,
  "POST /api/account/age": setAge,
  "GET /api/guardian/consent": guardianPage,
  "POST /api/guardian/consent": guardianConsent,
  "GET /api/guardian/withdraw": guardianWithdrawPage,
  "POST /api/guardian/withdraw": guardianWithdraw,
  "POST /api/account/delete": requestDeletion,
  "POST /api/account/delete/cancel": cancelDeletion,
  "POST /api/dev/purge": devPurge,
  "POST /api/images": uploadImage,
  "GET /api/slug": checkSlug,
  "GET /api/site": mySite,
  "POST /api/publish": publish,
  "POST /api/site/unpublish": unpublish,
  "GET /api/drafts": getDraft,
  "PUT /api/drafts": putDraft,
  "GET /api/versions": listVersions,
  "POST /api/versions": createVersion,
  "POST /api/ai/directions": aiDirections,
  "POST /api/ai/edit": aiEdit,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const handler = ROUTES[`${request.method} ${url.pathname}`]
      ?? (request.method === "GET" && url.pathname.startsWith("/api/images/") ? getImage : null)
      ?? (request.method === "GET" && url.pathname.startsWith("/api/versions/") ? getVersion : null);
    if (!handler) return fail(404, "없는 주소예요.");
    try {
      return await handler(request, env);
    } catch (e) {
      console.error(e);
      return fail(500, "서버에서 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.");
    }
  },
  // 매일 한 번(wrangler.jsonc triggers): 삭제 유예 7일이 지난 계정 정리
  async scheduled(event, env, ctx) {
    ctx.waitUntil(purgeDueAccounts(env).then((n) => { if (n) console.log(`[purge] 계정 ${n}개 삭제`); }));
  },
};
