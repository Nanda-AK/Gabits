import { Button } from "@/components/ui/button";
import { Trophy, RotateCcw, Star, Frown } from "lucide-react";

interface ResultScreenProps {
  coins: number;
  correctAnswers: number;
  onRestart: () => void;
  gameOver?: boolean;
}

export const ResultScreen = ({ coins, correctAnswers, onRestart, gameOver }: ResultScreenProps) => {
  const isPerfectScore = correctAnswers === 10;
  
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

        {/* Stats */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl p-6 border-2 border-primary/30 shadow-lg">
            <div className="text-6xl font-black text-primary mb-2">{correctAnswers}</div>
            <div className="text-sm font-semibold text-foreground">Correct Answers</div>
          </div>
          <div className="bg-gradient-to-br from-accent via-accent/90 to-accent/70 rounded-2xl p-6 border-2 border-accent shadow-lg">
            <div className="flex items-center justify-center gap-3 mb-2">
              <svg
                width="40"
                height="40"
                viewBox="0 0 64 64"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Coins"
                role="img"
              >
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
