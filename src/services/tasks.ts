import { supabase } from "@/lib/supabase";

export type LiveTask = {
  id: string;
  title: string;
  mode: 'practice' | 'speed' | 'battle-ai' | 'battle-friends';
  topics_csv: string; // comma-separated topics
  difficulty: 'easy' | 'moderate' | 'difficult' | null;
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

export async function startLiveTask(params: {
  title: string;
  mode: LiveTask['mode'];
  topics: string[];
  difficulty?: LiveTask['difficulty'];
  created_by: string;
}): Promise<LiveTask | null> {
  try {
    const payload = {
      title: params.title || 'Live Task',
      mode: params.mode,
      topics_csv: (params.topics || []).join(','),
      difficulty: params.difficulty ?? null,
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
