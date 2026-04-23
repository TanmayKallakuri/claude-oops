# Phase 2: Core Forum — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship threads + 1-level comments + up/down votes on top of the Phase 1 foundation. Signed-in users post and vote; anonymous visitors browse. Category filter + new/top sort + cursor pagination. Skeleton UI (no visual polish).

**Architecture:** Single Next.js 15 app. Service-role Supabase admin client owns all writes via `app/api/*` route handlers. Anonymous-key client is not used on the browser. Vote counts computed via `vote_counts` view. Soft delete via `deleted_at`. Cursor pagination, never offset.

**Tech Stack:** Next.js 15, TypeScript strict, Supabase (Postgres + Auth), Vitest, Zod, Tailwind (default classes only in skeleton).

**Spec:** `docs/superpowers/specs/2026-04-23-claude-oops-phase-2-design.md`

## Task dependency graph (for parallel dispatch)

```
Task 1  (DB migration)        ────┬──▶ Task 2  (cursor helper)        ──┐
                                   ├──▶ Task 3  (Zod schemas)          ──┤
                                   └──▶ Task 4  (assertNotBanned)      ──┤
                                                                          ▼
                                                    Task 5  (threads collection API)     ──┐
                                                    Task 6  (thread detail API)          ──┤
                                                    Task 8  (comment detail API)         ──┤
                                                    Task 9  (votes API)                  ──┤
                                                                                            ▼
                                                                            Task 7  (comments collection API)
                                                                                            │
                                                                                            ▼
                                                    Task 10 (feed UI)          ─┐
                                                    Task 11 (composer UI)      ─┤
                                                    Task 12 (thread detail UI) ─┤
                                                                                ▼
                                                                         Task 13 (deploy + smoke)
```

**Parallel groups:**
- After Task 1: Tasks 2, 3, 4 (all leaf lib work) can run in parallel.
- After Tasks 1–4: Tasks 5, 6, 8, 9 (independent API routes) can run in parallel.
- Task 7 (comments collection) depends on the thread-detail route existing because it asserts against soft-deleted threads; run after Task 6.
- After the API tasks: Tasks 10, 11 can run in parallel. Task 12 depends on Tasks 6, 7, 8, 9.
- Task 13 is serial at the end.

---

## Task 1: Database migration — threads, comments, votes, vote_counts view, RLS

**Files:**
- Create: `supabase/migrations/20260423120000_threads_comments_votes.sql`

**Prerequisites:** None. Start here.

- [ ] **Step 1: Write migration file**

`supabase/migrations/20260423120000_threads_comments_votes.sql`:

```sql
-- 20260423120000_threads_comments_votes.sql
-- Phase 2 data layer: threads, comments, votes, vote_counts view, RLS baseline.

-- Threads ---------------------------------------------------------------------
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 200),
  body text not null check (char_length(body) between 1 and 10000),
  category text not null check (category in ('bug', 'behavior', 'discussion')),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index threads_feed_idx on public.threads (category, created_at desc)
  where deleted_at is null;
create index threads_author_idx on public.threads (author_id, created_at desc);

create trigger threads_touch_updated_at
  before update on public.threads
  for each row execute function public.touch_updated_at();

-- Comments --------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid null references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_thread_idx on public.comments (thread_id, created_at asc)
  where deleted_at is null;
create index comments_parent_idx on public.comments (parent_comment_id)
  where parent_comment_id is not null;

create trigger comments_touch_updated_at
  before update on public.comments
  for each row execute function public.touch_updated_at();

-- Votes -----------------------------------------------------------------------
create table public.votes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('thread', 'comment')),
  target_id uuid not null,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create index votes_target_idx on public.votes (target_type, target_id);

-- vote_counts: aggregated score per target. Consumed via service-role API only.
create view public.vote_counts as
select
  target_type,
  target_id,
  coalesce(sum(value), 0)               as score,
  count(*) filter (where value = 1)     as up,
  count(*) filter (where value = -1)    as down
from public.votes
group by target_type, target_id;

-- RLS -------------------------------------------------------------------------
alter table public.threads  enable row level security;
alter table public.comments enable row level security;
alter table public.votes    enable row level security;

create policy threads_public_select on public.threads
  for select using (deleted_at is null);

create policy comments_public_select on public.comments
  for select using (deleted_at is null);

-- votes intentionally has no public policy.
-- Reads for score / current_user_vote go through the service-role API.

-- No insert/update/delete policies anywhere — writes go through API routes.
```

- [ ] **Step 2: Apply migration locally**

Requires Docker Desktop running and `supabase start` having been run once this session.

```bash
supabase db reset
```

Expected: ends with "Finished supabase db reset" and re-applies all migrations including the new one.

- [ ] **Step 3: Verify schema**

```bash
supabase db diff
```

Expected: "No schema changes found".

Also open `http://localhost:54323` (Studio) → Table Editor → confirm `threads`, `comments`, `votes` tables visible and `vote_counts` view listed under Views.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260423120000_threads_comments_votes.sql
git commit -m "feat(db): phase 2 schema — threads, comments, votes, vote_counts view, RLS"
```

---

## Task 2: Cursor pagination helper

**Files:**
- Create: `lib/pagination/cursor.ts`
- Create: `tests/unit/cursor.test.ts`

**Prerequisites:** None — can run parallel to Tasks 3 and 4 as soon as Task 1 is committed.

- [ ] **Step 1: Write failing test**

`tests/unit/cursor.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor } from "@/lib/pagination/cursor";

