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
  const topicsParam = params.get('topics') || '';
  const role = params.get("role") === 'host' ? 'host' : 'guest';

  const userId = useMemo(() => {
    if (user?.id) return user.id;
    try {
      let id = localStorage.getItem('guestId');
      if (!id) { id = `guest-${Math.random().toString(36).slice(2, 10)}`; localStorage.setItem('guestId', id); }
      return id;
    } catch {
      return `guest-${Math.random().toString(36).slice(2, 10)}`;
    }
  }, [user]);
  const displayNameRef = useRef<string>("");
  const [myName, setMyName] = useState<string>("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const startedRef = useRef<boolean>(false);

  // Determine a display name from profile or fallback (never empty)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const fallback = guest || !user ? `Guest-${String(userId).slice(-4)}` : `Player-${String(userId).slice(-4)}`;
      if (guest || !user) {
        if (mounted) { displayNameRef.current = fallback; setMyName(fallback); }
        return;
      }
      try {
        const prof = await getProfile(userId);
        const name = prof?.full_name || fallback;
        if (mounted) { displayNameRef.current = name; setMyName(name); }
      } catch {
        if (mounted) { displayNameRef.current = fallback; setMyName(fallback); }
      }
    })();
    return () => { mounted = false; };
  }, [userId, user, guest]);

  // Supabase realtime lobby
  useEffect(() => {
    const channel = supabase.channel(`lobby:${code}`, { config: { presence: { key: userId } } });
    channelRef.current = channel;
    // Register handlers BEFORE subscribe to avoid missing early events
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, Array<{ name: string; started?: boolean }>>;
      const list: PresenceUser[] = [];
      let anyStarted = false;
      Object.entries(state).forEach(([key, metas]) => {
        const nm = metas?.[0]?.name || (String(key).startsWith('guest-') ? `Guest-${String(key).slice(-4)}` : `Player-${String(key).slice(-4)}`);
        if (!anyStarted && metas?.some(m => m?.started)) anyStarted = true;
        list.push({ id: key, name: nm });
      });
      setPlayers(list);
      if (anyStarted && !startedRef.current) {
        startedRef.current = true;
        const qp = new URLSearchParams({ mode: 'battle-friends', difficulty: String(difficulty), lobby: String(code) });
        if (topicsParam) qp.set('topics', String(topicsParam));
        navigate(`/play?${qp.toString()}`);
      }
    });
    channel.on('broadcast', { event: 'start' }, (payload: any) => {
      const d = payload?.payload?.difficulty ?? difficulty;
      const t = payload?.payload?.topics ?? topicsParam;
      const qp = new URLSearchParams({ mode: 'battle-friends', difficulty: String(d), lobby: String(code) });
      if (t) qp.set('topics', String(t));
      navigate(`/play?${qp.toString()}`);
    });

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      const name = (displayNameRef.current && displayNameRef.current.trim().length > 0) ? displayNameRef.current : (guest ? `Guest-${String(userId).slice(-4)}` : `Player-${String(userId).slice(-4)}`);
      await channel.track({ id: userId, name });
    });

    return () => {
      channel.unsubscribe();
    };
  }, [code, userId, difficulty, navigate, guest, topicsParam]);

  // If name resolves later, update presence metadata
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch) return;
    if (!myName) return;
    try { ch.track({ id: userId, name: myName }); } catch {}
  }, [myName, userId]);

  const startMatch = async () => {
    if (!channelRef.current) return;
    setStarting(true);
    await channelRef.current.send({ type: 'broadcast', event: 'start', payload: { difficulty, topics: topicsParam, hostId: userId } });
    try { await channelRef.current.track({ id: userId, name: myName || (guest ? `Guest-${String(userId).slice(-4)}` : `Player-${String(userId).slice(-4)}`), started: true }); } catch {}
    // Ensure the broadcast is flushed before leaving the channel
    await new Promise(res => setTimeout(res, 150));
    // Also navigate locally (broadcast may not echo back to self)
    const qp = new URLSearchParams({ mode: 'battle-friends', difficulty: String(difficulty), lobby: String(code) });
    if (topicsParam) qp.set('topics', String(topicsParam));
    navigate(`/play?${qp.toString()}`);
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
              {topicsParam && (
                <p className="text-muted-foreground text-sm">Topics: <span className="font-semibold">{topicsParam}</span></p>
              )}
            </div>
            <Button onClick={copyCode} variant="outline" className="rounded-full">
              {copied ? <Check className="w-4 h-4 mr-2"/> : <Copy className="w-4 h-4 mr-2"/>} Copy Code
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {players.map((p) => {
              const label = (p.name && p.name.trim().length > 0) ? p.name : (p.id?.startsWith('guest-') ? `Guest-${String(p.id).slice(-4)}` : `Player-${String(p.id).slice(-4)}`);
              return (
                <div key={p.id} className="rounded-2xl p-4 bg-gradient-to-br from-primary/10 to-primary/5 border">
                  <div className="flex items-center gap-3"><Users className="w-4 h-4"/><span className="font-semibold">{label}</span></div>
                </div>
              );
            })}
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
