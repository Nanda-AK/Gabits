import { supabase } from "@/lib/supabase";
import { getUserBalances } from "@/services/rewards";

export type AvatarPack = "silver" | "gold";

const PACK_XP_REQUIREMENTS: Record<AvatarPack, number> = {
  silver: 100,
  gold: 200,
};

const localKey = (userId: string) => `avatars:${userId}:packs`;

export async function getUnlockedAvatarPacks(userId: string): Promise<AvatarPack[]> {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(localKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter((p): p is AvatarPack => p === "silver" || p === "gold");
  } catch {
    return [];
  }
}

async function saveUnlockedAvatarPacks(userId: string, packs: AvatarPack[]): Promise<void> {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(packs));
  } catch {
    // ignore
  }
}

export async function unlockAvatarPack(
  userId: string,
  pack: AvatarPack
): Promise<{ ok: boolean; error?: string }> {
  if (!userId) return { ok: false, error: "Missing user id" };

  const balances = await getUserBalances(userId);
  const xp = balances?.xp ?? 0;
  const requiredXp = PACK_XP_REQUIREMENTS[pack];

  if (xp < requiredXp) {
    return { ok: false, error: `Requires at least ${requiredXp} XP.` };
  }

  const current = await getUnlockedAvatarPacks(userId);
  if (current.includes(pack)) {
    return { ok: true };
  }

  const next = [...current, pack];
  await saveUnlockedAvatarPacks(userId, next);
  return { ok: true };
}

export async function selectAvatar(
  userId: string,
  avatarPath: string
): Promise<{ ok: boolean; error?: string }> {
  if (!userId) return { ok: false, error: "Missing user id" };
  if (!avatarPath) return { ok: false, error: "Missing avatar path" };

  let pack: AvatarPack | null = null;
  if (avatarPath.includes("/silver/")) pack = "silver";
  if (avatarPath.includes("/gold/")) pack = "gold";

  if (pack) {
    const unlocked = await getUnlockedAvatarPacks(userId);
    if (!unlocked.includes(pack)) {
      return { ok: false, error: `Pack ${pack} not unlocked` };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_style: avatarPath, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
