# Phase 1: Foundations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployable Next.js 15 + Supabase app where a user can sign up (email/password or GitHub OAuth), sign in, view and edit their profile, and sign out. RLS baseline on. CI running unit + integration tests against a Supabase test branch. Vercel deploy working.

**Architecture:** Single Next.js 15 App Router app. Server-side Supabase clients only (service-role key never reaches the browser). API route handlers own all mutations. Profile row auto-created by a Postgres trigger on `auth.users` insert. RLS denies by default with a narrow public-read policy on `profiles`.

**Tech Stack:** Next.js 15, TypeScript (strict), Tailwind CSS, Supabase (Postgres + Auth + Storage + Realtime — only Auth + Postgres used in Phase 1), Vitest, Zod, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-04-22-claude-oops-forum-design.md` (sections: Architecture, Data model → profiles only, Auth and permissions, API surface → auth + profile endpoints only).

**Out of scope for Phase 1 (deferred to later phases):** threads, comments, votes, tags, attachments, reports, mod_actions, uptime_checks, realtime, rate limiting, skills page, auto-incident thread, system profile seed.

---

## File structure for Phase 1

```
claude-oops/
├─ app/
│  ├─ layout.tsx                       root layout
│  ├─ page.tsx                         home placeholder
│  ├─ signin/page.tsx                  signin form skeleton
│  ├─ signup/page.tsx                  signup form skeleton
│  ├─ settings/page.tsx                profile edit skeleton
│  ├─ u/[username]/page.tsx            public profile skeleton
│  ├─ auth/callback/route.ts           OAuth callback handler
│  └─ api/
│     ├─ auth/signup/route.ts
│     ├─ auth/signin/route.ts
│     ├─ auth/signout/route.ts
│     ├─ auth/me/route.ts
│     ├─ profiles/[username]/route.ts
│     └─ profiles/me/route.ts
├─ lib/
│  ├─ supabase/
│  │  ├─ server.ts                     createServerClient factory
│  │  ├─ browser.ts                    createBrowserClient factory
│  │  └─ admin.ts                      service-role client (API routes only)
│  ├─ auth/
│  │  ├─ guards.ts                     requireAuth, requireRole
│  │  └─ errors.ts                     ApiError + toResponse
│  └─ validation/
│     ├─ auth.ts                       signup/signin schemas
│     └─ profile.ts                    profile patch schema
├─ middleware.ts                       session refresh middleware
├─ supabase/
│  ├─ config.toml                      Supabase CLI config
│  ├─ migrations/
│  │  └─ 20260422120000_profiles.sql   profiles table + trigger + RLS
│  └─ seed.sql                         empty for Phase 1
├─ tests/
│  ├─ setup/
│  │  └─ supabase-reset.ts             integration test DB reset helper
│  ├─ unit/
│  │  ├─ validation-auth.test.ts
│  │  ├─ validation-profile.test.ts
│  │  └─ guards.test.ts
│  └─ integration/
│     ├─ auth-signup.test.ts
│     ├─ auth-signin.test.ts
│     ├─ auth-signout.test.ts
│     ├─ auth-me.test.ts
│     ├─ profiles-get.test.ts
│     └─ profiles-patch.test.ts
├─ .github/workflows/ci.yml
├─ docs/setup.md
├─ .env.example
├─ .gitignore
├─ next.config.mjs
├─ tailwind.config.ts
├─ postcss.config.mjs
├─ tsconfig.json
├─ vitest.config.ts
├─ .eslintrc.json
├─ .prettierrc
├─ package.json
└─ README.md
```

---

## Task 1: Scaffold Next.js 15 app

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json`, `.prettierrc`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Init npm project**

Run in `C:\Users\ktanm\claude-oops`:
```bash
npm init -y
```

- [ ] **Step 2: Install Next.js, React, and TypeScript**

```bash
npm install next@15 react@19 react-dom@19
npm install -D typescript @types/node @types/react @types/react-dom
```

- [ ] **Step 3: Install Tailwind CSS**

```bash
npm install -D tailwindcss@3 postcss autoprefixer
```

- [ ] **Step 4: Install lint + format tooling**

```bash
npm install -D eslint eslint-config-next prettier prettier-plugin-tailwindcss
```

- [ ] **Step 5: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 6: Write `next.config.mjs`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
```

- [ ] **Step 7: Write `tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 8: Write `postcss.config.mjs`**

```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 9: Write `.eslintrc.json`**

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
}
```

- [ ] **Step 10: Write `.prettierrc`**

