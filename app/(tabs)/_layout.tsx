import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View
      style={{
        width: 46,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? colors.bleu : "transparent",
      }}
    >
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blanc,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.elevated,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 10,
          position: "absolute",
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "800", marginTop: 1 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Matches", tabBarIcon: ({ focused }) => <TabIcon emoji="⚽" focused={focused} /> }} />
      <Tabs.Screen name="predict" options={{ title: "Predict", tabBarIcon: ({ focused }) => <TabIcon emoji="🎯" focused={focused} /> }} />
      <Tabs.Screen name="leagues" options={{ title: "Leagues", tabBarIcon: ({ focused }) => <TabIcon emoji="🏆" focused={focused} /> }} />
      <Tabs.Screen name="social" options={{ title: "Friends", tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }} />
    </Tabs>
  );
}
