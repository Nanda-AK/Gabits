-- ============================================================
-- GABITS FRESH SUPABASE MIGRATION
-- Run this in SQL Editor of your NEW Supabase project
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- PART 1: HELPER FUNCTIONS
-- ============================================================

-- Updated_at trigger function (reused across tables)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Chapter name canonicalization
CREATE OR REPLACE FUNCTION public._canon_chapter(t TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(btrim(coalesce(t, '')))
$$;

-- ============================================================
-- PART 2: CORE TABLES
-- ============================================================

-- 2.1 PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT 'Player',
  age INT CHECK (age >= 5 AND age <= 120),
  gender TEXT CHECK (gender IN ('male','female','other')),
  standard TEXT,
  role TEXT CHECK (role IN ('student','parent','teacher','principal')),
  avatar_style TEXT,
  onboarded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2.2 USER BALANCES (coins, gems, xp)
CREATE TABLE IF NOT EXISTS public.user_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coins INT NOT NULL DEFAULT 0,
  gems INT NOT NULL DEFAULT 0,
  xp INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "balances_select_own" ON public.user_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "balances_insert_own" ON public.user_balances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "balances_update_own" ON public.user_balances FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER set_user_balances_updated_at
  BEFORE UPDATE ON public.user_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2.3 REWARD EVENTS (ledger for XP tracking)
CREATE TABLE IF NOT EXISTS public.reward_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('practice','speed','compete-ai','compete-friends')),
  coins_delta INT NOT NULL DEFAULT 0,
  gems_delta INT NOT NULL DEFAULT 0,
  badges_delta INT NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reward_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select_own" ON public.reward_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "events_insert_own" ON public.reward_events FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_reward_events_user_date ON public.reward_events(user_id, date);

-- 2.4 ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.achievements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta JSONB,
  PRIMARY KEY (user_id, key)
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievements_select_own" ON public.achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "achievements_insert_own" ON public.achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "achievements_update_own" ON public.achievements FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_achievements_user ON public.achievements(user_id);

-- 2.5 ACHIEVEMENT COUNTS (cumulative per badge type)
CREATE TABLE IF NOT EXISTS public.achievement_counts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, key)
);

ALTER TABLE public.achievement_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievement_counts_select_own" ON public.achievement_counts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "achievement_counts_insert_own" ON public.achievement_counts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "achievement_counts_update_own" ON public.achievement_counts FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- PART 3: DAILY PROGRESS & STREAKS
-- ============================================================

-- 3.1 DAILY SETS (question sets per day)
CREATE TABLE IF NOT EXISTS public.daily_sets (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','moderate','difficult')),
  question_ids INT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, date, difficulty)
);

ALTER TABLE public.daily_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_sets_select_own" ON public.daily_sets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "daily_sets_insert_own" ON public.daily_sets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "daily_sets_update_own" ON public.daily_sets FOR UPDATE USING (auth.uid() = user_id);

-- 3.2 DAILY PROGRESS
CREATE TABLE IF NOT EXISTS public.daily_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','moderate','difficult')),
  correct_count INT NOT NULL DEFAULT 0,
  coins_earned INT NOT NULL DEFAULT 0,
  milestones JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, date, difficulty)
);

ALTER TABLE public.daily_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_progress_select_own" ON public.daily_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "daily_progress_insert_own" ON public.daily_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "daily_progress_update_own" ON public.daily_progress FOR UPDATE USING (auth.uid() = user_id);

-- 3.3 ACTIVITY STREAKS (any-mode)
CREATE TABLE IF NOT EXISTS public.activity_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_date DATE,
  any_streak INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_streaks_select_own" ON public.activity_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "activity_streaks_insert_own" ON public.activity_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "activity_streaks_update_own" ON public.activity_streaks FOR UPDATE USING (auth.uid() = user_id);

-- 3.4 DAILY STREAK AWARDS
CREATE TABLE IF NOT EXISTS public.daily_streak_awards (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  claimed_by TEXT NOT NULL CHECK (claimed_by IN ('practice','speed','compete-ai','compete-friends')),
  coins_awarded INT NOT NULL DEFAULT 0,
  badges_awarded TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

ALTER TABLE public.daily_streak_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "streak_awards_select_own" ON public.daily_streak_awards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "streak_awards_insert_own" ON public.daily_streak_awards FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- PART 4: PRACTICE MODE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.practice_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT,
  topics_csv TEXT,
  chapter TEXT,
  total INT,
  correct INT,
  used_seconds INT NOT NULL DEFAULT 0,
  coins_awarded INT NOT NULL DEFAULT 0,
  gems_awarded INT NOT NULL DEFAULT 0,
  streak_after INT NOT NULL DEFAULT 1,
  is_weekend_bonus BOOLEAN NOT NULL DEFAULT FALSE,
  grants JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practice_sessions_select_own" ON public.practice_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "practice_sessions_insert_own" ON public.practice_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX practice_sessions_user_created_idx ON public.practice_sessions(user_id, created_at DESC);
CREATE INDEX practice_sessions_user_date_idx ON public.practice_sessions(user_id, date DESC);

CREATE TABLE IF NOT EXISTS public.practice_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_date DATE,
  any_streak INT NOT NULL DEFAULT 0,
  topic TEXT,
  topic_streak INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.practice_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practice_streaks_select_own" ON public.practice_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "practice_streaks_insert_own" ON public.practice_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "practice_streaks_update_own" ON public.practice_streaks FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.practice_seen_questions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')::DATE,
  chapter TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  question_id INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date, chapter, difficulty, question_id)
);

