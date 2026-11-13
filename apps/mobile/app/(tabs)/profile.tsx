import { Alert, Text, View } from "react-native";
import { Button, Card, Heading, Screen } from "../../components/ui";
import { colors } from "../../lib/theme";
import { useAuth } from "../../providers/auth-provider";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  async function confirmSignOut() {
    try { await signOut(); }
    catch (cause) { Alert.alert("Unable to sign out", cause instanceof Error ? cause.message : "Please try again."); }
  }
  return <Screen>
    <Heading eyebrow="ACCOUNT & SECURITY" title="Profile" subtitle="Your identity, preferences and account protection." />
    <Card style={{ alignItems: "center", paddingVertical: 24 }}>
      <View style={{ width: 70, height: 70, borderRadius: 25, backgroundColor: colors.lavender, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.blue, fontSize: 30, fontWeight: "900" }}>A</Text></View>
      <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{session?.user.email ?? "Authenticated user"}</Text>
      <Text style={{ color: colors.muted, fontSize: 11 }}>AfriFinos account</Text>
      <Text style={{ color: colors.success, fontSize: 10, fontWeight: "900", backgroundColor: colors.mint, overflow: "hidden", borderRadius: 15, paddingHorizontal: 12, paddingVertical: 6 }}>● SESSION ACTIVE</Text>
    </Card>
    <Card>
      <Heading title="Security & privacy" subtitle="Your financial data deserves strong protection." />
      {["Secure device session storage", "Authenticated API requests", "Protected account access"].map((item) => <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}><Text style={{ color: colors.success, fontWeight: "900" }}>✓</Text><Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{item}</Text></View>)}
      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 18 }}>Identity is managed by your configured AfriFinos authentication provider. Always protect your device, use a strong screen lock, and sign out on shared devices.</Text>
    </Card>
    <Card>
      <Heading title="About AfriFinos" subtitle="Your money. Your control." />
      <Text style={{ color: colors.muted, fontSize: 12 }}>Version 0.1.0 · Mobile preview</Text>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Budgets, savings goals, M-Pesa integrations, notifications and offline synchronization will be enabled as their backend services are delivered.</Text>
    </Card>
    <Button title="Sign out" onPress={() => void confirmSignOut()} secondary />
  </Screen>;
}
