# Player card + challenge flow — deploy checklist

1. Server: run `npm ci` in /server (new deps: satori, @resvg/resvg-js, @fontsource/*). Lockfile is already updated.
2. Server env: `CLIENT_URL` must be your exact frontend origin (already used for CORS). Optional: `API_URL` = public API origin
   (only needed if the API sits behind a proxy that hides its real host).
3. Client: open `client/vercel.json` and replace `YOUR-API-DOMAIN` with your API host (e.g. `mockmate-api.onrender.com`).
   This makes WhatsApp / LinkedIn / X / Telegram crawlers hitting `/p/<slug>` receive the preview-image HTML.
4. Redeploy both. Test: paste `https://<your-site>/p/<slug>` into WhatsApp; if a stale preview shows, use
   LinkedIn Post Inspector / Facebook Sharing Debugger to refresh the cache.
5. Render free tier sleeps: the first crawler hit after sleep may time out; share once yourself to warm it up.
