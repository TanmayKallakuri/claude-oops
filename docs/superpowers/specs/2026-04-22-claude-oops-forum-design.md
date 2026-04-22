# Claude Oops — Forum + Uptime + Skills Hub

**Status:** Draft — awaiting review
**Date:** 2026-04-22
**Author:** Tanmay Kallakuri
**Name:** `claude-oops`

## Purpose

A community site where Claude users can:

1. **Post threads** about errors, bad behaviors, or other issues they've hit with Claude, and discuss them (image uploads, comments, votes — GitHub × Reddit feel).
2. **See Anthropic uptime** with a live status pill and historical timeline, plus auto-created incident threads.
3. **Jump to the Claude plugin/skill marketplace** from a dedicated section (outbound link, no duplication of that catalog here).

The backend and skeleton pages are built in this repo. The polished visual frontend is built in **Claude Design** against a documented API contract and fixtures.

## Scope boundaries (v1)

**In scope:**

- Public signup (email/password + GitHub OAuth), user profiles, one-level nested comments, image attachments, up/down votes, report queue with a mod role, Anthropic status polling with an auto-incident thread, a static skills landing that links out to `claude.com/plugins`.

**Deliberately out of scope for v1:**

- Private messages, notifications table (emails only), deeply nested comments (one level only), NSFW auto-detection, thread edit history UI (only `updated_at` in DB), search (Postgres full-text or dedicated search service added when needed), federated identity beyond GitHub, i18n.

## Non-goals

- We are not hosting or curating the Claude skill/plugin catalog. The skills page is an on-ramp, not a mirror.
- We are not a real-time chat app. Realtime is used for live comment updates and the uptime pill, not for chat-style conversations.
- We are not a replacement for Anthropic's own status page. We surface their data and give a community space around it.

## Architecture

```
┌──────────────────────────────┐
│  Browser (Claude Design UI)  │
└──────────────┬───────────────┘
               │ HTTPS (Supabase session cookies)
┌──────────────▼───────────────────────┐
│  Next.js 15 on Vercel                │
│  ┌────────────┐  ┌────────────────┐  │
│  │ app/*      │  │ app/api/*      │  │
│  │ RSC pages  │  │ Route handlers │  │
│  │ (thin)     │  │ (all logic)    │  │
│  └────────────┘  └────────┬───────┘  │
└───────────────────────────┼──────────┘
                            │ service-role key (server-only)
               ┌────────────▼─────────────┐
               │  Supabase                │
               │  • Postgres (data)       │
               │  • Auth (users/sessions) │
               │  • Storage (images)      │
               │  • Realtime (live feeds) │
               └────────────┬─────────────┘
                            │
          ┌─────────────────┴──────────────────┐
          │ Edge Function: uptime-poller       │
          │ (pg_cron every 60s → status page)  │
          └────────────────────────────────────┘
```

**Boundaries:**

- **Pages (`app/*`)** render only. They fetch via API or server actions; they do not talk to Supabase directly on the client.
- **API (`app/api/*`)** owns mutations, auth checks, business rules. This is the contract Claude Design's frontend builds against.
- **Supabase client** is server-only (`@supabase/ssr`) with the service role key. Anonymous-key client calls from the browser are forbidden in v1 so authorization stays in one place.
- **Uptime poller** is a Supabase Edge Function triggered by `pg_cron`. Decoupled from the request path.

**Repo shape:** single Next.js app, no monorepo.

## Data model

All tables use UUID primary keys (except `uptime_checks`) and `created_at timestamptz default now()`.

