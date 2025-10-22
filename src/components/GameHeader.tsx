import { Heart } from "lucide-react";

interface GameHeaderProps {
  hearts: number;
  coins: number;
  progress: number;
  blinkHeart?: boolean;
  coinGain?: { amount: number; id: number } | null;
}

export const GameHeader = ({ hearts, coins, blinkHeart, coinGain }: GameHeaderProps) => {
  return (
    <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-card via-card/95 to-card backdrop-blur-md border-b-2 border-primary/20 z-50 shadow-xl">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Hearts */}
          <div className="flex items-center gap-3 bg-destructive/10 rounded-2xl px-5 py-3 border-2 border-destructive/30 shadow-lg">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="relative">
                  <Heart
                    className={`w-7 h-7 transition-all duration-300 ${
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
            <span className="text-lg font-bold text-destructive ml-1">{hearts}</span>
          </div>
          {/* Chest + Coins */}
          <div className="relative flex items-center gap-4">
            <img
              src="/treasureboximg.png"
              alt="Treasure Chest"
              className="w-10 h-10 object-contain drop-shadow"
            />
            <span id="coin-counter" className="inline-flex items-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 64 64"
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8 animate-coin-increment"
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
            <span className="text-2xl font-black text-amber-900">
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
