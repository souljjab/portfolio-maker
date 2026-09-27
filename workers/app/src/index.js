/**
 * app.도메인 Worker: /api/* 는 여기서 처리하고, 나머지는 앱 정적 파일(assets)로.
 * (wrangler.jsonc의 run_worker_first가 /api/* 만 이 코드로 보낸다)
 */
import { fail } from "./lib/http.js";
import { startLogin, verifyLogin, me, logout, setAge, guardianPage, guardianConsent } from "./auth.js";
import { uploadImage, checkSlug, mySite, publish, unpublish } from "./publish.js";
import { getDraft, putDraft, getImage, listVersions, getVersion, createVersion } from "./drafts.js";
import { aiDirections, aiEdit } from "./ai.js";

const ROUTES = {
  "POST /api/auth/start": startLogin,
  "POST /api/auth/verify": verifyLogin,
  "GET /api/auth/me": me,
  "POST /api/auth/logout": logout,
  "POST /api/account/age": setAge,
  "GET /api/guardian/consent": guardianPage,
  "POST /api/guardian/consent": guardianConsent,
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
};
