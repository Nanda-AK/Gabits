import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { upsertProfile } from "@/services/profile";

function ensureGuestId(): string {
  const existing = localStorage.getItem("guestId");
  if (existing) return existing;
  const id = `guest-${Math.random().toString(36).slice(2, 10)}`;
  try { localStorage.setItem("guestId", id); } catch {}
  return id;
}

export const ProfileOnboarding: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const { user, guest } = useAuth();
  const { toast } = useToast();

  const userId = useMemo(() => (user?.id ?? (guest ? ensureGuestId() : "")), [user, guest]);

  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [standard, setStandard] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!fullName || !age || !gender || !standard) {
      toast({ title: "Complete all fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await upsertProfile({ id: userId, full_name: fullName, age: Number(age), gender, standard });
    setSaving(false);
    if (!res.ok) {
      // Still proceed since we saved locally as fallback
      toast({ title: "Saved locally", description: "We couldn't sync to cloud yet, but you're good to continue." });
    } else {
      toast({ title: "Profile saved" });
    }
    onComplete?.();
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g., Ayaan Kumar" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="age">Age</Label>
          <Input id="age" type="number" min={5} max={120} value={age} onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")} />
        </div>
        <div className="space-y-2">
          <Label>Gender</Label>
          <Select value={gender} onValueChange={(v: any) => setGender(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Class / Standard</Label>
        <Select value={standard} onValueChange={(v) => setStandard(v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select standard" />
          </SelectTrigger>
          <SelectContent>
            {[
              "Class 4","Class 5","Class 6","Class 7","Class 8","Class 9","Class 10","Class 11","Class 12","Undergrad","Other"
            ].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Saving..." : "Save & Continue"}
      </Button>
    </form>
  );
};
