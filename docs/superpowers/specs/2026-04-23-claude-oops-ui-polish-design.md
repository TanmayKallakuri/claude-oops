# Claude Oops — UI Polish Pass

**Status:** Draft — awaiting review
**Date:** 2026-04-23
**Parent spec:** [`2026-04-22-claude-oops-forum-design.md`](./2026-04-22-claude-oops-forum-design.md)
**Predecessors:** Phase 1 (foundations), Phase 2 (core forum) — both shipped.

## Goal

Replace the functional-but-ugly skeleton UI that shipped in Phases 1–2 with a polished, presentable, animated visual identity so the site is shareable. No new functionality — every API, route, and data model stays exactly as-is. Only the front-end components, layout, fonts, colors, motion, and brand assets change.

## Why now

The backend surface is stable. Anonymous visitors can browse, signed-in users can post, comment, and vote. The thing blocking wider sharing is that the live site at `https://claude-oops.vercel.app` looks unfinished. A dedicated polish phase lets us ship one coherent aesthetic across every page rather than piecemeal styling inside future feature phases.

## Scope

### In scope

- **All 7 existing pages polished:** `/`, `/new`, `/t/[id]`, `/signin`, `/signup`, `/settings`, `/u/[username]`.
- **Global navigation bar** with wordmark, "New thread" CTA, and avatar-or-signin widget (avatar has a dropdown with profile link + sign out — closes the Phase 1 signout TODO).
- **404 page** (`app/not-found.tsx`) with character.
- **Brand kit:** SVG wordmark (`"claude-oops"` in Instrument Serif italic), logo icon (orange dot that becomes `!` on hover), `favicon.ico`, dynamic `opengraph-image` via Next.js `ImageResponse`.
- **Animated hero on `/`:** kinetic blob gradient background, floating hero title, live activity ticker strip.
- **Motion across the app:** framer-motion springs for vote buttons, card hover lifts, page crossfades, success toasts, skeleton loaders, confetti on first upvote per session.
- **Typography system:** Instrument Serif (display) + Inter (body), self-hosted via `@fontsource`.
- **Color and spacing tokens** declared once in Tailwind config and consumed by every component.
- **Toast notification component** — replace the inline `setErr` patterns in composer / settings / thread page with consistent toasts.
- **Skeleton loaders** during data fetches in place of "Loading…" text.

### Out of scope (deferred)

- Dark mode (warm cream only in this phase).
- Mobile nav drawer / hamburger (mobile works via responsive stack — nav collapses to wordmark + avatar only, CTA moves into a FAB on the feed).
- Avatar image uploads (uses `display_name` initials or username-first-letter on colored disc; upload flow lives in a later moderation + attachments phase).
- Markdown rendering of thread/comment bodies (still plain text + URL autolink only; richer rendering is a later phase).
- Dedicated search UI (no search in Phase 2 and none needed here).
- Shadcn/ui or any other component library — staying on pure Tailwind for full control.

## Visual language

### Palette

```css
--bg:          #fef7f0;   /* warm cream page background */
--surface:     #ffffff;   /* cards and inputs */
--primary:     #c2410c;   /* claude orange — CTAs, upvotes, links */
--primary-soft:#fed7aa;   /* filled pills, hover tints */
--accent:      #fbbf24;   /* amber — highlight chips, hot-thread glow */
--danger:      #b91c1c;   /* downvotes, destructive buttons */
--danger-soft: #fecaca;   /* downvote pill background */
--text:        #1a0f08;   /* headings and body */
--text-muted:  #9a5a3a;   /* metadata, timestamps */
--border:      #f3e8d9;   /* hairline separators */
--shadow:      0 1px 3px rgba(180,83,9,.08);
--shadow-lift: 0 8px 20px rgba(180,83,9,.12);
```

Tailwind config extends the `colors` theme under a single `oops.*` scale using these tokens, so `bg-oops-primary`, `text-oops-muted`, etc. are available everywhere.

### Typography

- **Display / hero** — `Instrument Serif`, italic, weights 400. Used for: `/` hero headline, page H1s, logo wordmark.
- **Body / UI** — `Inter`, weights 400/500/600/700. Used for everything else.
- **Mono** — system monospace stack (`ui-monospace, SFMono-Regular, Menlo`) for inline code only.
- Sizes: `text-xs` 12 / `text-sm` 14 / `text-base` 16 / `text-lg` 18 / `text-xl` 20 / `text-2xl` 24 / `text-3xl` 30 / `text-4xl` 36 / `text-5xl` 48.
- Hero headline is `text-4xl` on mobile, `text-5xl` desktop, letter-spacing `-0.02em`.
- Both fonts self-hosted via `@fontsource/inter` and `@fontsource/instrument-serif` with `display: swap` to avoid FOIT.

