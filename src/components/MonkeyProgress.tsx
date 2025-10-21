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
      <div className="relative w-6 h-[450px]">
        {/* Pole base */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-muted-foreground/20 to-muted-foreground/10 border border-muted/30" />
        {/* Filled progress */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-b-full bg-gradient-to-b from-primary via-primary/90 to-primary/80 shadow-lg shadow-primary/40 transition-all duration-700"
          style={{ height: `${Math.min(Math.max(progressPercentage, 0), 100)}%` }}
        />
        {/* Climbing Monkey */}
        <div
          className="absolute left-1/2 -translate-x-1/2 transition-all duration-700 ease-out text-5xl z-10 drop-shadow-lg"
          style={{ bottom: `${Math.max(progressPercentage - 6, 0)}%` }}
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
