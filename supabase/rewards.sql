-- Rewards system core schema and RPCs (MVP)
-- This file is idempotent and safe to re-run.

-- Balances per user (coins, gems, xp)
create table if not exists public.user_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins int not null default 0,
  gems int not null default 0,
  xp int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_balances enable row level security;

drop policy if exists "Read own user_balances" on public.user_balances;
create policy "Read own user_balances" on public.user_balances
  for select using (auth.uid() = user_id);

drop policy if exists "Upsert own user_balances" on public.user_balances;
create policy "Upsert own user_balances" on public.user_balances
  for insert with check (auth.uid() = user_id);

drop policy if exists "Update own user_balances" on public.user_balances;
create policy "Update own user_balances" on public.user_balances
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at trigger reuse (defined in speed.sql too)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists set_user_balances_updated_at on public.user_balances;
create trigger set_user_balances_updated_at
before update on public.user_balances
for each row execute function public.set_updated_at();

-- Reward events ledger (for XP and seasonal leaderboard)
create table if not exists public.reward_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  source text not null check (source in ('practice','speed','compete-ai','compete-friends')),
  coins_delta int not null default 0,
  gems_delta int not null default 0,
  badges_delta int not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.reward_events enable row level security;

drop policy if exists "Read own reward_events" on public.reward_events;
create policy "Read own reward_events" on public.reward_events
  for select using (auth.uid() = user_id);

drop policy if exists "Insert own reward_events" on public.reward_events;
create policy "Insert own reward_events" on public.reward_events
  for insert with check (auth.uid() = user_id);

-- Helper: adjust balances and record event atomically
create or replace function public.add_balance_and_event(
  p_user_id uuid,
  p_date date,
  p_coins int,
  p_gems int,
  p_badges_delta int,
  p_source text,
  p_meta jsonb default '{}'::jsonb
) returns table (coins_delta int, gems_delta int, badges_delta int, xp_delta int)
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_balances as b (user_id, coins, gems, xp)
  values (p_user_id, greatest(0, p_coins), greatest(0, p_gems), greatest(0, p_coins + 5*p_gems + 10*p_badges_delta))
  on conflict (user_id) do update set
    coins = greatest(0, b.coins + p_coins),
    gems = greatest(0, b.gems + p_gems),
    xp = greatest(0, b.xp + (p_coins + 5*p_gems + 10*p_badges_delta)),
    updated_at = now();

  insert into public.reward_events(user_id, date, source, coins_delta, gems_delta, badges_delta, meta)
  values (p_user_id, p_date, p_source, p_coins, p_gems, p_badges_delta, coalesce(p_meta, '{}'::jsonb));

  return query select p_coins, p_gems, p_badges_delta, (p_coins + 5*p_gems + 10*p_badges_delta);
end; $$;

-- Any-mode streak tracking (applies to Practice, Speed, and Compete)
create table if not exists public.activity_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_date date,
  any_streak int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.activity_streaks enable row level security;

drop policy if exists "Read own activity_streaks" on public.activity_streaks;
create policy "Read own activity_streaks" on public.activity_streaks
  for select using (auth.uid() = user_id);

drop policy if exists "Upsert own activity_streaks" on public.activity_streaks;
create policy "Upsert own activity_streaks" on public.activity_streaks
  for insert with check (auth.uid() = user_id);

