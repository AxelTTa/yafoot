import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const KEY = "yafoot.pendingInvite";
export const APP_STORE_URL = "https://apps.apple.com/us/app/yafoot/id6782063727";

export async function setPendingInvite(code: string) {
  try { await AsyncStorage.setItem(KEY, code); } catch {}
}
export async function getPendingInvite(): Promise<string | null> {
  try { return await AsyncStorage.getItem(KEY); } catch { return null; }
}
export async function clearPendingInvite() {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}

// Consume a pending invite (after the user has a session): auto-friend the inviter.
export async function consumePendingInvite(): Promise<string | null> {
  const code = await getPendingInvite();
  if (!code) return null;
  await clearPendingInvite();
  const { data } = await supabase.rpc("add_friend_by_username", { p_username: code });
  return (data as string) ?? null;
}

export function inviteBase(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "https://dist-five-zeta-92i4a6g3xx.vercel.app";
}
export function inviteLink(username: string): string {
  return `${inviteBase()}/invite/${encodeURIComponent(username)}`;
}
export function joinLink(code: string): string {
  return `${inviteBase()}/join/${encodeURIComponent(code)}`;
}
export function appDeepLink(path: string): string {
  return `yafoot://${path.replace(/^\//, "")}`;
}
export function openInstalledAppOrStore(path: string) {
  if (typeof window === "undefined") return;
  const started = Date.now();
  window.location.href = appDeepLink(path);
  window.setTimeout(() => {
    if (Date.now() - started < 1800 && document.visibilityState === "visible") {
      window.location.href = APP_STORE_URL;
    }
  }, 900);
}
