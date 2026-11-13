import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { api, type Account } from "../../lib/api";
import { Button, Card, Empty, ErrorText, Field, Heading, Label, Screen } from "../../components/ui";
import { colors } from "../../lib/theme";
import { useAuth } from "../../providers/auth-provider";

const types: Account["type"][] = ["mobile_money", "bank", "cash", "sacco", "investment", "loan", "other"];
const icons: Record<Account["type"], string> = { mobile_money: "◉", bank: "▣", cash: "＄", sacco: "⌂", investment: "↗", loan: "↘", other: "◇" };

export default function AccountsScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<Account[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("mobile_money");
  const [currency, setCurrency] = useState("KES");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { if (session) setItems(await api.accounts(session)); }, [session]);
  useFocusEffect(useCallback(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load accounts")); }, [load]));

  async function create() {
    if (!session || !name.trim()) return;
    setBusy(true); setError("");
    try {
      await api.createAccount(session, { name: name.trim(), type, currency: currency.trim().toUpperCase() });
      setName(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create account"); }
    finally { setBusy(false); }
  }

  return <Screen>
    <Heading eyebrow="YOUR FINANCIAL NETWORK" title="Accounts" subtitle="All the places where you keep, grow or owe money." />
    <Card style={{ backgroundColor: colors.navy, borderColor: colors.navy }}>
      <Text style={{ color: "#D7D5FF", fontSize: 10, fontWeight: "900", letterSpacing: 1 }}>CONNECTED ACCOUNTS</Text>
      <Text style={{ color: colors.white, fontSize: 32, fontWeight: "900" }}>{items.length}</Text>
      <Text style={{ color: "#D7D5FF", fontSize: 11 }}>Bank · M-Pesa · Cash · SACCO · Investments</Text>
    </Card>
    {items.length === 0 ? <Empty title="Start with your accounts" detail="Add the accounts you use every day. AfriFinos needs at least two accounts to represent double-entry transactions." /> :
      <Card>
        <Heading title="My accounts" subtitle="Your connected financial accounts." />
        {items.map((account, index) => <View key={account.accountId} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.line }}>
          <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: index % 2 === 0 ? colors.lavender : colors.mint, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.blue, fontSize: 20, fontWeight: "900" }}>{icons[account.type]}</Text></View>
          <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.ink, fontWeight: "900", fontSize: 13 }}>{account.name}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>{account.type.replace("_", " ")} · {account.currency}</Text></View>
          <Text style={{ color: colors.success, fontWeight: "900", fontSize: 10 }}>{account.status}</Text>
        </View>)}
      </Card>}
    <Card>
      <Heading title="Add an account" subtitle="Create a place where you hold or owe money." />
      <Label>Account name</Label><Field value={name} onChangeText={setName} placeholder="e.g. M-Pesa wallet" />
      <Label>Account type</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {types.map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: type === value }} onPress={() => setType(value)} style={{ borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: type === value ? colors.blue : colors.canvas, borderWidth: 1, borderColor: type === value ? colors.blue : colors.line }}><Text style={{ color: type === value ? colors.white : colors.ink, fontSize: 11, fontWeight: "800" }}>{value.replace("_", " ")}</Text></Pressable>)}
      </View>
      <Label>Currency code</Label><Field value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} placeholder="KES" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title="Create account" onPress={() => void create()} busy={busy} disabled={!name.trim() || currency.trim().length !== 3} />
    </Card>
  </Screen>;
}
