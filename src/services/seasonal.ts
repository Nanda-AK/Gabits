import { supabase } from "@/lib/supabase";

export type SeasonalWinner = {
  rank: number;
  user_id: string;
  display_name: string;
  xp_earned: number;
  reward_coins: number;
  reward_gems: number;
  reward_boost_tokens: number;
  awarded_at: string;
};

export async function getSeasonalWinners(season: string): Promise<SeasonalWinner[]> {
  const { data, error } = await supabase.rpc('get_seasonal_winners', { p_season: season });
  if (error) return [];
  return (data as SeasonalWinner[]) ?? [];
}

export async function getMyTokens(userId: string): Promise<{ tokens_available: number; tokens_used: number } | null> {
  if (!userId) return null;
  const { data, error } = await supabase.rpc('get_my_tokens', { p_user_id: userId });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? { tokens_available: 0, tokens_used: 0 };
}

export async function useBoostToken(userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase.rpc('use_boost_token', { p_user_id: userId });
  if (error) return false;
  return !!data;
}

// Admin function - triggers seasonal award calculation
export async function awardSeasonalTop3(season: string): Promise<SeasonalWinner[]> {
  const { data, error } = await supabase.rpc('award_seasonal_top3', { p_season: season });
  if (error) {
    console.error('Failed to award seasonal top 3:', error);
    return [];
  }
  return (data as SeasonalWinner[]) ?? [];
}
