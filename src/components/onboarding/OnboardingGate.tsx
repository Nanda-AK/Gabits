import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile, needsOnboarding } from "@/services/profile";
import { ProfileOnboarding } from "./ProfileOnboarding";

export const OnboardingGate = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const canCloseRef = useRef(false);

  // Trigger onboarding only for authenticated users
  const userId = user?.id;

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!userId) { setOpen(false); setChecked(true); return; }
      const p = await getProfile(userId);
      if (!alive) return;
      const need = needsOnboarding(p);
      setOpen(need);
      canCloseRef.current = !need;
      setChecked(true);
    };
    run();
    return () => { alive = false; };
  }, [userId]);

  if (!checked) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Prevent closing while profile is incomplete
        if (!next) {
          if (canCloseRef.current) setOpen(false);
          else setOpen(true);
        } else {
          setOpen(true);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tell us about you</DialogTitle>
        </DialogHeader>
        <ProfileOnboarding onComplete={() => { canCloseRef.current = true; setOpen(false); }} />
      </DialogContent>
    </Dialog>
  );
};
