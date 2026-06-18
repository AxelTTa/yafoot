import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/auth";
import { Loading } from "../components/ui";
import { colors } from "../lib/theme";

function RootNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    const inInvite = segments[0] === "invite";
    if (!session && !inAuth && !inInvite) router.replace("/(auth)/welcome");
    else if (session && inAuth) router.replace("/(tabs)");
  }, [session, loading, segments]);

  if (loading) return <Loading />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding/invite" />
      <Stack.Screen name="invite/[code]" />
      <Stack.Screen name="match/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="league/[id]" />
      <Stack.Screen name="chat/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
