import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api, currencyMinorUnitExponent, parseMajorToMinor, type Account } from "../lib/api";
import { Button, Card, ErrorText, Field, Heading, Label, Screen } from "../components/ui";
import { colors } from "../lib/theme";
import { useAuth } from "../providers/auth-provider";

const transactionTypes = ["expense", "income", "transfer", "fee", "refund"] as const;

export default function AddTransactionScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [primaryId, setPrimaryId] = useState("");
  const [counterId, setCounterId] = useState("");
  const [type, setType] = useState<(typeof transactionTypes)[number]>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    let active = true;
    void api.accounts(session).then((items) => {
      if (!active) return;
      setAccounts(items);
      setPrimaryId(items[0]?.accountId ?? "");
      setCounterId(items[1]?.accountId ?? "");
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load accounts");
    });
    return () => { active = false; };
  }, [session]);

  const selected = accounts.find((account) => account.accountId === primaryId);
  const compatibleCounters = accounts.filter((account) => account.accountId !== primaryId && account.currency.toUpperCase() === selected?.currency.toUpperCase());

  async function submit() {
    if (!session || !primaryId || !counterId || primaryId === counterId || accounts.find((account) => account.accountId === counterId)?.currency.toUpperCase() !== selected?.currency.toUpperCase()) {
      setError("Choose two different accounts.");
      return;
    }
    const currencyCode = selected?.currency.toUpperCase() ?? "KES";
    const amountMinor = parseMajorToMinor(amount, currencyCode);
    if (!amountMinor) {
      setError(`Enter a positive amount with up to ${currencyMinorUnitExponent(currencyCode)} decimal places.`);
      return;
    }
    setBusy(true); setError("");
    try {
      await api.createTransaction(session, {
        primaryAccountId: primaryId,
        counterAccountId: counterId,
        occurredAt: new Date().toISOString(),
        description: description.trim(),
        amountMinor,
        currency: selected?.currency ?? "KES",
        type,
        sourceKind: "manual",
      });
      Alert.alert("Transaction recorded", "Your transaction has been sent to AfriFinos.");
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save transaction");
    } finally { setBusy(false); }
  }

  return <Screen>
    <Heading eyebrow="MONEY MOVEMENT" title="Record activity" subtitle="Add a payment, deposit or transfer to your financial timeline." />
    <Card>
      <Label>Transaction type</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {transactionTypes.map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: type === value }} onPress={() => setType(value)} style={{ borderRadius: 10, paddingVertical: 9, paddingHorizontal: 11, backgroundColor: type === value ? colors.blue : colors.canvas, borderWidth: 1, borderColor: type === value ? colors.blue : colors.line }}><Text style={{ color: type === value ? colors.white : colors.ink, fontWeight: "700", fontSize: 11 }}>{value}</Text></Pressable>)}
      </View>
      <Label>Amount ({selected?.currency ?? "KES"})</Label>
      <Field value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" />
      <Label>Description</Label>
      <Field value={description} onChangeText={setDescription} placeholder="e.g. Groceries, salary, rent" />
      <Label>Primary account</Label>
      <View style={{ gap: 7 }}>{accounts.map((account) => <Pressable key={account.accountId} onPress={() => {
        setPrimaryId(account.accountId);
        const currentCounter = accounts.find((item) => item.accountId === counterId);
        if (!currentCounter || currentCounter.accountId === account.accountId || currentCounter.currency.toUpperCase() !== account.currency.toUpperCase()) {
          setCounterId(accounts.find((item) => item.accountId !== account.accountId && item.currency.toUpperCase() === account.currency.toUpperCase())?.accountId ?? "");
        }
      }} style={{ borderRadius: 11, padding: 12, borderWidth: 1, borderColor: primaryId === account.accountId ? colors.blue : colors.line, backgroundColor: primaryId === account.accountId ? colors.lavender : colors.white }}><Text style={{ color: colors.ink, fontWeight: "700" }}>{account.name} · {account.currency}</Text></Pressable>)}</View>
      <Label>Counter account</Label>
      <View style={{ gap: 7 }}>{compatibleCounters.map((account) => <Pressable key={account.accountId} onPress={() => setCounterId(account.accountId)} style={{ borderRadius: 11, padding: 12, borderWidth: 1, borderColor: counterId === account.accountId ? colors.blue : colors.line, backgroundColor: counterId === account.accountId ? colors.lavender : colors.white }}><Text style={{ color: colors.ink, fontWeight: "700" }}>{account.name} · {account.currency}</Text></Pressable>)}</View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title="Save transaction" onPress={() => void submit()} busy={busy} disabled={!description.trim() || !amount.trim() || compatibleCounters.length < 1} />
    </Card>
  </Screen>;
}
