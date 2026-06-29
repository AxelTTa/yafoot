import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "en" | "fr";
const LANG_KEY = "yafoot.lang";

// ─── punishment types ─────────────────────────────────────────────────────────
export type PunishmentSeverity = "mild" | "daring" | "savage";
export type Punishment = { text: string; subtitle: string; severity: PunishmentSeverity };

export const PUNISHMENTS_BY_LANG: Record<Lang, Punishment[]> = {
  en: [
    { text: "Buy the next round", subtitle: "Last place covers the next drinks order.", severity: "mild" },
    { text: "Send a 30-second voice note to a random contact", subtitle: "The group picks the contact.", severity: "mild" },
    { text: "Three shots back to back", subtitle: "The group picks the order.", severity: "mild" },
    { text: "Finish your drink before the next goal", subtitle: "No stalling once the match is on.", severity: "mild" },
    { text: "Buy someone a beer", subtitle: "Winner chooses who gets it.", severity: "mild" },
    { text: "Winner picks your wallpaper and lock screen", subtitle: "Keep both for one week. Proof required.", severity: "mild" },
    { text: "Down a full glass of the group's choice", subtitle: "No substitutions unless the group allows it.", severity: "daring" },
    { text: "Hand your phone to a friend for 2 minutes", subtitle: "They get harmless control. No deleting, no spending.", severity: "daring" },
    { text: "Call a random number and declare your love", subtitle: "Say it, then hang up.", severity: "daring" },
    { text: "Let the group write your Instagram bio", subtitle: "Keep it live for 24 hours.", severity: "daring" },
    { text: "Eggs on the loser", subtitle: "The group gets a clean shot at last place.", severity: "daring" },
    { text: "Call a contact with important news", subtitle: "Say you have something important to tell them, then hang up.", severity: "daring" },
    { text: "Group controls your WhatsApp status", subtitle: "Keep it live for one week.", severity: "daring" },
    { text: "60-second dramatic apology voice note", subtitle: "Apologize in the group chat for being the worst football mind alive. Pin it.", severity: "savage" },
    { text: "Post your crush in a story", subtitle: "The group chooses the caption.", severity: "savage" },
    { text: "Text your ex just '...'", subtitle: "Screenshot proof or it does not count.", severity: "savage" },
    { text: "Group picks your profile photo", subtitle: "Keep it for 24 hours.", severity: "savage" },
    { text: "Group chooses who gets your voice note", subtitle: "You record it live.", severity: "savage" },
    { text: "Post the group photo to your Instagram story", subtitle: "No caption, no context.", severity: "savage" },
  ],
  fr: [
    { text: "Offre le prochain verre", subtitle: "Le dernier paie la prochaine tournée.", severity: "mild" },
    { text: "Envoie un vocal de 30 secondes à un contact au hasard", subtitle: "Le groupe choisit le contact.", severity: "mild" },
    { text: "3 shots d'affilée", subtitle: "Le groupe choisit l'ordre.", severity: "mild" },
    { text: "Finis ton verre avant le prochain but", subtitle: "Pas de cinéma une fois le match lancé.", severity: "mild" },
    { text: "Offre une bière à quelqu'un", subtitle: "Le gagnant choisit pour qui.", severity: "mild" },
    { text: "Le gagnant choisit ton fond d'écran et ton écran verrouillé", subtitle: "À garder une semaine. Preuve obligatoire.", severity: "mild" },
    { text: "Cul sec, verre au choix du groupe", subtitle: "Pas de remplacement sauf accord du groupe.", severity: "daring" },
    { text: "File ton tel à un pote 2 minutes", subtitle: "Contrôle soft. Pas de suppression, pas d'achat.", severity: "daring" },
    { text: "Appelle un numéro au hasard et déclare ton amour", subtitle: "Tu le dis, puis tu raccroches.", severity: "daring" },
    { text: "Le groupe écrit ta bio Instagram", subtitle: "À garder 24 heures.", severity: "daring" },
    { text: "Oeufs sur le perdant", subtitle: "Le groupe a un tir propre sur le dernier.", severity: "daring" },
    { text: "Appelle un contact avec une grande nouvelle", subtitle: "Dis que t'as quelque chose d'important à lui dire, puis raccroche.", severity: "daring" },
    { text: "Le groupe gère ton statut WhatsApp", subtitle: "À garder une semaine.", severity: "daring" },
    { text: "Vocal d'excuses dramatique de 60 secondes", subtitle: "Excuses dans le groupe pour être le pire esprit foot vivant. À épingler.", severity: "savage" },
    { text: "Poste ton crush en story", subtitle: "Le groupe choisit le texte.", severity: "savage" },
    { text: "Envoie juste '...' à ton ex", subtitle: "Capture d'écran sinon ça ne compte pas.", severity: "savage" },
    { text: "Le groupe choisit ta photo de profil", subtitle: "À garder 24 heures.", severity: "savage" },
    { text: "Le groupe choisit qui reçoit ton vocal", subtitle: "Tu l'enregistres en direct.", severity: "savage" },
    { text: "Poste la photo du groupe en story Instagram", subtitle: "Pas de légende, pas de contexte.", severity: "savage" },
  ],
};