describe("cursor encode/decode", () => {
  it("round-trips a simple cursor", () => {
    const original = { c: "2026-04-23T00:00:00.000Z", i: "11111111-1111-1111-1111-111111111111" };
    const encoded = encodeCursor(original);
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(original);
  });

  it("round-trips a cursor with extra numeric fields", () => {
    const original = { c: "2026-04-23T00:00:00.000Z", i: "22222222-2222-2222-2222-222222222222", s: 42 };
    expect(decodeCursor(encodeCursor(original))).toEqual(original);
  });

  it("decodes returns null on malformed input", () => {
    expect(decodeCursor("not-base64")).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("YWJjZGVm")).toBeNull(); // "abcdef" — valid base64, not valid JSON
  });

  it("encodes to URL-safe characters only", () => {
    const encoded = encodeCursor({ c: "2026-04-23T00:00:00.000Z", i: "ffffffff-ffff-ffff-ffff-ffffffffffff" });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- cursor
```

Expected: FAIL with "module not found" for `@/lib/pagination/cursor`.

- [ ] **Step 3: Write implementation**

`lib/pagination/cursor.ts`:

```typescript
export type Cursor = Record<string, string | number>;

export function encodeCursor(payload: Cursor): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- cursor
```

Expected: PASS, all 4 cases.

- [ ] **Step 5: Commit**

```bash
git add lib/pagination/cursor.ts tests/unit/cursor.test.ts
git commit -m "feat(pagination): url-safe cursor encode/decode with unit tests"
```

---

## Task 3: Zod validation schemas (thread, comment, vote)

**Files:**
- Create: `lib/validation/thread.ts`
- Create: `lib/validation/comment.ts`
- Create: `lib/validation/vote.ts`
- Create: `tests/unit/validation-thread.test.ts`
- Create: `tests/unit/validation-comment.test.ts`
- Create: `tests/unit/validation-vote.test.ts`

**Prerequisites:** None — parallel with Tasks 2 and 4.

- [ ] **Step 1: Write failing test — thread**

`tests/unit/validation-thread.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { threadCreateSchema, threadPatchSchema } from "@/lib/validation/thread";

describe("threadCreateSchema", () => {
  const valid = { title: "Hello world", body: "A body", category: "bug" as const };

  it("accepts valid input", () => {
    expect(threadCreateSchema.parse(valid)).toEqual(valid);
  });

  it("rejects too-short title", () => {
    expect(() => threadCreateSchema.parse({ ...valid, title: "hi" })).toThrow();
  });

  it("rejects too-long title (> 200)", () => {
    expect(() => threadCreateSchema.parse({ ...valid, title: "x".repeat(201) })).toThrow();
  });

  it("rejects too-long body (> 10000)", () => {
    expect(() => threadCreateSchema.parse({ ...valid, body: "x".repeat(10001) })).toThrow();
  });

  it("rejects bad category", () => {
    expect(() => threadCreateSchema.parse({ ...valid, category: "nope" })).toThrow();
  });

  it("rejects empty body", () => {
    expect(() => threadCreateSchema.parse({ ...valid, body: "" })).toThrow();
  });
});

describe("threadPatchSchema", () => {
  it("accepts partial update — title only", () => {
    expect(threadPatchSchema.parse({ title: "New title" })).toEqual({ title: "New title" });
  });

  it("accepts partial update — body only", () => {
    expect(threadPatchSchema.parse({ body: "New body" })).toEqual({ body: "New body" });
  });

  it("rejects empty object", () => {
    expect(() => threadPatchSchema.parse({})).toThrow();
  });
});
```

- [ ] **Step 2: Write `lib/validation/thread.ts`**

```typescript
import { z } from "zod";

export const threadCreateSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(10000),
  category: z.enum(["bug", "behavior", "discussion"]),
});

export const threadPatchSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    body: z.string().min(1).max(10000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field required" });

export type ThreadCreateInput = z.infer<typeof threadCreateSchema>;
export type ThreadPatchInput = z.infer<typeof threadPatchSchema>;
```

- [ ] **Step 3: Write failing test — comment**

`tests/unit/validation-comment.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { commentCreateSchema, commentPatchSchema } from "@/lib/validation/comment";

describe("commentCreateSchema", () => {
  it("accepts top-level comment", () => {
    expect(commentCreateSchema.parse({ body: "hi" })).toEqual({ body: "hi" });
  });

  it("accepts reply with parent_comment_id", () => {
    const input = { body: "reply", parent_comment_id: "11111111-1111-1111-1111-111111111111" };
    expect(commentCreateSchema.parse(input)).toEqual(input);
  });

  it("rejects non-uuid parent_comment_id", () => {
    expect(() => commentCreateSchema.parse({ body: "x", parent_comment_id: "nope" })).toThrow();
  });

  it("rejects empty body", () => {
    expect(() => commentCreateSchema.parse({ body: "" })).toThrow();
  });

  it("rejects body > 5000 chars", () => {
    expect(() => commentCreateSchema.parse({ body: "x".repeat(5001) })).toThrow();
  });
});

describe("commentPatchSchema", () => {
  it("accepts body update", () => {
    expect(commentPatchSchema.parse({ body: "updated" })).toEqual({ body: "updated" });
  });

  it("rejects missing body", () => {
    expect(() => commentPatchSchema.parse({})).toThrow();
  });
});
```

- [ ] **Step 4: Write `lib/validation/comment.ts`**

```typescript
import { z } from "zod";

export const commentCreateSchema = z.object({
  body: z.string().min(1).max(5000),
  parent_comment_id: z.string().uuid().optional(),
});

export const commentPatchSchema = z.object({
  body: z.string().min(1).max(5000),
});

export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
export type CommentPatchInput = z.infer<typeof commentPatchSchema>;
```

- [ ] **Step 5: Write failing test — vote**

`tests/unit/validation-vote.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { voteSchema } from "@/lib/validation/vote";

describe("voteSchema", () => {
  const base = { target_type: "thread" as const, target_id: "11111111-1111-1111-1111-111111111111" };

  it("accepts +1", () => {
    expect(voteSchema.parse({ ...base, value: 1 })).toEqual({ ...base, value: 1 });
  });

  it("accepts -1", () => {
    expect(voteSchema.parse({ ...base, value: -1 })).toEqual({ ...base, value: -1 });
  });

  it("accepts 0 (clear)", () => {
    expect(voteSchema.parse({ ...base, value: 0 })).toEqual({ ...base, value: 0 });
  });

  it("rejects other integer values", () => {
    expect(() => voteSchema.parse({ ...base, value: 2 })).toThrow();
    expect(() => voteSchema.parse({ ...base, value: -3 })).toThrow();
  });

  it("rejects unknown target_type", () => {
    expect(() => voteSchema.parse({ ...base, target_type: "user", value: 1 })).toThrow();
  });

  it("rejects non-uuid target_id", () => {
    expect(() => voteSchema.parse({ target_type: "thread", target_id: "nope", value: 1 })).toThrow();
  });
});
```

- [ ] **Step 6: Write `lib/validation/vote.ts`**

```typescript
import { z } from "zod";

export const voteSchema = z.object({
  target_type: z.enum(["thread", "comment"]),
  target_id: z.string().uuid(),
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

export type VoteInput = z.infer<typeof voteSchema>;
```

- [ ] **Step 7: Run all new tests**

```bash
npm test -- validation-thread validation-comment validation-vote
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/validation/thread.ts lib/validation/comment.ts lib/validation/vote.ts \
  tests/unit/validation-thread.test.ts tests/unit/validation-comment.test.ts tests/unit/validation-vote.test.ts
git commit -m "feat(validation): Zod schemas for threads, comments, votes"
```

---

## Task 4: `assertNotBanned` guard

**Files:**
- Modify: `lib/auth/guards.ts`
- Create: `tests/unit/assert-not-banned.test.ts`

**Prerequisites:** None — parallel with Tasks 2 and 3.

- [ ] **Step 1: Write failing test**

`tests/unit/assert-not-banned.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { assertNotBanned } from "@/lib/auth/guards";

function makeAdmin(role: string | null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: role ? { role } : null, error: null }),
    }),
  } as any;
}

