# Claude Oops — Phase 2: Core Forum

**Status:** Draft — awaiting review
**Date:** 2026-04-23
**Author:** Tanmay Kallakuri
**Parent spec:** [`2026-04-22-claude-oops-forum-design.md`](./2026-04-22-claude-oops-forum-design.md)
**Predecessor phase:** Phase 1 (foundations) — shipped, deployed at `https://claude-oops.vercel.app`

## Goal

Ship a usable forum backend + skeleton UI: signed-in users can post threads, comment on them (one level of replies), and up/down-vote threads and comments. Anonymous visitors can browse. Content is filterable by category and sortable by newest or top-scoring.

This phase is the smallest coherent slice of the parent spec that turns claude-oops from "auth demo" into "forum you can post on". Everything else from the parent spec (tags, attachments, uptime monitoring, moderation queue, realtime, rate limiting, skills page) explicitly defers to later phases.

## Scope

### In scope

- **Threads** — create, read, author-edit, author-soft-delete.
- **Comments** — create, read, author-edit, author-soft-delete. One level of nesting (reply-to-top-level only).
- **Votes** — `+1` / `-1` / `0` (clear) per user per target. Thread and comment scores shown publicly.
- **Feed** — category filter (`bug` | `behavior` | `discussion`) + sort (`new` | `top` all-time) + cursor pagination.
- **Thread page** — thread body + comment tree + per-target vote buttons + reply composer.
- **Composer** — `/new` for new thread; inline textarea on thread page for new comment.
- **Skeleton UI** — functional, unstyled HTML forms and lists. Visual polish deferred to the Claude Design UI pass.
- **Anonymous read** — non-signed-in visitors can browse the feed and read threads/comments.

### Deferred to later phases

- Tags and `thread_tags`.
- Markdown rendering and sanitization (Phase 2 bodies are plain text with URL autolink at render time).
- Image / file attachments.
- Moderation queue, reports, mod actions, banning.
- Uptime monitoring, auto-incident threads, skills page.
- Realtime comment / vote updates.
- Rate limiting (Upstash Redis).
- Profanity filtering on usernames / content.
- "Top" sort windows beyond all-time (today / this week).
- Top-level signout button in the skeleton UI (still a Phase 1 follow-up; out of scope here).

## Data model

All new tables use UUID primary keys, `created_at timestamptz default now()`, and (where editable) `updated_at timestamptz default now()` maintained by the same `touch_updated_at` trigger used for `profiles` in Phase 1.

```sql
threads (
  id uuid PK,
  author_id uuid NOT NULL → profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
  category text NOT NULL CHECK (category IN ('bug', 'behavior', 'discussion')),
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)
CREATE INDEX threads_feed_idx ON threads (category, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX threads_author_idx ON threads (author_id, created_at DESC);

comments (
  id uuid PK,
  thread_id uuid NOT NULL → threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL → profiles(id) ON DELETE CASCADE,
  parent_comment_id uuid NULL → comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)
CREATE INDEX comments_thread_idx ON comments (thread_id, created_at ASC) WHERE deleted_at IS NULL;

votes (
  user_id uuid NOT NULL → profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('thread', 'comment')),
  target_id uuid NOT NULL,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
)
CREATE INDEX votes_target_idx ON votes (target_type, target_id);
```

Rows with `value = 0` are not stored. "Clearing" a vote is `DELETE FROM votes WHERE …`.

### Derived score

Per parent spec: vote counts are computed at read time via an indexed view.

```sql
CREATE VIEW vote_counts AS
SELECT
  target_type,
  target_id,
  COALESCE(SUM(value), 0)                          AS score,
  COUNT(*) FILTER (WHERE value = 1)                AS up,
  COUNT(*) FILTER (WHERE value = -1)               AS down
FROM votes
GROUP BY target_type, target_id;
```

### Nesting depth enforcement

One level of nesting only. Enforced in the API handler (`POST /api/threads/:id/comments`):

1. If the request body omits `parent_comment_id`, insert a top-level comment.
2. If `parent_comment_id` is set, load that comment; if its own `parent_comment_id IS NOT NULL`, return `400 { code: "nesting_too_deep" }`.

RLS and SQL do not attempt to enforce this — the single-writer API path is the authority.

### RLS

Same defense-in-depth posture as Phase 1: deny-all default, narrow public-read policies.

```sql
ALTER TABLE threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes    ENABLE ROW LEVEL SECURITY;

CREATE POLICY threads_public_select  ON threads  FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY comments_public_select ON comments FOR SELECT USING (deleted_at IS NULL);
-- votes + vote_counts stay private: reads happen via service-role API so per-user vote
-- state and aggregate scores are served by the API, not direct client queries.
```

