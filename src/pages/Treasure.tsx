import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getMilestoneCounts, type MilestoneCounts } from "@/services/stats";
import { supabase } from "@/lib/supabase";
import { getUserBalances } from "@/services/rewards";
import { getSpeedDaily } from "@/services/speed";
import { getAllAchievements, type Achievement } from "@/services/achievements";
import { getMyTokens, getSeasonalWinners, type SeasonalWinner } from "@/services/seasonal";
import { Zap, Trophy, Target, Calculator, Bot, Users, Sparkles } from "lucide-react";

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

// Badge metadata
function getBadgeInfo(key: string): { name: string; icon: string; desc: string } {
  const badges: Record<string, { name: string; icon: string; desc: string }> = {
    m10: { name: "Bronze Start", icon: "🥉", desc: "10% milestone" },
    m25: { name: "Silver", icon: "🥈", desc: "25% milestone" },
    m50: { name: "Gold", icon: "🥇", desc: "50% milestone" },
    m75: { name: "Platinum", icon: "💎", desc: "75% milestone" },
    m100: { name: "Diamond", icon: "💍", desc: "Perfect 100%" },
    focused_learner: { name: "Focused Learner", icon: "🎯", desc: "3-day Practice streak" },
    math_explorer: { name: "Math Explorer", icon: "🧮", desc: "5-day same-topic streak" },
    speed_master: { name: "Speed Master", icon: "⚡", desc: "3× Fast & Flawless" },
    ai_challenger: { name: "AI Challenger", icon: "🤖", desc: "10 AI battles" },
    social_legend: { name: "Social Legend", icon: "👥", desc: "10 Friend battles" },
  };
  return badges[key] || { name: key, icon: "🏆", desc: "Special achievement" };
}

