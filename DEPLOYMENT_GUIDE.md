# Club Manager — Deployment Guide
## Backend on Render · Frontend on Netlify

---

## Prerequisites

Before you start, make sure your code is pushed to a **GitHub repository**.
Both Render and Netlify pull directly from GitHub, so every deployment is
triggered by a `git push`.

---

## Part 1 — Backend on Render

### 1.1 Create a new Web Service

1. Go to **[render.com](https://render.com)** → **New** → **Web Service**
2. Connect your GitHub repository
3. Give the service a name (e.g. `club-manager-api`)
4. Pick the **free** plan (or paid if you need always-on)

### 1.2 Build & Start commands

Set these in the Render dashboard under **Build & Deploy**:

| Field | Value |
|---|---|
| **Build Command** | `npx --yes pnpm@10 install --frozen-lockfile && npx pnpm@10 --filter @workspace/api-server run build` |
| **Start Command** | `node --enable-source-maps artifacts/api-server/dist/index.mjs` |
| **Root Directory** | *(leave blank — repo root)* |

> ⚠️ Do **not** change the Root Directory. The build command uses `--filter` to
> target only the API server package, so it runs from the repo root.

### 1.3 Environment Variables

In Render → your service → **Environment**, add these key/value pairs:

| Variable | Value |
|---|---|
| `SESSION_SECRET` | *(same value as in Replit — a long random string)* |
| `SUPABASE_URL` | *(your Supabase project URL)* |
| `SUPABASE_ANON_KEY` | *(your Supabase anon key)* |
| `SUPABASE_DB_URL` | *(your Supabase Postgres connection string)* |
| `GOOGLE_CLIENT_EMAIL` | *(service account email for Google Sheets)* |
| `GOOGLE_PRIVATE_KEY` | *(service account private key — include the full `-----BEGIN...END-----` block)* |

> `PORT` is set automatically by Render — do **not** add it manually.

> **Google Private Key tip:** In Render's env editor, paste the key exactly as-is
> (with literal `\n` characters or real newlines — whichever your key uses).
> The app already calls `.replace(/\\n/g, "\n")` so both formats work.

### 1.4 Deploy

Click **Create Web Service**. Render will install dependencies, build, and start
the server. The first deploy takes 3–5 minutes.

Once deployed, note your service URL — it looks like:
```
https://club-manager-api.onrender.com
```
You will need it in the next section.

### 1.5 Verify the backend is running

Visit `https://your-render-url.onrender.com/api/healthz` in your browser.
You should get a JSON response like `{"status":"ok"}`.

---

## Part 2 — Frontend on Netlify

### 2.1 Update `netlify.toml` with your Render URL

The file `netlify.toml` is already in the repo root. Open it and replace the
placeholder with your actual Render URL:

```toml
[[redirects]]
  from   = "/api/*"
  to     = "https://club-manager-api.onrender.com/api/:splat"   # ← YOUR URL
  status = 200
  force  = true
```

Commit and push this change before deploying to Netlify.

### 2.2 Create a new Netlify site

1. Go to **[app.netlify.com](https://app.netlify.com)** → **Add new site** →
   **Import an existing project**
2. Connect your GitHub repository
3. Netlify will detect `netlify.toml` automatically — **all build settings are
   already configured in that file**, so you don't need to fill anything in the
   UI.

The settings it reads:

| Field | Value (from netlify.toml) |
|---|---|
| **Build command** | `npx --yes pnpm@10 install --frozen-lockfile && npx pnpm@10 run typecheck:libs && BASE_PATH=/ npx pnpm@10 --filter @workspace/club-manager run build` |
| **Publish directory** | `artifacts/club-manager/dist/public` |

### 2.3 Environment Variables (Netlify)

The frontend itself does **not** need any secret env vars. `BASE_PATH=/` is
already baked into the build command in `netlify.toml`.

> If you ever see a "BASE_PATH is required" error during a Netlify build,
> double-check that `BASE_PATH=/` appears in the build command in `netlify.toml`.

### 2.4 Deploy

Click **Deploy site**. The first build takes 2–4 minutes.

Your site will be live at something like:
```
https://amazing-name-123.netlify.app
```

You can set a custom domain in Netlify → **Domain settings**.

### 2.5 Verify the frontend → backend connection

1. Open your Netlify URL
2. Try to log in
3. Open browser DevTools → Network tab and confirm that `/api/auth/login` returns
   a 200 with a token (not a 404 or CORS error)

If you see a CORS error, double-check that the `/api/*` redirect in `netlify.toml`
has the correct Render URL and that you committed + pushed the file.

---

## Part 3 — Ongoing Workflow

### Updating the backend
```bash
git push origin main
```
Render auto-deploys on every push to `main` (if auto-deploy is on).
Or trigger a manual deploy from the Render dashboard.

### Updating the frontend
```bash
git push origin main
```
Netlify auto-deploys on every push to `main`.

---

## Known Limitations on Render

### Free plan — service sleeps
On Render's free tier, the service **sleeps after 15 minutes of inactivity**.
The first request after a sleep takes ~30 seconds to wake up.
**Solution:** Upgrade to the Render Starter plan ($7/month) for always-on, or use
[UptimeRobot](https://uptimerobot.com) (free) to ping `/api/healthz` every
10 minutes to keep it awake.

### WhatsApp (Baileys) state
The WhatsApp auth session is stored in the `whatsapp_auth/` directory on disk.
On Render, **this directory is wiped on every redeploy**. This means:
- After each deploy, the QR code must be scanned again to re-authenticate WhatsApp
- **Solution:** Attach a Render **Persistent Disk** to the service and set the
  `WHATSAPP_AUTH_PATH` env var (if the app supports it), or add a Render disk
  mounted at the path where `whatsapp_auth/` is written.
- As a workaround, you can log the QR code from Render's log viewer and scan it.

### Object Storage presigned URLs
The `/api/storage/uploads/request-url` endpoint uses Replit Object Storage
(Replit-specific). It will **not work on Render**. However, the main gallery
upload endpoint (`/api/storage/uploads`) uses Supabase Storage directly and
**works fine on Render**.

---

## Environment Variables Summary

### Render (backend)

| Variable | Required | Description |
|---|---|---|
| `PORT` | Auto (set by Render) | Do not add manually |
| `SESSION_SECRET` | ✅ | JWT signing secret |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_DB_URL` | ✅ | Postgres connection string |
| `GOOGLE_CLIENT_EMAIL` | ✅ | Google Sheets service account |
| `GOOGLE_PRIVATE_KEY` | ✅ | Google Sheets private key |

### Netlify (frontend)

No secrets needed — all config is in `netlify.toml`.
