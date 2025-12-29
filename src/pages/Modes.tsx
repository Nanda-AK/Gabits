import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Sparkles, BookOpen, Timer, Bot, Users, ChevronRight, BarChart3, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile } from "@/services/profile";
import { getChapterSpeedUnlock, getChapterModeUnlock } from "@/services/practice";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { getLocalYMD } from "@/lib/date";

const Pill: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <span className={`inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 ${className}`}>{children}</span>
);

const Modes = () => {
  const navigate = useNavigate();
  const { user, guest } = useAuth();
  const [role, setRole] = useState<string>("");
  const [progressCount, setProgressCount] = useState<number>(0);
  const progressGoal = 5;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { if (!cancelled) setRole('student'); return; }
      const p = await getProfile(user.id);
      if (!cancelled) setRole((p?.role as string) || 'student');
    })();
    return () => { cancelled = true; };
  }, [user?.id, guest]);

  const isTeacher = role === 'teacher';
  const [speedUnlocked, setSpeedUnlocked] = useState<boolean>(false);
  const [aiUnlocked, setAiUnlocked] = useState<boolean>(false);
  const [friendsUnlocked, setFriendsUnlocked] = useState<boolean>(false);
  const [unlockAvg, setUnlockAvg] = useState<number>(0);
  const [unlockCount, setUnlockCount] = useState<number>(0);
  const [unlockThreshold, setUnlockThreshold] = useState<number>(0.8);
  const [unlockProgress, setUnlockProgress] = useState<number>(0);
  // AI unlock progress
  const [aiUnlockAvg, setAiUnlockAvg] = useState<number>(0);
  const [aiUnlockCount, setAiUnlockCount] = useState<number>(0);
  const [aiUnlockProgress, setAiUnlockProgress] = useState<number>(0);
  // Friends unlock progress
  const [friendsUnlockAvg, setFriendsUnlockAvg] = useState<number>(0);
  const [friendsUnlockCount, setFriendsUnlockCount] = useState<number>(0);
  const [friendsUnlockProgress, setFriendsUnlockProgress] = useState<number>(0);
  // Mobile-only stepper: 0 => Practice/Speed, 1 => AI/Friends
  const [mobileStep, setMobileStep] = useState<number>(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!user || guest) { if (alive) { setSpeedUnlocked(false); setUnlockAvg(0); setUnlockCount(0); setUnlockProgress(0); } return; }
        // Chapter-aware: require a selected pending task with chapter
        try {
          const raw = localStorage.getItem('play:pending_task');
          const p = raw ? JSON.parse(raw) : null;
          const qs = new URLSearchParams(window.location.search);
          const chapter = (p?.chapter as string) ?? (qs.get('chapter') || null);
          if (!chapter) { if (alive) { setSpeedUnlocked(false); setAiUnlocked(false); setFriendsUnlocked(false); setUnlockAvg(0); setUnlockCount(0); setUnlockProgress(0); } return; }
          const s = await getChapterModeUnlock(user.id, chapter, 'speed', 0.8, 3);
          if (!alive) return;
          setSpeedUnlocked(!!s.unlocked);
          setUnlockAvg(s.avg);
          setUnlockCount(s.count);
          setUnlockThreshold(0.8);
          const sessionFactor = Math.min(1, (s.count || 0) / 3);
          const accuracyFactor = Math.min(1, (s.avg || 0) / 0.8);
          const composite = Math.max(0, Math.min(1, sessionFactor * accuracyFactor));
          setUnlockProgress(composite);
          // Also check AI/Friends gating for this chapter (lifetime)
          try {
            const ai = await getChapterModeUnlock(user.id, chapter, 'battle-ai', 0.8, 3);
            const fr = await getChapterModeUnlock(user.id, chapter, 'battle-friends', 0.8, 3);
            if (alive) {
              setAiUnlocked(!!ai.unlocked);
              setAiUnlockAvg(ai.avg);
              setAiUnlockCount(ai.count);
              const aiSessionFactor = Math.min(1, (ai.count || 0) / 3);
              const aiAccuracyFactor = Math.min(1, (ai.avg || 0) / 0.8);
              const aiComposite = Math.max(0, Math.min(1, aiSessionFactor * aiAccuracyFactor));
              setAiUnlockProgress(aiComposite);

              setFriendsUnlocked(!!fr.unlocked);
              setFriendsUnlockAvg(fr.avg);
              setFriendsUnlockCount(fr.count);
              const frSessionFactor = Math.min(1, (fr.count || 0) / 3);
              const frAccuracyFactor = Math.min(1, (fr.avg || 0) / 0.8);
              const frComposite = Math.max(0, Math.min(1, frSessionFactor * frAccuracyFactor));
              setFriendsUnlockProgress(frComposite);
            }
          } catch { if (alive) { setAiUnlocked(false); setFriendsUnlocked(false); } }
          return;
        } catch { }
        if (alive) { setSpeedUnlocked(false); setAiUnlocked(false); setFriendsUnlocked(false); setUnlockAvg(0); setUnlockCount(0); setUnlockProgress(0); }
      } catch {
        if (alive) { setSpeedUnlocked(false); setAiUnlocked(false); setFriendsUnlocked(false); setUnlockAvg(0); setUnlockCount(0); setUnlockProgress(0); }
      }
    })();
    return () => { alive = false; };
  }, [user?.id, guest]);
  const toTasks = () => navigate('/tasks');
  const [pending, setPending] = useState<null | { id: string; mode: string; difficulty: any; topics_csv: string | null; chapter: string | null }>(null);

  // Read pending task stored by TasksHub join
  useEffect(() => {
    try {
      const raw = localStorage.getItem('play:pending_task');
      if (raw) setPending(JSON.parse(raw));
      else setPending(null);
    } catch { setPending(null); }
  }, []);

  // Today's progression (count reward events today, cap 5)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!user || guest) { if (alive) setProgressCount(0); return; }
        const today = getLocalYMD();
        const { count } = await supabase
          .from('reward_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('date', today);
        if (alive) setProgressCount(Math.min(progressGoal, count ?? 0));
      } catch {
        if (alive) setProgressCount(0);
      }
    })();
    return () => { alive = false; };
  }, [user?.id, guest]);

  const startPractice = () => {
    if (isTeacher) { navigate('/modes/solo/practice'); return; }
    // Read latest pending directly (avoid race with state)
    let p: any = null;
    try {
      const raw = localStorage.getItem('play:pending_task');
      p = raw ? JSON.parse(raw) : pending;
    } catch { p = pending; }
    // Start with task id if present
    if (p?.id) {
      const qs = new URLSearchParams();
      qs.set('task', p.id);
      qs.set('mode', p.mode || 'practice');
      if (p.difficulty) qs.set('difficulty', String(p.difficulty));
      if (p.topics_csv) qs.set('topics', p.topics_csv);
      if (p.chapter) qs.set('chapter', p.chapter);
      navigate(`/play?${qs.toString()}`);
      return;
    }
    // Or chapter-only flow from Chapters Progress / modal
    if (p?.chapter) {
      const qs = new URLSearchParams();
      qs.set('mode', 'practice');
      qs.set('difficulty', String(p.difficulty || 'moderate'));
      if (p.topics_csv) qs.set('topics', p.topics_csv);
      qs.set('chapter', p.chapter);
      navigate(`/play?${qs.toString()}`);
      return;
    }
    // Fallback: open Assignments page if nothing is pending
    toTasks();
  };
  // Locked for students: no navigation
  const startSpeed = () => {
    if (isTeacher) { navigate('/modes/solo/speed'); return; }
    if (!speedUnlocked) return;
    // Use selected pending task chapter/difficulty/topics to start Speed in Play
    try {
      const raw = localStorage.getItem('play:pending_task');
      const p = raw ? JSON.parse(raw) : null;
      const qs = new URLSearchParams();
      qs.set('mode', 'speed');
      if (p?.id) qs.set('task', p.id);
      qs.set('difficulty', String(p?.difficulty || 'moderate'));
      if (p?.topics_csv) qs.set('topics', p.topics_csv);
      if (p?.chapter) qs.set('chapter', p.chapter);
      navigate(`/play?${qs.toString()}`);
    } catch { }
  };
  const startAI = () => { if (isTeacher || aiUnlocked) navigate('/modes/compete/ai'); };
  const goFriends = () => { if (isTeacher || friendsUnlocked) navigate('/modes/compete/friends'); };
  const revisitTopics = () => isTeacher ? navigate('/modes/solo/practice') : toTasks();
  const goStats = () => navigate('/dashboard');

  return (
    <div className="min-h-[100svh] md:min-h-screen bg-white flex flex-col">
      <div className="container mx-auto max-w-6xl px-4 pt-14 sm:pt-16 pb-0 md:pb-10 flex flex-col flex-1" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black">Choose Your Mode</h1>
          </div>
          {/* Hide header progress block on mobile; it will appear between cards instead */}
          <div className="w-full md:w-80 hidden md:block" style={{ ['--primary' as any]: '249 74% 64%' }}>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-semibold">{progressCount}/{progressGoal} Quizzes</span>
            </div>
            <Progress className="h-2 bg-gray-200" value={(progressCount / progressGoal) * 100} />
          </div>
        </div>

        {/* Mobile two-screen flow */}
        <div className="md:hidden flex-1 flex flex-col space-y-4">
          {mobileStep === 0 ? (
            <>
              {/* Practice Card (mobile) */}
              <Card className="rounded-3xl border border-gray-100 bg-white shadow-[0_6px_24px_rgba(16,24,40,0.06)]">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl p-3 bg-[#EEF2FF] text-[#4F46E5]"><BookOpen className="w-6 h-6" /></div>
                    <div>
                      <CardTitle className="text-xl">Practice Mode</CardTitle>
                      <p className="text-sm text-muted-foreground">Start with concept-wise practice at your own pace.</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <Pill className="bg-[#E8EDFF] text-[#4F46E5]">Standard 6</Pill>
                  <Button className="rounded-full bg-[#6C5CE7] hover:bg-[#5A4FE0]" onClick={startPractice}>Start Practice</Button>
                </CardContent>
              </Card>

              {/* Mid unlock strip between Practice and Speed (mobile) */}
              <div className="px-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {!isTeacher && !speedUnlocked && <Lock className="w-4 h-4 text-indigo-700" />}
                    <span className={`text-xs font-semibold ${!isTeacher && !speedUnlocked ? 'text-indigo-700' : 'text-emerald-700'}`}>{isTeacher ? 'Unlocked' : (speedUnlocked ? 'Unlocked' : 'Locked')}</span>
                  </div>
                  <span className="text-[11px] text-gray-500">{Math.max(0, Math.min(100, Math.round(unlockProgress * 100)))}%</span>
                </div>
                <Progress className="h-2 bg-gray-200" value={Math.max(0, Math.min(100, unlockProgress * 100))} />
                {!isTeacher && !speedUnlocked && (
                  <div className="mt-1 text-[11px] text-gray-600">Average {Math.round((unlockAvg || 0) * 100)}% / {Math.round(unlockThreshold * 100)}% • Sessions {unlockCount}/3</div>
                )}
              </div>

              {/* Speed Card (mobile, no full overlay) */}
              <Card className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_6px_24px_rgba(16,24,40,0.06)]">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl p-3 bg-[#F5F3FF] text-[#7C3AED]"><Timer className="w-6 h-6" /></div>
                    <div>
                      <CardTitle className="text-xl">Speed Drive</CardTitle>
                      <p className="text-sm text-muted-foreground">Solve fast. Earn speed badges.</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <Pill className="bg-[#E8EDFF] text-[#4F46E5]">Standard 6</Pill>
                  <Button className="rounded-full bg-[#F4B400] hover:bg-[#E1A100] disabled:opacity-60 disabled:cursor-not-allowed" onClick={startSpeed} disabled={!(isTeacher || speedUnlocked)}>Start Speed Run</Button>
                </CardContent>
                {/* Mobile overlay to match desktop: lock + dynamic blue cover */}
                {!isTeacher && !speedUnlocked && (
                  <div className="absolute inset-0 select-none">
                    <div className="h-full bg-indigo-600/60 transition-all duration-500" style={{ width: `${Math.max(0, Math.round((1 - unlockProgress) * 100))}%` }} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-6 pointer-events-none">
                      <Lock className="w-10 h-10 mx-auto mb-2" />
                      <div className="font-bold">Locked</div>
                      <div className="text-xs opacity-95 mb-2">Average {Math.round((unlockAvg || 0) * 100)}% / 80% • Sessions {unlockCount}/3</div>
                      <div className="w-40 h-2 bg-white/30 rounded-full overflow-hidden">
                        <div className="h-full bg-white/90 transition-all" style={{ width: `${Math.max(0, Math.round(unlockProgress * 100))}%` }} />
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              <div className="mt-auto pt-3 pb-[env(safe-area-inset-bottom,0px)] text-center">
                <Button variant="secondary" className="rounded-full" onClick={() => setMobileStep(1)}>Go to next</Button>
              </div>
            </>
          ) : (
            <>
              {/* AI Rivals (mobile) */}
              <Card className="relative overflow-hidden rounded-3xl border border-gray-100 bg-gradient-to-br from-[#F2F6FF] via-white to-white shadow-[0_6px_24px_rgba(16,24,40,0.06)]">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl p-3 bg-[#E8EDFF] text-[#4F46E5]"><Bot className="w-6 h-6" /></div>
                    <div>
                      <CardTitle className="text-xl">AI Rivals</CardTitle>
                      <p className="text-sm text-muted-foreground">Challenge smart bots and climb the ranks!</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { name: 'STEADY AI', diff: 'Easy', color: 'text-emerald-700 bg-emerald-50', rate: 'Win Rate: 60%' },
                      { name: 'SMART AI', diff: 'Medium', color: 'text-amber-700 bg-amber-50', rate: 'Win Rate: 45%' },
                      { name: 'SPEED AI', diff: 'Hard', color: 'text-rose-700 bg-rose-50', rate: 'Win Rate: 20%' },
                    ].map((r, idx) => (
                      <button key={idx} onClick={startAI} disabled={!(isTeacher || aiUnlocked)} className={`w-full flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3 text-left ${(isTeacher || aiUnlocked) ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}>
                        <div>
                          <div className="text-sm font-bold">{r.name}</div>
                          <div className="text-[12px] text-muted-foreground flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.color}`}>{r.diff}</span>
                            <span>{r.rate}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300" />
                      </button>
                    ))}
                  </div>
                  <Button className="w-full mt-4 rounded-full bg-[#6C5CE7] hover:bg-[#5A4FE0] disabled:opacity-60 disabled:cursor-not-allowed" onClick={startAI} disabled={!(isTeacher || aiUnlocked)}>Challenge Bot</Button>
                </CardContent>
                {!isTeacher && !aiUnlocked && (
                  <div className="absolute inset-0 select-none">
                    <div className="h-full bg-violet-600/60 transition-all duration-500" style={{ width: `${Math.max(0, Math.round((1 - aiUnlockProgress) * 100))}%` }} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-6 pointer-events-none">
                      <Lock className="w-10 h-10 mx-auto mb-2" />
                      <div className="font-bold">Locked</div>
                      <div className="text-xs opacity-95 mb-2">Speed avg {Math.round((aiUnlockAvg || 0) * 100)}% / 80% • Sessions {aiUnlockCount}/3</div>
                      <div className="w-40 h-2 bg-white/30 rounded-full overflow-hidden">
                        <div className="h-full bg-white/90 transition-all" style={{ width: `${Math.max(0, Math.round(aiUnlockProgress * 100))}%` }} />
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Friends (mobile) */}
              <Card className="relative overflow-hidden rounded-3xl border border-gray-100 bg-gradient-to-br from-[#F2F6FF] via-white to-white shadow-[0_6px_24px_rgba(16,24,40,0.06)]">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl p-3 bg-[#E0F2FE] text-[#0284C7]"><Users className="w-6 h-6" /></div>
                    <div>
                      <CardTitle className="text-xl">Battle With Friends</CardTitle>
                      <p className="text-sm text-muted-foreground">Compete live with your classmates!</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    <Button className="flex-1 rounded-full bg-[#16A34A] hover:bg-[#128A3F] disabled:opacity-60 disabled:cursor-not-allowed" onClick={goFriends} disabled={!(isTeacher || friendsUnlocked)}>+ Create Room</Button>
                    <Button className="flex-1 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-60 disabled:cursor-not-allowed" onClick={goFriends} disabled={!(isTeacher || friendsUnlocked)}>Join Room</Button>
                  </div>
                </CardContent>
                {!isTeacher && !friendsUnlocked && (
                  <div className="absolute inset-0 select-none">
                    <div className="h-full bg-sky-600/60 transition-all duration-500" style={{ width: `${Math.max(0, Math.round((1 - friendsUnlockProgress) * 100))}%` }} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-6 pointer-events-none">
                      <Lock className="w-10 h-10 mx-auto mb-2" />
                      <div className="font-bold">Locked</div>
                      <div className="text-xs opacity-95 mb-2">AI avg {Math.round((friendsUnlockAvg || 0) * 100)}% / 80% • Sessions {friendsUnlockCount}/3</div>
                      <div className="w-40 h-2 bg-white/30 rounded-full overflow-hidden">
                        <div className="h-full bg-white/90 transition-all" style={{ width: `${Math.max(0, Math.round(friendsUnlockProgress * 100))}%` }} />
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              <div className="mt-auto pt-3 pb-[env(safe-area-inset-bottom,0px)] text-center">
                <Button variant="secondary" className="rounded-full" onClick={() => setMobileStep(0)}>Go to Previous</Button>
              </div>
            </>
          )}
        </div>

        {/* Desktop/Tablet original grid */}
        <div className="hidden md:grid md:grid-cols-2 gap-8">
          <Card className="rounded-3xl border border-gray-100 bg-white shadow-[0_6px_24px_rgba(16,24,40,0.06)]">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="rounded-xl p-3 bg-[#EEF2FF] text-[#4F46E5]"><BookOpen className="w-6 h-6" /></div>
                <div>
                  <CardTitle className="text-xl">Practice Mode</CardTitle>
                  <p className="text-sm text-muted-foreground">Start with concept-wise practice at your own pace.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <Pill className="bg-[#E8EDFF] text-[#4F46E5]">Standard 6</Pill>
              <Button className="rounded-full bg-[#6C5CE7] hover:bg-[#5A4FE0]" onClick={startPractice}>Start Practice</Button>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_6px_24px_rgba(16,24,40,0.06)]">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="rounded-xl p-3 bg-[#F5F3FF] text-[#7C3AED]"><Timer className="w-6 h-6" /></div>
                <div>
                  <CardTitle className="text-xl">Speed Drive</CardTitle>
                  <p className="text-sm text-muted-foreground">Solve fast. Earn speed badges.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <Pill className="bg-[#E8EDFF] text-[#4F46E5]">Standard 6</Pill>
              <Button className="rounded-full bg-[#F4B400] hover:bg-[#E1A100] disabled:opacity-60 disabled:cursor-not-allowed" onClick={startSpeed} disabled={!(isTeacher || speedUnlocked)}>Start Speed Run</Button>
            </CardContent>
            {/* Keep full overlay only for desktop/tablet */}
            {!isTeacher && !speedUnlocked && (
              <div className="absolute inset-0 select-none hidden md:block">
                {/* Dynamic blue cover, width = remaining to unlock */}
                <div className="h-full bg-indigo-600/60 transition-all duration-500" style={{ width: `${Math.max(0, Math.round((1 - unlockProgress) * 100))}%` }} />
                {/* Foreground hint */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-6 pointer-events-none">
                  <Lock className="w-10 h-10 mx-auto mb-2" />
                  <div className="font-bold">Locked</div>
                  <div className="text-xs opacity-95 mb-2">Average {Math.round((unlockAvg || 0) * 100)}% / 80% • Sessions {unlockCount}/3</div>
                  <div className="w-40 h-2 bg-white/30 rounded-full overflow-hidden">
                    <div className="h-full bg-white/90 transition-all" style={{ width: `${Math.max(0, Math.round(unlockProgress * 100))}%` }} />
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card className="relative overflow-hidden rounded-3xl border border-gray-100 bg-gradient-to-br from-[#F2F6FF] via-white to-white shadow-[0_6px_24px_rgba(16,24,40,0.06)]">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="rounded-xl p-3 bg-[#E8EDFF] text-[#4F46E5]"><Bot className="w-6 h-6" /></div>
                <div>
                  <CardTitle className="text-xl">AI Rivals</CardTitle>
                  <p className="text-sm text-muted-foreground">Challenge smart bots and climb the ranks!</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { name: 'STEADY AI', diff: 'Easy', color: 'text-emerald-700 bg-emerald-50', rate: 'Win Rate: 60%' },
                  { name: 'SMART AI', diff: 'Medium', color: 'text-amber-700 bg-amber-50', rate: 'Win Rate: 45%' },
                  { name: 'SPEED AI', diff: 'Hard', color: 'text-rose-700 bg-rose-50', rate: 'Win Rate: 20%' },
                ].map((r, idx) => (
                  <button key={idx} onClick={startAI} disabled={!(isTeacher || aiUnlocked)} className={`w-full flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3 text-left ${(isTeacher || aiUnlocked) ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}>
                    <div>
                      <div className="text-sm font-bold">{r.name}</div>
                      <div className="text-[12px] text-muted-foreground flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.color}`}>{r.diff}</span>
                        <span>{r.rate}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </button>
                ))}
              </div>
              <Button className="w-full mt-4 rounded-full bg-[#6C5CE7] hover:bg-[#5A4FE0] disabled:opacity-60 disabled:cursor-not-allowed" onClick={startAI} disabled={!(isTeacher || aiUnlocked)}>Challenge Bot</Button>
            </CardContent>
            {!isTeacher && !aiUnlocked && (
              <div className="absolute inset-0 select-none hidden md:block">
                <div className="h-full bg-violet-600/60 transition-all duration-500" style={{ width: `${Math.max(0, Math.round((1 - aiUnlockProgress) * 100))}%` }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-6 pointer-events-none">
                  <Lock className="w-10 h-10 mx-auto mb-2" />
                  <div className="font-bold">Locked</div>
                  <div className="text-xs opacity-95 mb-2">Speed avg {Math.round((aiUnlockAvg || 0) * 100)}% / 80% • Sessions {aiUnlockCount}/3</div>
                  <div className="w-40 h-2 bg-white/30 rounded-full overflow-hidden">
                    <div className="h-full bg-white/90 transition-all" style={{ width: `${Math.max(0, Math.round(aiUnlockProgress * 100))}%` }} />
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card className="relative overflow-hidden rounded-3xl border border-gray-100 bg-gradient-to-br from-[#F2F6FF] via-white to-white shadow-[0_6px_24px_rgba(16,24,40,0.06)]">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="rounded-xl p-3 bg-[#E0F2FE] text-[#0284C7]"><Users className="w-6 h-6" /></div>
                <div>
                  <CardTitle className="text-xl">Battle With Friends</CardTitle>
                  <p className="text-sm text-muted-foreground">Compete live with your classmates!</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button className="flex-1 rounded-full bg-[#16A34A] hover:bg-[#128A3F] disabled:opacity-60 disabled:cursor-not-allowed" onClick={goFriends} disabled={!(isTeacher || friendsUnlocked)}>+ Create Room</Button>
                <Button className="flex-1 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-60 disabled:cursor-not-allowed" onClick={goFriends} disabled={!(isTeacher || friendsUnlocked)}>Join Room</Button>
              </div>
            </CardContent>
            {!isTeacher && !friendsUnlocked && (
              <div className="absolute inset-0 select-none hidden md:block">
                <div className="h-full bg-sky-600/60 transition-all duration-500" style={{ width: `${Math.max(0, Math.round((1 - friendsUnlockProgress) * 100))}%` }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-6 pointer-events-none">
                  <Lock className="w-10 h-10 mx-auto mb-2" />
                  <div className="font-bold">Locked</div>
                  <div className="text-xs opacity-95 mb-2">AI avg {Math.round((friendsUnlockAvg || 0) * 100)}% / 80% • Sessions {friendsUnlockCount}/3</div>
                  <div className="w-40 h-2 bg-white/30 rounded-full overflow-hidden">
                    <div className="h-full bg-white/90 transition-all" style={{ width: `${Math.max(0, Math.round(friendsUnlockProgress * 100))}%` }} />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="mt-8 hidden md:flex items-center justify-end gap-8 text-sm">
          <button className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900" onClick={revisitTopics}>
            <BookOpen className="w-4 h-4" /> Revisit Previous Topics
          </button>
          <button className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900" onClick={goStats}>
            <BarChart3 className="w-4 h-4" /> My Stats
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modes;
