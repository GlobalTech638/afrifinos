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
    <Heading eyebrow="Account and security" title="Profile" subtitle="Manage your AfriFinos session and app preferences." />
    <Card>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>SIGNED IN AS</Text>
      <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "800" }}>{session?.user.email ?? "Authenticated user"}</Text>
      <Text style={{ color: colors.muted, fontSize: 11 }}>Identity is managed by your configured AfriFinos authentication provider.</Text>
    </Card>
    <Card>
      <Heading title="Security" subtitle="Protect access to your financial information." />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19 }}>Your mobile session is stored using the device secure storage facility. Always protect your device, use a strong screen lock, and sign out on shared devices.</Text>
    </Card>
    <Card>
      <Heading title="About AfriFinos" subtitle="Your money. Your control." />
      <Text style={{ color: colors.muted, fontSize: 12 }}>Version 0.1.0 · Mobile preview</Text>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Budgets, savings goals, M-Pesa integrations, notifications and offline synchronization will be enabled as their backend services are delivered.</Text>
    </Card>
    <Button title="Sign out" onPress={() => void confirmSignOut()} secondary />
  </Screen>;
}
