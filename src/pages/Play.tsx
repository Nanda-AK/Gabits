import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { QuizGame } from "@/components/QuizGame";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const Play = () => {
  const q = useQuery();
  const mode = (q.get("mode") as 'practice' | 'speed' | 'battle-ai') ?? 'practice';
  const difficulty = (q.get("difficulty") as 'easy' | 'moderate' | 'difficult') ?? 'moderate';

  return (
    <div className="min-h-screen bg-background">
      <QuizGame mode={mode} difficulty={difficulty} />
    </div>
  );
};

export default Play;