export const PUNISHMENTS: Punishment[] = PUNISHMENTS_BY_LANG.en;

// ─── soirée game content ────────────────────────────────────────────────────
export const SOIREE_PUNISHMENTS: Record<"en" | "fr", string[]> = {
  en: [
    "Take a shot",
    "Post a story with no caption",
    "Send a weird voice note to a random contact",
    "Do 10 push-ups in front of everyone",
    "Share your most embarrassing moment this year",
    "Impersonate someone in the room for 30 seconds",
    "Sing 30 seconds of a song the group picks",
    "Drink a glass of water with no hands",
    "Dance with no music for 20 seconds",
    "Say something nice to every person in the room",
    "Call your mum live",
    "Do whatever the group dares you to",
  ],
  fr: [
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
  ],
};

export const SOIREE_ROUNDS: Record<"en" | "fr", Array<{ icon: string; question: string; options: string[] }>> = {
  en: [
    { icon: "football", question: "Next goal?", options: ["Home team", "Away team", "Nobody"] },
    { icon: "flash", question: "Goal in the next 5 min?", options: ["Yes", "No"] },
    { icon: "stats-chart", question: "Shots in the next 10 min?", options: ["0-1", "2-3", "4+"] },
    { icon: "locate", question: "Next corner?", options: ["Home team", "Away team"] },
    { icon: "card", question: "Yellow card soon?", options: ["Yes", "No"] },
    { icon: "alert-circle", question: "Penalty before the end?", options: ["Yes", "No"] },
  ],
  fr: [
    { icon: "football", question: "Prochain but ?", options: ["Équipe dom.", "Équipe ext.", "Personne"] },
    { icon: "flash", question: "But dans les 5 min ?", options: ["Oui", "Non"] },
    { icon: "stats-chart", question: "Tirs dans les 10 min ?", options: ["0-1", "2-3", "4+"] },
    { icon: "locate", question: "Prochain corner ?", options: ["Équipe dom.", "Équipe ext."] },
    { icon: "card", question: "Carton jaune bientôt ?", options: ["Oui", "Non"] },
    { icon: "alert-circle", question: "Pénalty avant la fin ?", options: ["Oui", "Non"] },
  ],
};

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
    welcome_tagline: "Predict World Cup scores.\nBeat your mates.",
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
    create_intro_title: "Name your competition",
    create_intro_sub: "Private score predictions for your friends. You choose the countries and matches.",
    create_name_label: "COMPETITION NAME",
    create_name_ph: "e.g. Friday predictions",
    create_check_name: "Check name",
    create_match_title: "Build the match list",
    create_match_sub: "Pick countries and a future start time. Predictions lock when a match starts.",
    create_match_label: "Match {n}",
    create_country_a: "COUNTRY A",
    create_country_b: "COUNTRY B",
    create_pick_country: "Pick country",
    create_choose_country: "Choose country",
    create_search_country: "Search country",
    create_date_label: "MATCH DATE",
    create_start_time: "START TIME",
    create_hour: "Hour",
    create_minutes: "Minutes",
    create_local_time: "Local time on this device.",
    create_add_match: "Add another match",
    create_summary_one: "1 match in this competition",
    create_summary_many: "{n} matches in this competition",
    create_submit: "Create competition",
    create_done_title: "Competition created",
    create_share_invite: "Share invite",
    create_qr_hint: "Tap for QR code",
    create_check_competition: "Check competition",
    create_err_name: "Competition name needs at least 2 characters.",
    create_err_add_match: "Add at least one match.",
    create_err_country_a: "Match {n}: choose country A.",
    create_err_country_b: "Match {n}: choose country B.",
    create_err_country_same: "Match {n}: choose two different countries.",
    create_err_time_valid: "Match {n}: choose a valid start time.",
    create_err_time_future: "Match {n}: start time must be in the future.",
    today: "Today",
    tomorrow: "Tomorrow",
    create_done_share: "Share with mates",
    create_done_go: "Open competition",
    btn_next: "Next",
    pun_skip: "No punishment — boring, but OK",
    pun_context: "Dead last gets this. Zero mercy.",

    // join (unauthenticated)
    join_need_account: "Create an account first",
    join_need_account_sub: "Takes 5 seconds, then we'll drop you straight into the league.",
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
    pun_custom_set: "Custom punishment set",
    sev_all: "All",
    sev_mild: "Mild",
    sev_daring: "Daring",
    sev_savage: "Savage",

    // league detail
    invite_code: "INVITE CODE",
    loser_label: "LOSER GETS:",
    standings: "Standings",
    chat: "Chat",
    qr_league: "Competition QR",

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
    stat_leagues: "Competitions",
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
    delete_account_warn: "Permanently deletes your account, all predictions, competitions, and messages. This cannot be undone.",
    btn_delete_account: "Delete my account",
    delete_account_title: "Delete account?",
    delete_account_msg: "This will permanently delete your account and all your data (predictions, competitions, messages). This cannot be undone.",
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
    join_signin_sub: "You need an account to join a competition.",
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
    league_created: "Competition created!",
    league_created_sub: 'Share code "{code}" with mates to invite them.',

    // soiree
    soiree_title: "Live Room",
    soiree_hero_sub: "Watch a match together. The host fires challenges between goals. Losers drink.",
    soiree_host_btn: "Host a Soirée",
    soiree_host_sub: "Pick a match, share the code",
    soiree_join_btn: "Join a Soirée",
    soiree_join_sub: "Enter the 6-letter code from the host",
    soiree_how_title: "How it works",
    soiree_how_1: "Right answer = +10 pts, fastest = +15 pts",
    soiree_how_2: "45 seconds to bet per round",
    soiree_how_3: "Wrong answer = punishment for the loser",
    soiree_how_4: "All realtime — everyone sees updates instantly",
    soiree_no_matches: "No matches available right now",
    soiree_name_ph: "Soirée name (optional)",
    soiree_create_btn: "Create Soirée",
    soiree_join_modal_title: "Join a Soirée",
    soiree_code_ph: "6-letter code",
    soiree_join_action: "Join",
    soiree_cancel: "Cancel",
    soiree_not_found: "Soirée not found",
    soiree_you: "You",
    soiree_player: "Player",
    soiree_share_msg: "Join my YaFoot Soirée! Code: {code}",
    soiree_code_copied: "Code copied!",
    soiree_in_room: "IN THE ROOM ({n})",
    soiree_nobody: "Nobody yet...",
    soiree_start_game: "Start the game",
    soiree_waiting_host: "Waiting for the host to start...",
    soiree_waiting_round: "Waiting for a round...",
    soiree_host_launches: "The host will launch the next challenge",
    soiree_launch_challenge: "LAUNCH A CHALLENGE",
    soiree_secs_left: "seconds left",
    soiree_my_bet_prefix: "Your bet: ",
    soiree_can_change: "(you can change)",
    soiree_time_up: "Time's up — wait for the host to reveal the answer",
    soiree_whats_correct: "What's the right answer?",
    soiree_tap_correct: "TAP THE RIGHT ANSWER",
    soiree_host_choosing: "The host is picking the right answer...",
    soiree_correct_prefix: "Right answer: ",
    soiree_nobody_right: "Nobody got it!",
    soiree_got_it_suffix: " got it right!",
    soiree_punish_title: "Punishments",
    soiree_next_round: "Next round",
    soiree_auto_back: "Auto-back in 6 seconds...",
    soiree_leaderboard: "LEADERBOARD",
    soiree_no_players_yet: "No players yet",
    soiree_err_lock: "Lock error",
    soiree_err_start: "Start error",
    soiree_err_bet: "Bet error",
    soiree_err_resolve: "Resolve error",
    soiree_err_generic: "Error",
    soiree_sign_in_req: "Sign in required",
  },

  fr: {
    // lang picker
    lang_pick: "Choisis ta langue",
    lang_en: "English 🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    lang_fr: "Français 🇫🇷",
    lang_continue: "C'est parti",

    // welcome
    welcome_tagline: "Crée des défis de pronos foot.\nDéfonce tes potes.",
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
    matches_sub: "Coupe du monde 2026",
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
    leagues_sub: "Des pronos entre potes. Le dernier prend cher.",
    btn_create: "Créer",
    btn_join: "Rejoindre",
    create_title: "Créer une ligue",
    join_title: "Rejoindre une ligue",
    name_placeholder: "Nom de la ligue",
    code_placeholder: "Colle le code à 6 caractères",
    btn_create_league: "Créer la ligue",
    btn_join_league: "Rejoindre",
    err_name: "Au moins 2 caractères, s'il te plaît.",
    no_leagues: "Solo ? Corrige ça.",
    no_leagues_sub: "Crée une ligue et invite tes potes pour les humilier.",

    // create wizard
    create_step1_title: "Sur combien de matchs ?",
    create_step1_sub: "Combien de matchs dure ta compétition ?",
    create_step2_title: "La punition du perdant",
    create_step2_sub: "Choisis pour le dernier — ou passe.",
    create_step3_title: "Nomme ta ligue",
    create_step3_sub: "C'est quoi le nom de votre crew ?",
    create_intro_title: "Nomme ta compet",
    create_intro_sub: "Des scores entre potes. Tu choisis les pays et les matchs.",
    create_name_label: "NOM DE LA COMPET",
    create_name_ph: "ex. Pronos du vendredi",
    create_check_name: "Vérifie le nom",
    create_match_title: "Ajoute les matchs",
    create_match_sub: "Choisis les pays et une heure future. Les pronos se ferment au coup d'envoi.",
    create_match_label: "Match {n}",
    create_country_a: "PAYS A",
    create_country_b: "PAYS B",
    create_pick_country: "Choisir un pays",
    create_choose_country: "Choisir un pays",
    create_search_country: "Chercher un pays",
    create_date_label: "DATE DU MATCH",
    create_start_time: "HEURE",
    create_hour: "Heure",
    create_minutes: "Minutes",
    create_local_time: "Heure locale sur cet appareil.",
    create_add_match: "Ajouter un match",
    create_summary_one: "1 match dans cette compet",
    create_summary_many: "{n} matchs dans cette compet",
    create_submit: "Créer la compet",
    create_done_title: "Compet créée",
    create_share_invite: "Partager l'invitation",
    create_qr_hint: "Tape pour le QR code",
    create_check_competition: "Vérifie la compet",
    create_err_name: "Le nom de la compet doit faire au moins 2 caractères.",
    create_err_add_match: "Ajoute au moins un match.",
    create_err_country_a: "Match {n} : choisis le pays A.",
    create_err_country_b: "Match {n} : choisis le pays B.",
    create_err_country_same: "Match {n} : choisis deux pays différents.",
    create_err_time_valid: "Match {n} : choisis une heure valide.",
    create_err_time_future: "Match {n} : l'heure doit être dans le futur.",
    today: "Aujourd'hui",
    tomorrow: "Demain",
    create_done_share: "Partager avec les potes",
    create_done_go: "Voir la compet",
    btn_next: "Suivant",
    pun_skip: "Passer — t'as peur ou quoi ?",
    pun_context: "Le dernier de la ligue se prend ça. Pas de pitié.",

    // join (unauthenticated)
    join_need_account: "Crée un compte d'abord",
    join_need_account_sub: "5 secondes, et on te depose direct dans la ligue.",
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
    pun_custom_set: "Punition perso choisie",
    sev_all: "Tout",
    sev_mild: "Soft",
    sev_daring: "Chaud",
    sev_savage: "Sauvage",

    // league detail
    invite_code: "CODE D'INVITATION",
    loser_label: "LE PERDANT DOIT :",
    standings: "Classement",
    chat: "Tchat",
    qr_league: "QR de la compet",

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
    stat_leagues: "Compets",
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
    delete_account_warn: "Supprime definitivement ton compte, toutes tes predictions, competitions et messages. Irreversible.",
    btn_delete_account: "Supprimer mon compte",
    delete_account_title: "Supprimer le compte ?",
    delete_account_msg: "Cela supprimera definitivement ton compte et toutes tes donnees (pronostics, competitions, messages). Irreversible.",
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
    join_signin_sub: "Il te faut un compte pour rejoindre une compet.",
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
    league_created: "Compet creee !",
    league_created_sub: "Partage le code \"{code}\" pour inviter tes potes.",

    // soiree
    soiree_title: "Soirée Mode",
    soiree_hero_sub: "Regardez un match ensemble. L'hôte lance des défis entre les buts. Les perdants trinquent.",
    soiree_host_btn: "Organiser une Soirée",
    soiree_host_sub: "Choisis un match, partage le code",
    soiree_join_btn: "Rejoindre une Soirée",
    soiree_join_sub: "Entre le code de 6 lettres de l'hôte",
    soiree_how_title: "Comment ça marche",
    soiree_how_1: "Bonne réponse = +10 pts, le plus rapide = +15 pts",
    soiree_how_2: "45 secondes pour parier par round",
    soiree_how_3: "Mauvaise réponse = punition pour le perdant",
    soiree_how_4: "Tout en temps réel — tout le monde voit les mises à jour",
    soiree_no_matches: "Pas de matchs disponibles",
    soiree_name_ph: "Nom de ta soirée (optionnel)",
    soiree_create_btn: "Créer la Soirée",
    soiree_join_modal_title: "Rejoindre une Soirée",
    soiree_code_ph: "Code de 6 lettres",
    soiree_join_action: "Rejoindre",
    soiree_cancel: "Annuler",
    soiree_not_found: "Soirée introuvable",
    soiree_you: "Toi",
    soiree_player: "Joueur",
    soiree_share_msg: "Rejoins ma Soirée YaFoot ! Code: {code}",
    soiree_code_copied: "Code copié !",
    soiree_in_room: "DANS LA SALLE ({n})",
    soiree_nobody: "Personne encore...",
    soiree_start_game: "Démarrer la partie",
    soiree_waiting_host: "En attente que l'hôte démarre...",
    soiree_waiting_round: "En attente d'un round...",
    soiree_host_launches: "L'hôte va lancer le prochain défi",
    soiree_launch_challenge: "LANCER UN DÉFI",
    soiree_secs_left: "secondes restantes",
    soiree_my_bet_prefix: "Ton pari: ",
    soiree_can_change: "(tu peux changer)",
    soiree_time_up: "Le temps est écoulé — attends que l'hôte révèle la réponse",
    soiree_whats_correct: "C'est quoi la bonne réponse ?",
    soiree_tap_correct: "TAPER LA BONNE RÉPONSE",
    soiree_host_choosing: "L'hôte choisit la bonne réponse...",
    soiree_correct_prefix: "Bonne réponse: ",
    soiree_nobody_right: "Personne n'avait bon !",
    soiree_got_it_suffix: " a raison !",
    soiree_punish_title: "Punitions",
    soiree_next_round: "Prochain round",
    soiree_auto_back: "Retour automatique dans 6 secondes...",
    soiree_leaderboard: "CLASSEMENT",
    soiree_no_players_yet: "Aucun joueur encore",
    soiree_err_lock: "Erreur verrou",
    soiree_err_start: "Erreur",
    soiree_err_bet: "Erreur pari",
    soiree_err_resolve: "Erreur résolution",
    soiree_err_generic: "Erreur",
    soiree_sign_in_req: "Connexion requise",
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
    <I18nCtx.Provider value={{ lang, setLang, t, punishments: PUNISHMENTS_BY_LANG[lang] }}>
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