```sql
-- Extends auth.users (Supabase Auth owns the row)
profiles (
  id uuid PK → auth.users,
  username citext UNIQUE,
  display_name text,
  avatar_url text,
  bio text,
  role text DEFAULT 'user',           -- 'user' | 'mod' | 'admin' | 'banned'
  created_at
)

threads (
  id uuid PK,
  author_id uuid → profiles,
  title text,
  body_md text,                        -- markdown source (never raw HTML)
  category text,                       -- 'bug' | 'behavior' | 'discussion' | 'uptime'
  pinned boolean DEFAULT false,
  locked boolean DEFAULT false,
  deleted_at timestamptz NULL,         -- soft delete
  created_at,
  updated_at
)

comments (
  id uuid PK,
  thread_id uuid → threads,
  author_id uuid → profiles,
  parent_comment_id uuid → comments NULL,   -- one level of nesting v1
  body_md text,
  deleted_at timestamptz NULL,
  created_at,
  updated_at
)

attachments (
  id uuid PK,
  uploader_id uuid → profiles,
  thread_id uuid → threads NULL,
  comment_id uuid → comments NULL,
  storage_path text,                   -- Supabase Storage key
  mime_type text,
  size_bytes int,
  width int, height int,
  created_at,
  CHECK ((thread_id IS NOT NULL) <> (comment_id IS NOT NULL))
)

votes (
  user_id uuid → profiles,
  target_type text,                    -- 'thread' | 'comment'
  target_id uuid,
  value smallint,                      -- +1 or -1
  created_at,
  PRIMARY KEY (user_id, target_type, target_id)
)

reports (
  id uuid PK,
  reporter_id uuid → profiles,
  target_type text,                    -- 'thread' | 'comment'
  target_id uuid,
  reason text,
  resolved_at timestamptz NULL,
  resolver_id uuid → profiles NULL,
  created_at
)

mod_actions (
  id uuid PK,
  actor_id uuid → profiles,
  action text,                         -- 'delete' | 'lock' | 'pin' | 'ban' | 'unban' | 'dismiss_report'
  target_type text,
  target_id uuid,
  reason text,
  created_at
)

tags (id uuid PK, name text UNIQUE, slug text UNIQUE)
thread_tags (thread_id, tag_id, PRIMARY KEY (thread_id, tag_id))

uptime_checks (
  id bigserial PK,
  checked_at timestamptz,
  overall_status text,                 -- 'operational' | 'degraded' | 'outage' | 'unknown'
  components jsonb,                    -- raw snapshot from Anthropic status
  latency_ms int NULL
)
```

**Design decisions:**

- **Vote counts:** computed on read via an indexed view for v1. Denormalize to a column with triggers only if the view becomes slow under load.
- **Markdown:** only `body_md` is stored. Rendering happens client-side with `rehype-sanitize` plus an allowlist. No HTML in the DB.
- **Categories:** hard-coded enum-ish `text` column with a CHECK constraint. Moves to a `categories` table only if users need to create their own.
- **Soft delete:** `deleted_at` on threads and comments. Public GETs filter it out; mod queue can see deleted content.
- **Nesting depth:** one level only for comments. Enforced by API: if `parent_comment_id` is set, the parent must have `parent_comment_id IS NULL`.

## Auth and permissions

- **Identity:** Supabase Auth. Email/password + GitHub OAuth. On signup, a Postgres trigger inserts a `profiles` row with a unique lowercase username.
- **Session:** HTTP-only cookies via `@supabase/ssr`. Read server-side in API routes, read client-side via Next.js middleware for route guards.
- **Roles:** `user` (default), `mod`, `admin`, `banned` — a single text column on `profiles`. No separate permissions table in v1.

**Authorization matrix** (enforced in API handlers):

| Action                        | user | mod | admin |
| ----------------------------- | :--: | :-: | :---: |
| Create thread/comment         |  ✅  | ✅  |  ✅   |
| Edit/delete own content       |  ✅  | ✅  |  ✅   |
| Edit/delete others' content   |  ❌  | ✅  |  ✅   |
| Vote                          |  ✅  | ✅  |  ✅   |
| Pin / lock threads            |  ❌  | ✅  |  ✅   |
| Resolve reports               |  ❌  | ✅  |  ✅   |
| Ban users                     |  ❌  | ✅  |  ✅   |
| Assign mod/admin role         |  ❌  | ❌  |  ✅   |

Banned users get a read-only session: their cookie is valid, but every write endpoint returns 403.

**RLS:** enabled everywhere as defense-in-depth, with a deny-all default and narrow public-read policies for non-deleted `threads`, `comments`, `profiles` (public fields only), `tags`, `uptime_checks`. Service-role routes bypass RLS — the authoritative authorization is in the API handlers, so the full role matrix doesn't need to be encoded in SQL.

**Abuse protections:**

- Upstash Redis rate limiting: 10 writes/min/user, 60 reads/min/IP.
- Username and display_name go through a small profanity wordlist on write.
- Email verification required before posting (Supabase built-in).
- CSRF: Supabase cookie + `Origin` header check on every write endpoint.

## API surface

REST-style, JSON. All write endpoints require an authenticated session; mod/admin endpoints check role server-side.

