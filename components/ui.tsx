import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { accentFor, colors, radius, shadow, spacing } from "../lib/theme";

export function Icon({ name, size = 22, color = colors.ink }: { name: any; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: colors.bg }, style]} edges={["top"]}>
      {children}
    </SafeAreaView>
  );
}

// Big greeting-style header (lime bg, dark text). Optional right action.
export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.screenHeader}>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={styles.screenSub}>{subtitle}</Text> : null}
        <Text style={styles.screenTitle}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

// Detail-screen header with a dark round back button (clearly visible on lime).
export function Header({ title, right }: { title?: string; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        hitSlop={10}
      >
        <Icon name="chevron-back" size={24} color={colors.blanc} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>{title ?? ""}</Text>
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
      ? { backgroundColor: colors.surfaceDark }
      : variant === "flat"
      ? { backgroundColor: colors.surfaceAlt }
      : { backgroundColor: colors.surface };
  const Comp: any = onPress ? Pressable : View;
  return (
    <Comp onPress={onPress} style={({ pressed }: any) => [styles.card, shadow, v, pressed && onPress && { opacity: 0.93 }, style]}>
      {children}
    </Comp>
  );
}

// Colored rounded icon tile (ref: list-row icons + action buttons).
export function IconTile({ name, color = colors.green, size = 46, icon = colors.blanc }: { name: any; color?: string; size?: number; icon?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
      <Icon name={name} size={size * 0.5} color={icon} />
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "green" | "yellow" | "purple" | "dark" | "outline" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  icon?: any;
  style?: ViewStyle;
}) {
  const map: Record<string, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.greenDark, fg: colors.blanc },
    green: { bg: colors.green, fg: colors.blanc },
    yellow: { bg: colors.yellow, fg: colors.ink },
    purple: { bg: colors.purple, fg: colors.blanc },
    dark: { bg: colors.surfaceDark, fg: colors.blanc },
    outline: { bg: "transparent", fg: colors.ink, border: colors.ink },
    ghost: { bg: "transparent", fg: colors.textDim },
  };
  const c = map[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: c.bg, borderColor: c.border ?? "transparent", borderWidth: c.border ? 2 : 0 },
        (disabled || loading) && { opacity: 0.45 },
        pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon ? <Icon name={icon} size={18} color={c.fg} /> : null}
          <Text style={[styles.btnText, { color: c.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Chip({ label, color = colors.greenDark, bg, style, dot }: { label: string; color?: string; bg?: string; style?: ViewStyle; dot?: boolean }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg ?? "rgba(0,0,0,0.06)" }, style]}>
      {dot ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}
export const Pill = Chip;

export function Avatar({ name, size = 44, url, ring, color }: { name?: string | null; size?: number; url?: string | null; ring?: boolean; color?: string }) {
  const initials = (name ?? "?").split(/[\s_]+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: ring ? 3 : 0, borderColor: colors.surfaceDark }} />;
  }
  const bg = color ?? accentFor(initials.charCodeAt(0) || 0);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center", borderWidth: ring ? 3 : 0, borderColor: colors.surfaceDark }}>
      <Text style={{ color: colors.blanc, fontWeight: "900", fontSize: size * 0.4 }}>{initials}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.greenDark} size="large" />
    </View>
  );
}

export function Empty({ icon = "football", title, sub, color = colors.purple }: { icon?: any; title: string; sub?: string; color?: string }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: 10 }}>
      <IconTile name={icon} color={color} size={72} />
      <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{title}</Text>
      {sub ? <Text style={{ color: colors.textDim, textAlign: "center", fontSize: 14, fontWeight: "600" }}>{sub}</Text> : null}
    </View>
  );
}

// retained for back-compat (now a small row of accent dots)
export function Tricolor({ width = 60 }: { width?: number; height?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 5 }}>
      {[colors.green, colors.yellow, colors.purple].map((c, i) => (
        <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c }} />
      ))}
    </View>
  );
}

export { ScrollView };

const styles = StyleSheet.create({
  screenHeader: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.lg, paddingTop: 58, paddingBottom: spacing.lg, gap: spacing.md },
  screenTitle: { color: colors.ink, fontSize: 30, fontWeight: "900", letterSpacing: -0.6 },
  screenSub: { color: colors.textDim, fontSize: 14, fontWeight: "700" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingTop: 54, paddingBottom: spacing.md, gap: spacing.sm },
  backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceDark, alignItems: "center", justifyContent: "center" },
  backBtnGhost: { minWidth: 42, height: 42, alignItems: "flex-end", justifyContent: "center" },
  headerTitle: { flex: 1, color: colors.ink, fontSize: 19, fontWeight: "900", textAlign: "center" },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg },
  btn: { height: 54, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  btnText: { fontWeight: "900", fontSize: 16, letterSpacing: 0.2 } as TextStyle,
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.pill },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: "900", letterSpacing: 0.2 },
});
