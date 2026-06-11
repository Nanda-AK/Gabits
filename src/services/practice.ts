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

// NEW: Log a run to chapter_mode_runs for unlock tracking
// This works for BOTH live tasks AND chapter-only sessions
export async function logChapterModeRun(params: {
  user_id: string;
  chapter: string;
  mode: 'practice' | 'speed' | 'battle-ai' | 'battle-friends';
  difficulty: 'easy' | 'moderate' | 'difficult';
  total: number;
  correct: number;
}): Promise<boolean> {
  if (!params.user_id || !params.chapter) return false;
  try {
    const payload = {
      user_id: params.user_id,
      chapter: params.chapter,
      mode: params.mode,
      difficulty: params.difficulty,
      total: Math.max(0, Math.floor(params.total || 0)),
      correct: Math.max(0, Math.floor(params.correct || 0)),
      completed_at: new Date().toISOString(),
    } as any;
    const { error } = await supabase.from('chapter_mode_runs').insert(payload);
    return !error;
  } catch {
    return false;
  }
}

// Directly grant a lifetime per-chapter unlock for a mode (upsert row)
export async function grantChapterModeUnlock(
  userId: string,
  chapter: string,
  mode: 'speed' | 'battle-ai' | 'battle-friends',
  unlockedAt?: string,
): Promise<boolean> {
  if (!userId || !chapter || !mode) return false;
  try {
    const row = {
      user_id: userId,
      chapter,
      mode,
      unlocked_at: unlockedAt || new Date().toISOString(),
    } as any;
    const { error } = await supabase
      .from('chapter_mode_unlocks')
      .upsert(row, { onConflict: 'user_id,chapter,mode' });
    return !error;
  } catch {
    return false;
  }
}

// Generic per-mode lifetime unlock helpers (speed/ai/friends)
export async function ensureChapterModeUnlock(
  userId: string,
  chapter: string,
  mode: 'speed' | 'battle-ai' | 'battle-friends',
  threshold = 0.8,
  window = 3,
): Promise<{ unlocked: boolean; avg: number; count: number; unlocked_at: string | null; }> {
  if (!userId || !chapter || !mode) return { unlocked: false, avg: 0, count: 0, unlocked_at: null };
  try {
    const { data, error } = await supabase.rpc('ensure_chapter_mode_unlock', {
      p_user_id: userId,
      p_chapter: chapter,
      p_mode: mode,
      p_threshold: threshold,
      p_window: window,
    });
    if (error || !data) return { unlocked: false, avg: 0, count: 0, unlocked_at: null };
    const row = Array.isArray(data) ? data[0] : data;
    return {
      unlocked: !!row?.unlocked,
      avg: Number(row?.avg || 0),
      count: Number(row?.count || 0),
      unlocked_at: row?.unlocked_at || null,
    };
  } catch {
    return { unlocked: false, avg: 0, count: 0, unlocked_at: null };
  }
}