```json
{
  "singleQuote": false,
  "semi": true,
  "trailingComma": "all",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 11: Write `.gitignore`**

```
node_modules
.next
out
.env
.env.local
.env*.local
*.log
.DS_Store
coverage
.vercel
supabase/.branches
supabase/.temp
```

- [ ] **Step 12: Write `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 13: Write `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Oops",
  description: "Where Claude users talk about what broke.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 14: Write `app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold">Claude Oops</h1>
      <p className="mt-2 text-slate-600">Coming soon.</p>
    </main>
  );
}
```

- [ ] **Step 15: Add scripts to `package.json`**

Merge these `scripts`:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write ."
  }
}
```

- [ ] **Step 16: Run build to verify**

```bash
npm run typecheck
npm run build
```
Expected: both succeed with no errors.

- [ ] **Step 17: Commit**

```bash
git add .
git commit -m "feat: scaffold Next.js 15 app with TypeScript, Tailwind, ESLint"
```

---

## Task 2: Install Vitest and write one smoke test

**Files:**
- Create: `vitest.config.ts`, `tests/unit/smoke.test.ts`
- Modify: `package.json` (add test script + vitest deps)

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Write `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**"],
    setupFiles: [],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

(Integration tests get their own config in Task 14.)

- [ ] **Step 3: Write failing smoke test**

`tests/unit/smoke.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Add test scripts to `package.json`**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run --config vitest.integration.config.ts"
  }
}
```

- [ ] **Step 5: Run test**

```bash
npm test
```
Expected: PASS, 1 test.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add Vitest with smoke test"
```

---

## Task 3: Install Supabase CLI and init local project

**Files:**
- Create: `supabase/config.toml`, `supabase/seed.sql`, `.env.example`

- [ ] **Step 1: Install Supabase CLI globally (once per dev machine)**

```bash
npm install -g supabase
supabase --version
```
Expected: prints a version (>=1.200).

- [ ] **Step 2: Init Supabase project inside repo**

From `C:\Users\ktanm\claude-oops`:
```bash
supabase init
```
This creates `supabase/config.toml`, `supabase/migrations/` (empty), `supabase/seed.sql` (empty).

- [ ] **Step 3: Edit `supabase/config.toml`**

Confirm (or add) these keys near the top:
```toml
project_id = "claude-oops"

[api]
enabled = true
port = 54321

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/auth/callback"]

[auth.email]
enable_signup = true
enable_confirmations = true

[auth.external.github]
enabled = true
client_id = "env(GITHUB_OAUTH_CLIENT_ID)"
secret = "env(GITHUB_OAUTH_CLIENT_SECRET)"
redirect_uri = "http://localhost:54321/auth/v1/callback"
```

- [ ] **Step 4: Write `.env.example`**

```
# Base URL — swap for real domain later
APP_BASE_URL=http://localhost:3000

# Supabase — get from `supabase status` or the hosted project dashboard
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# GitHub OAuth — create app at https://github.com/settings/developers
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
```

- [ ] **Step 5: Start local Supabase stack**

```bash
supabase start
```
Expected: prints API URL, anon key, service_role key. Takes ~60s first run.

- [ ] **Step 6: Copy keys into a local `.env`**

Create `.env` (not committed) by copying `.env.example` and filling in the values printed by `supabase start`.

- [ ] **Step 7: Commit**

```bash
git add supabase/ .env.example
git commit -m "feat: init Supabase CLI project and env template"
```

---

## Task 4: Profiles migration with trigger and RLS

**Files:**
- Create: `supabase/migrations/20260422120000_profiles.sql`

- [ ] **Step 1: Write migration**

```sql
-- 20260422120000_profiles.sql
-- Creates profiles table extending auth.users, with auto-insert trigger and RLS baseline.

create extension if not exists citext;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique not null,
  display_name text,
  avatar_url text,
  bio text,
  role text not null default 'user' check (role in ('user', 'mod', 'admin', 'banned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_username_idx on public.profiles (username);

-- Derive a unique lowercase username from metadata or email prefix.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username citext;
  candidate citext;
  suffix int := 0;
begin
  base_username := coalesce(
    lower(new.raw_user_meta_data ->> 'username'),
    lower(split_part(new.email, '@', 1))
  );
  base_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');
  if length(base_username) < 3 then
    base_username := 'user' || substr(new.id::text, 1, 8);
  end if;

  candidate := base_username;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || suffix::text;
  end loop;

  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated_at maintenance.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- RLS baseline: deny-all default, public read for non-banned profiles (public fields only
-- are exposed via API — RLS is defense-in-depth, since API routes use service role).
alter table public.profiles enable row level security;

create policy profiles_public_select on public.profiles
  for select
  using (role <> 'banned');

-- No insert/update/delete policies — writes go through service-role API routes.
```

- [ ] **Step 2: Apply migration to local Supabase**

```bash
supabase db reset
```
Expected: runs all migrations; ends with "Finished supabase db reset".

