import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getProfile } from "@/services/profile";
import { ensureDefaultAvatar } from "@/services/avatars";

export const AccountMenu = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [fullName, setFullName] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [avatarStyle, setAvatarStyle] = useState<string | null>(null);

  // Load profile name when authenticated or guest profile exists
  useEffect(() => {
    const run = async () => {
      try {
        const uid = user?.id || undefined;
        if (!uid) { setFullName(""); return; }
        const p = await getProfile(uid);
        if (p?.full_name) setFullName(p.full_name);
        if ((p as any)?.role) setRole((p as any).role);

        let avatar = (p as any)?.avatar_style as string | null | undefined;
        if (!avatar) {
          avatar = await ensureDefaultAvatar(uid);
        }
        if (avatar) setAvatarStyle(avatar);
      } catch {}
    };
    run();
  }, [user]);

  const displayName = useMemo(() => {
    const localName = localStorage.getItem("player:name") || "";
    return fullName || (user?.user_metadata as any)?.full_name || localName || "Player";
  }, [fullName, user]);

  const seed = useMemo(() => (user?.id || displayName || "user"), [user, displayName]);

  const avatarUrl = useMemo(() => {
    if (
      avatarStyle &&
      (avatarStyle.startsWith("http://") ||
        avatarStyle.startsWith("https://") ||
        avatarStyle.startsWith("/"))
    ) {
      return avatarStyle;
    }
    const style = avatarStyle || "thumbs";
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
  }, [avatarStyle, seed]);

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

  // Do not render on the in-game Play screen to prevent header overlap
  if (location.pathname.startsWith('/play')) {
    return null;
  }

  return (
    <div className="fixed right-2 top-2 sm:right-4 sm:top-4 z-40">
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center rounded-full border bg-white/80 backdrop-blur p-1.5 shadow hover:shadow-md transition" aria-label="Profile menu">
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl} alt={displayName || "avatar"} />
                <AvatarFallback>{(displayName || "?").slice(0,1).toUpperCase()}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
            {role === 'teacher' && (
              <>
                <DropdownMenuItem onClick={() => navigate("/portal/teacher", { replace: shouldReplace })}>Teacher Panel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/portal/class", { replace: shouldReplace })}>Class Overview</DropdownMenuItem>
              </>
            )}
            {role !== 'teacher' && (
              <>
                <DropdownMenuItem onClick={() => navigate("/dashboard", { replace: shouldReplace })}>Dashboard</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/treasure")}>My Treasure</DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => navigate("/leaderboard", { replace: shouldReplace })}>Leaderboard</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings", { replace: shouldReplace })}>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>Sign Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