drop policy if exists "Update own activity_streaks" on public.activity_streaks;
create policy "Update own activity_streaks" on public.activity_streaks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Ensure we only grant the daily streak bonus once per date (first mode wins)
create table if not exists public.daily_streak_awards (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  claimed_by text not null check (claimed_by in ('practice','speed','compete-ai','compete-friends')),
  coins_awarded int not null default 0,
  badges_awarded text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.daily_streak_awards enable row level security;

drop policy if exists "Read own daily_streak_awards" on public.daily_streak_awards;
create policy "Read own daily_streak_awards" on public.daily_streak_awards
  for select using (auth.uid() = user_id);

drop policy if exists "Insert own daily_streak_awards" on public.daily_streak_awards;
create policy "Insert own daily_streak_awards" on public.daily_streak_awards
  for insert with check (auth.uid() = user_id);

-- Helper: update any-mode streak and return new streak length
create or replace function public.update_any_streak(
  p_user_id uuid,
  p_date date
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_last_date date;
  v_any int;
  v_any_after int;
  v_is_consecutive boolean;
begin
  select last_date, any_streak into v_last_date, v_any from public.activity_streaks where user_id = p_user_id;
  if v_last_date is null then v_any := 0; end if;
  v_is_consecutive := (v_last_date is not null and p_date = v_last_date + 1);
  if v_is_consecutive then v_any_after := v_any + 1; else v_any_after := 1; end if;
  insert into public.activity_streaks(user_id, last_date, any_streak)
  values (p_user_id, p_date, v_any_after)
  on conflict (user_id) do update set last_date = excluded.last_date, any_streak = excluded.any_streak, updated_at = now();
  return v_any_after;
end; $$;

-- PRACTICE -----------------------------------------------------------------

-- Sessions for practice
create table if not exists public.practice_sessions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  topic text not null,
  used_seconds int not null default 0,
  coins_awarded int not null default 0,
  gems_awarded int not null default 0,
  streak_after int not null default 1,
  is_weekend_bonus boolean not null default false,
  grants jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.practice_sessions enable row level security;

drop policy if exists "Read own practice_sessions" on public.practice_sessions;
create policy "Read own practice_sessions" on public.practice_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "Insert own practice_sessions" on public.practice_sessions;
create policy "Insert own practice_sessions" on public.practice_sessions
  for insert with check (auth.uid() = user_id);

-- Rolling streak state
create table if not exists public.practice_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_date date,
  any_streak int not null default 0,
  topic text,
  topic_streak int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.practice_streaks enable row level security;

drop policy if exists "Read own practice_streaks" on public.practice_streaks;
create policy "Read own practice_streaks" on public.practice_streaks
  for select using (auth.uid() = user_id);

drop policy if exists "Upsert own practice_streaks" on public.practice_streaks;
create policy "Upsert own practice_streaks" on public.practice_streaks
  for insert with check (auth.uid() = user_id);

drop policy if exists "Update own practice_streaks" on public.practice_streaks;
create policy "Update own practice_streaks" on public.practice_streaks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.grant_practice_rewards(
  p_user_id uuid,
  p_topic text,
  p_used_seconds int,
  p_date date,
  p_question_coins int default 0
) returns table (
  coins_awarded int,
  gems_awarded int,
  streak_after int,
  badges_awarded text[]
) language plpgsql security definer set search_path = public as $$
declare
  v_last_date date;
  v_any int;
  v_topic text;
  v_topic_streak int;
  v_is_consecutive boolean;
  v_is_weekend boolean;
  v_coins int := 0;
  v_gems int := 0;
  v_badges text[] := '{}';
  v_any_after int;
  v_topic_after int;
  v_sessions_today int;
  v_seconds_today int;
  v_grants jsonb := '{}'::jsonb;
  v_badges_delta int := 0;
  v_mult numeric := 1.0;
  v_capped boolean := false;
begin
  -- enforce per-day caps
  select count(*), coalesce(sum(used_seconds),0)
  into v_sessions_today, v_seconds_today
  from public.practice_sessions
  where user_id = p_user_id and date = p_date;

  if v_sessions_today >= 3 or v_seconds_today >= 1800 then
    -- over daily limit; do not grant
    return query select 0, 0, 0, ARRAY[]::text[];
  end if;

  -- load current streak state
  select last_date, any_streak, topic, topic_streak into v_last_date, v_any, v_topic, v_topic_streak
  from public.practice_streaks where user_id = p_user_id;

  if v_last_date is null then
    v_any := 0; v_topic_streak := 0; v_topic := null;
  end if;

  v_is_consecutive := (v_last_date is not null and p_date = v_last_date + 1);

  if v_is_consecutive then
    v_any_after := v_any + 1;
    if v_topic = p_topic then
      v_topic_after := v_topic_streak + 1;
    else
      v_topic_after := 1;
    end if;
  else
    v_any_after := 1;
    v_topic_after := 1;
  end if;

  -- Any-mode streak base coins (only grant once per day across all modes); weekend multiplier applies in Practice
  v_any_after := public.update_any_streak(p_user_id, p_date);
  if not exists (select 1 from public.daily_streak_awards where user_id = p_user_id and date = p_date) then
    if v_any_after = 1 then v_coins := v_coins + 3; v_grants := v_grants || jsonb_build_object('streak','1-day'); end if;
    if v_any_after = 2 then v_coins := v_coins + 5; v_grants := v_grants || jsonb_build_object('streak','2-day'); end if;
    if v_any_after = 3 then v_coins := v_coins + 8; v_grants := v_grants || jsonb_build_object('streak','3-day');
      perform public.increment_badge_count(p_user_id, 'focused_learner');
      v_badges := array_append(v_badges, 'focused_learner'); v_badges_delta := v_badges_delta + 1;
    end if;
  end if;
  if v_any_after >= 4 and v_topic_after >= 4 then v_coins := v_coins + 10; v_grants := v_grants || jsonb_build_object('streak','4-day-same-topic'); end if;
  if v_any_after >= 5 and v_topic_after >= 5 then v_coins := v_coins + 15; v_grants := v_grants || jsonb_build_object('streak','5-day-same-topic');
    if v_topic_after = 5 then
      perform public.increment_badge_count(p_user_id, 'math_explorer');
      v_badges := array_append(v_badges, 'math_explorer'); v_badges_delta := v_badges_delta + 1;
    end if;
  end if;

  -- add per-question coins (Practice mode)
  v_coins := v_coins + greatest(0, coalesce(p_question_coins, 0));

  -- weekend bonus +20% (Practice only)
  v_is_weekend := extract(dow from p_date) in (0,6);
  if v_is_weekend then v_mult := 1.2; end if;
  v_coins := floor(v_coins * v_mult);

  -- mark streak bonus as claimed if not already
  if not exists (select 1 from public.daily_streak_awards where user_id = p_user_id and date = p_date) then
    insert into public.daily_streak_awards(user_id, date, claimed_by, coins_awarded, badges_awarded)
    values (p_user_id, p_date, 'practice', v_coins, v_badges);
  end if;

  -- persist session
  insert into public.practice_sessions(user_id, date, topic, used_seconds, coins_awarded, gems_awarded, streak_after, is_weekend_bonus, grants)
  values (p_user_id, p_date, p_topic, p_used_seconds, v_coins, v_gems, v_any_after, v_is_weekend, v_grants);

  -- update streaks state
  insert into public.practice_streaks as s (user_id, last_date, any_streak, topic, topic_streak)
  values (p_user_id, p_date, v_any_after, p_topic, v_topic_after)
  on conflict (user_id) do update set
    last_date = excluded.last_date,
    any_streak = excluded.any_streak,
    topic = excluded.topic,
    topic_streak = excluded.topic_streak,
    updated_at = now();

  -- update balances and xp, record event
  perform * from public.add_balance_and_event(p_user_id, p_date, v_coins, v_gems, v_badges_delta, 'practice', v_grants);

  return query select v_coins, v_gems, v_any_after, v_badges;
end; $$;

-- SPEED per-run table and daily view/RPC (complements speed.sql leaderboards) ----
create table if not exists public.speed_runs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  difficulty text not null check (difficulty in ('easy','moderate','difficult')),
  correct_count int not null default 0,
  coins_earned int not null default 0,
  m10 boolean not null default false,
  m25 boolean not null default false,
  m50 boolean not null default false,
  m75 boolean not null default false,
  m100 boolean not null default false,
  fast_flawless boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.speed_runs enable row level security;

drop policy if exists "Read own speed_runs" on public.speed_runs;
create policy "Read own speed_runs" on public.speed_runs
  for select using (auth.uid() = user_id);

drop policy if exists "Insert own speed_runs" on public.speed_runs;
create policy "Insert own speed_runs" on public.speed_runs
  for insert with check (auth.uid() = user_id);

-- Daily aggregation for speed
create or replace view public.speed_daily_stats as
select
  user_id,
  date,
  count(*) as run_count,
  sum(coins_earned)::int as coins_sum,
  sum(correct_count)::int as correct_sum,
  sum(case when m25 then 1 else 0 end)::int as m25_count,
  sum(case when m50 then 1 else 0 end)::int as m50_count,
  sum(case when m75 then 1 else 0 end)::int as m75_count,
  sum(case when m100 then 1 else 0 end)::int as m100_count
from public.speed_runs
group by user_id, date;

create or replace function public.get_speed_daily(
  p_user_id uuid,
  p_from date,
  p_to date
) returns table (
  date date,
  run_count int,
  coins_sum int,
  correct_sum int,
  m25_count int,
  m50_count int,
  m75_count int,
  m100_count int
) language sql security definer set search_path = public as $$
  select date, run_count, coins_sum, correct_sum, m25_count, m50_count, m75_count, m100_count
  from public.speed_daily_stats
  where user_id = p_user_id
    and date between p_from and p_to
  order by date asc;
$$;

-- RPC: log a speed run and grant gems based on accuracy, plus XP
create or replace function public.log_speed_run(
  p_user_id uuid,
  p_date date,
  p_difficulty text,
  p_correct int,
  p_coins int,
  p_m10 boolean,
  p_m25 boolean,
  p_m50 boolean,
  p_m75 boolean,
  p_m100 boolean,
  p_fast_flawless boolean
) returns table (coins_awarded int, gems_awarded int, badges_awarded text[])
language plpgsql security definer set search_path = public as $$
declare
  v_acc numeric := greatest(0, least(1, p_correct::numeric / 10.0));
  v_gems int := 0;
  v_badges text[] := '{}';
  v_badges_delta int := 0;
  v_meta jsonb := jsonb_build_object('difficulty', p_difficulty, 'acc', v_acc);
  v_streak int;
  v_any_after int;
  v_base int := 0;
  v_coins_total int := p_coins;
begin
  if v_acc >= 1 then v_gems := v_gems + 3; elsif v_acc >= 0.70 then v_gems := v_gems + 2; end if;

  insert into public.speed_runs(user_id, date, difficulty, correct_count, coins_earned, m10, m25, m50, m75, m100, fast_flawless)
  values (p_user_id, p_date, p_difficulty, p_correct, p_coins, p_m10, p_m25, p_m50, p_m75, p_m100, p_fast_flawless);

  -- Fast & Flawless streak (3 consecutive runs)
  create table if not exists public.speed_streaks (
    user_id uuid primary key references auth.users(id) on delete cascade,
    fff_streak int not null default 0,
    updated_at timestamptz not null default now()
  );
  alter table public.speed_streaks enable row level security;
  drop policy if exists "Read own speed_streaks" on public.speed_streaks;
  create policy "Read own speed_streaks" on public.speed_streaks for select using (auth.uid() = user_id);
  drop policy if exists "Upsert own speed_streaks" on public.speed_streaks;
  create policy "Upsert own speed_streaks" on public.speed_streaks for insert with check (auth.uid() = user_id);
  drop policy if exists "Update own speed_streaks" on public.speed_streaks;
  create policy "Update own speed_streaks" on public.speed_streaks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

  if p_fast_flawless then
    insert into public.speed_streaks(user_id, fff_streak)
    values (p_user_id, 1)
    on conflict (user_id) do update set fff_streak = public.speed_streaks.fff_streak + 1, updated_at = now()
    returning fff_streak into v_streak;
  else
    insert into public.speed_streaks(user_id, fff_streak)
    values (p_user_id, 0)
    on conflict (user_id) do update set fff_streak = 0, updated_at = now()
    returning fff_streak into v_streak;
  end if;

  if v_streak >= 3 then
    v_gems := v_gems + 5;
    perform public.increment_badge_count(p_user_id, 'speed_master');
    v_badges := array_append(v_badges, 'speed_master'); v_badges_delta := v_badges_delta + 1;
    update public.speed_streaks set fff_streak = 0, updated_at = now() where user_id = p_user_id;
  end if;

  -- Any-mode daily streak base coins (no weekend multiplier in Speed). Grant once per day.
  v_any_after := public.update_any_streak(p_user_id, p_date);
  if not exists (select 1 from public.daily_streak_awards where user_id = p_user_id and date = p_date) then
    if v_any_after = 1 then v_base := v_base + 3; end if;
    if v_any_after = 2 then v_base := v_base + 5; end if;
    if v_any_after = 3 then v_base := v_base + 8; perform public.increment_badge_count(p_user_id, 'focused_learner'); v_badges := array_append(v_badges, 'focused_learner'); v_badges_delta := v_badges_delta + 1; end if;
    insert into public.daily_streak_awards(user_id, date, claimed_by, coins_awarded, badges_awarded)
    values (p_user_id, p_date, 'speed', v_base, case when v_any_after = 3 then array['focused_learner']::text[] else '{}'::text[] end);
  end if;
  v_coins_total := greatest(0, p_coins + v_base);

  -- sync speed_totals (coins/correct)
  perform * from public.increment_speed_totals(p_user_id, p_coins, p_correct);

  -- record balances and xp (include daily streak base coins if granted here)
  perform * from public.add_balance_and_event(p_user_id, p_date, v_coins_total, v_gems, v_badges_delta, 'speed', v_meta);

  return query select v_coins_total, v_gems, v_badges;
end; $$;

-- COMPETE (AI/Friends) ------------------------------------------------------

create table if not exists public.compete_matches (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('ai','friends')),
  difficulty text,
  result text not null check (result in ('win','loss','draw')),
  coins_awarded int not null default 0,
  gems_awarded int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.compete_matches enable row level security;

drop policy if exists "Read own compete_matches" on public.compete_matches;
create policy "Read own compete_matches" on public.compete_matches
  for select using (auth.uid() = user_id);

drop policy if exists "Insert own compete_matches" on public.compete_matches;
create policy "Insert own compete_matches" on public.compete_matches
  for insert with check (auth.uid() = user_id);

create table if not exists public.compete_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ai_win_streak int not null default 0,
  friends_win_streak int not null default 0,
  ai_matches int not null default 0,
  friend_matches int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.compete_streaks enable row level security;

drop policy if exists "Read own compete_streaks" on public.compete_streaks;
create policy "Read own compete_streaks" on public.compete_streaks for select using (auth.uid() = user_id);

drop policy if exists "Upsert own compete_streaks" on public.compete_streaks;
create policy "Upsert own compete_streaks" on public.compete_streaks for insert with check (auth.uid() = user_id);

drop policy if exists "Update own compete_streaks" on public.compete_streaks;
create policy "Update own compete_streaks" on public.compete_streaks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.grant_compete_rewards(
  p_user_id uuid,
  p_type text,
  p_date date,
  p_difficulty text,
  p_result text
) returns table (coins_awarded int, gems_awarded int, badges_awarded text[])
language plpgsql security definer set search_path = public as $$
declare
  v_coins int := 0;
  v_gems int := 0;
  v_badges text[] := '{}';
  v_badges_delta int := 0;
  v_mult numeric := 1.0;
  v_ai int;
  v_fr int;
  v_ai_ws int;
  v_fr_ws int;
  v_meta jsonb := jsonb_build_object('type', p_type, 'difficulty', p_difficulty, 'result', p_result);
  v_any_after int;
  v_base int := 0;
begin
  if p_type = 'ai' then
    v_coins := v_coins + 5; -- participation
    if p_result = 'win' then v_coins := v_coins + 15; end if;
    -- difficulty multiplier (easy 1.0, moderate 1.2, difficult 1.5)
    if p_difficulty = 'moderate' then v_mult := 1.2; end if;
    if p_difficulty = 'difficult' then v_mult := 1.5; end if;
    v_coins := floor(v_coins * v_mult);

    -- update streaks and matches
    insert into public.compete_streaks(user_id, ai_win_streak, ai_matches)
    values (p_user_id, case when p_result = 'win' then 1 else 0 end, 1)
    on conflict (user_id) do update set
      ai_win_streak = case when p_result = 'win' then public.compete_streaks.ai_win_streak + 1 else 0 end,
      ai_matches = public.compete_streaks.ai_matches + 1,
      updated_at = now()
    returning ai_win_streak, ai_matches into v_ai_ws, v_ai;

    if v_ai_ws >= 3 then
      v_gems := v_gems + 3; -- 3-win streak
      update public.compete_streaks set ai_win_streak = 0, updated_at = now() where user_id = p_user_id;
    end if;

    if v_ai % 10 = 0 and v_ai > 0 then
      perform public.increment_badge_count(p_user_id, 'ai_challenger');
      v_badges := array_append(v_badges, 'ai_challenger'); v_badges_delta := v_badges_delta + 1;
    end if;

  elsif p_type = 'friends' then
    if p_result = 'draw' then v_coins := v_coins + 10; else v_coins := v_coins + 10 + case when p_result = 'win' then 15 else 0 end; end if;

    insert into public.compete_streaks(user_id, friends_win_streak, friend_matches)
    values (p_user_id, case when p_result = 'win' then 1 else 0 end, 1)
    on conflict (user_id) do update set
      friends_win_streak = case when p_result = 'win' then public.compete_streaks.friends_win_streak + 1 else 0 end,
      friend_matches = public.compete_streaks.friend_matches + 1,
      updated_at = now()
    returning friends_win_streak, friend_matches into v_fr_ws, v_fr;

    if v_fr_ws >= 3 then
      v_gems := v_gems + 5; -- 3+ win streak
      update public.compete_streaks set friends_win_streak = 0, updated_at = now() where user_id = p_user_id;
    end if;

    if v_fr % 10 = 0 and v_fr > 0 then
      perform public.increment_badge_count(p_user_id, 'social_legend');
      v_badges := array_append(v_badges, 'social_legend'); v_badges_delta := v_badges_delta + 1;
    end if;
  end if;

  -- Any-mode daily streak base coins (no weekend multiplier outside Practice). Grant once per day.
  v_any_after := public.update_any_streak(p_user_id, p_date);
  if not exists (select 1 from public.daily_streak_awards where user_id = p_user_id and date = p_date) then
    if v_any_after = 1 then v_base := v_base + 3; end if;
    if v_any_after = 2 then v_base := v_base + 5; end if;
    if v_any_after = 3 then v_base := v_base + 8; perform public.increment_badge_count(p_user_id, 'focused_learner'); v_badges := array_append(v_badges, 'focused_learner'); v_badges_delta := v_badges_delta + 1; end if;
    insert into public.daily_streak_awards(user_id, date, claimed_by, coins_awarded, badges_awarded)
    values (p_user_id, p_date, case when p_type='ai' then 'compete-ai' else 'compete-friends' end, v_base, case when v_any_after = 3 then array['focused_learner']::text[] else '{}'::text[] end);
  end if;
  v_coins := greatest(0, v_coins + v_base);

  insert into public.compete_matches(user_id, date, type, difficulty, result, coins_awarded, gems_awarded)
  values (p_user_id, p_date, p_type, p_difficulty, p_result, v_coins, v_gems);

  perform * from public.add_balance_and_event(p_user_id, p_date, v_coins, v_gems, v_badges_delta, case when p_type='ai' then 'compete-ai' else 'compete-friends' end, v_meta);

  return query select v_coins, v_gems, v_badges;
end; $$;

-- XP leaderboard (seasonal by date window from reward_events)
create or replace function public.get_xp_leaderboard(
  p_from date default (date_trunc('month', now()::date))::date,
  p_to date default ((date_trunc('month', now()::date) + interval '1 month - 1 day'))::date,
  limit_n int default 50
) returns table (
  user_id uuid,
  display_name text,
  coins_sum int,
  gems_sum int,
  badges_sum int,
  xp int,
  rank int
) language sql security definer set search_path = public as $$
  with agg as (
    select user_id,
           sum(coins_delta)::int as coins_sum,
           sum(gems_delta)::int as gems_sum,
           sum(badges_delta)::int as badges_sum,
           (sum(coins_delta) + 5*sum(gems_delta) + 10*sum(badges_delta))::int as xp
    from public.reward_events
    where date between p_from and p_to
    group by user_id
  )
  select a.user_id,
         coalesce(p.full_name, 'Player') as display_name,
         a.coins_sum,
         a.gems_sum,
         a.badges_sum,
         a.xp,
         dense_rank() over (order by a.xp desc, a.coins_sum desc, a.gems_sum desc) as rank
  from agg a
  left join public.profiles p on p.id = a.user_id
  order by xp desc, coins_sum desc, gems_sum desc
  limit coalesce(limit_n,50);
$$;
