import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { getRunsForTeacher, type TaskRunWithTask } from "@/services/taskRuns";

function fmtMs(ms?: number | null) {
  if (!ms || ms <= 0) return "-";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60), r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

export default function TeacherStudents() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<TaskRunWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      setLoading(true);
      const r = await getRunsForTeacher(user.id);
      if (!cancelled) {
        setRuns(r || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const students = useMemo(() => {
    const map = new Map<string, { name: string; attempts: number; c: number; t: number; time: number; tc: number; last: string }>();
    for (const r of runs) {
      if (!r.user_id) continue; // guests are not listable as students
      const m = map.get(r.user_id) || { name: r.display_name || 'Player', attempts: 0, c:0, t:0, time:0, tc:0, last: r.completed_at || r.started_at };
      m.name = r.display_name || m.name || 'Player';
      m.attempts++;
      m.c += Math.max(0, r.correct || 0);
      m.t += Math.max(0, r.total || 0);
      if (typeof r.time_ms === 'number') { m.time += r.time_ms; m.tc++; }
      m.last = (r.completed_at || r.started_at || m.last);
      map.set(r.user_id, m);
    }
    let list = Array.from(map.entries()).map(([uid,m]) => ({ uid, name: m.name, attempts: m.attempts, acc: m.t ? m.c/m.t : 0, time: m.tc ? m.time/m.tc : 0, last: m.last }));
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(x => x.name.toLowerCase().includes(s) || x.uid.toLowerCase().includes(s));
    }
    return list.sort((a,b) => (b.attempts - a.attempts) || (b.acc - a.acc));
  }, [runs, q]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-emerald-50">
      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-indigo-700 to-emerald-700 bg-clip-text text-transparent">Students</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/portal/teacher')}>Teacher Panel</Button>
            <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle className="text-lg">Search</CardTitle></CardHeader>
          <CardContent>
            <Input placeholder="Search by name or ID" value={q} onChange={e => setQ(e.target.value)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">All Students</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : students.length === 0 ? (
              <div className="text-sm text-muted-foreground">No students yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4">Student</th>
                      <th className="py-2 pr-4">Attempts</th>
                      <th className="py-2 pr-4">Avg Acc</th>
                      <th className="py-2 pr-4">Avg Time</th>
                      <th className="py-2 pr-4">Last</th>
                      <th className="py-2 pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(s => (
                      <tr key={s.uid} className="border-t">
                        <td className="py-2 pr-4">{s.name}</td>
                        <td className="py-2 pr-4">{s.attempts}</td>
                        <td className="py-2 pr-4">{Math.round(s.acc*100)}%</td>
                        <td className="py-2 pr-4">{fmtMs(s.time)}</td>
                        <td className="py-2 pr-4">{s.last ? new Date(s.last).toLocaleString() : '-'}</td>
                        <td className="py-2 pr-4"><Button size="sm" variant="outline" onClick={() => navigate(`/portal/reports/students/${s.uid}`)}>Inspect</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
