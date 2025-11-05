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
-- Returns the cumulative count of each milestone tier across ALL game sessions
-- (m25=Silver, m50=Gold, m75=Platinum, m100=Diamond)
drop function if exists public.get_milestone_counts(uuid);

create or replace function public.get_milestone_counts(p_user_id uuid)
returns table (
  silver bigint,
  gold bigint,
  platinum bigint,
  diamond bigint
) language sql security definer set search_path = public as $$
  -- Count Speed milestones from speed_runs table
  with speed_counts as (
    select
      sum(case when m25 then 1 else 0 end) as silver,
      sum(case when m50 then 1 else 0 end) as gold,
      sum(case when m75 then 1 else 0 end) as platinum,
      sum(case when m100 then 1 else 0 end) as diamond
    from public.speed_runs
    where user_id = p_user_id
  ),
  -- Count Daily/Practice milestones from daily_progress table (JSON format)
  daily_counts as (
    select
      count(*) filter (where (milestones->>'m25')::boolean = true) as silver,
      count(*) filter (where (milestones->>'m50')::boolean = true) as gold,
      count(*) filter (where (milestones->>'m75')::boolean = true) as platinum,
      count(*) filter (where (milestones->>'m100')::boolean = true) as diamond
    from public.daily_progress
    where user_id = p_user_id
  )
  -- Combine all counts from both sources
  select
    (coalesce(s.silver, 0) + coalesce(d.silver, 0))::bigint as silver,
    (coalesce(s.gold, 0) + coalesce(d.gold, 0))::bigint as gold,
    (coalesce(s.platinum, 0) + coalesce(d.platinum, 0))::bigint as platinum,
    (coalesce(s.diamond, 0) + coalesce(d.diamond, 0))::bigint as diamond
  from speed_counts s, daily_counts d;
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

-- Accumulative counts per badge across all modes
create table if not exists public.achievement_counts (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  count int not null default 0,
  primary key (user_id, key)
);

alter table public.achievement_counts enable row level security;

drop policy if exists "Read own achievement_counts" on public.achievement_counts;
create policy "Read own achievement_counts" on public.achievement_counts
  for select using (auth.uid() = user_id);

drop policy if exists "Upsert own achievement_counts" on public.achievement_counts;
create policy "Upsert own achievement_counts" on public.achievement_counts
  for insert with check (auth.uid() = user_id);

drop policy if exists "Update own achievement_counts" on public.achievement_counts;
create policy "Update own achievement_counts" on public.achievement_counts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Helper to increment a badge count and ensure base achievement row exists
create or replace function public.increment_badge_count(
  p_user_id uuid,
  p_key text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.achievement_counts as c(user_id, key, count)
  values (p_user_id, p_key, 1)
  on conflict (user_id, key) do update set count = c.count + 1;

  -- Ensure the base achievement exists at least once
  if not exists (select 1 from public.achievements where user_id = p_user_id and key = p_key) then
    insert into public.achievements(user_id, key, unlocked_at)
    values (p_user_id, p_key, now())
    on conflict (user_id, key) do nothing;
  end if;
end; $$;

-- RPC to fetch all badge counts for a user
create or replace function public.get_badge_counts(p_user_id uuid)
returns table (
  key text,
  count int
) language sql security definer set search_path = public as $$
  select key, count
  from public.achievement_counts
  where user_id = p_user_id
  order by key asc;
$$;
