import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, Check, Users, Rocket, ArrowLeft } from "lucide-react";
import { getProfile } from "@/services/profile";

interface PresenceUser { id: string; name: string }

const Lobby = () => {
  const { code = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, guest } = useAuth();
  const [players, setPlayers] = useState<PresenceUser[]>([]);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const difficulty = (params.get("difficulty") as 'easy' | 'moderate' | 'difficult') ?? 'moderate';
  const role = params.get("role") === 'host' ? 'host' : 'guest';

  const userId = useMemo(() => user?.id ?? localStorage.getItem("guestId") ?? `guest-${Math.random().toString(36).slice(2, 10)}`, [user]);
  const displayNameRef = useRef<string>("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Determine a display name from profile or fallback
  useEffect(() => {
    let mounted = true;
    (async () => {
      const prof = await getProfile(userId);
      const name = prof?.full_name || (user?.email?.split("@")[0]) || (guest ? `Guest-${userId.slice(-4)}` : `Player-${userId.slice(-4)}`);
      if (mounted) displayNameRef.current = name;
    })();
    return () => { mounted = false; };
  }, [userId, user, guest]);

  // Supabase realtime lobby
  useEffect(() => {
    const channel = supabase.channel(`lobby:${code}`, { config: { presence: { key: userId } } });
    channelRef.current = channel;
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, Array<{ id: string; name: string }>>;
        const list: PresenceUser[] = [];
        Object.values(state).forEach(arr => arr.forEach((u) => list.push(u)));
        setPlayers(list);
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        await channel.track({ id: userId, name: displayNameRef.current });
      });

    channel.on('broadcast', { event: 'start' }, (payload: any) => {
      const d = payload?.payload?.difficulty ?? difficulty;
      navigate(`/play?mode=speed&difficulty=${encodeURIComponent(d)}&lobby=${encodeURIComponent(code)}`);
    });

    return () => {
      channel.unsubscribe();
    };
  }, [code, userId, difficulty, navigate]);

  const startMatch = async () => {
    if (!channelRef.current) return;
    setStarting(true);
    await channelRef.current.send({ type: 'broadcast', event: 'start', payload: { difficulty } });
    setStarting(false);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true); setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const leave = () => {
    channelRef.current?.unsubscribe();
    navigate('/modes/compete');
  };

  const canStart = role === 'host' && players.length >= 2;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-amber-50 via-rose-50 to-indigo-50">
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <Button variant="secondary" className="rounded-full mb-6" onClick={leave}><ArrowLeft className="w-4 h-4 mr-2"/>Back</Button>
        <Card className="p-6 rounded-3xl border-0 bg-white/70 backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black">Lobby #{code}</h1>
              <p className="text-muted-foreground">Difficulty: <span className="font-semibold">{difficulty}</span></p>
            </div>
            <Button onClick={copyCode} variant="outline" className="rounded-full">
              {copied ? <Check className="w-4 h-4 mr-2"/> : <Copy className="w-4 h-4 mr-2"/>} Copy Code
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {players.map((p) => (
              <div key={p.id} className="rounded-2xl p-4 bg-gradient-to-br from-primary/10 to-primary/5 border">
                <div className="flex items-center gap-3"><Users className="w-4 h-4"/><span className="font-semibold">{p.name}</span></div>
              </div>
            ))}
            {players.length === 0 && (
              <div className="text-muted-foreground">Waiting for players…</div>
            )}
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            {canStart && (
              <Button onClick={startMatch} disabled={starting} className="rounded-full">
                <Rocket className="w-4 h-4 mr-2"/> {starting ? 'Starting…' : 'Start Match'}
              </Button>
            )}
            <Button variant="outline" onClick={leave} className="rounded-full">Leave</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Lobby;
