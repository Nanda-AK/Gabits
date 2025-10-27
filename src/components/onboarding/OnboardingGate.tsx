import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile, needsOnboarding } from "@/services/profile";
import { ProfileOnboarding } from "./ProfileOnboarding";

export const OnboardingGate = () => {
  const { user, guest } = useAuth();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  // Only trigger onboarding for authenticated users (not guests), and only right after login/signup
  const userId = useMemo(() => (guest ? undefined : user?.id), [user, guest]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      // Only proceed if authenticated and a recent login/signup occurred
      if (!userId) { setOpen(false); setChecked(true); return; }
      const shouldTrigger = sessionStorage.getItem('onboarding:trigger') === '1';
      if (!shouldTrigger) { setOpen(false); setChecked(true); return; }

      const p = await getProfile(userId);
      if (!alive) return;
      const need = needsOnboarding(p);
      setOpen(need);
      // Consume the trigger so it doesn't keep popping up
      try { sessionStorage.removeItem('onboarding:trigger'); } catch {}
      setChecked(true);
    };
    run();
    return () => { alive = false; };
  }, [userId]);

  if (!checked) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tell us about you</DialogTitle>
        </DialogHeader>
        <ProfileOnboarding onComplete={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};
