import Constants from "expo-constants";
import { usePathname, useSegments } from "expo-router";
import React, { createContext, useContext, useEffect, useMemo } from "react";
import { Platform } from "react-native";

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

type AnalyticsClient = {
  capture: (event: string, properties?: AnalyticsProps) => void | Promise<void>;
  identify?: (distinctId: string, properties?: AnalyticsProps) => void | Promise<void>;
  reset?: () => void | Promise<void>;
  screen?: (name: string, properties?: AnalyticsProps) => void | Promise<void>;
};

const extra = (Constants.expoConfig?.extra ?? {}) as {
  posthogApiKey?: string;
  posthogHost?: string;
};

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || extra.posthogApiKey || "";
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || extra.posthogHost || "";
const NATIVE_REPLAY_ENABLED =
  process.env.EXPO_PUBLIC_POSTHOG_NATIVE_SESSION_REPLAY === "1" && Constants.appOwnership !== "expo";

let client: AnalyticsClient | null = null;
let initStarted = false;
let identifiedId: string | null = null;
let lastScreen: string | null = null;

export const analyticsEnabled = Boolean(POSTHOG_API_KEY && POSTHOG_HOST);
export const posthogMissingEnv = analyticsEnabled ? [] : ["EXPO_PUBLIC_POSTHOG_API_KEY", "EXPO_PUBLIC_POSTHOG_HOST"];

function cleanProps(properties?: AnalyticsProps) {
  if (!properties) return undefined;
  return Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined));
}

function normalizePath(pathname: string) {
  return pathname
    .replace(/\/invite\/[^/?#]+/g, "/invite/[code]")
    .replace(/\/join\/[^/?#]+/g, "/join/[code]")
    .replace(/\/(match|stats|league|chat)\/[^/?#]+/g, "/$1/[id]");
}

function screenNameFromSegments(segments: string[]) {
  const visible = segments.filter((segment) => !segment.startsWith("("));
  return visible.length ? visible.join("/") : "home";
}

export async function initAnalytics() {
  if (initStarted || !analyticsEnabled) return;
  initStarted = true;

  if (Platform.OS === "web") {
    const mod = await import("posthog-js");
    const posthog = mod.default;
    posthog.init(POSTHOG_API_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: true,
      capture_pageview: false,
      disable_session_recording: false,
      mask_all_element_attributes: true,
      session_recording: {
        masking: {
          maskAllInputs: true,
          maskTextSelector: "input, textarea, [contenteditable=true], [data-ph-mask]",
          blockSelector: "[data-ph-block]",
        },
        networkPayloadCapture: { recordBody: false, recordHeaders: false },
      },
      loaded: (loadedClient: AnalyticsClient) => {
        client = loadedClient;
      },
    } as any);
    client = posthog as unknown as AnalyticsClient;
    return;
  }

  const mod = await import("posthog-react-native");
  const PostHog = mod.default;
  client = new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,
    captureAppLifecycleEvents: true,
    enableSessionReplay: NATIVE_REPLAY_ENABLED,
    sessionReplayConfig: {
      maskAllTextInputs: true,
      maskAllImages: true,
      maskAllSandboxedViews: true,
      captureLog: false,
      captureNetworkTelemetry: false,
      throttleDelayMs: 1000,
    },
    errorTracking: {
      autocapture: { uncaughtExceptions: true, unhandledRejections: true },
    },
  }) as unknown as AnalyticsClient;
}

export function track(event: string, properties?: AnalyticsProps) {
  if (!client) return;
  void client.capture(event, cleanProps(properties));
}

export function trackScreen(name: string, properties?: AnalyticsProps) {
  if (!client || lastScreen === name) return;
  lastScreen = name;
  if (client.screen) void client.screen(name, cleanProps(properties));
  else void client.capture("$pageview", cleanProps({ ...properties, $current_url: properties?.path }));
}

export function identifyAnalyticsUser(userId: string, properties?: AnalyticsProps) {
  if (!client || identifiedId === userId) return;
  identifiedId = userId;
  void client.identify?.(userId, cleanProps(properties));
}

export function resetAnalyticsUser() {
  identifiedId = null;
  void client?.reset?.();
}

export function captureError(error: unknown, context: string, properties?: AnalyticsProps) {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  track("app_error", { context, message: message.slice(0, 180), ...properties });
}

const AnalyticsContext = createContext({ enabled: analyticsEnabled });

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => ({ enabled: analyticsEnabled }), []);

  useEffect(() => {
    initAnalytics().catch((error) => {
      console.warn("PostHog init failed", error);
    });
  }, []);

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics() {
  return useContext(AnalyticsContext);
}

export function useRouteAnalytics() {
  const pathname = usePathname();
  const segments = useSegments();

  useEffect(() => {
    if (!analyticsEnabled || !pathname) return;
    const path = normalizePath(pathname);
    const name = screenNameFromSegments(segments as string[]);
    trackScreen(name, { path, platform: Platform.OS });
  }, [pathname, segments]);
}