ALTER TABLE public.practice_seen_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seen_select_own" ON public.practice_seen_questions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "seen_insert_own" ON public.practice_seen_questions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX seen_user_date_chapter_idx ON public.practice_seen_questions(user_id, date, chapter);

-- ============================================================
-- PART 5: SPEED MODE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.speed_runs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','moderate','difficult')),
  correct_count INT NOT NULL DEFAULT 0,
  coins_earned INT NOT NULL DEFAULT 0,
  m10 BOOLEAN NOT NULL DEFAULT FALSE,
  m25 BOOLEAN NOT NULL DEFAULT FALSE,
  m50 BOOLEAN NOT NULL DEFAULT FALSE,
  m75 BOOLEAN NOT NULL DEFAULT FALSE,
  m100 BOOLEAN NOT NULL DEFAULT FALSE,
  fast_flawless BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.speed_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "speed_runs_select_own" ON public.speed_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "speed_runs_insert_own" ON public.speed_runs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.speed_totals (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_coins INT NOT NULL DEFAULT 0,
  total_correct INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.speed_totals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "speed_totals_select_own" ON public.speed_totals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "speed_totals_insert_own" ON public.speed_totals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "speed_totals_update_own" ON public.speed_totals FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.speed_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fff_streak INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.speed_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "speed_streaks_select_own" ON public.speed_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "speed_streaks_insert_own" ON public.speed_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "speed_streaks_update_own" ON public.speed_streaks FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.speed_achievements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL CHECK (key IN ('m10','m25','m50','m75','m100')),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, key)
);

ALTER TABLE public.speed_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "speed_achievements_select_own" ON public.speed_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "speed_achievements_insert_own" ON public.speed_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- PART 6: COMPETE MODE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.compete_matches (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ai','friends')),
  difficulty TEXT,
  result TEXT NOT NULL CHECK (result IN ('win','loss','draw')),
  coins_awarded INT NOT NULL DEFAULT 0,
  gems_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.compete_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compete_matches_select_own" ON public.compete_matches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "compete_matches_insert_own" ON public.compete_matches FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.compete_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_win_streak INT NOT NULL DEFAULT 0,
  friends_win_streak INT NOT NULL DEFAULT 0,
  ai_matches INT NOT NULL DEFAULT 0,
  friend_matches INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.compete_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compete_streaks_select_own" ON public.compete_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "compete_streaks_insert_own" ON public.compete_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "compete_streaks_update_own" ON public.compete_streaks FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- PART 7: TEACHER LIVE TASKS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.live_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('practice','speed','battle-ai','battle-friends')),
  topics_csv TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy','moderate','difficult')),
  chapter TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.live_tasks ENABLE ROW LEVEL SECURITY;

-- Students can see active tasks
CREATE POLICY "live_tasks_select_active" ON public.live_tasks
  FOR SELECT TO authenticated USING (status = 'active');

-- Teachers can also see their own ended tasks
CREATE POLICY "live_tasks_select_own" ON public.live_tasks
  FOR SELECT TO authenticated USING (created_by = auth.uid());

-- Only teachers can create
CREATE POLICY "live_tasks_insert_teacher" ON public.live_tasks
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );

-- Only owner can update (end task)
CREATE POLICY "live_tasks_update_own" ON public.live_tasks
  FOR UPDATE TO authenticated USING (created_by = auth.uid());

CREATE INDEX idx_live_tasks_status ON public.live_tasks(status);
CREATE INDEX idx_live_tasks_created_by ON public.live_tasks(created_by);
CREATE INDEX idx_live_tasks_active ON public.live_tasks(started_at) WHERE status = 'active';

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_tasks;

