import { supabase } from "@/lib/supabase";

export type MilestoneCounts = {
  silver: number; // m25
  gold: number; // m50
  platinum: number; // m75
  diamond: number; // m100
};

const ZERO: MilestoneCounts = { silver: 0, gold: 0, platinum: 0, diamond: 0 };

export async function getMilestoneCounts(userId?: string | null): Promise<MilestoneCounts> {
  if (!userId) return ZERO;
  try {
    const { data, error } = await supabase.rpc("get_milestone_counts", { p_user_id: userId });
    if (error || !data) return ZERO;
    // Support either snake_case or plain keys depending on SQL impl
    const d: any = Array.isArray(data) ? data[0] : data;
    return {
      silver: Number(d.silver ?? d.silver_count ?? 0) || 0,
      gold: Number(d.gold ?? d.gold_count ?? 0) || 0,
      platinum: Number(d.platinum ?? d.platinum_count ?? 0) || 0,
      diamond: Number(d.diamond ?? d.diamond_count ?? 0) || 0,
    };
  } catch {
    return ZERO;
  }
}