### Tone / copy

Character-forward. Headlines and microcopy carry personality, but error messages stay clear and never cute.

- Home hero: **"oh no, what did Claude do this time?"** — subhead: *"the group chat for when the vibes go off"*
- Feed empty state: *"nothing broken yet. be the first to log an oops →"* (CTA links to `/new`)
- New-thread composer H1: **"spill it"** — subtitle: *"title, category, body. we'll handle the rest."*
- Thread detail: no copy changes (body IS the content).
- Settings H1: **"your corner"** — subtitle: *"how the rest of us see you."*
- Profile empty bio: *"no bio yet. mysterious."*
- 404: **"this oops doesn't exist"** — subtitle: *"even we can't find what you're looking for."* + "back to feed" link.

## Motion system

### Library

- `framer-motion` (^11.x) for React-driven springs, enter/exit, drag, layout transitions.
- Raw CSS keyframes for decorative infinite loops (blob, ticker, float) — framer-motion is overkill for "runs forever".

### Catalog

| Element | Trigger | Behavior |
|---|---|---|
| Hero blob | Always | 6s ease-in-out gradient blob (`radial-gradient` from `--primary-soft` to `--accent`), morphs `border-radius` and drifts within ±8px of origin |
| Hero title | Always | Gentle 3s floating vertical translate ±3px |
| Hero activity ticker | Always | Horizontal scroll, 14s linear, pulls latest 5 vote / thread events from a lightweight `/api/activity` endpoint (NEW — polls every 10s) |
| Card hover | Mouse hover | 200ms cubic-bezier lift: `translateY(-2px)` + shadow swap to `--shadow-lift` |
| Vote button click | Click | Spring scale from 1 → 1.2 → 1 (200ms, stiffness 400, damping 15) |
| Vote pill (score > 10) | Always | 1.6s pulse ring animation (amber glow) — the "hot" signal |
| Page transitions | Route change | 180ms crossfade via framer-motion `<AnimatePresence>` in root layout |
| Composer open | Reply click | Spring height expansion 200ms |
| Toast | After mutation | Slide in from bottom + bounce, auto-dismiss after 3s, stackable |
| Skeleton loader | Data pending | 1.4s shimmer (linear gradient sweep) on card-shaped placeholders |
| Confetti | First upvote per session | `canvas-confetti` burst (4 pieces per color, warm palette, 1s) |
| Delete thread confirm | Destructive action | Modal with scale-in; button shake on second-thought |

Prefer reduced motion: `prefers-reduced-motion` disables all non-essential motion (blob, ticker, float, confetti) while keeping state-change feedback (toasts, vote springs, skeletons).

## Information architecture

### Global nav (`app/layout.tsx`)

Fixed top bar on every page, transparent over hero on `/`, solid white elsewhere. Height 56px.

- **Left:** wordmark `claude-oops` (Instrument Serif italic, 20px) — links to `/`.
- **Center (feed page only):** category pills `all | bug | behavior | discussion` — sync with feed filter state.
- **Right:**
  - Signed out: **"Sign in"** text link + **"Sign up"** primary button.
  - Signed in: **"New thread"** primary button + avatar disc (initials on `--primary-soft` background). Click avatar → dropdown `@username, Settings, Sign out`.
- Sign out hits the Phase 1 `/api/auth/signout` endpoint, redirects to `/`.

### Home (`/`) layout

1. **Hero** — full-bleed warm cream, 180px tall (desktop) / 140px (mobile), contains blob + hero copy + activity ticker.
2. **Filters + sort** — pill-row: `all bug behavior discussion` (left), sort tabs `new | top` (right).
3. **Feed** — vertical stack of `ThreadCard`s, 16px gap.
4. **Load more** — full-width button, feed gets cursor-appended without layout jump.
5. **Empty state** — centered, "nothing broken yet" copy + "log an oops" CTA.

### Thread detail (`/t/[id]`) layout

1. **Back link** — "← back to feed" top-left, muted text.
2. **Thread head** — category pill + author line + title (H1 Instrument Serif), body below with `whitespace-pre-wrap`, vote row with spring buttons + comment count + author edit/delete dropdown (only for author).
3. **Comments** — count header, then tree:
   - Top-level comment: `CommentItem` component
   - Replies: indented 32px with a left hairline border
   - Deleted: `[deleted]` tombstone (italic, muted) with children still visible
