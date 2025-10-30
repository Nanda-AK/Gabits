import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getMilestoneCounts, type MilestoneCounts } from "@/services/stats";
import { supabase } from "@/lib/supabase";

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

  const weekLabels = useMemo(() => ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], []);
  const [weekDays, setWeekDays] = useState<Array<{ label: string; date: string; done: boolean }>>([]);

  // Build current week (Mon-Sun) dates
  useEffect(() => {
    const today = new Date();
    const jsDay = today.getDay(); // 0..6, Sun=0
    const diffToMonday = jsDay === 0 ? -6 : (1 - jsDay);
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    const arr: Array<{ label: string; date: string; done: boolean }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ymd = d.toISOString().split('T')[0];
      arr.push({ label: weekLabels[i], date: ymd, done: false });
    }
    setWeekDays(arr);
  }, [weekLabels.join('|')]);

  // Fetch completions for current week (authenticated users only)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest || weekDays.length === 0) return;
      const start = weekDays[0].date;
      const end = weekDays[6].date;
      const { data, error } = await supabase
        .from('daily_progress')
        .select('date, completed')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end);
      if (error || !data) return;
      const byDate = new Map<string, boolean>();
      for (const row of data as Array<{ date: string; completed: boolean }>) {
        if (!byDate.has(row.date)) byDate.set(row.date, !!row.completed);
        else byDate.set(row.date, byDate.get(row.date)! || !!row.completed);
      }
      if (!cancelled) {
        setWeekDays(prev => prev.map(w => ({ ...w, done: !!byDate.get(w.date) })));
      }
    })();
    return () => { cancelled = true; };
  }, [user, guest, weekDays.map(w => w.date).join('|')]);

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
                {weekDays.map(({ label, date, done }) => (
                  <div
                    key={date}
                    className={
                      done
                        ? "px-2.5 py-1 rounded-full border text-xs font-semibold bg-green-100 border-green-300 text-green-800"
                        : "px-2.5 py-1 rounded-full border bg-white/70 text-xs font-semibold text-gray-700"
                    }
                    title={date + (done ? " — completed" : "")}
                  >
                    {label}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
              <div className="flex flex-col items-center justify-center p-4 rounded-xl border bg-gradient-to-br from-cyan-50 to-blue-50">
                {/* Diamond icon (inline SVG) */}
                <svg width="80" height="64" viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg" aria-label="Diamond" role="img" className="drop-shadow">
                  <defs>
                    <linearGradient id="gradDiamondTreasure" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#E0F7FA" />
                      <stop offset="50%" stopColor="#B2EBF2" />
                      <stop offset="100%" stopColor="#81D4FA" />
                    </linearGradient>
                  </defs>
                  <polygon points="8,16 20,2 44,2 56,16 32,46" fill="url(#gradDiamondTreasure)" stroke="#4FC3F7" strokeWidth="2" />
                  <polyline points="20,2 32,16 44,2" fill="none" stroke="#4FC3F7" strokeWidth="2" />
                  <polyline points="8,16 32,16 56,16" fill="none" stroke="#4FC3F7" strokeWidth="2" />
                </svg>
                <div className="mt-2 text-sm font-semibold text-muted-foreground">Diamond</div>
                <div className="text-2xl font-extrabold text-sky-700">{counts.diamond}</div>
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
