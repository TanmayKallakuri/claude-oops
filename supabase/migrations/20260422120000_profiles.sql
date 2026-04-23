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

-- Note: `username citext unique` auto-generates a unique B-tree index,
-- so we do not add a second index on the same column.

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
  -- GitHub OAuth users may not expose an email, so guard NULL through
  -- regexp_replace so the length-fallback branch always runs.
  base_username := coalesce(
    lower(new.raw_user_meta_data ->> 'username'),
    lower(split_part(new.email, '@', 1)),
    ''
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
