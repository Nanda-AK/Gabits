import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getChapterSpeedUnlock } from "@/services/practice";
import { toLabel } from "@/data/chaptersMap";
import { CircleDot, ChevronRight } from "lucide-react";

 type ChapterItem = { chapter: string; last_at: string | null; total_runs: number; speed: { unlocked: boolean; avg: number; count: number } };

interface ChaptersInProgressModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ChaptersInProgressModal({ open, onOpenChange }: ChaptersInProgressModalProps) {
  const { user, guest } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ChapterItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!open) return;
        setLoading(true);
        if (!user || guest) { if (!cancelled) setItems([]); return; }
        const { data, error } = await supabase
          .from('task_runs')
          .select('chapter, completed_at, started_at')
          .eq('user_id', user.id)
          .not('chapter', 'is', null);
        if (error) { if (!cancelled) setItems([]); return; }
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
        const enriched = await Promise.all(base.map(async b => {
          const s = await getChapterSpeedUnlock(user.id, b.chapter, 0.8, 3);
          return { ...b, speed: { unlocked: !!s.unlocked, avg: s.avg, count: s.count } } as ChapterItem;
        }));
        const onlyInProgress = enriched.filter(i => !i.speed.unlocked).sort((a,b) => (b.last_at||'').localeCompare(a.last_at||''));
        if (!cancelled) setItems(onlyInProgress);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, user?.id, guest]);

  const openChapter = (chapter: string) => {
    try { localStorage.setItem('play:pending_task', JSON.stringify({ id: null, mode: 'practice', difficulty: 'moderate', topics_csv: null, chapter })); } catch {}
    onOpenChange(false);
    navigate('/modes');
  };

  const computePct = (it: ChapterItem) => {
    const sessions = Math.min(1, it.speed.count / 3);
    const avg = Math.min(1, it.speed.avg / 0.8);
    return Math.max(0, Math.min(100, Math.round(sessions * avg * 100)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chapters In Progress</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-6 text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-4 text-sm text-muted-foreground">No chapters in progress.</div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.chapter} className="p-3 rounded-lg border bg-white/70 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold truncate">{toLabel(it.chapter) || it.chapter}</div>
                  <div className="text-[11px] text-gray-600 flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center gap-1 text-indigo-700 font-semibold"><CircleDot className="w-3.5 h-3.5"/> In Progress</span>
                    <span>Avg {Math.round((it.speed.avg||0)*100)}% / 80% • Sessions {it.speed.count}/3</span>
                  </div>
                  <div className="mt-1"><Progress className="h-2 bg-gray-200" value={computePct(it)} /></div>
                </div>
                <Button size="sm" className="rounded-full whitespace-nowrap" onClick={() => openChapter(it.chapter)}>Open <ChevronRight className="w-4 h-4 ml-1"/></Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
