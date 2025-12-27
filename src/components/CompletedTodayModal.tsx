import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins, Trophy, Gamepad2, Rocket, CalendarDays, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { getLocalYMD } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import type { TaskRun } from "@/services/taskRuns";
import { useNavigate } from "react-router-dom";

interface CompletedTodayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string | null;
  isGuest?: boolean;
}

type TaskRunWithTask = TaskRun & {
  live_tasks?: {
    id: string;
    title: string;
    chapter: string | null;
  };
};

type RewardEvent = {
  id?: number;
  created_at: string;
  source: string;
  coins_delta: number;
  gems_delta: number;
  badges_delta: number;
  meta: any;
};

type Item =
  | { kind: 'run'; time: string; data: TaskRunWithTask }
  | { kind: 'event'; time: string; data: RewardEvent };

export function CompletedTodayModal({ open, onOpenChange, userId, isGuest }: CompletedTodayModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<TaskRunWithTask[]>([]);
  const [events, setEvents] = useState<RewardEvent[]>([]);
  const today = useMemo(() => getLocalYMD(), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Helpers to move date by +/- n days (local)
  const shiftYmd = (ymd: string, delta: number) => {
    const [y, m, d] = ymd.split('-').map((n) => parseInt(n));
    const base = new Date(y, (m || 1) - 1, d || 1);
    base.setDate(base.getDate() + delta);
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, '0');
    const dd = String(base.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // fetch all sessions for the selected date when opened or date changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!open) return;
      setLoading(true);
      try {
        if (!userId || isGuest) {
          setRuns([]);
          setEvents([]);
          return;
        }
        // Local day bounds to UTC range for selectedDate
        const [y, m, d] = selectedDate.split('-').map((n) => parseInt(n));
        const startLocal = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
        const endLocal = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
        const startUtcIso = new Date(startLocal.getTime() - startLocal.getTimezoneOffset() * 60000).toISOString();
        const endUtcIso = new Date(endLocal.getTime() - endLocal.getTimezoneOffset() * 60000).toISOString();

        // 1) All completed task_runs today (e.g., classroom/live tasks)
        const runsQ = await supabase
          .from('task_runs')
          .select('*, live_tasks(title, chapter)')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .gte('completed_at', startUtcIso)
          .lte('completed_at', endUtcIso)
          .order('completed_at', { ascending: true });
        if (!cancelled) setRuns((runsQ.data as any[]) ?? []);

        // 2) All reward events today (practice/speed/compete completions)
        const evQ = await supabase
          .from('reward_events')
          .select('id, created_at, source, coins_delta, gems_delta, badges_delta, meta')
          .eq('user_id', userId)
          .eq('date', selectedDate)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true });
        const rawEvents = (evQ.data as any[]) ?? [];
        const filtered = rawEvents.filter((e: any) => {
          const s = String(e.source || '');
          return s.includes('practice') || s.includes('speed') || s.includes('compete');
        });
        if (!cancelled) setEvents(filtered);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, userId, isGuest, selectedDate]);

  const items: Item[] = useMemo(() => {
    const runItems: Item[] = runs.map(r => ({ kind: 'run', time: (r as any).completed_at || (r as any).updated_at || '', data: r }));
    const evItems: Item[] = events.map(e => ({ kind: 'event', time: e.created_at, data: e }));
    return [...runItems, ...evItems]
      .filter(x => !!x.time)
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [runs, events]);

  const primary = (
    <Button className="rounded-xl" onClick={() => { onOpenChange(false); navigate('/modes'); }}>
      <Rocket className="w-4 h-4 mr-2" /> Play Now
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-600" /> Completions
          </DialogTitle>
          <div className="flex items-center justify-between">
            <DialogDescription className="text-xs flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5" /> {selectedDate}
            </DialogDescription>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDate((d) => shiftYmd(d, -1))} aria-label="Previous day"><ChevronLeft className="w-4 h-4"/></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDate((d) => shiftYmd(d, +1))} aria-label="Next day" disabled={selectedDate >= today}><ChevronRight className="w-4 h-4"/></Button>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (items.length > 0) ? (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {items.map((it, idx) => {
              if (it.kind === 'run') {
                const r = it.data as TaskRunWithTask;
                const title = r.live_tasks?.title || (r.mode === 'practice' ? 'Practice Session' : r.mode === 'speed' ? 'Speed Run' : r.mode === 'battle-ai' ? 'AI Battle' : 'Friends Battle');
                const line = `${r.mode} • ${r.difficulty || '—'}${r.live_tasks?.chapter ? ` • ${r.live_tasks.chapter}` : ''}`;
                return (
                  <div key={`run-${r.id}-${idx}`} className="p-3 rounded-xl border bg-white/70 flex items-center justify-between">
                    <div className="min-w-0 pr-3">
                      <div className="text-sm font-extrabold truncate">{title}</div>
                      <div className="text-xs text-muted-foreground truncate">{line}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <div className="font-semibold text-gray-800">{r.correct} / {r.total}</div>
                      {typeof r.coins_earned === 'number' && <div className="font-bold text-amber-700">+{r.coins_earned}</div>}
                      {typeof r.hearts_left === 'number' && <div className="font-bold text-rose-600">{r.hearts_left} ❤</div>}
                    </div>
                  </div>
                );
              } else {
                const e = it.data as RewardEvent;
                const s = e.source || '';
                const mode = s.includes('practice') ? 'practice' : s.includes('speed') ? 'speed' : s.includes('compete-ai') ? 'battle-ai' : s.includes('compete-friends') ? 'battle-friends' : s.includes('compete') ? 'battle' : 'activity';
                const title = mode === 'practice' ? 'Practice Session' : mode === 'speed' ? 'Speed Run' : mode === 'battle-ai' ? 'AI Battle' : mode === 'battle-friends' ? 'Friends Battle' : mode === 'battle' ? 'Battle' : 'Activity';
                const diff = e.meta?.difficulty || e.meta?.type || '—';
                const res = e.meta?.result as string | undefined;
                const acc = typeof e.meta?.acc === 'number' ? `${Math.round(e.meta.acc * 100)}%` : undefined;
                return (
                  <div key={`evt-${e.id ?? idx}`} className="p-3 rounded-xl border bg-white/70">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold truncate">{title}</div>
                        <div className="text-xs text-muted-foreground truncate">{mode} • {diff}{res ? ` • ${res}` : ''}{acc ? ` • ${acc}` : ''}</div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Coins className="w-4 h-4 text-amber-600" />
                        <div className="font-bold text-amber-700">+{e.coins_delta}</div>
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        ) : (
          <div className="py-4">
            <div className="p-4 rounded-xl border-2 border-dashed border-amber-200 bg-white/60 text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground"><Gamepad2 className="w-5 h-5"/> No completions recorded on {selectedDate}.</div>
            </div>
            <div className="mt-4 flex justify-center">{primary}</div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" className="rounded-xl" onClick={() => onOpenChange(false)}>Close</Button>
          {items.length === 0 && primary}
        </div>
      </DialogContent>
    </Dialog>
  );
}
