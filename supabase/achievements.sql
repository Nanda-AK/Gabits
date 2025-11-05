-- Achievements table and milestone counting
-- This file is idempotent and safe to re-run.

-- Table: achievements (general badges across all modes)
create table if not exists public.achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  unlocked_at timestamptz not null default now(),
  meta jsonb,
  primary key (user_id, key)
);

-- Index for faster lookups
create index if not exists idx_achievements_user on public.achievements(user_id);

alter table public.achievements enable row level security;

drop policy if exists "Read own achievements" on public.achievements;
create policy "Read own achievements" on public.achievements
  for select using (auth.uid() = user_id);

drop policy if exists "Insert own achievements" on public.achievements;
create policy "Insert own achievements" on public.achievements
  for insert with check (auth.uid() = user_id);

drop policy if exists "Update own achievements" on public.achievements;
create policy "Update own achievements" on public.achievements
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RPC: get_milestone_counts
-- Returns the count of each milestone tier (m25=Silver, m50=Gold, m75=Platinum, m100=Diamond)
drop function if exists public.get_milestone_counts(uuid);

create or replace function public.get_milestone_counts(p_user_id uuid)
returns table (
  silver bigint,
  gold bigint,
  platinum bigint,
  diamond bigint
) language sql security definer set search_path = public as $$
  select
    count(*) filter (where key = 'm25') as silver,
    count(*) filter (where key = 'm50') as gold,
    count(*) filter (where key = 'm75') as platinum,
    count(*) filter (where key = 'm100') as diamond
  from public.achievements
  where user_id = p_user_id and key in ('m25','m50','m75','m100');
$$;

-- RPC: get_all_achievements
-- Returns all unlocked achievements for a user (for badge display UI)
drop function if exists public.get_all_achievements(uuid);

create or replace function public.get_all_achievements(p_user_id uuid)
returns table (
  key text,
  unlocked_at timestamptz,
  meta jsonb
) language sql security definer set search_path = public as $$
  select key, unlocked_at, meta
  from public.achievements
  where user_id = p_user_id
  order by unlocked_at desc;
$$;
