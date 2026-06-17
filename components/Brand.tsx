import React from "react";
import { Text, View } from "react-native";
import { colors } from "../lib/theme";

// "YaFoot" wordmark — Ya (blue) Foot (red), with a tricolor accent bar.
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      <Text style={{ fontSize: size, fontWeight: "900", letterSpacing: -0.5 }}>
        <Text style={{ color: colors.bleu }}>Ya</Text>
        <Text style={{ color: colors.blanc }}>Foot</Text>
      </Text>
      <View style={{ flexDirection: "row", height: 4, width: size * 2.4, borderRadius: 2, overflow: "hidden" }}>
        <View style={{ flex: 1, backgroundColor: colors.bleu }} />
        <View style={{ flex: 1, backgroundColor: colors.blanc }} />
        <View style={{ flex: 1, backgroundColor: colors.rouge }} />
      </View>
    </View>
  );
}

export function LogoInline({ size = 20 }: { size?: number }) {
  return (
    <Text style={{ fontSize: size, fontWeight: "900", letterSpacing: -0.3 }}>
      <Text style={{ color: colors.bleu }}>Ya</Text>
      <Text style={{ color: colors.blanc }}>Foot</Text>
    </Text>
  );
}
