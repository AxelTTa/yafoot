import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";

function Icon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
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
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 58 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
        tabBarIconStyle: { marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Matches", tabBarIcon: ({ focused }) => <Icon emoji="⚽" focused={focused} /> }}
      />
      <Tabs.Screen
        name="predict"
        options={{ title: "Predict", tabBarIcon: ({ focused }) => <Icon emoji="🎯" focused={focused} /> }}
      />
      <Tabs.Screen
        name="leagues"
        options={{ title: "Leagues", tabBarIcon: ({ focused }) => <Icon emoji="🏆" focused={focused} /> }}
      />
      <Tabs.Screen
        name="social"
        options={{ title: "Friends", tabBarIcon: ({ focused }) => <Icon emoji="👥" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ focused }) => <Icon emoji="👤" focused={focused} /> }}
      />
    </Tabs>
  );
}
