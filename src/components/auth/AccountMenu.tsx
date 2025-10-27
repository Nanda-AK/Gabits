import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export const AccountMenu = () => {
  const { user, guest, signOut, clearGuest } = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Signed out" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleClearGuest = () => {
    clearGuest();
    toast({ title: "Guest mode off", description: "Sign in or continue as Guest again." });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-xl border bg-white/70 backdrop-blur px-3 py-2 shadow">
      {user ? (
        <>
          <span className="text-sm text-gray-700">{user.email}</span>
          <Button size="sm" variant="outline" onClick={handleSignOut}>Sign out</Button>
        </>
      ) : guest ? (
        <>
          <span className="text-sm text-gray-700">Guest</span>
          <Button size="sm" variant="outline" onClick={handleClearGuest}>Switch account</Button>
        </>
      ) : (
        <span className="text-sm text-gray-600">Sign in below to start</span>
      )}
    </div>
  );
};
