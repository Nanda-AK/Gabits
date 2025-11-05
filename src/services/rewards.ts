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

export async function getUserBalances(userId: string): Promise<{ user_id: string; coins: number; gems: number; xp: number } | null> {
  const { data, error } = await supabase
    .from('user_balances')
    .select('user_id, coins, gems, xp')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return (data as any) ?? null;
}
