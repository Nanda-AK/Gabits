-- Create profiles table to store onboarding data
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  age int check (age >= 5 and age <= 120),
  gender text check (gender in ('male','female','other')),
  standard text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;

-- Policies: only the user can read/insert/update their profile
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Insert own profile" on public.profiles;
create policy "Insert own profile" on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles
  for update
  using (auth.uid() = id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto insert a blank profile on new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
