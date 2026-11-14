import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../providers/auth-provider";
import { colors } from "../lib/theme";

export default function IndexRoute() {
  const { session, ready } = useAuth();
  if (!ready) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}><ActivityIndicator color={colors.teal} /></View>;
  return <Redirect href={session ? "/(tabs)" : "/sign-in"} />;
}
