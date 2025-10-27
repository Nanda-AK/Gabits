import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { QuizGame } from "@/components/QuizGame";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const Play = () => {
  const q = useQuery();
  const navigate = useNavigate();
  const mode = (q.get("mode") as 'practice' | 'speed' | 'battle-ai') ?? 'practice';
  const difficulty = (q.get("difficulty") as 'easy' | 'moderate' | 'difficult') ?? 'moderate';

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-3">
        <Button variant="secondary" className="rounded-full" onClick={() => navigate(-1)}> <ArrowLeft className="w-4 h-4 mr-2"/> Back</Button>
      </div>
      <QuizGame mode={mode} difficulty={difficulty} />
    </div>
  );
};

export default Play;
