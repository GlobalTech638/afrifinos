import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text, View } from "react-native";
import { api, type Account } from "../../lib/api";
import { Button, Card, Empty, ErrorText, Field, Heading, Label, Screen } from "../../components/ui";
import { colors } from "../../lib/theme";
import { useAuth } from "../../providers/auth-provider";

const types: Account["type"][] = ["mobile_money", "bank", "cash", "sacco", "investment", "loan", "other"];

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
    <Heading eyebrow="Your financial network" title="Accounts" subtitle="Represent your cash, bank, mobile money, SACCO and investment accounts." />
    {items.length === 0 ? <Empty title="Start with your accounts" detail="Add the accounts you use every day. AfriFinos needs at least two accounts to represent double-entry transactions." /> :
      items.map((account) => <Card key={account.accountId}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.ink, fontWeight: "800", fontSize: 15 }}>{account.name}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{account.type.replace("_", " ")} · {account.currency}</Text></View>
          <Text style={{ color: colors.success, fontWeight: "800", fontSize: 11 }}>{account.status}</Text>
        </View>
      </Card>)}
    <Card>
      <Heading title="Add an account" subtitle="Create a new place where you hold or owe money." />
      <Label>Account name</Label><Field value={name} onChangeText={setName} placeholder="e.g. M-Pesa wallet" />
      <Label>Account type</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {types.map((value) => <Text key={value} onPress={() => setType(value)} style={{ overflow: "hidden", borderRadius: 10, paddingVertical: 9, paddingHorizontal: 11, backgroundColor: type === value ? colors.navy : colors.canvas, color: type === value ? colors.white : colors.ink, fontSize: 11, fontWeight: "700" }}>{value.replace("_", " ")}</Text>)}
      </View>
      <Label>Currency code</Label><Field value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} placeholder="KES" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title="Create account" onPress={() => void create()} busy={busy} disabled={!name.trim() || currency.trim().length !== 3} />
    </Card>
  </Screen>;
}
