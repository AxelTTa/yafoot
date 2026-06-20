import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, Button, Header, Icon, IconTile, Loading } from "../../components/ui";
import { notify } from "../../lib/notify";
import { supabase } from "../../lib/supabase";
import { colors, radius, shadow, spacing } from "../../lib/theme";

type RoundStatus = "open" | "locked" | "resolved";
type SoireeStatus = "waiting" | "active" | "ended";

interface Soiree {
  id: string;
  name: string;
  join_code: string;
  status: SoireeStatus;
  host_id: string;
  match_id: number;
  match?: {
    home_team: string;
    away_team: string;
    home_flag: string | null;
    away_flag: string | null;
    home_score: number | null;
    away_score: number | null;
    status: string;
    minute: string | null;
  };
}

interface Round {
  id: string;
  soiree_id: string;
  question: string;
  options: string[];
  correct_answer: string | null;
  status: RoundStatus;
  bet_deadline: string | null;
  created_at: string;
}

interface Bet {
  id: string;
  round_id: string;
  user_id: string;
  answer: string;
  is_correct: boolean | null;
  punishment: string | null;
  created_at: string;
}

interface Member {
  user_id: string;
  points: number;
  profiles: { username: string; display_name: string | null; avatar_url: string | null };
}

const PUNISHMENTS = [
  "Prendre un shot",
  "Poster une photo sur sa story sans légende",
  "Envoyer un SMS bizarre à un contact au hasard",
  "Faire 10 pompes devant tout le monde",
  "Raconter son moment le plus gênant",
  "Imiter quelqu'un dans la pièce",
  "Chanter 30 secondes de n'importe quelle chanson",
  "Appeler sa mère en direct",
  "Boire un verre d'eau sans les mains",
  "Faire un défi TikTok en live",
  "Dire quelque chose de gentil à chaque personne dans la pièce",
  "Danser sans musique pendant 20 secondes",
];

const PRESET_ROUNDS = [
  { icon: "football", question: "Prochain but ?", options: ["Équipe dom.", "Équipe ext.", "Personne"] },
  { icon: "flash", question: "But dans les 5 min ?", options: ["Oui", "Non"] },
  { icon: "stats-chart", question: "Tirs cadrés dans les 10 min (équipes cumul)", options: ["0-1", "2-3", "4+"] },
  { icon: "card", question: "Carton avant la mi-temps ?", options: ["Oui", "Non"] },
  { icon: "refresh", question: "Prochain corner ?", options: ["Équipe dom.", "Équipe ext."] },
  { icon: "person-remove", question: "Hors-jeu dans les 5 min ?", options: ["Oui", "Non"] },
  { icon: "trophy", question: "Score exact à la mi-temps ?", options: ["0-0", "1-0", "0-1", "1-1"] },
  { icon: "warning", question: "Coup franc dangereux (10 min) ?", options: ["Oui", "Non"] },
];

function randomPunishment(): string {
  return PUNISHMENTS[Math.floor(Math.random() * PUNISHMENTS.length)];
}

