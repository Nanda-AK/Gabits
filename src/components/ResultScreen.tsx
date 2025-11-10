import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, RotateCcw, Star, Frown, CheckCircle2, XCircle, Award } from "lucide-react";
import type { Question } from "@/data/questions";
import { useAuth } from "@/contexts/AuthContext";
import { getLocalYMD } from "@/lib/date";
import { getAnyStreak, getDailyStreakAward } from "@/services/rewards";

interface ResultScreenProps {
  coins: number;
  correctAnswers: number;
  onRestart: () => void;
  gameOver?: boolean;
  aiScore?: number;
  opponentName?: string;
  mode?: 'practice' | 'speed' | 'battle-ai';
  practiceRewards?: { coins_awarded: number; gems_awarded: number; streak_after: number; badges_awarded: string[] } | null;
  questions?: Question[];
  results?: boolean[]; // per-question correctness for review (Practice/Speed)
}

export const ResultScreen = ({ coins, correctAnswers, onRestart, gameOver, aiScore, opponentName = "AI Bot", mode, practiceRewards, questions, results }: ResultScreenProps) => {
  const isPerfectScore = correctAnswers === 10;
  const { user, guest } = useAuth();
  const [anyStreak, setAnyStreak] = useState<number | null>(null);
  const [todayAwardMode, setTodayAwardMode] = useState<string | null>(null);

  // Fetch true streak length and who claimed today's daily streak (for transparency)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (mode !== 'practice') return;
      if (!user || guest) return;
      const s = await getAnyStreak(user.id);
      if (!cancelled) setAnyStreak(s?.any_streak ?? null);
      const today = getLocalYMD();
      const award = await getDailyStreakAward(user.id, today);
      if (!cancelled) setTodayAwardMode(award?.claimed_by ?? null);
    })();
    return () => { cancelled = true; };
  }, [mode, user, guest]);

  const displayStreak = (practiceRewards?.streak_after && practiceRewards.streak_after > 0)
    ? practiceRewards.streak_after
    : (anyStreak ?? 0);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl" />
      
      <div className="bg-gradient-to-br from-card to-card/90 rounded-3xl shadow-2xl p-12 max-w-2xl w-full border-2 border-primary/20 text-center animate-scale-in backdrop-blur-sm">
        {gameOver ? (
          <>
            <Frown className="w-24 h-24 mx-auto mb-6 text-destructive" />
            <h1 className="text-4xl font-bold mb-4 text-foreground">Game Over!</h1>
            <p className="text-xl text-muted-foreground mb-8">
              You ran out of hearts. Better luck next time!
            </p>
          </>
        ) : isPerfectScore ? (
          <>
            <Trophy className="w-24 h-24 mx-auto mb-6 text-accent animate-bounce" />
            <h1 className="text-4xl font-bold mb-4 text-foreground">🎉 Perfect Score!</h1>
            <p className="text-xl text-muted-foreground mb-8">
              You're a quiz master! All questions answered correctly!
            </p>
          </>
        ) : (
          <>
            <Star className="w-24 h-24 mx-auto mb-6 text-primary animate-pulse" />
            <h1 className="text-4xl font-bold mb-4 text-foreground">Quiz Complete!</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Great effort! Here's how you did:
            </p>
          </>
        )}

        {/* Stats (Practice + Speed share the same styled layout) */}
        {(mode === 'practice' || mode === 'speed') ? (
          <div className="mb-8">
            <div className="bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl p-6 border-2 border-primary/30 shadow-lg mb-4">
              <div className="text-6xl font-black text-primary mb-2">{correctAnswers}</div>
              <div className="text-sm font-semibold text-foreground">Correct Answers</div>
            </div>
            {/* Rewards Summary styled like Practice */}
            <div className="bg-gradient-to-br from-accent/20 to-accent/10 rounded-2xl p-6 border-2 border-accent/30 shadow-lg">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Award className="w-6 h-6 text-accent" />
                <h3 className="text-xl font-bold text-foreground">Rewards Summary</h3>
              </div>
              <div className="space-y-3 text-left">
                {/* Streak Days (only meaningful in practice) */}
                <div className="flex items-center justify-between p-3 bg-white/50 rounded-lg">
                  <span className="font-semibold text-foreground">Streak Days:</span>
                  <span className="text-2xl font-black text-primary">{mode === 'practice' ? displayStreak : 0}</span>
                </div>
                {/* Coins */}
                <div className="flex items-center justify-between p-3 bg-white/50 rounded-lg">
                  <span className="font-semibold text-foreground">Coins Earned:</span>
                  <span className="text-2xl font-black text-amber-700">+{mode === 'practice' && practiceRewards ? practiceRewards.coins_awarded : coins}</span>
                </div>
                {/* Gems and Badges (practice only) */}
                {mode === 'practice' && practiceRewards?.gems_awarded && practiceRewards.gems_awarded > 0 && (
                  <div className="flex items-center justify-between p-3 bg-white/50 rounded-lg">
                    <span className="font-semibold text-foreground">Gems Earned:</span>
                    <span className="text-2xl font-black text-fuchsia-600">+{practiceRewards.gems_awarded}</span>
                  </div>
                )}
                {mode === 'practice' && practiceRewards?.badges_awarded && practiceRewards.badges_awarded.length > 0 && (
                  <div className="p-3 bg-white/50 rounded-lg">
                    <span className="font-semibold text-foreground block mb-2">Badges Unlocked:</span>
                    <div className="flex flex-wrap gap-2">
                      {practiceRewards.badges_awarded.map(badge => (
                        <span key={badge} className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold">
                          {badge.replace('_', ' ').toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {mode === 'practice' && todayAwardMode && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Daily streak coins for today were claimed by: <span className="font-semibold">{todayAwardMode}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Other modes keep compact grid
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl p-6 border-2 border-primary/30 shadow-lg">
              <div className="text-6xl font-black text-primary mb-2">{correctAnswers}</div>
              <div className="text-sm font-semibold text-foreground">Correct Answers</div>
            </div>
            <div className="bg-gradient-to-br from-accent via-accent/90 to-accent/70 rounded-2xl p-6 border-2 border-accent shadow-lg">
              <div className="flex items-center justify-center gap-3 mb-2">
                <svg width="40" height="40" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="Coins" role="img">
                  <defs>
                    <radialGradient id="goldGradientRS" cx="50%" cy="35%" r="60%">
                      <stop offset="0%" stopColor="#FFF6B7" />
                      <stop offset="45%" stopColor="#FFD54A" />
                      <stop offset="100%" stopColor="#F6A700" />
                    </radialGradient>
                  </defs>
                  <circle cx="32" cy="32" r="28" fill="url(#goldGradientRS)" stroke="#B7791F" strokeWidth="4" />
                  <circle cx="32" cy="24" r="10" fill="rgba(255,255,255,0.22)" />
                  <path d="M16 32h32" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
                </svg>
                <span className="text-6xl font-black text-amber-900">{coins}</span>
              </div>
              <div className="text-sm font-semibold text-amber-900">Total Coins</div>
            </div>
          </div>
        )}

        {/* Final Standings (Battle AI) */}
        {typeof aiScore === 'number' && (
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-3">Final Standings</h3>
            <div className="rounded-2xl border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
                <div className="font-semibold">You</div>
                <div className="font-extrabold">{correctAnswers}</div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="font-semibold text-muted-foreground">{opponentName}</div>
                <div className="font-extrabold text-muted-foreground">{aiScore}</div>
              </div>
            </div>
          </div>
        )}

        {/* Question Review (Practice and Speed) */}
        {(mode === 'practice' || mode === 'speed') && questions && questions.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              Question Review
            </h3>
            <div className="max-h-64 overflow-y-auto space-y-2 rounded-xl border-2 border-muted p-3">
              {questions.map((q, idx) => {
                const userCorrect = !!(results && typeof results[idx] !== 'undefined' ? results[idx] : (idx < correctAnswers));
                return (
                  <div key={idx} className={`flex items-start gap-3 p-2 rounded-lg ${userCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                    {userCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground line-clamp-2">{q.question}</p>
                      <p className="text-xs text-muted-foreground mt-1">Answer: {q.options[q.correctAnswer]}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Performance Message */}
        <div className="mb-8 p-4 bg-muted/50 rounded-2xl">
          <p className="text-foreground font-semibold">
            {correctAnswers >= 9 && "Outstanding! You're a genius! 🌟"}
            {correctAnswers >= 7 && correctAnswers < 9 && "Excellent work! Keep it up! 🎯"}
            {correctAnswers >= 5 && correctAnswers < 7 && "Good job! Practice makes perfect! 💪"}
            {correctAnswers < 5 && !gameOver && "Keep learning, you'll do better next time! 📚"}
            {gameOver && "Don't give up! Try again! 🔄"}
          </p>
        </div>

        {/* Restart Button */}
        <Button
          onClick={onRestart}
          size="lg"
          className="rounded-xl px-12 text-lg bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 text-secondary-foreground font-bold shadow-lg hover:shadow-xl transition-all"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Play Again
        </Button>
      </div>
    </div>
  );
};
