import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getChapterSpeedUnlock } from "@/services/practice";
import { toLabel } from "@/data/chaptersMap";
import { CheckCircle2, CircleDot, ChevronRight, BarChart3 } from "lucide-react";

 type ChapterItem = {
  chapter: string;
  last_at: string | null;
  total_runs: number;
  speed: { unlocked: boolean; avg: number; count: number };
};

const ChaptersProgress = () => {
  const { user, guest } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ChapterItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user || guest) { if (!cancelled) { setItems([]); setLoading(false); } return; }
        // Fetch completed runs with a chapter and group by chapter client-side
        const { data, error } = await supabase
          .from('task_runs')
          .select('chapter, completed_at, started_at')
          .eq('user_id', user.id)
          .not('chapter', 'is', null);
        if (error) { if (!cancelled) { setItems([]); setLoading(false); } return; }
        const rows = (data as any[]) || [];
        const map = new Map<string, { last_at: string | null; total_runs: number }>();
        for (const r of rows) {
          const ch = String(r.chapter || '').trim();
          if (!ch) continue;
          const m = map.get(ch) || { last_at: null, total_runs: 0 };
          m.total_runs += 1;
          const la = r.completed_at || r.started_at || null;
          if (la && (!m.last_at || la > m.last_at)) m.last_at = la;
          map.set(ch, m);
        }
        const base = Array.from(map.entries()).map(([chapter, m]) => ({ chapter, last_at: m.last_at, total_runs: m.total_runs }));
        // For each chapter, compute/persist speed unlock status
        const enriched = await Promise.all(base.map(async b => {
          const s = await getChapterSpeedUnlock(user.id, b.chapter, 0.8, 3);
          return { ...b, speed: { unlocked: !!s.unlocked, avg: s.avg, count: s.count } } as ChapterItem;
        }));
        // Keep only in-progress chapters
        const onlyInProgress = enriched.filter(i => !i.speed.unlocked).sort((a, b) => (b.last_at || '').localeCompare(a.last_at || ''));
        if (!cancelled) setItems(onlyInProgress);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, guest]);

  const inProgressCount = useMemo(() => items.length, [items]);

  const goBack = () => navigate(-1);
  const openModesForChapter = (chapter: string) => {
    try {
      const payload = { id: null, mode: 'practice', difficulty: 'moderate', topics_csv: null, chapter } as const;
      localStorage.setItem('play:pending_task', JSON.stringify(payload));
    } catch {}
    navigate('/modes');
  };

  return (
    <div className="min-h-[100svh] md:min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-emerald-50">
      <div className="container mx-auto px-4 pt-14 sm:pt-16 pb-10 max-w-3xl" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)" }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-indigo-700 to-emerald-700 bg-clip-text text-transparent flex items-center gap-3">
            <BarChart3 className="w-6 h-6"/> Task Progress by Chapter
          </h1>
          <Button variant="outline" onClick={goBack}>Back</Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No chapters yet. Play any mode to start progress.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">In Progress</CardTitle></CardHeader>
                <CardContent className="text-2xl font-black text-indigo-700">{inProgressCount}</CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Chapters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {items.map((it) => {
                    const label = toLabel(it.chapter) || it.chapter;
                    const pct = Math.max(0, Math.min(100, Math.round((Math.min(1, it.speed.count/3) * Math.min(1, it.speed.avg/0.8)) * 100)));
                    return (
                      <div key={it.chapter} className="p-3 rounded-lg border bg-white/70">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-bold">{label}</div>
                            <div className="text-xs text-muted-foreground">{it.last_at ? `Last played: ${new Date(it.last_at).toLocaleString()}` : '—'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-indigo-700 text-xs font-semibold"><CircleDot className="w-4 h-4"/> In Progress</span>
                            <Button size="sm" className="rounded-full" onClick={() => openModesForChapter(it.chapter)}>Open <ChevronRight className="w-4 h-4 ml-1"/></Button>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
                            <span>Avg {Math.round((it.speed.avg||0)*100)}% / 80%</span>
                            <span>Sessions {it.speed.count}/3</span>
                          </div>
                          <Progress className="h-2 bg-gray-200" value={pct} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default ChaptersProgress;
