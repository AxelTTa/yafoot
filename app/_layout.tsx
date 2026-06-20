import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/auth";
import { I18nProvider, getSavedLang } from "../lib/i18n";
import { Loading } from "../components/ui";
import { colors } from "../lib/theme";

if (typeof document !== "undefined" && !document.getElementById("yf-ionicons")) {
  const s = document.createElement("style");
  s.id = "yf-ionicons";
  s.textContent = "@font-face{font-family:'ionicons';src:url('/fonts/ionicons.ttf') format('truetype');font-display:block;}";
  document.head.appendChild(s);
}

function RootNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    const inInvite = segments[0] === "invite";
    const inJoin = segments[0] === "join";
    const inOnboarding = segments[0] === "onboarding";

    if (!session && !inAuth && !inInvite && !inJoin) {
      // First time: check if language is already chosen
      getSavedLang().then((lang) => {
        if (lang) router.replace("/(auth)/welcome");
        else router.replace("/(auth)/language");
      });
    } else if (session && inAuth) {
      router.replace("/(tabs)");
    }
  }, [session, loading, segments]);

  if (loading) return <Loading />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding/invite" />
      <Stack.Screen name="invite/[code]" />
      <Stack.Screen name="join/[code]" />
      <Stack.Screen name="match/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="stats/[id]" />
      <Stack.Screen name="league/[id]" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="create-league" />
      <Stack.Screen name="soiree/index" />
      <Stack.Screen name="soiree/[id]" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNav />
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