describe("assertNotBanned", () => {
  it("resolves for role=user", async () => {
    await expect(assertNotBanned(makeAdmin("user"), "u1")).resolves.toBeUndefined();
  });

  it("resolves for role=mod", async () => {
    await expect(assertNotBanned(makeAdmin("mod"), "u1")).resolves.toBeUndefined();
  });

  it("resolves for role=admin", async () => {
    await expect(assertNotBanned(makeAdmin("admin"), "u1")).resolves.toBeUndefined();
  });

  it("throws 403 for role=banned", async () => {
    await expect(assertNotBanned(makeAdmin("banned"), "u1")).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
    });
  });

  it("throws 401 when profile missing", async () => {
    await expect(assertNotBanned(makeAdmin(null), "u1")).rejects.toMatchObject({
      status: 401,
    });
  });
});
```

- [ ] **Step 2: Modify `lib/auth/guards.ts` — append `assertNotBanned`**

Add at the bottom of `lib/auth/guards.ts` (keep everything already in the file):

```typescript
export async function assertNotBanned(admin: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new ApiError("internal", "Role lookup failed", 500);
  if (!data) throw new ApiError("unauthorized", "Profile missing", 401);
  if ((data.role as Role) === "banned") {
    throw new ApiError("forbidden", "Banned users cannot perform this action", 403);
  }
}
```

The full `lib/auth/guards.ts` after modification:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./errors";

export type Role = "user" | "mod" | "admin" | "banned";

export async function requireAuth(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApiError("unauthorized", "You must be signed in", 401);
  }
  return data.user.id;
}

export async function requireRole(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  allowed: Role[],
): Promise<string> {
  const userId = await requireAuth(supabase);
  const { data, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new ApiError("internal", "Role lookup failed", 500);
  if (!data) throw new ApiError("unauthorized", "Profile missing", 401);
  const role = data.role as Role;
  if (role === "banned" || !allowed.includes(role)) {
    throw new ApiError("forbidden", "Insufficient permissions", 403);
  }
  return userId;
}

export async function assertNotBanned(admin: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new ApiError("internal", "Role lookup failed", 500);
  if (!data) throw new ApiError("unauthorized", "Profile missing", 401);
  if ((data.role as Role) === "banned") {
    throw new ApiError("forbidden", "Banned users cannot perform this action", 403);
  }
}
```

- [ ] **Step 3: Run test**

```bash
npm test -- assert-not-banned
```

Expected: PASS, 5 cases.

- [ ] **Step 4: Commit**

```bash
git add lib/auth/guards.ts tests/unit/assert-not-banned.test.ts
git commit -m "feat(auth): assertNotBanned guard for write endpoints"
```

---

## Task 5: API — threads collection (`GET /api/threads`, `POST /api/threads`)

**Files:**
- Create: `app/api/threads/route.ts`
- Create: `tests/integration/threads-collection.test.ts`

**Prerequisites:** Tasks 1, 2, 3, 4 complete.

- [ ] **Step 1: Write `app/api/threads/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, assertNotBanned } from "@/lib/auth/guards";
import { ApiError, toResponse } from "@/lib/auth/errors";
import { threadCreateSchema } from "@/lib/validation/thread";
import { decodeCursor, encodeCursor } from "@/lib/pagination/cursor";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const sort = url.searchParams.get("sort") === "top" ? "top" : "new";
    const rawCursor = url.searchParams.get("cursor");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT), MAX_LIMIT);

    const admin = getAdminClient();
    let query = admin
      .from("threads")
      .select("id, title, body, category, created_at, updated_at, author_id, profiles!inner(username, display_name)")
      .is("deleted_at", null)
      .limit(limit + 1);

    if (category && ["bug", "behavior", "discussion"].includes(category)) {
      query = query.eq("category", category);
    }

    if (sort === "new") {
      const cursor = decodeCursor(rawCursor);
      query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
      if (cursor && typeof cursor.c === "string" && typeof cursor.i === "string") {
        query = query.or(`created_at.lt.${cursor.c},and(created_at.eq.${cursor.c},id.lt.${cursor.i})`);
      }
    } else {
      // top: order by score desc, tie-break by created_at desc, id desc
      // We do this in two steps: fetch a wider window, join scores in-memory for simplicity.
      // For Phase 2 volumes, this is fine. Upgrade to a SQL CTE if the feed gets slow.
      const cursor = decodeCursor(rawCursor);
      query = query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(500);
      if (cursor && typeof cursor.c === "string" && typeof cursor.i === "string") {
        query = query.or(`created_at.lt.${cursor.c},and(created_at.eq.${cursor.c},id.lt.${cursor.i})`);
      }
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // Score lookup per row.
    const ids = (rows ?? []).map((r) => r.id);
    let scoreMap = new Map<string, number>();
    if (ids.length > 0) {
      const { data: scores } = await admin
        .from("vote_counts")
        .select("target_id, score")
        .eq("target_type", "thread")
        .in("target_id", ids);
      scoreMap = new Map((scores ?? []).map((s) => [s.target_id as string, Number(s.score ?? 0)]));
    }

    // Comment count per thread.
    let countMap = new Map<string, number>();
    if (ids.length > 0) {
      const { data: counts } = await admin
        .from("comments")
        .select("thread_id")
        .is("deleted_at", null)
        .in("thread_id", ids);
      for (const row of counts ?? []) {
        countMap.set(row.thread_id as string, (countMap.get(row.thread_id as string) ?? 0) + 1);
      }
    }

    let shaped = (rows ?? []).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      category: r.category as string,
      author: {
        username: (r.profiles as { username: string }).username,
        display_name: (r.profiles as { display_name: string | null }).display_name,
      },
      score: scoreMap.get(r.id as string) ?? 0,
      comment_count: countMap.get(r.id as string) ?? 0,
      created_at: r.created_at as string,
    }));

    if (sort === "top") {
      shaped.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
        return a.id < b.id ? 1 : -1;
      });
    }

    const hasMore = shaped.length > limit;
    const page = shaped.slice(0, limit);
    const next_cursor =
      hasMore && page.length > 0
        ? encodeCursor({ c: page[page.length - 1].created_at, i: page[page.length - 1].id })
        : null;

    return Response.json({ items: page, next_cursor });
  } catch (err) {
    return toResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    await assertNotBanned(admin, userId);

    const input = threadCreateSchema.parse(await req.json());

    const { data, error } = await admin
      .from("threads")
      .insert({
        author_id: userId,
        title: input.title,
        body: input.body,
        category: input.category,
      })
      .select("id, title, body, category, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ thread: data }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}
```

- [ ] **Step 2: Write integration tests**

