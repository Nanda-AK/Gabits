import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, Lock } from "lucide-react";

type AuthPanelProps = {
  modeLocked?: "signin" | "signup";
  showSignupToggle?: boolean;
  hideGuest?: boolean;
};

export const AuthPanel = ({ modeLocked, showSignupToggle = true, hideGuest = true }: AuthPanelProps) => {
  const { toast } = useToast();
  const { signInWithPassword, signUpWithPassword, user } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">(modeLocked ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [remember, setRemember] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("auth:remember_email");
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {}
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const effectiveMode = modeLocked ?? mode;
    if (effectiveMode === "signup") {
      if (password.length < 6) {
        toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      if (password !== confirm) {
        toast({ title: "Passwords do not match", description: "Please confirm your password.", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      const res = await signUpWithPassword(email, password);
      if ((res as any)?.error) {
        toast({ title: "Sign up failed", description: (res as any).error, variant: "destructive" });
      } else {
        toast({ title: "Check your email", description: "We sent you a confirmation link." });
      }
    } else {
      const res = await signInWithPassword(email, password);
      if ((res as any)?.error) {
        toast({ title: "Sign in failed", description: (res as any).error, variant: "destructive" });
      } else {
        toast({ title: "Welcome back!" });
        try {
          if (remember) localStorage.setItem("auth:remember_email", email);
          else localStorage.removeItem("auth:remember_email");
        } catch {}
      }
    }

    setSubmitting(false);
  };

  if (user) {
    // If already authenticated or guest, hide the panel to reduce noise
    return null;
  }

  return (
    <Card className="mx-auto w-full max-w-md bg-white shadow-xl border border-gray-200 rounded-2xl">
      <CardHeader>
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <img src="/gabits-logo.png" alt="Gabits" className="w-8 h-8" />
            <span className="text-sm font-bold text-[#2563EB]">Gabits Auth</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">School ID</Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><Mail className="w-4 h-4"/></div>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-9" placeholder="name@example.com" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400"><Lock className="w-4 h-4"/></div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-9" placeholder="••••••••" />
            </div>
          </div>

          <div className="flex items-center justify-start text-xs text-gray-600">
            <label className="inline-flex items-center gap-2 select-none">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
              Remember me
            </label>
          </div>

          <Button type="submit" className="w-full rounded-md bg-[#1D9BF0] hover:bg-[#1584CE]" disabled={submitting}>
            {submitting ? "Please wait..." : (modeLocked ?? mode) === "signin" ? "Log in" : "Create Account"}
          </Button>
        </form>

        {/* Footer note */}
        <div className="mt-4 text-center text-[12px] text-gray-500">
          Having trouble signing in? Contact your class teacher.
        </div>
      </CardContent>
    </Card>
  );
};
