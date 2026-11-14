import { useCallback, useMemo, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { api, formatMinor, shortDate, type Transaction } from "../../lib/api";
import { Button, Card, Empty, Heading, Screen } from "../../components/ui";
import { colors } from "../../lib/theme";
import { useAuth } from "../../providers/auth-provider";

type Filter = "all" | "income" | "expense";

export default function TransactionsScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError("");
    try { setItems(await api.transactions(session)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load transactions"); }
    finally { setLoading(false); }
  }, [session]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const filtered = useMemo(() => items.filter((item) => filter === "all" || item.type === filter || (filter === "income" && item.type === "refund")), [items, filter]);

  return <Screen>
    <Heading eyebrow="YOUR MONEY MOVEMENT" title="Activity" subtitle="Every payment, deposit and transfer, all in one place." />
    <Card style={{ backgroundColor: colors.lavender, borderColor: colors.lavender }}>
      <Text style={{ color: colors.blue, fontSize: 10, fontWeight: "900", letterSpacing: 1 }}>TRANSACTION TRACKER</Text>
      <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{items.length} recorded transactions</Text>
      <Text style={{ color: colors.muted, fontSize: 11 }}>Your financial activity updates as you record transactions.</Text>
      <Link href="/add-transaction" asChild><Pressable style={{ backgroundColor: colors.blue, padding: 13, borderRadius: 13, alignItems: "center" }}><Text style={{ color: colors.white, fontWeight: "900", fontSize: 12 }}>＋ Record a transaction</Text></Pressable></Link>
    </Card>
    <View style={{ flexDirection: "row", gap: 8 }}>
      {(["all", "income", "expense"] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={{ flex: 1, paddingVertical: 11, borderRadius: 20, alignItems: "center", backgroundColor: filter === value ? colors.blue : colors.white, borderWidth: 1, borderColor: filter === value ? colors.blue : colors.line }}><Text style={{ color: filter === value ? colors.white : colors.muted, fontWeight: "900", fontSize: 11 }}>{value === "all" ? "All" : value === "income" ? "Income" : "Expenses"}</Text></Pressable>)}
    </View>
    {error ? <Card><Text style={{ color: colors.danger }}>{error}</Text><Button title="Retry" onPress={() => void load()} secondary /></Card> : null}
    {loading ? <Empty title="Loading activity…" detail="Fetching your latest recorded transactions." /> :
      filtered.length === 0 ? <Empty title="Nothing to show yet" detail={filter === "all" ? "When you record or import transactions, they will appear here." : `No ${filter} transactions found.`} /> :
      <Card>
        <Heading title="Recent activity" subtitle="Latest recorded money movements." />
        {filtered.map((item, index) => <View key={item.transactionId} style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.line }}>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: item.type === "income" || item.type === "refund" ? colors.mint : colors.lavender, alignItems: "center", justifyContent: "center" }}><Text style={{ color: item.type === "income" || item.type === "refund" ? colors.success : colors.blue, fontSize: 18, fontWeight: "900" }}>{item.type === "income" || item.type === "refund" ? "↓" : "↑"}</Text></View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.ink, fontWeight: "900", fontSize: 13 }}>{item.description}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>{shortDate(item.occurredAt)} · {item.type} · {item.status}</Text>
          </View>
          <Text style={{ color: item.type === "income" || item.type === "refund" ? colors.success : colors.ink, fontWeight: "900", fontSize: 13 }}>{item.type === "income" || item.type === "refund" ? "+" : "−"}{formatMinor(item.total.amountMinor, item.total.currency)}</Text>
        </View>)}
      </Card>}
  </Screen>;
}