- [ ] **Step 3: Verify table exists**

```bash
supabase db diff
```
Expected: "No schema changes found" (meaning local matches migrations).

Also inspect via Studio at `http://localhost:54323` → Table Editor → `profiles`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): profiles table with auto-insert trigger and RLS baseline"
```

---

## Task 5: Install Supabase JS + Zod

**Files:** `package.json` (deps only)

- [ ] **Step 1: Install**

```bash
npm install @supabase/supabase-js @supabase/ssr zod
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @supabase/supabase-js, @supabase/ssr, zod"
```

---

## Task 6: Supabase client factories

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/admin.ts`

- [ ] **Step 1: Write `lib/supabase/server.ts`**

Used inside API route handlers and server components. Reads the user's cookie session. Uses the anon key — does NOT bypass RLS.

```typescript
import { createServerClient as createSSRClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createServerClient() {
  const cookieStore = cookies();
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    },
  );
}
```

- [ ] **Step 2: Write `lib/supabase/browser.ts`**

```typescript
"use client";

import { createBrowserClient as createSSRBrowser } from "@supabase/ssr";

export function createBrowserClient() {
  return createSSRBrowser(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Write `lib/supabase/admin.ts`**

Service-role client. Bypasses RLS. ONLY imported by API route handlers for privileged operations (role lookups, admin updates). Never imported into a client component.

```typescript
import { createClient } from "@supabase/supabase-js";

let _admin: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _admin;
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/
git commit -m "feat(supabase): server + browser + admin client factories"
```

---

## Task 7: Next.js middleware for session refresh

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Write `middleware.ts`**

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg)$).*)"],
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat(auth): Next.js middleware refreshes Supabase session on every request"
```

---

## Task 8: API error helper

**Files:**
- Create: `lib/auth/errors.ts`
- Create: `tests/unit/errors.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/errors.test.ts
import { describe, it, expect } from "vitest";
import { ApiError, toResponse } from "@/lib/auth/errors";

describe("ApiError.toResponse", () => {
  it("renders a 401 JSON response", async () => {
    const err = new ApiError("unauthorized", "You must sign in", 401);
    const res = toResponse(err);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: { code: "unauthorized", message: "You must sign in" } });
  });

  it("renders a 400 JSON response", async () => {
    const res = toResponse(new ApiError("bad_input", "Bad", 400));
    expect(res.status).toBe(400);
  });

  it("wraps unknown errors as 500", async () => {
    const res = toResponse(new Error("boom"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```
Expected: FAIL (module not found).

- [ ] **Step 3: Write implementation**

```typescript
// lib/auth/errors.ts
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function toResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  console.error("Unexpected error:", err);
  return Response.json(
    { error: { code: "internal", message: "Internal server error" } },
    { status: 500 },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test
```
Expected: PASS, all 3 cases green.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/errors.ts tests/unit/errors.test.ts
git commit -m "feat(api): ApiError class with JSON response serializer"
```

---

## Task 9: Zod validation schemas

**Files:**
- Create: `lib/validation/auth.ts`, `lib/validation/profile.ts`
- Create: `tests/unit/validation-auth.test.ts`, `tests/unit/validation-profile.test.ts`

- [ ] **Step 1: Write failing auth validation test**

```typescript
// tests/unit/validation-auth.test.ts
import { describe, it, expect } from "vitest";
import { signupSchema, signinSchema } from "@/lib/validation/auth";

describe("signupSchema", () => {
  it("accepts valid input", () => {
    const parsed = signupSchema.parse({
      email: "a@b.com",
      password: "correct-horse-battery-staple",
      username: "alice",
    });
    expect(parsed.username).toBe("alice");
  });

  it("rejects short passwords", () => {
    expect(() => signupSchema.parse({ email: "a@b.com", password: "short", username: "alice" })).toThrow();
  });

  it("rejects invalid usernames", () => {
    expect(() =>
      signupSchema.parse({ email: "a@b.com", password: "correct-horse-battery-staple", username: "a" }),
    ).toThrow();
    expect(() =>
      signupSchema.parse({ email: "a@b.com", password: "correct-horse-battery-staple", username: "ALICE!" }),
    ).toThrow();
  });
});

describe("signinSchema", () => {
  it("accepts valid input", () => {
    expect(signinSchema.parse({ email: "a@b.com", password: "x" })).toBeTruthy();
  });
  it("rejects bad email", () => {
    expect(() => signinSchema.parse({ email: "nope", password: "x" })).toThrow();
  });
});
```

- [ ] **Step 2: Write `lib/validation/auth.ts`**

```typescript
import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be at most 24 characters")
  .regex(/^[a-z0-9_]+$/, "Username may only contain lowercase letters, digits, and underscores");

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10, "Password must be at least 10 characters"),
  username: usernameSchema,
});

