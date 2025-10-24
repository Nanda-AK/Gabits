interface MonkeyProgressProps {
  progress: number;
  total: number;
}

export const MonkeyProgress = ({ progress, total }: MonkeyProgressProps) => {
  const progressPercentage = (progress / total) * 100;
  
  return (
    <div className="relative flex flex-col items-center scale-105 mt-4 sm:mt-6">
      {/* Diamond at top */}
      <div className="text-2xl sm:text-4xl mb-1 animate-bounce">💎</div>

      <div className="relative w-16 sm:w-20 lg:w-24 h-[220px] sm:h-[280px] lg:h-[320px]">
        {/* Percent labels on the left */}
        <div className="absolute left-0 top-3 bottom-4 flex flex-col justify-between text-muted-foreground/80 text-[10px] sm:text-xs font-semibold select-none">
          <span className="translate-x-[-12px] sm:translate-x-[-14px]">75%</span>
          <span className="translate-x-[-12px] sm:translate-x-[-14px]">50%</span>
          <span className="translate-x-[-12px] sm:translate-x-[-14px]">25%</span>
          <span className="translate-x-[-12px] sm:translate-x-[-14px]">10%</span>
        </div>

        {/* Milestone icons to the right of the bar with a clear gap */}
        <div className="absolute left-1/2 top-4 bottom-6 flex flex-col justify-between items-center gap-3 sm:gap-5 lg:gap-7 ml-3 sm:ml-5 lg:ml-6">
          {/* 75% Platinum bar */}
          <img src="/assets/platinuumimage.png" alt="Platinum" className="w-9 h-6 sm:w-10 sm:h-6 lg:w-12 lg:h-10 object-contain drop-shadow" />
          {/* 50% Gold bar */}
          <img src="/assets/goldimage.png" alt="Gold" className="w-9 h-6 sm:w-10 sm:h-6 lg:w-12 lg:h-10 object-contain drop-shadow" />
          {/* 25% Silver bar */}
          <img src="/assets/silverimage.png" alt="Silver" className="w-8 h-5 sm:w-10 sm:h-6 lg:w-12 lg:h-7 object-contain drop-shadow" />
          {/* 10% Coin marker */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 drop-shadow">
            <svg
              width="45"
              height="45"
              viewBox="0 0 64 64"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Coin"
              role="img"
              className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-10"
            >
              <defs>
                <radialGradient id="goldGradientBar" cx="50%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="#FFF6B7" />
                  <stop offset="45%" stopColor="#FFD54A" />
                  <stop offset="100%" stopColor="#F6A700" />
                </radialGradient>
              </defs>
              <circle cx="32" cy="32" r="28" fill="url(#goldGradientBar)" stroke="#B7791F" strokeWidth="4" />
              <circle cx="32" cy="24" r="10" fill="rgba(255,255,255,0.22)" />
              <path d="M16 32h32" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* The Climbing Pole */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-3 sm:w-4 lg:w-5 h-full">
          {/* Pole base */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-muted-foreground/20 to-muted-foreground/10 border border-muted/30" />
          {/* Filled progress */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-b-full bg-gradient-to-b from-primary via-primary/90 to-primary/80 shadow-lg shadow-primary/40 transition-all duration-700"
            style={{ height: `${Math.min(Math.max(progressPercentage, 0), 100)}%` }}
          />
        </div>
      </div>

      {/* Base label */}
      <div className="mt-1 sm:mt-2 flex flex-col items-center">
        <div className="w-14 sm:w-16 h-1.5 sm:h-2 bg-gradient-to-r from-muted via-muted-foreground/20 to-muted rounded-full" />
        <div className="text-[9px] sm:text-[10px] font-bold text-muted-foreground mt-1">Day Bar</div>
      </div>
    </div>
  );
};
