interface MonkeyProgressProps {
  progress: number;
  total: number;
}

export const MonkeyProgress = ({ progress, total }: MonkeyProgressProps) => {
  const progressPercentage = (progress / total) * 100;
  
  return (
    <div className="relative flex flex-col items-center">
      {/* Diamond at top */}
      <div className="text-5xl mb-2 animate-bounce">💎</div>

      <div className="relative w-28 h-[460px]">
        {/* Percent labels on the left */}
        <div className="absolute left-0 top-4 bottom-6 flex flex-col justify-between text-muted-foreground/80 text-sm font-semibold select-none">
          <span className="translate-x-[-18px]">75%</span>
          <span className="translate-x-[-18px]">50%</span>
          <span className="translate-x-[-18px]">25%</span>
          <span className="translate-x-[-18px]">10%</span>
        </div>

        {/* Milestone icons to the right of the bar with a clear gap */}
        <div className="absolute left-1/2 top-6 bottom-10 flex flex-col justify-between items-center gap-12 ml-8">
          {/* 75% Platinum bar */}
          <img src="/assets/platinuumimage.png" alt="Platinum" className="w-16 h-9 object-contain drop-shadow" />
          {/* 50% Gold bar */}
          <img src="/assets/goldimage.png" alt="Gold" className="w-16 h-9 object-contain drop-shadow" />
          {/* 25% Silver bar */}
          <img src="/assets/silverimage.png" alt="Silver" className="w-16 h-9 object-contain drop-shadow" />
          {/* 10% Coin marker */}
          <img src="/assets/goldimage.png" alt="Coin" className="w-12 h-12 object-contain drop-shadow" />
        </div>

        {/* The Climbing Pole */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-6 h-full">
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
      <div className="mt-3 flex flex-col items-center">
        <div className="w-20 h-3 bg-gradient-to-r from-muted via-muted-foreground/20 to-muted rounded-full" />
        <div className="text-xs font-bold text-muted-foreground mt-2">Day Bar</div>
      </div>
    </div>
  );
};
