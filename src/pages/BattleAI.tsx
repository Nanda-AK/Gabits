import { useState, useEffect, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Sparkles } from "lucide-react";
import { aiTaunt } from "@/services/openrouter";

const DiffBtn: React.FC<{ v: 'easy' | 'moderate' | 'difficult'; cur: string; onPick: (v: any) => void; children?: ReactNode }> = ({ v, cur, onPick, children }) => (
  <Button variant={cur === v ? 'default' : 'outline'} className="w-full h-12 text-lg" onClick={() => onPick(v)}>
    {children}
  </Button>
);

const BattleAI = () => {
  const [difficulty, setDifficulty] = useState<'easy' | 'moderate' | 'difficult' | ''>('');
  const [taunt, setTaunt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    aiTaunt().then(t => { if (alive) setTaunt(t); }).finally(() => setLoading(false));
    return () => { alive = false; };
  }, []);

  const start = () => navigate(`/play?mode=battle-ai&difficulty=${difficulty}`);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50">
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-purple-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="container mx-auto px-4 py-10 max-w-xl">
        <Button variant="secondary" className="mb-6 rounded-full" onClick={() => navigate("/modes/compete")}> <ArrowLeft className="w-4 h-4 mr-2"/> Back to Compete</Button>
        <Card className="p-8 rounded-3xl border-0 bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-xl shadow-xl space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Versus AI
            </div>
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="rounded-xl p-3 bg-primary/10 text-primary"><Bot className="w-6 h-6"/></div>
              <h1 className="text-4xl font-black">Battle AI</h1>
            </div>
            <p className="text-muted-foreground">{loading ? "Summoning your rival..." : taunt}</p>
          </div>
          <div>
            <p className="text-sm mb-2">Select AI Type</p>
            <div className="space-y-3">
              <DiffBtn v="easy" cur={difficulty} onPick={setDifficulty}>Steady AI</DiffBtn>
              <DiffBtn v="moderate" cur={difficulty} onPick={setDifficulty}>Smart AI</DiffBtn>
              <DiffBtn v="difficult" cur={difficulty} onPick={setDifficulty}>Speed AI</DiffBtn>
            </div>
          </div>
          <Button className="w-full rounded-full" onClick={start} disabled={!difficulty}>Start Battle</Button>
        </Card>
      </div>
    </div>
  );
};

export default BattleAI;