No insert / update / delete policies — all writes use the service-role admin client via API routes, same as Phase 1.

## API surface

All endpoints return JSON with the shared error envelope `{ error: { code, message } }` (Phase 1 `ApiError`). All bodies validated by Zod schemas in `lib/validation/`.

```
# Threads
GET    /api/threads                  ?category=&sort=new|top&cursor=…&limit=20 (max 50)
POST   /api/threads                  { title, body, category }                 (auth)
GET    /api/threads/:id              → thread + author + score + current_user_vote
PATCH  /api/threads/:id              { title?, body? }                         (author only)
DELETE /api/threads/:id              soft delete                               (author only)

# Comments
GET    /api/threads/:id/comments     ?cursor=&limit=50 (max 100)
POST   /api/threads/:id/comments     { body, parent_comment_id? }              (auth, 1-level)
PATCH  /api/comments/:id             { body }                                  (author only)
DELETE /api/comments/:id             soft delete                               (author only)

# Votes
POST   /api/votes                    { target_type, target_id, value: -1|0|+1 } (auth)
```

### Response shapes

```ts
type ThreadSummary = {
  id: string;
  title: string;
  category: "bug" | "behavior" | "discussion";
  author: { username: string; display_name: string | null };
  score: number;
  comment_count: number;         // non-deleted comments
  created_at: string;
};

type ThreadDetail = ThreadSummary & {
  body: string;
  updated_at: string;
  current_user_vote: -1 | 0 | 1; // 0 if anonymous or cleared
};

type CommentNode = {
  id: string;
  thread_id: string;
  parent_comment_id: string | null;
  body: string;                  // empty string if deleted_at IS NOT NULL; placeholder rendered
  deleted: boolean;              // true when soft-deleted; body and author hidden
  author: { username: string; display_name: string | null } | null;
  score: number;
  current_user_vote: -1 | 0 | 1;
  created_at: string;
  updated_at: string;
};
```

