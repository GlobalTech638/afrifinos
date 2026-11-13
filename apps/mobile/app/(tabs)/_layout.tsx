import { Tabs } from "expo-router";
import { colors } from "../../lib/theme";

export default function TabLayout() {
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.teal,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { height: 66, paddingTop: 8, paddingBottom: 8, borderTopColor: colors.line, backgroundColor: colors.white },
    tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
  }}>
    <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: () => null }} />
    <Tabs.Screen name="transactions" options={{ title: "Activity", tabBarIcon: () => null }} />
    <Tabs.Screen name="accounts" options={{ title: "Accounts", tabBarIcon: () => null }} />
    <Tabs.Screen name="insights" options={{ title: "Insights", tabBarIcon: () => null }} />
    <Tabs.Screen name="planner" options={{ title: "Planner", tabBarIcon: () => null }} />
    <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: () => null }} />
  </Tabs>;
}
