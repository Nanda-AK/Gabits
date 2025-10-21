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
    <div className="flex flex-col items-center">
      <div className="relative w-44 h-44 flex items-center justify-center">
        {unlocked && <div className="absolute inset-0 bg-accent/20 rounded-full blur-2xl animate-pulse" />}
        <img
          src="/treasureboximg.png"
          alt="Treasure Chest"
          className={`w-36 h-36 object-contain drop-shadow-2xl transition-transform duration-500 ${
            unlocked ? "animate-chest-bounce" : ""
          }`}
        />
        {showGem && (
          <>
            <div className="absolute -top-6 text-4xl animate-fade-in" style={{ animationDelay: '0.1s' }}>💎</div>
            <div className="absolute -top-4 -left-8 text-3xl animate-fade-in" style={{ animationDelay: '0.2s' }}>✨</div>
            <div className="absolute -top-4 -right-8 text-3xl animate-fade-in" style={{ animationDelay: '0.3s' }}>⭐</div>
          </>
        )}
      </div>
      <div className={`mt-3 text-sm font-bold text-center transition-colors duration-300 ${unlocked ? "text-accent" : "text-muted-foreground"}`}>
        {unlocked ? "🏆 Perfect!" : "Answer All Correctly"}
      </div>
    </div>
  );
}
