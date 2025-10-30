import { Button } from "@/components/ui/button";
import { Winner } from "@/services/battle";

interface Row {
  index: number;
  student: { correct: boolean; timeMs: number };
  ai: { correct: boolean; timeMs: number };
  winner: Winner;
}

interface BattleSummaryProps {
  aiTypeLabel: string;
  studentName?: string;
  studentPoints: number;
  aiPoints: number;
  rows: Row[];
  onRestart: () => void;
}

function fmtTime(ms: number) {
  const s = Math.max(0, Math.round(ms / 100) / 10); // 0.1s precision
  return `${s.toFixed(1)}s`;
}

export const BattleSummary = ({ aiTypeLabel, studentName = "You", studentPoints, aiPoints, rows, onRestart }: BattleSummaryProps) => {
  const youWin = studentPoints > aiPoints;
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-start justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl" />

      <div className="w-full max-w-4xl bg-gradient-to-br from-card to-card/90 rounded-3xl shadow-2xl border-2 border-primary/20 p-5 sm:p-8 lg:p-10 backdrop-blur-sm animate-slide-up">
        <div className="text-center mb-6">
          <h2 className="text-3xl sm:text-4xl font-black text-foreground mb-1">Quiz Complete!</h2>
          <p className="text-muted-foreground">Battle AI — {aiTypeLabel} Vs {studentName}</p>
        </div>

        <div className="text-center mb-8">
          <div className="text-2xl sm:text-3xl font-extrabold">
            {youWin ? `${studentName} won against ${aiTypeLabel}` : `${aiTypeLabel} won against ${studentName}`}
            <span className="text-muted-foreground"> by </span>
            <span className="text-primary">{studentPoints}:{aiPoints}</span>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">Collectable reward unlocked</div>
        </div>

        <div className="rounded-2xl overflow-hidden border">
          <div className="grid grid-cols-4 bg-muted/50 text-xs sm:text-sm font-semibold text-muted-foreground">
            <div className="px-3 py-2">Q#</div>
            <div className="px-3 py-2">AI</div>
            <div className="px-3 py-2">{studentName}</div>
            <div className="px-3 py-2">Winner</div>
          </div>
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.index} className="grid grid-cols-4 text-xs sm:text-sm">
                <div className="px-3 py-2 font-semibold">Q{r.index + 1}</div>
                <div className="px-3 py-2">
                  {r.ai.correct ? (
                    <span className="text-emerald-700 font-semibold">Correct</span>
                  ) : (
                    <span className="text-rose-700 font-semibold">Wrong</span>
                  )}
                  <span className="text-muted-foreground ml-2">{fmtTime(r.ai.timeMs)}</span>
                </div>
                <div className="px-3 py-2">
                  {r.student.correct ? (
                    <span className="text-emerald-700 font-semibold">Correct</span>
                  ) : (
                    <span className="text-rose-700 font-semibold">Wrong</span>
                  )}
                  <span className="text-muted-foreground ml-2">{fmtTime(r.student.timeMs)}</span>
                </div>
                <div className="px-3 py-2 font-bold">
                  {r.winner === 'student' ? studentName : r.winner === 'ai' ? aiTypeLabel : '-'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Button onClick={onRestart} className="rounded-xl px-10">Play Again</Button>
        </div>
      </div>
    </div>
  );
};
