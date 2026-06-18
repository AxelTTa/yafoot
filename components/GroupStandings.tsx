import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../lib/theme";
import { TeamRow } from "../lib/standings";
import { prettyTeam, teamFlag } from "../lib/teams";

export default function GroupStandings({ group, rows }: { group: string; rows: TeamRow[] }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.group}>{group}</Text>
        <View style={styles.cols}>
          <Text style={styles.colH}>P</Text>
          <Text style={styles.colH}>W</Text>
          <Text style={styles.colH}>D</Text>
          <Text style={styles.colH}>L</Text>
          <Text style={styles.colH}>GD</Text>
          <Text style={[styles.colH, { color: colors.text }]}>Pts</Text>
        </View>
      </View>
      {rows.map((r, i) => (
        <View key={r.team} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
          <View style={[styles.qual, { backgroundColor: i < 2 ? colors.live : i === 2 ? colors.gold : "transparent" }]} />
          <Text style={styles.rank}>{i + 1}</Text>
          <Text style={styles.flag}>{teamFlag(r.team, r.flag)}</Text>
          <Text style={styles.team} numberOfLines={1}>{prettyTeam(r.team)}</Text>
          <View style={styles.cols}>
            <Text style={styles.col}>{r.P}</Text>
            <Text style={styles.col}>{r.W}</Text>
            <Text style={styles.col}>{r.D}</Text>
            <Text style={styles.col}>{r.L}</Text>
            <Text style={styles.col}>{r.GD > 0 ? "+" + r.GD : r.GD}</Text>
            <Text style={[styles.col, styles.pts]}>{r.Pts}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const COLW = 26;
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  group: { color: colors.text, fontSize: 16, fontWeight: "900" },
  cols: { flexDirection: "row" },
  colH: { width: COLW, textAlign: "center", color: colors.textFaint, fontSize: 11, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, paddingRight: spacing.lg, paddingLeft: spacing.md, gap: 8 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  qual: { width: 3, height: 24, borderRadius: 2 },
  rank: { color: colors.textFaint, fontSize: 12, fontWeight: "800", width: 14, textAlign: "center" },
  flag: { fontSize: 22 },
  team: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  col: { width: COLW, textAlign: "center", color: colors.textDim, fontSize: 13, fontWeight: "600" },
  pts: { color: colors.text, fontWeight: "900" },
});
