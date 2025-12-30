import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getActiveTasks, subscribeActiveTasks, type LiveTask, getStudentTaskStatuses, type StudentTaskStatus } from "@/services/tasks";
import { getChapterSpeedUnlock } from "@/services/practice";
import { supabase } from "@/lib/supabase";

const TasksHubV2 = () => {
  const { user, guest } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<LiveTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Join -> store pending and go to Modes
  const join = (t: LiveTask) => {
    try {
      const payload = {
        id: t.id,
        mode: t.mode,
        difficulty: t.difficulty,
        topics_csv: t.topics_csv,
        chapter: t.chapter,
      } as const;
      localStorage.setItem('play:pending_task', JSON.stringify(payload));
    } catch { }
    navigate('/modes');
  };

  // Visuals for chapters
  const guessKey = (chapter?: string | null): string => {
    const s = (chapter || '').toLowerCase();
    if (s.includes('line') || s.includes('angle')) return 'linesandangle';
    if (s.includes('fraction')) return 'fraction';
    if (s.includes('pattern')) return 'patternsinmathematics';
    if (s.includes('number')) return 'numberplay';
    if (s.includes('prime')) return 'primetime';
    if (s.includes('construct')) return 'playingwithconstruciton';
    return 'fraction';
  };
  const chapterMeta: Record<string, { title: string; desc: string; img: string }> = {
    linesandangle: {
      title: 'Lines and Angles',
      desc: 'Line, point, ray, line segments, geometric shapes and their properties.',
      img: '/chaptersimg/linesandangle.jpeg',
    },
    fraction: {
      title: 'Fractions',
      desc: 'Simplifying fractions, equivalent fractions, adding and subtracting fractions.',
      img: '/chaptersimg/fraction.jpeg',
    },
    patternsinmathematics: {
      title: 'Patterns in Mathematics',
      desc: 'Number patterns, relations among number sequences; identifying and extending series.',
      img: '/chaptersimg/patternsinmathematics.jpeg',
    },
    numberplay: {
      title: 'Number Play',
      desc: 'Mental math, palindromes, super cells, and more playful number ideas.',
      img: '/chaptersimg/numberplay.jpeg',
    },
    primetime: {
      title: 'Prime Time',
      desc: 'Prime factorization, divisibility rules, common factors, primes & co-primes.',
      img: '/chaptersimg/primetime.jpeg',
    },
    playingwithconstruciton: {
      title: 'Playing with Constructions',
      desc: 'Addition, subtraction, multiplication, division, and geometric constructions.',
      img: '/chaptersimg/playingwithconstruciton.jpeg',
    },
  };
  const renderCard = (t: LiveTask) => {
    const key = guessKey(t.chapter);
    const meta = chapterMeta[key] || { title: t.title, desc: t.topics_csv || '—', img: '/placeholder.svg' };
    return (
      <Card key={t.id} className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm bg-white">
        <div className="w-full h-40 bg-gray-100 overflow-hidden">
          <img src={meta.img} alt={meta.title} className="w-full h-full object-cover" />
        </div>
        <CardContent className="p-4">
          <div className="text-base font-bold mb-1">{t.chapter ? meta.title : t.title}</div>
          <div className="text-xs text-gray-600 min-h-[36px]">{meta.desc}</div>
          <div className="mt-3 flex justify-end">
            <Button className="rounded-full bg-[#6C5CE7] hover:bg-[#5A4FE0]" onClick={() => join(t)}>Join</Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Fetch + filter with loading + parallel checks
  useEffect(() => {
    let cancelled = false;

    const applyFilter = async (items: LiveTask[]) => {
      if (!user || guest) return [] as LiveTask[];
      // Pull server-calculated statuses so Tasks page matches the home badge
      let statusMap = new Map<string, StudentTaskStatus['status']>();
      let statusList: StudentTaskStatus[] = [];
      try {
        statusList = await getStudentTaskStatuses(user.id);
        statusMap = new Map(statusList.map(s => [s.task_id, s.status]));
      } catch {}
      // If backend provided statuses, strictly mirror them to avoid badge/page mismatch
      if (statusList.length > 0) {
        const keepIds = new Set(statusList.filter(s => s.status === 'not_started').map(s => s.task_id));
        return (items || []).filter(t => keepIds.has(t.id));
      }
      // Otherwise, fall back to client heuristics
      // For each task decide: keep in "new tasks" or hide if in_progress/completed
      const checks = await Promise.all((items || []).map(async (t) => {
        try {
          // 1) Trust backend status when available (works for tasks with/without chapter)
          const s = statusMap.get(t.id);
          if (s === 'completed' || s === 'in_progress') return { keep: false, t } as const;
          if (s === 'not_started') return { keep: true, t } as const;

          // 2) Fallbacks when status is missing
          // Completed if Speed unlocked for the chapter (only if chapter present)
          if (t.chapter) {
            const speed = await getChapterSpeedUnlock(user.id, t.chapter!, 0.8, 3);
            if (speed?.unlocked) return { keep: false, t } as const; // completed -> hide from new
          }

          // In progress for THIS specific task assignment if at least one completed run exists (full match >=10 questions)
          const { count } = await supabase
            .from('task_runs')
            .select('id', { count: 'exact', head: true })
            .eq('task_id', t.id)
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .not('total', 'is', null)
            .gte('total', 10);
          if ((count ?? 0) > 0) return { keep: false, t } as const; // in progress -> hide from new
          return { keep: true, t } as const;
        } catch {
          return { keep: true, t } as const;
        }
      }));
      return checks.filter(c => c.keep).map(c => c.t);
    };

    (async () => {
      if (!user || guest) { setTasks([]); setLoading(false); return; }
      setLoading(true);
      const items = await getActiveTasks();
      const filtered = await applyFilter(items);
      if (!cancelled) { setTasks(filtered); setLoading(false); }
    })();

    const unsub = subscribeActiveTasks(async (items) => {
      if (cancelled || !user || guest) return;
      setLoading(true);
      const filtered = await applyFilter(items);
      if (!cancelled) { setTasks(filtered); setLoading(false); }
    });

    return () => { cancelled = true; try { unsub(); } catch { } };
  }, [user?.id, guest]);

  return (
    <div className="min-h-[100svh] md:min-h-screen bg-white">
      <div className="container mx-auto max-w-6xl px-4 pt-14 sm:pt-16 pb-10" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)" }}>
        <h1 className="text-2xl sm:text-3xl font-black mb-6">Assignments</h1>
        {(!user || guest) && (
          <div className="text-sm text-muted-foreground">Sign in to view assignments.</div>
        )}
        {user && loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={`sk-${i}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <div className="w-full h-40 bg-gray-200 animate-pulse" />
                <CardContent className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded w-full animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded w-5/6 animate-pulse" />
                  <div className="mt-3 h-9 bg-gray-200 rounded-full w-24 ml-auto animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {user && !loading && tasks.length === 0 && (
          <div className="text-sm text-muted-foreground">No assignment available yet. Your teacher will start a task soon.</div>
        )}
        {user && !loading && tasks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tasks.map((t) => renderCard(t))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TasksHubV2;
