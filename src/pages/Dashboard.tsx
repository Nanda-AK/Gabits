import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getLocalYMD } from "@/lib/date";
import { getUserBalances, getAnyStreak } from "@/services/rewards";
import { getBadgeCounts, getAllAchievements } from "@/services/achievements";
import { getActiveTasks, subscribeActiveTasks, type LiveTask } from "@/services/tasks";
import { getSpeedDaily } from "@/services/speed";
import { getProfile } from "@/services/profile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Bot, Calculator, Gem, Medal, Sparkles, Timer, Trophy, Users, Coins } from "lucide-react";

// Mode keys we support for per-mode streaks
type ModeKey = 'practice' | 'speed' | 'compete-ai' | 'compete-friends';

function ymdDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getLocalYMD(d);
}

function computeStreakForMode(modeDates: Set<string>): number {
  // Count consecutive days backwards starting today while the day exists in the set
  let streak = 0;
  while (true) {
    const ymd = ymdDaysAgo(streak);
    if (modeDates.has(ymd)) streak++;
    else break;
  }
  return streak;
}

const Dashboard = () => {
  const { user, guest } = useAuth();
  const navigate = useNavigate();

  // Profile display name (never show email)
  const [fullName, setFullName] = useState<string>("");
  useEffect(() => {
    (async () => {
      try {
        const uid = user?.id || (guest ? localStorage.getItem("guestId") || undefined : undefined);
        if (!uid) { setFullName(""); return; }
        const p = await getProfile(uid);
        if (p?.full_name) setFullName(p.full_name);
      } catch {}
    })();
  }, [user, guest]);

  // Live class tasks (teacher started) visible to all authenticated users
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setLiveTasks([]); return; }
      const items = await getActiveTasks();
      if (!cancelled) setLiveTasks(items);
    })();
    const unsub = subscribeActiveTasks((items) => { if (!cancelled) setLiveTasks(items); });
    return () => { cancelled = true; unsub(); };
  }, [user?.id, guest]);

  const joinTask = (t: LiveTask) => {
    const qs = new URLSearchParams();
    qs.set('task', t.id);
    qs.set('mode', t.mode);
    if (t.difficulty) qs.set('difficulty', t.difficulty);
    if (t.topics_csv) qs.set('topics', t.topics_csv);
    navigate(`/play?${qs.toString()}`, { replace: false });
  };

  // Lifetime battle counts to show progress toward AI/Friends badges (10 battles)
  const [aiLifetime, setAiLifetime] = useState<number>(0);
  const [friendsLifetime, setFriendsLifetime] = useState<number>(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setAiLifetime(0); setFriendsLifetime(0); return; }
      const aiQ = supabase
        .from('reward_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .ilike('source', '%compete-ai%');
      const frQ = supabase
        .from('reward_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .ilike('source', '%compete-friends%');
      const [aiRes, frRes] = await Promise.all([aiQ, frQ]);
      if (!cancelled) {
        setAiLifetime(aiRes.count ?? 0);
        setFriendsLifetime(frRes.count ?? 0);
      }
    })();
    return () => { cancelled = true; };
  }, [user, guest]);
  const displayName = useMemo(() => {
    const localName = localStorage.getItem("player:name") || "";
    return fullName || (user?.user_metadata as any)?.full_name || localName || (guest ? "Guest" : "Player");
  }, [fullName, user, guest]);

  // Balances
  const [balances, setBalances] = useState<{ coins: number; gems: number; xp: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setBalances(null); return; }
      const b = await getUserBalances(user.id);
      if (!cancelled) setBalances(b ? { coins: b.coins, gems: b.gems, xp: b.xp } : { coins: 0, gems: 0, xp: 0 });
    })();
    return () => { cancelled = true; };
  }, [user, guest]);

  // Any-mode streak
  const [anyStreak, setAnyStreak] = useState<number>(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setAnyStreak(0); return; }
      const s = await getAnyStreak(user.id);
      if (!cancelled) setAnyStreak(s?.any_streak ?? 0);
    })();
    return () => { cancelled = true; };
  }, [user, guest]);

  // Reward events (last 30 days) for per-mode streaks + (last 14 days) for recent feed
  const [modeDateSets, setModeDateSets] = useState<Record<ModeKey, Set<string>>>({
    'practice': new Set(),
    'speed': new Set(),
    'compete-ai': new Set(),
    'compete-friends': new Set(),
  });
  const [recentEvents, setRecentEvents] = useState<Array<{ date: string; source: string; coins_delta: number; gems_delta: number; badges_delta: number; meta: any }>>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setModeDateSets({ 'practice': new Set(), 'speed': new Set(), 'compete-ai': new Set(), 'compete-friends': new Set() }); setRecentEvents([]); return; }
      const to = getLocalYMD();
      const from30 = ymdDaysAgo(30);
      const { data: data30 } = await supabase
        .from('reward_events')
        .select('date, source')
        .eq('user_id', user.id)
        .gte('date', from30)
        .lte('date', to);
      const sets: Record<ModeKey, Set<string>> = { 'practice': new Set(), 'speed': new Set(), 'compete-ai': new Set(), 'compete-friends': new Set() };
      for (const r of (data30 as any[]) || []) {
        const src = String(r.source || '');
        const d = String(r.date || '');
        if (!d) continue;
        if (src.includes('compete-ai')) sets['compete-ai'].add(d);
        else if (src.includes('compete-friends')) sets['compete-friends'].add(d);
        else if (src.includes('speed')) sets['speed'].add(d);
        else if (src.includes('practice')) sets['practice'].add(d);
      }
      if (!cancelled) setModeDateSets(sets);

      const from14 = ymdDaysAgo(14);
      const { data: data14 } = await supabase
        .from('reward_events')
        .select('date, source, coins_delta, gems_delta, badges_delta, meta')
        .eq('user_id', user.id)
        .gte('date', from14)
        .lte('date', to)
        .order('date', { ascending: false })
        .order('id', { ascending: false });
      if (!cancelled) setRecentEvents((data14 as any[]) || []);
    })();
    return () => { cancelled = true; };
  }, [user, guest]);

  // Per-mode streaks
  const practiceStreak = useMemo(() => computeStreakForMode(modeDateSets['practice']), [modeDateSets]);
  const speedStreak = useMemo(() => computeStreakForMode(modeDateSets['speed']), [modeDateSets]);
  const aiStreak = useMemo(() => computeStreakForMode(modeDateSets['compete-ai']), [modeDateSets]);
  const friendsStreak = useMemo(() => computeStreakForMode(modeDateSets['compete-friends']), [modeDateSets]);

  // Speed monthly stats (for flawless progress hint)
  const [speedMonthM100, setSpeedMonthM100] = useState<number>(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setSpeedMonthM100(0); return; }
      const now = new Date();
      const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      const to = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()).padStart(2,'0')}`;
      const rows = await getSpeedDaily(user.id, from, to);
      const sum = rows.reduce((acc, r) => acc + (r.m100_count || 0), 0);
      if (!cancelled) setSpeedMonthM100(sum);
    })();
    return () => { cancelled = true; };
  }, [user, guest]);

  // Badges
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const [achievements, setAchievements] = useState<Array<{ key: string; unlocked_at: string }>>([]);
  const [liveTasks, setLiveTasks] = useState<LiveTask[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setBadgeCounts({}); setAchievements([]); return; }
      const c = await getBadgeCounts(user.id);
      const a = await getAllAchievements(user.id);
      if (!cancelled) {
        setBadgeCounts(c);
        setAchievements(a.map(x => ({ key: x.key, unlocked_at: x.unlocked_at })));
      }
    })();
    return () => { cancelled = true; };
  }, [user, guest]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-emerald-50">
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-indigo-700 to-emerald-700 bg-clip-text text-transparent flex items-center gap-3">
            <BarChart3 className="w-7 h-7" /> Dashboard
          </h1>
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>

        {/* Live class tasks (if any) */}
        {!guest && user && liveTasks.length > 0 && (
          <Card className="mb-6 border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardHeader>
              <CardTitle className="text-lg">Live Class Task</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {liveTasks.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border bg-white/70">
                    <div>
                      <div className="text-sm font-bold">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{t.mode} • {t.difficulty || 'moderate'} • {t.topics_csv || 'mixed'}</div>
                    </div>
                    <Button className="rounded-full" onClick={() => joinTask(t)}>Join Now</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile summary */}
        <Card className="mb-6">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Welcome</div>
              <div className="text-xl font-extrabold text-gray-800">{displayName}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Any Streak</div>
                <div className="text-2xl font-black text-indigo-700">{anyStreak}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Gems</div>
                <div className="text-2xl font-black text-fuchsia-700">{balances?.gems ?? 0}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">XP</div>
                <div className="text-2xl font-black text-sky-700">{balances?.xp ?? 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Per-mode streaks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calculator className="w-5 h-5"/> Practice Streak</CardTitle></CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-emerald-700">{practiceStreak}</div>
              <div className="text-xs text-muted-foreground">Consecutive days with Practice rewards</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Timer className="w-5 h-5"/> Speed Streak</CardTitle></CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-amber-700">{speedStreak}</div>
              <div className="text-xs text-muted-foreground">Consecutive days with Speed rewards</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Bot className="w-5 h-5"/> Battle AI Streak</CardTitle></CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-indigo-700">{aiStreak}</div>
              <div className="text-xs text-muted-foreground">Consecutive days with AI battle rewards</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5"/> Battle Friends Streak</CardTitle></CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-purple-700">{friendsStreak}</div>
              <div className="text-xs text-muted-foreground">Consecutive days with Friends battle rewards</div>
            </CardContent>
          </Card>
        </div>

        {/* Badges & Progress */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Medal className="w-5 h-5 text-amber-600"/> Badges & Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border bg-white/70">
                <div className="text-sm font-bold">Focused Learner</div>
                <div className="text-xs text-muted-foreground">3-day Practice streak</div>
                <div className="mt-1 text-[13px]">Progress: {Math.min(3, practiceStreak)}/3</div>
                {badgeCounts['focused_learner'] ? (
                  <div className="text-xs text-green-700 font-semibold">Unlocked ×{badgeCounts['focused_learner']}</div>
                ) : null}
              </div>
              <div className="p-3 rounded-lg border bg-white/70">
                <div className="text-sm font-bold">Speed Master</div>
                <div className="text-xs text-muted-foreground">3× Fast & Flawless</div>
                <div className="mt-1 text-[13px]">This month flawless: {speedMonthM100}/3</div>
                {badgeCounts['speed_master'] ? (
                  <div className="text-xs text-green-700 font-semibold">Unlocked ×{badgeCounts['speed_master']}</div>
                ) : null}
              </div>
              <div className="p-3 rounded-lg border bg-white/70">
                <div className="text-sm font-bold">AI Challenger</div>
                <div className="text-xs text-muted-foreground">10 AI battles</div>
                {badgeCounts['ai_challenger'] && badgeCounts['ai_challenger'] > 0 ? (
                  <div className="mt-1 text-xs text-green-700 font-semibold">Unlocked ×{badgeCounts['ai_challenger']}</div>
                ) : (
                  <div className="mt-1 text-[12px]">Progress: {Math.min(aiLifetime, 10)}/10</div>
                )}
              </div>
              <div className="p-3 rounded-lg border bg-white/70">
                <div className="text-sm font-bold">Social Legend</div>
                <div className="text-xs text-muted-foreground">10 Friend battles</div>
                {badgeCounts['social_legend'] && badgeCounts['social_legend'] > 0 ? (
                  <div className="mt-1 text-xs text-green-700 font-semibold">Unlocked ×{badgeCounts['social_legend']}</div>
                ) : (
                  <div className="mt-1 text-[12px]">Progress: {Math.min(friendsLifetime, 10)}/10</div>
                )}
              </div>
              <div className="p-3 rounded-lg border bg-white/70 sm:col-span-2">
                <div className="text-sm font-bold">Math Explorer</div>
                <div className="text-xs text-muted-foreground">5-day same-topic streak</div>
                {badgeCounts['math_explorer'] ? (
                  <div className="mt-1 text-xs text-green-700 font-semibold">Unlocked ×{badgeCounts['math_explorer']}</div>
                ) : (
                  <div className="mt-1 text-[12px] text-gray-600">Tip: pick one topic and practice for 5 days</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent rewards (last 14 days) */}
        {!guest && user && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-fuchsia-600"/> Recent Rewards (14 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {recentEvents.length === 0 ? (
                <div className="text-sm text-muted-foreground">No rewards in the last 14 days.</div>
              ) : (
                <div className="space-y-2">
                  {recentEvents.map((e, idx) => (
                    <div key={idx} className="flex items-start justify-between p-3 rounded-lg border bg-white/70">
                      <div className="text-sm">
                        <div className="font-semibold capitalize">{e.date} • {e.source.replace('compete-','compete ')}</div>
                        {e.meta?.type && e.meta?.result && (
                          <div className="text-xs text-muted-foreground">{e.meta.type} • {e.meta.result}</div>
                        )}
                        {e.meta?.difficulty && (
                          <div className="text-xs text-muted-foreground">difficulty: {e.meta.difficulty}</div>
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
              <div className="mt-3">
                <Button variant="secondary" onClick={() => navigate('/treasure')}>View All Rewards</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wallet quick */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-600"/> Wallet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                <div>
                  <div className="text-xl font-black text-amber-900">{balances?.coins ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Coins</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Gem className="w-5 h-5 text-fuchsia-600" />
                <div>
                  <div className="text-xl font-black text-fuchsia-700">{balances?.gems ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Gems</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <div>
                  <div className="text-xl font-black text-indigo-700">{balances?.xp ?? 0}</div>
                  <div className="text-xs text-muted-foreground">XP</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
