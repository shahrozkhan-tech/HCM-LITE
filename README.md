# HCM Lite — AI-assisted Human Capital Management

Built for the **Saylani Hackathon 2026** · 9 modules · 25 functionalities · AI built in.

A web-based HR system for **Admin**, **HR** and **Employees** with real data only — the system
starts empty, Admin sets up the company, HR registers employees, and every number on the
dashboards (and every AI answer) comes from what people actually do in the app.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) — full-stack, **JavaScript** |
| State & fetching | Redux Toolkit + RTK Query |
| UI | Tailwind CSS, Shadcn-style components (Radix), Recharts, Sonner, dark mode |
| Backend & DB | Supabase — Auth (JWT), PostgreSQL, Row Level Security |
| PDF | pdf-lib (server-side payslips) |
| AI | Any OpenAI-compatible LLM API with tool calling (OpenAI / Groq / OpenRouter…) |
| Bonus | Camera check-in: `@vladmandic/face-api` face detection + GPS geofence (Haversine server-side) |

## Quick start (judge-friendly, ~10 minutes)

1. **Create a Supabase project** (free) at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run **all three** migration files in order:
   - `supabase/migrations/0001_init.sql` (all tables, RLS policies, helper functions — the system starts **empty**)
   - `supabase/migrations/0002_bonus.sql` (late-penalty payslip columns)
   - `supabase/migrations/0003_email.sql` (designed-email outbox)
3. Install & configure:
   ```bash
   npm install
   cp .env.example .env.local
   ```
   Fill in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...anon key...
   SUPABASE_SERVICE_ROLE_KEY=...service role key...   (Project Settings → API)
   AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
   AI_API_KEY=...                                     # Google AI Studio key; server-side only
   AI_MODEL=gemini-3.5-flash-lite                     # ~1.5 s answers; gemini-3.8-flash took ~45 s/call
   AI_TIMEOUT_MS=30000                                # optional per-call timeout (default 15000)
   ```
   > Tip: run `node scripts/test-ai-provider.mjs` any time to check the key, list usable
   > models and measure real latency — it pinpoints timeouts vs wrong-model vs bad-key.
   ```
   Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
   Free-tier availability and rate limits depend on Google's current plan and region.
4. `npm run dev` → open http://localhost:3000 — you land on the **professional landing page**.
5. Click **Get started** → the auth page. **Sign up** (fresh install) creates the company and
   the first Admin in one step — you're signed straight into the dashboard. Afterwards the
   sign-up tab disappears and it's **Sign in only**. (`ADMIN_EMAIL` / `ADMIN_PASSWORD` env
   values are still honored by the API if you prefer scripting the first account.)
6. Sign in as Admin → create an **HR login** (Users page) → HR registers **employees**
   (a login with a temporary password is created — employee must change it on first
   sign-in) → employees check in / apply leave → HR approves / runs payroll →
   **Admin finalizes** → employee downloads the payslip PDF.

### Demo script (matches the 5-minute story)

1. Fresh install → Admin sets up company (office 09:00, grace 15, office lat/lng for camera check-in).
2. Admin creates departments (e.g. *Engineering*) + an HR login.
3. HR registers 2–3 employees → one signs in, changes temp password, checks in.
4. Employee types *"I need next Monday and Tuesday off for my sister's wedding"* → AI pre-fills
   the leave form → confirm → HR approves with a comment.
5. HR dashboard → **Summarize** (AI insights) → asks the assistant *"who is on leave today?"*.
6. HR builds the payroll draft → **Admin finalizes** (month locks).
7. Employee downloads payslip PDF; asks AI for *a colleague's salary* → politely refused.
8. Admin opens the **Audit log** — every action above is there with before/after JSON.

## Deploying to Vercel

