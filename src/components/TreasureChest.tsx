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
        {/* Glow effect when unlocked */}
        {unlocked && <div className="absolute inset-0 bg-accent/20 rounded-full blur-2xl animate-pulse" />}

        {/* Chest */}
        <div className={`relative transition-all duration-500 drop-shadow-2xl ${unlocked ? "animate-chest-bounce" : ""}`}>
          {unlocked ? (
            // Open chest with visible treasure
            <svg width="140" height="140" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg" className="w-32 h-32">
              {/* Lid */}
              <g transform="rotate(-14 70 40)">
                <rect x="20" y="18" width="100" height="30" rx="8" fill="#A76B39" stroke="#5C3A21" strokeWidth="4" />
                <rect x="20" y="30" width="100" height="6" fill="#D6A74A" opacity="0.6" />
                {/* Plank lines */}
                <path d="M40 18 v30 M60 18 v30 M80 18 v30 M100 18 v30" stroke="#7A4E2A" strokeWidth="2" opacity="0.5" />
              </g>
              {/* Base */}
              <rect x="20" y="55" width="100" height="60" rx="10" fill="#8B5E34" stroke="#5C3A21" strokeWidth="4" />
              {/* Planks */}
              <path d="M20 75 h100 M20 95 h100" stroke="#7A4E2A" strokeWidth="3" opacity="0.6" />
              {/* Straps */}
              <rect x="45" y="55" width="10" height="60" fill="#5C3A21" opacity="0.9" />
              <rect x="85" y="55" width="10" height="60" fill="#5C3A21" opacity="0.9" />
              {/* Gold band */}
              <rect x="20" y="78" width="100" height="10" fill="#CDA434" />
              {/* Lock */}
              <rect x="66" y="73" width="8" height="18" rx="2" fill="#E5C463" stroke="#946D28" strokeWidth="2" />
              <circle cx="70" cy="82" r="2" fill="#8B6A1E" />
              {/* Treasure coins */}
              <g opacity="0.95">
                <circle cx="50" cy="60" r="6" fill="#FFD54A" stroke="#B8891E" />
                <circle cx="60" cy="58" r="5" fill="#FFE07D" stroke="#B8891E" />
                <circle cx="80" cy="60" r="6" fill="#FFD54A" stroke="#B8891E" />
                <circle cx="90" cy="58" r="5" fill="#FFE07D" stroke="#B8891E" />
              </g>
              {/* Glow */}
              <ellipse cx="70" cy="62" rx="30" ry="12" fill="#FFD54A" opacity="0.35" />
            </svg>
          ) : (
            // Closed chest
            <svg width="140" height="140" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg" className="w-32 h-32">
              {/* Lid */}
              <rect x="20" y="25" width="100" height="30" rx="8" fill="#A76B39" stroke="#5C3A21" strokeWidth="4" />
              <rect x="20" y="37" width="100" height="6" fill="#D6A74A" opacity="0.6" />
              {/* Plank lines */}
              <path d="M40 25 v30 M60 25 v30 M80 25 v30 M100 25 v30" stroke="#7A4E2A" strokeWidth="2" opacity="0.5" />
              {/* Base */}
              <rect x="20" y="55" width="100" height="60" rx="10" fill="#8B5E34" stroke="#5C3A21" strokeWidth="4" />
              {/* Planks */}
              <path d="M20 75 h100 M20 95 h100" stroke="#7A4E2A" strokeWidth="3" opacity="0.6" />
              {/* Straps */}
              <rect x="45" y="55" width="10" height="60" fill="#5C3A21" opacity="0.9" />
              <rect x="85" y="55" width="10" height="60" fill="#5C3A21" opacity="0.9" />
              {/* Gold band */}
              <rect x="20" y="78" width="100" height="10" fill="#CDA434" />
              {/* Lock */}
              <rect x="66" y="73" width="8" height="18" rx="2" fill="#E5C463" stroke="#946D28" strokeWidth="2" />
              <circle cx="70" cy="82" r="2" fill="#8B6A1E" />
            </svg>
          )}
        </div>

        {/* Gems/Sparkles that appear when unlocked */}
        {showGem && (
          <>
            <div className="absolute -top-6 text-4xl animate-fade-in" style={{ animationDelay: '0.1s' }}>💎</div>
            <div className="absolute -top-4 -left-8 text-3xl animate-fade-in" style={{ animationDelay: '0.2s' }}>✨</div>
            <div className="absolute -top-4 -right-8 text-3xl animate-fade-in" style={{ animationDelay: '0.3s' }}>⭐</div>
          </>
        )}
      </div>

      {/* Label below chest to avoid overlap */}
      <div className={`mt-3 text-sm font-bold text-center transition-colors duration-300 ${unlocked ? "text-accent" : "text-muted-foreground"}`}>
        {unlocked ? "🏆 Perfect!" : "Answer All Correctly"}
      </div>
    </div>
  );
}
