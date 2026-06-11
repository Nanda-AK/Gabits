import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getActiveTasks, subscribeActiveTasks, type LiveTask, getStudentTaskStatuses, type StudentTaskStatus } from "@/services/tasks";
import { getChapterSpeedUnlock } from "@/services/practice";
import { supabase } from "@/lib/supabase";

const TasksHubV2 = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') || 'new') as 'new' | 'in_progress' | 'completed';
  const [newTasks, setNewTasks] = useState<LiveTask[]>([]);
  const [inProgressTasks, setInProgressTasks] = useState<LiveTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<LiveTask[]>([]);
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
    if (s.includes('geometry')) return 'basicsgeometry';
    if (s.includes('line') || s.includes('angle')) return 'linesandangle';
    if (s.includes('fraction')) return 'fraction';
    if (s.includes('pattern')) return 'patternsinmathematics';
    if (s.includes('number')) return 'numberplay';
    if (s.includes('prime')) return 'primetime';
    if (s.includes('construct')) return 'playingwithconstruciton';
    return 'fraction';
  };
  const chapterMeta: Record<string, { title: string; desc: string; img: string }> = {
    basicsgeometry: {
      title: 'Basics of Geometry',
      desc: 'Points, lines, rays, line segments, angles, symmetry, perimeter and simple mensuration.',
      img: '/chaptersimg/linesandangle.jpeg',
    },
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
      img: '/chaptersimg/playingwithconstruction.jpeg',
    },
  };
  const renderCard = (t: LiveTask, cta: 'Join' | 'Open' = 'Join') => {
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
            <Button className="rounded-full bg-[#6C5CE7] hover:bg-[#5A4FE0]" onClick={() => join(t)}>{cta}</Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Fetch active tasks and build per-tab lists (new / in-progress / completed)
  useEffect(() => {
    let cancelled = false;

    const buildLists = async (items: LiveTask[]) => {
      if (!user) return { new: [] as LiveTask[], progress: [] as LiveTask[], completed: [] as LiveTask[] };

      // Try server-side statuses first
      let statusList: StudentTaskStatus[] = [];
      try { statusList = await getStudentTaskStatuses(user.id); } catch {}

      // Restrict to active tasks only
      const activeIds = new Set(items.map(t => t.id));
      const stActive = (statusList || []).filter(s => activeIds.has(s.task_id));

      if (stActive.length > 0) {
        const byId = new Map(items.map(t => [t.id, t]));
        const newList = stActive.filter(s => s.status === 'not_started').map(s => byId.get(s.task_id)!).filter(Boolean) as LiveTask[];
        const progList = stActive.filter(s => s.status === 'in_progress').map(s => byId.get(s.task_id)!).filter(Boolean) as LiveTask[];
        const doneList = stActive.filter(s => s.status === 'completed').map(s => byId.get(s.task_id)!).filter(Boolean) as LiveTask[];
        return { new: newList, progress: progList, completed: doneList };
      }

      // Fallback: compute statuses client-side
      const lists = { new: [] as LiveTask[], progress: [] as LiveTask[], completed: [] as LiveTask[] };
      await Promise.all((items || []).map(async (t) => {
        try {
          if (t.chapter) {
            const speed = await getChapterSpeedUnlock(user.id, t.chapter!, 0.8, 3);
            if (speed?.unlocked) { lists.completed.push(t); return; }
          }
          const { count } = await supabase
            .from('task_runs')
            .select('id', { count: 'exact', head: true })
            .eq('task_id', t.id)
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .not('total', 'is', null)
            .gte('total', 10);
          if ((count ?? 0) > 0) lists.progress.push(t);
          else lists.new.push(t);
        } catch {
          lists.new.push(t);
        }
      }));
      return lists;
    };

    (async () => {
      if (!user) { setNewTasks([]); setInProgressTasks([]); setCompletedTasks([]); setLoading(false); return; }
      setLoading(true);
      const items = await getActiveTasks();
      const lists = await buildLists(items);
      if (!cancelled) {
        setNewTasks(lists.new);
        setInProgressTasks(lists.progress);
        setCompletedTasks(lists.completed);
        setLoading(false);
      }
    })();

    const unsub = subscribeActiveTasks(async (items) => {
      if (cancelled || !user) return;
      setLoading(true);
      const lists = await buildLists(items);
      if (!cancelled) {
        setNewTasks(lists.new);
        setInProgressTasks(lists.progress);
        setCompletedTasks(lists.completed);
        setLoading(false);
      }
    });

    return () => { cancelled = true; try { unsub(); } catch { } };
  }, [user?.id]);

  return (
    <div className="min-h-[100svh] md:min-h-screen bg-white">
      <div className="container mx-auto max-w-6xl px-4 pt-14 sm:pt-16 pb-10" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)" }}>
        <h1 className="text-2xl sm:text-3xl font-black mb-6">Assignments</h1>
        {!user && (
          <div className="text-sm text-muted-foreground">Sign in to view assignments.</div>
        )}
        {user && (
          <Tabs value={currentTab} onValueChange={(v) => setSearchParams({ tab: v as string })}>
            <TabsList className="mb-4">
              <TabsTrigger value="new">New ({newTasks.length})</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress ({inProgressTasks.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="new">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={`sk-n-${i}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
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
              ) : newTasks.length === 0 ? (
                <div className="text-sm text-muted-foreground">No assignment available yet. Your teacher will start a task soon.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {newTasks.map((t) => renderCard(t, 'Join'))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="in_progress">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={`sk-p-${i}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
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
              ) : inProgressTasks.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nothing in progress.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inProgressTasks.map((t) => renderCard(t, 'Open'))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={`sk-c-${i}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
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
              ) : completedTasks.length === 0 ? (
                <div className="text-sm text-muted-foreground">No completed active tasks.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {completedTasks.map((t) => renderCard(t, 'Open'))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default TasksHubV2;