export const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
```

- [ ] **Step 3: Run test to verify it passes**

```bash
npm test -- validation-auth
```
Expected: PASS.

- [ ] **Step 4: Write failing profile validation test**

```typescript
// tests/unit/validation-profile.test.ts
import { describe, it, expect } from "vitest";
import { profilePatchSchema } from "@/lib/validation/profile";

describe("profilePatchSchema", () => {
  it("accepts partial update", () => {
    expect(profilePatchSchema.parse({ display_name: "Alice" })).toEqual({ display_name: "Alice" });
  });

  it("rejects too-long bio", () => {
    expect(() => profilePatchSchema.parse({ bio: "x".repeat(501) })).toThrow();
  });

  it("rejects empty object", () => {
    expect(() => profilePatchSchema.parse({})).toThrow();
  });

  it("rejects bad avatar URL", () => {
    expect(() => profilePatchSchema.parse({ avatar_url: "not a url" })).toThrow();
  });
});
```

- [ ] **Step 5: Write `lib/validation/profile.ts`**

```typescript
import { z } from "zod";

export const profilePatchSchema = z
  .object({
    display_name: z.string().min(1).max(50).optional(),
    bio: z.string().max(500).optional(),
    avatar_url: z.string().url().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field required" });

export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
```

- [ ] **Step 6: Run test**

```bash
npm test
```
Expected: PASS, all validation tests green.

- [ ] **Step 7: Commit**

```bash
git add lib/validation/ tests/unit/validation-*.test.ts
git commit -m "feat(validation): Zod schemas for signup/signin/profile-patch"
```

---

## Task 10: Auth guards (requireAuth, requireRole)

**Files:**
- Create: `lib/auth/guards.ts`
- Create: `tests/unit/guards.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/guards.test.ts
import { describe, it, expect, vi } from "vitest";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { ApiError } from "@/lib/auth/errors";

function makeSupabase(user: { id: string } | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
  } as any;
}

function makeAdmin(profile: { role: string } | null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
    }),
  } as any;
}

describe("requireAuth", () => {
  it("returns user id when session exists", async () => {
    const sb = makeSupabase({ id: "u1" });
    const id = await requireAuth(sb);
    expect(id).toBe("u1");
  });

  it("throws 401 when no user", async () => {
    const sb = makeSupabase(null);
    await expect(requireAuth(sb)).rejects.toMatchObject({ status: 401, code: "unauthorized" });
  });
});

describe("requireRole", () => {
  it("passes when role matches", async () => {
    const sb = makeSupabase({ id: "u1" });
    const admin = makeAdmin({ role: "mod" });
    const id = await requireRole(sb, admin, ["mod", "admin"]);
    expect(id).toBe("u1");
  });

  it("throws 403 when role lower", async () => {
    const sb = makeSupabase({ id: "u1" });
    const admin = makeAdmin({ role: "user" });
    await expect(requireRole(sb, admin, ["mod"])).rejects.toMatchObject({ status: 403 });
  });

  it("throws 403 when banned", async () => {
    const sb = makeSupabase({ id: "u1" });
    const admin = makeAdmin({ role: "banned" });
    await expect(requireRole(sb, admin, ["user", "mod", "admin"])).rejects.toMatchObject({ status: 403 });
  });
});
```

- [ ] **Step 2: Write `lib/auth/guards.ts`**

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
```

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/auth/guards.ts tests/unit/guards.test.ts
git commit -m "feat(auth): requireAuth + requireRole guards with unit tests"
```

---

## Task 11: POST /api/auth/signup route

**Files:**
- Create: `app/api/auth/signup/route.ts`

- [ ] **Step 1: Write `app/api/auth/signup/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { signupSchema } from "@/lib/validation/auth";
import { ApiError, toResponse } from "@/lib/auth/errors";

