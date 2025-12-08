import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTasksByCreator, type LiveTask } from "@/services/tasks";
import { getRunsForTeacher, type TaskRunWithTask } from "@/services/taskRuns";
import { getProfilesByIds } from "@/services/profile";

function formatPercent(n: number) { return `${(n * 100).toFixed(0)}%`; }
function formatMs(ms?: number | null) {
  if (!ms || ms <= 0) return "-";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60); const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

const TeacherReports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<LiveTask[]>([]);
  const [runs, setRuns] = useState<TaskRunWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      setLoading(true);
      const [t, r] = await Promise.all([
        getTasksByCreator(user.id, 'all'),
        getRunsForTeacher(user.id),
      ]);
      if (!cancelled) {
        setTasks(t || []);
        setRuns(r || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Load student display names for all user_ids present in runs
  useEffect(() => {
    const ids = Array.from(new Set((runs || []).map(r => r.user_id).filter(Boolean) as string[]));
    if (ids.length === 0) {
      setNameMap({});
      return;
    }
    (async () => {
      const m = await getProfilesByIds(ids);
      setNameMap(m);
    })();
  }, [runs]);

  const kpis = useMemo(() => {
    const totalTasks = tasks.length;
    const participantKeys = new Set<string>();
    let totalCorrect = 0, totalTotal = 0, totalTime = 0, timeCount = 0;
    for (const r of runs) {
      const key = r.user_id || r.guest_id || `anon:${r.id}`;
      participantKeys.add(key);
      if (typeof r.correct === 'number' && typeof r.total === 'number') {
        totalCorrect += Math.max(0, r.correct);
        totalTotal += Math.max(0, r.total);
      }
      if (typeof r.time_ms === 'number') { totalTime += r.time_ms; timeCount++; }
    }
    const avgAcc = totalTotal ? totalCorrect / totalTotal : 0;
    const avgTime = timeCount ? totalTime / timeCount : 0;
    return { totalTasks, participants: participantKeys.size, avgAcc, avgTime };
  }, [tasks, runs]);

  const recentTasks = useMemo(() => tasks.slice(0, 10), [tasks]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-emerald-50">
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-indigo-700 to-emerald-700 bg-clip-text text-transparent">
            Class Reports
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <Card className="col-span-1">
            <CardHeader><CardTitle className="text-sm">Total Tasks</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{kpis.totalTasks}</CardContent>
          </Card>
          <Card className="col-span-1">
            <CardHeader><CardTitle className="text-sm">Participants</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{kpis.participants}</CardContent>
          </Card>
          <Card className="col-span-1">
            <CardHeader><CardTitle className="text-sm">Avg Accuracy</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{formatPercent(kpis.avgAcc)}</CardContent>
          </Card>
          <Card className="col-span-1">
            <CardHeader><CardTitle className="text-sm">Avg Time</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{formatMs(kpis.avgTime)}</CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Recent Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : recentTasks.length === 0 ? (
              <div className="text-sm text-muted-foreground">No tasks yet.</div>
            ) : (
              <div className="divide-y">
                {recentTasks.map(t => (
                  <div key={t.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{t.chapter ? `${t.chapter} • ` : ''}{t.topics_csv || 'mixed'} • {t.status}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => navigate(`/portal/reports/tasks/${t.id}`)}>View</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Students</CardTitle>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No student activity yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4">Student</th>
                      <th className="py-2 pr-4">Attempts</th>
                      <th className="py-2 pr-4">Avg Acc</th>
                      <th className="py-2 pr-4">Avg Time</th>
                      <th className="py-2 pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(new Map(runs.map(r => [r.user_id || r.guest_id || r.id, r]))).map(([key]) => {
                      const all = runs.filter(r => (r.user_id || r.guest_id || r.id) === key);
                      const attempts = all.length;
                      let c=0,t=0, tm=0, tc=0;
                      for (const r of all) { c += Math.max(0, r.correct || 0); t += Math.max(0, r.total || 0); if (r.time_ms) { tm += r.time_ms; tc++; } }
                      const acc = t ? c/t : 0;
                      const avgT = tc ? tm/tc : 0;
                      const isGuest = !!all[0].guest_id;
                      const displayName = isGuest
                        ? 'Guest'
                        : (all[0].display_name || nameMap[all[0].user_id as string] || 'Player');
                      const [name, setName] = [undefined, undefined] as any; // placeholder for TSX map
                      return (
                        <tr key={key} className="border-t">
                          <td className="py-2 pr-4">{displayName}</td>
                          <td className="py-2 pr-4">{attempts}</td>
                          <td className="py-2 pr-4">{formatPercent(acc)}</td>
                          <td className="py-2 pr-4">{formatMs(avgT)}</td>
                          <td className="py-2 pr-4">
                            {!isGuest && <Button size="sm" variant="outline" onClick={() => navigate(`/portal/reports/students/${all[0].user_id}`)}>Inspect</Button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeacherReports;
