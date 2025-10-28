import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getProfile } from "@/services/profile";

export const AccountMenu = () => {
  const { user, guest, signOut, clearGuest } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState<string>("");

  // Load profile name when authenticated or guest profile exists
  useEffect(() => {
    const run = async () => {
      try {
        const uid = user?.id || (guest ? localStorage.getItem("guestId") || undefined : undefined);
        if (!uid) { setFullName(""); return; }
        const p = await getProfile(uid);
        if (p?.full_name) setFullName(p.full_name);
      } catch {}
    };
    run();
  }, [user, guest]);

  const displayName = useMemo(() => {
    const localName = localStorage.getItem("player:name") || "";
    return fullName || (user?.user_metadata as any)?.full_name || localName || user?.email || (guest ? "Guest" : "");
  }, [fullName, user, guest]);

  const seed = useMemo(() => (user?.id || localStorage.getItem("guestId") || displayName || "guest"), [user, displayName]);
  const avatarUrl = `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;

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
    <div className="fixed right-4 top-4 z-50">
      {(user || guest) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full border bg-white/80 backdrop-blur px-3 py-1.5 shadow hover:shadow-md transition">
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl} alt={displayName || "avatar"} />
                <AvatarFallback>{(displayName || "?").slice(0,1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="max-w-[140px] truncate text-sm font-semibold text-gray-700">{displayName}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate("/treasure")}>My Treasure</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/leaderboard")}>Leaderboard</DropdownMenuItem>
            <DropdownMenuSeparator />
            {user ? (
              <DropdownMenuItem onClick={handleSignOut}>Sign Out</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleClearGuest}>Switch Account</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
