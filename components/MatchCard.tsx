import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { savePrediction } from "../lib/api";
import { APP_STORE_SAFE } from "../lib/mode";
import { notify } from "../lib/notify";
import { colors, radius, shadow, spacing } from "../lib/theme";
import { Match, Prediction, isFinished, isLive, isUpcoming } from "../lib/types";
import { prettyTeam, teamFlag } from "../lib/teams";

function kickoffLabel(iso: string | null) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Today ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

export default function MatchCard({
  match,
  prediction,
  onPress,
  inlinePredict = true,
  onPredictionSaved,
}: {
  match: Match;
  prediction?: Prediction;
  onPress?: () => void;
  inlinePredict?: boolean;
  onPredictionSaved?: () => void;
}) {
  const live = isLive(match.status);
  const finished = isFinished(match.status);
  const open = isUpcoming(match.status);
  const showScore = live || finished;
  const pulse = useRef(new Animated.Value(1)).current;
  const [home, setHome] = useState(prediction?.pred_home ?? 0);
  const [away, setAway] = useState(prediction?.pred_away ?? 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHome(prediction?.pred_home ?? 0);
    setAway(prediction?.pred_away ?? 0);
  }, [prediction?.pred_home, prediction?.pred_away, match.id]);

  useEffect(() => {
    if (!live) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [live]);

  const changed = prediction ? home !== prediction.pred_home || away !== prediction.pred_away : home !== 0 || away !== 0;

  async function submitInline() {
    if (!changed || saving) return;
    setSaving(true);
    try {
      await savePrediction(match.id, home, away);
      notify("Prediction saved", `${prettyTeam(match.home_team)} ${home} - ${away} ${prettyTeam(match.away_team)}`);
      onPredictionSaved?.();
    } catch (e: any) {
      notify("Could not save", e.message);
    } finally {
      setSaving(false);
    }
  }

  function Step({ value, set, label }: { value: number; set: (n: number) => void; label: string }) {
    return (
      <View style={styles.inlineStepper}>
        <Pressable accessibilityLabel={`Decrease ${label} prediction`} onPress={() => set(Math.max(0, value - 1))} style={styles.inlineBtn} hitSlop={8}>
          <Text style={styles.inlineSign}>-</Text>
        </Pressable>
        <Text style={styles.inlineValue}>{value}</Text>
        <Pressable accessibilityLabel={`Increase ${label} prediction`} onPress={() => set(Math.min(20, value + 1))} style={styles.inlineBtn} hitSlop={8}>
          <Text style={styles.inlineSign}>+</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, shadow, pressed && { opacity: 0.95 }, prediction && !live && !finished && styles.cardPredicted]}>
      <View style={styles.header}>
        <Text style={styles.group}>{match.group_name ?? match.stage?.replace(/_/g, " ") ?? (APP_STORE_SAFE ? "Friend challenge" : "Tournament match")}</Text>
        {live ? (
          <View style={styles.livePill}>
            <Animated.View style={[styles.dot, { opacity: pulse }]} />
            <Text style={styles.liveText}>{match.minute ? `${match.minute}'` : "LIVE"}</Text>
          </View>
        ) : finished ? (
          <View style={styles.ftPill}><Text style={styles.ftText}>FT</Text></View>
        ) : (
          <Text style={styles.time}>{kickoffLabel(match.utc_kickoff)}</Text>
        )}
      </View>

      <View style={styles.row}>
        <View style={styles.team}>
          <Text style={styles.flag}>{teamFlag(match.home_team, match.home_flag)}</Text>
          <Text style={styles.teamName} numberOfLines={1}>{prettyTeam(match.home_team)}</Text>
        </View>
        <View style={styles.scoreBox}>
          {showScore ? (
            <Text style={[styles.score, live && { color: colors.live }]}>{match.home_score ?? 0}–{match.away_score ?? 0}</Text>
          ) : (
            <Text style={styles.vs}>vs</Text>
          )}
        </View>
        <View style={[styles.team, { justifyContent: "flex-end" }]}>
          <Text style={[styles.teamName, { textAlign: "right" }]} numberOfLines={1}>{prettyTeam(match.away_team)}</Text>
          <Text style={styles.flag}>{teamFlag(match.away_team, match.away_flag)}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        {inlinePredict && open ? (
          <View style={styles.inlinePredict}>
            <View style={styles.inlineTeams}>
              <Text style={styles.inlineTeam} numberOfLines={1}>{prettyTeam(match.home_team)}</Text>
              <Text style={styles.inlineTeam} numberOfLines={1}>{prettyTeam(match.away_team)}</Text>
            </View>
            <View style={styles.inlineControls}>
              <Step value={home} set={setHome} label="home" />
              <Text style={styles.inlineDash}>-</Text>
              <Step value={away} set={setAway} label="away" />
            </View>
            <View style={styles.inlineBottom}>
              <Pressable disabled={!changed || saving} onPress={submitInline} style={[styles.saveBtn, (!changed || saving) && styles.saveBtnDisabled]}>
                <Text style={[styles.saveTxt, (!changed || saving) && { color: colors.textFaint }]}>{saving ? "Saving..." : prediction ? "Update pick" : "Save pick"}</Text>
              </Pressable>
              <Text onPress={onPress} style={styles.statsLink}>Details</Text>
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {!live && !finished ? (
              prediction ? (
                <Text onPress={onPress} style={styles.predLabel}>Pick {prediction.pred_home}–{prediction.pred_away}</Text>
              ) : (
                <Text onPress={onPress} style={styles.locked}>Tap to predict</Text>
              )
          ) : prediction ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.predLabel}>Pick {prediction.pred_home}–{prediction.pred_away}</Text>
              {prediction.scored ? (
                <View style={[styles.ptsPill, { backgroundColor: prediction.points_awarded >= 3 ? colors.green : prediction.points_awarded > 0 ? colors.yellow : colors.surfaceAlt }]}>
                  <Text style={[styles.ptsText, { color: prediction.points_awarded > 0 ? colors.blanc : colors.textFaint }]}>+{prediction.points_awarded}</Text>
                </View>
              ) : (
                <Text style={styles.locked}>awaiting</Text>
              )}
            </View>
          ) : (
            <Text style={styles.locked}>{finished ? "Full time" : "In play"}</Text>
          )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, borderWidth: 1.5, borderColor: "transparent" },
  cardPredicted: { borderColor: colors.green },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  group: { color: colors.textDim, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  time: { color: colors.textDim, fontSize: 12, fontWeight: "800" },
  ftPill: { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  ftText: { color: colors.textFaint, fontSize: 11, fontWeight: "900" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.live, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.blanc },
  liveText: { color: colors.blanc, fontSize: 11, fontWeight: "900" },
  row: { flexDirection: "row", alignItems: "center" },
  team: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  flag: { fontSize: 28 },
  teamName: { color: colors.ink, fontSize: 15, fontWeight: "800", flexShrink: 1 },
  scoreBox: { paddingHorizontal: spacing.md, minWidth: 64, alignItems: "center" },
  score: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  vs: { color: colors.textFaint, fontSize: 13, fontWeight: "800" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.md, gap: spacing.sm },
  inlinePredict: { flex: 1, gap: spacing.sm },
  inlineTeams: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  inlineTeam: { flex: 1, color: colors.textDim, fontSize: 11, fontWeight: "900" },
  inlineControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, paddingVertical: spacing.sm },
  inlineStepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  inlineBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  inlineSign: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  inlineValue: { minWidth: 26, textAlign: "center", color: colors.ink, fontSize: 23, fontWeight: "900" },
  inlineDash: { color: colors.textFaint, fontSize: 18, fontWeight: "900" },
  inlineBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  saveBtn: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 38, borderRadius: radius.pill, backgroundColor: colors.greenDark },
  saveBtnDisabled: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  saveTxt: { color: colors.blanc, fontSize: 13, fontWeight: "900" },
  statsLink: { color: colors.purple, fontSize: 13, fontWeight: "900", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  predLabel: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  ptsPill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  ptsText: { fontSize: 12, fontWeight: "900" },
  locked: { color: colors.textFaint, fontSize: 12, fontWeight: "700" },
});
