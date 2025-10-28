import { supabase } from "@/lib/supabase";

export interface LeaderboardRow {
  user_id: string;
  display_name: string;
  total_coins: number;
  total_correct: number;
  rank: number;
}

export async function getLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc("get_leaderboard", { limit_n: limit });
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}

export async function getMyTotals(userId: string): Promise<Omit<LeaderboardRow, "rank"> | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("leaderboard_view")
    .select("user_id, display_name, total_coins, total_correct")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return (data as any) ?? null;
}
