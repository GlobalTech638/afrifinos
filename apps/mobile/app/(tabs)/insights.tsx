import { useCallback, useState } from "react";
import { Link } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Text, View } from "react-native";
import { api, formatMinor, type Intelligence } from "../../lib/api";
import { Button, Card, Empty, Heading, Screen, Stat } from "../../components/ui";
import { colors } from "../../lib/theme";
import { useAuth } from "../../providers/auth-provider";

export default function InsightsScreen() {
  const { session } = useAuth();
  const [data, setData] = useState<Intelligence | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError("");
    try { setData(await api.intelligence(session, "KES")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load insights"); }
    finally { setLoading(false); }
  }, [session]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <Screen>
    <Heading eyebrow="Financial intelligence" title="Your insights" subtitle="See the patterns behind your money and plan your next move." />
    <Link href="/(tabs)/planner" asChild><Text style={{ color: colors.white, backgroundColor: colors.blue, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, overflow: "hidden", fontWeight: "800", textAlign: "center" }}>Check purchase affordability →</Text></Link>
    {error ? <Card><Text style={{ color: colors.danger }}>{error}</Text><Button title="Retry" onPress={() => void load()} secondary /></Card> : null}
    {loading ? <Empty title="Preparing insights…" detail="Analyzing your recorded financial activity." /> : data ? <>
      <Card style={{ backgroundColor: colors.lavender, borderColor: colors.lavender }}>
        <Text style={{ color: colors.blue, fontSize: 11, fontWeight: "800" }}>FINANCIAL HEALTH SCORE</Text>
        <Text style={{ color: colors.ink, fontSize: 42, fontWeight: "900" }}>{data.summary.healthScore.score}<Text style={{ fontSize: 16, color: colors.blue }}>/100</Text></Text>
        <Text style={{ color: "#C8D7EA", fontSize: 12 }}>{data.summary.healthScore.band.toUpperCase()}</Text>
        <View style={{ height: 7, backgroundColor: colors.lavenderStrong, borderRadius: 9, marginTop: 8 }}><View style={{ height: 7, width: `${Math.max(0, Math.min(100, data.summary.healthScore.score))}%`, backgroundColor: colors.blue, borderRadius: 9 }} /></View>
      </Card>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Stat label="Savings rate" value={data.summary.savings.savingsRate == null ? "—" : `${(data.summary.savings.savingsRate * 100).toFixed(1)}%`} /></View>
        <View style={{ flex: 1 }}><Stat label="Debt burden" value={data.summary.debt.debtBurdenRatio == null ? "—" : `${(data.summary.debt.debtBurdenRatio * 100).toFixed(1)}%`} /></View>
      </View>
      <Card><Heading title="Cash-flow forecast" subtitle="Projection from recorded income, expenses and commitments." />
        <View style={{ gap: 12 }}>
          <View><Text style={{ color: colors.muted, fontSize: 11 }}>Projected ending balance</Text><Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{formatMinor(data.forecast.endingBalanceMinor, data.currency)}</Text></View>
          <View><Text style={{ color: colors.muted, fontSize: 11 }}>Projected minimum balance</Text><Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{formatMinor(data.forecast.minimumProjectedBalanceMinor, data.currency)}</Text></View>
          <View><Text style={{ color: colors.muted, fontSize: 11 }}>Cash runway</Text><Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{data.forecast.runwayDays == null ? "Beyond forecast horizon" : `${data.forecast.runwayDays} days`}</Text></View>
        </View>
      </Card>
      <Card><Heading title="Financial signals" subtitle="Items worth reviewing." />
        {data.facts.length ? data.facts.map((fact) => <View key={fact.id} style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 11, gap: 4 }}><Text style={{ color: colors.ink, fontWeight: "700", fontSize: 13 }}>{fact.statement}</Text><Text style={{ color: fact.severity === "critical" ? colors.danger : colors.muted, fontSize: 10, fontWeight: "800" }}>{(fact.severity ?? "info").toUpperCase()}</Text></View>) : <Text style={{ color: colors.muted, fontSize: 12 }}>No material signals detected.</Text>}
      </Card>
      <Card><Heading title="Recurring commitments" subtitle="Patterns detected in your transactions." />
        {data.temporal.recurring.length ? data.temporal.recurring.slice(0, 6).map((item) => <View key={item.key} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.line }}><View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontWeight: "700", fontSize: 12 }}>{item.description}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>{item.cadence}</Text></View><Text style={{ color: colors.ink, fontWeight: "800", fontSize: 12 }}>{formatMinor(item.averageAmountMinor, data.currency)}</Text></View>) : <Text style={{ color: colors.muted, fontSize: 12 }}>Not enough activity to detect recurring patterns.</Text>}
      </Card>
    </> : null}
  </Screen>;
}
