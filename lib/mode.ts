import Constants from "expo-constants";

declare const process: { env?: Record<string, string | undefined> };

const extra = (Constants.expoConfig?.extra ?? {}) as { appStoreSafe?: boolean | string };

function envFlag(value: string | undefined) {
  if (value == null || value === "") return null;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

const envSafe = envFlag(process.env?.EXPO_PUBLIC_APP_STORE_SAFE);
const extraSafe =
  typeof extra.appStoreSafe === "string"
    ? envFlag(extra.appStoreSafe)
    : typeof extra.appStoreSafe === "boolean"
      ? extra.appStoreSafe
      : null;

export const APP_STORE_SAFE = envSafe ?? extraSafe ?? true;
export const SAFE_COMPETITION = "YaFoot Challenge";
