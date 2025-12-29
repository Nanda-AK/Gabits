import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getActiveTasks, subscribeActiveTasks, type LiveTask } from "@/services/tasks";
import { getChapterSpeedUnlock } from "@/services/practice";

const TasksHub = () => {
  const { user, guest } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<LiveTask[]>([]);

  useEffect(() => {
    let cancelled = false;
    const applyFilter = async (items: LiveTask[]) => {
      if (!user || guest) return [] as LiveTask[];
      // Hide tasks whose chapter is already completed (Speed unlocked lifetime)
      const filtered: LiveTask[] = [];
      for (const t of items) {
        if (!t.chapter) { filtered.push(t); continue; }
        try {
          const r = await getChapterSpeedUnlock(user.id, t.chapter, 0.8, 3);
          if (!r.unlocked) filtered.push(t);
        } catch { filtered.push(t); }
      }
      return filtered;
    };
    (async () => {
      if (!user || guest) { setTasks([]); return; }
      const items = await getActiveTasks();
      const filtered = await applyFilter(items);
      if (!cancelled) setTasks(filtered);
    })();
    const unsub = subscribeActiveTasks(async (items) => {
      if (cancelled || !user || guest) return;
      const filtered = await applyFilter(items);
      if (!cancelled) setTasks(filtered);
    });
    return () => { cancelled = true; unsub(); };
  }, [user?.id, guest]);

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
    } catch {}
    navigate('/modes');
  };

  // Chapter visuals mapping and card renderer
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

  return (
    <div className="min-h-[100svh] md:min-h-screen bg-white">
      <div className="container mx-auto max-w-6xl px-4 pt-14 sm:pt-16 pb-10" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)" }}>
        <h1 className="text-2xl sm:text-3xl font-black mb-6">Assignments</h1>
        {(!user || guest) && (
          <div className="text-sm text-muted-foreground">Sign in to view assignments.</div>
        )}
        {user && tasks.length === 0 && (
          <div className="text-sm text-muted-foreground">No assignment available yet. Your teacher will start a task soon.</div>
        )}
        {user && tasks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tasks.map((t) => renderCard(t))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TasksHub;
