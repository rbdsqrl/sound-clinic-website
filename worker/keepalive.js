// Adds a Cloudflare Cron Trigger (every 5 minutes, see wrangler.jsonc "triggers.crons") on top
// of the plain static site. `fetch` just forwards every normal page request straight to the
// assets binding — the site is served exactly as it was with no `main` script at all.
// `scheduled` pings the backend's DB-keepalive endpoint so Neon's free-tier compute (5-minute
// idle suspend) and Render's own free-tier instance (idle spin-down) both stay warm.

const HEALTH_URL = 'https://sound-clinic-api-gcxt.onrender.com/health/db';

export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },

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
