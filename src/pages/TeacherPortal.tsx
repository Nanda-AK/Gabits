import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/services/profile";
import { startLiveTask, endLiveTask, getActiveTasks, subscribeActiveTasks, type LiveTask } from "@/services/tasks";
import { toast } from "@/hooks/use-toast";
import { questions } from "@/data/questions";

const topicOptions = [
  { key: 'addition', label: 'Addition' },
  { key: 'subtraction', label: 'Subtraction' },
  { key: 'multiplication', label: 'Multiplication' },
  { key: 'division', label: 'Division' },
  { key: 'fractions', label: 'Fractions' },
  { key: 'algebra', label: 'Algebra' },
];

const TeacherPortal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profileName, setProfileName] = useState<string>("");
  const [mode, setMode] = useState<'practice' | 'speed' | 'battle-ai' | 'battle-friends'>('practice');
  const [difficulty, setDifficulty] = useState<'easy'|'moderate'|'difficult'>('moderate');
  const [topics, setTopics] = useState<string[]>(['addition','subtraction','multiplication','division']);
  // Build chapter list dynamically from aggregated questions (unique, sorted)
  const chapterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const q of questions) {
      if (q.chapter && typeof q.chapter === 'string') set.add(q.chapter);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, []);
  const [chapter, setChapter] = useState<string>("");
  useEffect(() => {
    if (!chapter && chapterOptions.length > 0) setChapter(chapterOptions[0]);
  }, [chapter, chapterOptions]);
  const [live, setLive] = useState<LiveTask[]>([]);
  const toggleTopic = (t: string) => setTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const p = await getProfile(user.id);
      setProfileName(p?.full_name || 'Teacher');
      const items = await getActiveTasks();
      setLive(items);
    })();
  }, [user?.id]);

  useEffect(() => {
    const unsub = subscribeActiveTasks(setLive);
    return () => { unsub(); };
  }, []);

  const displayName = useMemo(() => {
    const localName = localStorage.getItem("player:name") || "";
    return profileName || (user?.user_metadata as any)?.full_name || localName || "Teacher";
  }, [profileName, user]);

  const start = async () => {
    if (!user) return;
    const created = await startLiveTask({
      title: chapter || `${displayName}'s Assignment`,
      mode,
      topics,
      difficulty,
      chapter,
      created_by: user.id,
    });
    if (created) {
      // Optimistic update so UI reflects immediately even if Realtime lags
      setLive(prev => [created, ...prev]);
      toast({ title: 'Task started', description: created.title });
    } else {
      toast({ title: 'Failed to start task', description: 'Please retry.', variant: 'destructive' as any });
    }
  };

  const end = async (taskId: string) => {
    if (!user) return;
    // Optimistically remove from list
    const before = live;
    setLive(prev => prev.filter(t => t.id !== taskId));
    const ok = await endLiveTask(taskId, user.id);
    if (ok) {
      toast({ title: 'Task ended', description: 'Students can no longer join.' });
    } else {
      // Revert on failure
      setLive(before);
      toast({ title: 'Failed to end task', description: 'Please retry.', variant: 'destructive' as any });
    }
  };

  const joinPreview = (t: LiveTask) => {
    const qs = new URLSearchParams();
    qs.set('task', t.id);
    qs.set('mode', t.mode);
    if (t.topics_csv) qs.set('topics', t.topics_csv);
    if (t.chapter) qs.set('chapter', t.chapter);
    navigate(`/play?${qs.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-emerald-50">
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-indigo-700 to-emerald-700 bg-clip-text text-transparent">
            Teacher Panel
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/portal/reports')}>
              View Reports
            </Button>
            <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Start Live Task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Chapter</label>
                <select className="w-full border rounded-md h-10 px-2" value={chapter} onChange={e => setChapter(e.target.value)}>
                  {chapterOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Topics</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {topicOptions.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={topics.includes(key)} onChange={() => toggleTopic(key)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <Button className="rounded-full" onClick={start}>Start Task</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {live.length === 0 ? (
              <div className="text-sm text-muted-foreground">No active tasks. Start one above.</div>
            ) : (
              <div className="space-y-3">
                {live.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border bg-white/70">
                    <div>
                      <div className="text-sm font-bold">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{t.chapter ? `${t.chapter} • ` : ''}{t.topics_csv || 'mixed'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => joinPreview(t)}>Preview</Button>
                      <Button onClick={() => navigate(`/portal/reports/tasks/${t.id}`)}>View Report</Button>
                      <Button variant="outline" onClick={() => end(t.id)}>End</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeacherPortal;
