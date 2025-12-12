import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getTasksByCreator, type LiveTask } from "@/services/tasks";
import { getRunsForTeacher, type TaskRunWithTask } from "@/services/taskRuns";

function fmtMs(ms?: number | null) {
  if (!ms || ms <= 0) return "-";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60), r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

export default function ClassOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<LiveTask[]>([]);
  const [runs, setRuns] = useState<TaskRunWithTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
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

  const metrics = useMemo(() => {
    const allRuns = runs || [];
    const uniqueStudents = new Set<string>();
    let c=0,t=0,time=0,cnt=0;
    for (const r of allRuns) {
      if (r.user_id) uniqueStudents.add(r.user_id);
      c += Math.max(0, r.correct || 0);
      t += Math.max(0, r.total || 0);
      if (typeof r.time_ms === 'number') { time += r.time_ms; cnt++; }
    }
    const avgAcc = t ? c/t : 0;
    const avgTime = cnt ? time/cnt : 0;
    const activeTasks = (tasks || []).filter(x => x.status === 'active').length;
    const endedTasks = (tasks || []).filter(x => x.status === 'ended').length;
    return { students: uniqueStudents.size, tasks: tasks.length, activeTasks, endedTasks, runs: allRuns.length, avgAcc, avgTime };
  }, [runs, tasks]);

  const topStudents = useMemo(() => {
    const map = new Map<string, { name: string; attempts: number; c: number; t: number; time: number; tc: number }>();
    for (const r of runs) {
      if (!r.user_id) continue;
      const m = map.get(r.user_id) || { name: r.display_name || 'Player', attempts: 0, c:0, t:0, time:0, tc:0 };
      m.name = r.display_name || m.name || 'Player';
      m.attempts++;
      m.c += Math.max(0, r.correct || 0);
      m.t += Math.max(0, r.total || 0);
      if (typeof r.time_ms === 'number') { m.time += r.time_ms; m.tc++; }
      map.set(r.user_id, m);
    }
    return Array.from(map.entries()).map(([uid,m]) => ({ uid, name: m.name, attempts: m.attempts, acc: m.t ? m.c/m.t : 0, time: m.tc ? m.time/m.tc : 0 }))
      .sort((a,b) => b.acc - a.acc).slice(0, 8);
  }, [runs]);

  const recentRuns = useMemo(() => (runs || []).slice(0, 10), [runs]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-emerald-50">
      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-indigo-700 to-emerald-700 bg-clip-text text-transparent">Class Overview</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/portal/teacher')}>Teacher Panel</Button>
            <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <Card><CardHeader><CardTitle className="text-sm">Students</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.students}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Tasks</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.tasks}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Active</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.activeTasks}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Ended</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.endedTasks}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Avg Acc</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{Math.round(metrics.avgAcc*100)}%</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Avg Time</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{fmtMs(metrics.avgTime)}</CardContent></Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">Top Students</CardTitle></CardHeader>
                <CardContent>
                  {topStudents.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No activity yet.</div>
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
                          {topStudents.map(s => (
                            <tr key={s.uid} className="border-t">
                              <td className="py-2 pr-4">{s.name}</td>
                              <td className="py-2 pr-4">{s.attempts}</td>
                              <td className="py-2 pr-4">{Math.round(s.acc*100)}%</td>
                              <td className="py-2 pr-4">{fmtMs(s.time)}</td>
                              <td className="py-2 pr-4"><Button size="sm" variant="outline" onClick={() => navigate(`/portal/reports/students/${s.uid}`)}>Inspect</Button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Recent Runs</CardTitle></CardHeader>
                <CardContent>
                  {recentRuns.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No recent activity.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th className="py-2 pr-4">Student</th>
                            <th className="py-2 pr-4">Task</th>
                            <th className="py-2 pr-4">Accuracy</th>
                            <th className="py-2 pr-4">Time</th>
                            <th className="py-2 pr-4">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentRuns.map(r => (
                            <tr key={r.id} className="border-t">
                              <td className="py-2 pr-4">{r.display_name || (r.user_id ? 'Player' : 'Guest')}</td>
                              <td className="py-2 pr-4">{r.live_tasks?.title || '-'}</td>
                              <td className="py-2 pr-4">{Math.round(((r.correct||0)/(r.total||1))*100)}%</td>
                              <td className="py-2 pr-4">{fmtMs(r.time_ms)}</td>
                              <td className="py-2 pr-4">{r.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardHeader><CardTitle className="text-lg">Tasks</CardTitle></CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No tasks yet.</div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border bg-white/70">
                        <div>
                          <div className="text-sm font-bold">{t.title}</div>
                          <div className="text-xs text-muted-foreground">{t.chapter ? `${t.chapter} • ` : ''}{t.topics_csv || 'mixed'} • {t.status}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="secondary" onClick={() => navigate(`/portal/reports/tasks/${t.id}`)}>View Report</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
