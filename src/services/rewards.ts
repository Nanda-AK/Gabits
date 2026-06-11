import { supabase } from "@/lib/supabase";

export async function grantPracticeRewards(input: {
  user_id: string;
  topic: string;
  used_seconds: number;
  date: string; // YYYY-MM-DD local
  question_coins?: number;
}): Promise<{ coins_awarded: number; gems_awarded: number; streak_after: number; badges_awarded: string[] } | null> {
  const { data, error } = await supabase.rpc('grant_practice_rewards', {
    p_user_id: input.user_id,
    p_topic: input.topic,
    p_used_seconds: Math.max(0, Math.floor(input.used_seconds || 0)),
    p_date: input.date,
    p_question_coins: Math.max(0, Math.floor(input.question_coins || 0)),
  });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

export async function grantCompeteRewards(input: {
  user_id: string;
  type: 'ai' | 'friends';
  date: string; // YYYY-MM-DD local
  difficulty: 'easy' | 'moderate' | 'difficult' | null;
  result: 'win' | 'loss' | 'draw';
}): Promise<{ coins_awarded: number; gems_awarded: number; badges_awarded: string[] } | null> {
  const { data, error } = await supabase.rpc('grant_compete_rewards', {
    p_user_id: input.user_id,
    p_type: input.type,
    p_date: input.date,
    p_difficulty: input.difficulty,
    p_result: input.result,
  });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

export type XpRow = {
  user_id: string;
  display_name: string;
  coins_sum: number;
  gems_sum: number;
  badges_sum: number;
  xp: number;
  rank: number;
};

export async function getXpLeaderboard(from: string, to: string, limit = 50): Promise<XpRow[]> {
  const { data, error } = await supabase.rpc('get_xp_leaderboard', {
    p_from: from,
    p_to: to,
    limit_n: limit,
  });
  if (error) return [];
  return (data as XpRow[]) ?? [];
}

export type AllTimeXpRow = {
  user_id: string;
  display_name: string;
  avatar_style: string | null;
  xp: number;
  rank: number;
};

export async function getAllTimeXpLeaderboard(limit = 50): Promise<AllTimeXpRow[]> {
  const { data, error } = await supabase.rpc('get_all_time_xp_leaderboard', {
    limit_n: limit,
  });
  if (error) return [];
  return (data as AllTimeXpRow[]) ?? [];
}

export async function getUserBalances(userId: string): Promise<{ user_id: string; coins: number; gems: number; xp: number } | null> {
  const { data, error } = await supabase
    .from('user_balances')
    .select('user_id, coins, gems, xp')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return (data as any) ?? null;
}

// Read the current any-mode streak (applies across Practice/Speed/Compete)
export async function getAnyStreak(userId: string): Promise<{ any_streak: number } | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('activity_streaks')
    .select('any_streak')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return (data as any) ?? null;
}

// Read who claimed today's daily streak award (first mode of the day)
export async function getDailyStreakAward(userId: string, dateYMD: string): Promise<{ claimed_by: string; coins_awarded: number; badges_awarded: string[] } | null> {
  if (!userId || !dateYMD) return null;
  const { data, error } = await supabase
    .from('daily_streak_awards')
    .select('claimed_by, coins_awarded, badges_awarded')
    .eq('user_id', userId)
    .eq('date', dateYMD)
    .maybeSingle();
  if (error) return null;
  return (data as any) ?? null;
}

export async function getUserXpAndAvatar(
  userId: string
): Promise<{ xp: number; avatar_style: string | null } | null> {
  if (!userId) return null;

  const { data: balance, error: balError } = await supabase
    .from('user_balances')
    .select('xp')
    .eq('user_id', userId)
    .maybeSingle();

  if (balError) return null;

  const { data: profile, error: profError } = await supabase
    .from('profiles')
    .select('avatar_style')
    .eq('id', userId)
    .maybeSingle();

  const xp = (balance as any)?.xp ?? 0;
  const avatar_style = profError ? null : ((profile as any)?.avatar_style ?? null);

  return { xp, avatar_style };
}

export async function updateAvatarStyle(
  userId: string,
  style: string,
  requiredXp: number
): Promise<boolean> {
  if (!userId) return false;

  const { data: balance, error: balError } = await supabase
    .from('user_balances')
    .select('xp')
    .eq('user_id', userId)
    .maybeSingle();

  if (balError) return false;

  const xp = (balance as any)?.xp ?? 0;
  if (xp < requiredXp) {
    return false;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_style: style, updated_at: new Date().toISOString() })
    .eq('id', userId);

  return !error;
}
