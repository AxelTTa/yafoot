import React from "react";
import { Text, View } from "react-native";
import { colors } from "../lib/theme";

// Bold playful wordmark on lime: "Ya" dark, "Foot" in green, with a colored dot.
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: size, fontWeight: "900", letterSpacing: -1 }}>
        <Text style={{ color: colors.ink }}>Ya</Text>
        <Text style={{ color: colors.greenDark }}>Foot</Text>
        <Text style={{ color: colors.purple }}>.</Text>
      </Text>
    </View>
  );
}

export function LogoInline({ size = 22 }: { size?: number }) {
  return (
    <Text style={{ fontSize: size, fontWeight: "900", letterSpacing: -0.6 }}>
      <Text style={{ color: colors.ink }}>Ya</Text>
      <Text style={{ color: colors.greenDark }}>Foot</Text>
      <Text style={{ color: colors.purple }}>.</Text>
    </Text>
  );
}
