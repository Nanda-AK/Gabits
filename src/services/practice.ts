import { supabase } from "@/lib/supabase";
import { getLocalYMD } from "@/lib/date";

export async function logPracticeSession(params: {
  user_id: string;
  date: string; // YYYY-MM-DD (local)
  difficulty: 'easy' | 'moderate' | 'difficult';
  topics_csv: string | null;
  chapter: string | null;
  topic: string | null; // e.g., 'addition' | 'subtraction' | 'multiplication' | 'division' | 'fractions' | 'algebra' | 'mixed'
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
      topic: params.topic ?? 'mixed',
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

// Monthly reset: compute unlock on last `window` sessions within `days` days (defaults 3 sessions within 30 days)
export async function getSpeedUnlockStatus(userId: string, threshold = 0.8, window = 3, days = 30): Promise<{ unlocked: boolean; avg: number; count: number; threshold: number; }> {
  if (!userId) return { unlocked: false, avg: 0, count: 0, threshold };
  try {
    const { data, error } = await supabase.rpc('get_speed_unlock_monthly', {
      p_user_id: userId,
      p_threshold: threshold,
      p_window: window,
      p_days: days,
    });
    if (error || !data) return { unlocked: false, avg: 0, count: 0, threshold };
    const row = Array.isArray(data) ? data[0] : data;
    return { unlocked: !!row?.unlocked, avg: Number(row?.avg || 0), count: Number(row?.count || 0), threshold };
  } catch {
    return { unlocked: false, avg: 0, count: 0, threshold };
  }
}

// Teacher view: read a student's unlock status (secured by SQL function)
export async function getSpeedUnlockForTeacher(teacherId: string, studentUserId: string, threshold = 0.8, window = 3, days = 30): Promise<{ unlocked: boolean; avg: number; count: number; threshold: number; }> {
  if (!teacherId || !studentUserId) return { unlocked: false, avg: 0, count: 0, threshold };
  try {
    const { data, error } = await supabase.rpc('get_speed_unlock_for_teacher', {
      p_teacher_id: teacherId,
      p_student_id: studentUserId,
      p_threshold: threshold,
      p_window: window,
      p_days: days,
    });
    if (error || !data) return { unlocked: false, avg: 0, count: 0, threshold };
    const row = Array.isArray(data) ? data[0] : data;
    return { unlocked: !!row?.unlocked, avg: Number(row?.avg || 0), count: Number(row?.count || 0), threshold };
  } catch {
    return { unlocked: false, avg: 0, count: 0, threshold };
  }
}
