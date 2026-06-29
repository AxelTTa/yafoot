import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Loading } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { consumePendingInvite, openInstalledAppOrStore, setPendingInvite } from "../../lib/invite";

// Deep link: /invite/<username>. If signed in -> auto-friend. If not -> stash + go to welcome.
export default function InviteCapture() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    (async () => {
      if (loading || !code) return;
      await setPendingInvite(String(code));
      if (typeof window !== "undefined") {
        openInstalledAppOrStore(`/invite/${encodeURIComponent(String(code))}`);
        return;
      }
      if (session) {
        await consumePendingInvite();
        router.replace("/(tabs)/social");
      } else {
        router.replace("/(auth)/welcome");
      }
    })();
  }, [code, session, loading]);

  return <Loading />;
}
