import { supabase } from "@/lib/supabase";

export type SpeedAchievementKey = "m10" | "m25" | "m50" | "m75" | "m100";

export interface SpeedLeaderboardRow {
  user_id: string;
  display_name: string;
  total_coins: number;
  total_correct: number;
  has_m25: boolean;
  has_m50: boolean;
  has_m75: boolean;
  has_m100: boolean;
  silver_count: number;
  gold_count: number;
  platinum_count: number;
  diamond_count: number;
  rank: number;
}

export async function incrementSpeedTotals(userId: string, coinDelta: number, correctDelta: number) {
  if (!userId) return;
  const { error } = await supabase.rpc("increment_speed_totals", {
    p_user_id: userId,
    p_coin_delta: coinDelta,
    p_correct_delta: correctDelta,
  });
  if (error) {
    // non-critical
    return;
  }
}

export async function unlockSpeedAchievement(userId: string, key: SpeedAchievementKey): Promise<void> {
  if (!userId) return;
  // Upsert into speed_achievements (unique on user_id,key)
  const { error } = await supabase.from("speed_achievements").upsert({
    user_id: userId,
    key,
    unlocked_at: new Date().toISOString(),
  }, { onConflict: "user_id,key" });
  if (error) {
    // non-critical
    return;
  }
}

export async function getSpeedLeaderboard(limit = 50): Promise<SpeedLeaderboardRow[]> {
  const { data, error } = await supabase.rpc("get_speed_leaderboard", { limit_n: limit });
  if (error) throw error;
  return (data ?? []) as SpeedLeaderboardRow[];
}

export async function getMySpeedTotals(userId: string): Promise<Omit<SpeedLeaderboardRow, "rank"> | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("speed_leaderboard_view")
    .select("user_id, display_name, total_coins, total_correct, has_m25, has_m50, has_m75, has_m100, silver_count, gold_count, platinum_count, diamond_count")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return (data as any) ?? null;
}

export async function logSpeedRun(input: {
  user_id: string;
  date: string; // YYYY-MM-DD (local)
  difficulty: 'easy' | 'moderate' | 'difficult';
  correct: number;
  coins: number;
  m10: boolean;
  m25: boolean;
  m50: boolean;
  m75: boolean;
  m100: boolean;
  fast_flawless: boolean;
}): Promise<{ coins_awarded: number; gems_awarded: number; badges_awarded: string[] } | null> {
  const { data, error } = await supabase.rpc('log_speed_run', {
    p_user_id: input.user_id,
    p_date: input.date,
    p_difficulty: input.difficulty,
    p_correct: input.correct,
    p_coins: input.coins,
    p_m10: input.m10,
    p_m25: input.m25,
    p_m50: input.m50,
    p_m75: input.m75,
    p_m100: input.m100,
    p_fast_flawless: input.fast_flawless,
  });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

export async function getSpeedDaily(userId: string, from: string, to: string): Promise<Array<{
  date: string;
  run_count: number;
  coins_sum: number;
  correct_sum: number;
  m25_count: number;
  m50_count: number;
  m75_count: number;
  m100_count: number;
}>> {
  const { data, error } = await supabase.rpc('get_speed_daily', {
    p_user_id: userId,
    p_from: from,
    p_to: to,
  });
  if (error) return [];
  return (data as any[]) ?? [];
}
