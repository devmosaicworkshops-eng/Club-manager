# Club Manager

A full-stack club management platform built for sports and activity clubs. Handles everything from member enrollment and payment tracking to coach scheduling, attendance, gallery, and WhatsApp notifications — all in one place.

> **Live deployment:** Backend on [Render](https://render.com) · Frontend on [Netlify](https://netlify.com)

---

## Features

### 👤 Three-role access system
- **Admin** — full control over the platform
- **Coach** — manages their own sessions and attendance
- **User (Member)** — views their schedule, payments, and club content

### 🏫 Admin Panel
| Module | What it does |
|---|---|
| **Dashboard** | Overview of club activity at a glance |
| **Members** | Add, edit, and manage club members with categories |
| **Enrollments & Trimesters** | Manage trimester enrollment periods; track who's active, suspended, or unenrolled |
| **Payments** | Log and track member payment statuses |
| **Attendance** | View and manage presence records across all sessions |
| **Sessions (Séances)** | Schedule and approve coach-submitted sessions |
| **Calendar** | Visual calendar of all scheduled sessions |
| **Coaches** | Manage coach accounts and profiles |
| **Admins** | Manage admin accounts |
| **Leads Pipeline** | Import leads from Google Sheets; move them through an approval pipeline |
| **Manual Leads** | Add and manage leads manually |
| **Events** | Publish events visible to all members |
| **Gallery** | Upload and manage club photos (stored in Supabase Storage) |
| **History** | Audit log of changes across the platform |
| **WhatsApp** | Send WhatsApp messages to members via Baileys integration |
| **Settings** | Configure current trimester, academic year, and club-wide settings |

### 🏋️ Coach Panel
- View and submit sessions for admin approval
- Record attendance for their sessions

### 🎽 Member Panel
- View upcoming sessions and personal attendance record
- Check payment status and enrollment info
- Browse events and gallery

---

## Tech Stack

### Backend (`artifacts/api-server`)
- **Runtime:** Node.js 24 + TypeScript
- **Framework:** Express 5
- **Database:** PostgreSQL via [Supabase](https://supabase.com)
- **Auth:** JWT (jsonwebtoken) + bcrypt password hashing
- **File storage:** Supabase Storage (gallery uploads)
- **Google Sheets:** googleapis — leads sync from a live spreadsheet
- **WhatsApp:** [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) — real WhatsApp Web connection
- **Logging:** pino + pino-http
- **Build:** esbuild (single ESM bundle)

### Frontend (`artifacts/club-manager`)
- **Framework:** React 19 + Vite 7
- **Styling:** Tailwind CSS 4
- **UI components:** Radix UI primitives + shadcn/ui
- **Data fetching:** TanStack React Query
- **Routing:** Wouter
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts
- **Animations:** Framer Motion

### Monorepo
- **Package manager:** pnpm workspaces
- **Language:** TypeScript 5.9 across all packages
- **Shared libs:** `lib/api-client-react` (generated hooks), `lib/api-zod` (Zod schemas), `lib/api-spec` (OpenAPI spec + Orval codegen)

---

## Project Structure

```
.
├── artifacts/
│   ├── api-server/          # Express backend
│   │   └── src/
│   │       ├── routes/      # One file per domain (users, enrollments, payments…)
│   │       └── lib/         # Supabase client, auth, WhatsApp, Google Sheets, storage
│   └── club-manager/        # React frontend
│       └── src/
│           ├── pages/       # dashboard/admin · dashboard/coach · dashboard/utilisateur
│           ├── components/  # Shared UI components
│           └── lib/         # Auth context, utilities
├── lib/
│   ├── api-spec/            # OpenAPI spec (source of truth for the API contract)
│   ├── api-zod/             # Generated Zod validation schemas
│   └── api-client-react/    # Generated React Query hooks + custom fetch client
└── netlify.toml             # Netlify build config + /api/* proxy to Render
```

---

## Getting Started (Local Dev)

### Prerequisites
- Node.js 20+
- pnpm 10

### 1. Clone & install
```bash
git clone https://github.com/your-username/club-manager.git
cd club-manager
pnpm install
```

### 2. Set environment variables

Create a `.env` file (or set these in your shell) for the API server:

```env
PORT=8080
SESSION_SECRET=your-long-random-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_DB_URL=postgresql://...
GOOGLE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
```

### 3. Run

```bash
# Backend (port 8080)
pnpm --filter @workspace/api-server run dev

# Frontend (in a second terminal)
BASE_PATH=/ pnpm --filter @workspace/club-manager run dev
```

The frontend proxies `/api/*` to the backend in dev mode.

---

## Deployment

See [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) for the full step-by-step guide.

**Short version:**

| | Service | Config |
|---|---|---|
| **Backend** | [Render](https://render.com) | Web Service — Node, auto-deploys from `main` |
| **Frontend** | [Netlify](https://netlify.com) | Static site — reads `netlify.toml`, auto-deploys from `main` |

The `netlify.toml` already included in the repo proxies all `/api/*` requests to your Render backend, so there are no CORS issues.

### Render — Build & Start commands
```bash
# Build
npx --yes pnpm@10 install --frozen-lockfile && npx pnpm@10 --filter @workspace/api-server run build

# Start
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

### Netlify — Build command (already in `netlify.toml`)
```bash
npx --yes pnpm@10 install --frozen-lockfile && npx pnpm@10 run typecheck:libs && BASE_PATH=/ npx pnpm@10 --filter @workspace/club-manager run build
```

---

## Environment Variables Reference

### Backend (Render)
| Variable | Required | Description |
|---|---|---|
| `PORT` | Auto | Set automatically by Render |
| `SESSION_SECRET` | ✅ | Secret used to sign JWT tokens |
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_DB_URL` | ✅ | Postgres connection string |
| `GOOGLE_CLIENT_EMAIL` | ✅ | Google service account email (Sheets access) |
| `GOOGLE_PRIVATE_KEY` | ✅ | Google service account private key |

### Frontend (Netlify)
No secrets required — all config lives in `netlify.toml`.

---

## API Overview

All routes are prefixed with `/api`. Authentication uses `Authorization: Bearer <token>`.

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login — returns JWT |
| GET | `/api/auth/me` | Any | Get current user from token |
| GET/POST/PATCH/DELETE | `/api/users` | Admin | Member management |
| GET/POST/PATCH/DELETE | `/api/enrollments` | Admin | Trimester enrollments |
| GET/POST/PATCH/DELETE | `/api/seances` | Coach/Admin | Session scheduling |
| GET/POST | `/api/presences` | Coach/Admin | Attendance records |
| GET/POST/PATCH | `/api/payments` | Admin | Payment tracking |
| GET/POST/DELETE | `/api/events` | Admin | Club events |
| GET/POST/DELETE | `/api/gallery` | Admin | Photo gallery |
| GET/POST | `/api/leads` | Admin | Leads from Google Sheets |
| GET/POST | `/api/pipeline` | Admin | Manual leads pipeline |
| GET/POST | `/api/coaches` | Admin | Coach accounts |
| GET/POST | `/api/admins` | Admin | Admin accounts |
| GET/PATCH | `/api/settings` | Admin | Club-wide settings |
| POST | `/api/storage/uploads` | Admin | Upload images to Supabase Storage |
| GET/POST | `/api/whatsapp` | Admin | WhatsApp messaging status + send |
| GET | `/api/healthz` | Public | Health check |

---

## License

MIT
