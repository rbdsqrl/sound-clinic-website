// Cloudflare Cron Trigger — fires every 5 minutes (see wrangler.jsonc "triggers.crons").
// Pings the backend's DB-keepalive endpoint so Neon's free-tier compute (5-minute idle
// suspend) and Render's own free-tier instance (idle spin-down) both stay warm.
//
// This worker exports only `scheduled`, not `fetch` — with no fetch handler, Cloudflare
// serves the site's static assets automatically, so this doesn't change how the site itself
// is served.

const HEALTH_URL = 'https://sound-clinic-api-gcxt.onrender.com/health/db';

export default {
  async scheduled(_event, _env, ctx) {
    ctx.waitUntil(pingHealth());
  },
};

async function pingHealth() {
  try {
    const res = await fetch(HEALTH_URL);
    console.log(`keepalive: GET ${HEALTH_URL} -> ${res.status}`);
  } catch (err) {
    console.error(`keepalive: GET ${HEALTH_URL} failed`, err);
  }
}
