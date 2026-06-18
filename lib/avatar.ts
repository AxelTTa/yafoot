import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";
import { notify } from "./notify";

// base64 -> ArrayBuffer (Hermes/RN has global atob)
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function uploadAndUrl(userId: string, ext: string, body: any, contentType: string): Promise<string | null> {
  const path = `${userId}/${Date.now()}.${ext.replace(/[^a-z0-9]/gi, "") || "jpg"}`;
  const { error } = await supabase.storage.from("avatars").upload(path, body, { upsert: true, contentType });
  if (error) {
    notify("Upload failed", error.message);
    return null;
  }
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`; // cache-bust so the new photo shows immediately
}

// Pick an image (native: photo library; web: file dialog) and upload to the avatars bucket.
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  // ---- Web ----
  if (Platform.OS === "web") {
    if (typeof document === "undefined") return null;
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.position = "fixed";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      const cleanup = () => { try { document.body.removeChild(input); } catch {} };
      input.onchange = async () => {
        const file = input.files && input.files[0];
        cleanup();
        if (!file) return resolve(null);
        const ext = (file.name.split(".").pop() || "png").toLowerCase();
        resolve(await uploadAndUrl(userId, ext, file, file.type || "image/jpeg"));
      };
      input.click();
    });
  }

  // ---- Native (Expo Go / dev build / App Store) ----
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    notify("Permission needed", "Allow photo access to set a profile picture.");
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  if (!asset.base64) {
    notify("Couldn't read image", "Please try a different photo.");
    return null;
  }
  const ext = (asset.uri.split(".").pop() || "jpg").toLowerCase();
  return uploadAndUrl(userId, ext, b64ToBytes(asset.base64), asset.mimeType || "image/jpeg");
}
