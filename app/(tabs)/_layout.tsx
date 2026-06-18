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
          borderRadius: 28,
          height: 70 + insets.bottom,
          paddingTop: 9,
          paddingBottom: insets.bottom + 9,
          marginHorizontal: 14,
          marginBottom: insets.bottom > 0 ? 6 : 12,
          position: "absolute",
          elevation: 12,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "800" },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarIconStyle: { marginBottom: 2 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tab_matches"), tabBarIcon: ({ focused }) => <TabIcon name="football" focused={focused} /> }} />
      <Tabs.Screen name="predict" options={{ title: t("tab_predict"), tabBarIcon: ({ focused }) => <TabIcon name="create" focused={focused} /> }} />
      <Tabs.Screen name="leagues" options={{ title: t("tab_leagues"), tabBarIcon: ({ focused }) => <TabIcon name="trophy" focused={focused} /> }} />
      <Tabs.Screen name="social" options={{ title: t("tab_friends"), tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: t("tab_profile"), tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} /> }} />
    </Tabs>
  );
}
