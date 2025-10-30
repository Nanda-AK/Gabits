export type DifficultyKey = 'easy' | 'moderate' | 'difficult';
export type Winner = 'student' | 'ai' | 'none';

export interface BattleResolution {
  aiCorrect: boolean[];
  aiTimesMs: number[];
  winners: Winner[];
  studentPoints: number;
  aiPoints: number;
}

// HR summary: minimal performance record
export type BattleResult = 'win' | 'loss' | 'draw';
export interface BattlePerformanceRecord {
  user_id: string;
  date: string; // YYYY-MM-DD
  difficulty: DifficultyKey; // Steady/Smart/Speed is derived from this
  math_type: string; // e.g., 'addition', 'subtraction', 'mixed'
  student_points: number;
  ai_points: number;
  result: BattleResult;
}

export async function saveBattlePerformance(rec: BattlePerformanceRecord): Promise<void> {
  try {
    const { error } = await supabase.from('battle_performance').insert({
      user_id: rec.user_id,
      date: rec.date,
      difficulty: rec.difficulty,
      math_type: rec.math_type,
      student_points: rec.student_points,
      ai_points: rec.ai_points,
      result: rec.result,
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.warn('saveBattlePerformance: Supabase insert failed', error.message);
    }
  } catch (e) {
    console.warn('saveBattlePerformance: error', e);
  }
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const fasterThan = (s: number, d: DifficultyKey) =>
  clamp(Math.max(800, s - (d === 'difficult' ? 500 + Math.random() * 1000 : d === 'moderate' ? 300 + Math.random() * 600 : 200 + Math.random() * 500)), 800, 30000);

const slowerThan = (s: number, d: DifficultyKey) =>
  clamp(s + (d === 'difficult' ? 150 + Math.random() * 400 : d === 'moderate' ? 200 + Math.random() * 600 : 200 + Math.random() * 800), 800, 30000);

const around = (s: number, d: DifficultyKey) =>
  clamp(s + (d === 'difficult' ? -100 + Math.random() * 400 : d === 'moderate' ? -150 + Math.random() * 600 : -200 + Math.random() * 700), 800, 30000);

/**
 * Resolve AI outcomes after all 10 questions.
 * Target: Student 60% wins, AI 40% when feasible, without fabricating a student win
 * on a question where the student was actually wrong.
 */
export function resolveBattleResults(
  difficulty: DifficultyKey,
  studentCorrect: boolean[],
  studentTimesMs: number[]
): BattleResolution {
  const n = studentCorrect.length;
  const idx = Array.from({ length: n }, (_, i) => i);

  // Desired distribution but constrained by reality
  const maxStudentWins = studentCorrect.filter(Boolean).length;
  const targetStudent = Math.min(6, maxStudentWins);
  const targetAI = Math.min(4, n - targetStudent);

  const wanted: Winner[] = Array(n).fill('none');
  const studentWinPool = idx.filter(i => studentCorrect[i]); // we only allow student wins where student was correct
  const aiWinPreferWrong = idx.filter(i => !studentCorrect[i]);
  const aiWinFallback = idx.filter(i => studentCorrect[i]);

  // Assign desired student wins first
  for (let i = 0; i < targetStudent && i < studentWinPool.length; i++) {
    wanted[studentWinPool[i]] = 'student';
  }

  // Assign AI wins next (prefer student's wrong answers)
  let needAI = targetAI;
  for (const i of aiWinPreferWrong) {
    if (!needAI) break;
    if (wanted[i] === 'none') { wanted[i] = 'ai'; needAI--; }
  }
  for (const i of aiWinFallback) {
    if (!needAI) break;
    if (wanted[i] === 'none') { wanted[i] = 'ai'; needAI--; }
  }

  const aiCorrect = Array(n).fill(false);
  const aiTimesMs = Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const sTime = studentTimesMs[i] || 2000;
    const sCorrect = !!studentCorrect[i];

    if (wanted[i] === 'student') {
      // Ensure student wins: either AI is wrong, or AI is slower
      if (sCorrect) {
        if (Math.random() < 0.6) {
          aiCorrect[i] = false; // student wins by correctness
          aiTimesMs[i] = around(sTime, difficulty);
        } else {
          aiCorrect[i] = true; // both correct, but AI slower
          aiTimesMs[i] = slowerThan(sTime, difficulty);
        }
      } else {
        // Should not happen because we only picked from studentWinPool
        aiCorrect[i] = false;
        aiTimesMs[i] = around(sTime, difficulty);
      }
    } else if (wanted[i] === 'ai') {
      // Ensure AI wins: prefer correctness advantage else win by speed
      if (!sCorrect) {
        aiCorrect[i] = true; // AI right, student wrong
        aiTimesMs[i] = around(sTime, difficulty);
      } else {
        aiCorrect[i] = true; // both correct, AI must be faster
        aiTimesMs[i] = fasterThan(sTime, difficulty);
      }
    } else {
      // No point: default both wrong or AI wrong, time around
      aiCorrect[i] = false;
      aiTimesMs[i] = around(sTime, difficulty);
    }
  }

  // Compute winners from actual outcomes
  const winners: Winner[] = Array(n).fill('none');
  let studentPoints = 0;
  let aiPoints = 0;
  for (let i = 0; i < n; i++) {
    const sCorrect = !!studentCorrect[i];
    const aCorrect = !!aiCorrect[i];

    if (sCorrect && aCorrect) {
      if (studentTimesMs[i] < aiTimesMs[i]) { winners[i] = 'student'; studentPoints++; }
      else { winners[i] = 'ai'; aiPoints++; }
    } else if (sCorrect && !aCorrect) {
      winners[i] = 'student'; studentPoints++;
    } else if (!sCorrect && aCorrect) {
      winners[i] = 'ai'; aiPoints++;
    } else {
      winners[i] = 'none';
    }
  }

  return { aiCorrect, aiTimesMs, winners, studentPoints, aiPoints };
}

// Supabase persistence (optional)
import { supabase } from "@/lib/supabase";

export interface BattleMatchRecord {
  user_id: string;
  date: string; // YYYY-MM-DD
  difficulty: DifficultyKey;
  student_correct: boolean[];
  student_times_ms: number[];
  ai_correct: boolean[];
  ai_times_ms: number[];
  winners: Winner[];
  student_points: number;
  ai_points: number;
}

export async function saveBattleMatch(rec: BattleMatchRecord): Promise<void> {
  try {
    const { error } = await supabase.from("battle_matches").insert({
      user_id: rec.user_id,
      date: rec.date,
      difficulty: rec.difficulty,
      student_correct: rec.student_correct,
      student_times_ms: rec.student_times_ms,
      ai_correct: rec.ai_correct,
      ai_times_ms: rec.ai_times_ms,
      winners: rec.winners,
      student_points: rec.student_points,
      ai_points: rec.ai_points,
      created_at: new Date().toISOString(),
    });
    if (error) {
      // Non-fatal: log and continue
      console.warn("saveBattleMatch: Supabase insert failed", error.message);
    }
  } catch (e) {
    console.warn("saveBattleMatch: error", e);
  }
}
