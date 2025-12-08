import { supabase } from "@/lib/supabase";

export type TaskRun = {
  id: string;
  task_id: string;
  user_id: string | null;
  guest_id: string | null;
  mode: 'practice' | 'speed' | 'battle-ai' | 'battle-friends';
  difficulty: 'easy' | 'moderate' | 'difficult' | null;
  topics_csv: string | null;
  chapter: string | null;
  started_at: string;
  completed_at?: string | null;
  total: number;
  correct: number;
  time_ms: number | null;
  hearts_left: number | null;
  hints_used: number | null;
  coins_earned: number | null;
  details: any | null;
  status: 'completed' | 'abandoned';
};

export async function createRun(params: {
  task_id: string;
  user_id?: string | null;
  guest_id?: string | null;
  mode: TaskRun['mode'];
  difficulty?: TaskRun['difficulty'];
  topics_csv?: string | null;
  chapter?: string | null;
}): Promise<TaskRun | null> {
  try {
    const payload = {
      task_id: params.task_id,
      user_id: params.user_id ?? null,
      guest_id: params.guest_id ?? null,
      mode: params.mode,
      difficulty: params.difficulty ?? null,
      topics_csv: params.topics_csv ?? null,
      chapter: params.chapter ?? null,
      status: 'abandoned' as const, // mark in-progress as abandoned until completion
      // started_at default now() is set by DB
    } as any;
    const { data, error } = await supabase
      .from('task_runs')
      .insert(payload)
      .select('*')
      .single();
    if (error || !data) return null;
    return data as TaskRun;
  } catch {
    return null;
  }
}

export type TaskRunWithTask = TaskRun & {
  live_tasks?: {
    id: string;
    title: string;
    chapter: string | null;
    topics_csv: string | null;
    status: 'active' | 'ended';
    started_at: string;
    ended_at?: string | null;
    created_by: string;
  };
};

export async function getRunsForTeacher(teacherId: string): Promise<TaskRunWithTask[]> {
  try {
    const { data, error } = await supabase
      .from('task_runs')
      .select('*, live_tasks!inner(id, title, chapter, topics_csv, status, started_at, ended_at, created_by)')
      .eq('live_tasks.created_by', teacherId)
      .order('completed_at', { ascending: false });
    if (error || !data) return [] as any;
    return data as any;
  } catch {
    return [] as any;
  }
}

export async function completeRun(run_id: string, payload: Partial<Pick<TaskRun,
  'total'|'correct'|'time_ms'|'hearts_left'|'hints_used'|'coins_earned'|'details'|'status'>> & { completed_at?: string }): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('task_runs')
      .update({
        ...payload,
        completed_at: payload.completed_at || new Date().toISOString(),
      })
      .eq('id', run_id);
    return !error;
  } catch {
    return false;
  }
}

export async function getRunsForTask(taskId: string): Promise<TaskRun[]> {
  try {
    const { data, error } = await supabase
      .from('task_runs')
      .select('*')
      .eq('task_id', taskId)
      .order('completed_at', { ascending: false });
    if (error || !data) return [];
    return data as TaskRun[];
  } catch {
    return [];
  }
}

export async function getRunsForTeacherStudent(teacherId: string, studentUserId: string): Promise<TaskRun[]> {
  try {
    const { data, error } = await supabase
      .from('task_runs')
      .select('*, live_tasks!inner(created_by, title, chapter, topics_csv, started_at, ended_at, status)')
      .eq('live_tasks.created_by', teacherId)
      .eq('user_id', studentUserId)
      .order('completed_at', { ascending: false });
    if (error || !data) return [] as any;
    return data as any;
  } catch {
    return [] as any;
  }
}
