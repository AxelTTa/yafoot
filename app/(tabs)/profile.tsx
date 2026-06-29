import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, Icon, ScreenHeader, ScrollView } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { fetchMyForecasts, savePrediction } from "../../lib/api";
import { notify } from "../../lib/notify";
import { supabase } from "../../lib/supabase";
import { prettyTeam } from "../../lib/teams";
import { colors, radius, shadow, spacing } from "../../lib/theme";

function MiniStep({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={ms.stepper}>
      <Pressable onPress={() => onChange(Math.max(0, value - 1))} style={ms.btn} hitSlop={8}>
        <Text style={ms.sign}>−</Text>
      </Pressable>
      <Text style={ms.val}>{value}</Text>
      <Pressable onPress={() => onChange(Math.min(20, value + 1))} style={ms.btn} hitSlop={8}>
        <Text style={ms.sign}>+</Text>
      </Pressable>
    </View>
  );
}
const ms = StyleSheet.create({
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  btn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  sign: { color: colors.ink, fontSize: 20, fontWeight: "900", lineHeight: 22 },
  val: { color: colors.ink, fontSize: 24, fontWeight: "900", minWidth: 32, textAlign: "center" },
});

type ForecastTab = "all" | "upcoming";

function kickoffLabel(iso: string | null) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Today ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

