import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getActiveTasks, subscribeActiveTasks, type LiveTask } from "@/services/tasks";

const TasksHub = () => {
  const { user, guest } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<LiveTask[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setTasks([]); return; }
      const items = await getActiveTasks();
      if (!cancelled) setTasks(items);
    })();
    const unsub = subscribeActiveTasks((items) => { if (!cancelled) setTasks(items); });
    return () => { cancelled = true; unsub(); };
  }, [user?.id, guest]);

  const join = (t: LiveTask) => {
    const qs = new URLSearchParams();
    qs.set('task', t.id);
    qs.set('mode', t.mode);
    if (t.difficulty) qs.set('difficulty', t.difficulty);
    if (t.topics_csv) qs.set('topics', t.topics_csv);
    if (t.chapter) qs.set('chapter', t.chapter);
    navigate(`/play?${qs.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50">
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {(!user || guest) && (
              <div className="text-sm text-muted-foreground">Sign in to view assignments.</div>
            )}
            {user && tasks.length === 0 && (
              <div className="text-sm text-muted-foreground">No assignment available yet. Your teacher will start a task soon.</div>
            )}
            {user && tasks.length > 0 && (
              <div className="space-y-3">
                {tasks.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border bg-white/70">
                    <div>
                      <div className="text-sm font-bold">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{t.chapter ? `${t.chapter} • ` : ''}{t.mode} • {t.difficulty || 'moderate'} • {t.topics_csv || 'mixed'}</div>
                    </div>
                    <Button className="rounded-full" onClick={() => join(t)}>Join</Button>
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

export default TasksHub;
