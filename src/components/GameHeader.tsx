import { Heart, Timer } from "lucide-react";

interface GameHeaderProps {
  hearts: number;
  coins: number;
  progress: number;
  blinkHeart?: boolean;
  coinGain?: { amount: number; id: number } | null;
  onTreasureClick?: () => void;
  overallTime?: number;
  overallTimeLimit?: number;
}

export const GameHeader = ({ hearts, coins, blinkHeart, coinGain, onTreasureClick, overallTime = 0, overallTimeLimit = 600 }: GameHeaderProps) => {
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const timeRemaining = overallTimeLimit - overallTime;
  const isOverallTimeCritical = timeRemaining <= 60; // Last minute warning
  return (
    <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-card via-card/95 to-card backdrop-blur-md border-b-2 border-primary/20 z-50 shadow-xl">
      <div className="container mx-auto px-2 sm:px-3 py-1.5 sm:py-2 lg:py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4 max-w-5xl xl:max-w-6xl mx-auto">
          {/* Hearts */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-destructive/10 rounded-lg sm:rounded-xl px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 lg:py-2.5 border-2 border-destructive/30 shadow-lg">
            <div className="flex items-center gap-0.5 sm:gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="relative">
                  <Heart
                    className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 transition-all duration-300 ${
                      i < hearts
                        ? `${blinkHeart && i === hearts - 1 ? "animate-heart-blink drop-shadow" : ""} fill-destructive text-destructive scale-110`
                        : "text-muted-foreground/30 scale-90"
                    }`}
                  />
                  {blinkHeart && i === hearts - 1 && i < hearts && (
                    <svg
                      className="absolute inset-0 m-auto w-5 h-5 text-destructive animate-pulse-error"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M6 2l3 6-3 4 4-2 3 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
            <span className="text-sm sm:text-base font-bold text-destructive ml-0.5 sm:ml-1">{hearts}</span>
          </div>
          {/* Overall Timer - Clean minimal design with time limit indicator */}
          <div className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 border-2 shadow-sm transition-all duration-300 ${
            isOverallTimeCritical 
              ? 'bg-gradient-to-br from-destructive/15 to-destructive/5 border-destructive/40 animate-pulse' 
              : 'bg-gradient-to-br from-accent/10 to-accent/5 border-accent/30'
          }`}>
            <Timer className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${
              isOverallTimeCritical ? 'text-destructive' : 'text-accent'
            }`} />
            <div className="flex flex-col items-center">
              <span className={`text-xs sm:text-sm font-bold tabular-nums transition-colors ${
                isOverallTimeCritical ? 'text-destructive' : 'text-foreground'
              }`}>
                {formatTime(timeRemaining)}
              </span>
              {isOverallTimeCritical && (
                <span className="text-[8px] text-destructive/70 font-semibold">Time Left!</span>
              )}
            </div>
          </div>

          {/* Chest + Coins */}
          <div className="relative flex items-center gap-1.5 sm:gap-2 lg:gap-3">
            <button
              onClick={onTreasureClick}
              className="relative group cursor-pointer hover:scale-110 transition-transform duration-200 active:scale-95"
              aria-label="View Achievements"
            >
              <img
                src="/treasureboximg.png"
                alt="Treasure Chest"
                className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 object-contain drop-shadow-lg"
              />
              <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <span id="coin-counter" className="inline-flex items-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 64 64"
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 animate-coin-increment"
                aria-label="Coins"
                role="img"
              >
                <defs>
                  <radialGradient id="goldGradient" cx="50%" cy="35%" r="60%">
                    <stop offset="0%" stopColor="#FFF6B7" />
                    <stop offset="45%" stopColor="#FFD54A" />
                    <stop offset="100%" stopColor="#F6A700" />
                  </radialGradient>
                </defs>
                <circle cx="32" cy="32" r="28" fill="url(#goldGradient)" stroke="#B7791F" strokeWidth="4" />
                <circle cx="32" cy="24" r="10" fill="rgba(255,255,255,0.25)" />
                <path d="M16 32h32" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
              </svg>
            </span>
            <span className="text-base sm:text-lg lg:text-xl font-black text-amber-900">
              {coins}
            </span>
            {coinGain && coinGain.amount > 0 && (
              <div className="absolute -bottom-4 right-0 px-2 py-0.5 text-xs font-extrabold rounded-full bg-amber-100 text-amber-800 border border-amber-300 shadow">
                +{coinGain.amount}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
