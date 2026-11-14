import { useCallback, useState } from "react";
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
      setData(nextAccounts.length >= 2 ? await api.intelligence(session, "KES") : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your dashboard");
    } finally { setLoading(false); }
  }, [session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <Screen>
    <Heading eyebrow="AFRIFINOS · YOUR MONEY" title="Good morning 👋" subtitle="Here's your financial snapshot." action={<View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.lavender, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.blue, fontSize: 19 }}>◉</Text></View>} />
    {error ? <Card><Text style={{ color: colors.danger }}>{error}</Text><Button title="Try again" onPress={() => void load()} secondary /></Card> : null}
    <Card style={{ backgroundColor: colors.blue, borderColor: colors.blue, padding: 21, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: "#E8E6FF", fontSize: 12, fontWeight: "800" }}>TOTAL BALANCE · KES</Text>
        <Text style={{ color: colors.blue, backgroundColor: "#E2FFF6", overflow: "hidden", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, fontSize: 10, fontWeight: "900" }}>● ACTIVE</Text>
      </View>
      <Text style={{ color: colors.white, fontSize: 33, fontWeight: "900", marginTop: 9 }}>{data ? formatMinor(data.summary.liquidBalanceMinor, data.currency) : loading ? "Loading…" : "—"}</Text>
      <Text style={{ color: "#E8E6FF", fontSize: 11, marginTop: 6 }}>{accounts.length} connected accounts</Text>
      <View style={{ height: 1, backgroundColor: "#FFFFFF40", marginTop: 18, marginBottom: 14 }} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Link href="/add-transaction" asChild><Pressable style={{ flex: 1, backgroundColor: colors.white, borderRadius: 13, paddingVertical: 12, alignItems: "center" }}><Text style={{ color: colors.blue, fontWeight: "900", fontSize: 12 }}>＋ Send / record</Text></Pressable></Link>
        <Link href="/(tabs)/accounts" asChild><Pressable style={{ flex: 1, backgroundColor: "#514BE7", borderRadius: 13, paddingVertical: 12, alignItems: "center" }}><Text style={{ color: colors.white, fontWeight: "900", fontSize: 12 }}>＋ Add account</Text></Pressable></Link>
      </View>
    </Card>
    <View style={{ gap: 10 }}>
      <Heading title="Quick overview" subtitle="Your recorded cash flow and savings." />
      <View style={{ flexDirection: "row", gap: 9 }}>
        <View style={{ flex: 1 }}>{data ? <Stat label="↑ INCOME" value={formatMinor(data.summary.cashFlow.incomeMinor, data.currency)} note="This period" /> : <Stat label="↑ INCOME" value="—" />}</View>
        <View style={{ flex: 1 }}>{data ? <Stat label="↓ EXPENSES" value={formatMinor(data.summary.cashFlow.expenseMinor, data.currency)} note="This period" /> : <Stat label="↓ EXPENSES" value="—" />}</View>
      </View>
      <View style={{ flexDirection: "row", gap: 9 }}>
        <View style={{ flex: 1 }}><Stat label="✧ SAVINGS RATE" value={data?.summary.savings.savingsRate == null ? "—" : `${(data.summary.savings.savingsRate * 100).toFixed(1)}%`} note="Income less spending" /></View>
        <View style={{ flex: 1 }}><Stat label="◉ MONEY HEALTH" value={data ? `${data.summary.healthScore.score}/100` : "—"} note={data?.summary.healthScore.band ?? "Health score"} /></View>
      </View>
    </View>
    <Card style={{ backgroundColor: colors.lavender, borderColor: colors.lavender }}>
      <Text style={{ color: colors.blue, fontSize: 10, fontWeight: "900", letterSpacing: 1 }}>✦ YOUR FINANCIAL INSIGHT</Text>
      <Text style={{ color: colors.ink, fontWeight: "900", fontSize: 16 }}>Make every shilling count.</Text>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Review your cash-flow forecast and financial signals to make more confident decisions.</Text>
      <Link href="/(tabs)/insights" asChild><Pressable style={{ alignSelf: "flex-start", backgroundColor: colors.blue, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20 }}><Text style={{ color: colors.white, fontWeight: "900", fontSize: 11 }}>Explore insights →</Text></Pressable></Link>
    </Card>
    <Card>
      <Heading title="Your outlook" subtitle="Based on recorded activity." />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 10 }}>Projected balance</Text><Text style={{ color: colors.ink, fontWeight: "900", fontSize: 16 }}>{data ? formatMinor(data.forecast.endingBalanceMinor, data.currency) : "—"}</Text></View>
        <View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 10 }}>Minimum balance</Text><Text style={{ color: colors.ink, fontWeight: "900", fontSize: 16 }}>{data ? formatMinor(data.forecast.minimumProjectedBalanceMinor, data.currency) : "—"}</Text></View>
      </View>
    </Card>
    {accounts.length < 2 ? <Card>
      <Heading title="Complete your setup" subtitle="Add at least two accounts to unlock full double-entry transaction recording and financial intelligence." />
      <Link href="/(tabs)/accounts" asChild><Pressable style={{ backgroundColor: colors.blue, borderRadius: 13, padding: 13, alignItems: "center" }}><Text style={{ color: colors.white, fontWeight: "900" }}>Set up accounts</Text></Pressable></Link>
    </Card> : null}
    <Card>
      <Heading title="My accounts" subtitle="Your connected financial accounts." />
      {accounts.length === 0 ? <Text style={{ color: colors.muted, fontSize: 12 }}>Add accounts to begin building your financial picture.</Text> : accounts.slice(0, 4).map((account) =>
        <View key={account.accountId} style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between" }}>
          <View><Text style={{ color: colors.ink, fontWeight: "800" }}>{account.name}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{account.type.replace("_", " ")} · {account.currency}</Text></View>
          <Text style={{ color: colors.success, fontSize: 10, fontWeight: "900" }}>{account.status}</Text>
        </View>)}
    </Card>
  </Screen>;
}
