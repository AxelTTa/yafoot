import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing } from "../lib/theme";

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: colors.bg }, style]} edges={["top"]}>
      {children}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "red" | "ghost" | "outline";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variant === "primary" ? colors.bleu : variant === "red" ? colors.rouge : "transparent";
  const border = variant === "outline" ? colors.border : "transparent";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border, borderWidth: variant === "outline" ? 1 : 0 },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.blanc} />
      ) : (
        <Text
          style={[
            styles.btnText,
            (variant === "ghost" || variant === "outline") && { color: colors.text },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Pill({
  label,
  color = colors.bleu,
  bg,
  style,
}: {
  label: string;
  color?: string;
  bg?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg ?? "rgba(30,91,255,0.15)" }, style]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 40, url }: { name?: string | null; size?: number; url?: string | null }) {
  const initials = (name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.bleuSoft,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.bleu} size="large" />
    </View>
  );
}

export function Empty({ icon = "⚽", title, sub }: { icon?: string; title: string; sub?: string }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: 6 }}>
      <Text style={{ fontSize: 44 }}>{icon}</Text>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>{title}</Text>
      {sub ? <Text style={{ color: colors.textDim, textAlign: "center" }}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: {
    height: 50,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnText: { color: colors.blanc, fontWeight: "800", fontSize: 16 } as TextStyle,
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
});
