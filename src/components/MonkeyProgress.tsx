interface MonkeyProgressProps {
  progress: number;
  total: number;
}

export const MonkeyProgress = ({ progress, total }: MonkeyProgressProps) => {
  const progressPercentage = (progress / total) * 100;
  
  return (
    <div className="relative flex flex-col items-center">
      {/* Trophy/Flag at top */}
      <div className="text-5xl mb-2 animate-bounce">
        🏆
      </div>
      
      {/* The Climbing Pole */}
      <div className="relative w-6 h-[450px] flex flex-col items-center">
        {/* Pole segments */}
        <div className="absolute inset-0 flex flex-col justify-between">
          {Array.from({ length: total }).map((_, i) => {
            const segmentHeight = 100 / total;
            const isReached = progress > i;
            return (
              <div
                key={i}
                className="relative"
                style={{ height: `${segmentHeight}%` }}
              >
                {/* Pole segment */}
                <div className={`w-6 h-full rounded-sm transition-all duration-500 ${
                  isReached 
                    ? "bg-gradient-to-b from-primary via-primary/90 to-primary/80 shadow-lg shadow-primary/50" 
                    : "bg-gradient-to-b from-muted-foreground/20 to-muted-foreground/10"
                }`} />
                
                {/* Notch/grip on pole */}
                {i < total - 1 && (
                  <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full transition-colors duration-500 ${
                    isReached ? "bg-primary/60" : "bg-muted-foreground/30"
                  }`} />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Climbing Monkey */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 transition-all duration-700 ease-out text-5xl z-10 drop-shadow-lg"
          style={{ 
            bottom: `${Math.max(progressPercentage - 8, 0)}%`,
            transform: `translate(-50%, 0) ${progressPercentage > 0 ? 'scaleX(-1)' : 'scaleX(1)'}`,
          }}
        >
          🐵
        </div>
      </div>
      
      {/* Ground/Base */}
      <div className="mt-2 flex flex-col items-center">
        <div className="w-20 h-3 bg-gradient-to-r from-muted via-muted-foreground/20 to-muted rounded-full" />
        <div className="text-xs font-bold text-muted-foreground mt-2">
          {progress}/{total}
        </div>
      </div>
    </div>
  );
};
