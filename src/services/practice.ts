import { supabase } from "@/lib/supabase";
import { getLocalYMD } from "@/lib/date";

export async function logPracticeSession(params: {
  user_id: string;
  date: string; // YYYY-MM-DD (local)
  difficulty: 'easy' | 'moderate' | 'difficult';
  topics_csv: string | null;
  chapter: string | null;
  total: number;
  correct: number;
  used_seconds: number;
}): Promise<boolean> {
  try {
    const payload = {
      user_id: params.user_id,
      date: params.date,
      difficulty: params.difficulty,
      topics_csv: params.topics_csv,
      chapter: params.chapter,
      total: Math.max(0, Math.floor(params.total || 0)),
      correct: Math.max(0, Math.floor(params.correct || 0)),
      used_seconds: Math.max(0, Math.floor(params.used_seconds || 0)),
    } as any;
    const { error } = await supabase.from('practice_sessions').insert(payload);
    return !error;
  } catch {
    return false;
  }
}

export async function getPracticeCountToday(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const today = getLocalYMD();
    const { count } = await supabase
      .from('practice_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('date', today);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getSpeedUnlockStatus(userId: string, threshold = 0.8, window = 3): Promise<{ unlocked: boolean; avg: number; count: number; threshold: number; }> {
  if (!userId) return { unlocked: false, avg: 0, count: 0, threshold };
  try {
    const { data, error } = await supabase
      .from('practice_sessions')
      .select('total, correct, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(window);
    if (error || !data || data.length === 0) return { unlocked: false, avg: 0, count: 0, threshold };
    const last = data as Array<{ total: number; correct: number }>;
    const ratios = last
      .map(r => {
        const t = Math.max(1, r.total || 0);
        const c = Math.max(0, r.correct || 0);
        return Math.min(1, c / t);
      });
    const count = ratios.length;
    const avg = ratios.reduce((s, v) => s + v, 0) / count;
    const unlocked = count >= Math.min(window, 3) && avg >= threshold;
    return { unlocked, avg, count, threshold };
  } catch {
    return { unlocked: false, avg: 0, count: 0, threshold };
  }
}