export async function getChapterModeUnlock(
  userId: string,
  chapter: string,
  mode: 'speed' | 'battle-ai' | 'battle-friends',
  threshold = 0.8,
  window = 3,
): Promise<{ unlocked: boolean; avg: number; count: number; unlocked_at: string | null; }> {
  if (!userId || !chapter || !mode) return { unlocked: false, avg: 0, count: 0, unlocked_at: null };
  try {
    const { data, error } = await supabase.rpc('get_chapter_mode_unlock', {
      p_user_id: userId,
      p_chapter: chapter,
      p_mode: mode,
      p_threshold: threshold,
      p_window: window,
    });
    if (error || !data) return { unlocked: false, avg: 0, count: 0, unlocked_at: null };
    const row = Array.isArray(data) ? data[0] : data;
    return {
      unlocked: !!row?.unlocked,
      avg: Number(row?.avg || 0),
      count: Number(row?.count || 0),
      unlocked_at: row?.unlocked_at || null,
    };
  } catch {
    return { unlocked: false, avg: 0, count: 0, unlocked_at: null };
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

// Lifetime per-chapter unlock: compute and persist if eligible
export async function ensureChapterSpeedUnlock(userId: string, chapter: string, threshold = 0.8, window = 3): Promise<{ unlocked: boolean; avg: number; count: number; unlocked_at: string | null; }> {
  if (!userId || !chapter) return { unlocked: false, avg: 0, count: 0, unlocked_at: null };
  try {
    const { data, error } = await supabase.rpc('ensure_chapter_speed_unlock', {
      p_user_id: userId,
      p_chapter: chapter,
      p_threshold: threshold,
      p_window: window,
    });
    if (error || !data) return { unlocked: false, avg: 0, count: 0, unlocked_at: null };
    const row = Array.isArray(data) ? data[0] : data;
    return {
      unlocked: !!row?.unlocked,
      avg: Number(row?.avg || 0),
      count: Number(row?.count || 0),
      unlocked_at: row?.unlocked_at || null,
    };
  } catch {
    return { unlocked: false, avg: 0, count: 0, unlocked_at: null };
  }
}

// Read per-chapter unlock (persisted), and compute/persist if not present and eligible
export async function getChapterSpeedUnlock(userId: string, chapter: string, threshold = 0.8, window = 3): Promise<{ unlocked: boolean; avg: number; count: number; unlocked_at: string | null; }> {
  if (!userId || !chapter) return { unlocked: false, avg: 0, count: 0, unlocked_at: null };
  try {
    const { data, error } = await supabase.rpc('get_chapter_speed_unlock', {
      p_user_id: userId,
      p_chapter: chapter,
      p_threshold: threshold,
      p_window: window,
    });
    if (error || !data) return { unlocked: false, avg: 0, count: 0, unlocked_at: null };
    const row = Array.isArray(data) ? data[0] : data;
    return {
      unlocked: !!row?.unlocked,
      avg: Number(row?.avg || 0),
      count: Number(row?.count || 0),
      unlocked_at: row?.unlocked_at || null,
    };
  } catch {
    return { unlocked: false, avg: 0, count: 0, unlocked_at: null };
  }
}

// Teacher view of per-chapter unlock
export async function getChapterSpeedUnlockForTeacher(teacherId: string, studentUserId: string, chapter: string, threshold = 0.8, window = 3): Promise<{ unlocked: boolean; avg: number; count: number; unlocked_at: string | null; }> {
  if (!teacherId || !studentUserId || !chapter) return { unlocked: false, avg: 0, count: 0, unlocked_at: null };
  try {
    const { data, error } = await supabase.rpc('get_chapter_speed_unlock_for_teacher', {
      p_teacher_id: teacherId,
      p_student_id: studentUserId,
      p_chapter: chapter,
      p_threshold: threshold,
      p_window: window,
    });
    if (error || !data) return { unlocked: false, avg: 0, count: 0, unlocked_at: null };
    const row = Array.isArray(data) ? data[0] : data;
    return {
      unlocked: !!row?.unlocked,
      avg: Number(row?.avg || 0),
      count: Number(row?.count || 0),
      unlocked_at: row?.unlocked_at || null,
    };
  } catch {
    return { unlocked: false, avg: 0, count: 0, unlocked_at: null };
  }
}

// Seen questions (per day, per chapter, per difficulty)
export async function getSeenQuestionIds(userId: string, dateYMD: string, chapter: string, difficulty: 'easy' | 'moderate' | 'difficult'): Promise<Set<number>> {
  if (!userId || !dateYMD || !chapter) return new Set();
  try {
    const { data, error } = await supabase
      .from('practice_seen_questions')
      .select('question_id')
      .eq('user_id', userId)
      .eq('date', dateYMD)
      .eq('chapter', chapter)
      .eq('difficulty', difficulty);
    if (error || !data) return new Set();
    return new Set((data as any[]).map(r => Number(r.question_id)));
  } catch {
    return new Set();
  }
}

export async function markSeenQuestionIds(userId: string, dateYMD: string, chapter: string, difficulty: 'easy' | 'moderate' | 'difficult', ids: number[]): Promise<boolean> {
  if (!userId || !dateYMD || !chapter || !ids?.length) return true;
  try {
    const rows = ids.map(id => ({ user_id: userId, date: dateYMD, chapter, difficulty, question_id: Number(id) }));
    const { error } = await supabase
      .from('practice_seen_questions')
      .upsert(rows, { onConflict: 'user_id,date,chapter,difficulty,question_id' });
    return !error;
  } catch {
    return false;
  }
}
