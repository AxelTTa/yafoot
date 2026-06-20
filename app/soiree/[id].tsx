import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
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

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Constants ────────────────────────────────────────────────────────────────

const PUNISHMENTS = [
  "Prendre un shot",
  "Poster une story sans légende",
  "Envoyer un SMS bizarre à un contact au hasard",
  "Faire 10 pompes devant tout le monde",
  "Raconter son moment le plus gênant de l'année",
  "Imiter quelqu'un dans la pièce pendant 30 secondes",
  "Chanter 30 secondes d'une chanson au choix du groupe",
  "Boire un verre d'eau sans les mains",
  "Danser sans musique pendant 20 secondes",
  "Dire quelque chose de gentil à chaque personne dans la pièce",
  "Appeler sa mère en direct",
  "Faire un défi imposé par le groupe",
];

const PRESET_ROUNDS = [
  { icon: "football", question: "Prochain but ?", options: ["Équipe dom.", "Équipe ext.", "Personne"] },
  { icon: "flash", question: "But dans les 5 min ?", options: ["Oui", "Non"] },
  { icon: "stats-chart", question: "Tirs dans les 10 min ?", options: ["0-1", "2-3", "4+"] },
  { icon: "locate", question: "Prochain corner ?", options: ["Équipe dom.", "Équipe ext."] },
  { icon: "card", question: "Carton jaune bientôt ?", options: ["Oui", "Non"] },
  { icon: "alert-circle", question: "Pénalty avant la fin ?", options: ["Oui", "Non"] },
];