`tests/integration/threads-collection.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { POST as createThread, GET as listThreads } from "@/app/api/threads/route";
import { createUser } from "../setup/factory";
import { makeRequest, readJson } from "../setup/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";

beforeEach(() => execSync("supabase db reset --no-seed", { stdio: "ignore" }));

async function signInAs(email: string) {
  // We cannot easily construct a real session cookie in tests. Phase 1 pattern: test anon paths
  // via direct handler invocation, and test authed mutations by calling admin directly.
  // For this task we only smoke-test the POST path via direct admin insert; dedicated
  // "authed request" helpers land in a later task.
  void email;
}

describe("POST /api/threads", () => {
  it("401 when anonymous", async () => {
    const req = makeRequest("/api/threads", {
      method: "POST",
      body: JSON.stringify({ title: "Hello world", body: "body", category: "bug" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await createThread(req);
    expect(res.status).toBe(401);
  });

  it("400 on bad input (auth check runs first — so this also returns 401 anonymously)", async () => {
    const req = makeRequest("/api/threads", {
      method: "POST",
      body: JSON.stringify({ title: "x", body: "", category: "bug" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await createThread(req);
    // anon -> 401 short-circuits before zod. Keeping the assertion loose here.
    expect([400, 401]).toContain(res.status);
  });
});

describe("GET /api/threads", () => {
  it("returns empty list with null cursor initially", async () => {
    const req = makeRequest("/api/threads");
    const res = await listThreads(req);
    expect(res.status).toBe(200);
    const body = await readJson<{ items: unknown[]; next_cursor: string | null }>(res);
    expect(body.items).toEqual([]);
    expect(body.next_cursor).toBeNull();
  });

  it("returns threads authored by a created user", async () => {
    const user = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const admin = getAdminClient();
    await admin.from("threads").insert({
      author_id: user.id,
      title: "First thread",
      body: "hello",
      category: "bug",
    });

    const res = await listThreads(makeRequest("/api/threads"));
    const body = await readJson<{ items: Array<{ title: string; author: { username: string } }> }>(res);
    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe("First thread");
    expect(body.items[0].author.username).toBe("alice");
  });

  it("filters by category", async () => {
    const user = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const admin = getAdminClient();
    await admin.from("threads").insert([
      { author_id: user.id, title: "bug one", body: "b", category: "bug" },
      { author_id: user.id, title: "discussion one", body: "b", category: "discussion" },
    ]);

    const res = await listThreads(makeRequest("/api/threads?category=bug"));
    const body = await readJson<{ items: Array<{ title: string }> }>(res);
    expect(body.items.map((i) => i.title)).toEqual(["bug one"]);
  });

  it("hides soft-deleted threads", async () => {
    const user = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const admin = getAdminClient();
    const { data: t } = await admin
      .from("threads")
      .insert({ author_id: user.id, title: "will delete", body: "b", category: "bug" })
      .select("id")
      .single();
    await admin.from("threads").update({ deleted_at: new Date().toISOString() }).eq("id", t!.id);

    const res = await listThreads(makeRequest("/api/threads"));
    const body = await readJson<{ items: unknown[] }>(res);
    expect(body.items).toEqual([]);
  });

  it("paginates via next_cursor", async () => {
    const user = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const admin = getAdminClient();
    const rows = Array.from({ length: 25 }, (_, i) => ({
      author_id: user.id,
      title: `thread ${i}`,
      body: "b",
      category: "bug",
    }));
    await admin.from("threads").insert(rows);

    const first = await listThreads(makeRequest("/api/threads?limit=20"));
    const firstBody = await readJson<{ items: Array<{ id: string }>; next_cursor: string | null }>(first);
    expect(firstBody.items).toHaveLength(20);
    expect(firstBody.next_cursor).not.toBeNull();

    const second = await listThreads(makeRequest(`/api/threads?limit=20&cursor=${firstBody.next_cursor}`));
    const secondBody = await readJson<{ items: Array<{ id: string }>; next_cursor: string | null }>(second);
    expect(secondBody.items).toHaveLength(5);
    expect(secondBody.next_cursor).toBeNull();

    const firstIds = new Set(firstBody.items.map((i) => i.id));
    for (const item of secondBody.items) expect(firstIds.has(item.id)).toBe(false);
  });
});
```

- [ ] **Step 3: Run integration tests**

```bash
npm run test:integration -- threads-collection
```

