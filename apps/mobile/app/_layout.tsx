import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../providers/auth-provider";
import { colors } from "../lib/theme";

export default function RootLayout() {
  return <AuthProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="add-transaction" options={{ presentation: "modal", headerShown: true, title: "Add transaction", headerStyle: { backgroundColor: colors.canvas }, headerTintColor: colors.ink }} />
    </Stack>
  </AuthProvider>;
}
