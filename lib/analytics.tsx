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

type PendingAnalyticsCall =
  | { type: "capture"; event: string; properties?: AnalyticsProps }
  | { type: "screen"; name: string; properties?: AnalyticsProps }
  | { type: "identify"; distinctId: string; properties?: AnalyticsProps }
  | { type: "reset" };

const extra = (Constants.expoConfig?.extra ?? {}) as {
  posthogApiKey?: string;
  posthogHost?: string;
};

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || extra.posthogApiKey || "";
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || extra.posthogHost || "https://us.i.posthog.com";
const NATIVE_REPLAY_ENABLED =
  process.env.EXPO_PUBLIC_POSTHOG_NATIVE_SESSION_REPLAY === "1" && Constants.appOwnership !== "expo";

let client: AnalyticsClient | null = null;
let initStarted = false;
let identifiedId: string | null = null;
let lastScreen: string | null = null;
const pendingCalls: PendingAnalyticsCall[] = [];

export const analyticsEnabled = Boolean(POSTHOG_API_KEY && POSTHOG_HOST);
export const posthogMissingEnv = analyticsEnabled ? [] : ["EXPO_PUBLIC_POSTHOG_API_KEY"];

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

function captureWithClient(target: AnalyticsClient, event: string, properties?: AnalyticsProps) {
  void target.capture(event, cleanProps(properties));
}

function screenWithClient(target: AnalyticsClient, name: string, properties?: AnalyticsProps) {
  if (target.screen) void target.screen(name, cleanProps(properties));
  else captureWithClient(target, "$pageview", { ...properties, $current_url: properties?.path });
}

function flushPendingCalls() {
  if (!client) return;
  const calls = pendingCalls.splice(0, pendingCalls.length);
  for (const call of calls) {
    if (call.type === "capture") captureWithClient(client, call.event, call.properties);
    else if (call.type === "screen") screenWithClient(client, call.name, call.properties);
    else if (call.type === "identify") void client.identify?.(call.distinctId, cleanProps(call.properties));
    else void client.reset?.();
  }
}

function setAnalyticsClient(nextClient: AnalyticsClient) {
  client = nextClient;
  flushPendingCalls();
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
        setAnalyticsClient(loadedClient);
      },
    } as any);
    setAnalyticsClient(posthog as unknown as AnalyticsClient);
    return;
  }

  const mod = await import("posthog-react-native");
  const PostHog = mod.default;
  setAnalyticsClient(new PostHog(POSTHOG_API_KEY, {
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
  }) as unknown as AnalyticsClient);
}

export function track(event: string, properties?: AnalyticsProps) {
  if (!analyticsEnabled) return;
  if (!client) {
    pendingCalls.push({ type: "capture", event, properties: cleanProps(properties) });
    return;
  }
  captureWithClient(client, event, properties);
}

export function trackScreen(name: string, properties?: AnalyticsProps) {
  if (!analyticsEnabled || lastScreen === name) return;
  lastScreen = name;
  if (!client) {
    pendingCalls.push({ type: "screen", name, properties: cleanProps(properties) });
    return;
  }
  screenWithClient(client, name, properties);
}

export function identifyAnalyticsUser(userId: string, properties?: AnalyticsProps) {
  if (!analyticsEnabled || identifiedId === userId) return;
  identifiedId = userId;
  if (!client) {
    pendingCalls.push({ type: "identify", distinctId: userId, properties: cleanProps(properties) });
    return;
  }
  void client.identify?.(userId, cleanProps(properties));
}

export function resetAnalyticsUser() {
  if (!analyticsEnabled) return;
  identifiedId = null;
  if (!client) {
    pendingCalls.push({ type: "reset" });
    return;
  }
  void client.reset?.();
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
