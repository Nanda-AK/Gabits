import { Heart } from "lucide-react";

interface GameHeaderProps {
  hearts: number;
  coins: number;
  progress: number;
}

export const GameHeader = ({ hearts, coins }: GameHeaderProps) => {
  return (
    <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-card via-card/95 to-card backdrop-blur-md border-b-2 border-primary/20 z-50 shadow-xl">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Hearts */}
          <div className="flex items-center gap-3 bg-destructive/10 rounded-2xl px-5 py-3 border-2 border-destructive/30 shadow-lg">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Heart
                  key={i}
                  className={`w-7 h-7 transition-all duration-300 ${
                    i < hearts
                      ? "fill-destructive text-destructive scale-110"
                      : "text-muted-foreground/30 scale-90"
                  }`}
                />
              ))}
            </div>
            <span className="text-lg font-bold text-destructive ml-1">{hearts}</span>
          </div>

          {/* Coins with gold styling */}
          <div className="flex items-center gap-3 bg-gradient-to-br from-accent via-accent/90 to-accent/70 rounded-2xl px-6 py-3 border-2 border-accent shadow-xl shadow-accent/30">
            <span className="text-3xl animate-coin-increment" id="coin-counter">
              🪙
            </span>
            <span className="text-2xl font-black text-amber-900">
              {coins}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
