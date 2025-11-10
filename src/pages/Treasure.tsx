import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getUserBalances, getAnyStreak, getDailyStreakAward } from "@/services/rewards";
import { getSpeedDaily } from "@/services/speed";
import { getAllAchievements, getBadgeCounts, type Achievement } from "@/services/achievements";
import { getMilestoneCounts, type MilestoneCounts } from "@/services/stats";
import { getMyTokens, getSeasonalWinners, type SeasonalWinner } from "@/services/seasonal";
import { Zap, Trophy, Target, Calculator, Bot, Users, Sparkles, Gem, Star } from "lucide-react";
import { getLocalYMD } from "@/lib/date";

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

// Badge metadata (use images from public/assets)
function getBadgeInfo(key: string): { name: string; img: string; desc: string } {
  const badges: Record<string, { name: string; img: string; desc: string }> = {
    // Updated to snake_case filenames in public/assets
    focused_learner: { name: "Focused Learner", img: "/assets/focused_learner.png", desc: "3-day Practice streak" },
    math_explorer: { name: "Math Explorer", img: "/assets/math_explorer.png", desc: "5-day same-topic streak" },
    speed_master: { name: "Speed Master", img: "/assets/speed_master.png", desc: "3× Fast & Flawless" },
    ai_challenger: { name: "AI Challenger", img: "/assets/ai_challenger.png", desc: "10 AI battles" },
    social_legend: { name: "Social Legend", img: "/assets/social_legend.png", desc: "10 Friend battles" },
  };
  return badges[key] || { name: key, img: "/placeholder.svg", desc: "Special achievement" };
}

