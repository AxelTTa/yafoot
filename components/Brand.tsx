import React from "react";
import { Image, Text, View } from "react-native";
import { colors } from "../lib/theme";

const markAsset = require("../assets/brand-mark.png");

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      source={markAsset}
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
      resizeMode="contain"
    />
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  const markSize = Math.round(size * 1.08);
  return (
    <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
      <LogoMark size={markSize} />
      <Text style={{ marginLeft: Math.max(8, size * 0.18), fontSize: size, fontWeight: "900", letterSpacing: 0 }}>
        <Text style={{ color: colors.ink }}>Ya</Text>
        <Text style={{ color: colors.greenDark }}>Foot</Text>
      </Text>
    </View>
  );
}

export function LogoInline({ size = 22 }: { size?: number }) {
  return (
    <Text style={{ fontSize: size, fontWeight: "900", letterSpacing: 0 }}>
      <Text style={{ color: colors.ink }}>Ya</Text>
      <Text style={{ color: colors.greenDark }}>Foot</Text>
    </Text>
  );
}
