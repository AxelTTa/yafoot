import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../lib/i18n";
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
          height: 62,
          paddingTop: 8,
          paddingBottom: 8,
          marginHorizontal: 16,
          marginBottom: insets.bottom > 0 ? insets.bottom + 6 : 12,
          position: "absolute",
          elevation: 12,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "800", marginTop: 0 },
        tabBarItemStyle: { paddingTop: 0, paddingBottom: 0 },
        tabBarIconStyle: { marginBottom: 0 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tab_matches"), tabBarIcon: ({ focused }) => <TabIcon name="football" focused={focused} /> }} />
      <Tabs.Screen name="predict" options={{ href: null }} />
      <Tabs.Screen name="leagues" options={{ title: t("tab_leagues"), tabBarIcon: ({ focused }) => <TabIcon name="podium" focused={focused} /> }} />
      <Tabs.Screen name="social" options={{ title: t("tab_friends"), tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: t("tab_profile"), tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} /> }} />
    </Tabs>
  );
}
