import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getMilestoneCounts, type MilestoneCounts } from "@/services/stats";

function useSnapshot() {
  const [coins, setCoins] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    try {
      setCoins(Number(localStorage.getItem("player:coins") || "0"));
      setCorrect(Number(localStorage.getItem("player:lastProgressCorrect") || "0"));
      setTotal(Number(localStorage.getItem("player:lastProgressTotal") || "0"));
    } catch {}
  }, []);
  return { coins, correct, total };
}

const Treasure = () => {
  const navigate = useNavigate();
  const { coins } = useSnapshot();
  const { user, guest } = useAuth();
  const [counts, setCounts] = useState<MilestoneCounts>({ silver: 0, gold: 0, platinum: 0, diamond: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setCounts({ silver: 0, gold: 0, platinum: 0, diamond: 0 }); return; }
      const c = await getMilestoneCounts(user.id);
      if (!cancelled) setCounts(c);
    })();
    return () => { cancelled = true; };
  }, [user, guest]);

  // Note: Weekly progress data not yet tracked server-side; showing required UI only

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-white">
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent flex items-center gap-2">
            <img src="/treasureboximg.png" className="w-8 h-8"/> My Treasure
          </h1>
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Week Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-3 mb-3">
                <div className="text-4xl font-black text-amber-600">7</div>
                <div className="text-xs text-muted-foreground">days</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
                  <div key={d} className="px-2.5 py-1 rounded-full border bg-white/70 text-xs font-semibold text-gray-700">
                    {d}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Coins</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Coins className="w-8 h-8 text-amber-600" />
              <div>
                <div className="text-2xl font-black text-amber-900">{coins}</div>
                <div className="text-xs text-amber-700">Wallet balance</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lifetime Achievement Counts (RPC) */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Lifetime Achievements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            {(!user || guest) && (
              <div className="text-center text-xs text-muted-foreground mt-2">Sign in to track lifetime counts.</div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Achievements grid removed; lifetime section above is the only achievements display */}
      </div>
    </div>
  );
};

export default Treasure;
