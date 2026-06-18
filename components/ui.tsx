import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, shadow, spacing } from "../lib/theme";

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: colors.bg }, style]} edges={["top"]}>
      {children}
    </SafeAreaView>
  );
}

// Big tab-screen header (no back). Optional right action.
export function ScreenHeader({
  title,
  emoji,
  subtitle,
  right,
}: {
  title: string;
  emoji?: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.screenHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.screenTitle}>
          {emoji ? `${emoji} ` : ""}
          {title}
        </Text>
        {subtitle ? <Text style={styles.screenSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// Detail-screen header with a clearly visible round back button.
export function Header({ title, right }: { title?: string; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        hitSlop={10}
      >
        <Text style={styles.backArrow}>‹</Text>
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title ?? ""}
      </Text>
      <View style={styles.backBtnGhost}>{right}</View>
    </View>
  );
}

export function Card({
  children,
  style,
  variant = "default",
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "default" | "hero" | "flat";
  onPress?: () => void;
}) {
  const v =
    variant === "hero"
      ? { backgroundColor: colors.bleu, borderColor: colors.bleu }
      : variant === "flat"
      ? { backgroundColor: colors.surfaceAlt, borderColor: colors.borderSoft }
      : { backgroundColor: colors.surface, borderColor: colors.border };
  const Comp: any = onPress ? Pressable : View;
  return (
    <Comp
      onPress={onPress}
      style={({ pressed }: any) => [styles.card, v, pressed && onPress && { opacity: 0.92 }, style]}
    >
      {children}
    </Comp>
  );
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
  variant?: "primary" | "red" | "ghost" | "outline" | "light";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variant === "primary"
      ? colors.bleu
      : variant === "red"
      ? colors.rouge
      : variant === "light"
      ? colors.blanc
      : "transparent";
  const txt =
    variant === "ghost" || variant === "outline"
      ? colors.text
      : variant === "light"
      ? colors.bleuDeep
      : colors.blanc;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: colors.border, borderWidth: variant === "outline" ? 1.5 : 0 },
        (disabled || loading) && { opacity: 0.45 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={txt} /> : <Text style={[styles.btnText, { color: txt }]}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({
  label,
  color = colors.bleu,
  bg,
  style,
  dot,
}: {
  label: string;
  color?: string;
  bg?: string;
  style?: ViewStyle;
  dot?: boolean;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: bg ?? "rgba(47,107,255,0.16)" }, style]}>
      {dot ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}
// back-compat alias
export const Pill = Chip;

export function Avatar({
  name,
  size = 44,
  url,
  ring,
}: {
  name?: string | null;
  size?: number;
  url?: string | null;
  ring?: boolean;
}) {
  const initials = (name ?? "?")
    .split(/[\s_]+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (url) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Image } = require("react-native");
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: ring ? 2 : 1, borderColor: ring ? colors.bleu : colors.border }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.bleuSoft,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: ring ? 2 : 1,
        borderColor: ring ? colors.bleu : colors.border,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: size * 0.38 }}>{initials}</Text>
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
    <View style={{ alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: 8 }}>
      <View style={styles.emptyIcon}>
        <Text style={{ fontSize: 40 }}>{icon}</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{title}</Text>
      {sub ? <Text style={{ color: colors.textDim, textAlign: "center", fontSize: 14 }}>{sub}</Text> : null}
    </View>
  );
}

// Tricolor signature stripe
export function Tricolor({ width = 60, height = 5 }: { width?: number; height?: number }) {
  return (
    <View style={{ flexDirection: "row", width, height, borderRadius: height / 2, overflow: "hidden" }}>
      <View style={{ flex: 1, backgroundColor: colors.bleu }} />
      <View style={{ flex: 1, backgroundColor: colors.blanc }} />
      <View style={{ flex: 1, backgroundColor: colors.rouge }} />
    </View>
  );
}

export { ScrollView };

const styles = StyleSheet.create({
  screenHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  screenTitle: { color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -0.5 },
  screenSub: { color: colors.textDim, fontSize: 14, fontWeight: "600", marginTop: 4 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: 56,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnGhost: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backArrow: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: -4 },
  headerTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: {
    height: 54,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnText: { fontWeight: "800", fontSize: 16, letterSpacing: 0.2 } as TextStyle,
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.pill },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
});
