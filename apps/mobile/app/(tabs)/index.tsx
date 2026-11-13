import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { api, formatMinor, type Account, type Intelligence } from "../../lib/api";
import { Button, Card, Heading, Screen, Stat } from "../../components/ui";
import { colors } from "../../lib/theme";
import { useAuth } from "../../providers/auth-provider";

export default function DashboardScreen() {
  const { session } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [data, setData] = useState<Intelligence | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError("");
    try {
      const nextAccounts = await api.accounts(session);
      setAccounts(nextAccounts);
      if (nextAccounts.length < 2) {
        setData(null);
        return;
      }
      setData(await api.intelligence(session, "KES"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your dashboard");
    } finally { setLoading(false); }
  }, [session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <Screen>
    <Heading eyebrow="AfriFinos overview" title="Good money habits start here." subtitle="Your financial position, in one place." action={<Text style={{ color: colors.teal, fontWeight: "900", fontSize: 12 }}>● LIVE</Text>} />
    {error ? <Card><Text style={{ color: colors.danger }}>{error}</Text><Button title="Try again" onPress={() => void load()} secondary /></Card> : null}
    <Card style={{ backgroundColor: colors.navy, borderColor: colors.navy, padding: 22 }}>
      <Text style={{ color: "#C8D7EA", fontSize: 12, fontWeight: "700" }}>TOTAL LIQUID BALANCE · KES</Text>
      <Text style={{ color: colors.white, fontSize: 32, fontWeight: "900", marginTop: 8 }}>{data ? formatMinor(data.summary.liquidBalanceMinor, data.currency) : loading ? "Loading…" : "—"}</Text>
      <Text style={{ color: "#C8D7EA", fontSize: 11, marginTop: 7 }}>{accounts.length} connected accounts · updated when you open the app</Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
        <Link href="/add-transaction" asChild><Pressable style={{ backgroundColor: colors.teal, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 }}><Text style={{ color: colors.white, fontWeight: "800", fontSize: 12 }}>+ Add transaction</Text></Pressable></Link>
        <Link href="/(tabs)/accounts" asChild><Pressable style={{ backgroundColor: "#294563", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 }}><Text style={{ color: colors.white, fontWeight: "800", fontSize: 12 }}>Manage accounts</Text></Pressable></Link>
      </View>
    </Card>
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1 }}>{data ? <Stat label="Income" value={formatMinor(data.summary.cashFlow.incomeMinor, data.currency)} note="Recorded income" /> : <Stat label="Income" value="—" />}</View>
      <View style={{ flex: 1 }}>{data ? <Stat label="Expenses" value={formatMinor(data.summary.cashFlow.expenseMinor, data.currency)} note="Net of refunds" /> : <Stat label="Expenses" value="—" />}</View>
    </View>
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1 }}><Stat label="Savings rate" value={data?.summary.savings.savingsRate == null ? "—" : `${(data.summary.savings.savingsRate * 100).toFixed(1)}%`} note="Income less spending" /></View>
      <View style={{ flex: 1 }}><Stat label="Financial health" value={data ? `${data.summary.healthScore.score}/100` : "—"} note={data?.summary.healthScore.band ?? "Health score"} /></View>
    </View>
    <Card>
      <Heading title="Your outlook" subtitle="Forecast based on recorded activity." />
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 11 }}>Projected balance</Text><Text style={{ color: colors.ink, fontWeight: "800", fontSize: 16 }}>{data ? formatMinor(data.forecast.endingBalanceMinor, data.currency) : "—"}</Text></View>
        <View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 11 }}>Minimum balance</Text><Text style={{ color: colors.ink, fontWeight: "800", fontSize: 16 }}>{data ? formatMinor(data.forecast.minimumProjectedBalanceMinor, data.currency) : "—"}</Text></View>
      </View>
    </Card>
    {accounts.length < 2 ? <Card>
      <Heading title="Finish setting up" subtitle="Add at least two accounts to unlock balanced double-entry transaction recording and your full financial intelligence." />
      <Link href="/(tabs)/accounts" asChild><Pressable style={{ backgroundColor: colors.navy, borderRadius: 12, padding: 13, alignItems: "center" }}><Text style={{ color: colors.white, fontWeight: "800" }}>Set up accounts</Text></Pressable></Link>
    </Card> : null}
    <Card>
      <Heading title="Accounts" subtitle="Your connected financial accounts." />
      {accounts.length === 0 ? <Text style={{ color: colors.muted, fontSize: 12 }}>Add accounts to begin building your financial picture.</Text> : accounts.slice(0, 4).map((account) =>
        <View key={account.accountId} style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between" }}>
          <View><Text style={{ color: colors.ink, fontWeight: "700" }}>{account.name}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{account.type.replace("_", " ")} · {account.currency}</Text></View>
          <Text style={{ color: colors.success, fontSize: 11, fontWeight: "800" }}>{account.status}</Text>
        </View>)}
    </Card>
  </Screen>;
}