4. **Composer** — sticky-to-bottom on desktop, inline on mobile. Placeholder switches based on `replyingTo` state. Disabled for anonymous users with "sign in to comment" copy.

### Composer (`/new`) layout

Centered single-column card, max-w-2xl. Title input (large Instrument Serif), category select (custom styled), body textarea (expanding). Character counter bottom-right. Submit button full-width, disabled until valid.

### Auth pages (`/signin`, `/signup`)

Two-column on desktop: form on left (max-w-md), marketing blob on right with hero copy + 3 bullet features ("see what's breaking", "vote on whether it's just you", "get notified when it's fixed — soon™"). Single column on mobile.

### Settings (`/settings`)

Max-w-xl card with avatar preview (initials disc), three fields (display_name, avatar_url, bio), character counts. Save button with toast feedback on success.

### Public profile (`/u/[username]`)

Hero with large avatar disc + display name + `@username` + bio. Below: horizontal tabs "Threads" (active) / "Comments" (disabled, says "coming soon"). Thread list below tabs.

### 404 (`app/not-found.tsx`)

Centered warm card with wordmark tilted -5°, "this oops doesn't exist" headline, "even we can't find what you're looking for" subhead, "← back to feed" link.

## Components

### `components/brand/`

- **`WordMark`** — SVG text "claude-oops" in Instrument Serif italic. Props: `{ size: "sm" | "md" | "lg" }`.
- **`LogoIcon`** — 32×32 SVG: orange dot that morphs to `!` on hover (CSS transition on `::after` content). Props: `{ size?: number; animated?: boolean }`.
- **`BlobBackground`** — absolute-positioned radial gradient blob, animated infinite via CSS keyframes. Used in hero and OG image.
- **`ActivityTicker`** — receives array of recent activity, scrolls horizontally, pauses on hover. Uses `requestAnimationFrame` for smooth scroll; disables on `prefers-reduced-motion`.

### `components/ui/`

Low-level primitives, Tailwind-styled, no external deps.

- **`Button`** — variants `primary | ghost | danger`, sizes `sm | md | lg`, supports `loading` state (spinner). Pure Tailwind.
- **`Card`** — rounded 12px, surface bg, shadow, optional hover-lift.
- **`Pill`** — rounded-full, three color variants (`primary | accent | danger`). Used for categories.
- **`VoteButtons`** — controlled component, props `{ score, current: -1|0|1, onChange }`. Handles spring animation internally. Shows pulse-glow when `score > 10`.
- **`Avatar`** — initials on colored disc, props `{ username, displayName?, size? }`. Deterministic color from username hash (within warm palette).
- **`Toast`** — provider + `useToast()` hook. Stacks up to 3, auto-dismisses.
- **`Skeleton`** — shimmer-animated block, props `{ className, height? }`.
- **`Dropdown`** — accessible menu (keyboard + click-outside), used in avatar and thread delete/edit.

### `components/forum/`

- **`Nav`** — the global header described above.
- **`ThreadCard`** — used in feed. Clickable card with vote column (left), title + meta (center), comment-count chip (right). Responsive collapses meta below title on mobile.
- **`CommentItem`** — body + author + vote buttons + inline reply/edit/delete. Handles `deleted` state with tombstone.
- **`Composer`** — generic, props `{ mode: "thread" | "comment", onSubmit, placeholder?, parentId? }`. Used on `/new` and `/t/[id]`.
- **`CategoryFilter`** — the pill row in nav/feed, controlled component.

## Data dependencies

No changes to existing API endpoints. One new lightweight endpoint:

- **`GET /api/activity`** — returns `{ items: Activity[] }` with up to 5 most-recent events (last 15 min). Cached 10 seconds. An `Activity` is `{ type: "vote" | "thread", text: string, created_at: string }` — rendered as strings in the ticker, not structured links. This is append-only display, not interactive.

Endpoint implementation: query latest 3 threads by `created_at` + latest 2 votes joined to their target titles. Plain service-role admin client; anonymous-readable (never returns user IDs or emails, only public titles and counts).

## File structure