```
# Auth wrappers
POST   /api/auth/signup              { email, password, username }
POST   /api/auth/signin              { email, password }
POST   /api/auth/signout
GET    /api/auth/me                  → current profile or 401

# Profiles
GET    /api/profiles/:username
PATCH  /api/profiles/me              { display_name?, bio?, avatar_url? }

# Threads
GET    /api/threads                  ?category&tag&sort=new|top&cursor=…
POST   /api/threads                  { title, body_md, category, tag_ids[], attachment_ids[] }
GET    /api/threads/:id              → thread + author + tags + attachments + vote_count
PATCH  /api/threads/:id              { title?, body_md? }          (author or mod)
DELETE /api/threads/:id              soft delete                    (author or mod)
POST   /api/threads/:id/lock         (mod+)
POST   /api/threads/:id/pin          (mod+)

# Comments
GET    /api/threads/:id/comments     ?cursor=…
POST   /api/threads/:id/comments     { body_md, parent_comment_id?, attachment_ids[] }
PATCH  /api/comments/:id             { body_md }
DELETE /api/comments/:id             soft delete

# Votes
POST   /api/votes                    { target_type, target_id, value }   (+1 / -1 / 0 to clear)

# Reports
POST   /api/reports                  { target_type, target_id, reason }
GET    /api/reports                  (mod+; filter by resolved)
PATCH  /api/reports/:id              { resolved: true, action_taken?: 'delete'|'lock'|'ban'|'dismiss' }   (mod+)

# Attachments (two-step upload)
POST   /api/attachments/presign      { mime_type, size_bytes }
                                     → { attachment_id, upload_url, storage_path }
POST   /api/attachments/:id/finalize → validates bytes, returns public URL

# Uptime
GET    /api/uptime/current           → latest check
GET    /api/uptime/history           ?window=24h|7d|30d → aggregated series

# Tags
GET    /api/tags                     → all tags + usage counts

# Skills
GET    /api/skills/marketplace-url   → { url: "https://claude.com/plugins" }
```

**Conventions:**

- Cursor-based pagination: opaque base64 of `(created_at, id)`. No offset pagination.
- Errors: `{ error: { code, message } }` with standard HTTP status codes.
- All bodies validated by shared Zod schemas in `lib/validation/` so the client and server can import the same shape.
- Response Content-Type is always `application/json`.

## Image uploads

Two-step flow to keep large bytes off Vercel's request path.

```
Client                         /api/attachments/presign
  │  mime + size ─────────────▶│ validate mime + size + auth
  │                            │ INSERT attachments row (status=pending)
  │                            │ issue Supabase signed upload URL
  │  attachment_id, upload_url │
  │◀───────────────────────────│
  │
  │  PUT bytes ────────────────▶ Supabase Storage
  │
  │  /api/attachments/:id/finalize
  │───────────────────────────▶│ HEAD object, verify size,
  │                            │ probe magic bytes (GET Range 0-15),
  │                            │ extract dims with `sharp`,
  │                            │ strip EXIF, write thumbnail async,
  │                            │ flip row to ready,
  │                            │ return public URL
  │◀───────────────────────────│
```

**Validation:**

- `mime_type ∈ {image/png, image/jpeg, image/webp, image/gif}`.
- `size_bytes ≤ 8 MB`.
- Uploader must be authenticated and email-verified.
- On finalize, declared mime must match actual magic bytes; mismatches are deleted.

**Attach to content:** the creation request (`POST /threads` or `POST /comments`) includes `attachment_ids[]`. The handler reassigns the attachment row's `thread_id` or `comment_id` inside the creation transaction. Unattached attachments older than 24h are garbage-collected by a nightly cron.

**Storage layout:**

```
attachments/{user_id}/{yyyy}/{mm}/{attachment_id}.{ext}
thumbnails/{attachment_id}_512.webp
```

**Abuse controls v1:** 20 uploads/user/day, report-button + mod queue (no NSFW auto-detection v1).

## Uptime monitoring

- **Source:** Anthropic Statuspage at `https://status.anthropic.com/api/v2/summary.json`.
- **Poller:** Supabase Edge Function `uptime-poller`, triggered by `pg_cron` every 60 seconds with a 10-second fetch timeout.
- **Per check we record:** `checked_at`, `overall_status`, full `components` JSON snapshot, `latency_ms` of the fetch.
- **Gap handling:** three consecutive failures insert a row with `overall_status='unknown'` — timeline gaps lie more than an honest "we don't know".
- **Retention:** raw `uptime_checks` kept 90 days (nightly delete); 5-minute / 1-hour / 6-hour bucketed aggregates kept forever in a materialized view refreshed every 5 minutes.

**API:**

- `GET /api/uptime/current` — latest row, cached 30s.
- `GET /api/uptime/history?window=24h|7d|30d` — server picks the right bucket size and reads from the materialized view.

**Auto-incident thread:** when `overall_status` transitions `operational → degraded|outage`, the API creates a thread authored by a reserved `system` profile (inserted at seed time with role `admin` and username `system`) in category `uptime` with a locked OP linking to `status.anthropic.com`, and open comments so users can discuss. Thread is auto-locked when status returns to `operational` and a closing comment is posted.

