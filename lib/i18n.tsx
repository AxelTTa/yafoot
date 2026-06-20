import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "en" | "fr";
const LANG_KEY = "yafoot.lang";

// ─── punishment types ─────────────────────────────────────────────────────────
export type PunishmentSeverity = "mild" | "daring" | "savage";
export type Punishment = { text: string; subtitle: string; severity: PunishmentSeverity };

export const PUNISHMENTS: Punishment[] = [
  // MILD
  { text: "Offre le prochain verre", subtitle: "He's buying the next round", severity: "mild" },
  { text: "Cul sec obligatoire", subtitle: "Down it. Now.", severity: "mild" },
  { text: "Prends un shot", subtitle: "Take a shot, no excuses", severity: "mild" },
  { text: "Finis ton verre avant le prochain but", subtitle: "Finish your drink before the next goal", severity: "mild" },
  { text: "T'as perdu t'offres une bière à quelqu'un", subtitle: "You lost, you're buying someone a beer", severity: "mild" },
  // DARING
  { text: "Poste une photo de toi sur ta story sans légende", subtitle: "Post a photo on your story, no caption, no context", severity: "daring" },
  { text: "Filer ton tel à un pote pendant 2 min", subtitle: "Hand your phone to a mate for 2 mins, they do what they want", severity: "daring" },
  { text: "Envoie un vocal de 30 secondes à quelqu'un au hasard dans tes contacts", subtitle: "Voice note someone random in your contacts", severity: "daring" },
  { text: "Poste un mème sur ton insta story", subtitle: "Post a meme on your story right now", severity: "daring" },
  { text: "Change ta bio Instagram pendant 24h avec ce que le groupe décide", subtitle: "Let the group write your Instagram bio for 24h", severity: "daring" },
  { text: "Lance des oeufs", subtitle: "Obvious", severity: "daring" },
  { text: "Appelle quelqu'un et dis-leur que t'as quelque chose d'important à dire... et raccroche", subtitle: "Call someone, tell them you have something important, then hang up", severity: "daring" },
  // SAVAGE
  { text: "Poste une photo de ton crush sur ta story avec des coeurs", subtitle: "Post a photo of your crush on your story with hearts", severity: "savage" },
  { text: "Envoie un message à ton ex juste: '...'", subtitle: "Text your ex just '...'", severity: "savage" },
  { text: "Mets une photo de soirée cringe en photo de profil pendant 24h", subtitle: "Cringe party photo as your profile pic for 24h", severity: "savage" },
  { text: "Écris un message vocal gênant à quelqu'un que le groupe choisit", subtitle: "The group picks who you send a voice note to", severity: "savage" },
  { text: "Poste sur ta story: 'J'ai perdu un pari, demandez-moi ce que j'ai fait'", subtitle: "Post on your story admitting you lost a bet", severity: "savage" },
];

// ─── translations ────────────────────────────────────────────────────────────
// EN: casual fun.  FR: goofy youth-speak ("potes", "bro", "t'as", etc.)

