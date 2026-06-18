import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../lib/theme";
import { Match, Prediction, isFinished, isLive } from "../lib/types";
import { prettyTeam, teamFlag } from "../lib/teams";

function kickoffLabel(iso: string | null) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Today ${time}`;
  const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${date} ${time}`;
}

export default function MatchCard({
  match,
  prediction,
  onPress,
  onStats,
}: {
  match: Match;
  prediction?: Prediction;
  onPress?: () => void;
  onStats?: () => void;
}) {
  const live = isLive(match.status);
  const finished = isFinished(match.status);
  const showScore = live || finished;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.header}>
        <Text style={styles.group}>
          {match.group_name ?? match.stage?.replace(/_/g, " ") ?? "World Cup"}
        </Text>
        {live ? (
          <View style={styles.liveBadge}>
            <View style={styles.dot} />
            <Text style={styles.liveText}>{match.minute ? `${match.minute}'` : "LIVE"}</Text>
          </View>
        ) : finished ? (
          <Text style={styles.ft}>FT</Text>
        ) : (
          <Text style={styles.time}>{kickoffLabel(match.utc_kickoff)}</Text>
        )}
      </View>

      <View style={styles.row}>
        <View style={styles.team}>
          <Text style={styles.flag}>{teamFlag(match.home_team, match.home_flag)}</Text>
          <Text style={styles.teamName} numberOfLines={1}>
            {prettyTeam(match.home_team)}
          </Text>
        </View>
        <View style={styles.scoreBox}>
          {showScore ? (
            <Text style={[styles.score, live && { color: colors.live }]}>
              {match.home_score ?? 0} - {match.away_score ?? 0}
            </Text>
          ) : (
            <Text style={styles.vs}>vs</Text>
          )}
        </View>
        <View style={[styles.team, { justifyContent: "flex-end" }]}>
          <Text style={[styles.teamName, { textAlign: "right" }]} numberOfLines={1}>
            {prettyTeam(match.away_team)}
          </Text>
          <Text style={styles.flag}>{teamFlag(match.away_team, match.away_flag)}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          {prediction ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.predLabel}>Your pick {prediction.pred_home}-{prediction.pred_away}</Text>
              {prediction.scored ? (
                <Text style={[styles.predPts, { color: prediction.points_awarded >= 3 ? colors.gold : prediction.points_awarded > 0 ? colors.live : colors.textFaint }]}>
                  +{prediction.points_awarded} pts
                </Text>
              ) : (
                <Text style={styles.predPending}>locked</Text>
              )}
            </View>
          ) : !finished && !live ? (
            <Text style={styles.tapHint}>Tap to predict →</Text>
          ) : (
            <Text style={styles.predPending}>{finished ? "Full time" : "In play"}</Text>
          )}
        </View>
        {onStats ? (
          <Pressable onPress={onStats} style={styles.statsBtn} hitSlop={6}>
            <Text style={styles.statsText}>📊 Stats</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  group: { color: colors.textDim, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  time: { color: colors.textDim, fontSize: 12, fontWeight: "700" },
  ft: { color: colors.textFaint, fontSize: 12, fontWeight: "800" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.liveBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.live },
  liveText: { color: colors.live, fontSize: 11, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center" },
  team: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  flag: { fontSize: 26 },
  teamName: { color: colors.text, fontSize: 15, fontWeight: "700", flexShrink: 1 },
  scoreBox: { paddingHorizontal: spacing.md, minWidth: 64, alignItems: "center" },
  score: { color: colors.text, fontSize: 20, fontWeight: "900" },
  vs: { color: colors.textFaint, fontSize: 13, fontWeight: "700" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.md, gap: spacing.sm },
  predLabel: { color: colors.textDim, fontSize: 13, fontWeight: "700" },
  predPts: { fontSize: 13, fontWeight: "900" },
  predPending: { color: colors.textFaint, fontSize: 12, fontWeight: "700" },
  tapHint: { color: colors.bleu, fontSize: 13, fontWeight: "800" },
  statsBtn: { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  statsText: { color: colors.text, fontSize: 12, fontWeight: "800" },
});
