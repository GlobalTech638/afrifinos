import { useCallback, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { api, formatMinor, shortDate, type Transaction } from "../../lib/api";
import { Button, Card, Empty, Heading, Screen } from "../../components/ui";
import { colors } from "../../lib/theme";
import { useAuth } from "../../providers/auth-provider";

export default function TransactionsScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<Transaction[]>([]);
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

  return <Screen>
    <Heading eyebrow="Money movement" title="Transactions" subtitle="Review income, spending, transfers and refunds." />
    <Link href="/add-transaction" asChild><Pressable style={{ backgroundColor: colors.navy, padding: 15, borderRadius: 14, alignItems: "center" }}><Text style={{ color: colors.white, fontWeight: "800" }}>+ Record a transaction</Text></Pressable></Link>
    {error ? <Card><Text style={{ color: colors.danger }}>{error}</Text><Button title="Retry" onPress={() => void load()} secondary /></Card> : null}
    {loading ? <Empty title="Loading activity…" detail="Fetching your latest recorded transactions." /> :
      items.length === 0 ? <Empty title="No transactions yet" detail="When you record or import transactions, they will appear here." /> :
      items.map((item) => <Card key={item.transactionId} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 14 }}>{item.description}</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{shortDate(item.occurredAt)} · {item.type} · {item.status}</Text>
        </View>
        <Text style={{ color: item.type === "income" || item.type === "refund" ? colors.success : colors.ink, fontWeight: "900", fontSize: 14 }}>
          {formatMinor(item.total.amountMinor, item.total.currency)}
        </Text>
      </Card>)}
  </Screen>;
}