The repo deploys as-is, but **environment variables must be added in Vercel before the first
build** (secrets never travel via git — that's by design):

1. Vercel → your project → **Settings → Environment Variables** → add (copy values from your
   local `.env.local`):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://…​.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_…` |
   | `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_…` (server-only) |
   | `AI_BASE_URL` | e.g. `https://generativelanguage.googleapis.com/v1beta/openai/` |
   | `AI_API_KEY` | your LLM key (server-only) |
   | `AI_MODEL` | e.g. `gemini-3.5-flash-lite` |
   | `AI_TIMEOUT_MS` *(optional)* | `30000` |
   | `RESEND_API_KEY` / `EMAIL_FROM` *(optional)* | for real email delivery |

2. **Deployments → latest → Redeploy** (NEXT_PUBLIC_* values are baked in at build time, so a
   redeploy is required after adding them).
3. If you forget the variables, the login page shows a friendly **"Deployment not configured"**
   banner listing exactly what's missing — no white crash screens.

## Roles & permissions (enforced on the server, not just hidden buttons)

- **Admin** — company setup & rules, departments/designations/holidays, create HR logins,
  reset/deactivate accounts, view everything, **finalize payroll** (only Admin locks the month),
  company dashboard, audit log, announcements, full-scope AI.
- **HR** — register employees (+ CSV import/export with dry-run error report), salary structures,
  daily attendance board, **approve attendance corrections**, **approve/reject leave with comment**,
  build & review payroll drafts, HR dashboard + AI summaries, announcements.
- **Employee** — web check-in/out (+ optional camera check-in), own attendance calendar,
  correction requests, apply/cancel leave + balances + smart leave, own payslips (PDF),
  own profile (phone/address only), personal dashboard, AI on own data + policy Q&A.

RLS is enabled on every table (own-row policies for employees, staff policies for admin/HR);
API routes re-check role & data scope in services with the service-role client after verifying
the Supabase JWT. Route guard middleware restricts `/admin/*`, `/hr/*`, `/employee/*`.

## Business rules (implemented in `src/lib`)

- **Attendance** (`lib/attendance.js`) — server stamps all times; one record per employee/day
  (2nd check-in → 409); late after `office_start + grace` (09:15 default); half-day under 5 h;
  `missing_checkout` when open check-in on a past day; `absent` auto-materialized for past
  working days without a record or approved leave; camera check-in requires **exactly one face**,
  GPS accuracy ≤ 100 m and Haversine distance ≤ office radius.
- **Leave** (`lib/leave.js`) — working days only (weekends + holidays skipped); quotas
  annual 14 / sick 8 / casual 10 / unpaid ∞; overlap or over-balance → 422; HR decides with comment.
- **Payroll** (`lib/payroll.js`) — gross = 1.5 × basic (HRA 40 % + medical 10 % of basic);
  per-day = gross ÷ working days; deduction days = absent + unpaid + 0.5 × half-days
  **+ 0.5 × floor(lates ÷ 3)** (late penalty bonus rule); joiners/leavers prorated; tax slab
  on gross × 12 (0 ≤600k; 5 % ≤1.2M; 30k+15 % ≤2.4M; 210k+25 % ≤3.6M; 510k+35 % above),
  monthly = ÷12; finalized runs locked (409).
- **Dashboards** (`lib/dashboard.js`) — all KPIs/trends computed server-side; HR dashboard
  filterable by department.

## AI assistant (M8)

- Chat drawer in the top bar for every role → `POST /api/ai/chat`.
- The model picks a **tool** (`get_headcount`, `get_attendance_summary`, `get_late_comers`,
  `get_leave_summary`, `get_my_leave_balance`, `get_payroll_summary`, `search_employees`);
  the backend executes each tool with the caller's own scope (same services + permission
  checks as REST) and the model writes the answer from those numbers only.
- **Dashboard summary** — Admin/HR "Summarize" button sends the live KPI JSON; model returns
  3–5 bullets from only those numbers.
- **Smart leave** — plain text → `{type, start, end, reason}` pre-fills the form; the user
  confirms; nothing is saved by the AI.
- **Policy Q&A** — the Section-3 rules live in the system prompt; the model answers only from
  them or says it doesn't know.
- **Guardrails** — `AI_API_KEY` only in server env; browser never calls the provider; the model
  never touches the database (tools only); 15 s timeout; ~20 requests/user/hour; every call
  logged in `ai_logs`; answers carry an *AI-generated* label; employee salary questions are refused.

## Designed system emails ✉️

