import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";

type DifficultyButtonProps = {
  value: 'easy' | 'moderate' | 'difficult';
  current: string;
  onPick: (v: any) => void;
  children?: React.ReactNode;
};

const DifficultyButton = ({ value, current, onPick, children }: DifficultyButtonProps) => (
  <Button variant={current === value ? 'default' : 'outline'} className="w-full h-12 text-lg" onClick={() => onPick(value)}>
    {children}
  </Button>
);

const PracticeSetup = () => {
  const [difficulty, setDifficulty] = useState<'easy' | 'moderate' | 'difficult' | ''>('');
  const navigate = useNavigate();

  const start = () => navigate(`/play?mode=practice&difficulty=${difficulty}`);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50">
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="container mx-auto px-4 py-10 max-w-xl">
        <Button variant="secondary" className="mb-6 rounded-full" onClick={() => navigate("/modes/solo")}> <ArrowLeft className="w-4 h-4 mr-2"/> Back to Solo</Button>
        <Card className="p-8 rounded-3xl border-0 bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-xl shadow-xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Setup
            </div>
            <h1 className="text-4xl font-black tracking-tight">Practice</h1>
            <p className="text-muted-foreground">Select Difficulty</p>
          </div>
          <div className="space-y-3">
            <DifficultyButton value="easy" current={difficulty} onPick={setDifficulty}>Easy</DifficultyButton>
            <DifficultyButton value="moderate" current={difficulty} onPick={setDifficulty}>Moderate</DifficultyButton>
            <DifficultyButton value="difficult" current={difficulty} onPick={setDifficulty}>Difficult</DifficultyButton>
          </div>
          <Button className="w-full mt-6 rounded-full" onClick={start} disabled={!difficulty}>Start Practice</Button>
        </Card>
      </div>
    </div>
  );
};

export default PracticeSetup;