Soft-deleted comments are returned in the tree with `deleted: true` and blanked `body` / `author`, so children stay visible (a deleted parent doesn't hide its replies). Soft-deleted threads are 404'd (no tombstone UI in Phase 2).

### Pagination

Per parent spec. Cursor is `base64url(JSON.stringify({ c: <created_at ISO>, i: <id> }))`. Server decodes, applies `(created_at, id) < (cursor.c, cursor.i)` for DESC (or `>` for ASC), and returns `{ items, next_cursor }` where `next_cursor` is `null` when the page is short.

### "Top" sort (all-time)

`ORDER BY score DESC, created_at DESC, id DESC` joined against `vote_counts`. No time window. If score ties, newer wins. Cursor for `top` encodes `{ score, created_at, id }` instead of `{ created_at, id }` — implementation detail in the plan.

### Authorization

| Action                                  | anon | auth-user | author | mod | admin |
| --------------------------------------- | :--: | :-------: | :----: | :-: | :---: |
| GET feed / thread / comments            |  ✅  |    ✅     |   ✅   | ✅  |  ✅   |
| POST thread / comment                   |  ❌  |    ✅     |   ✅   | ✅  |  ✅   |
| PATCH / DELETE own thread or comment    |  ❌  |    ❌     |   ✅   | ✅  |  ✅   |
| PATCH / DELETE others' content          |  ❌  |    ❌     |   ❌   | ❌  |  ❌   |
| POST vote                               |  ❌  |    ✅     |   ✅   | ✅  |  ✅   |

Mod / admin ability to delete others' content is spec'd for Phase 4 (moderation) and not wired in Phase 2. The role column already exists; Phase 4 just adds endpoint logic.

Banned users: same behavior as Phase 1 — cookie valid, every write endpoint 403. Implemented via `requireAuth` calling a shared `assertNotBanned(profile)` after the profile fetch.

## UI surface

Three new pages plus edits to the home placeholder, all in `app/`:

- `app/page.tsx` — **feed**. Category dropdown (`all` | `bug` | `behavior` | `discussion`), sort tabs (`new` | `top`), list of `ThreadSummary` rows with score, author, category chip, comment count, relative timestamp, and "Load more" button using `next_cursor`. No styling beyond tailwind defaults from Phase 1.
- `app/new/page.tsx` — **new thread composer**. Title (input), body (textarea), category (select), submit → redirect to `/t/[new_id]`. Shows validation errors from the API.
- `app/t/[id]/page.tsx` — **thread detail**. Title, author line, body, vote buttons, then comment list (ordered by `created_at ASC`, nested one level under their parent), reply composer at bottom. Each thread / comment shows its score and up/down buttons; if the viewer is the author, shows inline edit and delete buttons.

No changes to signup / signin / settings / profile pages.

Middleware and auth guards are unchanged from Phase 1.

## Validation

Shared Zod schemas in `lib/validation/`:

```ts
// lib/validation/thread.ts
export const threadCreateSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(10_000),
  category: z.enum(["bug", "behavior", "discussion"]),
});
export const threadPatchSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  body: z.string().min(1).max(10_000).optional(),
}).refine(v => Object.keys(v).length > 0, { message: "At least one field required" });

// lib/validation/comment.ts
export const commentCreateSchema = z.object({
  body: z.string().min(1).max(5000),
  parent_comment_id: z.string().uuid().optional(),
});
export const commentPatchSchema = z.object({
  body: z.string().min(1).max(5000),
});

// lib/validation/vote.ts
export const voteSchema = z.object({
  target_type: z.enum(["thread", "comment"]),
  target_id: z.string().uuid(),
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});
```

## Testing strategy

Identical harness to Phase 1 — Vitest, real Supabase test branch, `supabase db reset --no-seed` per suite.

**Unit tests:**
- Cursor encode / decode (round-trip; malformed rejects).
- Zod schema accept / reject cases for each payload.
- `assertNotBanned` helper.

**Integration tests:**
- `POST /api/threads` — 201 happy path, 401 anon, 400 bad input, 403 banned.
- `GET /api/threads` — feed pagination with > one page of data; category filter; both sorts.
- `GET /api/threads/:id` — 200 with author + score + current_user_vote; 404 for unknown / soft-deleted.
- `PATCH` / `DELETE /api/threads/:id` — 200 by author, 403 by non-author, 401 anon, 404 after delete.
- `POST /api/threads/:id/comments` — top-level + reply; 400 on 2-level nesting; 404 for unknown / soft-deleted thread.
- `PATCH` / `DELETE /api/comments/:id` — same matrix as thread.
- `POST /api/votes` — +1 insert, -1 insert, toggle to 0 deletes row, value clamp rejects other ints.
- Vote count view matches after mixed votes.

**E2E (manual / Playwright — deferred until Phase 2 end):** signed-in user posts thread, comments, votes, sees score update.

## Files added / modified

```
supabase/migrations/20260423120000_threads_comments_votes.sql  (new)

lib/validation/thread.ts     (new)
lib/validation/comment.ts    (new)
lib/validation/vote.ts       (new)
lib/pagination/cursor.ts     (new — encode/decode helper)
lib/auth/guards.ts           (modified — add assertNotBanned)

app/api/threads/route.ts                 (new — GET, POST)
app/api/threads/[id]/route.ts            (new — GET, PATCH, DELETE)
app/api/threads/[id]/comments/route.ts   (new — GET, POST)
app/api/comments/[id]/route.ts           (new — PATCH, DELETE)
app/api/votes/route.ts                   (new — POST)

app/page.tsx                 (replace placeholder — feed)
app/new/page.tsx             (new — composer)
app/t/[id]/page.tsx          (new — thread detail + comments)

tests/unit/cursor.test.ts                (new)
tests/unit/validation-thread.test.ts     (new)
tests/unit/validation-comment.test.ts    (new)
tests/unit/validation-vote.test.ts       (new)
tests/integration/threads-post.test.ts   (new)
tests/integration/threads-get.test.ts    (new)
tests/integration/thread-get-by-id.test.ts (new)
tests/integration/thread-patch-delete.test.ts (new)
tests/integration/comments.test.ts       (new)
tests/integration/votes.test.ts          (new)
```

## Out of scope (for future phases)

- Tags and tag filtering.
- Markdown rendering / sanitization (bodies stay plain text in Phase 2; Phase 3 upgrades render).
- Attachments (image upload, two-step presign).
- Moderation: reports queue, mod actions, banning UI, locking threads.
- Uptime monitoring, auto-incident threads, skills page.
- Realtime comment / vote subscriptions.
- Rate limiting (Upstash Redis or otherwise).
- Profanity filtering.
- Top sort windows (today / week / month).
- Signout button in skeleton UI.
- Polished frontend via Claude Design — separate phase after Phase 2 backend is stable.

## Phase 2 definition of done

- [ ] `npm test` passes (new unit tests included).
- [ ] `npm run test:integration` passes against local Supabase.
- [ ] CI green on main.
- [ ] Production signed-in user can create a thread, comment, reply once, vote, and see score update — verified manually on `https://claude-oops.vercel.app`.
- [ ] Production anonymous visitor can browse feed, open a thread, read comments — no auth required.
- [ ] Soft-deleted threads 404 on GET; soft-deleted comments appear as "[deleted]" tombstones with children preserved.
- [ ] Cursor pagination round-trips without duplicate / missing items across page boundaries.

When all boxes check, Phase 2 ships. Regenerate the next plan (likely "UI polish via Claude Design" or "Moderation + attachments" per user priority).
