import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Award, Medal, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

function useSnapshot() {
  const [coins, setCoins] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    try {
      setCoins(Number(localStorage.getItem("player:coins") || "0"));
      setCorrect(Number(localStorage.getItem("player:lastProgressCorrect") || "0"));
      setTotal(Number(localStorage.getItem("player:lastProgressTotal") || "0"));
    } catch {}
  }, []);
  return { coins, correct, total };
}

const Treasure = () => {
  const navigate = useNavigate();
  const { coins, correct, total } = useSnapshot();
  const pct = useMemo(() => (total > 0 ? (correct / total) * 100 : 0), [correct, total]);

  const achievements = [
    { icon: <Medal className="w-10 h-10 text-amber-600" />, name: "10% Progress", description: "+5 Coins", unlocked: pct >= 10, image: null },
    { icon: null, name: "Silver Bar", description: "25% Complete", unlocked: pct >= 25, image: "/assets/silverimage.png" },
    { icon: null, name: "Gold Bar", description: "50% Complete", unlocked: pct >= 50, image: "/assets/goldimage.png" },
    { icon: null, name: "Platinum Bar", description: "75% Complete", unlocked: pct >= 75, image: "/assets/platinuumimage.png" },
    { icon: <Trophy className="w-10 h-10 text-blue-400" />, name: "Diamond", description: "100% Complete!", unlocked: pct >= 100, image: null },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-white">
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent flex items-center gap-2">
            <img src="/treasureboximg.png" className="w-8 h-8"/> My Treasure
          </h1>
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-2">{correct}/{total} correct</div>
              <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Coins</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Coins className="w-8 h-8 text-amber-600" />
              <div>
                <div className="text-2xl font-black text-amber-900">{coins}</div>
                <div className="text-xs text-amber-700">Wallet balance</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Achievements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {achievements.map((a) => (
                <div key={a.name} className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${a.unlocked ? 'bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/40' : 'bg-muted/20 border-muted/30 opacity-40 grayscale'}`}>
                  {a.unlocked && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                      <Award className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="mb-2">
                    {a.image ? (
                      <img src={a.image} alt={a.name} className="w-16 h-12 object-contain drop-shadow" />
                    ) : a.icon ? (
                      <div className="w-16 h-12 flex items-center justify-center">{a.icon}</div>
                    ) : (
                      <div className="w-16 h-12 text-4xl flex items-center justify-center">💎</div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold">{a.name}</div>
                    <div className="text-[10px] text-muted-foreground">{a.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Treasure;
