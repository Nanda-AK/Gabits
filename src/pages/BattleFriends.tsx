import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function randomCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // avoid confusing chars
  let c = "";
  for (let i = 0; i < 4; i++) c += letters[Math.floor(Math.random() * letters.length)];
  return c;
}

const BattleFriends = () => {
  const [code, setCode] = useState("");
  const [difficulty, setDifficulty] = useState<'easy' | 'moderate' | 'difficult' | ''>('');
  const navigate = useNavigate();

  const createLobby = () => {
    if (!difficulty) return;
    const c = randomCode();
    navigate(`/lobby/${c}?difficulty=${difficulty}&role=host`);
  };

  const joinLobby = () => {
    const clean = code.replace(/\s+/g, "").toUpperCase();
    if (clean.length !== 4) return;
    navigate(`/lobby/${clean}?role=guest`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-rose-50 via-fuchsia-50 to-sky-50">
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <Button variant="secondary" className="mb-6 rounded-full" onClick={() => navigate("/modes/compete")}> <ArrowLeft className="w-4 h-4 mr-2"/> Back to Compete</Button>
        <h1 className="text-4xl font-black mb-6 text-center bg-gradient-to-r from-fuchsia-600 to-sky-600 bg-clip-text text-transparent">Battle Friends</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Card className="p-6 rounded-3xl border-0 bg-white/70 backdrop-blur-xl shadow-xl">
            <h2 className="text-xl font-bold mb-2">Create Lobby</h2>
            <p className="text-sm text-muted-foreground mb-4">Start a new match and share the code</p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Difficulty</label>
              <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                <SelectTrigger><SelectValue placeholder="Select difficulty"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="difficult">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full mt-4 rounded-full" onClick={createLobby} disabled={!difficulty}>Create Lobby</Button>
          </Card>
          <Card className="p-6 rounded-3xl border-0 bg-white/70 backdrop-blur-xl shadow-xl">
            <h2 className="text-xl font-bold mb-2">Join Lobby</h2>
            <p className="text-sm text-muted-foreground mb-4">Enter a 4-letter code</p>
            <Input placeholder="A B C D" maxLength={7} value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="tracking-widest text-center"/>
            <Button className="w-full mt-4 rounded-full" onClick={joinLobby} disabled={code.replace(/\s+/g, "").length !== 4}>Join Lobby</Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BattleFriends;
