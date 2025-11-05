import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getLeaderboard, getMyTotals, type LeaderboardRow } from "@/services/leaderboard";
import { getSpeedLeaderboard, getMySpeedTotals, type SpeedLeaderboardRow } from "@/services/speed";
import { getXpLeaderboard, type XpRow } from "@/services/rewards";

const Leaderboard = () => {
  const navigate = useNavigate();
  const { user, guest } = useAuth();
  const [tab, setTab] = useState<'global' | 'speed' | 'xp'>('global');
  const [rows, setRows] = useState<LeaderboardRow[] | SpeedLeaderboardRow[] | XpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || guest) { setLoading(false); return; }
      setLoading(true);
      try {
        if (tab === 'global') {
          const [top, mine] = await Promise.all([
            getLeaderboard(50),
            getMyTotals(user.id)
          ]);
          if (cancelled) return;
          setRows(top ?? []);
          setMe(mine);
        } else if (tab === 'speed') {
          const [top, mine] = await Promise.all([
            getSpeedLeaderboard(50),
            getMySpeedTotals(user.id)
          ]);
          if (cancelled) return;
          setRows(top ?? []);
          setMe(mine);
        } else if (tab === 'xp') {
          // current local month window
          const now = new Date();
          const from = new Date(now.getFullYear(), now.getMonth(), 1);
          const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          const fromStr = `${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,'0')}-${String(from.getDate()).padStart(2,'0')}`;
          const toStr = `${to.getFullYear()}-${String(to.getMonth()+1).padStart(2,'0')}-${String(to.getDate()).padStart(2,'0')}`;
          const top = await getXpLeaderboard(fromStr, toStr, 50);
          if (cancelled) return;
          setRows(top ?? []);
          setMe((top ?? []).find(r => (r as any).user_id === user.id) ?? null);
        }
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load leaderboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, guest, tab]);

  const myRank = useMemo(() => {
    if (!user) return null;
    const found = (rows as any[]).find(r => r.user_id === user.id);
    return found?.rank ?? null;
  }, [rows, user]);

  const displayName = me?.display_name ?? (user?.email ?? "You");
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

        {!guest && user && (
          <div className="flex gap-2 mb-4">
            <Button variant={tab === 'global' ? 'default' : 'outline'} className="rounded-full" onClick={() => setTab('global')}>Global</Button>
            <Button variant={tab === 'speed' ? 'default' : 'outline'} className="rounded-full" onClick={() => setTab('speed')}>Speed</Button>
        <Button variant={tab === 'xp' ? 'default' : 'outline'} className="rounded-full" onClick={() => setTab('xp')}>XP</Button>
          </div>
        )}

        {guest || !user ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sign in to view the global leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Leaderboard ranks are based on real user totals stored in Supabase. Continue with email to join the board.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Top 50 Miners</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Loading...</div>
                ) : error ? (
                  <div className="py-6 text-center text-sm text-destructive">{error}</div>
                ) : (
                  <div className="divide-y">
                    {(rows as any[]).map((p: any) => (
                      <div key={p.user_id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 text-center font-extrabold text-gray-600">{p.rank}</span>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(p.user_id)}`} alt={p.display_name}/>
                            <AvatarFallback>{p.display_name?.slice(0,1)?.toUpperCase() || "U"}</AvatarFallback>
                          </Avatar>
                          <span className="font-semibold">{p.display_name}</span>
                          {tab === 'speed' && (
                            <div className="flex items-center gap-1 ml-2">
                              {p.has_m25 && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 border">Silver{typeof p.silver_count === 'number' ? ` ×${p.silver_count}` : ''}</span>}
                              {p.has_m50 && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 border">Gold{typeof p.gold_count === 'number' ? ` ×${p.gold_count}` : ''}</span>}
                              {p.has_m75 && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 border">Platinum{typeof p.platinum_count === 'number' ? ` ×${p.platinum_count}` : ''}</span>}
                              {p.has_m100 && <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-100 border">Diamond{typeof p.diamond_count === 'number' ? ` ×${p.diamond_count}` : ''}</span>}
                            </div>
                          )}
                        </div>
                        <div className="font-black text-amber-700">
                          {tab === 'xp' ? `${p.xp} XP` : `${p.total_coins} coins`}
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
                <CardTitle className="text-lg">Your Totals {myRank ? `(Rank #${myRank})` : "(Outside top 50)"} — {tab === 'speed' ? 'Speed' : 'Global'}</CardTitle>
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
                    {tab === 'speed' && me && (
                      <div className="flex items-center gap-1 ml-2">
                        {me.has_m25 && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 border">Silver{typeof me.silver_count === 'number' ? ` ×${me.silver_count}` : ''}</span>}
                        {me.has_m50 && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 border">Gold{typeof me.gold_count === 'number' ? ` ×${me.gold_count}` : ''}</span>}
                        {me.has_m75 && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 border">Platinum{typeof me.platinum_count === 'number' ? ` ×${me.platinum_count}` : ''}</span>}
                        {me.has_m100 && <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-100 border">Diamond{typeof me.diamond_count === 'number' ? ` ×${me.diamond_count}` : ''}</span>}
                      </div>
                    )}
                  </div>
                  <div className="font-black text-amber-700">
                    {tab === 'xp' ? `${(me as any)?.xp ?? 0} XP` : `${me?.total_coins ?? 0} coins`}
                  </div>
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
