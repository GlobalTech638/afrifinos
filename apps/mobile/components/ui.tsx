import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, shadow } from "../lib/theme";

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const content = <View style={styles.content}>{children}</View>;
  return scroll
    ? <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{content}</ScrollView>
    : <View style={styles.screen}>{content}</View>;
}

export function Heading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <View style={styles.heading}>
    <View style={styles.headingCopy}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
    {action}
  </View>;
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={colors.muted} style={styles.field} {...props} />;
}

export function Button({ title, onPress, busy, secondary, disabled }: {
  title: string; onPress: () => void; busy?: boolean; secondary?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, (pressed || disabled || busy) && styles.buttonPressed]}>
    {busy ? <ActivityIndicator color={secondary ? colors.blue : colors.white} /> :
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>}
  </Pressable>;
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return <Card style={styles.statCard}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text>{note ? <Text style={styles.statNote}>{note}</Text> : null}</Card>;
}

export function Empty({ title, detail }: { title: string; detail: string }) {
  return <Card style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.subtitle}>{detail}</Text></Card>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="alert" style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { paddingBottom: 28 },
  content: { paddingHorizontal: 18, paddingTop: 18, gap: 16 },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headingCopy: { flex: 1, gap: 5 },
  eyebrow: { color: colors.blue, fontSize: 10, fontWeight: "900", letterSpacing: 1.35 },
  title: { color: colors.ink, fontSize: 25, fontWeight: "900", letterSpacing: -0.7 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10, ...shadow },
  label: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  field: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 14, color: colors.ink, backgroundColor: colors.white, fontSize: 15 },
  button: { minHeight: 50, borderRadius: 16, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  buttonSecondary: { backgroundColor: colors.lavender, borderWidth: 1, borderColor: colors.lavenderStrong },
  buttonPressed: { opacity: 0.72 },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: "900" },
  buttonTextSecondary: { color: colors.blue },
  statCard: { flex: 1, padding: 13, backgroundColor: colors.white },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  statValue: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  statNote: { color: colors.success, fontSize: 10, fontWeight: "700" },
  empty: { alignItems: "flex-start" },
  emptyTitle: { color: colors.ink, fontWeight: "900", fontSize: 15 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
});
