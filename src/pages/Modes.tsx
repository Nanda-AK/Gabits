import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { Target, Swords, Trophy, ChartNoAxesGantt, Sparkles, BookOpen, Timer, Bot, Users } from "lucide-react";

const GlowTile: React.FC<{ title: string; subtitle: string; icon: React.ReactNode; onClick: () => void; gradient: string }> = ({ title, subtitle, icon, onClick, gradient }) => (
  <button onClick={onClick} className="group relative w-full text-left">
    <div className={`absolute -inset-0.5 rounded-3xl blur-lg opacity-60 group-hover:opacity-90 transition-opacity ${gradient}`} />
    <Card className="relative h-48 rounded-3xl border-0 bg-gradient-to-br from-white/75 to-white/50 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all">
      <CardHeader className="flex items-center justify-center gap-4 pt-8">
        <div className="rounded-2xl p-3 bg-primary/10 text-primary group-hover:scale-105 transition-transform">
          {icon}
        </div>
        <CardTitle className="text-3xl font-extrabold tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center text-muted-foreground">{subtitle}</CardContent>
    </Card>
  </button>
);

const Modes = () => {
  const navigate = useNavigate();
  const [soloOpen, setSoloOpen] = useState(false);
  const [competeOpen, setCompeteOpen] = useState(false);
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50">
      <div className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-pink-400/20 blur-3xl" />
      <div className="container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Choose Mode
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Choose your path to mine more treasures</h1>
            <p className="text-muted-foreground mt-2">Select a mode to begin your journey.</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => navigate('/treasure')} variant="secondary" className="rounded-full"><ChartNoAxesGantt className="w-4 h-4 mr-2"/>My Treasure</Button>
            <Button onClick={() => navigate('/leaderboard')} variant="secondary" className="rounded-full"><Trophy className="w-4 h-4 mr-2"/>Leaderboard</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {/* Solo with hover/tap menu */}
          <div
            onMouseEnter={() => setSoloOpen(true)}
            onMouseLeave={() => setSoloOpen(false)}
            className="w-full"
          >
            <Popover open={soloOpen} onOpenChange={setSoloOpen}>
              <PopoverTrigger asChild>
                <div>
                  <GlowTile
                    title="Solo"
                    subtitle="Practice at your own pace"
                    icon={<Target className="w-7 h-7"/>}
                    onClick={() => setSoloOpen(o => !o)}
                    gradient="bg-gradient-to-r from-indigo-400/40 to-purple-400/40"
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent align="center" sideOffset={10} className="rounded-2xl border-0 bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-xl shadow-xl p-2 w-72">
                <div className="space-y-1">
                  <button
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-primary/10 text-left"
                    onClick={() => { setSoloOpen(false); navigate('/modes/solo/practice'); }}
                  >
                    <div className="rounded-lg p-2 bg-indigo-100 text-indigo-700"><BookOpen className="w-4 h-4"/></div>
                    <div>
                      <div className="font-semibold">Practice</div>
                      <div className="text-xs text-muted-foreground">Your own pace</div>
                    </div>
                  </button>
                  <button
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-primary/10 text-left"
                    onClick={() => { setSoloOpen(false); navigate('/modes/solo/speed'); }}
                  >
                    <div className="rounded-lg p-2 bg-emerald-100 text-emerald-700"><Timer className="w-4 h-4"/></div>
                    <div>
                      <div className="font-semibold">Speed Drive</div>
                      <div className="text-xs text-muted-foreground">10 Qs • 30s each</div>
                    </div>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Compete with hover/tap menu */}
          <div
            onMouseEnter={() => setCompeteOpen(true)}
            onMouseLeave={() => setCompeteOpen(false)}
            className="w-full"
          >
            <Popover open={competeOpen} onOpenChange={setCompeteOpen}>
              <PopoverTrigger asChild>
                <div>
                  <GlowTile
                    title="Compete"
                    subtitle="Challenge others"
                    icon={<Swords className="w-7 h-7"/>}
                    onClick={() => setCompeteOpen(o => !o)}
                    gradient="bg-gradient-to-r from-emerald-400/40 to-cyan-400/40"
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent align="center" sideOffset={10} className="rounded-2xl border-0 bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-xl shadow-xl p-2 w-72">
                <div className="space-y-1">
                  <button
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-primary/10 text-left"
                    onClick={() => { setCompeteOpen(false); navigate('/modes/compete/ai'); }}
                  >
                    <div className="rounded-lg p-2 bg-purple-100 text-purple-700"><Bot className="w-4 h-4"/></div>
                    <div>
                      <div className="font-semibold">Battle AI</div>
                      <div className="text-xs text-muted-foreground">Challenge a clever bot</div>
                    </div>
                  </button>
                  <button
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-primary/10 text-left"
                    onClick={() => { setCompeteOpen(false); navigate('/modes/compete/friends'); }}
                  >
                    <div className="rounded-lg p-2 bg-cyan-100 text-cyan-700"><Users className="w-4 h-4"/></div>
                    <div>
                      <div className="font-semibold">Battle Friends</div>
                      <div className="text-xs text-muted-foreground">Create or join a lobby</div>
                    </div>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modes;
