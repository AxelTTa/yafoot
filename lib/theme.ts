// YaFoot design system v3 — playful, bright, multi-color (ref: lime crypto app).
// Lime-green canvas, big white rounded cards, bold dark type, big numbers,
// colorful accent tiles (green / yellow / purple / orange / cyan), dark floating pill nav.
export const colors = {
  // canvas + surfaces
  bg: "#A6E63D",          // lime green — Matches tab
  bgLeagues: "#FFD87A",   // warm golden — Leagues tab
  bgFriends: "#DDD4FF",   // soft lavender — Friends tab
  bgProfile: "#B4DEFF",   // sky blue — Profile tab
  bgAlt: "#98DC2E",
  surface: "#FFFFFF",     // white cards
  surfaceAlt: "#F3F4EC",  // subtle off-white
  elevated: "#FFFFFF",
  surfaceDark: "#241A3D", // deep purple hero/points card

  // text (dark, for lime + white surfaces)
  ink: "#14130E",
  text: "#14130E",
  textDim: "#5C5B52",
  textFaint: "#9A9A8F",
  blanc: "#FFFFFF",

  // borders (light)
  border: "#EAEAE0",
  borderSoft: "#F1F1EA",

  // multi-color accent palette
  green: "#22C55E",
  greenDark: "#15803D",
  purple: "#9B5DE5",
  purpleDark: "#6D28D9",
  yellow: "#FFD23F",
  orange: "#FB8C3C",
  cyan: "#22C7C0",
  pink: "#FF6FB5",
  red: "#FF5A5F",

  // legacy aliases mapped to the new palette (so existing screens keep working)
  bleu: "#15803D",        // primary = green
  bleuBright: "#22C55E",
  bleuDeep: "#241A3D",
  bleuCard: "#241A3D",
  bleuSoft: "#E6F7EA",
  rouge: "#FF5A5F",
  rougeSoft: "#FF8A8E",

  // status
  live: "#FF3B30",
  liveBg: "rgba(255,59,48,0.12)",
  gold: "#F5B100",
  silver: "#9AA0AE",
  bronze: "#C97B3C",
  win: "#22C55E",
  draw: "#F5B100",
  loss: "#FF5A5F",
  danger: "#FF5A5F",
  success: "#22C55E",
};

// accent rotation for colored icon tiles / category blocks
export const accents = [colors.green, colors.yellow, colors.purple, colors.orange, colors.cyan, colors.pink];
export const accentFor = (i: number) => accents[((i % accents.length) + accents.length) % accents.length];

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 30 };

export const radius = { sm: 12, md: 16, lg: 20, xl: 26, xxl: 32, pill: 999 };

export const font = {
  hero: { fontSize: 40, fontWeight: "900" as const, color: colors.ink, letterSpacing: -1 },
  h1: { fontSize: 30, fontWeight: "900" as const, color: colors.ink, letterSpacing: -0.6 },
  h2: { fontSize: 22, fontWeight: "900" as const, color: colors.ink, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: "800" as const, color: colors.ink },
  body: { fontSize: 15, fontWeight: "600" as const, color: colors.ink },
  dim: { fontSize: 13, fontWeight: "600" as const, color: colors.textDim },
  tiny: { fontSize: 11, fontWeight: "700" as const, color: colors.textFaint },
};

export const shadow = {
  shadowColor: "#1a2e05",
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
};