const Treasure = () => {
  const navigate = useNavigate();
  const { coins } = useSnapshot();
  const { user, guest } = useAuth();
  const [counts, setCounts] = useState<MilestoneCounts>({ silver: 0, gold: 0, platinum: 0, diamond: 0 });
  const [balances, setBalances] = useState<{ coins: number; gems: number; xp: number } | null>(null);
  const [speedDaily, setSpeedDaily] = useState<Array<{ date: string; run_count: number; m100_count: number }>>([]);
  const [badges, setBadges] = useState<Achievement[]>([]);
  const [boostTokens, setBoostTokens] = useState<{ available: number; used: number } | null>(null);
  const [seasonWinners, setSeasonWinners] = useState<SeasonalWinner[]>([]);

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

  // Load server wallet balances (coins, gems, XP). Guest falls back to local snapshot for coins only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setBalances(null); return; }
      const b = await getUserBalances(user.id);
      if (!cancelled) setBalances(b ? { coins: b.coins, gems: b.gems, xp: b.xp } : { coins: 0, gems: 0, xp: 0 });
    })();
    return () => { cancelled = true; };
  }, [user, guest]);

  // Load Speed daily stats for current month
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setSpeedDaily([]); return; }
      const now = new Date();
      const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      const to = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()).padStart(2,'0')}`;
      const data = await getSpeedDaily(user.id, from, to);
      if (!cancelled) setSpeedDaily(data);
    })();
    return () => { cancelled = true; };
  }, [user, guest]);

  // Load all earned badges
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setBadges([]); return; }
      const data = await getAllAchievements(user.id);
      if (!cancelled) setBadges(data);
    })();
    return () => { cancelled = true; };
  }, [user, guest]);

  // Load boost tokens
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setBoostTokens(null); return; }
      const data = await getMyTokens(user.id);
      if (!cancelled) setBoostTokens(data ? { available: data.tokens_available, used: data.tokens_used } : { available: 0, used: 0 });
    })();
    return () => { cancelled = true; };
  }, [user, guest]);

  // Load seasonal winners for last month (if new month just started)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const season = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
      const data = await getSeasonalWinners(season);
      if (!cancelled) setSeasonWinners(data);
    })();
    return () => { cancelled = true; };
  }, []);

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
              <CardTitle className="text-lg">My Wallet</CardTitle>
            </CardHeader>
            <CardContent>
              {guest || !user ? (
                <div className="flex items-center gap-3">
                  <Coins className="w-8 h-8 text-amber-600" />
                  <div>
                    <div className="text-2xl font-black text-amber-900">{coins}</div>
                    <div className="text-xs text-muted-foreground">Guest wallet (local only)</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <Coins className="w-6 h-6 text-amber-600" />
                    <div>
                      <div className="text-xl font-black text-amber-900">{balances?.coins ?? 0}</div>
                      <div className="text-xs text-muted-foreground">Coins</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <img src="/assets/gem.png" alt="Gems" className="w-6 h-6" />
                    <div>
                      <div className="text-xl font-black text-fuchsia-700">{balances?.gems ?? 0}</div>
                      <div className="text-xs text-muted-foreground">Gems</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <img src="/assets/xp.png" alt="XP" className="w-6 h-6" />
                    <div>
                      <div className="text-xl font-black text-indigo-700">{balances?.xp ?? 0}</div>
                      <div className="text-xs text-muted-foreground">XP</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stage Boost Tokens */}
          {!guest && user && boostTokens && boostTokens.available > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  Stage Boost Tokens
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <div className="text-4xl">🎫</div>
                <div>
                  <div className="text-2xl font-black text-purple-700">{boostTokens.available}</div>
                  <div className="text-xs text-muted-foreground">Available to use</div>
                  <div className="text-[10px] text-gray-500 mt-1">Used: {boostTokens.used}</div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Seasonal Winners (Last Month) */}
        {seasonWinners.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Last Month's Top 3 Winners
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {seasonWinners.map((winner) => (
                  <div
                    key={winner.rank}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      winner.rank === 1
                        ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-amber-300'
                        : winner.rank === 2
                        ? 'bg-gradient-to-r from-gray-50 to-slate-100 border-gray-300'
                        : 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {winner.rank === 1 ? '🥇' : winner.rank === 2 ? '🥈' : '🥉'}
                      </div>
                      <div>
                        <div className="font-bold text-gray-800">{winner.display_name}</div>
                        <div className="text-xs text-muted-foreground">{winner.xp_earned} XP earned</div>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-amber-700">+{winner.reward_coins} coins</div>
                      <div className="font-semibold text-fuchsia-700">+{winner.reward_gems} gems</div>
                      <div className="font-semibold text-purple-700">+{winner.reward_boost_tokens} 🎫</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Speed Daily Activity (current month) */}
        {!guest && user && speedDaily.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Speed Mode Activity (This Month)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {speedDaily.slice(0, 28).map((day) => (
                  <div
                    key={day.date}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs ${
                      day.run_count > 0
                        ? 'bg-gradient-to-br from-green-50 to-emerald-100 border-green-300'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                    title={`${day.date}: ${day.run_count} run(s)`}
                  >
                    <div className="font-bold text-gray-700">{new Date(day.date).getDate()}</div>
                    {day.run_count > 0 && (
                      <div className="text-[10px] text-green-700 font-semibold">{day.run_count}</div>
                    )}
                    {day.m100_count > 0 && <div className="text-xs">💎</div>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Earned Badges */}
        {!guest && user && badges.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Badges Earned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {badges.map((badge) => {
                  const info = getBadgeInfo(badge.key);
                  return (
                    <div
                      key={badge.key}
                      className="flex flex-col items-center p-3 rounded-lg border bg-gradient-to-br from-white to-gray-50 hover:shadow-md transition-shadow"
                      title={`Unlocked: ${new Date(badge.unlocked_at).toLocaleDateString()}`}
                    >
                      <div className="text-3xl mb-1">{info.icon}</div>
                      <div className="text-xs font-bold text-center text-gray-800">{info.name}</div>
                      <div className="text-[10px] text-muted-foreground text-center mt-1">{info.desc}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

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