const T = {
  en: {
    // lang picker
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
    welcome_fine: "No email. No drama. Just your name.",
    err_short: "Need at least 2 characters.",
    err_chars: "That username is already taken — try a different name.",

    // invite
    invite_congrats: "Welcome to the arena, @{u}!",
    invite_sub: "More fun with rivals. Share your link — they tap it, you're instantly connected.",
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
    predict_sub: "Rack up points. Outpredict everyone.",
    predict_round: "Your picks this round",
    predict_empty_title: "Nothing to predict right now.",
    predict_empty: "Sit tight — the next matches drop soon.",

    // leagues
    leagues_sub: "Compete with your crew. Last place suffers.",
    btn_create: "Create",
    btn_join: "Join",
    create_title: "Create a league",
    join_title: "Join a league",
    name_placeholder: "League name (e.g. Office Cup)",
    code_placeholder: "Enter the 6-char code",
    btn_create_league: "Create League",
    btn_join_league: "Join League",
    err_name: "Name needs at least 2 characters.",
    no_leagues: "Flying solo? Fix that.",
    no_leagues_sub: "Create a league and rope in your crew, or find one that'll humble you.",

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
    pun_skip: "No punishment — boring, but OK",
    pun_context: "Dead last gets this. Zero mercy.",

    // join (unauthenticated)
    join_need_account: "Create an account first",
    join_need_account_sub: "Takes 5 seconds — then we'll drop you straight into the league.",
    join_create_account: "Create account →",

    // duration
    dur_section: "COMPETITION LENGTH",
    dur_full: "Remaining",
    dur_full_sub: "All remaining matches",
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
    pun_custom_ph: "Invent something worse than these...",
    pun_or_custom: "or cook up something worse",

    // league detail
    invite_code: "INVITE CODE",
    loser_label: "LOSER GETS:",
    standings: "Standings",
    chat: "Chat",
    qr_league: "League QR",

    // friends
    friends_sub: "Add your rivals. Let the trash talk begin.",
    search_ph: "Search by username",
    searching: "Searching…",
    requests: "Requests",
    your_friends: "Your friends",
    btn_accept: "Accept",
    btn_add: "Add",
    req_sent: "Request sent",
    no_friends: "No rivals yet",
    no_friends_sub: "Who are you proving wrong? Search a username or flash your QR code.",
    no_players: "Nobody here. Try a different name.",
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
    no_forecasts: "Still scared to commit? Pick a score.",

    // settings
    settings_sub: "Make it yours",
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
    account_warn: "Sign out = poof, gone. No coming back.",
    sec_lang: "LANGUAGE",
    btn_signout: "Sign out",
    signout_title: "Sign out?",
    signout_msg: "Username-only account — signing out on this device means starting fresh.",
    change_photo: "Change photo",
    danger_zone: "Danger zone",
    delete_account_warn: "Permanently deletes your account, all predictions, leagues, and messages. This cannot be undone.",
    btn_delete_account: "Delete my account",
    delete_account_title: "Delete account?",
    delete_account_msg: "This will permanently delete your account and all your data (predictions, leagues, messages). This cannot be undone.",
    report_message: "Report message",
    report_sent: "Message reported",
    report_sent_sub: "Thank you. Our team will review it.",
    block_user: "Block user",
    block_confirm_title: "Block this user?",
    block_confirm_msg: "They will no longer be able to message you.",
    block_done: "User blocked",

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
    welcome_fine: "Pas d'email. Pas de prise de tête. Juste ton prénom.",
    err_short: "Faut au moins 2 caractères.",
    err_chars: "Ce pseudo est déjà pris — essaie un autre prénom.",

    // invite
    invite_congrats: "Bienvenue dans l'arène, @{u} !",
    invite_sub: "C'est mieux avec des rivaux. Partage ton lien — ils cliquent et vous êtes connectés direct.",
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
    predict_sub: "Gratte des points. Écrase tes potes.",
    predict_round: "Tes pronos ce tour",
    predict_empty_title: "Rien à jouer pour l'instant.",
    predict_empty: "Souffle un peu — les matchs arrivent.",

    // leagues
    leagues_sub: "Affronte tes potes. Le dernier trinque.",
    btn_create: "Créer",
    btn_join: "Rejoindre",
    create_title: "Créer une ligue",
    join_title: "Rejoindre une ligue",
    name_placeholder: "Nom de la ligue (ex. Ligue des potes)",
    code_placeholder: "Colle le code à 6 caractères",
    btn_create_league: "Créer la ligue",
    btn_join_league: "Rejoindre",
    err_name: "Au moins 2 caractères, s'il te plaît.",
    no_leagues: "Tout seul ? Pas pour longtemps.",
    no_leagues_sub: "Crée une ligue et ramène tes potes, ou rejoins-en une qui va t'humilier.",

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
    pun_skip: "Passer — t'as peur ou quoi ?",
    pun_context: "Le dernier de la ligue se prend ça. Pas de pitié.",

    // join (unauthenticated)
    join_need_account: "Crée un compte d'abord",
    join_need_account_sub: "5 secondes — et on te dépose direct dans la ligue.",
    join_create_account: "Créer un compte →",

    // duration
    dur_section: "DURÉE DE LA COMPÉTITION",
    dur_full: "Restants",
    dur_full_sub: "Tous les matchs restants",
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
    pun_custom_ph: "Invente quelque chose de pire...",
    pun_or_custom: "ou invente pire ci-dessous",

    // league detail
    invite_code: "CODE D'INVITATION",
    loser_label: "LE PERDANT DOIT :",
    standings: "Classement",
    chat: "Tchat",
    qr_league: "QR de la ligue",

    // friends
    friends_sub: "Trouve tes rivaux. Le trash-talk commence.",
    search_ph: "Chercher par pseudo",
    searching: "Recherche…",
    requests: "Demandes",
    your_friends: "Tes potes",
    btn_accept: "Accepter",
    btn_add: "Ajouter",
    req_sent: "Demande envoyée",
    no_friends: "Pas encore de rivaux",
    no_friends_sub: "T'es en train de prouver quoi ? Cherche un pseudo ou montre ton QR.",
    no_players: "Personne ici. Essaie un autre pseudo.",
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
    no_forecasts: "T'as pas encore osé ? Tape sur un match et mets un score.",

    // settings
    settings_sub: "Fais de ce profil le tien",
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
    account_warn: "Te déco = pouf, disparu. Sans retour.",
    sec_lang: "LANGUE",
    btn_signout: "Se déconnecter",
    signout_title: "Te déconnecter ?",
    signout_msg: "Compte sans email — te déco sur ce tel = repartir de zéro. Pas de retour en arrière.",
    change_photo: "Changer la photo",
    danger_zone: "Zone de danger",
    delete_account_warn: "Supprime définitivement ton compte, toutes tes prédictions, ligues et messages. Irréversible.",
    btn_delete_account: "Supprimer mon compte",
    delete_account_title: "Supprimer le compte ?",
    delete_account_msg: "Cela supprimera définitivement ton compte et toutes tes données (pronostics, ligues, messages). Irréversible.",
    report_message: "Signaler le message",
    report_sent: "Message signalé",
    report_sent_sub: "Merci. Notre équipe va l'examiner.",
    block_user: "Bloquer l'utilisateur",
    block_confirm_title: "Bloquer cet utilisateur ?",
    block_confirm_msg: "Il ne pourra plus t'envoyer de messages.",
    block_done: "Utilisateur bloqué",

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
  punishments: Punishment[];
}>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
  punishments: PUNISHMENTS,
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

  if (!ready) return null;

  return (
    <I18nCtx.Provider value={{ lang, setLang, t, punishments: PUNISHMENTS }}>
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