Every email the app sends is a **branded, designed HTML email** (gradient header, info cards,
password box, net-pay banner — email-client-safe inline styles). Five templates:

- **Welcome / login created** (HR/Admin/employee registrations, CSV import) — with the temp password box
- **Password reset** — new temp password
- **Leave decision** — approved/rejected pill, dates, HR comment
- **Payslip ready** — gradient net-pay banner + breakdown (sent when Admin finalizes)
- **Announcement broadcast** — to every active employee

They are all stored in the **Admin → Emails** outbox (exact HTML the recipient sees, with a live
preview iframe + template picker). Add `RESEND_API_KEY` + `EMAIL_FROM` to the env and they are
delivered for real via [Resend](https://resend.com) (free tier). Without keys: designed + queued, never blocking.

## SweetAlert2 💬

All confirmations and big success moments use themed SweetAlert2 popups (light + dark):
payroll finalize/delete, employee/org deletions, account deactivation, password resets (with
one-time copyable credential box), check-in/out success, leave submissions. Error toasts remain
Sonner for API failures.

## Modern UI & animations ✨

Inter font · indigo→fuchsia brand gradients · glassmorphism sidebar/topbar & auth cards with
floating blobs · animated gradient hero banners (time-aware greeting) per dashboard ·
count-up stat cards with gradient icon chips · gradient chart bars/lines · staggered
entrance animations · hover lift cards · button shine sweep · pulsing check-in ring ·
typing-dots AI loader · ping notification badges · dark mode throughout.

## Bonus features included

- 📷 **Camera check-in** with face detection (`@vladmandic/face-api`, models from CDN) +
  GPS geofence validated server-side with the Haversine formula (needs Admin to set office
  lat/lng — the dialog explains this if the location is not set yet).
- 💸 **Late penalty rule** — every 3 lates deducts 0.5 day in payroll (shown on the payslip PDF).
- 📉 **Attrition risk score** (Admin dashboard) — heuristic 0–100 score from absences, lates,
  activity gaps and short tenure, with reasons.
- 🚩 **Absence anomaly flags** (HR dashboard) — ≥3 absences/30 days, Mon/Fri long-weekend
  patterns, ≥5 lates/month.
- 🌙 **Dark mode** (system-aware toggle).
- 📱 **PWA** — manifest + service worker (network-only passthrough; data never cached), installable.
- 🌐 AI understands **Roman Urdu**.
- Responsive layout (375 px+).
- A generated **sample payslip** is at [`/sample-payslip.pdf`](public/sample-payslip.pdf)
  (re-run `node scripts/gen-sample-payslip.mjs` after changing the layout).

## Project structure

```
src/
  app/
    api/            # REST route handlers (setup, auth, org, users, employees,
                    # attendance, leaves, payroll, dashboard, announcements,
                    # notifications, audit, ai/*)
    (app)/          # authenticated shell: admin/*, hr/*, employee/*
    setup, login, change-password
  components/       # shadcn-style UI kit + features (dashboards, directory,
                    # board, calendar, leaves, payroll, org, users, audit…)
  lib/              # business rules: attendance, leave, payroll, dates, csv,
                    # pdf, audit + ai/ (client, tools, prompt)
  store/            # Redux Toolkit + single RTK Query API
  middleware.js     # JWT session refresh + role-based route guard
supabase/migrations/0001_init.sql
```

## What is done / not done

Done: all 25 checklist functionalities plus every listed bonus — camera attendance
(face + geofence), attrition risk score, absence anomaly flags, late penalty rule
(3 lates = 0.5 day), AI in Roman Urdu, dark mode, PWA (installable).
Not done (optional per brief): native mobile app (the same camera check-in works in mobile
browsers), face-descriptor matching/liveness (we detect exactly-one-face, the brief's base
bonus), hosted link (deploy on Vercel: set the env vars above; run both SQL migrations on any
Supabase project first).

## Security notes

- Passwords are hashed & JWT sessions handled by Supabase Auth.
- Service-role key is server-only; every route re-verifies the JWT and checks role + data scope.
- `.env.example` committed; real secrets never committed (keep them in your host's env settings).
- Append-only audit log (actor, action, entity, before/after JSON) for create/update/approve/finalize.
