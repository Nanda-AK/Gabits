-- Seasonal rewards system (monthly XP leaderboard winners and stage boost tokens)
-- This file is idempotent and safe to re-run.

-- Table: seasonal_winners (top 3 winners per month)
create table if not exists public.seasonal_winners (
  id bigserial primary key,
  season text not null, -- 'YYYY-MM'
  rank int not null check (rank >= 1 and rank <= 3),
  user_id uuid not null references auth.users(id) on delete cascade,
  xp_earned int not null default 0,
  reward_coins int not null default 0,
  reward_gems int not null default 0,
  reward_boost_tokens int not null default 0,
  awarded_at timestamptz not null default now(),
  unique (season, rank)
);

create index if not exists idx_seasonal_winners_season on public.seasonal_winners(season);
create index if not exists idx_seasonal_winners_user on public.seasonal_winners(user_id);

alter table public.seasonal_winners enable row level security;

drop policy if exists "Anyone can read seasonal_winners" on public.seasonal_winners;
create policy "Anyone can read seasonal_winners" on public.seasonal_winners
  for select using (true);

drop policy if exists "Service can insert seasonal_winners" on public.seasonal_winners;
create policy "Service can insert seasonal_winners" on public.seasonal_winners
  for insert with check (true); -- Admin/cron only in practice

-- Table: stage_boost_tokens (redeemable tokens for skipping stages)
create table if not exists public.stage_boost_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tokens_available int not null default 0 check (tokens_available >= 0),
  tokens_used int not null default 0 check (tokens_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stage_boost_tokens enable row level security;

drop policy if exists "Read own stage_boost_tokens" on public.stage_boost_tokens;
create policy "Read own stage_boost_tokens" on public.stage_boost_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "Upsert own stage_boost_tokens" on public.stage_boost_tokens;
create policy "Upsert own stage_boost_tokens" on public.stage_boost_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists "Update own stage_boost_tokens" on public.stage_boost_tokens;
create policy "Update own stage_boost_tokens" on public.stage_boost_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists set_stage_boost_tokens_updated_at on public.stage_boost_tokens;
create trigger set_stage_boost_tokens_updated_at
before update on public.stage_boost_tokens
for each row execute function public.set_updated_at();

-- RPC: award_seasonal_top3
-- Admin/cron function to calculate and award top 3 winners for a season
drop function if exists public.award_seasonal_top3(text);

create or replace function public.award_seasonal_top3(p_season text)
returns table (
  rank int,
  user_id uuid,
  display_name text,
  xp_earned int,
  coins_awarded int,
  gems_awarded int,
  boost_tokens_awarded int
) language plpgsql security definer set search_path = public as $$
declare
  v_from date;
  v_to date;
  v_top3 record;
  v_coins int;
  v_gems int;
  v_tokens int;
begin
  -- Parse season YYYY-MM to date range
  v_from := (p_season || '-01')::date;
  v_to := (v_from + interval '1 month' - interval '1 day')::date;
  
  -- Get top 3 from XP leaderboard for the season (50 coins = 1 XP, 1 gem = 2 XP, 1 badge = 1 XP)
  for v_top3 in
    select 
      row_number() over (
        order by ((sum(coins_delta) / 50) + 2*sum(gems_delta) + sum(badges_delta)) desc
      ) as r,
      re.user_id,
      coalesce(p.full_name, 'Player') as name,
      ((sum(coins_delta) / 50) + 2*sum(gems_delta) + sum(badges_delta))::int as xp
    from public.reward_events re
    left join public.profiles p on p.id = re.user_id
    where re.date >= v_from and re.date <= v_to
    group by re.user_id, p.full_name
    order by xp desc
    limit 3
  loop
    -- Award based on rank
    if v_top3.r = 1 then
      v_coins := 500; v_gems := 50; v_tokens := 3;
    elsif v_top3.r = 2 then
      v_coins := 300; v_gems := 30; v_tokens := 2;
    else
      v_coins := 200; v_gems := 20; v_tokens := 1;
    end if;
    
    -- Record winner
    insert into public.seasonal_winners(season, rank, user_id, xp_earned, reward_coins, reward_gems, reward_boost_tokens)
    values (p_season, v_top3.r, v_top3.user_id, v_top3.xp, v_coins, v_gems, v_tokens)
    on conflict (season, rank) do nothing;
    
    -- Credit rewards to user_balances
    insert into public.user_balances(user_id, coins, gems, xp)
    values (v_top3.user_id, v_coins, v_gems, 0)
    on conflict (user_id) do update set
      coins = user_balances.coins + excluded.coins,
      gems = user_balances.gems + excluded.gems,
      updated_at = now();
    
    -- Add boost tokens
    insert into public.stage_boost_tokens(user_id, tokens_available)
    values (v_top3.user_id, v_tokens)
    on conflict (user_id) do update set
      tokens_available = stage_boost_tokens.tokens_available + excluded.tokens_available,
      updated_at = now();
    
    -- Return result row
    rank := v_top3.r;
    user_id := v_top3.user_id;
    display_name := v_top3.name;
    xp_earned := v_top3.xp;
    coins_awarded := v_coins;
    gems_awarded := v_gems;
    boost_tokens_awarded := v_tokens;
    return next;
  end loop;
end;
$$;

-- RPC: get_seasonal_winners
-- Fetch winners for a given season
drop function if exists public.get_seasonal_winners(text);

create or replace function public.get_seasonal_winners(p_season text)
returns table (
  rank int,
  user_id uuid,
  display_name text,
  xp_earned int,
  reward_coins int,
  reward_gems int,
  reward_boost_tokens int,
  awarded_at timestamptz
) language sql security definer set search_path = public as $$
  select 
    sw.rank,
    sw.user_id,
    coalesce(p.full_name, 'Player') as display_name,
    sw.xp_earned,
    sw.reward_coins,
    sw.reward_gems,
    sw.reward_boost_tokens,
    sw.awarded_at
  from public.seasonal_winners sw
  left join public.profiles p on p.id = sw.user_id
  where sw.season = p_season
  order by sw.rank asc;
$$;

-- RPC: use_boost_token
-- Redeem one boost token (e.g., skip a stage)
drop function if exists public.use_boost_token(uuid);

create or replace function public.use_boost_token(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_avail int;
begin
  -- Check if user has tokens
  select tokens_available into v_avail
  from public.stage_boost_tokens
  where user_id = p_user_id;
  
  if v_avail is null or v_avail <= 0 then
    return false;
  end if;
  
  -- Use one token
  update public.stage_boost_tokens
  set tokens_available = tokens_available - 1,
      tokens_used = tokens_used + 1,
      updated_at = now()
  where user_id = p_user_id;
  
  return true;
end;
$$;

-- RPC: get_my_tokens
-- Get current token balance
drop function if exists public.get_my_tokens(uuid);

create or replace function public.get_my_tokens(p_user_id uuid)
returns table (
  tokens_available int,
  tokens_used int
) language sql security definer set search_path = public as $$
  select tokens_available, tokens_used
  from public.stage_boost_tokens
  where user_id = p_user_id;
$$;
