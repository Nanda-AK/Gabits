-- ============================================================
-- GABITS FRESH SUPABASE MIGRATION - PART 2: FUNCTIONS & RPCs
-- Run AFTER 001_tables.sql
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Increment badge count
CREATE OR REPLACE FUNCTION public.increment_badge_count(
  p_user_id UUID,
  p_key TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.achievement_counts AS c(user_id, key, count)
  VALUES (p_user_id, p_key, 1)
  ON CONFLICT (user_id, key) DO UPDATE SET count = c.count + 1;

  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE user_id = p_user_id AND key = p_key) THEN
    INSERT INTO public.achievements(user_id, key, unlocked_at)
    VALUES (p_user_id, p_key, NOW())
    ON CONFLICT (user_id, key) DO NOTHING;
  END IF;
END;
$$;

-- Update any-mode streak
CREATE OR REPLACE FUNCTION public.update_any_streak(
  p_user_id UUID,
  p_date DATE
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last_date DATE;
  v_any INT;
  v_any_after INT;
BEGIN
  SELECT last_date, any_streak INTO v_last_date, v_any
  FROM public.activity_streaks WHERE user_id = p_user_id;

  IF v_last_date IS NULL THEN v_any := 0; END IF;

  IF v_last_date IS NOT NULL AND p_date = v_last_date + 1 THEN
    v_any_after := v_any + 1;
  ELSE
    v_any_after := 1;
  END IF;

  INSERT INTO public.activity_streaks(user_id, last_date, any_streak)
  VALUES (p_user_id, p_date, v_any_after)
  ON CONFLICT (user_id) DO UPDATE
    SET last_date = excluded.last_date,
        any_streak = excluded.any_streak,
        updated_at = NOW();

  RETURN v_any_after;
END;
$$;

-- Add balance and record event atomically
CREATE OR REPLACE FUNCTION public.add_balance_and_event(
  p_user_id UUID,
  p_date DATE,
  p_coins INT,
  p_gems INT,
  p_badges_delta INT,
  p_source TEXT,
  p_meta JSONB DEFAULT '{}'::jsonb
) RETURNS TABLE (coins_delta INT, gems_delta INT, badges_delta INT, xp_delta INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_balances AS b (user_id, coins, gems, xp)
  VALUES (
    p_user_id,
    GREATEST(0, p_coins),
    GREATEST(0, p_gems),
    GREATEST(0, (p_coins / 50) + 2*p_gems + p_badges_delta)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    coins = GREATEST(0, b.coins + p_coins),
    gems  = GREATEST(0, b.gems + p_gems),
    xp    = GREATEST(0, b.xp + ((p_coins / 50) + 2*p_gems + p_badges_delta)),
    updated_at = NOW();

  INSERT INTO public.reward_events(user_id, date, source, coins_delta, gems_delta, badges_delta, meta)
  VALUES (p_user_id, p_date, p_source, p_coins, p_gems, p_badges_delta, COALESCE(p_meta, '{}'::jsonb));

  RETURN QUERY SELECT p_coins, p_gems, p_badges_delta, ((p_coins / 50) + 2*p_gems + p_badges_delta);
END;
$$;

-- Increment speed totals
CREATE OR REPLACE FUNCTION public.increment_speed_totals(
  p_user_id UUID,
  p_coin_delta INT,
  p_correct_delta INT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.speed_totals AS t (user_id, total_coins, total_correct)
  VALUES (p_user_id, GREATEST(0, p_coin_delta), GREATEST(0, p_correct_delta))
  ON CONFLICT (user_id) DO UPDATE SET
    total_coins = GREATEST(0, t.total_coins + p_coin_delta),
    total_correct = GREATEST(0, t.total_correct + p_correct_delta),
    updated_at = NOW();
END;
$$;

-- Increment user totals (legacy)
CREATE OR REPLACE FUNCTION public.increment_user_totals(
  p_user_id UUID,
  p_coin_delta BIGINT,
  p_correct_delta BIGINT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_totals (user_id, total_coins, total_correct, updated_at)
  VALUES (p_user_id, GREATEST(p_coin_delta,0), GREATEST(p_correct_delta,0), NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET total_coins = public.user_totals.total_coins + GREATEST(p_coin_delta,0),
        total_correct = public.user_totals.total_correct + GREATEST(p_correct_delta,0),
        updated_at = NOW();
END;
$$;

-- ============================================================
-- PRACTICE MODE RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.grant_practice_rewards(
  p_user_id UUID,
  p_topic TEXT,
  p_used_seconds INT,
  p_date DATE,
  p_question_coins INT DEFAULT 0
) RETURNS TABLE (
  coins_awarded INT,
  gems_awarded INT,
  streak_after INT,
  badges_awarded TEXT[]
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last_date DATE;
  v_any INT;
  v_topic TEXT;
  v_topic_streak INT;
  v_is_weekend BOOLEAN;
  v_coins INT := 0;
  v_gems INT := 0;
  v_badges TEXT[] := '{}';
  v_any_after INT;
  v_topic_after INT;
  v_sessions_today INT;
  v_seconds_today INT;
  v_grants JSONB := '{}'::jsonb;
  v_badges_delta INT := 0;
  v_mult NUMERIC := 1.0;
BEGIN
  -- Enforce per-day caps
  SELECT COUNT(*), COALESCE(SUM(used_seconds),0)
  INTO v_sessions_today, v_seconds_today
  FROM public.practice_sessions
  WHERE user_id = p_user_id AND date = p_date;

  IF v_sessions_today >= 3 OR v_seconds_today >= 1800 THEN
    RETURN QUERY SELECT 0, 0, 0, ARRAY[]::TEXT[];
    RETURN;
  END IF;

  -- Load current streak state
  SELECT last_date, any_streak, topic, topic_streak 
  INTO v_last_date, v_any, v_topic, v_topic_streak
  FROM public.practice_streaks WHERE user_id = p_user_id;

  IF v_last_date IS NULL THEN
    v_any := 0; v_topic_streak := 0; v_topic := NULL;
  END IF;

  IF v_last_date IS NOT NULL AND p_date = v_last_date + 1 THEN
    v_any_after := v_any + 1;
    v_topic_after := CASE WHEN v_topic = p_topic THEN v_topic_streak + 1 ELSE 1 END;
  ELSE
    v_any_after := 1;
    v_topic_after := 1;
  END IF;

  -- Any-mode streak
  v_any_after := public.update_any_streak(p_user_id, p_date);
  
  IF NOT EXISTS (SELECT 1 FROM public.daily_streak_awards WHERE user_id = p_user_id AND date = p_date) THEN
    IF v_any_after = 1 THEN v_coins := v_coins + 3; END IF;
    IF v_any_after = 2 THEN v_coins := v_coins + 5; END IF;
    IF v_any_after = 3 THEN 
      v_coins := v_coins + 8;
      PERFORM public.increment_badge_count(p_user_id, 'focused_learner');
      v_badges := array_append(v_badges, 'focused_learner'); 
      v_badges_delta := v_badges_delta + 1;
    END IF;
  END IF;
  
  IF v_any_after >= 4 AND v_topic_after >= 4 THEN v_coins := v_coins + 10; END IF;
  IF v_any_after >= 5 AND v_topic_after >= 5 THEN 
    v_coins := v_coins + 15;
    IF v_topic_after = 5 THEN
      PERFORM public.increment_badge_count(p_user_id, 'math_explorer');
      v_badges := array_append(v_badges, 'math_explorer'); 
      v_badges_delta := v_badges_delta + 1;
    END IF;
  END IF;

  -- Add per-question coins
  v_coins := v_coins + GREATEST(0, COALESCE(p_question_coins, 0));

  -- Weekend bonus +20%
  v_is_weekend := EXTRACT(DOW FROM p_date) IN (0,6);
  IF v_is_weekend THEN v_mult := 1.2; END IF;
  v_coins := FLOOR(v_coins * v_mult);

  -- Mark streak bonus as claimed
  IF NOT EXISTS (SELECT 1 FROM public.daily_streak_awards WHERE user_id = p_user_id AND date = p_date) THEN
    INSERT INTO public.daily_streak_awards(user_id, date, claimed_by, coins_awarded, badges_awarded)
    VALUES (p_user_id, p_date, 'practice', v_coins, v_badges);
  END IF;

  -- Persist session
  INSERT INTO public.practice_sessions(user_id, date, topic, used_seconds, coins_awarded, gems_awarded, streak_after, is_weekend_bonus, grants)
  VALUES (p_user_id, p_date, p_topic, p_used_seconds, v_coins, v_gems, v_any_after, v_is_weekend, v_grants);

  -- Update streaks state
  INSERT INTO public.practice_streaks AS s (user_id, last_date, any_streak, topic, topic_streak)
  VALUES (p_user_id, p_date, v_any_after, p_topic, v_topic_after)
  ON CONFLICT (user_id) DO UPDATE SET
    last_date = excluded.last_date,
    any_streak = excluded.any_streak,
    topic = excluded.topic,
    topic_streak = excluded.topic_streak,
    updated_at = NOW();

  -- Update balances
  PERFORM * FROM public.add_balance_and_event(p_user_id, p_date, v_coins, v_gems, v_badges_delta, 'practice', v_grants);

  RETURN QUERY SELECT v_coins, v_gems, v_any_after, v_badges;
END;
$$;

-- ============================================================
-- SPEED MODE RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_speed_run(
  p_user_id UUID,
  p_date DATE,
  p_difficulty TEXT,
  p_correct INT,
  p_coins INT,
  p_m10 BOOLEAN,
  p_m25 BOOLEAN,
  p_m50 BOOLEAN,
  p_m75 BOOLEAN,
  p_m100 BOOLEAN,
  p_fast_flawless BOOLEAN
) RETURNS TABLE (coins_awarded INT, gems_awarded INT, badges_awarded TEXT[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_acc NUMERIC := GREATEST(0, LEAST(1, p_correct::NUMERIC / 10.0));
  v_gems INT := 0;
  v_badges TEXT[] := '{}';
  v_badges_delta INT := 0;
  v_meta JSONB := jsonb_build_object('difficulty', p_difficulty, 'acc', v_acc);
  v_streak INT;
BEGIN
  IF v_acc >= 1 THEN v_gems := v_gems + 3; 
  ELSIF v_acc >= 0.70 THEN v_gems := v_gems + 2; 
  END IF;

  INSERT INTO public.speed_runs(user_id, date, difficulty, correct_count, coins_earned, m10, m25, m50, m75, m100, fast_flawless)
  VALUES (p_user_id, p_date, p_difficulty, p_correct, p_coins, p_m10, p_m25, p_m50, p_m75, p_m100, p_fast_flawless);

  -- Fast & Flawless streak
  IF p_fast_flawless THEN
    INSERT INTO public.speed_streaks(user_id, fff_streak)
    VALUES (p_user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET fff_streak = public.speed_streaks.fff_streak + 1, updated_at = NOW()
    RETURNING fff_streak INTO v_streak;
  ELSE
    INSERT INTO public.speed_streaks(user_id, fff_streak)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO UPDATE SET fff_streak = 0, updated_at = NOW()
    RETURNING fff_streak INTO v_streak;
  END IF;

  IF v_streak >= 3 THEN
    v_gems := v_gems + 5;
    IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE user_id = p_user_id AND key = 'speed_master') THEN
      INSERT INTO public.achievements(user_id, key, unlocked_at) VALUES (p_user_id, 'speed_master', NOW())
      ON CONFLICT (user_id, key) DO NOTHING;
      v_badges := array_append(v_badges, 'speed_master'); 
      v_badges_delta := v_badges_delta + 1;
    END IF;
    UPDATE public.speed_streaks SET fff_streak = 0, updated_at = NOW() WHERE user_id = p_user_id;
  END IF;

  PERFORM * FROM public.increment_speed_totals(p_user_id, p_coins, p_correct);
  PERFORM * FROM public.add_balance_and_event(p_user_id, p_date, p_coins, v_gems, v_badges_delta, 'speed', v_meta);

  RETURN QUERY SELECT p_coins, v_gems, v_badges;
END;
$$;

-- ============================================================
-- COMPETE MODE RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.grant_compete_rewards(
  p_user_id UUID,
  p_type TEXT,
  p_date DATE,
  p_difficulty TEXT,
  p_result TEXT
) RETURNS TABLE (coins_awarded INT, gems_awarded INT, badges_awarded TEXT[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_coins INT := 0;
  v_gems INT := 0;
  v_badges TEXT[] := '{}';
  v_badges_delta INT := 0;
  v_mult NUMERIC := 1.0;
  v_ai INT;
  v_fr INT;
  v_ai_ws INT;
  v_fr_ws INT;
  v_meta JSONB := jsonb_build_object('type', p_type, 'difficulty', p_difficulty, 'result', p_result);
BEGIN
  IF p_type = 'ai' THEN
    v_coins := v_coins + 5;
    IF p_result = 'win' THEN v_coins := v_coins + 15; END IF;
    IF p_difficulty = 'moderate' THEN v_mult := 1.2; END IF;
    IF p_difficulty = 'difficult' THEN v_mult := 1.5; END IF;
    v_coins := FLOOR(v_coins * v_mult);

    INSERT INTO public.compete_streaks(user_id, ai_win_streak, ai_matches)
    VALUES (p_user_id, CASE WHEN p_result = 'win' THEN 1 ELSE 0 END, 1)
    ON CONFLICT (user_id) DO UPDATE SET
      ai_win_streak = CASE WHEN p_result = 'win' THEN public.compete_streaks.ai_win_streak + 1 ELSE 0 END,
      ai_matches = public.compete_streaks.ai_matches + 1,
      updated_at = NOW()
    RETURNING ai_win_streak, ai_matches INTO v_ai_ws, v_ai;

    IF v_ai_ws >= 3 THEN
      v_gems := v_gems + 3;
      UPDATE public.compete_streaks SET ai_win_streak = 0, updated_at = NOW() WHERE user_id = p_user_id;
    END IF;

    IF v_ai >= 10 THEN
      IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE user_id = p_user_id AND key = 'ai_challenger') THEN
        INSERT INTO public.achievements(user_id, key, unlocked_at) VALUES (p_user_id, 'ai_challenger', NOW())
        ON CONFLICT (user_id, key) DO NOTHING;
        v_badges := array_append(v_badges, 'ai_challenger'); 
        v_badges_delta := v_badges_delta + 1;
      END IF;
    END IF;

  ELSIF p_type = 'friends' THEN
    IF p_result = 'draw' THEN v_coins := v_coins + 10; 
    ELSE v_coins := v_coins + 10 + CASE WHEN p_result = 'win' THEN 15 ELSE 0 END; 
    END IF;

    INSERT INTO public.compete_streaks(user_id, friends_win_streak, friend_matches)
    VALUES (p_user_id, CASE WHEN p_result = 'win' THEN 1 ELSE 0 END, 1)
    ON CONFLICT (user_id) DO UPDATE SET
      friends_win_streak = CASE WHEN p_result = 'win' THEN public.compete_streaks.friends_win_streak + 1 ELSE 0 END,
      friend_matches = public.compete_streaks.friend_matches + 1,
      updated_at = NOW()
    RETURNING friends_win_streak, friend_matches INTO v_fr_ws, v_fr;

    IF v_fr_ws >= 3 THEN
      v_gems := v_gems + 5;
      UPDATE public.compete_streaks SET friends_win_streak = 0, updated_at = NOW() WHERE user_id = p_user_id;
    END IF;

    IF v_fr >= 10 THEN
      IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE user_id = p_user_id AND key = 'social_legend') THEN
        INSERT INTO public.achievements(user_id, key, unlocked_at) VALUES (p_user_id, 'social_legend', NOW())
        ON CONFLICT (user_id, key) DO NOTHING;
        v_badges := array_append(v_badges, 'social_legend'); 
        v_badges_delta := v_badges_delta + 1;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.compete_matches(user_id, date, type, difficulty, result, coins_awarded, gems_awarded)
  VALUES (p_user_id, p_date, p_type, p_difficulty, p_result, v_coins, v_gems);

  PERFORM * FROM public.add_balance_and_event(
    p_user_id, p_date, v_coins, v_gems, v_badges_delta, 
    CASE WHEN p_type='ai' THEN 'compete-ai' ELSE 'compete-friends' END, 
    v_meta
  );

  RETURN QUERY SELECT v_coins, v_gems, v_badges;
END;
$$;

-- ============================================================
-- CHAPTER MODE UNLOCK FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_chapter_mode_unlock(
  p_user_id UUID,
  p_chapter TEXT,
  p_mode TEXT,
  p_threshold NUMERIC DEFAULT 0.8,
  p_window INT DEFAULT 3
) RETURNS TABLE (unlocked BOOLEAN, avg NUMERIC, count INT, unlocked_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  canon TEXT := public._canon_chapter(p_chapter);
  check_mode TEXT;
  v_avg NUMERIC := 0;
  v_cnt INT := 0;
  v_unlocked BOOLEAN := FALSE;
  v_time TIMESTAMPTZ := NULL;
BEGIN
  -- Map mode to prerequisite
  CASE p_mode
    WHEN 'speed' THEN check_mode := 'practice';
    WHEN 'battle-ai' THEN check_mode := 'speed';
    WHEN 'battle-friends' THEN check_mode := 'battle-ai';
    ELSE check_mode := p_mode;
  END CASE;

  -- Check if already unlocked
  SELECT TRUE, cmu.unlocked_at INTO v_unlocked, v_time
  FROM public.chapter_mode_unlocks cmu
  WHERE cmu.user_id = p_user_id
    AND public._canon_chapter(cmu.chapter) = canon
    AND cmu.mode = p_mode
  LIMIT 1;

  IF v_unlocked THEN
    RETURN QUERY SELECT TRUE, v_avg, v_cnt, v_time;
    RETURN;
  END IF;

  -- Check performance in prerequisite mode
  WITH recent AS (
    SELECT total, correct
    FROM public.chapter_mode_runs
    WHERE user_id = p_user_id
      AND mode = check_mode
      AND public._canon_chapter(chapter) = canon
      AND total > 0
    ORDER BY completed_at DESC
    LIMIT p_window
  ), ratios AS (
    SELECT LEAST(1.0, GREATEST(0.0, correct::NUMERIC / NULLIF(total, 0))) AS r FROM recent
  )
  SELECT COALESCE(AVG(r), 0), COUNT(*) INTO v_avg, v_cnt FROM ratios;

  IF v_cnt >= p_window AND v_avg >= p_threshold THEN
    INSERT INTO public.chapter_mode_unlocks(user_id, chapter, mode)
    VALUES (p_user_id, p_chapter, p_mode)
    ON CONFLICT (user_id, chapter, mode) DO NOTHING;

    SELECT cmu.unlocked_at INTO v_time
    FROM public.chapter_mode_unlocks cmu
    WHERE cmu.user_id = p_user_id
      AND public._canon_chapter(cmu.chapter) = canon
      AND cmu.mode = p_mode
    LIMIT 1;

    RETURN QUERY SELECT TRUE, v_avg, v_cnt, v_time;
  END IF;

  RETURN QUERY SELECT FALSE, v_avg, v_cnt, NULL::TIMESTAMPTZ;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_chapter_mode_unlock(
  p_user_id UUID,
  p_chapter TEXT,
  p_mode TEXT,
  p_threshold NUMERIC DEFAULT 0.8,
  p_window INT DEFAULT 3
) RETURNS TABLE (unlocked BOOLEAN, avg NUMERIC, count INT, unlocked_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.ensure_chapter_mode_unlock(p_user_id, p_chapter, p_mode, p_threshold, p_window);
$$;

CREATE OR REPLACE FUNCTION public.get_chapter_mode_unlock_for_teacher(
  p_teacher_id UUID,
  p_student_id UUID,
  p_chapter TEXT,
  p_mode TEXT,
  p_threshold NUMERIC DEFAULT 0.8,
  p_window INT DEFAULT 3
) RETURNS TABLE (unlocked BOOLEAN, avg NUMERIC, count INT, unlocked_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE role_txt TEXT;
BEGIN
  SELECT role INTO role_txt FROM public.profiles WHERE id = p_teacher_id;
  IF role_txt IS DISTINCT FROM 'teacher' THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, 0::INT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.get_chapter_mode_unlock(p_student_id, p_chapter, p_mode, p_threshold, p_window);
END;
$$;

-- Aliases for speed unlock (backward compatibility)
CREATE OR REPLACE FUNCTION public.ensure_chapter_speed_unlock(
  p_user_id UUID, p_chapter TEXT, p_threshold NUMERIC DEFAULT 0.8, p_window INT DEFAULT 3
) RETURNS TABLE (unlocked BOOLEAN, avg NUMERIC, count INT, unlocked_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.ensure_chapter_mode_unlock(p_user_id, p_chapter, 'speed', p_threshold, p_window);
$$;

CREATE OR REPLACE FUNCTION public.get_chapter_speed_unlock(
  p_user_id UUID, p_chapter TEXT, p_threshold NUMERIC DEFAULT 0.8, p_window INT DEFAULT 3
) RETURNS TABLE (unlocked BOOLEAN, avg NUMERIC, count INT, unlocked_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.get_chapter_mode_unlock(p_user_id, p_chapter, 'speed', p_threshold, p_window);
$$;

CREATE OR REPLACE FUNCTION public.get_chapter_speed_unlock_for_teacher(
  p_teacher_id UUID, p_student_id UUID, p_chapter TEXT, p_threshold NUMERIC DEFAULT 0.8, p_window INT DEFAULT 3
) RETURNS TABLE (unlocked BOOLEAN, avg NUMERIC, count INT, unlocked_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.get_chapter_mode_unlock_for_teacher(p_teacher_id, p_student_id, p_chapter, 'speed', p_threshold, p_window);
$$;

-- ============================================================
-- STUDENT TASK STATUSES
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_student_task_statuses(p_user_id UUID)
RETURNS TABLE (
  task_id UUID,
  chapter TEXT,
  status TEXT,
  speed_unlocked BOOLEAN,
  ai_unlocked BOOLEAN,
  friends_unlocked BOOLEAN,
  runs_count INT,
  last_run_at TIMESTAMPTZ
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
WITH t AS (
  SELECT id, chapter FROM public.live_tasks WHERE status = 'active'
),
runs AS (
  SELECT task_id, COUNT(*)::INT AS cnt, MAX(COALESCE(completed_at, started_at)) AS last_at
  FROM public.task_runs
  WHERE user_id = p_user_id
  GROUP BY task_id
),
u AS (
  SELECT chapter, mode, TRUE AS unlocked
  FROM public.chapter_mode_unlocks
  WHERE user_id = p_user_id
)
SELECT
  t.id AS task_id,
  t.chapter,
  CASE
    WHEN COALESCE((SELECT unlocked FROM u WHERE public._canon_chapter(u.chapter)=public._canon_chapter(t.chapter) AND u.mode='speed'), FALSE)
      THEN 'completed'
    WHEN COALESCE(r.cnt,0) > 0 THEN 'in_progress'
    ELSE 'not_started'
  END AS status,
  COALESCE((SELECT unlocked FROM u WHERE public._canon_chapter(u.chapter)=public._canon_chapter(t.chapter) AND u.mode='speed'), FALSE) AS speed_unlocked,
  COALESCE((SELECT unlocked FROM u WHERE public._canon_chapter(u.chapter)=public._canon_chapter(t.chapter) AND u.mode='battle-ai'), FALSE) AS ai_unlocked,
  COALESCE((SELECT unlocked FROM u WHERE public._canon_chapter(u.chapter)=public._canon_chapter(t.chapter) AND u.mode='battle-friends'), FALSE) AS friends_unlocked,
  COALESCE(r.cnt,0) AS runs_count,
  r.last_at AS last_run_at
FROM t
LEFT JOIN runs r ON r.task_id = t.id;
$$;

-- ============================================================
-- LEADERBOARDS
-- ============================================================

-- All-time XP leaderboard
CREATE OR REPLACE FUNCTION public.get_all_time_xp_leaderboard(limit_n INT DEFAULT 50)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  avatar_style TEXT,
  xp INT,
  rank INT
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    b.user_id,
    COALESCE(p.full_name, 'Player') AS display_name,
    p.avatar_style,
    COALESCE(b.xp, 0)::INT AS xp,
    DENSE_RANK() OVER (ORDER BY COALESCE(b.xp, 0) DESC)::INT AS rank
  FROM public.user_balances b
  LEFT JOIN public.profiles p ON p.id = b.user_id
  WHERE COALESCE(b.xp, 0) > 0
  ORDER BY xp DESC
  LIMIT COALESCE(limit_n, 50);
$$;

-- Seasonal XP leaderboard
CREATE OR REPLACE FUNCTION public.get_xp_leaderboard(
  p_from DATE DEFAULT (date_trunc('month', NOW()::DATE))::DATE,
  p_to DATE DEFAULT ((date_trunc('month', NOW()::DATE) + interval '1 month - 1 day'))::DATE,
  limit_n INT DEFAULT 50
) RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  coins_sum INT,
  gems_sum INT,
  badges_sum INT,
  xp INT,
  rank INT
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH agg AS (
    SELECT user_id,
           SUM(coins_delta)::INT AS coins_sum,
           SUM(gems_delta)::INT AS gems_sum,
           SUM(badges_delta)::INT AS badges_sum,
           (SUM(coins_delta) + 5*SUM(gems_delta) + 10*SUM(badges_delta))::INT AS xp
    FROM public.reward_events
    WHERE date BETWEEN p_from AND p_to
    GROUP BY user_id
  )
  SELECT a.user_id,
         COALESCE(p.full_name, 'Player') AS display_name,
         a.coins_sum,
         a.gems_sum,
         a.badges_sum,
         a.xp,
         DENSE_RANK() OVER (ORDER BY a.xp DESC, a.coins_sum DESC, a.gems_sum DESC)::INT AS rank
  FROM agg a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  ORDER BY xp DESC, coins_sum DESC, gems_sum DESC
  LIMIT COALESCE(limit_n,50);
$$;

-- Legacy leaderboard view
CREATE OR REPLACE VIEW public.leaderboard_view AS
SELECT
  t.user_id,
  COALESCE(p.full_name, 'Player') AS display_name,
  t.total_coins::BIGINT AS total_coins,
  t.total_correct::BIGINT AS total_correct
FROM public.user_totals t
LEFT JOIN public.profiles p ON p.id = t.user_id;

CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_n INT DEFAULT 50)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  total_coins BIGINT,
  total_correct BIGINT,
  rank BIGINT
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    user_id,
    display_name,
    total_coins,
    total_correct,
    DENSE_RANK() OVER (ORDER BY total_coins DESC, total_correct DESC) AS rank
  FROM public.leaderboard_view
  ORDER BY total_coins DESC, total_correct DESC
  LIMIT COALESCE(limit_n, 50);
$$;

-- Speed leaderboard
CREATE OR REPLACE VIEW public.speed_achievements_pivot AS
SELECT
  u.user_id,
  BOOL_OR(u.key = 'm25') AS has_m25,
  BOOL_OR(u.key = 'm50') AS has_m50,
  BOOL_OR(u.key = 'm75') AS has_m75,
  BOOL_OR(u.key = 'm100') AS has_m100
FROM public.speed_achievements u
GROUP BY u.user_id;

CREATE OR REPLACE VIEW public.speed_leaderboard_view AS
SELECT
  st.user_id,
  COALESCE(p.full_name, 'Player') AS display_name,
  st.total_coins,
  st.total_correct,
  COALESCE(ap.has_m25, FALSE) AS has_m25,
  COALESCE(ap.has_m50, FALSE) AS has_m50,
  COALESCE(ap.has_m75, FALSE) AS has_m75,
  COALESCE(ap.has_m100, FALSE) AS has_m100
FROM public.speed_totals st
LEFT JOIN public.profiles p ON p.id = st.user_id
LEFT JOIN public.speed_achievements_pivot ap ON ap.user_id = st.user_id;

CREATE OR REPLACE FUNCTION public.get_speed_leaderboard(limit_n INT DEFAULT 50)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  total_coins INT,
  total_correct INT,
  has_m25 BOOLEAN,
  has_m50 BOOLEAN,
  has_m75 BOOLEAN,
  has_m100 BOOLEAN,
  rank INT
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, display_name, total_coins, total_correct,
         has_m25, has_m50, has_m75, has_m100,
         DENSE_RANK() OVER (ORDER BY total_coins DESC, total_correct DESC)::INT AS rank
  FROM public.speed_leaderboard_view
  ORDER BY total_coins DESC, total_correct DESC
  LIMIT COALESCE(limit_n, 50);
$$;

-- ============================================================
-- MILESTONE COUNTS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_milestone_counts(p_user_id UUID)
RETURNS TABLE (silver BIGINT, gold BIGINT, platinum BIGINT, diamond BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH speed_counts AS (
    SELECT
      SUM(CASE WHEN m25 THEN 1 ELSE 0 END) AS silver,
      SUM(CASE WHEN m50 THEN 1 ELSE 0 END) AS gold,
      SUM(CASE WHEN m75 THEN 1 ELSE 0 END) AS platinum,
      SUM(CASE WHEN m100 THEN 1 ELSE 0 END) AS diamond
    FROM public.speed_runs WHERE user_id = p_user_id
  ),
  daily_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE (milestones->>'m25')::BOOLEAN = TRUE) AS silver,
      COUNT(*) FILTER (WHERE (milestones->>'m50')::BOOLEAN = TRUE) AS gold,
      COUNT(*) FILTER (WHERE (milestones->>'m75')::BOOLEAN = TRUE) AS platinum,
      COUNT(*) FILTER (WHERE (milestones->>'m100')::BOOLEAN = TRUE) AS diamond
    FROM public.daily_progress WHERE user_id = p_user_id
  )
  SELECT
    (COALESCE(s.silver, 0) + COALESCE(d.silver, 0))::BIGINT AS silver,
    (COALESCE(s.gold, 0) + COALESCE(d.gold, 0))::BIGINT AS gold,
    (COALESCE(s.platinum, 0) + COALESCE(d.platinum, 0))::BIGINT AS platinum,
    (COALESCE(s.diamond, 0) + COALESCE(d.diamond, 0))::BIGINT AS diamond
  FROM speed_counts s, daily_counts d;
$$;

CREATE OR REPLACE FUNCTION public.get_all_achievements(p_user_id UUID)
RETURNS TABLE (key TEXT, unlocked_at TIMESTAMPTZ, meta JSONB)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT key, unlocked_at, meta
  FROM public.achievements
  WHERE user_id = p_user_id
  ORDER BY unlocked_at DESC;
$$;

-- ============================================================
-- SPEED DAILY STATS
-- ============================================================

CREATE OR REPLACE VIEW public.speed_daily_stats AS
SELECT
  user_id,
  date,
  COUNT(*) AS run_count,
  SUM(coins_earned)::INT AS coins_sum,
  SUM(correct_count)::INT AS correct_sum,
  SUM(CASE WHEN m25 THEN 1 ELSE 0 END)::INT AS m25_count,
  SUM(CASE WHEN m50 THEN 1 ELSE 0 END)::INT AS m50_count,
  SUM(CASE WHEN m75 THEN 1 ELSE 0 END)::INT AS m75_count,
  SUM(CASE WHEN m100 THEN 1 ELSE 0 END)::INT AS m100_count
FROM public.speed_runs
GROUP BY user_id, date;

CREATE OR REPLACE FUNCTION public.get_speed_daily(
  p_user_id UUID,
  p_from DATE,
  p_to DATE
) RETURNS TABLE (
  date DATE,
  run_count INT,
  coins_sum INT,
  correct_sum INT,
  m25_count INT,
  m50_count INT,
  m75_count INT,
  m100_count INT
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT date, run_count::INT, coins_sum, correct_sum, m25_count, m50_count, m75_count, m100_count
  FROM public.speed_daily_stats
  WHERE user_id = p_user_id AND date BETWEEN p_from AND p_to
  ORDER BY date ASC;
$$;

-- ============================================================
-- PART 8: MONTHLY SPEED UNLOCK (for practice mode gate)
-- ============================================================

-- get_speed_unlock_monthly: Returns unlock status based on last N sessions within D days
CREATE OR REPLACE FUNCTION public.get_speed_unlock_monthly(
  p_user_id UUID,
  p_threshold NUMERIC DEFAULT 0.8,
  p_window INT DEFAULT 3,
  p_days INT DEFAULT 30
) RETURNS TABLE (
  unlocked BOOLEAN,
  avg NUMERIC,
  count INT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_avg NUMERIC;
  v_count INT;
BEGIN
  -- Get the last `p_window` practice sessions within the last `p_days` days
  SELECT
    COALESCE(AVG(accuracy), 0),
    COUNT(*)::INT
  INTO v_avg, v_count
  FROM (
    SELECT accuracy
    FROM public.practice_sessions
    WHERE user_id = p_user_id
      AND date >= CURRENT_DATE - p_days
    ORDER BY created_at DESC
    LIMIT p_window
  ) recent;

  RETURN QUERY SELECT
    (v_count >= p_window AND v_avg >= p_threshold) AS unlocked,
    ROUND(v_avg, 4) AS avg,
    v_count AS count;
END;
$$;

-- ============================================================
-- PART 9: TEACHER ACCESS FUNCTIONS
-- ============================================================

-- get_speed_unlock_for_teacher: Teacher can view student's unlock status
-- Security: Only returns data if teacher has tasks that student has run
CREATE OR REPLACE FUNCTION public.get_speed_unlock_for_teacher(
  p_teacher_id UUID,
  p_student_id UUID,
  p_threshold NUMERIC DEFAULT 0.8,
  p_window INT DEFAULT 3,
  p_days INT DEFAULT 30
) RETURNS TABLE (
  unlocked BOOLEAN,
  avg NUMERIC,
  count INT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_has_access BOOLEAN;
  v_avg NUMERIC;
  v_count INT;
BEGIN
  -- Check if teacher has access to this student
  SELECT EXISTS (
    SELECT 1
    FROM public.task_runs tr
    JOIN public.live_tasks lt ON lt.id = tr.task_id
    WHERE tr.user_id = p_student_id
      AND lt.teacher_id = p_teacher_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, 0;
    RETURN;
  END IF;

  -- Get the last `p_window` practice sessions within the last `p_days` days
  SELECT
    COALESCE(AVG(accuracy), 0),
    COUNT(*)::INT
  INTO v_avg, v_count
  FROM (
    SELECT accuracy
    FROM public.practice_sessions
    WHERE user_id = p_student_id
      AND date >= CURRENT_DATE - p_days
    ORDER BY created_at DESC
    LIMIT p_window
  ) recent;

  RETURN QUERY SELECT
    (v_count >= p_window AND v_avg >= p_threshold) AS unlocked,
    ROUND(v_avg, 4) AS avg,
    v_count AS count;
END;
$$;

-- get_student_profile_for_teacher: Teacher can view limited student profile
-- Security: Only returns data if teacher has tasks that student has run
CREATE OR REPLACE FUNCTION public.get_student_profile_for_teacher(
  student_id UUID
) RETURNS TABLE (
  id UUID,
  full_name TEXT,
  age INT,
  gender TEXT,
  standard TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_teacher_id UUID := auth.uid();
  v_has_access BOOLEAN;
BEGIN
  -- Check if calling user (teacher) has access to this student
  SELECT EXISTS (
    SELECT 1
    FROM public.task_runs tr
    JOIN public.live_tasks lt ON lt.id = tr.task_id
    WHERE tr.user_id = student_id
      AND lt.teacher_id = v_teacher_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RETURN;
  END IF;

  -- Return limited profile data (no email, no sensitive info)
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.age,
    p.gender,
    p.standard
  FROM public.profiles p
  WHERE p.id = student_id;
END;
$$;

-- ============================================================
-- PART 10: BADGE COUNTS
-- ============================================================

-- get_badge_counts: Fetch all badge counts for a user (how many times each badge earned)
CREATE OR REPLACE FUNCTION public.get_badge_counts(p_user_id UUID)
RETURNS TABLE (
  key TEXT,
  count INT
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT key, count
  FROM public.achievement_counts
  WHERE user_id = p_user_id
  ORDER BY key ASC;
$$;
