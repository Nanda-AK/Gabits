import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export const AuthPanel = () => {
  const { toast } = useToast();
  const { signInWithPassword, signUpWithPassword, continueAsGuest, user, guest } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    if (mode === "signup") {
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
      }
    }

    setSubmitting(false);
  };

  const onGuest = () => {
    continueAsGuest();
    toast({ title: "Continuing as Guest" });
  };

  if (user || guest) {
    // If already authenticated or guest, hide the panel to reduce noise
    return null;
  }

  return (
    <Card className="mx-auto w-full max-w-md bg-white/80 backdrop-blur border-2">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold">
          {mode === "signin" ? "Sign in to play" : "Create your account"}
        </CardTitle>
        <div className="text-center text-sm text-gray-500">
          or
          <button className="ml-1 underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <div className="relative my-6 text-center text-xs text-gray-500">
          <span className="bg-white/70 px-2">or</span>
          <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-200 -z-10" />
        </div>

        <Button variant="outline" className="w-full" onClick={onGuest}>
          Continue as Guest
        </Button>
      </CardContent>
    </Card>
  );
};
