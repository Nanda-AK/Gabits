import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getMilestoneCounts, type MilestoneCounts } from "@/services/stats";

interface AchievementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coins: number;
  correctAnswers: number;
  totalQuestions: number;
  lifetime?: Set<any>;
}

export const AchievementModal = ({ open, onOpenChange }: AchievementModalProps) => {
  const { user, guest } = useAuth();
  const [counts, setCounts] = useState<MilestoneCounts>({ silver: 0, gold: 0, platinum: 0, diamond: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!open) return;
      if (!user || guest) { setCounts({ silver: 0, gold: 0, platinum: 0, diamond: 0 }); return; }
      const c = await getMilestoneCounts(user.id);
      if (!cancelled) setCounts(c);
    })();
    return () => { cancelled = true; };
  }, [open, user, guest]);
  
  // Only show Silver, Gold, Platinum totals with images

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-card via-card/95 to-card/90 border-2 border-primary/30 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <img src="/treasureboximg.png" alt="Treasure" className="w-8 h-8" />
            My Treasure
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
          <div className="flex flex-col items-center justify-center p-4 rounded-xl border bg-gradient-to-br from-slate-50 to-slate-100">
            <img src="/assets/silverimage.png" alt="Silver" className="w-20 h-16 object-contain drop-shadow" />
            <div className="mt-2 text-sm font-semibold text-muted-foreground">Silver</div>
            <div className="text-2xl font-extrabold text-slate-700">{counts.silver}</div>
          </div>
          <div className="flex flex-col items-center justify-center p-4 rounded-xl border bg-gradient-to-br from-amber-50 to-yellow-50">
            <img src="/assets/goldimage.png" alt="Gold" className="w-20 h-16 object-contain drop-shadow" />
            <div className="mt-2 text-sm font-semibold text-muted-foreground">Gold</div>
            <div className="text-2xl font-extrabold text-amber-700">{counts.gold}</div>
          </div>
          <div className="flex flex-col items-center justify-center p-4 rounded-xl border bg-gradient-to-br from-indigo-50 to-slate-100">
            <img src="/assets/platinuumimage.png" alt="Platinum" className="w-20 h-16 object-contain drop-shadow" />
            <div className="mt-2 text-sm font-semibold text-muted-foreground">Platinum</div>
            <div className="text-2xl font-extrabold text-indigo-700">{counts.platinum}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
