import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../lib/theme";

const glyphs: Record<string, string> = {
  index: "⌂",
  transactions: "↕",
  accounts: "▣",
  insights: "◔",
  planner: "✧",
  profile: "○",
};

export default function TabLayout() {
  return <Tabs screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: colors.blue,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { height: 70, paddingTop: 7, paddingBottom: 9, borderTopColor: colors.line, backgroundColor: colors.white, elevation: 12 },
    tabBarLabelStyle: { fontSize: 10, fontWeight: "800" },
    tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22, fontWeight: "800" }}>{glyphs[route.name] ?? "•"}</Text>,
  })}>
    <Tabs.Screen name="index" options={{ title: "Home" }} />
    <Tabs.Screen name="transactions" options={{ title: "Activity" }} />
    <Tabs.Screen name="accounts" options={{ title: "Accounts" }} />
    <Tabs.Screen name="insights" options={{ title: "Insights" }} />
    <Tabs.Screen name="planner" options={{ title: "Plan" }} />
    <Tabs.Screen name="profile" options={{ title: "Profile" }} />
  </Tabs>;
}
