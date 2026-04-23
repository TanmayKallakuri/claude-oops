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
