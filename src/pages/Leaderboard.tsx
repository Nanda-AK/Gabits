import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getXpLeaderboard, type XpRow, getUserBalances } from "@/services/rewards";

const Leaderboard = () => {
  const navigate = useNavigate();
  const { user, guest } = useAuth();
  const [rows, setRows] = useState<XpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<{ xp: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setLoading(false); return; }
      setLoading(true);
      try {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const fromStr = `${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,'0')}-${String(from.getDate()).padStart(2,'0')}`;
        const toStr = `${to.getFullYear()}-${String(to.getMonth()+1).padStart(2,'0')}-${String(to.getDate()).padStart(2,'0')}`;
        const top = await getXpLeaderboard(fromStr, toStr, 50);
        if (cancelled) return;
        setRows(top ?? []);
        const myRow = (top ?? []).find(r => r.user_id === user.id);
        if (myRow) {
          setMe({ xp: myRow.xp });
        } else {
          const bal = await getUserBalances(user.id);
          if (!cancelled) setMe(bal ? { xp: bal.xp ?? 0 } : { xp: 0 });
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load leaderboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, guest]);

  const myRank = useMemo(() => {
    if (!user) return null;
    const found = rows.find((r) => r.user_id === user.id);
    return found?.rank ?? null;
  }, [rows, user]);

  const displayName = (user?.user_metadata?.full_name as string)
    || (user?.user_metadata?.name as string)
    || "You";
  const seed = user?.id ?? displayName;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
            <Trophy className="w-7 h-7 text-amber-500"/> Leaderboard
          </h1>
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>

        {guest || !user ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sign in to view the XP leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Monthly XP leaderboard ranks are based on your activity stored in Supabase. Continue with email to join the board.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Top 50 by XP (This Month)</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Loading...</div>
                ) : error ? (
                  <div className="py-6 text-center text-sm text-destructive">{error}</div>
                ) : (
                  <div className="divide-y">
                    {rows.map((p: any) => (
                      <div key={p.user_id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 text-center font-extrabold text-gray-600">{p.rank}</span>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(p.user_id)}`} alt={p.display_name}/>
                            <AvatarFallback>{p.display_name?.slice(0,1)?.toUpperCase() || "U"}</AvatarFallback>
                          </Avatar>
                          <span className="font-semibold">{p.display_name}</span>
                          
                        </div>
                        <div className="font-black text-amber-700">
                          {`${p.xp} XP`}
                        </div>
                      </div>
                    ))}
                    {rows.length === 0 && (
                      <div className="py-6 text-center text-sm text-muted-foreground">No players yet.</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Totals {myRank ? `(Rank #${myRank})` : "(Outside top 50)"} — XP</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center font-extrabold text-indigo-600">{myRank ?? "—"}</span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}`} alt={displayName}/>
                      <AvatarFallback>{displayName.slice(0,1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold">{displayName}</span>
                    
                  </div>
                  <div className="font-black text-amber-700">{`${(me as any)?.xp ?? 0} XP`}</div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
