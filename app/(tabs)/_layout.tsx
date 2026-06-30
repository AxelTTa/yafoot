import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../lib/i18n";
import { APP_STORE_SAFE } from "../../lib/mode";
import { colors } from "../../lib/theme";

function TabIcon({ name, focused }: { name: any; focused: boolean }) {
  return (
    <View style={{ width: 44, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: focused ? colors.green : "transparent" }}>
      <Ionicons name={name} size={19} color={focused ? colors.blanc : "rgba(255,255,255,0.6)"} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blanc,
        tabBarInactiveTintColor: "rgba(255,255,255,0.55)",
        tabBarStyle: {
          backgroundColor: colors.surfaceDark,
          borderTopWidth: 0,
          borderRadius: 26,
          height: 76,
          paddingTop: 8,
          paddingBottom: 12,
          marginHorizontal: 16,
          marginBottom: insets.bottom > 0 ? insets.bottom + 10 : 16,
          position: "absolute",
          elevation: 12,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
        },
        tabBarLabelStyle: { fontSize: 10, lineHeight: 13, fontWeight: "800", marginTop: 1 },
        tabBarItemStyle: { paddingTop: 0, paddingBottom: 4 },
        tabBarIconStyle: { marginBottom: 0 },
      }}
    >
      <Tabs.Screen name="index" options={APP_STORE_SAFE ? { href: null } : { title: t("tab_matches"), tabBarIcon: ({ focused }) => <TabIcon name="football" focused={focused} /> }} />
      <Tabs.Screen name="predict" options={APP_STORE_SAFE ? { href: null } : { title: t("tab_predict"), tabBarIcon: ({ focused }) => <TabIcon name="analytics" focused={focused} /> }} />
      <Tabs.Screen name="leagues" options={{ title: APP_STORE_SAFE ? "Competitions" : t("tab_leagues"), tabBarIcon: ({ focused }) => <TabIcon name={APP_STORE_SAFE ? "podium" : "trophy"} focused={focused} /> }} />
      <Tabs.Screen name="social" options={{ title: t("tab_friends"), tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: t("tab_profile"), tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} /> }} />
    </Tabs>
  );
}