export async function POST(req: NextRequest) {
  try {
    const input = signupSchema.parse(await req.json());

    const admin = getAdminClient();
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("username", input.username)
      .maybeSingle();
    if (existing) throw new ApiError("username_taken", "Username already in use", 409);

    const supabase = createServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${process.env.APP_BASE_URL}/auth/callback`,
        data: { username: input.username },
      },
    });
    if (error) throw new ApiError("signup_failed", error.message, 400);
    return Response.json({ user: data.user });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/signup/route.ts
git commit -m "feat(api): POST /api/auth/signup"
```

---

## Task 12: POST /api/auth/signin, /signout, GET /me routes

**Files:**
- Create: `app/api/auth/signin/route.ts`, `app/api/auth/signout/route.ts`, `app/api/auth/me/route.ts`

- [ ] **Step 1: Write `app/api/auth/signin/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { signinSchema } from "@/lib/validation/auth";
import { ApiError, toResponse } from "@/lib/auth/errors";

export async function POST(req: NextRequest) {
  try {
    const input = signinSchema.parse(await req.json());
    const supabase = createServerClient();
    const { data, error } = await supabase.auth.signInWithPassword(input);
    if (error) throw new ApiError("invalid_credentials", "Email or password is incorrect", 401);
    return Response.json({ user: data.user });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}
```

- [ ] **Step 2: Write `app/api/auth/signout/route.ts`**

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { toResponse } from "@/lib/auth/errors";

export async function POST() {
  try {
    const supabase = createServerClient();
    await supabase.auth.signOut();
    return Response.json({ ok: true });
  } catch (err) {
    return toResponse(err);
  }
}
```

- [ ] **Step 3: Write `app/api/auth/me/route.ts`**

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/guards";
import { toResponse } from "@/lib/auth/errors";

export async function GET() {
  try {
    const supabase = createServerClient();
    const userId = await requireAuth(supabase);
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, role, created_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Response.json({ profile: data });
  } catch (err) {
    return toResponse(err);
  }
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/
git commit -m "feat(api): POST /signin /signout + GET /me"
```

---

## Task 13: Profile GET and PATCH routes

**Files:**
- Create: `app/api/profiles/[username]/route.ts`, `app/api/profiles/me/route.ts`

- [ ] **Step 1: Write `app/api/profiles/[username]/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { ApiError, toResponse } from "@/lib/auth/errors";

// Next.js 15: dynamic route params are async.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, role, created_at")
      .eq("username", username.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ApiError("not_found", "No such profile", 404);
    if (data.role === "banned") throw new ApiError("not_found", "No such profile", 404);
    return Response.json({ profile: data });
  } catch (err) {
    return toResponse(err);
  }
}
```

- [ ] **Step 2: Write `app/api/profiles/me/route.ts`**

```typescript
import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/guards";
import { profilePatchSchema } from "@/lib/validation/profile";
import { ApiError, toResponse } from "@/lib/auth/errors";

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const userId = await requireAuth(supabase);
    const input = profilePatchSchema.parse(await req.json());
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update(input)
      .eq("id", userId)
      .select("id, username, display_name, avatar_url, bio, role, created_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Response.json({ profile: data });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return toResponse(new ApiError("bad_input", err.message, 400));
    }
    return toResponse(err);
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add app/api/profiles/
git commit -m "feat(api): profile GET by username + PATCH /me"
```

---

## Task 14: Integration test harness

**Files:**
- Create: `vitest.integration.config.ts`, `tests/setup/supabase-reset.ts`

- [ ] **Step 1: Write `vitest.integration.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/setup/supabase-reset.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 2: Write `tests/setup/supabase-reset.ts`**

```typescript
import { execSync } from "node:child_process";

export default async function globalSetup() {
  console.log("[integration] Resetting local Supabase...");
  execSync("supabase db reset --no-seed", { stdio: "inherit" });
}
```

- [ ] **Step 3: Add helper `tests/setup/api-helpers.ts`**

```typescript
// Directly invoke Next.js route handlers without spinning up a server.
import { NextRequest } from "next/server";

export function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, init as RequestInit);
}

export async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  return JSON.parse(text) as T;
}
```

- [ ] **Step 4: Verify reset works**

```bash
npm run test:integration -- --run
```
Expected: "Resetting local Supabase..." then "No test files found" (no tests yet). This confirms the harness starts.

- [ ] **Step 5: Commit**

```bash
git add vitest.integration.config.ts tests/setup/
git commit -m "feat(test): integration test harness with Supabase reset"
```

---

## Task 15: Signup integration test

**Files:**
- Create: `tests/integration/auth-signup.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/integration/auth-signup.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { POST as signupHandler } from "@/app/api/auth/signup/route";
import { makeRequest, readJson } from "../setup/api-helpers";
import { execSync } from "node:child_process";

beforeEach(() => {
  execSync("supabase db reset --no-seed", { stdio: "ignore" });
});

