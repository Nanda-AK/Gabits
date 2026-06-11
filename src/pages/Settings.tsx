import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile } from "@/services/profile";
import { getUserBalances } from "@/services/rewards";
import { unlockAvatarPack, selectAvatar, getUnlockedAvatarPacks, ensureDefaultAvatar } from "@/services/avatars";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDesc } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Info, Check } from "lucide-react";
import { Sparkles } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [balances, setBalances] = useState<{ coins: number; gems: number; xp: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlockedPacks, setUnlockedPacks] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [avatarSelectOpen, setAvatarSelectOpen] = useState(false);
  const [selectingPack, setSelectingPack] = useState<"silver" | "gold" | null>(null);
  const [unlocking, setUnlocking] = useState<"silver" | "gold" | null>(null);

  // Load profile and balances
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const loadData = async () => {
      try {
        setLoading(true);
        const [p, b, packs] = await Promise.all([
          getProfile(user.id),
          getUserBalances(user.id),
          getUnlockedAvatarPacks(user.id),
        ]);

        let avatarPath = (p as any)?.avatar_style as string | null | undefined;
        if (!avatarPath) {
          avatarPath = await ensureDefaultAvatar(user.id);
        }

        setProfile(p);
        setBalances(b ? { coins: b.coins, gems: b.gems, xp: b.xp } : { coins: 0, gems: 0, xp: 0 });
        setUnlockedPacks(packs);
        setSelectedAvatar(avatarPath || null);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  // Generate avatar URL (matching AccountMenu logic)
  const displayName = useMemo(() => {
    const localName = localStorage.getItem("player:name") || "";
    return profile?.full_name || (user?.user_metadata as any)?.full_name || localName || "Player";
  }, [profile, user]);

  const seed = useMemo(() => (user?.id || displayName || "user"), [user, displayName]);
  const defaultAvatarUrl = `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;
  
  // Use selected avatar if available, otherwise use default
  const avatarUrl = selectedAvatar || defaultAvatarUrl;

  const handleUnlockPack = async (pack: "silver" | "gold") => {
    if (!user) return;
    
    setUnlocking(pack);
    try {
      const result = await unlockAvatarPack(user.id, pack);
      if (result.ok) {
        toast({
          title: "Pack Unlocked!",
          description: `You've successfully unlocked the ${pack} avatar pack!`,
        });
        // Reload unlocked packs
        const packs = await getUnlockedAvatarPacks(user.id);
        setUnlockedPacks(packs);
        // Reload profile to get updated data
        const p = await getProfile(user.id);
        setProfile(p);
      } else {
        toast({
          title: "Failed to Unlock",
          description: result.error || "Something went wrong",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unlock pack. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUnlocking(null);
    }
  };

  const handleSelectAvatar = async (avatarPath: string) => {
    if (!user) return;
    
    try {
      const result = await selectAvatar(user.id, avatarPath);
      if (result.ok) {
        setSelectedAvatar(avatarPath);
        setAvatarSelectOpen(false);
        toast({
          title: "Avatar Selected!",
          description: "Your avatar has been updated.",
        });
        // Reload profile
        const p = await getProfile(user.id);
        setProfile(p);
      } else {
        toast({
          title: "Failed to Select Avatar",
          description: result.error || "Something went wrong",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to select avatar. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openAvatarSelector = (pack: "silver" | "gold") => {
    if (!unlockedPacks.includes(pack)) {
      toast({
        title: "Pack Not Unlocked",
        description: `You need to unlock the ${pack} pack first.`,
        variant: "destructive",
      });
      return;
    }
    setSelectingPack(pack);
    setAvatarSelectOpen(true);
  };

  if (!user) {
    return (
      <div className="min-h-[100svh] md:min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-emerald-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Please sign in to access settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[100svh] md:min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50 to-emerald-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading settings...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Local avatar images for the shop
  const generateAvatarGrid = (count: number, pack: "default" | "silver" | "gold") => {
    return Array.from({ length: count }, (_, i) => 
      `/assets/avatars/${pack}/avatar-${i + 1}.png`
    );
  };

  const defaultAvatars = generateAvatarGrid(9, "default");
  const silverAvatars = generateAvatarGrid(9, "silver");
  const goldAvatars = generateAvatarGrid(9, "gold");

  const currentXp = balances?.xp ?? 0;
  const canChangeDefault = currentXp >= 15;
  const canUnlockSilver = currentXp >= 100;
  const canUnlockGold = currentXp >= 200;
  const isSilverUnlocked = unlockedPacks.includes("silver");
  const isGoldUnlocked = unlockedPacks.includes("gold");

  return (
    <div className="min-h-[100svh] md:min-h-screen bg-white">
      <div className="container mx-auto px-4 pt-14 sm:pt-16 pb-10 max-w-7xl" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)" }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-indigo-700 to-emerald-700 bg-clip-text text-transparent flex items-center gap-3">
            <SettingsIcon className="w-7 h-7" /> Settings
          </h1>
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Section: Current Avatar & XP */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Current Avatar & XP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center">
                <Avatar className="h-32 w-32 mb-4 border-4 border-green-200 bg-green-50">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback className="bg-green-100 text-2xl">
                    {displayName.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => {
                    if (unlockedPacks.length === 0) {
                      toast({
                        title: "No Avatars Unlocked",
                        description: "Unlock an avatar pack first to change your avatar.",
                        variant: "destructive",
                      });
                    } else {
                      // Open selector with first unlocked pack
                      openAvatarSelector(unlockedPacks[0] as "silver" | "gold");
                    }
                  }}
                >
                  Change Avatar
                </Button>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-3xl font-black text-purple-700">
                    {currentXp} XP
                  </span>
                  <Info className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Middle Section: Personal Information */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg text-black">Personal Information</CardTitle>
              <CardDescription className="text-black">Update your profile details and preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-black">Full Name</Label>
                <Input
                  id="full_name"
                  value={profile?.full_name || displayName || ""}
                  disabled
                  className="bg-muted text-black"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user_id" className="text-black">User Id</Label>
                <Input
                  id="user_id"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted text-black"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-black">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value="••••••••"
                  disabled
                  className="bg-muted text-black"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class" className="text-black">Class</Label>
                <Input
                  id="class"
                  value={profile?.standard || "Class 6"}
                  disabled
                  className="bg-muted text-black"
                  placeholder="Class 6"
                />
              </div>
            </CardContent>
          </Card>

          {/* Right Section: Avatar Shop */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Avatar Shop</CardTitle>
              <CardDescription>Browse and purchase new avatars to customize your profile.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Default Avatars */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm mb-1">Default Avatars</h3>
                    <p className="text-xs text-muted-foreground mb-3">Starter avatars available for everyone. Earn 15 XP to switch between them.</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {defaultAvatars.map((url, idx) => (
                    <div
                      key={idx}
                      className={`aspect-square rounded-lg overflow-hidden border-2 bg-gray-50 cursor-pointer transition-all relative ${
                        selectedAvatar === url
                          ? "border-purple-600 ring-2 ring-purple-300"
                          : "border-gray-200 hover:border-purple-400 hover:scale-105"
                      }`}
                      onClick={() => {
                        if (!canChangeDefault) {
                          toast({
                            title: "Need 15 XP",
                            description: "Earn at least 15 XP to change your default avatar.",
                            variant: "destructive",
                          });
                          return;
                        }
                        handleSelectAvatar(url);
                      }}
                    >
                      <img
                        src={url}
                        alt={`Default avatar ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-semibold ${canChangeDefault ? "text-purple-700" : "text-gray-400"}`}>
                      15 XP
                    </span>
                    <Sparkles className={`w-4 h-4 ${canChangeDefault ? "text-purple-600" : "text-gray-400"}`} />
                  </div>
                </div>
              </div>

              {/* Silver Avatar Pack */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
                      Silver Avatar Pack
                      {isSilverUnlocked && <Check className="w-4 h-4 text-green-600" />}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">Unlock a collection of unique silver avatars.</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {silverAvatars.map((url, idx) => (
                    <div 
                      key={idx} 
                      className={`aspect-square rounded-lg overflow-hidden border-2 bg-gray-50 cursor-pointer transition-all relative ${
                        isSilverUnlocked 
                          ? "border-gray-200 hover:border-purple-400 hover:scale-105" 
                          : "border-gray-200 hover:border-purple-400 hover:scale-105"
                      } ${selectedAvatar === url ? "border-purple-600 ring-2 ring-purple-300" : ""}`}
                      onClick={() => isSilverUnlocked && openAvatarSelector("silver")}
                    >
                      <img 
                        src={url} 
                        alt={`Silver avatar ${idx + 1}`} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-semibold ${canUnlockSilver ? "text-purple-700" : "text-gray-400"}`}>
                      100 XP
                    </span>
                    <Sparkles className={`w-4 h-4 ${canUnlockSilver ? "text-purple-600" : "text-gray-400"}`} />
                  </div>
                  {isSilverUnlocked ? (
                    <Button 
                      variant="outline" 
                      className="bg-green-600 text-white hover:bg-green-700 border-green-600"
                      onClick={() => openAvatarSelector("silver")}
                    >
                      Select Avatar
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className={`${canUnlockSilver ? "bg-purple-600 text-white hover:bg-purple-700 border-purple-600" : "bg-gray-400 text-white border-gray-400 cursor-not-allowed"}`}
                      onClick={() => canUnlockSilver && handleUnlockPack("silver")}
                      disabled={!canUnlockSilver || unlocking === "silver"}
                    >
                      {unlocking === "silver" ? "Unlocking..." : "Unlock Silver Pack"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Gold Avatar Pack */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
                      Gold Avatar Pack
                      {isGoldUnlocked && <Check className="w-4 h-4 text-green-600" />}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">Discover rare and premium gold avatars.</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {goldAvatars.map((url, idx) => (
                    <div 
                      key={idx} 
                      className={`aspect-square rounded-lg overflow-hidden border-2 bg-gray-50 cursor-pointer transition-all relative ${
                        isGoldUnlocked 
                          ? "border-gray-200 hover:border-purple-400 hover:scale-105" 
                          : "border-gray-200 hover:border-purple-400 hover:scale-105"
                      } ${selectedAvatar === url ? "border-purple-600 ring-2 ring-purple-300" : ""}`}
                      onClick={() => isGoldUnlocked && openAvatarSelector("gold")}
                    >
                      <img 
                        src={url} 
                        alt={`Gold avatar ${idx + 1}`} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-semibold ${canUnlockGold ? "text-purple-700" : "text-gray-400"}`}>
                      200 XP
                    </span>
                    <Sparkles className={`w-4 h-4 ${canUnlockGold ? "text-purple-600" : "text-gray-400"}`} />
                  </div>
                  {isGoldUnlocked ? (
                    <Button 
                      variant="outline" 
                      className="bg-green-600 text-white hover:bg-green-700 border-green-600"
                      onClick={() => openAvatarSelector("gold")}
                    >
                      Select Avatar
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className={`${canUnlockGold ? "bg-purple-500 text-white hover:bg-purple-600 border-purple-500" : "bg-gray-400 text-white border-gray-400 cursor-not-allowed"}`}
                      onClick={() => canUnlockGold && handleUnlockPack("gold")}
                      disabled={!canUnlockGold || unlocking === "gold"}
                    >
                      {unlocking === "gold" ? "Unlocking..." : "Unlock Gold Pack"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Avatar Selection Dialog */}
      <Dialog open={avatarSelectOpen} onOpenChange={setAvatarSelectOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select {selectingPack === "silver" ? "Silver" : "Gold"} Avatar</DialogTitle>
            <DialogDesc>
              Choose an avatar from your unlocked {selectingPack} pack to set as your profile picture.
            </DialogDesc>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 mt-4">
            {(selectingPack === "silver" ? silverAvatars : goldAvatars).map((url, idx) => (
              <div
                key={idx}
                className={`aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all relative ${
                  selectedAvatar === url
                    ? "border-purple-600 ring-2 ring-purple-300"
                    : "border-gray-200 hover:border-purple-400"
                }`}
                onClick={() => handleSelectAvatar(url)}
              >
                <img
                  src={url}
                  alt={`${selectingPack} avatar ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
                {selectedAvatar === url && (
                  <div className="absolute inset-0 flex items-center justify-center bg-purple-600/20">
                    <Check className="w-8 h-8 text-purple-700" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;