-- ============================================================
-- PART 8: TASK RUNS (student progress on tasks)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.live_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('practice','speed','battle-ai','battle-friends')),
  difficulty TEXT CHECK (difficulty IN ('easy','moderate','difficult')),
  topics_csv TEXT,
  chapter TEXT,
  display_name TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total INT,
  correct INT,
  time_ms INT,
  hearts_left INT,
  hints_used INT,
  coins_earned INT,
  details JSONB,
  status TEXT NOT NULL DEFAULT 'abandoned' CHECK (status IN ('completed','abandoned'))
);

ALTER TABLE public.task_runs ENABLE ROW LEVEL SECURITY;

-- Students can see their own runs
CREATE POLICY "task_runs_select_own" ON public.task_runs
  FOR SELECT USING (auth.uid() = user_id);

-- Teachers can see runs on their tasks
CREATE POLICY "task_runs_select_teacher" ON public.task_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.live_tasks lt
      WHERE lt.id = task_runs.task_id AND lt.created_by = auth.uid()
    )
  );

-- Anyone can insert (guests allowed)
CREATE POLICY "task_runs_insert_any" ON public.task_runs
  FOR INSERT WITH CHECK (TRUE);

-- Users can update their own runs
CREATE POLICY "task_runs_update_own" ON public.task_runs
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

CREATE INDEX task_runs_user_task_idx ON public.task_runs(user_id, task_id, status);
CREATE INDEX task_runs_user_chapter_mode_idx ON public.task_runs(user_id, chapter, mode, completed_at DESC);

-- ============================================================
-- PART 9: CHAPTER MODE UNLOCKS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chapter_mode_unlocks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('practice','speed','battle-ai','battle-friends')),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, chapter, mode)
);

ALTER TABLE public.chapter_mode_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cmu_select_own" ON public.chapter_mode_unlocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cmu_insert_own" ON public.chapter_mode_unlocks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX cmu_user_chapter_mode_idx ON public.chapter_mode_unlocks(user_id, chapter, mode);

CREATE TABLE IF NOT EXISTS public.chapter_mode_runs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('practice','speed','battle-ai','battle-friends')),
  difficulty TEXT CHECK (difficulty IN ('easy','moderate','difficult')),
  total INT NOT NULL DEFAULT 0,
  correct INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.chapter_mode_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chapter_mode_runs_select_own" ON public.chapter_mode_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chapter_mode_runs_insert_own" ON public.chapter_mode_runs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX chapter_mode_runs_unlock_idx ON public.chapter_mode_runs(user_id, chapter, mode, completed_at DESC);

-- Legacy speed unlocks (for compatibility)
CREATE TABLE IF NOT EXISTS public.speed_unlocks_chapter (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, chapter)
);

ALTER TABLE public.speed_unlocks_chapter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unlock_select_own" ON public.speed_unlocks_chapter FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "unlock_insert_own" ON public.speed_unlocks_chapter FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX speed_unlocks_user_chapter_idx ON public.speed_unlocks_chapter(user_id, chapter);

-- ============================================================
-- PART 10: LEGACY TOTALS (for old leaderboard)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_totals (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_coins BIGINT NOT NULL DEFAULT 0,
  total_correct BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_totals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_totals_select_all" ON public.user_totals FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "user_totals_insert_own" ON public.user_totals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_totals_update_own" ON public.user_totals FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- PART 11: BATTLE AI TABLES
-- ============================================================

-- 11.1 BATTLE PERFORMANCE (aggregated daily performance per difficulty/type)
CREATE TABLE IF NOT EXISTS public.battle_performance (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','moderate','difficult')),
  math_type TEXT NOT NULL,
  student_points INT NOT NULL DEFAULT 0,
  ai_points INT NOT NULL DEFAULT 0,
  result TEXT NOT NULL CHECK (result IN ('win','loss','draw')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.battle_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "battle_perf_select_own" ON public.battle_performance
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "battle_perf_insert_own" ON public.battle_performance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX battle_perf_user_date_idx ON public.battle_performance(user_id, date);
CREATE INDEX battle_perf_user_difficulty_idx ON public.battle_performance(user_id, difficulty);

-- 11.2 BATTLE MATCHES (detailed per-question logs for replay/analysis)
CREATE TABLE IF NOT EXISTS public.battle_matches (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','moderate','difficult')),
  student_correct JSONB NOT NULL DEFAULT '[]',
  student_times_ms JSONB NOT NULL DEFAULT '[]',
  ai_correct JSONB NOT NULL DEFAULT '[]',
  ai_times_ms JSONB NOT NULL DEFAULT '[]',
  winners JSONB NOT NULL DEFAULT '[]',
  student_points INT NOT NULL DEFAULT 0,
  ai_points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.battle_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "battle_match_select_own" ON public.battle_matches
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "battle_match_insert_own" ON public.battle_matches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX battle_match_user_date_idx ON public.battle_matches(user_id, date);
