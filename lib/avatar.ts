import { Platform } from "react-native";
import { supabase } from "./supabase";
import { notify } from "./notify";

// Pick an image and upload to the 'avatars' bucket; returns the public URL.
// Web (incl. iPhone Safari) uses a native file dialog. Native apps would use expo-image-picker.
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    notify("Open the web app", "Profile photo upload is available in the YaFoot web app.");
    return null;
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    // mobile Safari requires the input to be in the DOM for the picker to open
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    const cleanup = () => { try { document.body.removeChild(input); } catch {} };
    input.onchange = async () => {
      const file = input.files && input.files[0];
      cleanup();
      if (!file) return resolve(null);
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
      if (error) {
        notify("Upload failed", error.message);
        return resolve(null);
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      resolve(`${data.publicUrl}?t=${Date.now()}`); // cache-bust so the new photo shows immediately
    };
    input.click();
  });
}
