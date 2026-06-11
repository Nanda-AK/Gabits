import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getUserBalances, getAnyStreak, getDailyStreakAward } from "@/services/rewards";
import { getSpeedDaily } from "@/services/speed";
import { getAllAchievements, getBadgeCounts, type Achievement } from "@/services/achievements";
// Removed unused seasonal imports (getMyTokens, getSeasonalWinners)
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
  const { user } = useAuth();
  const [balances, setBalances] = useState<{ coins: number; gems: number; xp: number } | null>(null);
  const [speedDaily, setSpeedDaily] = useState<Array<{ date: string; run_count: number; m100_count: number }>>([]);
  const [badges, setBadges] = useState<Achievement[]>([]);
  // Removed: boostTokens and seasonWinners (unused seasonal features)
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const [anyStreak, setAnyStreak] = useState<number | null>(null);
  const [streakLastDate, setStreakLastDate] = useState<string | null>(null);
  const [todayAward, setTodayAward] = useState<{ claimed_by: string; coins_awarded: number; badges_awarded: string[] } | null>(null);
  const [todayEvents, setTodayEvents] = useState<Array<{ created_at: string; source: string; coins_delta: number; gems_delta: number; badges_delta: number; meta: any }>>([]);

  const weekLabels = useMemo(() => ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], []);
  const [weekDays, setWeekDays] = useState<Array<{ label: string; date: string; done: boolean }>>([]);
  const weekProgressLoadingRef = useRef(false);

  // Only treat the streak as "active" if the last streak day was today or yesterday.
  const activeStreak = useMemo(() => {
    if (!anyStreak || !streakLastDate) return null;
    try {
      const today = getLocalYMD();
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = getLocalYMD(yesterdayDate);
      if (streakLastDate === today || streakLastDate === yesterday) {
        return anyStreak;
      }
      return null;
    } catch {
      // In case of any parsing issues, fall back to showing the raw streak
      return anyStreak;
    }
  }, [anyStreak, streakLastDate]);

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
  // Store week boundaries in refs to avoid dependency loops
  const weekStartRef = useRef<string>('');
  const weekEndRef = useRef<string>('');
  
  // Update refs when weekDays changes
  useEffect(() => {
    if (weekDays.length === 7) {
      weekStartRef.current = weekDays[0].date;
      weekEndRef.current = weekDays[6].date;
    }
  }, [weekDays]);

  const fetchWeekProgress = useCallback(async () => {
    if (!user) return;
    const start = weekStartRef.current;
    const end = weekEndRef.current;
    if (!start || !end) return;
    if (weekProgressLoadingRef.current) return;
    weekProgressLoadingRef.current = true;
    
    const { data, error } = await supabase
      .from('daily_streak_awards')
      .select('date')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end);
    
    weekProgressLoadingRef.current = false;
    if (error || !data) return;
    
    const doneDates = new Set((data as Array<{ date: string }>).map(r => r.date));
    setWeekDays(prev => {
      // Only update if there's an actual change to prevent re-renders
      const needsUpdate = prev.some(w => w.done !== doneDates.has(w.date));
      if (!needsUpdate) return prev;
      return prev.map(w => ({ ...w, done: doneDates.has(w.date) }));
    });
  }, [user?.id]);

  // Fetch week progress once when user/week changes (not on every render)
  const lastFetchKey = useRef<string>('');
  useEffect(() => {
    const key = `${user?.id}-${weekStartRef.current}`;
    if (key === lastFetchKey.current) return;
    lastFetchKey.current = key;
    fetchWeekProgress();
  }, [fetchWeekProgress, user?.id, weekDays[0]?.date]);

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
  // Use refs to avoid re-subscribing on every render
  useEffect(() => {
    if (!user) return;
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
          const start = weekStartRef.current;
          const end = weekEndRef.current;
          if (date && start && end && date >= start && date <= end) {
            fetchWeekProgress();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchWeekProgress]);

  // Removed: Today's Completed Task is now shown via dashboard modal

  // Removed realtime: no Today breakdown in Treasure page anymore

  // Load today's reward events (for the Today Reward Breakdown section)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setTodayEvents([]); return; }
      const today = getLocalYMD();
      const { data } = await supabase
        .from('reward_events')
        .select('created_at, source, coins_delta, gems_delta, badges_delta, meta')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });
      if (!cancelled) setTodayEvents((data as any[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Load current streak and today's daily streak award (who claimed base coins)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setAnyStreak(null); setStreakLastDate(null); setTodayAward(null); return; }
      const s = await getAnyStreak(user.id);
      if (!cancelled) {
        setAnyStreak(s?.any_streak ?? null);
        setStreakLastDate(s?.last_date ?? null);
      }
      const today = getLocalYMD();
      const a = await getDailyStreakAward(user.id, today);
      if (!cancelled) setTodayAward(a ?? null);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Load server wallet balances (coins, gems, XP). 
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setBalances(null); return; }
      const b = await getUserBalances(user.id);
      if (!cancelled) setBalances(b ? { coins: b.coins, gems: b.gems, xp: b.xp } : { coins: 0, gems: 0, xp: 0 });
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Load Speed daily stats for current month
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setSpeedDaily([]); return; }
      const now = new Date();
      const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      const to = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()).padStart(2,'0')}`;
      const data = await getSpeedDaily(user.id, from, to);
      if (!cancelled) setSpeedDaily(data);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Load all earned badges
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setBadges([]); return; }
      const data = await getAllAchievements(user.id);
      if (!cancelled) setBadges(data);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Load badge counts across all modes (Focused Learner, Math Explorer, Speed Master, AI Challenger, Social Legend)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setBadgeCounts({}); return; }
      const c = await getBadgeCounts(user.id);
      if (!cancelled) setBadgeCounts(c);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Removed: Load boost tokens (unused seasonal feature)
  // Removed: Load seasonal winners (unused seasonal feature)

  // Note: Weekly progress data not yet tracked server-side; showing required UI only

  return (
    <div className="min-h-[100svh] md:min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-white">
      <div className="container mx-auto px-4 pt-16 sm:pt-10 pb-10 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent flex items-center gap-2">
            <img src={todayAward ? "/treasure_open.png" : "/treasure_close.png"} className="w-8 h-8"/> My Treasure
          </h1>
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>

        {/* Streak Hero */}
        {user && (
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
                  {activeStreak !== null && (
                    <div className="text-xs text-amber-800 mt-1">
                      Current streak: <span className="font-bold">{activeStreak}</span> day(s)
                      {todayAward && <> • Coins: <span className="font-bold">+{todayAward.coins_awarded}</span></>}
                      {todayAward && todayAward.badges_awarded?.length > 0 && <> • Badges: {todayAward.badges_awarded.join(', ')}</>}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Today Reward Breakdown */}
        {user && (
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
              {!user ? (
                <div className="flex items-center gap-3">
                  <Coins className="w-8 h-8 text-amber-600" />
                  <div>
                    <div className="text-2xl font-black text-amber-900">{coins}</div>
                    <div className="text-xs text-muted-foreground">Local wallet (offline only)</div>
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
          </Card>

          {/* Removed: Stage Boost Tokens (unused seasonal feature) */}
        </div>

        {/* Removed: Today's Completed Task card (handled by Dashboard modal) */}

        {/* Removed: Seasonal Winners (unused seasonal feature) */}

        {/* Speed Daily Activity (current month) */}
        {user && speedDaily.length > 0 && (
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

        
        {user && (
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

      </div>
    </div>
  );
};

export default Treasure;
