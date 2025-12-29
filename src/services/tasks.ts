import { supabase } from "@/lib/supabase";

export type LiveTask = {
  id: string;
  title: string;
  mode: 'practice' | 'speed' | 'battle-ai' | 'battle-friends';
  topics_csv: string; // comma-separated topics
  difficulty: 'easy' | 'moderate' | 'difficult' | null;
  chapter?: string | null;
  status: 'active' | 'ended';
  created_by: string;
  started_at: string;
  ended_at?: string | null;
};

export async function getActiveTasks(): Promise<LiveTask[]> {
  try {
    const { data, error } = await supabase
      .from('live_tasks')
      .select('*')
      .eq('status', 'active')
      .order('started_at', { ascending: false });
    if (error || !data) return [];
    return data as LiveTask[];
  } catch {
    return [];
  }
}

export async function getTasksByCreator(teacherId: string, status: 'active' | 'ended' | 'all' = 'all'): Promise<LiveTask[]> {
  try {
    let q = supabase
      .from('live_tasks')
      .select('*')
      .eq('created_by', teacherId)
      .order('started_at', { ascending: false });
    if (status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error || !data) return [];
    return data as LiveTask[];
  } catch {
    return [];
  }
}

export async function startLiveTask(params: {
  title: string;
  mode: LiveTask['mode'];
  topics: string[];
  difficulty?: LiveTask['difficulty'];
  chapter?: string | null;
  created_by: string;
}): Promise<LiveTask | null> {
  try {
    const payload = {
      title: params.title || 'Live Task',
      mode: params.mode,
      topics_csv: (params.topics || []).join(','),
      difficulty: params.difficulty ?? null,
      chapter: params.chapter ?? null,
      status: 'active' as const,
      created_by: params.created_by,
      started_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('live_tasks')
      .insert(payload)
      .select('*')
      .single();
    if (error || !data) return null;
    return data as LiveTask;
  } catch {
    return null;
  }
}

export async function endLiveTask(taskId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('live_tasks')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('created_by', userId);
    return !error;
  } catch {
    return false;
  }
}

export function subscribeActiveTasks(onChange: (tasks: LiveTask[]) => void) {
  // Realtime updates for inserts/updates on live_tasks
  const channel = supabase
    .channel('live_tasks_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_tasks' }, async () => {
      const tasks = await getActiveTasks();
      onChange(tasks);
    })
    .subscribe();
  return () => {
    try { supabase.removeChannel(channel); } catch {}
  };
}

export async function getTaskById(id: string): Promise<LiveTask | null> {
  try {
    const { data, error } = await supabase
      .from('live_tasks')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data as LiveTask;
  } catch {
    return null;
  }
}

// Student task statuses (drives the "Tasks in Progress" modal)
export type StudentTaskStatus = {
  task_id: string;
  chapter: string | null;
  status: 'not_started' | 'in_progress' | 'completed';
  speed_unlocked: boolean;
  ai_unlocked: boolean;
  friends_unlocked: boolean;
  runs_count: number;
  last_run_at: string | null;
};

export async function getStudentTaskStatuses(userId: string): Promise<StudentTaskStatus[]> {
  if (!userId) return [];
  try {
    const { data, error } = await supabase.rpc('get_student_task_statuses', { p_user_id: userId });
    if (error || !data) return [];
    return (Array.isArray(data) ? data : [data]) as StudentTaskStatus[];
  } catch {
    return [];
  }
}

// Fetch multiple tasks by IDs in one query (used to render titles for statuses)
export async function getTasksByIds(ids: string[]): Promise<LiveTask[]> {
  if (!ids || ids.length === 0) return [];
  try {
    const { data, error } = await supabase
      .from('live_tasks')
      .select('*')
      .in('id', ids);
    if (error || !data) return [];
    return data as LiveTask[];
  } catch {
    return [];
  }
}
