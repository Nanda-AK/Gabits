import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { QuizGame } from "@/components/QuizGame";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile } from "@/services/profile";
import { getTaskById, type LiveTask } from "@/services/tasks";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const Play = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const q = useQuery();
  const qsMode = (q.get("mode") as 'practice' | 'speed' | 'battle-ai' | 'battle-friends') ?? 'practice';
  const qsDifficulty = (q.get("difficulty") as 'easy' | 'moderate' | 'difficult') ?? 'moderate';
  const qsTopic = (q.get("topic") as 'mixed' | 'addition' | 'subtraction' | 'multiplication' | 'division' | 'fractions' | 'algebra') ?? 'mixed';
  const topicsCsv = q.get("topics") || '';
  const qsChapter = q.get('chapter') || undefined;
  const qsTopics = topicsCsv ? topicsCsv.split(',').map(s => s.trim()).filter(Boolean) : undefined;
  const lobby = q.get('lobby') || undefined;
  const taskId = q.get('task') || undefined;

  const [role, setRole] = useState<string>('');
  const [task, setTask] = useState<LiveTask | null>(null);
  const [ready, setReady] = useState<boolean>(false);

  // Load role and optionally the task
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const isBattleMode = qsMode === 'battle-ai' || qsMode === 'battle-friends';
      if (isBattleMode) {
        // For AI / Friends battles, do not require a teacher live task or chapter
        if (!cancelled) {
          setRole('student');
          setTask(null);
          setReady(true);
        }
        return;
      }

      // Resolve current role from profile (default student)
      let nextRole: string = 'student';
      if (user) {
        const p = await getProfile(user.id);
        nextRole = (p?.role as string) || 'student';
      }
      if (!cancelled) setRole(nextRole);

      // If not teacher, either require a valid active task OR allow chapter-only launch.
      const isTeacher = nextRole === 'teacher';
      if (!isTeacher) {
        if (!taskId) {
          // Allow direct chapter launch (from Chapters Progress / modal)
          if (!qsChapter) { if (!cancelled) { setReady(true); navigate('/tasks', { replace: true }); } return; }
          // chapter present → proceed without fetching task
          if (!cancelled) setTask(null);
        } else {
          const t = await getTaskById(taskId);
          if (!cancelled) {
            if (!t || t.status !== 'active') { setReady(true); navigate('/tasks', { replace: true }); return; }
            setTask(t);
          }
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  // include taskId so navigating to different task works
  }, [user?.id, taskId, qsChapter, qsMode]);

  // Final settings: allow query ?mode to override task.mode (needed to start Speed for a Practice task)
  const mode = (q.get('mode') as any) ? qsMode : (task?.mode || qsMode);
  const difficulty = (task?.difficulty || qsDifficulty) as 'easy' | 'moderate' | 'difficult';
  const topics = (task?.topics_csv ? task.topics_csv.split(',').map(s => s.trim()).filter(Boolean) : qsTopics);
  const topic = qsTopic; // kept for backward-compat; "topics" takes precedence in QuizGame
  const chapter = (task?.chapter || qsChapter);

  if (!ready) return null;

  return (
    <div className="min-h-[100svh] md:min-h-screen bg-background">
      <QuizGame mode={mode} difficulty={difficulty} topic={topic} topics={topics} chapter={chapter || undefined} lobbyCode={lobby} />
    </div>
  );
};

export default Play;