const Treasure = () => {
  const navigate = useNavigate();
  const { coins } = useSnapshot();
  const { user, guest } = useAuth();
  const [balances, setBalances] = useState<{ coins: number; gems: number; xp: number } | null>(null);
  const [speedDaily, setSpeedDaily] = useState<Array<{ date: string; run_count: number; m100_count: number }>>([]);
  const [badges, setBadges] = useState<Achievement[]>([]);
  const [boostTokens, setBoostTokens] = useState<{ available: number; used: number } | null>(null);
  const [seasonWinners, setSeasonWinners] = useState<SeasonalWinner[]>([]);
  const [counts, setCounts] = useState<MilestoneCounts>({ silver: 0, gold: 0, platinum: 0, diamond: 0 });
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const [anyStreak, setAnyStreak] = useState<number | null>(null);
  const [todayAward, setTodayAward] = useState<{ claimed_by: string; coins_awarded: number; badges_awarded: string[] } | null>(null);
  const [todayEvents, setTodayEvents] = useState<Array<{ source: string; coins_delta: number; gems_delta: number; badges_delta: number; meta: any }>>([]);

  const weekLabels = useMemo(() => ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], []);
  const [weekDays, setWeekDays] = useState<Array<{ label: string; date: string; done: boolean }>>([]);

  // Build current week (Mon-Sun) dates using LOCAL dates (not UTC) to match daily_progress.date
  useEffect(() => {
    const today = new Date();
    const jsDay = today.getDay(); // 0..6, Sun=0
    const diffToMonday = jsDay === 0 ? -6 : (1 - jsDay);
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday);
    const arr: Array<{ label: string; date: string; done: boolean }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const ymd = getLocalYMD(d); // ensure local YYYY-MM-DD, consistent with saved daily_progress.date
      arr.push({ label: weekLabels[i], date: ymd, done: false });
    }
    setWeekDays(arr);
  }, [weekLabels.join('|')]);

  // Fetch completions for current week from daily_streak_awards (claimed streak days only)
  const fetchWeekProgress = useCallback(async () => {
    if (!user || guest || weekDays.length === 0) return;
    const start = weekDays[0].date;
    const end = weekDays[6].date;
    const { data, error } = await supabase
      .from('daily_streak_awards')
      .select('date')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end);
    if (error || !data) return;
    const setDates = new Set((data as Array<{ date: string }>).map(r => r.date));
    setWeekDays(prev => prev.map(w => ({ ...w, done: setDates.has(w.date) })));
  }, [user?.id, guest, weekDays]);

  useEffect(() => {
    fetchWeekProgress();
  }, [fetchWeekProgress, user?.id, guest, weekDays[0]?.date, weekDays[6]?.date]);

  // Also refetch when the tab gains focus or visibility returns (handles race after finishing a game)
  useEffect(() => {
    const onFocus = () => fetchWeekProgress();
    const onVis = () => { if (document.visibilityState === 'visible') fetchWeekProgress(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [fetchWeekProgress]);

  // Realtime subscription to daily_streak_awards for current week (claimed streak days)
  useEffect(() => {
    if (!user || guest || weekDays.length === 0) return;
    const start = weekDays[0].date;
    const end = weekDays[6].date;
    const channel = supabase
      .channel('daily_streak_awards_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_streak_awards',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Refetch week progress when any daily_progress row changes for this user
          const date = (payload.new as any)?.date || (payload.old as any)?.date;
          if (date && date >= start && date <= end) {
            fetchWeekProgress();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, guest, weekDays, fetchWeekProgress]);

  // Load legacy milestone counts (Silver/Gold/Platinum/Diamond) for Lifetime Achievements section
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setCounts({ silver: 0, gold: 0, platinum: 0, diamond: 0 }); return; }
      const c = await getMilestoneCounts(user.id);
      if (!cancelled) setCounts(c);
    })();
    return () => { cancelled = true; };
  }, [user, guest]);

  // Load today's reward events (dynamic breakdown)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setTodayEvents([]); return; }
      const today = getLocalYMD();
      const { data } = await supabase
        .from('reward_events')
        .select('source, coins_delta, gems_delta, badges_delta, meta')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('id', { ascending: true });
      if (!cancelled) setTodayEvents((data as any[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [user, guest]);

  // Realtime subscription for today's reward_events
  useEffect(() => {
    if (!user || guest) return;
    const today = getLocalYMD();
    const channel = supabase
      .channel('reward_events_today')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reward_events',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const date = (payload.new as any)?.date || (payload.old as any)?.date;
          if (date === today) {
            // Re-fetch today's breakdown
            (async () => {
              const { data } = await supabase
                .from('reward_events')
                .select('source, coins_delta, gems_delta, badges_delta, meta')
                .eq('user_id', user.id)
                .eq('date', today)
                .order('id', { ascending: true });
              setTodayEvents((data as any[]) ?? []);
            })();
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, guest]);

  // Load current streak and today's daily streak award (who claimed base coins)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setAnyStreak(null); setTodayAward(null); return; }
      const s = await getAnyStreak(user.id);
      if (!cancelled) setAnyStreak(s?.any_streak ?? 0);
      const today = getLocalYMD();
      const a = await getDailyStreakAward(user.id, today);
      if (!cancelled) setTodayAward(a ?? null);
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

  // Load badge counts across all modes (Focused Learner, Math Explorer, Speed Master, AI Challenger, Social Legend)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setBadgeCounts({}); return; }
      const c = await getBadgeCounts(user.id);
      if (!cancelled) setBadgeCounts(c);
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
            <img src={todayAward ? "/treasure_open.png" : "/treasure_close.png"} className="w-8 h-8"/> My Treasure
          </h1>
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>

        {/* Streak Hero */}
        {!guest && user && (
          <div className="mb-6">
            <Card className="overflow-hidden border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100">
              <CardContent className="flex items-center gap-4 py-4">
                <img src={todayAward ? "/treasure_open.png" : "/treasure_close.png"} className="w-16 h-16 flex-shrink-0"/>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-muted-foreground truncate">
                    {todayAward
                      ? <>Daily streak coins for today were claimed by <span className="font-semibold">{todayAward.claimed_by}</span>.</>
                      : <>No daily streak reward claimed yet today. Complete any mode to claim it.</>}
                  </div>
                  <div className="text-xs text-amber-800 mt-1">
                    Current streak: <span className="font-bold">{anyStreak ?? 0}</span> day(s)
                    {todayAward && <> • Coins: <span className="font-bold">+{todayAward.coins_awarded}</span></>}
                    {todayAward && todayAward.badges_awarded?.length > 0 && <> • Badges: {todayAward.badges_awarded.join(', ')}</>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Today Reward Breakdown */}
        {!guest && user && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Today Reward Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {todayEvents.length === 0 ? (
                <div className="text-sm text-muted-foreground">No rewards logged today yet.</div>
              ) : (
                <div className="space-y-2">
                  {todayEvents.map((e, idx) => (
                    <div key={idx} className="flex items-start justify-between p-3 rounded-lg border bg-white/70">
                      <div className="text-sm">
                        <div className="font-semibold capitalize">{e.source.replace('compete-','compete ')}</div>
                        {e.meta?.streak && (
                          <div className="text-xs text-muted-foreground">streak: {e.meta.streak}</div>
                        )}
                        {e.meta?.difficulty && (
                          <div className="text-xs text-muted-foreground">difficulty: {e.meta.difficulty}</div>
                        )}
                        {typeof e.meta?.acc === 'number' && (
                          <div className="text-xs text-muted-foreground">accuracy: {(e.meta.acc*100).toFixed(0)}%</div>
                        )}
                        {e.meta?.type && e.meta?.result && (
                          <div className="text-xs text-muted-foreground">{e.meta.type} • {e.meta.result}</div>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-bold text-amber-700">+{e.coins_delta} coins</div>
                        {e.gems_delta > 0 && <div className="font-bold text-fuchsia-700">+{e.gems_delta} gems</div>}
                        {e.badges_delta > 0 && <div className="font-bold text-purple-700">+{e.badges_delta} badge(s)</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
                    <Gem className="w-6 h-6 text-fuchsia-600" />
                    <div>
                      <div className="text-xl font-black text-fuchsia-700">{balances?.gems ?? 0}</div>
                      <div className="text-xs text-muted-foreground">Gems</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-6 h-6 text-indigo-600" />
                    <div>
                      <div className="text-xl font-black text-indigo-700">{balances?.xp ?? 0}</div>
                      <div className="text-xs text-muted-foreground">XP</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>/

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

        {/* HR Badges with counts (uses images) */}
        {!guest && user && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Badges Earned (All Modes)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {["focused_learner","math_explorer","speed_master","ai_challenger","social_legend"].map((key) => {
                  const info = getBadgeInfo(key);
                  const count = badgeCounts[key] ?? 0;
                  const unlocked = count > 0 || badges.some(b => b.key === key);
                  return (
                    <div
                      key={key}
                      className={`flex flex-col items-center p-3 rounded-lg border bg-gradient-to-br from-white to-gray-50 hover:shadow-md transition-shadow ${unlocked ? '' : 'opacity-60'}`}
                    >
                      <div className="relative mb-1">
                        <img src={info.img} alt={info.name} className="w-12 h-12 object-contain" />
                        {count > 1 && (
                          <div className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 shadow">
                            ×{count}
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-bold text-center text-gray-800">{info.name}{count === 1 ? '' : ''}</div>
                      <div className="text-[10px] text-muted-foreground text-center mt-1">{info.desc}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lifetime Achievement Counts (Silver/Gold/Platinum/Diamond) */}
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
