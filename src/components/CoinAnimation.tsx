import { useEffect, useRef, useState } from "react";

interface CoinAnimationProps {
  amount: number;
}

export const CoinAnimation = ({ amount }: CoinAnimationProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const coinRef = useRef<HTMLDivElement | null>(null);
  const [start, setStart] = useState<{ left: number; top: number } | null>(null);
  const [delta, setDelta] = useState<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const source = document.getElementById("coin-source");
    const target = document.getElementById("coin-counter");
    if (!source || !target) return;

    const s = source.getBoundingClientRect();
    const t = target.getBoundingClientRect();

    const startX = s.left + s.width / 2;
    const startY = s.top + s.height / 2;
    const endX = t.left + t.width / 2;
    const endY = t.top + t.height / 2;

    setStart({ left: startX, top: startY });
    setDelta({ dx: endX - startX, dy: endY - startY });
  }, []);

  useEffect(() => {
    if (!coinRef.current || !delta) return;
    const duration = 2400;
    const anim = coinRef.current.animate(
      [
        { offset: 0, transform: "translate(0, 0) scale(1) rotate(0deg)", opacity: 1 },
        { offset: 0.8, transform: `translate(${delta.dx * 0.7}px, ${delta.dy * 0.7}px) scale(0.85) rotate(220deg)`, opacity: 1 },
        { offset: 1, transform: `translate(${delta.dx}px, ${delta.dy}px) scale(0.5) rotate(360deg)`, opacity: 0 }
      ],
      {
        duration,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards"
      }
    );
    return () => anim.cancel();
  }, [delta]);

  if (!start) return null;

  return (
    <div
      ref={wrapperRef}
      className="fixed pointer-events-none z-[80]"
      style={{ left: start.left, top: start.top, transform: "translate(-50%, -50%)" }}
    >
      <div ref={coinRef} className="flex items-center gap-2 drop-shadow-2xl">
        <div className="w-10 h-10">
          <svg
            width="40"
            height="40"
            viewBox="0 0 64 64"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Coin"
            role="img"
            className="w-10 h-10"
          >
            <defs>
              <radialGradient id="goldGradientAnim" cx="50%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#FFF6B7" />
                <stop offset="45%" stopColor="#FFD54A" />
                <stop offset="100%" stopColor="#F6A700" />
              </radialGradient>
            </defs>
            <circle cx="32" cy="32" r="28" fill="url(#goldGradientAnim)" stroke="#B7791F" strokeWidth="4" />
            <circle cx="32" cy="24" r="10" fill="rgba(255,255,255,0.22)" />
            <path d="M16 32h32" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
          </svg>
        </div>
        <span
          className="text-2xl font-black text-amber-600 drop-shadow-lg"
          style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}
        >
          +{amount}
        </span>
      </div>
    </div>
  );
};
