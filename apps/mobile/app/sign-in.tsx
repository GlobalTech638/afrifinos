import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { Button, Card, ErrorText, Field, Screen } from "../components/ui";
import { colors } from "../lib/theme";
import { useAuth } from "../providers/auth-provider";

export default function SignInScreen() {
  const { session, ready, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (ready && session) return <Redirect href="/(tabs)" />;

  async function submit() {
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "signin") await signIn(email, password);
      else {
        await signUp(email, password);
        setMessage("Account created. If email confirmation is enabled, check your inbox before signing in.");
        setMode("signin");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed");
    } finally { setBusy(false); }
  }

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <Screen>
      <View style={{ paddingTop: 42, paddingBottom: 18, gap: 12 }}>
        <Text style={{ color: colors.blue, fontSize: 13, fontWeight: "900", letterSpacing: 2 }}>AFRIFINOS</Text>
        <Text style={{ color: colors.ink, fontSize: 34, fontWeight: "900", lineHeight: 40, letterSpacing: -0.8 }}>Your money.{ "\n" }Your control.</Text>
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>A clearer view of your cash, spending, savings and financial future.</Text>
      </View>
      <Card>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "800" }}>{mode === "signin" ? "Welcome back" : "Create your account"}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Secure access to your financial workspace.</Text>
        <Field value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Field value={password} onChangeText={setPassword} placeholder="Password (8+ characters)" secureTextEntry autoCapitalize="none" autoComplete={mode === "signin" ? "current-password" : "new-password"} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        {message ? <Text style={{ color: colors.success, fontSize: 12 }}>{message}</Text> : null}
        <Button title={mode === "signin" ? "Sign in" : "Create account"} onPress={() => void submit()} busy={busy} disabled={!email.trim() || password.length < 8} />
        <Button title={mode === "signin" ? "Create a new account" : "I already have an account"} onPress={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }} secondary />
      </Card>
      <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center", lineHeight: 17 }}>Your credentials are handled by the configured AfriFinos identity provider. Never share your password or one-time codes.</Text>
    </Screen>
  </KeyboardAvoidingView>;
}
