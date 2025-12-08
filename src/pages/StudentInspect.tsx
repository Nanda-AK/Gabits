import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile } from "@/services/profile";
import { getRunsForTeacherStudent, type TaskRunWithTask } from "@/services/taskRuns";

function pct(c: number, t: number) { return t ? Math.round((c/t)*100) : 0; }
function fmtMs(ms?: number | null) {
  if (!ms || ms <= 0) return "-";
  const s = Math.round(ms/1000);
  const m = Math.floor(s/60), r = s%60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

const StudentInspect = () => {
  const { user: teacher } = useAuth();
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<TaskRunWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState<string>('Student');
  const [studentStandard, setStudentStandard] = useState<string>('-');
  const [studentAge, setStudentAge] = useState<number | null>(null);
  const [studentGender, setStudentGender] = useState<string>('-');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!teacher?.id || !studentId) return;
      setLoading(true);
      try {
        const [r, p] = await Promise.all([
          getRunsForTeacherStudent(teacher.id, studentId),
          getProfile(studentId).catch(() => null)
        ]);
        if (!cancelled) {
          setRuns(r || []);
          setStudentName(p?.full_name || 'Student');
          setStudentStandard(p?.standard || '-');
          setStudentAge(typeof p?.age === 'number' ? p!.age : null);
          setStudentGender(p?.gender || '-');
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [teacher?.id, studentId]);

  const summary = useMemo(() => {
    let total=0, correct=0, time=0, tc=0;
    for (const r of runs) {
      total += Math.max(0, r.total || 0);
      correct += Math.max(0, r.correct || 0);
      if (r.time_ms) { time += r.time_ms; tc++; }
    }
    const avgAcc = total ? correct/total : 0;
    const avgTime = tc ? time/tc : 0;
    return { total, correct, avgAcc, avgTime };
  }, [runs]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-emerald-50">
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-indigo-700 to-emerald-700 bg-clip-text text-transparent">
              Student Report
            </h1>
            <p className="text-muted-foreground">{studentName}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
            <Button variant="secondary" onClick={() => navigate('/portal/reports')}>All Reports</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <Card><CardHeader><CardTitle className="text-sm">Tasks Completed</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{runs.length}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Avg Accuracy</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{Math.round(summary.avgAcc*100)}%</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Avg Time</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{fmtMs(summary.avgTime)}</CardContent></Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Profile</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground">Standard:</span> {studentStandard}</div>
                <div><span className="text-muted-foreground">Age:</span> {studentAge ?? '-'}</div>
                <div><span className="text-muted-foreground">Gender:</span> {studentGender}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Task History</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : runs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No task history found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4">Task</th>
                      <th className="py-2 pr-4">Chapter</th>
                      <th className="py-2 pr-4">Correct</th>
                      <th className="py-2 pr-4">Total</th>
                      <th className="py-2 pr-4">Accuracy</th>
                      <th className="py-2 pr-4">Time</th>
                      <th className="py-2 pr-4">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map(r => (
                      <tr key={r.id} className="border-t">
                        <td className="py-2 pr-4">{r.live_tasks?.title || 'Untitled'}</td>
                        <td className="py-2 pr-4">{r.live_tasks?.chapter || '-'}</td>
                        <td className="py-2 pr-4">{r.correct}</td>
                        <td className="py-2 pr-4">{r.total}</td>
                        <td className="py-2 pr-4">{pct(r.correct || 0, r.total || 0)}%</td>
                        <td className="py-2 pr-4">{fmtMs(r.time_ms)}</td>
                        <td className="py-2 pr-4">{new Date(r.completed_at || r.started_at).toLocaleDateString()}</td>
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
};

export default StudentInspect;