export default function Profile() {
  const router = useRouter();
  const { profile, session, refreshProfile } = useAuth();
  const { t } = useI18n();
  const [stats, setStats] = useState({ predictions: 0, exact: 0, leagues: 0, correct: 0 });
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [forecastTab, setForecastTab] = useState<ForecastTab>("all");
  const [editFc, setEditFc] = useState<any | null>(null);
  const [editHome, setEditHome] = useState(0);
  const [editAway, setEditAway] = useState(0);
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    const [{ count: predictions }, { count: exact }, { count: correct }, { count: leagues }, fc] = await Promise.all([
      supabase.from("predictions").select("id", { count: "exact", head: true }),
      supabase.from("predictions").select("id", { count: "exact", head: true }).eq("points_awarded", 3),
      supabase.from("predictions").select("id", { count: "exact", head: true }).gt("points_awarded", 0),
      supabase.from("league_members").select("league_id", { count: "exact", head: true }),
      fetchMyForecasts().catch(() => []),
    ]);
    setStats({ predictions: predictions ?? 0, exact: exact ?? 0, correct: correct ?? 0, leagues: leagues ?? 0 });
    setForecasts(fc);
    refreshProfile();
  }, [session?.user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const scored = forecasts.filter((f) => f.scored);
  const accuracy = scored.length ? Math.round((stats.correct / scored.length) * 100) : 0;

  const StatTile = ({ label, value, color }: { label: string; value: number | string; color: string }) => (
    <View style={styles.stat}>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgProfile }} contentContainerStyle={{ paddingBottom: 130 }}>
      <ScreenHeader
        title={t("tab_profile")}
        subtitle={t("profile_sub")}
        right={
          <Pressable onPress={() => router.push("/settings")} style={styles.gear} hitSlop={8}>
            <Icon name="settings-sharp" size={20} color={colors.ink} />
          </Pressable>
        }
      />

      <View style={{ alignItems: "center", gap: 6, paddingBottom: spacing.lg }}>
        <Avatar name={profile?.display_name || profile?.username} url={profile?.avatar_url} size={104} ring color={colors.purple} />
        <Text style={styles.name} numberOfLines={1}>{profile?.display_name || profile?.username || "Player"}</Text>
        <Text style={styles.handle} numberOfLines={1}>@{profile?.username}</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Icon name="star" size={26} color={colors.yellow} /></View>
          <View>
            <Text style={styles.heroLabel}>{t("total_points")}</Text>
            <Text style={styles.heroPoints}>{profile?.total_points ?? 0}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatTile label={t("stat_pred")} value={stats.predictions} color={colors.greenDark} />
          <StatTile label={t("stat_exact")} value={stats.exact} color={colors.orange} />
          <StatTile label={t("stat_acc")} value={`${accuracy}%`} color={colors.purple} />
          <StatTile label={t("stat_leagues")} value={stats.leagues} color={colors.cyan} />
        </View>

        <Text style={styles.section}>{t("my_forecasts")}</Text>

        {/* Tab selector */}
        <View style={styles.tabRow}>
          {(["all", "upcoming"] as ForecastTab[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setForecastTab(tab)}
              style={[styles.tabPill, forecastTab === tab && styles.tabPillActive]}
            >
              <Text style={[styles.tabPillTxt, forecastTab === tab && styles.tabPillTxtActive]}>
                {tab === "all" ? "All" : "Upcoming"}
              </Text>
            </Pressable>
          ))}
        </View>

        {forecastTab === "all" ? (
          forecasts.length === 0 ? (
            <View style={styles.emptyFc}>
              <Icon name="create-outline" size={20} color={colors.textDim} />
              <Text style={styles.emptyTxt}>{t("no_forecasts")}</Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {forecasts.slice(0, 15).map((f, i) => {
                const m = f.matches;
                if (!m) return null;
                return (
                  <View key={i} style={styles.fc}>
                    <Text style={styles.fcTeams} numberOfLines={1}>
                      {m.home_flag} {prettyTeam(m.home_team)} v {prettyTeam(m.away_team)} {m.away_flag}
                    </Text>
                    <View style={styles.fcRight}>
                      <Text style={styles.fcPick}>{f.pred_home}-{f.pred_away}</Text>
                      {f.scored ? (
                        <View style={[styles.fcBadge, { backgroundColor: f.points_awarded >= 3 ? colors.green : f.points_awarded > 0 ? colors.yellow : colors.surfaceAlt }]}>
                          <Text style={[styles.fcBadgeTxt, { color: f.points_awarded > 0 ? colors.blanc : colors.textFaint }]}>+{f.points_awarded}</Text>
                        </View>
                      ) : (
                        <Text style={styles.fcPending}>•••</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )
        ) : (() => {
          const upcoming = forecasts
            .filter((f) => f.matches?.status === "SCHEDULED" || f.matches?.status === "TIMED")
            .sort((a, b) => {
              const ta = a.matches?.utc_kickoff ?? "";
              const tb = b.matches?.utc_kickoff ?? "";
              return ta < tb ? -1 : ta > tb ? 1 : 0;
            });
          if (upcoming.length === 0) {
            return (
              <View style={styles.emptyFc}>
                <Icon name="time-outline" size={20} color={colors.textDim} />
                <Text style={styles.emptyTxt}>No upcoming predictions yet</Text>
              </View>
            );
          }
          return (
            <View style={{ gap: spacing.sm }}>
              {upcoming.map((f, i) => {
                const m = f.matches;
                if (!m) return null;
                const locked = !m.utc_kickoff || new Date(m.utc_kickoff) <= new Date() || (m.status !== "SCHEDULED" && m.status !== "TIMED");
                return (
                  <Pressable
                    key={f.match_id ?? i}
                    onPress={() => {
                      if (locked) return;
                      setEditFc(f);
                      setEditHome(f.pred_home);
                      setEditAway(f.pred_away);
                    }}
                    style={({ pressed }) => [styles.fc, !locked && styles.fcEditable, pressed && !locked && { opacity: 0.85 }]}
                  >
                    <View style={{ flex: 1, marginRight: spacing.md }}>
                      <Text style={styles.fcTeams} numberOfLines={1}>
                        {m.home_flag} {prettyTeam(m.home_team)} v {prettyTeam(m.away_team)} {m.away_flag}
                      </Text>
                      <Text style={styles.fcKickoff}>{kickoffLabel(m.utc_kickoff)}</Text>
                    </View>
                    <View style={styles.fcRight}>
                      <Text style={styles.fcPick}>{f.pred_home}-{f.pred_away}</Text>
                      <Icon
                        name={locked ? "lock-closed-outline" : "create-outline"}
                        size={16}
                        color={locked ? colors.textFaint : colors.purple}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })()}
      </View>

      {/* Edit prediction modal */}
      <Modal visible={!!editFc} transparent animationType="slide" onRequestClose={() => setEditFc(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {prettyTeam(editFc?.matches?.home_team)} vs {prettyTeam(editFc?.matches?.away_team)}
            </Text>
            <Text style={styles.modalKickoff}>{kickoffLabel(editFc?.matches?.utc_kickoff ?? null)}</Text>

            <View style={styles.modalSteppers}>
              <MiniStep value={editHome} onChange={setEditHome} />
              <Text style={styles.modalDash}>–</Text>
              <MiniStep value={editAway} onChange={setEditAway} />
            </View>

            <View style={styles.modalButtons}>
              <Pressable onPress={() => setEditFc(null)} style={styles.cancelBtn}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (!editFc?.match_id) return;
                  setEditSaving(true);
                  try {
                    await savePrediction(editFc.match_id, editHome, editAway);
                    setEditFc(null);
                    await load();
                  } catch {
                    notify("Save failed", "Could not save your prediction. Try again.");
                  } finally {
                    setEditSaving(false);
                  }
                }}
                style={[styles.saveBtn, editSaving && { opacity: 0.6 }]}
                disabled={editSaving}
              >
                <Text style={styles.saveTxt}>{editSaving ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  gear: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadow },
  name: { maxWidth: "88%", color: colors.ink, fontSize: 24, fontWeight: "900", marginTop: spacing.sm, textAlign: "center" },
  handle: { maxWidth: "88%", color: colors.textDim, fontSize: 14, fontWeight: "700", textAlign: "center" },
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.lg, backgroundColor: colors.purple, borderRadius: radius.xl, padding: spacing.xl, ...shadow },
  heroIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  heroLabel: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  heroPoints: { color: colors.blanc, fontSize: 44, fontWeight: "900", letterSpacing: -1, marginTop: -2 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stat: { width: "48%", minHeight: 82, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: "center", justifyContent: "center", ...shadow },
  statVal: { fontSize: 22, fontWeight: "900" },
  statLabel: { color: colors.textDim, fontSize: 10, fontWeight: "800", marginTop: 2, textAlign: "center", lineHeight: 13 },
  section: { color: colors.textDim, fontSize: 12, fontWeight: "900", letterSpacing: 1, marginTop: spacing.sm },
  tabRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  tabPill: { paddingHorizontal: spacing.lg, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, ...shadow },
  tabPillActive: { backgroundColor: colors.surfaceDark },
  tabPillTxt: { fontSize: 13, fontWeight: "800", color: colors.textDim },
  tabPillTxtActive: { color: colors.blanc },
  fcKickoff: { color: colors.textFaint, fontSize: 11, fontWeight: "700", marginTop: 2 },
  emptyFc: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  emptyTxt: { color: colors.textDim, fontSize: 13, fontWeight: "600", flex: 1 },
  fc: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, ...shadow },
  fcTeams: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 14, fontWeight: "800", marginRight: spacing.md },
  fcRight: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  fcPick: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  fcBadge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, minWidth: 28, alignItems: "center" },
  fcBadgeTxt: { fontSize: 12, fontWeight: "900" },
  fcPending: { color: colors.textFaint, fontSize: 14, fontWeight: "900" },
  fcEditable: { borderWidth: 1.5, borderColor: colors.purple },
  // modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, gap: spacing.lg, paddingBottom: 40 },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", textAlign: "center" },
  modalKickoff: { color: colors.textDim, fontSize: 12, fontWeight: "700", textAlign: "center", marginTop: -spacing.sm },
  modalSteppers: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xl },
  modalDash: { color: colors.textFaint, fontSize: 28, fontWeight: "800" },
  modalButtons: { flexDirection: "row", gap: spacing.md },
  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt },
  cancelTxt: { color: colors.textDim, fontSize: 15, fontWeight: "800" },
  saveBtn: { flex: 2, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.purple },
  saveTxt: { color: colors.blanc, fontSize: 15, fontWeight: "900" },
});