## Realtime

Two Supabase Realtime channels:

- `thread:{id}` — inserts/updates/deletes on that thread's comments plus vote changes on its posts.
- `uptime` — inserts on `uptime_checks` (drives the live status pill).

Client subscribes on mount, unsubscribes on unmount. The initial state always comes from the REST API; realtime is additive. On reconnect the client refetches to close any gap.

## Skills page

No backend state. A static `/skills` page with a hero, a CTA to `claude.com/plugins` served from `/api/skills/marketplace-url` (so the URL can change without a redeploy), and an optional curated list held in `lib/curated-skills.ts` (moves to DB only when the list grows).

## Moderation

- **Report button** on every thread and comment → `POST /api/reports`.
- **`/reports` page** (mod+ only): unresolved queue with filters, click-through to the target, one-click actions: dismiss, soft-delete, lock thread, ban user.
- **Audit log:** every mod action inserts into `mod_actions`. Not exposed publicly v1.
- **Author notification:** when a mod deletes or bans, the target author gets an email with the reason (uses Supabase Auth email channel; no separate notifications table v1).

## Frontend handoff contract (for Claude Design)

Deliverables in `/docs/frontend-contract/`:

1. **`api.md`** — every endpoint in the API surface section, with request/response JSON schemas, error codes, and worked examples.
2. **`pages.md`** — required routes with purpose and data dependencies:
   - `/` — thread feed (category + tag filters, sort)
   - `/t/[id]` — thread detail + comments
   - `/new` — composer
   - `/u/[username]` — profile
   - `/uptime` — status page (pill, component strip, latency chart)
   - `/skills` — marketplace on-ramp
   - `/reports` — mod queue (role-gated)
   - `/settings` — profile edit
   - `/signin`, `/signup` — auth
3. **`components.md`** — semantic component inventory and props contract (ThreadCard, CommentTree, VoteButtons, StatusPill, UptimeTimeline, ReportButton, AttachmentGrid, ComposerToolbar). Claude Design owns visual style; the contract owns data shape.
4. **`mock-fixtures.json`** — realistic fixtures covering every endpoint so Claude Design can preview without a live backend.

**Workflow:** backend + skeleton pages with placeholder UI are built in this repo; Claude Design reads the contract + fixtures, produces polished components; we wire them into the skeleton.

## Testing strategy

- **Unit (Vitest):** markdown sanitization, cursor encode/decode, auth and role guards, RLS policy helpers, rate-limit key derivation.
- **API integration (Vitest + real Supabase test branch):** every endpoint × every role cell × every status code (200/400/401/403/404). No HTTP or DB mocks — tests hit a throwaway Supabase branch reset between suites via `supabase db reset`.
- **E2E smoke (Playwright):** signup → post thread with image → comment → vote → mod deletes thread. Runs in CI on PR.
- **Load (k6, manual before launch):** 500 concurrent readers on a popular thread.
- **CI:** GitHub Actions — type-check, lint, unit, integration on every push; E2E on main.

## Folder layout

```
claude-oops/
├─ app/
│  ├─ (public)/                 # layouts and pages
│  ├─ api/                      # route handlers
│  └─ auth/
├─ components/                  # shared skeleton components
├─ lib/
│  ├─ supabase/                 # server + browser clients
│  ├─ auth/                     # session helpers, guards
│  ├─ rate-limit/               # Upstash middleware
│  └─ validation/               # zod schemas (shared between API and client)
├─ supabase/
│  ├─ migrations/               # SQL migrations
│  ├─ functions/uptime-poller/  # edge function
│  └─ seed.sql
├─ docs/
│  ├─ frontend-contract/        # api.md, pages.md, components.md, mock-fixtures.json
│  └─ superpowers/specs/        # this file and future specs
└─ tests/
   ├─ unit/
   ├─ integration/
   └─ e2e/
```

## Resolved setup decisions

- **Name:** `claude-oops`.
- **GitHub repo:** public.
- **Domain:** none yet. OAuth callback + Supabase email verification links use the Vercel preview URL (e.g. `claude-oops.vercel.app`) for v1. Plan must make the base URL a single env var (`APP_BASE_URL`) so the later domain swap is a config change, not a code change.
- **Email:** Supabase Auth's built-in sender for v1. Flag to revisit if auto-incident-thread traffic or bounce rates push us past Supabase's limits.

## Review checkpoints

- **Spec review (this file):** user approves before plan is written.
- **Plan review:** once `writing-plans` produces the implementation plan, user approves before any code is written.
- **Frontend-contract review:** once `api.md` + `pages.md` + `components.md` + `mock-fixtures.json` exist, review before handing to Claude Design.
