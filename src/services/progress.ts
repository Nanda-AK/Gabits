import { supabase } from "@/lib/supabase";
import type { Difficulty, Question } from "@/data/questions";

// Local deterministic daily pick (same as in QuizGame)
function seededRandom(seed: number) {
  return function () {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 0xffffffff;
  };
}

function pickDailyQuestionIds(all: Question[], count = 10): number[] {
  const d = new Date();
  const ymd = parseInt(
    `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, "0")}${d
      .getDate()
      .toString()
      .padStart(2, "0")}`
  );
  const rand = seededRandom(ymd);
  const idxs = all.map((_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  return idxs.slice(0, Math.min(count, all.length)).map((i) => all[i].id);
}

export async function getOrCreateDailySet(
  userId: string,
  dateYMD: string,
  difficulty: Difficulty,
  pool: Question[]
): Promise<number[]> {
  const { data, error } = await supabase
    .from("daily_sets")
    .select("question_ids")
    .eq("user_id", userId)
    .eq("date", dateYMD)
    .eq("difficulty", difficulty)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error; // ignore not found
  if (data?.question_ids) {
    return data.question_ids as number[];
  }
  const ids = pickDailyQuestionIds(pool, 10);
  const { error: upErr } = await supabase.from("daily_sets").upsert({
    user_id: userId,
    date: dateYMD,
    difficulty,
    question_ids: ids,
    updated_at: new Date().toISOString(),
  });
  if (upErr) throw upErr;
  return ids;
}

export type DailyProgress = {
  correct_count: number;
  coins_earned: number;
  milestones: Record<string, boolean>;
  completed: boolean;
};

export async function getDailyProgress(
  userId: string,
  dateYMD: string,
  difficulty: Difficulty
): Promise<DailyProgress | null> {
  const { data, error } = await supabase
    .from("daily_progress")
    .select("correct_count, coins_earned, milestones, completed")
    .eq("user_id", userId)
    .eq("date", dateYMD)
    .eq("difficulty", difficulty)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;
  return {
    correct_count: data.correct_count ?? 0,
    coins_earned: data.coins_earned ?? 0,
    milestones: (data.milestones as any) ?? {},
    completed: !!data.completed,
  };
}

export async function saveDailyProgressSnapshot(
  userId: string,
  dateYMD: string,
  difficulty: Difficulty,
  snapshot: DailyProgress
): Promise<void> {
  const { error } = await supabase.from("daily_progress").upsert({
    user_id: userId,
    date: dateYMD,
    difficulty,
    correct_count: snapshot.correct_count,
    coins_earned: snapshot.coins_earned,
    milestones: snapshot.milestones,
    completed: snapshot.completed,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
