interface MonkeyProgressProps {
  progress: number;
  total: number;
}

export const MonkeyProgress = ({ progress, total }: MonkeyProgressProps) => {
  const progressPercentage = (progress / total) * 100;
  
  // Define milestone thresholds
  const milestones = [
    { percent: 75, label: "75%" },
    { percent: 50, label: "50%" },
    { percent: 25, label: "25%" },
    { percent: 10, label: "10%" }
  ];
  
  return (
    <div className="relative flex flex-col items-center scale-100 mt-4 sm:mt-6">
      {/* Diamond at top */}
      <div className="text-2xl sm:text-3xl mb-1 animate-bounce">💎</div>

      <div className="relative w-16 sm:w-20 lg:w-24 h-[220px] sm:h-[280px] lg:h-[320px]">

        {/* Milestone icons aligned at exact percentages to the right of the bar - ALL SAME SIZE */}
        <div className="absolute inset-0 pointer-events-none">
          {/* 75% Platinum bar */}
          <div
            className="absolute left-1/2 ml-3 sm:ml-5 lg:ml-6 translate-y-1/2"
            style={{ bottom: '75%' }}
          >
            <img src="/assets/platinuumimage.png" alt="Platinum" className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 object-contain drop-shadow-lg" />
          </div>
          {/* 50% Gold bar */}
          <div
            className="absolute left-1/2 ml-3 sm:ml-5 lg:ml-6 translate-y-1/2"
            style={{ bottom: '50%' }}
          >
            <img src="/assets/goldimage.png" alt="Gold" className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 object-contain drop-shadow-lg" />
          </div>
          {/* 25% Silver bar */}
          <div
            className="absolute left-1/2 ml-3 sm:ml-5 lg:ml-6 translate-y-1/2"
            style={{ bottom: '25%' }}
          >
            <img src="/assets/silverimage.png" alt="Silver" className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 object-contain drop-shadow-lg" />
          </div>
          {/* 10% Coin marker */}
          <div
            className="absolute left-1/2 ml-3 sm:ml-5 lg:ml-6 translate-y-1/2"
            style={{ bottom: '10%' }}
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 drop-shadow-lg">
              <svg
                width="48"
                height="48"
                viewBox="0 0 64 64"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Coin"
                role="img"
                className="w-full h-full"
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
        </div>

        {/* The Climbing Pole */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-3 sm:w-4 lg:w-5 h-full">
          {/* Pole base */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-muted-foreground/20 to-muted-foreground/10 border border-muted/30" />
          
          {/* Filled progress with percentage labels inside */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-b-full bg-gradient-to-b from-primary via-primary/90 to-primary/80 shadow-lg shadow-primary/40 transition-all duration-700 overflow-hidden"
            style={{ height: `${Math.min(Math.max(progressPercentage, 0), 100)}%` }}
          />

          {/* Percentage labels aligned with rewards, overlayed above pole */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            {milestones.map((milestone) => {
              const isVisible = progressPercentage >= milestone.percent;
              return (
                <div
                  key={milestone.percent}
                  className={`absolute left-1/2 -translate-x-1/2 translate-y-1/2 transition-all duration-500 ${
                    isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                  }`}
                  style={{ bottom: `${milestone.percent}%` }}
                >
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold text-white bg-black/35 border border-white/20 backdrop-blur-[1px] drop-shadow-md">
                    {milestone.label}
                  </span>
                </div>
              );
            })}
          </div>
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
