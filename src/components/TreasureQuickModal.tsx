import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Coins, Heart, Gem, Star, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserBalances } from "@/services/rewards";
import { getBadgeCounts } from "@/services/achievements";

interface TreasureQuickModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionCoins: number;
  hearts: number;
  correctAnswers: number;
  total: number;
}

export function TreasureQuickModal({ open, onOpenChange, sessionCoins, hearts, correctAnswers, total }: TreasureQuickModalProps) {
  const { user, guest } = useAuth();
  const [walletCoins, setWalletCoins] = useState<number>(0);
  const [balances, setBalances] = useState<{ coins: number; gems: number; xp: number } | null>(null);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});

  // Badge metadata for images and labels
  const getBadgeInfo = (key: string): { name: string; img: string } => {
    const badges: Record<string, { name: string; img: string }> = {
      focused_learner: { name: "Focused Learner", img: "/assets/focused_learner.png" },
      math_explorer: { name: "Math Explorer", img: "/assets/math_explorer.png" },
      speed_master: { name: "Speed Master", img: "/assets/speed_master.png" },
      ai_challenger: { name: "AI Challenger", img: "/assets/ai_challenger.png" },
      social_legend: { name: "Social Legend", img: "/assets/social_legend.png" },
    };
    return badges[key] || { name: key, img: "/placeholder.svg" };
  };

  // Refresh wallet snapshot on open
  useEffect(() => {
    if (!open) return;
    try {
      setWalletCoins(Number(localStorage.getItem('player:coins') || '0'));
    } catch {}

    let cancelled = false;
    (async () => {
      if (!user || guest) { setBalances(null); return; }
      const b = await getUserBalances(user.id);
      if (!cancelled) setBalances(b ? { coins: b.coins, gems: b.gems, xp: b.xp } : { coins: 0, gems: 0, xp: 0 });
      // Load badge counts
      const bc = await getBadgeCounts(user.id);
      if (!cancelled) {
        setBadgeCounts(bc);
      }
    })();
    return () => { cancelled = true; };
  }, [open, user, guest]);

  const progressPct = total > 0 ? Math.min(100, Math.round(((correctAnswers || 0) / total) * 100)) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black text-lg">
            <img src="/treasure_close.png" className="w-6 h-6" /> My Treasure
          </DialogTitle>
          <DialogDescription className="text-xs">Quick view while your game is paused</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Wallet Snapshot */}
          {guest || !user ? (
            <div className="rounded-xl border-2 border-amber-200 bg-white/70 p-3 flex items-center gap-3">
              <Coins className="w-5 h-5 text-amber-600" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Wallet Coins (Guest)</div>
                <div className="text-xl font-black text-amber-900">{walletCoins}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Session</div>
                <div className="text-base font-extrabold text-amber-700">+{sessionCoins}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-amber-200 bg-white/70 p-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2">My Wallet</div>
              <div className="grid grid-cols-3 gap-3 items-center">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-600" />
                  <div>
                    <div className="text-base font-black text-amber-900">{balances?.coins ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">Coins</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Gem className="w-5 h-5 text-fuchsia-600" />
                  <div>
                    <div className="text-base font-black text-fuchsia-700">{balances?.gems ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">Gems</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-indigo-600" />
                  <div>
                    <div className="text-base font-black text-indigo-700">{balances?.xp ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">XP</div>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-right text-xs">
                <span className="text-muted-foreground">Session Coins:</span> <span className="font-bold text-amber-700">+{sessionCoins}</span>
              </div>
            </div>
          )}

          {/* Session Status */}
          <div className="rounded-xl border bg-white/70 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground">Session Progress</div>
              <div className="flex items-center gap-1 text-rose-600"><Heart className="w-4 h-4" /> <span className="text-xs font-bold">{hearts}</span></div>
            </div>
            <div className="mt-1 text-sm font-bold">{correctAnswers} / {total} correct</div>
            <div className="mt-2 h-2 bg-amber-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400" style={{ width: `${progressPct}%` }} />
            </div>
          </div>


          {/* Earned Badges (only if any) */}
          {!guest && user && badgeCounts && Object.values(badgeCounts).some((v) => (v ?? 0) > 0) && (
            <div className="rounded-xl border bg-white/70 p-3">
              <div className="text-sm font-semibold text-amber-700 mb-2">Badges Earned</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(["focused_learner","math_explorer","speed_master","ai_challenger","social_legend"] as const)
                  .filter((key) => (badgeCounts[key] ?? 0) > 0)
                  .map((key) => {
                    const info = getBadgeInfo(key);
                    const count = badgeCounts[key] ?? 0;
                    return (
                      <div key={key} className="flex items-center gap-2 p-2 rounded-lg border bg-white/80">
                        <div className="relative">
                          <img src={info.img} alt={info.name} className="w-8 h-8 object-contain" />
                          {count > 1 && (
                            <div className="absolute -top-1 -right-1 px-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 shadow">×{count}</div>
                          )}
                        </div>
                        <div className="text-xs font-bold text-gray-800">{info.name}</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
