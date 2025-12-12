import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getProfile } from "@/services/profile";

export const AccountMenu = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [fullName, setFullName] = useState<string>("");
  const [role, setRole] = useState<string>("");

  // Load profile name when authenticated or guest profile exists
  useEffect(() => {
    const run = async () => {
      try {
        const uid = user?.id || undefined;
        if (!uid) { setFullName(""); return; }
        const p = await getProfile(uid);
        if (p?.full_name) setFullName(p.full_name);
        if ((p as any)?.role) setRole((p as any).role);
      } catch {}
    };
    run();
  }, [user]);

  const displayName = useMemo(() => {
    const localName = localStorage.getItem("player:name") || "";
    return fullName || (user?.user_metadata as any)?.full_name || localName || "Player";
  }, [fullName, user]);

  const seed = useMemo(() => (user?.id || displayName || "user"), [user, displayName]);
  const avatarUrl = `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;

  // Determine if we should replace the history entry when leaving a completed game
  const shouldReplace = useMemo(() => {
    try {
      const completed = localStorage.getItem('play:completed') === '1';
      return location.pathname === '/play' && completed;
    } catch {
      return false;
    }
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Signed out" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="fixed right-4 top-4 z-50">
      {user && (
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
            {role === 'teacher' && (
              <>
                <DropdownMenuItem onClick={() => navigate("/portal/teacher", { replace: shouldReplace })}>Teacher Panel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/portal/class", { replace: shouldReplace })}>Class Overview</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/portal/students", { replace: shouldReplace })}>Students</DropdownMenuItem>
              </>
            )}
            {role !== 'teacher' && (
              <>
                <DropdownMenuItem onClick={() => navigate("/dashboard", { replace: shouldReplace })}>Dashboard</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/treasure", { replace: shouldReplace })}>My Treasure</DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => navigate("/leaderboard", { replace: shouldReplace })}>Leaderboard</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>Sign Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
