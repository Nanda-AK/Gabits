import { useState, useEffect } from "react";

interface TreasureChestProps {
  unlocked: boolean;
}

export const TreasureChest = ({ unlocked }: TreasureChestProps) => {
  const [showGem, setShowGem] = useState(false);

  useEffect(() => {
    if (unlocked) {
      setTimeout(() => setShowGem(true), 300);
    } else {
      setShowGem(false);
    }
  }, [unlocked]);

  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      {/* Glow effect when unlocked */}
      {unlocked && (
        <div className="absolute inset-0 bg-accent/20 rounded-full blur-2xl animate-pulse" />
      )}
      
      {/* Chest */}
      <div 
        className={`relative text-8xl transition-all duration-500 drop-shadow-2xl ${
          unlocked ? "animate-chest-bounce" : "grayscale"
        }`}
      >
        {unlocked ? "🎁" : "🔒"}
      </div>
      
      {/* Gems/Sparkles that appear when unlocked */}
      {showGem && (
        <>
          <div className="absolute -top-6 text-4xl animate-fade-in" style={{ animationDelay: '0.1s' }}>
            💎
          </div>
          <div className="absolute -top-4 -left-8 text-3xl animate-fade-in" style={{ animationDelay: '0.2s' }}>
            ✨
          </div>
          <div className="absolute -top-4 -right-8 text-3xl animate-fade-in" style={{ animationDelay: '0.3s' }}>
            ⭐
          </div>
        </>
      )}
      
      {/* Label */}
      <div className={`absolute -bottom-10 text-sm font-bold text-center w-full transition-colors duration-300 ${
        unlocked ? "text-accent" : "text-muted-foreground"
      }`}>
        {unlocked ? "🏆 Perfect!" : "Answer All Correctly"}
      </div>
    </div>
  );
};
