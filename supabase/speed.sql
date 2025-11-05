-- Speed-only totals and achievements

-- Table: speed_totals (aggregated only from Speed mode)
create table if not exists public.speed_totals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_coins int not null default 0,
  total_correct int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.speed_totals enable row level security;

drop policy if exists "Read own speed_totals" on public.speed_totals;
create policy "Read own speed_totals" on public.speed_totals
  for select using (auth.uid() = user_id);

drop policy if exists "Upsert own speed_totals" on public.speed_totals;
create policy "Upsert own speed_totals" on public.speed_totals
  for insert with check (auth.uid() = user_id);

drop policy if exists "Update own speed_totals" on public.speed_totals;
create policy "Update own speed_totals" on public.speed_totals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at trigger reuse
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists set_speed_totals_updated_at on public.speed_totals;
create trigger set_speed_totals_updated_at
before update on public.speed_totals
for each row execute function public.set_updated_at();

-- RPC: increment_speed_totals
create or replace function public.increment_speed_totals(
  p_user_id uuid,
  p_coin_delta int,
  p_correct_delta int
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.speed_totals as t (user_id, total_coins, total_correct)
  values (p_user_id, greatest(0, p_coin_delta), greatest(0, p_correct_delta))
  on conflict (user_id) do update set
    total_coins = greatest(0, t.total_coins + p_coin_delta),
    total_correct = greatest(0, t.total_correct + p_correct_delta),
    updated_at = now();
end; $$;

-- Table: speed_achievements (one-time unlocks for speed mode)
create table if not exists public.speed_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (key in ('m10','m25','m50','m75','m100')),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.speed_achievements enable row level security;

drop policy if exists "Read own speed_achievements" on public.speed_achievements;
create policy "Read own speed_achievements" on public.speed_achievements
  for select using (auth.uid() = user_id);

drop policy if exists "Insert own speed_achievements" on public.speed_achievements;
create policy "Insert own speed_achievements" on public.speed_achievements
  for insert with check (auth.uid() = user_id);

drop policy if exists "Update own speed_achievements" on public.speed_achievements;
create policy "Update own speed_achievements" on public.speed_achievements
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- View and RPC for speed leaderboard
-- Pivot achievements to booleans for quick join
create or replace view public.speed_achievements_pivot as
select
  u.user_id,
  bool_or(u.key = 'm25') as has_m25,
  bool_or(u.key = 'm50') as has_m50,
  bool_or(u.key = 'm75') as has_m75,
  bool_or(u.key = 'm100') as has_m100
from public.speed_achievements u
group by u.user_id;

-- Aggregate tier counts from speed_runs (lifetime)
create or replace view public.speed_tier_counts as
select
  user_id,
  sum(case when m25 then 1 else 0 end)::int as silver_count,
  sum(case when m50 then 1 else 0 end)::int as gold_count,
  sum(case when m75 then 1 else 0 end)::int as platinum_count,
  sum(case when m100 then 1 else 0 end)::int as diamond_count
from public.speed_runs
group by user_id;

create or replace view public.speed_leaderboard_view as
select
  st.user_id,
  coalesce(p.full_name, 'Player') as display_name,
  st.total_coins,
  st.total_correct,
  coalesce(ap.has_m25, false) as has_m25,
  coalesce(ap.has_m50, false) as has_m50,
  coalesce(ap.has_m75, false) as has_m75,
  coalesce(ap.has_m100, false) as has_m100,
  coalesce(tc.silver_count, 0) as silver_count,
  coalesce(tc.gold_count, 0) as gold_count,
  coalesce(tc.platinum_count, 0) as platinum_count,
  coalesce(tc.diamond_count, 0) as diamond_count
from public.speed_totals st
left join public.profiles p on p.id = st.user_id
left join public.speed_achievements_pivot ap on ap.user_id = st.user_id
left join public.speed_tier_counts tc on tc.user_id = st.user_id;

create or replace function public.get_speed_leaderboard(limit_n int default 50)
returns table (
  user_id uuid,
  display_name text,
  total_coins int,
  total_correct int,
  has_m25 boolean,
  has_m50 boolean,
  has_m75 boolean,
  has_m100 boolean,
  silver_count int,
  gold_count int,
  platinum_count int,
  diamond_count int,
  rank int
) language sql security definer set search_path = public as $$
  select user_id, display_name, total_coins, total_correct,
         has_m25, has_m50, has_m75, has_m100,
         silver_count, gold_count, platinum_count, diamond_count,
         dense_rank() over (order by total_coins desc, total_correct desc) as rank
  from public.speed_leaderboard_view
  order by total_coins desc, total_correct desc
  limit coalesce(limit_n, 50);
$$;
