import { supabase } from "@/lib/supabase";

export type AchievementKey = 
  | "m10" | "m25" | "m50" | "m75" | "m100"  // Milestone badges
  | "focused_learner" | "math_explorer"     // Practice badges
  | "speed_master"                           // Speed badges
  | "ai_challenger" | "social_legend";      // Compete badges

export async function unlockAchievement(
  userId: string,
  key: AchievementKey,
  meta?: Record<string, any>
): Promise<void> {
  if (!userId) return;
  try {
    const { error } = await supabase
      .from("achievements")
      .upsert(
        { user_id: userId, key, unlocked_at: new Date().toISOString(), meta: meta ?? null },
        { onConflict: "user_id,key" }
      );
    if (error) {
      // swallow error; achievements are non-critical
      return;
    }
  } catch {}
}

export async function getAchievements(userId: string): Promise<Set<AchievementKey>> {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from("achievements")
    .select("key")
    .eq("user_id", userId);
  if (error || !data) return new Set();
  return new Set((data as Array<{ key: AchievementKey }>).map((r) => r.key));
}

export type Achievement = {
  key: AchievementKey;
  unlocked_at: string;
  meta: Record<string, any> | null;
};

export async function getAllAchievements(userId: string): Promise<Achievement[]> {
  if (!userId) return [];
  const { data, error } = await supabase.rpc("get_all_achievements", { p_user_id: userId });
  if (error || !data) return [];
  return (data as Achievement[]) ?? [];
}
