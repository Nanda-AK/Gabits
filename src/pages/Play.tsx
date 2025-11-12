import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { QuizGame } from "@/components/QuizGame";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const Play = () => {
  const q = useQuery();
  const mode = (q.get("mode") as 'practice' | 'speed' | 'battle-ai' | 'battle-friends') ?? 'practice';
  const difficulty = (q.get("difficulty") as 'easy' | 'moderate' | 'difficult') ?? 'moderate';
  const topic = (q.get("topic") as 'mixed' | 'addition' | 'subtraction' | 'multiplication' | 'division' | 'fractions' | 'algebra') ?? 'mixed';
  const topicsCsv = q.get("topics") || '';
  const topics = topicsCsv ? topicsCsv.split(',').map(s => s.trim()).filter(Boolean) : undefined;
  const lobby = q.get('lobby') || undefined;
  return (
    <div className="min-h-screen bg-background">
      <QuizGame mode={mode} difficulty={difficulty} topic={topic} topics={topics} lobbyCode={lobby} />
    </div>
  );
};

export default Play;
