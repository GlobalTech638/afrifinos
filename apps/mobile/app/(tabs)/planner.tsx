import { useState } from "react";
import { Text, View } from "react-native";
import { api, formatMinor, type AffordabilityResult } from "../../lib/api";
import { Button, Card, ErrorText, Field, Heading, Label, Screen } from "../../components/ui";
import { colors } from "../../lib/theme";
import { useAuth } from "../../providers/auth-provider";

function parseMinor(value: string, currency: string): string | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,3})?$/.test(normalized)) return null;
  const zeroDecimal = new Set(["UGX", "RWF", "JPY", "XOF", "XAF", "BIF", "GNF", "KMF"]).has(currency);
  const digits = zeroDecimal ? 0 : 2;
  const [whole = "0", fraction = ""] = normalized.split(".");
  if (digits === 0 && Number(fraction) !== 0) return null;
  const minor = BigInt(whole) * (10n ** BigInt(digits)) + BigInt(digits ? (fraction + "0".repeat(digits)).slice(0, digits) : "0");
  return minor > 0n ? minor.toString() : null;
}

export default function PlannerScreen() {
  const { session } = useAuth();
  const [amount, setAmount] = useState("");
  const [recurring, setRecurring] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [result, setResult] = useState<AffordabilityResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function assess() {
    if (!session) return;
    const code = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) { setError("Enter a three-letter currency code."); return; }
    const amountMinor = parseMinor(amount, code);
    const recurringMinor = recurring.trim() ? parseMinor(recurring, code) : "0";
    if (!amountMinor) { setError("Enter a valid purchase amount."); return; }
    if (recurring.trim() && !recurringMinor) { setError("Enter a valid recurring monthly cost."); return; }
    setBusy(true); setError(""); setResult(null);
    try {
      setResult(await api.affordability(session, amountMinor, code, recurringMinor ?? "0"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to assess affordability");
    } finally { setBusy(false); }
  }

  return <Screen>
    <Heading eyebrow="Decision support" title="Can I afford it?" subtitle="Stress-test a purchase against your cash-flow forecast and safety buffer." />
    <Card>
      <Label>Purchase amount</Label>
      <Field value={amount} onChangeText={setAmount} placeholder="e.g. 45000.00" keyboardType="decimal-pad" />
      <Label>Additional recurring monthly cost (optional)</Label>
      <Field value={recurring} onChangeText={setRecurring} placeholder="e.g. 2500.00" keyboardType="decimal-pad" />
      <Label>Currency</Label>
      <Field value={currency} onChangeText={(value) => setCurrency(value.toUpperCase())} autoCapitalize="characters" maxLength={3} placeholder="KES" />
      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>This is a planning estimate based on the financial data currently recorded in AfriFinos. It is not a credit decision or a guarantee of future cash availability.</Text>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title="Assess affordability" onPress={() => void assess()} busy={busy} disabled={!amount.trim()} />
    </Card>
    {result ? <Card style={{ borderColor: result.decision.toLowerCase().includes("not") || result.decision.toLowerCase().includes("unaffordable") ? colors.danger : colors.teal }}>
      <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1 }}>ASSESSMENT</Text>
      <Text style={{ color: colors.ink, fontSize: 25, fontWeight: "900" }}>{result.decision.replace(/[_-]/g, " ").toUpperCase()}</Text>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Projected minimum balance</Text>
        <Text style={{ color: colors.ink, fontSize: 21, fontWeight: "800" }}>{formatMinor(result.projectedMinimumBalanceMinor, currency.trim().toUpperCase())}</Text>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Safety-buffer shortfall</Text>
        <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "800" }}>{formatMinor(result.bufferShortfallMinor, currency.trim().toUpperCase())}</Text>
      </View>
      {result.reasons?.length ? <View style={{ gap: 8 }}><Text style={{ color: colors.ink, fontWeight: "800" }}>Why this result?</Text>{result.reasons.map((reason, index) => <Text key={index} style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>• {reason}</Text>)}</View> : null}
    </Card> : null}
  </Screen>;
}