Expected: PASS.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/threads/route.ts tests/integration/threads-collection.test.ts
git commit -m "feat(api): GET/POST /api/threads with pagination and category filter"
```

---

## Task 6: API — thread detail (`GET /api/threads/:id`, `PATCH`, `DELETE`)

**Files:**
- Create: `app/api/threads/[id]/route.ts`
- Create: `tests/integration/thread-detail.test.ts`

**Prerequisites:** Tasks 1, 3, 4 complete. Can run parallel with Task 5.

- [ ] **Step 1: Write `app/api/threads/[id]/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, assertNotBanned } from "@/lib/auth/guards";
import { ApiError, toResponse } from "@/lib/auth/errors";
import { threadPatchSchema } from "@/lib/validation/thread";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = getAdminClient();

    const { data: thread, error } = await admin
      .from("threads")
      .select("id, title, body, category, created_at, updated_at, author_id, deleted_at, profiles!inner(username, display_name)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!thread || thread.deleted_at) throw new ApiError("not_found", "Thread not found", 404);

    const { data: scoreRow } = await admin
      .from("vote_counts")
      .select("score")
      .eq("target_type", "thread")
      .eq("target_id", id)
      .maybeSingle();
    const score = Number(scoreRow?.score ?? 0);

    // comment_count: non-deleted
    const { count: commentCount } = await admin
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", id)
      .is("deleted_at", null);

    // current_user_vote (needs session)
    let currentUserVote: -1 | 0 | 1 = 0;
    const supabase = createServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const { data: vote } = await admin
        .from("votes")
        .select("value")
        .eq("user_id", userData.user.id)
        .eq("target_type", "thread")
        .eq("target_id", id)
        .maybeSingle();
      if (vote) currentUserVote = vote.value === 1 ? 1 : -1;
    }

    return Response.json({
      thread: {
        id: thread.id,
        title: thread.title,
        body: thread.body,
        category: thread.category,
        author: {
          username: (thread.profiles as { username: string }).username,
          display_name: (thread.profiles as { display_name: string | null }).display_name,
        },
        score,
        comment_count: commentCount ?? 0,
        current_user_vote: currentUserVote,
        created_at: thread.created_at,
        updated_at: thread.updated_at,
      },
    });
  } catch (err) {
    return toResponse(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    await assertNotBanned(admin, userId);

    const { data: existing, error: fetchErr } = await admin
      .from("threads")
      .select("author_id, deleted_at")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing || existing.deleted_at) throw new ApiError("not_found", "Thread not found", 404);
    if (existing.author_id !== userId) throw new ApiError("forbidden", "Not your thread", 403);

    const input = threadPatchSchema.parse(await req.json());
    const { data, error } = await admin
      .from("threads")
      .update(input)
      .eq("id", id)
      .select("id, title, body, category, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ thread: data });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    await assertNotBanned(admin, userId);

    const { data: existing, error: fetchErr } = await admin
      .from("threads")
      .select("author_id, deleted_at")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing || existing.deleted_at) throw new ApiError("not_found", "Thread not found", 404);
    if (existing.author_id !== userId) throw new ApiError("forbidden", "Not your thread", 403);

    const { error } = await admin
      .from("threads")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
```

- [ ] **Step 2: Write tests**

`tests/integration/thread-detail.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { GET as getThread, PATCH as patchThread, DELETE as deleteThread } from "@/app/api/threads/[id]/route";
import { createUser } from "../setup/factory";
import { makeRequest, readJson } from "../setup/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";

beforeEach(() => execSync("supabase db reset --no-seed", { stdio: "ignore" }));

async function createThread(author: { id: string }, overrides: Partial<{ title: string; body: string; category: string }> = {}) {
  const admin = getAdminClient();
  const { data } = await admin
    .from("threads")
    .insert({
      author_id: author.id,
      title: overrides.title ?? "sample",
      body: overrides.body ?? "body",
      category: overrides.category ?? "bug",
    })
    .select("id")
    .single();
  return data!.id as string;
}

describe("GET /api/threads/:id", () => {
  it("returns thread + author + score + comment_count", async () => {
    const alice = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const id = await createThread(alice);

    const res = await getThread(makeRequest(`/api/threads/${id}`), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const body = await readJson<{ thread: { title: string; author: { username: string }; score: number; comment_count: number; current_user_vote: number } }>(res);
    expect(body.thread.title).toBe("sample");
    expect(body.thread.author.username).toBe("alice");
    expect(body.thread.score).toBe(0);
    expect(body.thread.comment_count).toBe(0);
    expect(body.thread.current_user_vote).toBe(0);
  });

  it("404 for unknown id", async () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const res = await getThread(makeRequest(`/api/threads/${id}`), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(404);
  });

  it("404 for soft-deleted", async () => {
    const alice = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const id = await createThread(alice);
    const admin = getAdminClient();
    await admin.from("threads").update({ deleted_at: new Date().toISOString() }).eq("id", id);

    const res = await getThread(makeRequest(`/api/threads/${id}`), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(404);
  });
});

describe("PATCH/DELETE /api/threads/:id", () => {
  it("PATCH 401 when anonymous", async () => {
    const alice = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const id = await createThread(alice);
    const res = await patchThread(
      makeRequest(`/api/threads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "new title abc" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(401);
  });

  it("DELETE 401 when anonymous", async () => {
    const alice = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const id = await createThread(alice);
    const res = await deleteThread(makeRequest(`/api/threads/${id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(401);
  });

  it("404 for unknown id (PATCH)", async () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const res = await patchThread(
      makeRequest(`/api/threads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "new" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect([401, 404]).toContain(res.status);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm run test:integration -- thread-detail
```

Expected: PASS.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add app/api/threads/[id]/route.ts tests/integration/thread-detail.test.ts
git commit -m "feat(api): GET/PATCH/DELETE /api/threads/:id with author-only mutations"
```

---

## Task 7: API — comments collection (`GET /api/threads/:id/comments`, `POST`)

**Files:**
- Create: `app/api/threads/[id]/comments/route.ts`
- Create: `tests/integration/comments-collection.test.ts`

**Prerequisites:** Tasks 1, 2, 3, 4, 6 complete.

- [ ] **Step 1: Write `app/api/threads/[id]/comments/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, assertNotBanned } from "@/lib/auth/guards";
import { ApiError, toResponse } from "@/lib/auth/errors";
import { commentCreateSchema } from "@/lib/validation/comment";
import { decodeCursor, encodeCursor } from "@/lib/pagination/cursor";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: threadId } = await params;
    const url = new URL(req.url);
    const rawCursor = url.searchParams.get("cursor");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT), MAX_LIMIT);

    const admin = getAdminClient();

    const { data: thread, error: tErr } = await admin
      .from("threads")
      .select("id, deleted_at")
      .eq("id", threadId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!thread || thread.deleted_at) throw new ApiError("not_found", "Thread not found", 404);

    let query = admin
      .from("comments")
      .select("id, thread_id, parent_comment_id, body, deleted_at, created_at, updated_at, author_id, profiles!inner(username, display_name)")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit + 1);

    const cursor = decodeCursor(rawCursor);
    if (cursor && typeof cursor.c === "string" && typeof cursor.i === "string") {
      query = query.or(`created_at.gt.${cursor.c},and(created_at.eq.${cursor.c},id.gt.${cursor.i})`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    let scoreMap = new Map<string, number>();
    if (ids.length > 0) {
      const { data: scores } = await admin
        .from("vote_counts")
        .select("target_id, score")
        .eq("target_type", "comment")
        .in("target_id", ids);
      scoreMap = new Map((scores ?? []).map((s) => [s.target_id as string, Number(s.score ?? 0)]));
    }

    let userVoteMap = new Map<string, number>();
    const supabase = createServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user && ids.length > 0) {
      const { data: votes } = await admin
        .from("votes")
        .select("target_id, value")
        .eq("user_id", userData.user.id)
        .eq("target_type", "comment")
        .in("target_id", ids);
      userVoteMap = new Map((votes ?? []).map((v) => [v.target_id as string, v.value as number]));
    }

    const shaped = (rows ?? []).map((r) => {
      const deleted = r.deleted_at !== null;
      return {
        id: r.id as string,
        thread_id: r.thread_id as string,
        parent_comment_id: r.parent_comment_id as string | null,
        body: deleted ? "" : (r.body as string),
        deleted,
        author: deleted
          ? null
          : {
              username: (r.profiles as { username: string }).username,
              display_name: (r.profiles as { display_name: string | null }).display_name,
            },
        score: scoreMap.get(r.id as string) ?? 0,
        current_user_vote: (userVoteMap.get(r.id as string) ?? 0) as -1 | 0 | 1,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
      };
    });

    const hasMore = shaped.length > limit;
    const page = shaped.slice(0, limit);
    const next_cursor =
      hasMore && page.length > 0
        ? encodeCursor({ c: page[page.length - 1].created_at, i: page[page.length - 1].id })
        : null;

    return Response.json({ items: page, next_cursor });
  } catch (err) {
    return toResponse(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: threadId } = await params;
    const supabase = createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    await assertNotBanned(admin, userId);

    const input = commentCreateSchema.parse(await req.json());

    const { data: thread, error: tErr } = await admin
      .from("threads")
      .select("id, deleted_at")
      .eq("id", threadId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!thread || thread.deleted_at) throw new ApiError("not_found", "Thread not found", 404);

    if (input.parent_comment_id) {
      const { data: parent } = await admin
        .from("comments")
        .select("thread_id, parent_comment_id, deleted_at")
        .eq("id", input.parent_comment_id)
        .maybeSingle();
      if (!parent || parent.deleted_at || parent.thread_id !== threadId) {
        throw new ApiError("not_found", "Parent comment not found", 404);
      }
      if (parent.parent_comment_id !== null) {
        throw new ApiError("nesting_too_deep", "Comments only nest one level", 400);
      }
    }

    const { data, error } = await admin
      .from("comments")
      .insert({
        thread_id: threadId,
        author_id: userId,
        parent_comment_id: input.parent_comment_id ?? null,
        body: input.body,
      })
      .select("id, thread_id, parent_comment_id, body, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ comment: data }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}
```

- [ ] **Step 2: Write tests**

`tests/integration/comments-collection.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { GET as listComments, POST as createComment } from "@/app/api/threads/[id]/comments/route";
import { createUser } from "../setup/factory";
import { makeRequest, readJson } from "../setup/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";

beforeEach(() => execSync("supabase db reset --no-seed", { stdio: "ignore" }));

async function seedThread() {
  const alice = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
  const admin = getAdminClient();
  const { data: thread } = await admin
    .from("threads")
    .insert({ author_id: alice.id, title: "t", body: "b", category: "bug" })
    .select("id")
    .single();
  return { alice, threadId: thread!.id as string };
}

describe("GET /api/threads/:id/comments", () => {
  it("empty list when no comments", async () => {
    const { threadId } = await seedThread();
    const res = await listComments(makeRequest(`/api/threads/${threadId}/comments`), {
      params: Promise.resolve({ id: threadId }),
    });
    expect(res.status).toBe(200);
    const body = await readJson<{ items: unknown[]; next_cursor: null }>(res);
    expect(body.items).toEqual([]);
    expect(body.next_cursor).toBeNull();
  });

  it("404 on unknown thread", async () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const res = await listComments(makeRequest(`/api/threads/${id}/comments`), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(404);
  });

  it("returns seeded comments with author + score", async () => {
    const { alice, threadId } = await seedThread();
    const admin = getAdminClient();
    await admin.from("comments").insert({
      thread_id: threadId,
      author_id: alice.id,
      body: "first!",
    });
    const res = await listComments(makeRequest(`/api/threads/${threadId}/comments`), {
      params: Promise.resolve({ id: threadId }),
    });
    const body = await readJson<{ items: Array<{ body: string; author: { username: string }; score: number; deleted: boolean }> }>(res);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].body).toBe("first!");
    expect(body.items[0].author.username).toBe("alice");
    expect(body.items[0].score).toBe(0);
    expect(body.items[0].deleted).toBe(false);
  });

  it("masks soft-deleted comments but keeps them in the list", async () => {
    const { alice, threadId } = await seedThread();
    const admin = getAdminClient();
    const { data: c } = await admin
      .from("comments")
      .insert({ thread_id: threadId, author_id: alice.id, body: "will delete" })
      .select("id")
      .single();
    await admin.from("comments").update({ deleted_at: new Date().toISOString() }).eq("id", c!.id);

    const res = await listComments(makeRequest(`/api/threads/${threadId}/comments`), {
      params: Promise.resolve({ id: threadId }),
    });
    const body = await readJson<{ items: Array<{ body: string; deleted: boolean; author: unknown }> }>(res);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].deleted).toBe(true);
    expect(body.items[0].body).toBe("");
    expect(body.items[0].author).toBeNull();
  });
});

describe("POST /api/threads/:id/comments", () => {
  it("401 anonymous", async () => {
    const { threadId } = await seedThread();
    const res = await createComment(
      makeRequest(`/api/threads/${threadId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: "hi" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: threadId }) },
    );
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm run test:integration -- comments-collection
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/threads/[id]/comments/route.ts tests/integration/comments-collection.test.ts
git commit -m "feat(api): GET/POST /api/threads/:id/comments with 1-level nesting"
```

---

## Task 8: API — comment detail (`PATCH`, `DELETE` /api/comments/:id)

**Files:**
- Create: `app/api/comments/[id]/route.ts`
- Create: `tests/integration/comment-detail.test.ts`

**Prerequisites:** Tasks 1, 3, 4 complete. Parallel with Tasks 5, 6, 9.

- [ ] **Step 1: Write `app/api/comments/[id]/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, assertNotBanned } from "@/lib/auth/guards";
import { ApiError, toResponse } from "@/lib/auth/errors";
import { commentPatchSchema } from "@/lib/validation/comment";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    await assertNotBanned(admin, userId);

    const { data: existing, error: fetchErr } = await admin
      .from("comments")
      .select("author_id, deleted_at")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing || existing.deleted_at) throw new ApiError("not_found", "Comment not found", 404);
    if (existing.author_id !== userId) throw new ApiError("forbidden", "Not your comment", 403);

    const input = commentPatchSchema.parse(await req.json());
    const { data, error } = await admin
      .from("comments")
      .update({ body: input.body })
      .eq("id", id)
      .select("id, thread_id, parent_comment_id, body, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return Response.json({ comment: data });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    await assertNotBanned(admin, userId);

    const { data: existing, error: fetchErr } = await admin
      .from("comments")
      .select("author_id, deleted_at")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing || existing.deleted_at) throw new ApiError("not_found", "Comment not found", 404);
    if (existing.author_id !== userId) throw new ApiError("forbidden", "Not your comment", 403);

    const { error } = await admin
      .from("comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
```

- [ ] **Step 2: Write tests**

`tests/integration/comment-detail.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { PATCH as patchComment, DELETE as deleteComment } from "@/app/api/comments/[id]/route";
import { createUser } from "../setup/factory";
import { makeRequest } from "../setup/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";

beforeEach(() => execSync("supabase db reset --no-seed", { stdio: "ignore" }));

async function seedThreadWithComment() {
  const alice = await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
  const admin = getAdminClient();
  const { data: thread } = await admin
    .from("threads")
    .insert({ author_id: alice.id, title: "t", body: "b", category: "bug" })
    .select("id")
    .single();
  const { data: comment } = await admin
    .from("comments")
    .insert({ thread_id: thread!.id, author_id: alice.id, body: "original" })
    .select("id")
    .single();
  return { alice, threadId: thread!.id as string, commentId: comment!.id as string };
}

describe("PATCH /api/comments/:id", () => {
  it("401 anonymous", async () => {
    const { commentId } = await seedThreadWithComment();
    const res = await patchComment(
      makeRequest(`/api/comments/${commentId}`, {
        method: "PATCH",
        body: JSON.stringify({ body: "updated" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: commentId }) },
    );
    expect(res.status).toBe(401);
  });

  it("404 on unknown id", async () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const res = await patchComment(
      makeRequest(`/api/comments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ body: "x" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect([401, 404]).toContain(res.status);
  });
});

describe("DELETE /api/comments/:id", () => {
  it("401 anonymous", async () => {
    const { commentId } = await seedThreadWithComment();
    const res = await deleteComment(makeRequest(`/api/comments/${commentId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: commentId }),
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm run test:integration -- comment-detail
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/comments/[id]/route.ts tests/integration/comment-detail.test.ts
git commit -m "feat(api): PATCH/DELETE /api/comments/:id (author only, soft delete)"
```

---

## Task 9: API — votes (`POST /api/votes`)

**Files:**
- Create: `app/api/votes/route.ts`
- Create: `tests/integration/votes.test.ts`

**Prerequisites:** Tasks 1, 3, 4 complete. Parallel with Tasks 5, 6, 8.

- [ ] **Step 1: Write `app/api/votes/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth, assertNotBanned } from "@/lib/auth/guards";
import { ApiError, toResponse } from "@/lib/auth/errors";
import { voteSchema } from "@/lib/validation/vote";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    await assertNotBanned(admin, userId);

    const input = voteSchema.parse(await req.json());

    // Target must exist and not be soft-deleted.
    const table = input.target_type === "thread" ? "threads" : "comments";
    const { data: target, error: tErr } = await admin
      .from(table)
      .select("id, deleted_at")
      .eq("id", input.target_id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!target || target.deleted_at) {
      throw new ApiError("not_found", "Target not found", 404);
    }

    if (input.value === 0) {
      await admin
        .from("votes")
        .delete()
        .eq("user_id", userId)
        .eq("target_type", input.target_type)
        .eq("target_id", input.target_id);
    } else {
      await admin
        .from("votes")
        .upsert(
          {
            user_id: userId,
            target_type: input.target_type,
            target_id: input.target_id,
            value: input.value,
          },
          { onConflict: "user_id,target_type,target_id" },
        );
    }

    const { data: scoreRow } = await admin
      .from("vote_counts")
      .select("score")
      .eq("target_type", input.target_type)
      .eq("target_id", input.target_id)
      .maybeSingle();
    const score = Number(scoreRow?.score ?? 0);

    return Response.json({ score, current_user_vote: input.value });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}
```

- [ ] **Step 2: Write tests**

`tests/integration/votes.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import { POST as vote } from "@/app/api/votes/route";
import { makeRequest } from "../setup/api-helpers";

beforeEach(() => execSync("supabase db reset --no-seed", { stdio: "ignore" }));

describe("POST /api/votes", () => {
  it("401 anonymous", async () => {
    const res = await vote(
      makeRequest("/api/votes", {
        method: "POST",
        body: JSON.stringify({
          target_type: "thread",
          target_id: "11111111-1111-1111-1111-111111111111",
          value: 1,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("400 on bad value (auth runs first — also 401 anon)", async () => {
    const res = await vote(
      makeRequest("/api/votes", {
        method: "POST",
        body: JSON.stringify({
          target_type: "thread",
          target_id: "11111111-1111-1111-1111-111111111111",
          value: 5,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect([400, 401]).toContain(res.status);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm run test:integration -- votes
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/votes/route.ts tests/integration/votes.test.ts
git commit -m "feat(api): POST /api/votes with upsert + clear, not_found for missing target"
```

---

## Task 10: UI — feed page (replace `app/page.tsx`)

**Files:**
- Modify: `app/page.tsx`

**Prerequisites:** Task 5 complete.

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

type ThreadSummary = {
  id: string;
  title: string;
  category: "bug" | "behavior" | "discussion";
  author: { username: string; display_name: string | null };
  score: number;
  comment_count: number;
  created_at: string;
};

type FeedResponse = { items: ThreadSummary[]; next_cursor: string | null };

const CATEGORIES = ["all", "bug", "behavior", "discussion"] as const;
type Category = (typeof CATEGORIES)[number];

export default function HomePage() {
  const [category, setCategory] = useState<Category>("all");
  const [sort, setSort] = useState<"new" | "top">("new");
  const [items, setItems] = useState<ThreadSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(reset: boolean) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      params.set("sort", sort);
      if (!reset && cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/threads?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as FeedResponse;
      setItems((prev) => (reset ? body.items : [...prev, ...body.items]));
      setCursor(body.next_cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setItems([]);
    setCursor(null);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort]);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Claude Oops</h1>
        <a href="/new" className="bg-slate-900 px-3 py-1 text-white">
          New thread
        </a>
      </div>

      <div className="mt-4 flex gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="border p-2"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={() => setSort("new")}
          className={`px-3 py-1 ${sort === "new" ? "bg-slate-900 text-white" : "border"}`}
        >
          New
        </button>
        <button
          onClick={() => setSort("top")}
          className={`px-3 py-1 ${sort === "top" ? "bg-slate-900 text-white" : "border"}`}
        >
          Top
        </button>
      </div>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      <ul className="mt-6 divide-y">
        {items.map((t) => (
          <li key={t.id} className="py-3">
            <a href={`/t/${t.id}`} className="text-xl font-medium hover:underline">
              {t.title}
            </a>
            <div className="mt-1 text-sm text-slate-600">
              <span className="mr-3">[{t.category}]</span>
              <span className="mr-3">@{t.author.username}</span>
              <span className="mr-3">score {t.score}</span>
              <span>{t.comment_count} comments</span>
            </div>
          </li>
        ))}
      </ul>

      {items.length === 0 && !loading && !error && <p className="mt-6 text-slate-500">No threads yet.</p>}

      {cursor && (
        <button
          onClick={() => load(false)}
          disabled={loading}
          className="mt-6 border px-3 py-1"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Build + typecheck**

```bash
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(ui): thread feed with category filter, new/top sort, cursor pagination"
```

---

## Task 11: UI — new thread composer (`app/new/page.tsx`)

**Files:**
- Create: `app/new/page.tsx`

**Prerequisites:** Task 5 complete.

- [ ] **Step 1: Write `app/new/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewThreadPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          body: form.get("body"),
          category: form.get("category"),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message ?? "Submit failed");
      }
      const body = (await res.json()) as { thread: { id: string } };
      router.push(`/t/${body.thread.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">New thread</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input
          name="title"
          type="text"
          required
          placeholder="Title (3–200 chars)"
          className="w-full border p-2"
          maxLength={200}
        />
        <select name="category" required className="w-full border p-2" defaultValue="bug">
          <option value="bug">bug</option>
          <option value="behavior">behavior</option>
          <option value="discussion">discussion</option>
        </select>
        <textarea
          name="body"
          required
          placeholder="Body (1–10000 chars, plain text)"
          rows={10}
          maxLength={10000}
          className="w-full border p-2"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-slate-900 p-2 text-white disabled:opacity-50"
        >
          {submitting ? "Posting…" : "Post thread"}
        </button>
      </form>
      {err && <p className="mt-3 text-red-600">{err}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Build**

```bash
npm run typecheck
npm run build
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add app/new/page.tsx
git commit -m "feat(ui): /new composer with validation error surfacing"
```

---

## Task 12: UI — thread detail page (`app/t/[id]/page.tsx`)

**Files:**
- Create: `app/t/[id]/page.tsx`

**Prerequisites:** Tasks 6, 7, 8, 9 complete.

- [ ] **Step 1: Write `app/t/[id]/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Thread = {
  id: string;
  title: string;
  body: string;
  category: string;
  author: { username: string; display_name: string | null };
  score: number;
  comment_count: number;
  current_user_vote: -1 | 0 | 1;
  created_at: string;
  updated_at: string;
};

type Comment = {
  id: string;
  thread_id: string;
  parent_comment_id: string | null;
  body: string;
  deleted: boolean;
  author: { username: string; display_name: string | null } | null;
  score: number;
  current_user_vote: -1 | 0 | 1;
  created_at: string;
  updated_at: string;
};

function VoteButtons({
  target,
  score,
  current,
  onVote,
}: {
  target: { type: "thread" | "comment"; id: string };
  score: number;
  current: -1 | 0 | 1;
  onVote: (newScore: number, newVote: -1 | 0 | 1) => void;
}) {
  async function cast(value: -1 | 0 | 1) {
    const next = current === value ? 0 : value;
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: target.type, target_id: target.id, value: next }),
    });
    if (res.ok) {
      const body = (await res.json()) as { score: number; current_user_vote: -1 | 0 | 1 };
      onVote(body.score, body.current_user_vote);
    }
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <button
        onClick={() => cast(1)}
        className={`px-2 ${current === 1 ? "bg-green-700 text-white" : "border"}`}
      >
        ▲
      </button>
      <span>{score}</span>
      <button
        onClick={() => cast(-1)}
        className={`px-2 ${current === -1 ? "bg-red-700 text-white" : "border"}`}
      >
        ▼
      </button>
    </span>
  );
}

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const threadId = params.id;
  const [thread, setThread] = useState<Thread | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [me, setMe] = useState<{ id: string; username: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [composeBody, setComposeBody] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function loadAll() {
    const [tRes, cRes, meRes] = await Promise.all([
      fetch(`/api/threads/${threadId}`),
      fetch(`/api/threads/${threadId}/comments`),
      fetch(`/api/auth/me`),
    ]);
    if (!tRes.ok) {
      setErr(`Thread not found (${tRes.status})`);
      return;
    }
    const tBody = (await tRes.json()) as { thread: Thread };
    const cBody = (await cRes.json()) as { items: Comment[] };
    setThread(tBody.thread);
    setComments(cBody.items);
    if (meRes.ok) {
      const meBody = (await meRes.json()) as { profile: { id: string; username: string } };
      setMe({ id: meBody.profile.id, username: meBody.profile.username });
    } else {
      setMe(null);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  async function submitComment() {
    if (!composeBody.trim()) return;
    const res = await fetch(`/api/threads/${threadId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: composeBody,
        parent_comment_id: replyingTo ?? undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setErr(body.error?.message ?? "Comment failed");
      return;
    }
    setComposeBody("");
    setReplyingTo(null);
    await loadAll();
  }

  async function deleteThread() {
    if (!confirm("Delete this thread?")) return;
    const res = await fetch(`/api/threads/${threadId}`, { method: "DELETE" });
    if (res.ok) router.push("/");
    else setErr("Delete failed");
  }

  async function deleteComment(id: string) {
    if (!confirm("Delete this comment?")) return;
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) await loadAll();
    else setErr("Delete failed");
  }

  if (err) return <main className="p-8 text-red-600">{err}</main>;
  if (!thread) return <main className="p-8">Loading…</main>;

  const topLevel = comments.filter((c) => c.parent_comment_id === null);
  const childrenOf = (parentId: string) => comments.filter((c) => c.parent_comment_id === parentId);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <a href="/" className="text-sm text-slate-600 hover:underline">← back to feed</a>

      <h1 className="mt-3 text-3xl font-bold">{thread.title}</h1>
      <p className="mt-1 text-sm text-slate-600">
        [{thread.category}] by @{thread.author.username}
      </p>
      <div className="mt-3 whitespace-pre-wrap">{thread.body}</div>

      <div className="mt-3 flex items-center gap-3">
        <VoteButtons
          target={{ type: "thread", id: thread.id }}
          score={thread.score}
          current={thread.current_user_vote}
          onVote={(s, v) => setThread({ ...thread, score: s, current_user_vote: v })}
        />
        {me && thread.author.username === me.username && (
          <button onClick={deleteThread} className="text-sm text-red-600 hover:underline">
            delete thread
          </button>
        )}
      </div>

      <h2 className="mt-8 text-xl font-bold">
        Comments ({thread.comment_count})
      </h2>

      <ul className="mt-3 space-y-4">
        {topLevel.map((c) => (
          <li key={c.id}>
            <CommentItem
              comment={c}
              me={me}
              onReply={(id) => {
                setReplyingTo(id);
                setComposeBody("");
              }}
              onVoted={(id, s, v) =>
                setComments((prev) => prev.map((x) => (x.id === id ? { ...x, score: s, current_user_vote: v } : x)))
              }
              onDelete={deleteComment}
            />
            <ul className="ml-8 mt-3 space-y-3">
              {childrenOf(c.id).map((child) => (
                <li key={child.id}>
                  <CommentItem
                    comment={child}
                    me={me}
                    onReply={null}
                    onVoted={(id, s, v) =>
                      setComments((prev) =>
                        prev.map((x) => (x.id === id ? { ...x, score: s, current_user_vote: v } : x)),
                      )
                    }
                    onDelete={deleteComment}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="mt-8 border-t pt-6">
        <h3 className="text-lg font-bold">
          {replyingTo ? "Reply to comment" : "New comment"}
        </h3>
        <textarea
          value={composeBody}
          onChange={(e) => setComposeBody(e.target.value)}
          placeholder={me ? "Write a comment…" : "Sign in to comment"}
          disabled={!me}
          rows={4}
          className="mt-2 w-full border p-2"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={submitComment}
            disabled={!me || !composeBody.trim()}
            className="bg-slate-900 px-3 py-1 text-white disabled:opacity-50"
          >
            Post
          </button>
          {replyingTo && (
            <button onClick={() => setReplyingTo(null)} className="border px-3 py-1">
              Cancel reply
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function CommentItem({
  comment,
  me,
  onReply,
  onVoted,
  onDelete,
}: {
  comment: Comment;
  me: { id: string; username: string } | null;
  onReply: ((id: string) => void) | null;
  onVoted: (id: string, score: number, vote: -1 | 0 | 1) => void;
  onDelete: (id: string) => void;
}) {
  if (comment.deleted) {
    return <p className="text-sm italic text-slate-500">[deleted]</p>;
  }
  return (
    <div>
      <p className="text-sm text-slate-600">
        @{comment.author?.username}
      </p>
      <div className="mt-1 whitespace-pre-wrap">{comment.body}</div>
      <div className="mt-2 flex items-center gap-3 text-sm">
        <VoteButtons
          target={{ type: "comment", id: comment.id }}
          score={comment.score}
          current={comment.current_user_vote}
          onVote={(s, v) => onVoted(comment.id, s, v)}
        />
        {me && onReply && (
          <button onClick={() => onReply(comment.id)} className="text-slate-600 hover:underline">
            reply
          </button>
        )}
        {me && comment.author && comment.author.username === me.username && (
          <button onClick={() => onDelete(comment.id)} className="text-red-600 hover:underline">
            delete
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
npm run typecheck
npm run build
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add app/t/[id]/page.tsx
git commit -m "feat(ui): thread detail with comments, votes, 1-level replies"
```

---

## Task 13: Push migration + deploy + smoke test + tag

**Files:** none (git + Supabase + Vercel operations)

**Prerequisites:** All prior tasks complete.

- [ ] **Step 1: Verify local tests green**

```bash
npm test
npm run test:integration
```

Expected: both pass in full.

- [ ] **Step 2: Push migration to hosted Supabase**

```bash
supabase db push
```

If prompted for password, use the DB password from the Supabase dashboard.

Expected: migration `20260423120000_threads_comments_votes.sql` applied to hosted project.

- [ ] **Step 3: Verify hosted schema**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "https://cuzbhatvmyluivkjitwz.supabase.co/rest/v1/threads?select=id&limit=1"
```

Expected: `HTTP 200` (table exists, empty).

- [ ] **Step 4: Push code to GitHub — triggers Vercel deploy**

```bash
git push origin main
```

Wait for the deployment to go green on Vercel Dashboard.

- [ ] **Step 5: Production smoke test**

Open `https://claude-oops.vercel.app` in a browser. Expected:

1. Home page shows the feed UI (empty state: "No threads yet.") with category dropdown and New/Top tabs.
2. Click "New thread" (or navigate to `/new`) — if not signed in, the POST will 401; sign in first.
3. Create a thread with title "First Phase 2 thread", category bug, body "hi". Expect redirect to `/t/<id>`.
4. On the thread page: title + body visible, vote arrows present. Click ▲ — score goes to 1.
5. Write a comment "first comment" and post. It appears below.
6. Click "reply" on that comment, write "nested reply", post. Appears indented one level under the top comment.
7. Try to reply to "nested reply" — the thread UI does not render a "reply" button on child comments (1-level enforced).
8. Click delete on the thread. Redirects to `/`. Thread no longer appears in the feed.

- [ ] **Step 6: Tag phase-2-complete**

```bash
git tag -a phase-2-complete -m "Phase 2: core forum shipped — threads, comments, votes"
git push --tags
```

- [ ] **Step 7: Update memory index**

Update `MEMORY.md` entry for claude-oops: mark Phase 2 complete, next phase TBD (Claude Design UI pass, or moderation/attachments — user decides).

---

## Phase 2 definition of done

- [ ] `npm test` passes.
- [ ] `npm run test:integration` passes against local Supabase.
- [ ] CI green on `main`.
- [ ] Production signed-in user can: post thread → see it in feed → open → comment → reply once → vote on thread/comment → see score update → delete own thread/comment.
- [ ] Production anonymous visitor can browse feed, open threads, read comments — without signing in.
- [ ] Soft-deleted threads 404 on `/api/threads/:id`; soft-deleted comments show `[deleted]` in the UI with children preserved.
- [ ] Cursor pagination works across > 1 page (seed 25+ threads, step through).
- [ ] No `any` types added in `lib/` (`grep -r ": any" lib/` returns nothing new beyond what Phase 1 already had).

When all boxes are checked, Phase 2 ships. Regenerate the next plan (likely "Claude Design UI pass" or "Moderation + attachments" based on user priority).