```
app/
├─ layout.tsx                     MODIFIED: + fonts, + <Nav/>, + <AnimatePresence>, + ToastProvider, + global blob behind content
├─ page.tsx                       REWRITTEN: new hero + activity ticker + polished feed
├─ new/page.tsx                   REWRITTEN: polished composer
├─ t/[id]/page.tsx                REWRITTEN: polished thread detail + comments tree
├─ signin/page.tsx                REWRITTEN: two-column w/ marketing blob
├─ signup/page.tsx                REWRITTEN: two-column w/ marketing blob
├─ settings/page.tsx              REWRITTEN: polished profile edit
├─ u/[username]/page.tsx          REWRITTEN: hero + threads tab
├─ not-found.tsx                  NEW: 404 with character
├─ opengraph-image.tsx            NEW: dynamic OG via ImageResponse
├─ icon.tsx                       NEW: favicon via ImageResponse
└─ api/activity/route.ts          NEW: ticker data endpoint

components/
├─ brand/
│  ├─ WordMark.tsx
│  ├─ LogoIcon.tsx
│  ├─ BlobBackground.tsx
│  └─ ActivityTicker.tsx
├─ ui/
│  ├─ Button.tsx
│  ├─ Card.tsx
│  ├─ Pill.tsx
│  ├─ VoteButtons.tsx
│  ├─ Avatar.tsx
│  ├─ Toast.tsx
│  ├─ Skeleton.tsx
│  └─ Dropdown.tsx
└─ forum/
   ├─ Nav.tsx
   ├─ ThreadCard.tsx
   ├─ CommentItem.tsx
   ├─ Composer.tsx
   └─ CategoryFilter.tsx

lib/
└─ ui/
   ├─ cn.ts                       tiny classname merger
   └─ initials.ts                 username → initials + hash → warm color

tailwind.config.ts                MODIFIED: + oops.* color scale, + font-family, + custom shadows, + keyframes (blob, shimmer, pulse-ring, ticker, float)

app/globals.css                   MODIFIED: + font-face declarations, + @keyframes, + reduced-motion media query
```

## New dependencies

```
framer-motion              ^11
canvas-confetti            ^1.9
@fontsource/inter          ^5
@fontsource/instrument-serif ^5
clsx                       ^2
```

No shadcn/ui, no radix primitives beyond what we hand-roll. Keeps bundle lean and aesthetic fully controlled.

## Accessibility requirements

- All interactive components support keyboard navigation (Tab, Enter, Space, Arrow keys for dropdowns).
- `prefers-reduced-motion: reduce` disables blob, ticker, float, confetti, page crossfade. Vote springs, toasts, and skeletons keep working because they communicate state.
- Color contrast meets WCAG AA for all text + interactive elements.
- Icons have `aria-label`s; decorative SVGs have `aria-hidden="true"`.
- Focus rings visible on every interactive element (2px offset, `--primary` color).

## Testing strategy

No new unit or integration tests — this is a visual pass; backend contracts are unchanged and all Phase 2 tests continue to cover functionality. Coverage is:

- **Manual visual QA** — every page opened in the browser locally and in production after deploy. Checklist in the plan.
- **Typecheck + build** — `npm run typecheck` and `npm run build` must pass on every task.
- **Existing tests** — `npm test` and `npm run test:integration` continue to pass; any failure = regression.

## Out of scope of each component (explicit gaps to remember)

- `Avatar` does not load images — initials only.
- `VoteButtons` does not optimistically update the score on its own — the parent passes the updated score after the API response.
- `Composer` does not persist drafts across page reloads.
- `ActivityTicker` does not handle empty state; if no activity in last 15 min, ticker hides entirely.
- `ThreadCard` does not show body preview; title + metadata only.

## Phase-polish definition of done

- [ ] All 7 existing pages match the visual language and motion spec.
- [ ] `/not-found`, `/api/activity`, `app/icon.tsx`, `app/opengraph-image.tsx` exist and ship.
- [ ] Global nav on every page, with working signout.
- [ ] `npm test` + `npm run test:integration` pass.
- [ ] CI green on main.
- [ ] Deployed to production; manual visual QA confirms every page renders correctly on desktop Chrome, desktop Safari, mobile viewport.
- [ ] Lighthouse Performance ≥ 85 on home (static-first), Accessibility ≥ 95.
- [ ] `prefers-reduced-motion` honored (QA by enabling OS setting).
- [ ] OG preview renders correctly when URL pasted in Slack, iMessage, Twitter.

When all boxes check, the polish pass ships. Tag `ui-polish-complete`. Next candidate phases: moderation + attachments, or uptime + skills page.
