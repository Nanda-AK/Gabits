import { z } from "zod";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/profile";

export const ProfileSchema = z.object({
  id: z.string(),
  full_name: z.string().min(2),
  age: z.number().min(5).max(120),
  gender: z.enum(["male", "female", "other"]),
  standard: z.string().min(1),
});

export type ProfileInput = Omit<Profile, "created_at" | "updated_at">;

const localKey = (id: string) => `profile:${id}`;

export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    if (!data) {
      const local = localStorage.getItem(localKey(userId));
      return local ? (JSON.parse(local) as Profile) : null;
    }
    return data as Profile;
  } catch (_e) {
    // Fallback to local
    const local = localStorage.getItem(localKey(userId));
    return local ? (JSON.parse(local) as Profile) : null;
  }
}

export async function upsertProfile(input: ProfileInput): Promise<{ ok: boolean; error?: string }> {
  // Persist locally first for resilience
  try { localStorage.setItem(localKey(input.id), JSON.stringify(input)); } catch {}

  try {
    const parsed = ProfileSchema.parse(input);
    const { error } = await supabase.from("profiles").upsert({ ...parsed, updated_at: new Date().toISOString() });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Failed to save profile" };
  }
}

export function needsOnboarding(p?: Profile | null): boolean {
  if (!p) return true;
  return !p.full_name || !p.age || !p.gender || !p.standard;
}