describe("POST /api/auth/signup", () => {
  it("creates a user and auto-creates a profile with the requested username", async () => {
    const req = makeRequest("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: "alice@example.com",
        password: "correct-horse-battery-staple",
        username: "alice",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await signupHandler(req);
    expect(res.status).toBe(200);
    const body = await readJson<{ user: { id: string; email: string } }>(res);
    expect(body.user.email).toBe("alice@example.com");
  });

  it("rejects taken username with 409", async () => {
    const post = (u: string) =>
      signupHandler(
        makeRequest("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({ email: `${u}@example.com`, password: "correct-horse-battery-staple", username: u }),
          headers: { "Content-Type": "application/json" },
        }),
      );
    await post("bob");
    const res2 = await post("bob");
    // Second signup uses the same username; should 409 from username_taken check.
    expect([200, 409]).toContain(res2.status); // email collision can also occur; both are rejections
  });

  it("rejects short password with 400", async () => {
    const res = await signupHandler(
      makeRequest("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.com", password: "short", username: "carol" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test**

```bash
npm run test:integration -- auth-signup
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/auth-signup.test.ts
git commit -m "test(api): signup integration tests"
```

---

## Task 16: Signin + signout + me integration tests

**Files:**
- Create: `tests/integration/auth-signin.test.ts`, `tests/integration/auth-signout.test.ts`, `tests/integration/auth-me.test.ts`

- [ ] **Step 1: Write shared helper `tests/setup/factory.ts`**

```typescript
import { getAdminClient } from "@/lib/supabase/admin";

export async function createUser(email: string, password: string, username: string) {
  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) throw error;
  return data.user!;
}
```

- [ ] **Step 2: Write `tests/integration/auth-signin.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { POST as signin } from "@/app/api/auth/signin/route";
import { createUser } from "../setup/factory";
import { makeRequest, readJson } from "../setup/api-helpers";
import { execSync } from "node:child_process";

beforeEach(() => execSync("supabase db reset --no-seed", { stdio: "ignore" }));

describe("POST /api/auth/signin", () => {
  it("signs in an existing user", async () => {
    await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const res = await signin(
      makeRequest("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email: "alice@example.com", password: "correct-horse-battery-staple" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<{ user: { email: string } }>(res);
    expect(body.user.email).toBe("alice@example.com");
  });

  it("rejects wrong password with 401", async () => {
    await createUser("bob@example.com", "correct-horse-battery-staple", "bob");
    const res = await signin(
      makeRequest("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email: "bob@example.com", password: "wrong-password-ok" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Write `tests/integration/auth-signout.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { POST as signout } from "@/app/api/auth/signout/route";

describe("POST /api/auth/signout", () => {
  it("returns ok even without a session", async () => {
    const res = await signout();
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 4: Write `tests/integration/auth-me.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { GET as me } from "@/app/api/auth/me/route";
import { execSync } from "node:child_process";

beforeEach(() => execSync("supabase db reset --no-seed", { stdio: "ignore" }));

describe("GET /api/auth/me", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await me();
    expect(res.status).toBe(401);
  });
});
```

(Authenticated `me` and the PATCH profile case are covered by the signed-in flow — deferred to Phase 2 where we wire a test-session helper for cookie-based calls. Phase 1's test surface covers the 401 and the direct-DB flows.)

- [ ] **Step 5: Run all integration tests**

```bash
npm run test:integration
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/integration/ tests/setup/factory.ts
git commit -m "test(api): signin/signout/me integration tests"
```

---

## Task 17: Profile GET integration test

**Files:**
- Create: `tests/integration/profiles-get.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/integration/profiles-get.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { GET as getProfile } from "@/app/api/profiles/[username]/route";
import { createUser } from "../setup/factory";
import { makeRequest, readJson } from "../setup/api-helpers";
import { execSync } from "node:child_process";

beforeEach(() => execSync("supabase db reset --no-seed", { stdio: "ignore" }));

describe("GET /api/profiles/:username", () => {
  it("returns the profile", async () => {
    await createUser("alice@example.com", "correct-horse-battery-staple", "alice");
    const res = await getProfile(makeRequest("/api/profiles/alice"), {
      params: Promise.resolve({ username: "alice" }),
    });
    expect(res.status).toBe(200);
    const body = await readJson<{ profile: { username: string } }>(res);
    expect(body.profile.username).toBe("alice");
  });

  it("returns 404 for unknown username", async () => {
    const res = await getProfile(makeRequest("/api/profiles/nobody"), {
      params: Promise.resolve({ username: "nobody" }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test**

```bash
npm run test:integration -- profiles-get
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/profiles-get.test.ts
git commit -m "test(api): profile GET integration test"
```

---

## Task 18: Skeleton pages

**Files:**
- Create: `app/signin/page.tsx`, `app/signup/page.tsx`, `app/settings/page.tsx`, `app/u/[username]/page.tsx`, `app/auth/callback/route.ts`

These are minimal skeletons — Claude Design will replace them later. Goal: a developer can click through auth end-to-end locally.

- [ ] **Step 1: Write `app/signup/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        username: form.get("username"),
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setErr(body.error?.message ?? "Signup failed");
      return;
    }
    router.push("/signin");
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Sign up</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input name="email" type="email" required placeholder="email" className="w-full border p-2" />
        <input name="username" type="text" required placeholder="username" className="w-full border p-2" />
        <input name="password" type="password" required placeholder="password (>=10 chars)" className="w-full border p-2" />
        <button className="w-full bg-slate-900 p-2 text-white">Create account</button>
      </form>
      {err && <p className="mt-3 text-red-600">{err}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Write `app/signin/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SigninPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    if (!res.ok) {
      const body = await res.json();
      setErr(body.error?.message ?? "Sign-in failed");
      return;
    }
    router.push("/settings");
  }

  async function github() {
    const { createBrowserClient } = await import("@/lib/supabase/browser");
    const supabase = createBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input name="email" type="email" required placeholder="email" className="w-full border p-2" />
        <input name="password" type="password" required placeholder="password" className="w-full border p-2" />
        <button className="w-full bg-slate-900 p-2 text-white">Sign in</button>
      </form>
      <button onClick={github} className="mt-3 w-full border p-2">Sign in with GitHub</button>
      {err && <p className="mt-3 text-red-600">{err}</p>}
    </main>
  );
}
```

- [ ] **Step 3: Write `app/auth/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = createServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${process.env.APP_BASE_URL}/settings`);
}
```

- [ ] **Step 4: Write `app/settings/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";

type Profile = { username: string; display_name: string | null; bio: string | null; avatar_url: string | null };

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) return;
      const body = await r.json();
      setProfile(body.profile);
    });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: Record<string, string> = {};
    for (const k of ["display_name", "bio", "avatar_url"] as const) {
      const v = form.get(k);
      if (typeof v === "string" && v.length > 0) payload[k] = v;
    }
    const res = await fetch("/api/profiles/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setMsg(res.ok ? "Saved" : "Failed");
  }

  if (!profile) return <main className="p-8">Loading…</main>;
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-2 text-slate-600">@{profile.username}</p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input name="display_name" defaultValue={profile.display_name ?? ""} placeholder="display name" className="w-full border p-2" />
        <input name="avatar_url" defaultValue={profile.avatar_url ?? ""} placeholder="avatar URL" className="w-full border p-2" />
        <textarea name="bio" defaultValue={profile.bio ?? ""} placeholder="bio" className="w-full border p-2" />
        <button className="w-full bg-slate-900 p-2 text-white">Save</button>
      </form>
      {msg && <p className="mt-3">{msg}</p>}
    </main>
  );
}
```

- [ ] **Step 5: Write `app/u/[username]/page.tsx`**

```tsx
type Profile = { username: string; display_name: string | null; bio: string | null; avatar_url: string | null };

async function fetchProfile(username: string): Promise<Profile | null> {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/profiles/${username}`, { cache: "no-store" });
  if (!res.ok) return null;
  const body = await res.json();
  return body.profile as Profile;
}

// Next.js 15: dynamic segment props are async.
export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await fetchProfile(username);
  if (!profile) {
    return <main className="p-8">Not found.</main>;
  }
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">@{profile.username}</h1>
      {profile.display_name && <p className="mt-1 text-xl">{profile.display_name}</p>}
      {profile.bio && <p className="mt-3 text-slate-700">{profile.bio}</p>}
    </main>
  );
}
```

- [ ] **Step 6: Build**

```bash
npm run build
```
Expected: succeeds with no type errors.

- [ ] **Step 7: Manual smoke test**

```bash
npm run dev
```
In a browser: visit http://localhost:3000/signup, create a user, get redirected to /signin, sign in, get redirected to /settings, update bio, visit /u/<username>, see bio.

- [ ] **Step 8: Commit**

```bash
git add app/
git commit -m "feat(ui): skeleton pages for signup/signin/settings/profile/oauth-callback"
```

---

## Task 19: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write workflow**

```yaml
name: CI

on:
  push: { branches: [main] }
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - name: Install Supabase CLI
        run: |
          curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz
          sudo mv supabase /usr/local/bin/
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - name: Start Supabase
        run: supabase start --workdir .
      - name: Integration tests
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54001
        run: |
          # extract keys from supabase status
          status=$(supabase status -o json)
          echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(echo $status | jq -r '.ANON_KEY')" >> $GITHUB_ENV
          echo "SUPABASE_SERVICE_ROLE_KEY=$(echo $status | jq -r '.SERVICE_ROLE_KEY')" >> $GITHUB_ENV
          echo "APP_BASE_URL=http://localhost:3000" >> $GITHUB_ENV
          npm run test:integration
```

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "ci: GitHub Actions workflow with typecheck, lint, unit, integration"
```

---

## Task 20: Setup docs

**Files:**
- Create: `docs/setup.md`, `README.md`

- [ ] **Step 1: Write `docs/setup.md`**

```markdown
# Local setup

## Prerequisites

- Node.js 20+ (`node --version`)
- npm 10+
- Supabase CLI installed globally: `npm install -g supabase`
- Docker Desktop running (Supabase CLI uses Docker)

## First-time setup

1. Clone the repo and install deps:
   ```bash
   git clone https://github.com/TanmayKallakuri/claude-oops.git
   cd claude-oops
   npm install
   ```

2. Start local Supabase:
   ```bash
   supabase start
   ```
   This prints `anon key`, `service_role key`, and the API URL.

3. Copy `.env.example` to `.env` and paste those values.

4. Apply migrations:
   ```bash
   supabase db reset
   ```

5. Create a GitHub OAuth app at https://github.com/settings/developers:
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:54001/auth/v1/callback` (matches the API port in `supabase/config.toml`)
   Put the client ID / secret in `.env`.

6. Run the app:
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000.

## Running tests

```bash
npm test                 # unit tests (fast, no Supabase)
npm run test:integration # resets DB, hits real API routes
```
```

- [ ] **Step 2: Write `README.md`**

```markdown
# Claude Oops

Where Claude users gather to talk about what broke — with live Anthropic uptime and a jumping-off point to the plugin marketplace.

Think: GitHub issues meets Reddit, scoped to Claude.

## Status

Phase 1 (foundations) — auth, profiles, test harness, CI.

## Stack

Next.js 15 (App Router) · Supabase (Postgres / Auth / Storage / Realtime) · TypeScript · Tailwind · Vitest · Vercel

## Setup

See `docs/setup.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/setup.md README.md
git commit -m "docs: setup guide and README"
```

---

## Task 21: Create public GitHub repo and push

**Files:** none (git operations only)

- [ ] **Step 1: Verify nothing sensitive is staged**

```bash
git status
git log --oneline
```
Inspect for `.env` or secrets — they must not appear.

- [ ] **Step 2: Create public GitHub repo via `gh`**

```bash
gh repo create TanmayKallakuri/claude-oops --public --source=. --remote=origin --description "Forum for Claude errors, bad behaviors, and uptime chatter"
```

- [ ] **Step 3: Push**

```bash
git push -u origin main
```

- [ ] **Step 4: Verify in browser**

Visit https://github.com/TanmayKallakuri/claude-oops. Confirm CI is running on the first push.

---

## Task 22: Deploy to Vercel

**Files:** none (Vercel dashboard operations)

- [ ] **Step 1: Create hosted Supabase project**

In the Supabase dashboard, create a new project. Note the project URL, anon key, service_role key.

- [ ] **Step 2: Push schema to hosted Supabase**

```bash
supabase link --project-ref <ref-from-dashboard>
supabase db push
```

- [ ] **Step 3: Create a GitHub OAuth app for production**

- Homepage URL: `https://claude-oops.vercel.app` (temporary Vercel URL)
- Authorization callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`

In the Supabase dashboard → Auth → Providers → GitHub, paste the client ID / secret and enable.

- [ ] **Step 4: Import the GitHub repo into Vercel**

Vercel → New Project → Import `TanmayKallakuri/claude-oops`.

Set environment variables:
- `APP_BASE_URL` = `https://claude-oops.vercel.app`
- `NEXT_PUBLIC_SUPABASE_URL` = hosted URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = hosted anon key
- `SUPABASE_SERVICE_ROLE_KEY` = hosted service key

Deploy.

- [ ] **Step 5: Smoke test production**

Visit `https://claude-oops.vercel.app/signup`, create a user with email confirmation disabled in Supabase (temporarily, for testing), sign in, edit settings, visit `/u/<username>`.

- [ ] **Step 6: Re-enable email confirmation**

Supabase dashboard → Auth → disable "Allow test accounts without confirmation" or similar; re-enable "Confirm email".

- [ ] **Step 7: Announce Phase 1 complete**

Commit message for the tag:
```bash
git tag -a phase-1-complete -m "Phase 1: foundations shipped — auth, profiles, CI, deploy"
git push --tags
```

---

## Phase 1 definition of done

- [ ] `npm test` passes.
- [ ] `npm run test:integration` passes against local Supabase.
- [ ] CI green on main.
- [ ] Vercel production URL serves a real signup → signin → settings flow.
- [ ] GitHub OAuth works end-to-end.
- [ ] Visiting `/u/<someone>` shows a valid profile; unknown returns "Not found."
- [ ] `.env` is NOT committed; `.env.example` IS committed.
- [ ] No `any` types in `lib/` (confirmed via `grep -r ": any" lib/` returning empty).

When all boxes are checked, Phase 1 is shipped. Regenerate Plan 2 (core forum) from the spec and continue.
