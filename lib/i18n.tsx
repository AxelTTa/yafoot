import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "en" | "fr";
const LANG_KEY = "yafoot.lang";

// ─── translations ────────────────────────────────────────────────────────────
// EN: casual fun.  FR: goofy youth-speak ("potes", "bro", "t'as", etc.)

const T = {
  en: {
    // lang picker (en)
    lang_pick: "Pick your language",
    lang_en: "English 🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    lang_fr: "Français 🇫🇷",
    lang_continue: "Let's play",

    // welcome
    welcome_tagline: "Predict the World Cup.\nBeat your mates.",
    welcome_invited: "Your mate invited you!",
    username_label: "YOUR NAME",
    username_placeholder: "Your name (e.g. Axel)",
    handle_preview: "Your handle: @{h}",
    btn_start: "Let's go!",
    btn_join_friend: "Join & add friend",
    welcome_fine: "No email needed. Just your name and you're in.",
    err_short: "Need at least 2 characters.",
    err_chars: "That username is already taken — try a different name.",

    // invite
    invite_congrats: "You're in, @{u}!",
    invite_sub: "Way better with mates. Share your link — they tap it, you're instantly connected.",
    invite_link_label: "YOUR INVITE LINK",
    btn_copy: "Copy",
    btn_copied: "Copied!",
    btn_share: "Share",
    btn_continue: "Continue to app",

    // tabs
    tab_matches: "Matches",
    tab_predict: "Predict",
    tab_leagues: "Leagues",
    tab_friends: "Friends",
    tab_profile: "Profile",

    // matches screen
    matches_sub: "World Cup 2026",
    filter_live: "Live",
    filter_upcoming: "Upcoming",
    filter_groups: "Groups",
    filter_results: "Results",

    // predict
    predict_sub: "Earn points. Climb your leagues.",
    predict_round: "Predicted this round",
    predict_empty_title: "All caught up!",
    predict_empty: "No upcoming matches to predict right now.",

    // leagues
    leagues_sub: "Compete with your mates",
    btn_create: "Create",
    btn_join: "Join",
    create_title: "Create a league",
    join_title: "Join a league",
    name_placeholder: "League name (e.g. Office Cup)",
    code_placeholder: "Enter the 6-char code",
    btn_create_league: "Create League",
    btn_join_league: "Join League",
    err_name: "Name needs at least 2 characters.",
    no_leagues: "No leagues yet",
    no_leagues_sub: "Create a league and invite mates, or join one with a code.",

    // create wizard
    create_step1_title: "How long?",
    create_step1_sub: "How many matches does your competition last?",
    create_step2_title: "Loser's punishment",
    create_step2_sub: "Pick one for last place — or skip.",
    create_step3_title: "Name your league",
    create_step3_sub: "What's your crew called?",
    create_done_share: "Share with mates",
    create_done_go: "Go to league",
    btn_next: "Next",
    pun_skip: "Skip — no punishment",
    pun_context: "This happens to the person who finishes dead last.",

    // join (unauthenticated)
    join_need_account: "Create an account first",
    join_need_account_sub: "Takes 5 seconds — then we'll drop you straight into the league.",
    join_create_account: "Create account →",

    // duration
    dur_section: "COMPETITION LENGTH",
    dur_full: "Full tournament",
    dur_full_sub: "All 104 matches",
    dur_groups: "Group stage",
    dur_groups_sub: "First 48 matches",
    dur_weekend: "Weekend",
    dur_weekend_sub: "~8 matches",
    dur_custom: "Custom",
    dur_custom_sub: "Set match count",
    dur_label: "How many matches?",

    // punishment
    pun_section: "LOSER'S PUNISHMENT",
    pun_none: "No punishment (boring)",
    pun_custom_ph: "Invent your own punishment…",
    pun_or_custom: "or write your own below",
    punishment_list: [
      "Take a shot",
      "Post a cringe selfie on your story",
      "Send a risky text to your crush",
      "Everyone gets to slap the loser",
      "Get a stranger's Instagram on the street",
      "Take a laxative 💊",
      "Jump in the nearest river",
      "Try every flavour at an ice cream shop",
      "Give your phone to a mate (ears blocked), call a random contact and guide them through the convo",
      "Go on a spontaneous day trip",
      "Get your nails done",
      "Go to a trampoline park",
      "Post \"I lost a bet\" on all your stories",
      "Get tied to a tree while everyone throws eggs at you",
      "Give laxatives to pigeons in a public park",
    ] as string[],

    // league detail
    invite_code: "INVITE CODE",
    loser_label: "LOSER GETS:",
    standings: "Standings",
    chat: "Chat",
    qr_league: "League QR",

    // friends
    friends_sub: "Add rivals & challenge them",
    search_ph: "Search by username",
    searching: "Searching…",
    requests: "Requests",
    your_friends: "Your friends",
    btn_accept: "Accept",
    btn_add: "Add",
    req_sent: "Request sent",
    no_friends: "No friends yet",
    no_friends_sub: "Search a username, or tap the QR icon to show your invite code.",
    no_players: "No players found",
    qr_friend_title: "My invite QR",
    qr_friend_sub: "Mate scans this → added instantly",

    // profile
    profile_sub: "Your stats",
    total_points: "TOTAL POINTS",
    stat_pred: "Predictions",
    stat_exact: "Exact",
    stat_acc: "Accuracy",
    stat_leagues: "Leagues",
    my_forecasts: "MY FORECASTS",
    no_forecasts: "No predictions yet — head to Predict to make your first.",

    // settings
    settings_sub: "Tweak your profile",
    sec_name: "Display name",
    name_label: "DISPLAY NAME",
    name_ph: "Your name",
    username_locked: "Username @{u} is locked forever",
    btn_save: "Save changes",
    saved: "Saved",
    saved_sub: "Name updated.",
    err_name_short: "Name's too short",
    sec_account: "Account",
    account_type: "Anonymous — device-bound",
    account_warn: "Signing out = fresh start. No recovery.",
    sec_lang: "LANGUAGE",
    btn_signout: "Sign out",
    signout_title: "Sign out?",
    signout_msg: "Username-only account — signing out on this device means starting fresh.",
    change_photo: "Change photo",

    // join league screen
    join_sub: "Tap below to join and start competing!",
    join_signin_title: "Sign in first",
    join_signin_sub: "You need an account to join a league.",
    join_go_to_app: "Go to app",
    error_join: "Could not join",

    // matches empty states
    empty_live: "No live matches",
    empty_live_sub: "Check Upcoming for the next kickoff.",
    empty_results: "No results yet",
    empty_upcoming: "No upcoming matches",
    empty_groups: "No group data yet",

    // common
    btn_close: "Close",
    scan_hint: "Scan with any camera app",
    copy_code: "Copy invite code",
    league_created: "League created!",
    league_created_sub: 'Share code "{code}" with mates to invite them.',
  },

  fr: {
    // lang picker
    lang_pick: "Choisis ta langue",
    lang_en: "English 🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    lang_fr: "Français 🇫🇷",
    lang_continue: "C'est parti",

    // welcome
    welcome_tagline: "Préds la Coupe du Monde.\nDéfonce tes potes.",
    welcome_invited: "Un pote t'a invité !",
    username_label: "TON PRÉNOM",
    username_placeholder: "Ton prénom (ex. Axel)",
    handle_preview: "Ton pseudo : @{h}",
    btn_start: "C'est parti !",
    btn_join_friend: "Rejoindre & ajouter",
    welcome_fine: "Pas d'email. Juste ton prénom et t'es dans la place.",
    err_short: "Faut au moins 2 caractères.",
    err_chars: "Ce pseudo est déjà pris — essaie un autre prénom.",

    // invite
    invite_congrats: "T'es dans la place, @{u} !",
    invite_sub: "C'est mieux avec des potes. Partage ton lien — ils cliquent et vous êtes connectés direct.",
    invite_link_label: "TON LIEN D'INVITATION",
    btn_copy: "Copier",
    btn_copied: "Copié !",
    btn_share: "Partager",
    btn_continue: "Aller dans l'app",

    // tabs
    tab_matches: "Matchs",
    tab_predict: "Pronos",
    tab_leagues: "Ligues",
    tab_friends: "Potes",
    tab_profile: "Profil",

    // matches
    matches_sub: "Coupe du Monde 2026",
    filter_live: "En direct",
    filter_upcoming: "À venir",
    filter_groups: "Groupes",
    filter_results: "Résultats",

    // predict
    predict_sub: "Gagne des points. Monte dans les classements.",
    predict_round: "Pronos ce tour",
    predict_empty_title: "T'es à jour !",
    predict_empty: "Pas de matchs à prédire pour l'instant.",

    // leagues
    leagues_sub: "Affronte tes potes",
    btn_create: "Créer",
    btn_join: "Rejoindre",
    create_title: "Créer une ligue",
    join_title: "Rejoindre une ligue",
    name_placeholder: "Nom de la ligue (ex. Ligue des potes)",
    code_placeholder: "Colle le code à 6 caractères",
    btn_create_league: "Créer la ligue",
    btn_join_league: "Rejoindre",
    err_name: "Au moins 2 caractères, s'il te plaît.",
    no_leagues: "Pas encore de ligues",
    no_leagues_sub: "Crée une ligue et invite tes potes, ou rejoins-en une avec un code.",

    // create wizard
    create_step1_title: "Sur combien de matchs ?",
    create_step1_sub: "Combien de matchs dure ta compétition ?",
    create_step2_title: "La punition du perdant",
    create_step2_sub: "Choisis pour le dernier — ou passe.",
    create_step3_title: "Nomme ta ligue",
    create_step3_sub: "C'est quoi le nom de votre crew ?",
    create_done_share: "Partager avec les potes",
    create_done_go: "Voir la ligue",
    btn_next: "Suivant",
    pun_skip: "Passer — pas de punition",
    pun_context: "C'est ce qui arrive à celui qui finit bon dernier.",

    // join (unauthenticated)
    join_need_account: "Crée un compte d'abord",
    join_need_account_sub: "5 secondes — et on te dépose direct dans la ligue.",
    join_create_account: "Créer un compte →",

    // duration
    dur_section: "DURÉE DE LA COMPÉTITION",
    dur_full: "Tournoi complet",
    dur_full_sub: "Les 104 matchs",
    dur_groups: "Phase de groupes",
    dur_groups_sub: "Les 48 premiers matchs",
    dur_weekend: "Weekend",
    dur_weekend_sub: "~8 matchs",
    dur_custom: "Personnalisé",
    dur_custom_sub: "Choisis un nombre",
    dur_label: "Combien de matchs ?",

    // punishment
    pun_section: "PUNITION DU DERNIER",
    pun_none: "Pas de punition (t'es chiant)",
    pun_custom_ph: "Invente ta propre punition…",
    pun_or_custom: "ou écris la tienne ci-dessous",
    punishment_list: [
      "Cul-sec obligatoire",
      "Poster une photo cringe en story",
      "Envoyer un SMS à ton crush que t'assumes pas",
      "Tout le monde donne une claque au perdant",
      "Ramener un Instagram à un inconnu dans la rue",
      "Prendre un laxatif 💊",
      "Sauter dans la rivière la plus proche",
      "Tester toutes les glaces d'un glacier",
      "Filer ton tel à un pote (oreilles bouchées), appeler un contact random et le guider dans la conv sans qu'il entende rien",
      "Partir en road trip surprise",
      "Se faire faire les ongles",
      "Aller dans un parc de trampolines",
      "Poster \"J'ai perdu un pari\" sur toutes ses stories",
      "Se faire attacher à un arbre pendant que tout le monde te lance des œufs",
      "Donner des laxatifs aux pigeons dans un parc pour enfants",
    ] as string[],

    // league detail
    invite_code: "CODE D'INVITATION",
    loser_label: "LE PERDANT DOIT :",
    standings: "Classement",
    chat: "Tchat",
    qr_league: "QR de la ligue",

    // friends
    friends_sub: "Ajoute des rivaux et défie-les",
    search_ph: "Chercher par pseudo",
    searching: "Recherche…",
    requests: "Demandes",
    your_friends: "Tes potes",
    btn_accept: "Accepter",
    btn_add: "Ajouter",
    req_sent: "Demande envoyée",
    no_friends: "Pas encore de potes",
    no_friends_sub: "Cherche un pseudo ou tape le QR pour inviter quelqu'un.",
    no_players: "Aucun joueur trouvé",
    qr_friend_title: "Mon QR d'invitation",
    qr_friend_sub: "Un pote le scanne et vous êtes connectés direct",

    // profile
    profile_sub: "Tes stats",
    total_points: "TOTAL DE POINTS",
    stat_pred: "Pronos",
    stat_exact: "Exacts",
    stat_acc: "Précision",
    stat_leagues: "Ligues",
    my_forecasts: "MES PRONOS",
    no_forecasts: "Aucun prono encore — va dans Pronos pour commencer !",

    // settings
    settings_sub: "Modifie ton profil",
    sec_name: "Nom affiché",
    name_label: "NOM AFFICHÉ",
    name_ph: "Ton prénom ou surnom",
    username_locked: "Le pseudo @{u} est bloqué pour toujours",
    btn_save: "Enregistrer",
    saved: "Enregistré",
    saved_sub: "Nom mis à jour.",
    err_name_short: "Nom trop court",
    sec_account: "Compte",
    account_type: "Compte anonyme — lié à l'appareil",
    account_warn: "Te déco = repartir de zéro. Pas de récup.",
    sec_lang: "LANGUE",
    btn_signout: "Se déconnecter",
    signout_title: "Te déconnecter ?",
    signout_msg: "Compte sans email — te déco sur ce tel = repartir de zéro. Pas de retour en arrière.",
    change_photo: "Changer la photo",

    // join league screen
    join_sub: "Tape ci-dessous pour rejoindre et commencer !",
    join_signin_title: "Connecte-toi d'abord",
    join_signin_sub: "Il te faut un compte pour rejoindre une ligue.",
    join_go_to_app: "Aller dans l'app",
    error_join: "Impossible de rejoindre",

    // matches empty states
    empty_live: "Pas de matchs en direct",
    empty_live_sub: "Regarde les matchs À venir.",
    empty_results: "Pas encore de résultats",
    empty_upcoming: "Pas de matchs à venir",
    empty_groups: "Pas encore de données de groupe",

    // common
    btn_close: "Fermer",
    scan_hint: "Scanne avec l'appareil photo",
    copy_code: "Copier le code d'invitation",
    league_created: "Ligue créée !",
    league_created_sub: "Partage le code \"{code}\" pour inviter tes potes.",
  },
} as const;

export type TKey = keyof typeof T["en"];
type Vars = Record<string, string>;

// ─── context ─────────────────────────────────────────────────────────────────

const I18nCtx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Vars) => string;
  punishments: string[];
}>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
  punishments: T.en.punishment_list as string[],
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((v) => {
      if (v === "en" || v === "fr") setLangState(v);
      setReady(true);
    });
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    await AsyncStorage.setItem(LANG_KEY, l);
  }, []);

  const t = useCallback(
    (key: TKey, vars?: Vars): string => {
      const dict = T[lang] as Record<string, any>;
      let s: string = (dict[key] ?? T.en[key] ?? key) as string;
      if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.replace(`{${k}}`, v); });
      return s;
    },
    [lang]
  );

  const punishments = (T[lang].punishment_list as string[]);

  if (!ready) return null;

  return (
    <I18nCtx.Provider value={{ lang, setLang, t, punishments }}>
      {children}
    </I18nCtx.Provider>
  );
}

export function useI18n() {
  return useContext(I18nCtx);
}

export async function getSavedLang(): Promise<Lang | null> {
  const v = await AsyncStorage.getItem(LANG_KEY);
  return v === "en" || v === "fr" ? v : null;
}
