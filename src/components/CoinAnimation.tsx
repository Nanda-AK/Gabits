interface CoinAnimationProps {
  amount: number;
}

export const CoinAnimation = ({ amount }: CoinAnimationProps) => {
  return (
    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50">
      <div className="flex items-center gap-3 animate-coin-fly drop-shadow-2xl">
        <div className="text-5xl">🪙</div>
        <span className="text-3xl font-black text-accent drop-shadow-lg" style={{
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>+{amount}</span>
      </div>
    </div>
  );
};
