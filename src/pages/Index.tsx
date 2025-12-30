import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile } from "@/services/profile";
import { getActiveTasks, type LiveTask, getStudentTaskStatuses, getTasksByIds, type StudentTaskStatus } from "@/services/tasks";
import { getUserBalances, getXpLeaderboard } from "@/services/rewards";
import { getRecentRunsForStudent, type TaskRunWithTask } from "@/services/taskRuns";
import { supabase } from "@/lib/supabase";
import { CompletedTodayModal } from "@/components/CompletedTodayModal";
import { ChaptersInProgressModal } from "@/components/ChaptersInProgressModal";
import { getLocalYMD } from "@/lib/date";
import { CalendarDays, BadgeCheck, ClipboardList, Hourglass, CheckCircle2, Gift, Trophy, Gamepad2, Eye } from "lucide-react";
import { AuthPanel } from "@/components/auth/AuthPanel";

type XpRow = Awaited<ReturnType<typeof getXpLeaderboard>>[number];

function useDisplayName(user: any) {
  const [fullName, setFullName] = useState<string>("");
  useEffect(() => {
    (async () => {
      try {
        const uid = user?.id || undefined;
        if (!uid) { setFullName(""); return; }
        const p = await getProfile(uid);
        if (p?.full_name) setFullName(p.full_name);
      } catch {}
    })();
  }, [user]);
  return useMemo(() => {
    const localName = localStorage.getItem("player:name") || "";
    return fullName || (user?.user_metadata as any)?.full_name || localName || "Player";
  }, [fullName, user]);
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(dateISO: string): string {
  const d = new Date(dateISO);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  const mins = Math.floor(diff / 60);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs>1?'s':''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days>1?'s':''} ago`;
}

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const displayName = useDisplayName(user);

  // If a teacher signs in, redirect them straight to the Teacher Panel
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      try {
        const p = await getProfile(user.id);
        if (!cancelled && p?.role === 'teacher') {
          navigate('/portal/teacher', { replace: true });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Top progress
  const [balances, setBalances] = useState<{ coins: number; gems: number; xp: number } | null>(null);
  useEffect(() => {
    (async () => {
      if (!user) { setBalances(null); return; }
      setBalances(await getUserBalances(user.id));
    })();
  }, [user]);
  const coursePct = useMemo(() => {
    const xp = balances?.xp ?? 0;
    const pct = ((xp % 1000) / 1000) * 100; // level-sized window
    return Math.max(0, Math.min(100, Math.round(pct)));
  }, [balances]);

  // Tasks and per-student statuses (fix counts)
  const [activeTasks, setActiveTasks] = useState<LiveTask[]>([]);
  const [statuses, setStatuses] = useState<StudentTaskStatus[]>([]);
  const [newTaskItems, setNewTaskItems] = useState<LiveTask[]>([]);
  const [progressTaskItems, setProgressTaskItems] = useState<LiveTask[]>([]);
  const [completedTaskItems, setCompletedTaskItems] = useState<LiveTask[]>([]);
  const [newCount, setNewCount] = useState<number>(0);
  const [progressCountCard, setProgressCountCard] = useState<number>(0);
  const [completedCountCard, setCompletedCountCard] = useState<number>(0);

  useEffect(() => {
    (async () => {
      if (!user) {
        setActiveTasks([]); setStatuses([]);
        setNewTaskItems([]); setProgressTaskItems([]); setCompletedTaskItems([]);
        setNewCount(0); setProgressCountCard(0); setCompletedCountCard(0);
        return;
      }
      const [tasks, st] = await Promise.all([
        getActiveTasks(),
        getStudentTaskStatuses(user.id),
      ]);
      setActiveTasks(tasks);
      // Restrict statuses to ACTIVE tasks only, to match Assignments page
      const activeIds = new Set(tasks.map(t => t.id));
      const stActive = st.filter(s => activeIds.has(s.task_id));
      setStatuses(stActive);
      // Map statuses to tasks
      const byId = (await getTasksByIds(stActive.map(s => s.task_id))).reduce((m, t) => { (m as any)[t.id] = t; return m; }, {} as Record<string, LiveTask>);
      const newStatuses = stActive.filter(s => s.status === 'not_started');
      const progStatuses = stActive.filter(s => s.status === 'in_progress');
      const doneStatuses = stActive.filter(s => s.status === 'completed');
      setNewCount(newStatuses.length);
      setProgressCountCard(progStatuses.length);
      setCompletedCountCard(doneStatuses.length);
      setNewTaskItems(newStatuses.map(s => byId[s.task_id]).filter(Boolean).slice(0,3));
      setProgressTaskItems(progStatuses.map(s => byId[s.task_id]).filter(Boolean).slice(0,3));
      setCompletedTaskItems(doneStatuses.map(s => byId[s.task_id]).filter(Boolean).slice(0,3));
    })();
  }, [user]);

  // Recent reward events (14 days)
  const [recentEvents, setRecentEvents] = useState<Array<{ date: string; created_at: string; source: string; meta: any }>>([]);
  useEffect(() => {
    (async () => {
      if (!user) { setRecentEvents([]); return; }
      const to = getLocalYMD();
      const d = new Date(); d.setDate(d.getDate() - 14);
      const from = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const { data } = await supabase
        .from('reward_events')
        .select('date, created_at, source, meta')
        .eq('user_id', user.id)
        .gte('date', from)
        .lte('date', to)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      setRecentEvents((data as any[]) || []);
    })();
  }, [user]);

  // Monthly XP leaderboard (top 5)
  const [leaders, setLeaders] = useState<XpRow[]>([]);
  useEffect(() => {
    (async () => {
      const now = new Date();
      const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      const to = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()).padStart(2,'0')}`;
      setLeaders(await getXpLeaderboard(from, to, 5));
    })();
  }, []);

  // AI battles lifetime count (for objective progress)
  const [aiCount, setAiCount] = useState<number>(0);
  useEffect(() => {
    (async () => {
      if (!user) { setAiCount(0); return; }
      const { count } = await supabase
        .from('reward_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .ilike('source', '%compete-ai%');
      setAiCount(count ?? 0);
    })();
  }, [user]);

  // Completed modal count stays based on reward events (lifetime); card counts use statuses
  const completedCount = recentEvents.filter(e => e.source.includes('practice') || e.source.includes('speed') || e.source.includes('compete')).length;
  const recentPlayed = useMemo(() => {
    return recentEvents
      .filter(e => e.source.includes('practice') || e.source.includes('speed') || e.source.includes('compete'))
      .slice(0, 3);
  }, [recentEvents]);

  // Last 3 completed runs for the student with titles
  const [recentRuns, setRecentRuns] = useState<TaskRunWithTask[]>([]);
  const [todayModalOpen, setTodayModalOpen] = useState(false);
  const [chaptersModalOpen, setChaptersModalOpen] = useState(false);
  useEffect(() => {
    (async () => {
      if (!user?.id) { setRecentRuns([]); return; }
      const runs = await getRecentRunsForStudent(user.id, 3);
      setRecentRuns(runs);
    })();
  }, [user?.id]);

  return (
    // Gate: if not authenticated, show sign-in screen first
    (!user) ? (
      <div className="min-h-[100svh] md:min-h-screen relative overflow-hidden bg-gradient-to-b from-[#21D4FD] via-[#00A6FF] to-[#005BFF]">
        {/* Soft background orbs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-1/3 left-1/3 w-64 h-64 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10 container mx-auto max-w-6xl px-4 py-16">
          <div className="mx-auto max-w-xl text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-black">Welcome</h1>
            <p className="text-sm text-gray-600 mt-2">Please sign in with the credentials provided by your school.</p>
          </div>
          <AuthPanel modeLocked="signin" showSignupToggle={false} hideGuest />
        </div>
      </div>
    ) : (
    <div className="min-h-[100svh] md:min-h-screen bg-white">
      <div className="container mx-auto max-w-6xl px-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 pt-14 sm:pt-16" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)" }}>
        {/* Main column */}
        <div>
          {/* Greeting & Course completion */}
          <h1 className="text-2xl sm:text-3xl font-black mb-4">{getGreeting()}, {displayName}!</h1>
          <Card className="mb-6 rounded-2xl border border-gray-100 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-gray-700">{coursePct}% Course Completion</div>
                <Button size="sm" className="rounded-full bg-[#E46DB6] hover:bg-[#D85FA9]">Level Up! Explorer Badge</Button>
              </div>
              <Progress className="h-2 bg-gray-200" value={coursePct} />
            </CardContent>
          </Card>

          {/* Completed Today Modal */}
          <CompletedTodayModal open={todayModalOpen} onOpenChange={setTodayModalOpen} userId={user?.id || null} isGuest={!user} />

          {/* Tasks header */}
          <div className="mb-3">
            <Button variant="outline" size="sm" className="rounded-full">Your Tasks</Button>
          </div>

          {/* Task cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="rounded-2xl border border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-indigo-600"/> New tasks</span>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold">{newCount}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-2">
                {newTaskItems.length === 0 ? <div>No new tasks</div> : newTaskItems.map((t) => (
                  <div key={t.id} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2"/>
                    <span className="truncate">{t.title}</span>
                  </div>
                ))}
                <Button variant="ghost" className="px-0 text-indigo-600 hover:text-indigo-700" onClick={() => navigate('/tasks')}>View tasks</Button>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2"><Hourglass className="w-5 h-5 text-violet-600"/> Tasks in progress</span>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-sm font-bold">{progressCountCard}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-2">
                {progressTaskItems.length === 0 ? (
                  <div>Nothing in progress</div>
                ) : progressTaskItems.map((t) => (
                  <div key={t.id} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2"/>
                    <span className="truncate">{t.title}</span>
                  </div>
                ))}
                <Button variant="ghost" className="px-0 text-violet-600 hover:text-violet-700" onClick={() => setChaptersModalOpen(true)}>Continue</Button>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-indigo-600"/> Completed tasks</span>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold">{completedCountCard}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-2">
                {(recentRuns.length > 0 ? recentRuns : recentPlayed).length === 0 ? (
                  <div>No completed tasks yet</div>
                ) : (
                  (recentRuns.length > 0 ? recentRuns : recentPlayed).map((item: any, idx: number) => {
                    if ('mode' in item) {
                      // TaskRunWithTask item
                      const r = item as TaskRunWithTask;
                      const title = r.live_tasks?.title || (r.mode === 'practice' ? 'Practice Session' : r.mode === 'speed' ? 'Speed Run' : r.mode === 'battle-ai' ? 'AI Battle' : 'Friends Battle');
                      const diff = r.difficulty || (r as any).difficulty || '—';
                      return (
                        <div key={r.id} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2"/>
                          <span className="truncate">{title} • {r.mode} • {diff}</span>
                        </div>
                      );
                    } else {
                      // Reward event fallback
                      const e = item as { source: string; meta: any };
                      const mode = e.source.includes('practice') ? 'practice' : e.source.includes('speed') ? 'speed' : e.source.includes('compete-ai') ? 'battle-ai' : e.source.includes('compete-friends') ? 'battle-friends' : 'activity';
                      const title = mode === 'practice' ? 'Practice Session' : mode === 'speed' ? 'Speed Run' : mode === 'battle-ai' ? 'AI Battle' : mode === 'battle-friends' ? 'Friends Battle' : 'Activity';
                      const diff = e.meta?.difficulty || e.meta?.type || '—';
                      return (
                        <div key={`evt-${idx}`} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2"/>
                          <span className="truncate">{title} • {mode} • {diff}</span>
                        </div>
                      );
                    }
                  })
                )}
                <button
                  onClick={() => setTodayModalOpen(true)}
                  className="mt-2 w-full flex items-center justify-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-indigo-100 transition"
                >
                  <Eye className="w-4 h-4 text-indigo-600"/>
                  <span>View Completed Tasks</span>
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Treasure Board */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-4">
            <Card className="rounded-2xl border border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2"><Gift className="w-5 h-5 text-indigo-600"/> Treasure Board</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-[80px_1fr] gap-4 items-center">
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center text-3xl">🎁</div>
                  <div>
                    <div className="text-gray-800 font-bold">Next Reward: AI Challenger</div>
                    <Button className="mt-3 rounded-full bg-[#6C5CE7] hover:bg-[#5A4FE0]" onClick={() => navigate('/treasure')}>View All Rewards</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">Objective:</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-700 mb-2">Complete 10 AI battles</div>
                <div className="mb-1 text-xs text-gray-500">Progress:</div>
                <Progress className="h-2 bg-gray-200" value={Math.min(100, (aiCount % 10) * 10)} />
                <div className="mt-2 text-xs text-gray-700 font-semibold">{aiCount % 10}/10 Completed</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="grid grid-rows-2 gap-4 lg:min-h-[700px]">
          <Card className="h-full rounded-2xl border border-gray-100 shadow-[0_6px_24px_rgba(16,24,40,0.06)] bg-white/90 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2"><CalendarDays className="w-5 h-5 text-gray-600"/> Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(!user) && <div className="text-gray-500">Sign in to see your recent activity.</div>}
              {user && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-2">Recently Played</div>
                  {recentPlayed.length === 0 ? (
                    <div className="text-gray-500">No recent games</div>
                  ) : (
                    <div className="space-y-2">
                      {recentPlayed.map((e, idx) => (
                        <div key={`rp-${idx}`} className="flex items-start gap-3 p-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                          <div className="mt-0.5 rounded-md p-1.5 bg-indigo-50 text-indigo-600"><Gamepad2 className="w-4 h-4"/></div>
                          <div className="flex-1">
                            <div className="font-semibold capitalize">{e.source.replace('compete-','compete ')}</div>
                            <div className="text-xs text-gray-500">{e.meta?.difficulty || e.meta?.type || '—'}</div>
                          </div>
                          <div className="text-xs text-gray-500 whitespace-nowrap">{timeAgo(e.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {user && <div className="h-px bg-gray-100" />}
              {user && recentEvents.slice(0,6).map((e, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-gray-300" />
                  <div className="flex-1">
                    <div className="font-semibold capitalize">{e.source.replace('compete-','compete ')}</div>
                    {e.meta?.type && (
                      <div className="text-xs text-gray-500">{e.meta.type}{e.meta.difficulty ? ` • ${e.meta.difficulty}` : ''}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">{timeAgo(e.created_at)}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="h-full rounded-2xl border border-gray-100 shadow-[0_6px_24px_rgba(16,24,40,0.06)] bg-white/90 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-[#F4B400]"/> Leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {leaders.slice(0,4).map((r, i) => (
                <div key={r.user_id} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-700 text-xs font-bold">{i+1}</span>
                    <span className="font-semibold truncate max-w-[140px]">{r.display_name}</span>
                  </div>
                  <div className="text-amber-600 font-bold">{r.xp} XP</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Modals */}
      <ChaptersInProgressModal open={chaptersModalOpen} onOpenChange={setChaptersModalOpen} />
    </div>
  ));
};

export default Index;
