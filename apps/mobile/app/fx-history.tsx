import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text, View } from "react-native";
import { api, type FxConversion } from "../lib/api";
import { Button, Card, Empty, ErrorText, Heading, Screen } from "../components/ui";
import { colors } from "../lib/theme";
import { useAuth } from "../providers/auth-provider";

function formatMinor(value: string, currency: string, exponent: number): string {
  const minor = BigInt(value);
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const divisor = 10n ** BigInt(exponent);
  const whole = absolute / divisor;
  const fraction = exponent ? (absolute % divisor).toString().padStart(exponent, "0") : "";
  const formatted = new Intl.NumberFormat("en-KE", {
    style: "currency", currency, maximumFractionDigits: 0, minimumFractionDigits: 0,
  }).format(whole);
  return `${negative ? "-" : ""}${formatted}${fraction ? `.${fraction}` : ""}`;
}

export default function FxHistoryScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<FxConversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError("");
    try { setItems(await api.fxConversions(session)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load conversion history"); }
    finally { setLoading(false); }
  }, [session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <Screen>
    <Heading eyebrow="CROSS-CURRENCY ACTIVITY" title="FX conversions" subtitle="A transparent record of completed currency exchanges." />
    {error ? <ErrorText>{error}</ErrorText> : null}
    {loading ? <Empty title="Loading conversions…" detail="Retrieving your secure conversion history." /> :
      items.length === 0 ? <Empty title="No conversions yet" detail="Completed FX conversions will appear here with their original quote, rate source and execution time." /> :
      <View style={{ gap: 12 }}>
        {items.map((item) => <Card key={item.conversionId}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.blue, fontSize: 10, fontWeight: "900", letterSpacing: 1 }}>COMPLETED EXCHANGE</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>{new Date(item.executedAt).toLocaleString()}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 14 }}>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{formatMinor(item.baseAmountMinor, item.baseCurrency, item.baseMinorUnitExponent)}</Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>Sent</Text>
            </View>
            <Text style={{ color: colors.blue, fontSize: 20, fontWeight: "900" }}>→</Text>
            <View style={{ flex: 1, alignItems: "flex-end", gap: 5 }}>
              <Text style={{ color: colors.success, fontSize: 17, fontWeight: "900" }}>{formatMinor(item.quoteAmountMinor, item.quoteCurrency, item.quoteMinorUnitExponent)}</Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>Received</Text>
            </View>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, gap: 5 }}>
            <Text style={{ color: colors.muted, fontSize: 10 }}>Rate: 1 {item.baseCurrency} = {item.rate} {item.quoteCurrency}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>Source: {item.rateSource}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>Quote time: {new Date(item.quotedAt).toLocaleString()}</Text>
          </View>
        </Card>)}
      </View>}
    <Button title="Refresh history" onPress={() => void load()} busy={loading} variant="secondary" />
  </Screen>;
}
