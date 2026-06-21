import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "./ui";
import { savePrediction } from "../lib/api";
import { notify } from "../lib/notify";
import { colors, radius, shadow, spacing } from "../lib/theme";
import { Match, Prediction, isFinished, isLive } from "../lib/types";
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

function MiniStep({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={il.stepper}>
      <Pressable onPress={() => onChange(Math.max(0, value - 1))} style={il.btn} hitSlop={6}>
        <Text style={il.sign}>−</Text>
      </Pressable>
      <Text style={il.val}>{value}</Text>
      <Pressable onPress={() => onChange(Math.min(20, value + 1))} style={il.btn} hitSlop={6}>
        <Text style={il.sign}>+</Text>
      </Pressable>
    </View>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

function InlinePrediction({ matchId, prediction }: { matchId: number; prediction?: Prediction }) {
  const [home, setHome] = useState(prediction?.pred_home ?? 0);
  const [away, setAway] = useState(prediction?.pred_away ?? 0);
  const [saveState, setSaveState] = useState<SaveState>(prediction ? "saved" : "idle");
  const lastSaved = useRef({ h: prediction?.pred_home ?? 0, a: prediction?.pred_away ?? 0 });
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleFade = useCallback(() => {
    if (fadeRef.current) clearTimeout(fadeRef.current);
    fadeRef.current = setTimeout(() => setSaveState("idle"), 2000);
  }, []);

  useEffect(() => () => { if (fadeRef.current) clearTimeout(fadeRef.current); }, []);

  // Sync when prediction prop changes (e.g. after initial load)
  useEffect(() => {
    if (!prediction) return;
    const h = prediction.pred_home;
    const a = prediction.pred_away;
    setHome(h); setAway(a);
    lastSaved.current = { h, a };
    setSaveState("saved");
    scheduleFade();
  }, [prediction?.pred_home, prediction?.pred_away]);

  // Debounced auto-save when values drift from lastSaved
  useEffect(() => {
    if (home === lastSaved.current.h && away === lastSaved.current.a) return;
    if (fadeRef.current) clearTimeout(fadeRef.current);
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        await savePrediction(matchId, home, away);
        lastSaved.current = { h: home, a: away };
        setSaveState("saved");
        scheduleFade();
      } catch {
        setSaveState("error");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [home, away, matchId]);

  const retry = async () => {
    setSaveState("saving");
    try {
      await savePrediction(matchId, home, away);
      lastSaved.current = { h: home, a: away };
      setSaveState("saved");
      scheduleFade();
    } catch {
      notify("Save failed", "Check your connection and try again.");
      setSaveState("error");
    }
  };

  return (
    <View style={il.wrap}>
      <MiniStep value={home} onChange={setHome} />
      <Text style={il.dash}>–</Text>
      <MiniStep value={away} onChange={setAway} />
      {saveState === "saving" ? (
        <View style={[il.badge, { backgroundColor: colors.orange }]}>
          <Text style={il.badgeTxt}>Saving...</Text>
        </View>
      ) : saveState === "saved" ? (
        <View style={[il.badge, { backgroundColor: colors.green }]}>
          <Text style={il.badgeTxt}>Saved</Text>
        </View>
      ) : saveState === "error" ? (
        <Pressable onPress={retry} style={[il.badge, { backgroundColor: colors.red }]} hitSlop={4}>
          <Text style={il.badgeTxt}>Error — retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const il = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  btn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  sign: { color: colors.ink, fontSize: 17, fontWeight: "900", lineHeight: 19 },
  val: { color: colors.ink, fontSize: 19, fontWeight: "900", minWidth: 24, textAlign: "center" },
  dash: { color: colors.textFaint, fontSize: 15, fontWeight: "800" },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt: { color: colors.blanc, fontSize: 11, fontWeight: "900" },
});

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
  const pulse = useRef(new Animated.Value(1)).current;

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

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, shadow, pressed && { opacity: 0.95 }, prediction && !live && !finished && styles.cardPredicted]}>
      <View style={styles.header}>
        <Text style={styles.group}>{match.group_name ?? match.stage?.replace(/_/g, " ") ?? "World Cup"}</Text>
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
        <View style={{ flex: 1 }}>
          {!live && !finished ? (
            <InlinePrediction matchId={match.id} prediction={prediction} />
          ) : prediction ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.predLabel}>Pick {prediction.pred_home}–{prediction.pred_away}</Text>
              {prediction.scored ? (
                <View style={[styles.ptsPill, { backgroundColor: prediction.points_awarded >= 5 ? colors.green : prediction.points_awarded > 0 ? colors.yellow : colors.surfaceAlt }]}>
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
        {onStats ? (
          <Pressable onPress={onStats} style={styles.statsBtn} hitSlop={6}>
            <Icon name="stats-chart" size={13} color={colors.purple} />
            <Text style={styles.statsText}>Stats</Text>
          </Pressable>
        ) : null}
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
  predLabel: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  ptsPill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  ptsText: { fontSize: 12, fontWeight: "900" },
  locked: { color: colors.textFaint, fontSize: 12, fontWeight: "700" },
  statsBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(155,93,229,0.12)", borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6 },
  statsText: { color: colors.purple, fontSize: 12, fontWeight: "900" },
});
