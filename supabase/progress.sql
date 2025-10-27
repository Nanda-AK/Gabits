-- Daily question set and progress tracking

-- Table: daily_sets
create table if not exists public.daily_sets (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  difficulty text not null check (difficulty in ('easy','moderate','difficult')),
  question_ids int[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date, difficulty)
);

alter table public.daily_sets enable row level security;

drop policy if exists "Read own daily_sets" on public.daily_sets;
create policy "Read own daily_sets" on public.daily_sets
  for select using (auth.uid() = user_id);

drop policy if exists "Insert own daily_sets" on public.daily_sets;
create policy "Insert own daily_sets" on public.daily_sets
  for insert with check (auth.uid() = user_id);

drop policy if exists "Update own daily_sets" on public.daily_sets;
create policy "Update own daily_sets" on public.daily_sets
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Table: daily_progress
create table if not exists public.daily_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  difficulty text not null check (difficulty in ('easy','moderate','difficult')),
  correct_count int not null default 0,
  coins_earned int not null default 0,
  milestones jsonb not null default '{}'::jsonb,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date, difficulty)
);

alter table public.daily_progress enable row level security;

drop policy if exists "Read own daily_progress" on public.daily_progress;
create policy "Read own daily_progress" on public.daily_progress
  for select using (auth.uid() = user_id);

drop policy if exists "Insert own daily_progress" on public.daily_progress;
create policy "Insert own daily_progress" on public.daily_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "Update own daily_progress" on public.daily_progress;
create policy "Update own daily_progress" on public.daily_progress
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Reuse set_updated_at trigger function (defined in profiles.sql)
drop trigger if exists set_daily_sets_updated_at on public.daily_sets;
create trigger set_daily_sets_updated_at
before update on public.daily_sets
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_progress_updated_at on public.daily_progress;
create trigger set_daily_progress_updated_at
before update on public.daily_progress
for each row execute function public.set_updated_at();
