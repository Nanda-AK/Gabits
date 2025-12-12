import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [topics, setTopics] = useState<string[]>(['addition', 'subtraction', 'multiplication', 'division']);
  const toggleTopic = (t: string) => setTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const navigate = useNavigate();

  const start = () => {
    const csv = topics.join(',');
    navigate(`/play?mode=practice&difficulty=${difficulty}&topics=${encodeURIComponent(csv)}`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50">
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="container mx-auto px-4 py-10 max-w-xl pl-16 sm:pl-20">
        <Button variant="secondary" className="mb-6 rounded-full" onClick={() => navigate("/modes")}>
          <ArrowLeft className="w-4 h-4 mr-2"/> Back to Modes
        </Button>
        <Card className="p-8 rounded-3xl border-0 bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-xl shadow-xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Setup
            </div>
            <h1 className="text-4xl font-black tracking-tight">Practice</h1>
            <p className="text-muted-foreground">Customize your session</p>
          </div>

          {/* Difficulty Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Select Difficulty</h3>
            <div className="space-y-3">
              <DifficultyButton value="easy" current={difficulty} onPick={setDifficulty}>Easy</DifficultyButton>
              <DifficultyButton value="moderate" current={difficulty} onPick={setDifficulty}>Moderate</DifficultyButton>
              <DifficultyButton value="difficult" current={difficulty} onPick={setDifficulty}>Difficult</DifficultyButton>
            </div>
          </div>

          {/* Topic Selection (Checkboxes) */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Select Topics</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'addition', label: 'Addition' },
                { key: 'subtraction', label: 'Subtraction' },
                { key: 'multiplication', label: 'Multiplication' },
                { key: 'division', label: 'Division' },
                { key: 'fractions', label: 'Fractions' },
                { key: 'algebra', label: 'Algebra' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3.5 p-3.5 rounded-lg border border-gray-200 bg-white/70 hover:bg-gray-50 transition shadow-sm">
                  <Checkbox className="h-5 w-5" checked={topics.includes(key)} onCheckedChange={() => toggleTopic(key)} />
                  <span className="text-sm font-medium">{label}</span>
                </label>
              ))}
            </div>
            {topics.length === 0 && (
              <p className="text-xs text-destructive mt-2">Please select at least one topic</p>
            )}
          </div>

          <Button className="w-full mt-6 rounded-full" onClick={start} disabled={!difficulty || topics.length === 0}>
            Start Practice
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default PracticeSetup;