function randomPunishment() {
  return PUNISHMENTS[Math.floor(Math.random() * PUNISHMENTS.length)];
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SoireeRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [soiree, setSoiree] = useState<Soiree | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [myBet, setMyBet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(45);

  const isHost = myId !== null && myId === soiree?.host_id;
  const isHostRef = useRef(false);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);

  const myIdRef = useRef<string | null>(null);
  useEffect(() => { myIdRef.current = myId; }, [myId]);

  const roundIdRef = useRef<string | null>(null);
  useEffect(() => { roundIdRef.current = round?.id ?? null; }, [round?.id]);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  function getMemberName(userId: string) {
    const m = memberMap.get(userId);
    if (!m) return userId === myIdRef.current ? "Toi" : "Joueur";
    const name = m.profiles?.display_name || m.profiles?.username;
    return userId === myIdRef.current ? `${name} (toi)` : name || "Joueur";
  }

  // ── Setup + Realtime ─────────────────────────────────────────────────────

  useEffect(() => {
    let cleanup: (() => void) | null = null;

    async function setup() {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      setMyId(uid);
      myIdRef.current = uid;

      await Promise.all([loadSoiree(), loadMembers(), loadActiveRound()]);
      setLoading(false);

      const soireeSub = supabase
        .channel(`party-${id}-soiree`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "soirees", filter: `id=eq.${id}` }, () => {
          loadSoiree();
        })
        .subscribe();

      const roundSub = supabase
        .channel(`party-${id}-rounds`)
        .on("postgres_changes", { event: "*", schema: "public", table: "soiree_rounds", filter: `soiree_id=eq.${id}` }, () => {
          loadActiveRound();
        })
        .subscribe();

      const betSub = supabase
        .channel(`party-${id}-bets`)
        .on("postgres_changes", { event: "*", schema: "public", table: "soiree_bets" }, () => {
          const rid = roundIdRef.current;
          if (rid) loadBets(rid);
        })
        .subscribe();

      const memberSub = supabase
        .channel(`party-${id}-members`)
        .on("postgres_changes", { event: "*", schema: "public", table: "soiree_members", filter: `soiree_id=eq.${id}` }, () => {
          loadMembers();
        })
        .subscribe();

      cleanup = () => {
        supabase.removeChannel(soireeSub);
        supabase.removeChannel(roundSub);
        supabase.removeChannel(betSub);
        supabase.removeChannel(memberSub);
      };
    }

    setup();
    return () => { cleanup?.(); };
  }, [id]);

  // Auto-clear resolved state after 6s
  useEffect(() => {
    if (!round || round.status !== "resolved") return;
    const t = setTimeout(() => {
      setRound(null);
      setBets([]);
      setMyBet(null);
    }, 6000);
    return () => clearTimeout(t);
  }, [round?.id, round?.status]);

  // Countdown + auto-lock when hits 0 (host only)
  useEffect(() => {
    if (!round || round.status !== "open" || !round.bet_deadline) {
      setCountdown(0);
      return;
    }
    const deadline = round.bet_deadline;
    const roundId = round.id;
    let locked = false;

    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000));
      setCountdown(secs);
      if (secs === 0 && isHostRef.current && !locked) {
        locked = true;
        supabase
          .from("soiree_rounds")
          .update({ status: "locked" })
          .eq("id", roundId)
          .then(({ error }) => {
            if (error) { locked = false; notify("Erreur verrou", error.message); }
          });
      }
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [round?.id, round?.status, round?.bet_deadline]);

  // ── Data loaders ──────────────────────────────────────────────────────────

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
      .in("status", ["open", "locked", "resolved"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRound(data as Round | null);
    if (data) {
      await loadBets(data.id);
    } else {
      setBets([]);
      setMyBet(null);
    }
  }

  async function loadBets(roundId: string) {
    const { data } = await supabase.from("soiree_bets").select("*").eq("round_id", roundId);
    const list = (data as Bet[]) ?? [];
    setBets(list);
    const mine = list.find((b) => b.user_id === myIdRef.current);
    setMyBet(mine?.answer ?? null);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function startGame() {
    setBusy(true);
    const { error } = await supabase.from("soirees").update({ status: "active" }).eq("id", id);
    if (error) notify("Erreur", error.message);
    else loadSoiree();
    setBusy(false);
  }

  async function openRound(preset: { question: string; options: string[] }) {
    if (!isHost) return;
    setBusy(true);
    try {
      const deadline = new Date(Date.now() + 45000).toISOString();
      const { error } = await supabase.from("soiree_rounds").insert({
        soiree_id: id,
        question: preset.question,
        options: preset.options,
        status: "open",
        bet_deadline: deadline,
      });
      if (error) throw error;
      // Immediately reflect the new round on host's screen (don't wait for realtime)
      await loadActiveRound();
    } catch (e: any) {
      notify("Erreur lancement", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function placeBet(answer: string) {
    if (!round || countdown === 0) return;
    const uid = myIdRef.current;
    if (!uid) { notify("Connexion requise"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("soiree_bets").upsert(
        { round_id: round.id, user_id: uid, answer },
        { onConflict: "round_id,user_id" }
      );
      if (error) throw error;
      setMyBet(answer);
    } catch (e: any) {
      notify("Erreur pari", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function resolveRound(correctAnswer: string) {
    if (!round || !isHost) return;
    setBusy(true);
    try {
      const sortedBets = [...bets].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const correctBets = sortedBets.filter((b) => b.answer === correctAnswer);
      const fastestId = correctBets[0]?.user_id;

      for (const b of bets) {
        const isCorrect = b.answer === correctAnswer;
        const isFastest = b.user_id === fastestId;
        const punishment = isCorrect ? null : randomPunishment();
        const { error: betErr } = await supabase
          .from("soiree_bets")
          .update({ is_correct: isCorrect, punishment })
          .eq("id", b.id);
        if (betErr) throw betErr;
        if (isCorrect) {
          const pts = isFastest ? 15 : 10;
          const { data: cur } = await supabase
            .from("soiree_members")
            .select("points")
            .eq("soiree_id", id)
            .eq("user_id", b.user_id)
            .single();
          const { error: ptErr } = await supabase
            .from("soiree_members")
            .update({ points: (cur?.points ?? 0) + pts })
            .eq("soiree_id", id)
            .eq("user_id", b.user_id);
          if (ptErr) throw ptErr;
        }
      }

      const { error: roundErr } = await supabase
        .from("soiree_rounds")
        .update({ status: "resolved", correct_answer: correctAnswer })
        .eq("id", round.id);
      if (roundErr) throw roundErr;

      // Update local state immediately so all clients see resolved via realtime
      await loadBets(round.id);
      await loadMembers();
      setRound((prev) => prev ? { ...prev, status: "resolved", correct_answer: correctAnswer } : null);
    } catch (e: any) {
      notify("Erreur résolution", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function shareCode() {
    if (!soiree) return;
    const msg = `Rejoins ma Soirée YaFoot ! Code: ${soiree.join_code}`;
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(soiree.join_code).catch(() => {});
      }
      notify("Code copié !", soiree.join_code);
    } else {
      try { await Share.share({ message: msg }); } catch {}
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <Loading />;
  if (!soiree) return (
    <View style={{ flex: 1, backgroundColor: "#1A0A2E", justifyContent: "center", alignItems: "center" }}>
      <Header title="" />
      <Text style={{ color: colors.blanc }}>Soirée introuvable</Text>
    </View>
  );

  const match = (soiree as any).match;
  const isLive = match?.status === "IN_PLAY" || match?.status === "PAUSED";

  const state: "lobby" | "idle" | "open" | "locked" | "resolved" =
    soiree.status === "waiting" ? "lobby"
    : !round ? "idle"
    : round.status === "open" ? "open"
    : round.status === "locked" ? "locked"
    : "resolved";

  return (
    <View style={{ flex: 1, backgroundColor: "#1A0A2E" }}>
      <Header
        title={soiree.name}
        right={
          <Pressable onPress={shareCode} hitSlop={10}>
            <Icon name="share-outline" size={22} color={colors.blanc} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 80, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Match score bar */}
        <View style={S.matchBar}>
          <View style={S.matchTeam}>
            <Text style={S.matchFlag}>{match?.home_flag ?? ""}</Text>
            <Text style={S.matchTeamName} numberOfLines={1}>{match?.home_team ?? "Dom."}</Text>
          </View>
          <View style={S.scoreBox}>
            {isLive && <View style={S.liveDot} />}
            <Text style={S.scoreText}>
              {match?.home_score ?? 0} – {match?.away_score ?? 0}
            </Text>
            {match?.minute ? <Text style={S.minute}>{match.minute}'</Text> : null}
          </View>
          <View style={[S.matchTeam, { alignItems: "flex-end" }]}>
            <Text style={S.matchFlag}>{match?.away_flag ?? ""}</Text>
            <Text style={S.matchTeamName} numberOfLines={1}>{match?.away_team ?? "Ext."}</Text>
          </View>
        </View>

        {/* Join code badge */}
        <Pressable style={S.codeBadge} onPress={shareCode} hitSlop={8}>
          <Icon name="key-outline" size={15} color={colors.purple} />
          <Text style={S.codeTxt}>
            Code: <Text style={{ fontWeight: "900", color: colors.purple }}>{soiree.join_code}</Text>
          </Text>
          <Icon name="copy-outline" size={14} color={colors.textFaint} />
        </Pressable>

        {/* ── STATE 1: LOBBY ── */}
        {state === "lobby" && (
          <LobbyView members={members} isHost={isHost} busy={busy} onStart={startGame} />
        )}

        {/* ── STATE 2: IDLE (active, no round) ── */}
        {state === "idle" && (
          <IdleView isHost={isHost} busy={busy} onOpenRound={openRound} />
        )}

        {/* ── STATE 3: ROUND OPEN ── */}
        {state === "open" && round && (
          <RoundOpenView
            round={round}
            bets={bets}
            members={members}
            myBet={myBet}
            countdown={countdown}
            busy={busy}
            getMemberName={getMemberName}
            myId={myId}
            onBet={placeBet}
          />
        )}

        {/* ── STATE 4: ROUND LOCKED ── */}
        {state === "locked" && round && (
          <RoundLockedView
            round={round}
            bets={bets}
            isHost={isHost}
            busy={busy}
            getMemberName={getMemberName}
            myId={myId}
            onResolve={resolveRound}
          />
        )}

        {/* ── STATE 5: RESOLVED ── */}
        {state === "resolved" && round && (
          <RoundResolvedView
            round={round}
            bets={bets}
            getMemberName={getMemberName}
            isHost={isHost}
            onNextRound={() => { setRound(null); setBets([]); setMyBet(null); }}
          />
        )}

        {/* ── LEADERBOARD (always visible) ── */}
        <Leaderboard members={members} />
      </ScrollView>
    </View>
  );
}

// ── STATE 1: Lobby ────────────────────────────────────────────────────────────

function LobbyView({ members, isHost, busy, onStart }: {
  members: Member[];
  isHost: boolean;
  busy: boolean;
  onStart: () => void;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={S.sectionLabel}>DANS LA SALLE ({members.length})</Text>
      <View style={S.lobbyCard}>
        {members.length === 0 ? (
          <Text style={S.faint}>Personne encore...</Text>
        ) : (
          members.map((m) => {
            const name = m.profiles?.display_name || m.profiles?.username || "?";
            return (
              <View key={m.user_id} style={S.lobbyMember}>
                <Avatar name={name} url={m.profiles?.avatar_url} size={40} />
                <Text style={S.lobbyMemberName}>{name}</Text>
              </View>
            );
          })
        )}
      </View>

      {isHost ? (
        <Button title="Démarrer la partie" variant="purple" onPress={onStart} loading={busy} />
      ) : (
        <View style={S.waitingCard}>
          <Icon name="hourglass-outline" size={30} color={colors.yellow} />
          <Text style={S.waitingTxt}>En attente que l'hôte démarre...</Text>
        </View>
      )}
    </View>
  );
}

// ── STATE 2: Idle (active, no round) ─────────────────────────────────────────

function IdleView({ isHost, busy, onOpenRound }: {
  isHost: boolean;
  busy: boolean;
  onOpenRound: (p: { question: string; options: string[] }) => void;
}) {
  if (!isHost) {
    return (
      <View style={S.waitingCard}>
        <View style={S.pulseDot} />
        <Text style={S.waitingTxt}>En attente d'un round...</Text>
        <Text style={[S.faint, { textAlign: "center" }]}>L'hôte va lancer le prochain défi</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={S.sectionLabel}>LANCER UN DÉFI</Text>
      {PRESET_ROUNDS.map((p) => (
        <Pressable
          key={p.question}
          style={({ pressed }) => [S.presetBtn, pressed && { opacity: 0.75 }]}
          onPress={() => onOpenRound({ question: p.question, options: [...p.options] })}
          disabled={busy}
        >
          <IconTile name={p.icon as any} color={colors.orange} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={S.presetQ}>{p.question}</Text>
            <Text style={S.presetOpts}>{p.options.join(" / ")}</Text>
          </View>
          <Icon name="chevron-forward" size={22} color={colors.orange} />
        </Pressable>
      ))}
    </View>
  );
}

// ── STATE 3: Round Open ───────────────────────────────────────────────────────

function RoundOpenView({ round, bets, members, myBet, countdown, busy, getMemberName, myId, onBet }: {
  round: Round;
  bets: Bet[];
  members: Member[];
  myBet: string | null;
  countdown: number;
  busy: boolean;
  getMemberName: (id: string) => string;
  myId: string | null;
  onBet: (answer: string) => void;
}) {
  const urgent = countdown <= 10 && countdown > 0;
  const betterIds = new Set(bets.map((b) => b.user_id));
  const canBet = countdown > 0;

  return (
    <View style={S.roundCard}>
      {/* Big countdown */}
      <View style={S.countdownBox}>
        <Text style={[S.countdownNum, urgent && { color: colors.red }]}>
          {countdown}
        </Text>
        <Text style={S.countdownLabel}>secondes restantes</Text>
      </View>

      {/* Question */}
      <Text style={S.question}>{round.question}</Text>

      {myBet && (
        <View style={S.myBetBadge}>
          <Icon name="checkmark-circle" size={18} color={colors.green} />
          <Text style={S.myBetTxt}>Ton pari: <Text style={{ fontWeight: "900", color: colors.green }}>{myBet}</Text></Text>
          {canBet && <Text style={[S.faint, { fontSize: 11 }]}>(tu peux changer)</Text>}
        </View>
      )}

      {/* Answer cards */}
      {canBet && (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {round.options.map((opt) => (
            <Pressable
              key={opt}
              style={({ pressed }) => [
                S.answerCard,
                myBet === opt && S.answerCardSelected,
                pressed && { opacity: 0.82 },
              ]}
              onPress={() => onBet(opt)}
              disabled={busy}
            >
              {myBet === opt ? (
                <Icon name="checkmark-circle" size={24} color={colors.green} />
              ) : (
                <View style={S.answerCircle} />
              )}
              <Text style={[S.answerTxt, myBet === opt && { color: colors.green }]}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!canBet && (
        <Text style={[S.faint, { textAlign: "center", marginTop: spacing.sm }]}>
          Le temps est écoulé — attends que l'hôte révèle la réponse
        </Text>
      )}

      {/* Who has bet */}
      {members.length > 0 && (
        <View style={S.bettersRow}>
          {members.map((m) => {
            const hasBet = betterIds.has(m.user_id);
            const name = m.profiles?.display_name || m.profiles?.username || "?";
            return (
              <View key={m.user_id} style={S.betterCell}>
                <View style={{ opacity: hasBet ? 1 : 0.35 }}>
                  <Avatar name={name} url={m.profiles?.avatar_url} size={34} />
                </View>
                {hasBet && (
                  <View style={S.betCheckmark}>
                    <Icon name="checkmark" size={10} color={colors.blanc} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── STATE 4: Round Locked ─────────────────────────────────────────────────────

function RoundLockedView({ round, bets, isHost, busy, getMemberName, myId, onResolve }: {
  round: Round;
  bets: Bet[];
  isHost: boolean;
  busy: boolean;
  getMemberName: (id: string) => string;
  myId: string | null;
  onResolve: (answer: string) => void;
}) {
  return (
    <View style={S.roundCard}>
      <View style={S.lockedHeaderRow}>
        <Icon name="lock-closed" size={20} color={colors.orange} />
        <Text style={S.lockedHeader}>C'est quoi la bonne réponse ?</Text>
      </View>

      {/* Reveal: who bet what */}
      {round.options.map((opt) => {
        const betters = bets.filter((b) => b.answer === opt);
        return (
          <View key={opt} style={S.revealBlock}>
            <Text style={S.revealOpt}>{opt}</Text>
            <View style={S.revealNames}>
              {betters.length === 0 ? (
                <Text style={S.faint}>—</Text>
              ) : (
                betters.map((b) => (
                  <View key={b.id} style={S.namePill}>
                    <Text style={S.namePillTxt}>{getMemberName(b.user_id)}</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        );
      })}

      {/* Host resolve buttons */}
      {isHost && (
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Text style={[S.sectionLabel, { color: "rgba(255,255,255,0.45)" }]}>TAPER LA BONNE RÉPONSE</Text>
          {round.options.map((opt) => (
            <Pressable
              key={opt}
              style={({ pressed }) => [S.resolveBtn, pressed && { opacity: 0.8 }]}
              onPress={() => onResolve(opt)}
              disabled={busy}
            >
              <Text style={S.resolveTxt}>{opt}</Text>
              <Icon name="checkmark-done" size={22} color={colors.blanc} />
            </Pressable>
          ))}
        </View>
      )}

      {!isHost && (
        <View style={S.waitSmall}>
          <Icon name="hourglass-outline" size={18} color={colors.yellow} />
          <Text style={S.waitSmallTxt}>L'hôte choisit la bonne réponse...</Text>
        </View>
      )}
    </View>
  );
}

// ── STATE 5: Resolved ─────────────────────────────────────────────────────────

function RoundResolvedView({ round, bets, getMemberName, isHost, onNextRound }: {
  round: Round;
  bets: Bet[];
  getMemberName: (id: string) => string;
  isHost: boolean;
  onNextRound: () => void;
}) {
  const winners = bets.filter((b) => b.is_correct === true);
  const losers = bets.filter((b) => b.is_correct === false && b.punishment);
  const correctAnswer = round.correct_answer;

  return (
    <View style={S.roundCard}>
      {/* Trophy + Winners */}
      <View style={S.celebrationBox}>
        <IconTile name="trophy" color={colors.yellow} size={60} />
        <Text style={S.correctAnswerTxt}>
          Bonne réponse: <Text style={{ color: colors.green }}>{correctAnswer}</Text>
        </Text>
        {winners.length === 0 ? (
          <Text style={S.celebNoWinner}>Personne n'avait bon !</Text>
        ) : (
          winners.map((b) => (
            <View key={b.id} style={S.winnerRow}>
              <Icon name="star" size={18} color={colors.yellow} />
              <Text style={S.winnerTxt}>{getMemberName(b.user_id)} a raison !</Text>
            </View>
          ))
        )}
      </View>

      {/* Punishments */}
      {losers.length > 0 && (
        <View style={S.punishBox}>
          <Text style={S.punishTitle}>Punitions</Text>
          {losers.map((b) => (
            <View key={b.id} style={S.punishRow}>
              <Icon name="flame" size={16} color={colors.red} />
              <Text style={S.punishItem}>
                <Text style={{ fontWeight: "900" }}>{getMemberName(b.user_id)}</Text>: {b.punishment}
              </Text>
            </View>
          ))}
        </View>
      )}

      {isHost && (
        <Button
          title="Prochain round"
          variant="purple"
          onPress={onNextRound}
          style={{ marginTop: spacing.md }}
        />
      )}

      <Text style={[S.faint, { textAlign: "center", marginTop: spacing.sm }]}>
        Retour automatique dans 6 secondes...
      </Text>
    </View>
  );
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

function Leaderboard({ members }: { members: Member[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? members : members.slice(0, 3);

  return (
    <View>
      <Pressable style={S.lbHeaderRow} onPress={() => setExpanded(!expanded)} hitSlop={8}>
        <Text style={S.sectionLabel}>CLASSEMENT</Text>
        {members.length > 3 && (
          <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} color="rgba(255,255,255,0.45)" />
        )}
      </Pressable>
      {shown.map((m, i) => {
        const name = m.profiles?.display_name || m.profiles?.username || "?";
        return (
          <View key={m.user_id} style={S.memberRow}>
            <Text style={[S.rank, i === 0 ? { color: colors.yellow } : i === 1 ? { color: colors.textDim } : { color: colors.textFaint }]}>
              #{i + 1}
            </Text>
            <Avatar name={name} url={m.profiles?.avatar_url} size={34} />
            <Text style={S.memberName}>{name}</Text>
            <Text style={S.pts}>{m.points} pts</Text>
          </View>
        );
      })}
      {members.length === 0 && (
        <Text style={[S.faint, { textAlign: "center", paddingVertical: 12 }]}>Aucun joueur encore</Text>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  // Match bar
  matchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radius.xl,
    padding: spacing.lg, gap: spacing.md,
  },
  matchTeam: { flex: 1, alignItems: "flex-start", gap: 4 },
  matchFlag: { fontSize: 26 },
  matchTeamName: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700" },
  scoreBox: { alignItems: "center", gap: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.live },
  scoreText: { color: colors.blanc, fontSize: 30, fontWeight: "900", letterSpacing: 1 },
  minute: { color: colors.textFaint, fontSize: 12, fontWeight: "700" },

  // Code badge
  codeBadge: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignSelf: "center",
  },
  codeTxt: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "700" },

  // Labels
  sectionLabel: { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  faint: { color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: "600" },

  // Lobby
  lobbyCard: {
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: radius.xl,
    padding: spacing.lg, gap: spacing.md,
  },
  lobbyMember: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  lobbyMemberName: { color: colors.blanc, fontSize: 16, fontWeight: "800" },

  // Waiting
  waitingCard: {
    alignItems: "center", gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: radius.xl,
    padding: spacing.xl,
  },
  waitingTxt: { color: colors.blanc, fontSize: 17, fontWeight: "800", textAlign: "center" },
  pulseDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.green },

  // Preset buttons
  presetBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: "rgba(251,140,60,0.1)", borderRadius: radius.xl,
    borderWidth: 1, borderColor: "rgba(251,140,60,0.3)",
    padding: spacing.md,
  },
  presetQ: { color: colors.blanc, fontSize: 15, fontWeight: "900" },
  presetOpts: { color: colors.orange, fontSize: 12, fontWeight: "700", marginTop: 2 },

  // Round card
  roundCard: {
    backgroundColor: colors.surfaceDark, borderRadius: radius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: "rgba(155,93,229,0.4)",
    ...shadow, gap: spacing.sm,
  },

  // Countdown
  countdownBox: { alignItems: "center", paddingVertical: spacing.md },
  countdownNum: { color: colors.yellow, fontSize: 72, fontWeight: "900", lineHeight: 80 },
  countdownLabel: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "700" },

  // Question
  question: { color: colors.blanc, fontSize: 22, fontWeight: "900", textAlign: "center" },

  // My bet
  myBetBadge: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: "rgba(34,197,94,0.12)", borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignSelf: "center",
  },
  myBetTxt: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "700" },

  // Answer cards
  answerCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
    borderWidth: 2, borderColor: "transparent", minHeight: 64,
  },
  answerCardSelected: { borderColor: colors.green, backgroundColor: "rgba(34,197,94,0.15)" },
  answerCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" },
  answerTxt: { color: colors.blanc, fontSize: 18, fontWeight: "900", flex: 1 },

  // Betters row
  bettersRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm, justifyContent: "center" },
  betterCell: { alignItems: "center", position: "relative" },
  betCheckmark: {
    position: "absolute", bottom: 0, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.green, alignItems: "center", justifyContent: "center",
  },

  // Locked state
  lockedHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  lockedHeader: { color: colors.blanc, fontSize: 18, fontWeight: "900", flex: 1 },
  revealBlock: {
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radius.md,
    padding: spacing.md, gap: spacing.xs,
  },
  revealOpt: { color: colors.orange, fontSize: 13, fontWeight: "900" },
  revealNames: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  namePill: {
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  namePillTxt: { color: colors.blanc, fontSize: 12, fontWeight: "700" },

  // Wait small
  waitSmall: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    justifyContent: "center", marginTop: spacing.md,
  },
  waitSmallTxt: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "700" },

  // Resolve buttons
  resolveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(34,197,94,0.2)", borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
    borderWidth: 1, borderColor: "rgba(34,197,94,0.5)", minHeight: 60,
  },
  resolveTxt: { color: colors.blanc, fontWeight: "900", fontSize: 17 },

  // Resolved/Celebration
  celebrationBox: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  correctAnswerTxt: { color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: "700" },
  celebNoWinner: { color: colors.orange, fontSize: 18, fontWeight: "900" },
  winnerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  winnerTxt: { color: colors.yellow, fontSize: 20, fontWeight: "900" },

  // Punishments
  punishBox: {
    backgroundColor: "rgba(255,90,95,0.12)", borderRadius: radius.lg,
    padding: spacing.md, gap: 8,
  },
  punishTitle: { color: colors.red, fontSize: 14, fontWeight: "900" },
  punishRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  punishItem: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "600", flex: 1 },

  // Leaderboard
  lbHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  memberRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: radius.lg,
    padding: spacing.sm, paddingHorizontal: spacing.md, marginBottom: 6,
  },
  rank: { fontSize: 16, fontWeight: "900", width: 28 },
  memberName: { color: colors.blanc, fontSize: 14, fontWeight: "800", flex: 1 },
  pts: { color: colors.yellow, fontSize: 16, fontWeight: "900" },
});
