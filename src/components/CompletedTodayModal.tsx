import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { toLabel } from "@/data/chaptersMap";

interface CompletedTodayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string | null;
  isGuest?: boolean;
}

type CompletedChapter = { chapter: string; unlocked_at: string };

export function CompletedTodayModal({ open, onOpenChange, userId, isGuest }: CompletedTodayModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState<CompletedChapter[]>([]);

  // Load completed chapters (Speed unlocked) when modal opens
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!open) return;
      setLoading(true);
      try {
        if (!userId || isGuest) { setCompleted([]); return; }
        const { data, error } = await supabase
          .from('chapter_mode_unlocks')
          .select('chapter, unlocked_at')
          .eq('user_id', userId)
          .eq('mode', 'speed')
          .order('unlocked_at', { ascending: false });
        if (error || !data) { if (!cancelled) setCompleted([]); return; }
        if (!cancelled) setCompleted((data as any[]).map(r => ({ chapter: r.chapter as string, unlocked_at: r.unlocked_at as string })));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, userId, isGuest]);

  const openChapter = (chapter: string) => {
    try { localStorage.setItem('play:pending_task', JSON.stringify({ id: null, mode: 'practice', difficulty: 'moderate', topics_csv: null, chapter })); } catch {}
    onOpenChange(false);
    navigate('/modes');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-600" /> Completed Chapters
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : completed.length > 0 ? (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {completed.map((c, idx) => (
              <div key={`${c.chapter}-${idx}`} className="p-3 rounded-xl border bg-white/70 flex items-center justify-between">
                <div className="min-w-0 pr-3">
                  <div className="text-sm font-extrabold truncate">{toLabel(c.chapter) || c.chapter}</div>
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600"/> Completed on {new Date(c.unlocked_at).toLocaleString()}</div>
                </div>
                <Button size="sm" className="rounded-full" onClick={() => openChapter(c.chapter)}>Open</Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-sm text-muted-foreground text-center">No completed chapters yet.</div>
        )}

        <div className="mt-4 flex justify-end"><Button variant="secondary" className="rounded-xl" onClick={() => onOpenChange(false)}>Close</Button></div>
      </DialogContent>
    </Dialog>
  );
}
