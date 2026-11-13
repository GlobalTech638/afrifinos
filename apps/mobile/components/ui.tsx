import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, shadow } from "../lib/theme";

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const content = <View style={styles.content}>{children}</View>;
  return scroll
    ? <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">{content}</ScrollView>
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
    {busy ? <ActivityIndicator color={secondary ? colors.navy : colors.white} /> :
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>}
  </Pressable>;
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return <Card><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text>{note ? <Text style={styles.statNote}>{note}</Text> : null}</Card>;
}

export function Empty({ title, detail }: { title: string; detail: string }) {
  return <Card style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.subtitle}>{detail}</Text></Card>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="alert" style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { paddingBottom: 36 },
  content: { paddingHorizontal: 20, paddingTop: 22, gap: 18 },
  heading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headingCopy: { flex: 1, gap: 5 },
  eyebrow: { color: colors.teal, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 27, fontWeight: "800", letterSpacing: -0.7 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 17, gap: 9, ...shadow },
  label: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  field: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, color: colors.ink, backgroundColor: colors.white, fontSize: 15 },
  button: { minHeight: 50, borderRadius: 14, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  buttonSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  buttonPressed: { opacity: 0.72 },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  buttonTextSecondary: { color: colors.navy },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  statValue: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  statNote: { color: colors.muted, fontSize: 11 },
  empty: { alignItems: "flex-start" },
  emptyTitle: { color: colors.ink, fontWeight: "800", fontSize: 15 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
});
