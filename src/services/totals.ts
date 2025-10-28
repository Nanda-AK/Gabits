import { supabase } from "@/lib/supabase";

export async function incrementTotals(userId: string, coinDelta: number, correctDelta: number) {
  if (!userId) return;
  try {
    const { error } = await supabase.rpc("increment_user_totals", {
      p_user_id: userId,
      p_coin_delta: coinDelta,
      p_correct_delta: correctDelta,
    });
    if (error) {
      // non-critical; ignore
      return;
    }
  } catch {}
}