export default function SoireeRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [soiree, setSoiree] = useState<Soiree | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [myBet, setMyBet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showPresets, setShowPresets] = useState(false);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;

  const isHost = myId === soiree?.host_id;

  useEffect(() => {
    init();
  }, [id]);

  async function init() {
    const { data: u } = await supabase.auth.getUser();
    setMyId(u.user?.id ?? null);
    await Promise.all([loadSoiree(), loadMembers(), loadActiveRound()]);
    setLoading(false);

    // realtime: rounds
    const roundSub = supabase
      .channel(`soiree-rounds-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "soiree_rounds", filter: `soiree_id=eq.${id}` }, () => {
        loadActiveRound();
      })
      .subscribe();

    // realtime: bets
    const betSub = supabase
      .channel(`soiree-bets-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "soiree_bets" }, () => {
        loadBets();
      })
      .subscribe();

    // realtime: members (points updates)
    const memberSub = supabase
      .channel(`soiree-members-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "soiree_members", filter: `soiree_id=eq.${id}` }, () => {
        loadMembers();
      })
      .subscribe();

    // realtime: match score
    const matchSub = supabase
      .channel(`soiree-match-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches" }, () => {
        loadSoiree();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roundSub);
      supabase.removeChannel(betSub);
      supabase.removeChannel(memberSub);
      supabase.removeChannel(matchSub);
    };
  }

  async function loadSoiree() {
    const { data } = await supabase
      .from("soirees")
      .select("*, match:matches(home_team, away_team, home_flag, away_flag, home_score, away_score, status, minute)")
      .eq("id", id)
      .single();
    if (data) setSoiree(data as any);
  }

  async function loadMembers() {
    const { data } = await supabase
      .from("soiree_members")
      .select("user_id, points, profiles(username, display_name, avatar_url)")
      .eq("soiree_id", id)
      .order("points", { ascending: false });
    setMembers((data as any[]) ?? []);
  }

  async function loadActiveRound() {
    const { data } = await supabase
      .from("soiree_rounds")
      .select("*")
      .eq("soiree_id", id)
      .in("status", ["open", "locked"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRound(data as Round | null);
    if (data) await loadBets(data.id);
    else setBets([]);
  }

  async function loadBets(roundId?: string) {
    const rid = roundId ?? round?.id;
    if (!rid) return;
    const { data } = await supabase.from("soiree_bets").select("*").eq("round_id", rid);
    setBets((data as Bet[]) ?? []);
    const mine = (data as Bet[])?.find((b) => b.user_id === myId);
    if (mine) setMyBet(mine.answer);
    else setMyBet(null);
  }

  // countdown timer
  useEffect(() => {
    if (!round || round.status !== "open" || !round.bet_deadline) { setCountdown(0); return; }
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(round.bet_deadline!).getTime() - Date.now()) / 1000));
      setCountdown(secs);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [round?.id, round?.status, round?.bet_deadline]);

  async function openRound(preset: typeof PRESET_ROUNDS[0]) {
    if (!isHost) return;
    setBusy(true);
    try {
      const deadline = new Date(Date.now() + 30000).toISOString();
      const { error } = await supabase.from("soiree_rounds").insert({
        soiree_id: id,
        question: preset.question,
        options: preset.options,
        status: "open",
        bet_deadline: deadline,
      });
      if (error) throw error;
      setShowPresets(false);
    } catch (e: any) {
      notify("Error", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function placeBet(answer: string) {
    if (!round || myBet) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("soiree_bets").upsert(
        { round_id: round.id, user_id: u.user.id, answer },
        { onConflict: "round_id,user_id" }
      );
      if (error) throw error;
      setMyBet(answer);
    } catch (e: any) {
      notify("Error", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function lockRound() {
    if (!round || !isHost) return;
    const { error } = await supabase.from("soiree_rounds").update({ status: "locked" }).eq("id", round.id);
    if (error) notify("Error", error.message);
  }

  async function resolveRound(correctAnswer: string) {
    if (!round || !isHost) return;
    setBusy(true);
    try {
      // find bets sorted by created_at to determine fastest
      const sortedBets = [...bets].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const correctBets = sortedBets.filter((b) => b.answer === correctAnswer);
      const wrongBets = sortedBets.filter((b) => b.answer !== correctAnswer);
      const fastestId = correctBets[0]?.user_id;

      // update bets: mark correct/wrong, assign punishments
      for (const b of bets) {
        const isCorrect = b.answer === correctAnswer;
        const isFastest = b.user_id === fastestId;
        const punishment = isCorrect ? null : randomPunishment();
        await supabase
          .from("soiree_bets")
          .update({ is_correct: isCorrect, punishment })
          .eq("id", b.id);
        // update member points
        const pts = isCorrect ? (isFastest ? 15 : 10) : 0;
        if (pts > 0) {
          // direct update: increment points
          const { data: cur } = await supabase.from("soiree_members").select("points").eq("soiree_id", id).eq("user_id", b.user_id).single();
          await supabase.from("soiree_members").update({ points: (cur?.points ?? 0) + pts }).eq("soiree_id", id).eq("user_id", b.user_id);
        }
      }

      // mark round resolved
      await supabase.from("soiree_rounds").update({ status: "resolved", correct_answer: correctAnswer }).eq("id", round.id);

      // flash green
      triggerFlash(colors.green);
      await loadBets();
      await loadMembers();

      // auto-return to idle after 5s
      setTimeout(() => {
        setRound(null);
        setBets([]);
        setMyBet(null);
      }, 5000);
    } catch (e: any) {
      notify("Error", e.message);
    } finally {
      setBusy(false);
    }
  }

  function triggerFlash(color: string) {
    setFlashColor(color);
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => setFlashColor(null));
  }

  async function shareCode() {
    if (!soiree) return;
    const msg = `Rejoins ma Soirée "${soiree.name}" sur YaFoot!\nCode: ${soiree.join_code}`;
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(msg).catch(() => {});
      }
      notify("Code copié", soiree.join_code);
    } else {
      try { await Share.share({ message: msg }); } catch {}
    }
  }

  if (loading) return <Loading />;
  if (!soiree) return (
    <View style={{ flex: 1, backgroundColor: "#1A0A2E", justifyContent: "center", alignItems: "center" }}>
      <Header title="" />
      <Text style={{ color: colors.blanc }}>Soirée not found</Text>
    </View>
  );

  const match = (soiree as any).match;
  const isLive = match?.status === "IN_PLAY" || match?.status === "PAUSED";

  return (
    <View style={{ flex: 1, backgroundColor: "#1A0A2E" }}>
      {/* Flash overlay */}
      {flashColor && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: flashColor, opacity: flashAnim, zIndex: 999 }]}
        />
      )}

      <Header
        title={soiree.name}
        right={
          <Pressable onPress={shareCode} hitSlop={10}>
            <Icon name="share-outline" size={22} color={colors.blanc} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 80, gap: spacing.lg }}>

        {/* ── Match score bar ── */}
        <View style={styles.matchBar}>
          <View style={styles.matchTeam}>
            <Text style={styles.matchFlag}>{match?.home_flag ?? ""}</Text>
            <Text style={styles.matchTeamName} numberOfLines={1}>{match?.home_team ?? "Home"}</Text>
          </View>
          <View style={styles.scoreBox}>
            {isLive && <View style={styles.liveDot} />}
            <Text style={styles.scoreText}>
              {match?.home_score ?? 0} – {match?.away_score ?? 0}
            </Text>
            {match?.minute ? <Text style={styles.minute}>{match.minute}'</Text> : null}
          </View>
          <View style={[styles.matchTeam, { alignItems: "flex-end" }]}>
            <Text style={styles.matchFlag}>{match?.away_flag ?? ""}</Text>
            <Text style={styles.matchTeamName} numberOfLines={1}>{match?.away_team ?? "Away"}</Text>
          </View>
        </View>

        {/* ── Code badge ── */}
        <Pressable style={styles.codeBadge} onPress={shareCode}>
          <Icon name="key-outline" size={16} color={colors.purple} />
          <Text style={styles.codeText}>Code: <Text style={{ fontWeight: "900", color: colors.purple }}>{soiree.join_code}</Text></Text>
          <Icon name="copy-outline" size={14} color={colors.textFaint} />
        </Pressable>

        {/* ── Round area ── */}
        {round ? (
          <RoundCard
            round={round}
            bets={bets}
            myBet={myBet}
            myId={myId}
            isHost={isHost}
            countdown={countdown}
            busy={busy}
            onBet={placeBet}
            onLock={lockRound}
            onResolve={resolveRound}
          />
        ) : (
          <View style={styles.idleCard}>
            <IconTile name="hourglass" color={colors.orange} size={56} />
            <Text style={styles.idleTitle}>En attente d'un round…</Text>
            <Text style={styles.idleSub}>
              {isHost ? "Lance un round depuis les presets ci-dessous." : "L'hôte va lancer le prochain challenge."}
            </Text>
          </View>
        )}

        {/* ── Host: open round presets ── */}
        {isHost && !round && (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.sectionLabel}>LANCER UN ROUND</Text>
            <View style={styles.presetsGrid}>
              {PRESET_ROUNDS.map((p) => (
                <Pressable key={p.question} style={styles.presetCard} onPress={() => openRound(p)} disabled={busy}>
                  <Icon name={p.icon as any} size={22} color={colors.orange} />
                  <Text style={styles.presetQ}>{p.question}</Text>
                  <Text style={styles.presetOpts}>{p.options.join(" / ")}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ── Leaderboard ── */}
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.sectionLabel}>CLASSEMENT</Text>
          {members.map((m, i) => {
            const displayName = m.profiles?.display_name || m.profiles?.username || "?";
            const punishmentsForMember = bets.filter((b) => b.user_id === m.user_id && b.punishment && b.is_correct === false);
            return (
              <View key={m.user_id} style={styles.memberRow}>
                <Text style={[styles.rank, { color: i === 0 ? colors.yellow : i === 1 ? colors.textDim : colors.textFaint }]}>
                  #{i + 1}
                </Text>
                <Avatar name={displayName} url={m.profiles?.avatar_url} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{displayName}</Text>
                  {punishmentsForMember.length > 0 && (
                    <Text style={styles.punishmentText} numberOfLines={1}>
                      {punishmentsForMember[punishmentsForMember.length - 1].punishment}
                    </Text>
                  )}
                </View>
                <Text style={styles.pts}>{m.points} pts</Text>
              </View>
            );
          })}
          {members.length === 0 && (
            <Text style={{ color: colors.textFaint, textAlign: "center", paddingVertical: 16 }}>Aucun joueur encore</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Round Card component ──────────────────────────────────────────────────────

function RoundCard({
  round, bets, myBet, myId, isHost, countdown, busy,
  onBet, onLock, onResolve,
}: {
  round: Round;
  bets: Bet[];
  myBet: string | null;
  myId: string | null;
  isHost: boolean;
  countdown: number;
  busy: boolean;
  onBet: (a: string) => void;
  onLock: () => void;
  onResolve: (a: string) => void;
}) {
  const isOpen = round.status === "open";
  const isLocked = round.status === "locked";
  const isResolved = round.status === "resolved";

  const betCount = bets.length;
  const urgentCountdown = countdown <= 10 && countdown > 0;

  return (
    <View style={styles.roundCard}>
      {/* Header */}
      <View style={styles.roundHeader}>
        <View style={[styles.roundStatusChip, { backgroundColor: isOpen ? colors.green : isLocked ? colors.orange : colors.purple }]}>
          <Text style={styles.roundStatusTxt}>
            {isOpen ? "ROUND OUVERT" : isLocked ? "LOCKED" : "RÉSOLU"}
          </Text>
        </View>
        {isOpen && countdown > 0 && (
          <Text style={[styles.countdown, urgentCountdown && { color: colors.red }]}>
            {countdown}s
          </Text>
        )}
      </View>

      {/* Question */}
      <Text style={styles.roundQuestion}>{round.question}</Text>
      <Text style={styles.roundBetCount}>{betCount} pari{betCount !== 1 ? "s" : ""}</Text>

      {/* Options */}
      {isOpen && !myBet && (
        <View style={styles.optionsRow}>
          {round.options.map((opt) => (
            <Pressable
              key={opt}
              style={({ pressed }) => [styles.optBtn, pressed && { opacity: 0.8 }]}
              onPress={() => onBet(opt)}
              disabled={busy}
            >
              <Text style={styles.optTxt}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* My bet locked in */}
      {(isOpen && myBet) && (
        <View style={styles.myBetBadge}>
          <Icon name="checkmark-circle" size={18} color={colors.green} />
          <Text style={styles.myBetTxt}>Ton pari: <Text style={{ fontWeight: "900", color: colors.green }}>{myBet}</Text></Text>
        </View>
      )}

      {/* LOCKED: reveal who bet what */}
      {(isLocked || isResolved) && (
        <View style={{ gap: 6, marginTop: spacing.sm }}>
          {round.options.map((opt) => {
            const betters = bets.filter((b) => b.answer === opt);
            const isCorrectOpt = round.correct_answer === opt;
            return (
              <View key={opt} style={[styles.revealRow, isCorrectOpt && styles.revealRowCorrect]}>
                <Text style={styles.revealOpt}>{opt}</Text>
                <View style={styles.revealNames}>
                  {betters.length === 0 ? (
                    <Text style={styles.revealNone}>—</Text>
                  ) : betters.map((b) => (
                    <View key={b.id} style={[styles.revealBetter, b.is_correct === true && styles.revealBetterCorrect]}>
                      <Text style={styles.revealBetterTxt}>{b.user_id === myId ? "Toi" : b.user_id.slice(0, 6)}</Text>
                    </View>
                  ))}
                </View>
                {isResolved && isCorrectOpt && <Icon name="checkmark-circle" size={18} color={colors.green} />}
              </View>
            );
          })}
        </View>
      )}

      {/* RESOLVED: punishments */}
      {isResolved && bets.some((b) => b.punishment) && (
        <View style={styles.punishBox}>
          <Text style={styles.punishTitle}>Punitions</Text>
          {bets.filter((b) => b.punishment).map((b) => (
            <Text key={b.id} style={styles.punishItem}>
              {b.user_id === myId ? "Toi" : b.user_id.slice(0, 6)}: {b.punishment}
            </Text>
          ))}
        </View>
      )}

      {/* Host controls */}
      {isHost && isOpen && (
        <Button title="Verrouiller le round" variant="dark" onPress={onLock} style={{ marginTop: spacing.md }} />
      )}
      {isHost && isLocked && (
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Text style={[styles.roundBetCount, { color: colors.blanc }]}>Quelle est la bonne réponse ?</Text>
          {round.options.map((opt) => (
            <Pressable
              key={opt}
              style={({ pressed }) => [styles.resolveBtn, pressed && { opacity: 0.8 }]}
              onPress={() => onResolve(opt)}
              disabled={busy}
            >
              <Text style={styles.resolveTxt}>{opt}</Text>
              <Icon name="checkmark" size={18} color={colors.blanc} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  matchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  matchTeam: { flex: 1, alignItems: "flex-start", gap: 4 },
  matchFlag: { fontSize: 24 },
  matchTeamName: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700" },
  scoreBox: { alignItems: "center", gap: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.live },
  scoreText: { color: colors.blanc, fontSize: 28, fontWeight: "900", letterSpacing: 1 },
  minute: { color: colors.textFaint, fontSize: 12, fontWeight: "700" },
  codeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignSelf: "center",
  },
  codeText: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "700" },
  idleCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  idleTitle: { color: colors.blanc, fontSize: 20, fontWeight: "900" },
  idleSub: { color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: "600", textAlign: "center" },
  sectionLabel: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  presetsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  presetCard: {
    backgroundColor: "rgba(251,140,60,0.1)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(251,140,60,0.3)",
    padding: spacing.md,
    width: "48%",
    gap: 4,
  },
  presetQ: { color: colors.blanc, fontSize: 13, fontWeight: "800", lineHeight: 18 },
  presetOpts: { color: colors.orange, fontSize: 11, fontWeight: "700" },
  roundCard: {
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(155,93,229,0.4)",
    ...shadow,
  },
  roundHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  roundStatusChip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  roundStatusTxt: { color: colors.blanc, fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  countdown: { color: colors.yellow, fontSize: 28, fontWeight: "900" },
  roundQuestion: { color: colors.blanc, fontSize: 20, fontWeight: "900", marginBottom: 4 },
  roundBetCount: { color: colors.textFaint, fontSize: 13, fontWeight: "600", marginBottom: spacing.sm },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  optBtn: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: colors.purple,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  optTxt: { color: colors.blanc, fontWeight: "900", fontSize: 15 },
  myBetBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignSelf: "flex-start",
  },
  myBetTxt: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "700" },
  revealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  revealRowCorrect: { backgroundColor: "rgba(34,197,94,0.15)", borderWidth: 1, borderColor: "rgba(34,197,94,0.4)" },
  revealOpt: { color: colors.blanc, fontWeight: "800", fontSize: 14, minWidth: 80 },
  revealNames: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  revealNone: { color: colors.textFaint, fontSize: 13 },
  revealBetter: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  revealBetterCorrect: { backgroundColor: "rgba(34,197,94,0.25)" },
  revealBetterTxt: { color: colors.blanc, fontSize: 12, fontWeight: "700" },
  punishBox: {
    backgroundColor: "rgba(255,90,95,0.12)",
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
    marginTop: spacing.sm,
  },
  punishTitle: { color: colors.red, fontSize: 13, fontWeight: "900", marginBottom: 2 },
  punishItem: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" },
  resolveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(34,197,94,0.2)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.4)",
  },
  resolveTxt: { color: colors.blanc, fontWeight: "900", fontSize: 15 },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: radius.lg,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  rank: { fontSize: 16, fontWeight: "900", width: 28 },
  memberName: { color: colors.blanc, fontSize: 14, fontWeight: "800" },
  punishmentText: { color: colors.red, fontSize: 11, fontWeight: "600" },
  pts: { color: colors.yellow, fontSize: 16, fontWeight: "900" },
});
