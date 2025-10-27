import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Users, Sparkles } from "lucide-react";

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

const CompeteMode = () => {
  const navigate = useNavigate();
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-fuchsia-50 via-sky-50 to-indigo-50">
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl" />
      <div className="container mx-auto px-4 py-10">
        <Button variant="secondary" className="mb-6 rounded-full" onClick={() => navigate("/modes")}> <ArrowLeft className="w-4 h-4 mr-2"/> Back to Modes</Button>
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Competitive Play
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">Compete</h1>
          <p className="text-muted-foreground">Choose how you want to challenge others.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <GlowTile title="Battle AI" subtitle="Challenge a clever bot" icon={<Bot className="w-7 h-7"/>} onClick={() => navigate("/modes/compete/ai")} gradient="bg-gradient-to-r from-indigo-400/40 to-purple-400/40" />
          <GlowTile title="Battle Friends" subtitle="Create or join a lobby" icon={<Users className="w-7 h-7"/>} onClick={() => navigate("/modes/compete/friends")} gradient="bg-gradient-to-r from-emerald-400/40 to-cyan-400/40" />
        </div>
      </div>
    </div>
  );
};

export default CompeteMode;
