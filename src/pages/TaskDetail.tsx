import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getTaskById, type LiveTask } from "@/services/tasks";
import { getRunsForTask, type TaskRun } from "@/services/taskRuns";
import { getProfilesByIds } from "@/services/profile";

function pct(correct: number, total: number) { return total ? Math.round((correct/total)*100) : 0; }
function fmtMs(ms?: number | null) {
  if (!ms || ms <= 0) return "-";
  const s = Math.round(ms/1000);
  const m = Math.floor(s/60), r = s%60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

const TaskDetail = () => {
  const { user } = useAuth();
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<LiveTask | null>(null);
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!taskId) return;
      setLoading(true);
      const [t, r] = await Promise.all([
        getTaskById(taskId),
        getRunsForTask(taskId),
      ]);
      if (!cancelled) {
        setTask(t);
        setRuns(r || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [taskId]);

  // Load names for all user_ids in this task's runs
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

  const summary = useMemo(() => {
    const participants = new Set<string>();
    let c=0, t=0, time=0, cnt=0;
    for (const r of runs) {
      participants.add(r.user_id || r.guest_id || r.id);
      c += Math.max(0, r.correct || 0);
      t += Math.max(0, r.total || 0);
      if (typeof r.time_ms === 'number') { time += r.time_ms; cnt++; }
    }
    const avgAcc = t ? c/t : 0;
    const avgTime = cnt ? time/cnt : 0;
    return { participants: participants.size, avgAcc, avgTime };
  }, [runs]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-emerald-50">
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-indigo-700 to-emerald-700 bg-clip-text text-transparent">
            Task Detail
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
            <Button variant="secondary" onClick={() => navigate('/portal/reports')}>All Reports</Button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : !task ? (
          <div className="text-sm text-muted-foreground">Task not found.</div>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">{task.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Chapter:</span> {task.chapter || '-'}</div>
                  <div><span className="text-muted-foreground">Topics:</span> {task.topics_csv || 'mixed'}</div>
                  <div><span className="text-muted-foreground">Status:</span> {task.status}</div>
                  <div><span className="text-muted-foreground">Started:</span> {new Date(task.started_at).toLocaleString()}</div>
                  <div><span className="text-muted-foreground">Ended:</span> {task.ended_at ? new Date(task.ended_at).toLocaleString() : '-'}</div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <Card><CardHeader><CardTitle className="text-sm">Participants</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{summary.participants}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Avg Accuracy</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{Math.round(summary.avgAcc*100)}%</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Avg Time</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{fmtMs(summary.avgTime)}</CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Participants</CardTitle></CardHeader>
              <CardContent>
                {runs.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No attempts yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="py-2 pr-4">Student</th>
                          <th className="py-2 pr-4">Correct</th>
                          <th className="py-2 pr-4">Total</th>
                          <th className="py-2 pr-4">Accuracy</th>
                          <th className="py-2 pr-4">Time</th>
                          <th className="py-2 pr-4">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map(r => {
                          const isGuest = !r.user_id;
                          const displayName = isGuest
                            ? 'Guest'
                            : (r.display_name || nameMap[r.user_id as string] || 'Player');
                          return (
                          <tr key={r.id} className="border-t">
                            <td className="py-2 pr-4">{displayName}</td>
                            <td className="py-2 pr-4">{r.correct ?? 0}</td>
                            <td className="py-2 pr-4">{r.total ?? 0}</td>
                            <td className="py-2 pr-4">{pct(r.correct || 0, r.total || 0)}%</td>
                            <td className="py-2 pr-4">{fmtMs(r.time_ms)}</td>
                            <td className="py-2 pr-4">{r.status}</td>
                            {!isGuest && (
                              <td className="py-2 pr-4">
                                <Button size="sm" variant="outline" onClick={() => navigate(`/portal/reports/students/${r.user_id}`)}>Inspect</Button>
                              </td>
                            )}
                          </tr>
                        );})}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default TaskDetail;
