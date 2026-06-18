// YaFoot design system v2 — bold, rounded, high-contrast. French tricolor identity
// (bleu / blanc / rouge) on a deep navy-black, with big type, squircle cards, color blocks.
export const colors = {
  // brand
  bleu: "#2F6BFF",
  bleuBright: "#4D86FF",
  bleuDeep: "#0B1430",
  bleuCard: "#13203F",
  bleuSoft: "#1B2A52",
  rouge: "#FF3B47",
  rougeSoft: "#FF6B73",
  blanc: "#FFFFFF",

  // surfaces
  bg: "#070C1A",
  surface: "#101a33",
  surfaceAlt: "#16223f",
  elevated: "#1c2a4a",
  border: "#243152",
  borderSoft: "#1a2640",

  // text
  text: "#F2F6FF",
  textDim: "#9FB0D6",
  textFaint: "#6A7AA6",

  // status / accents
  live: "#34E27A",
  liveBg: "rgba(52,226,122,0.16)",
  gold: "#FFD24A",
  silver: "#C9D4E8",
  bronze: "#E08A4B",
  win: "#34E27A",
  draw: "#FFD24A",
  loss: "#FF5A5F",
  danger: "#FF5A5F",
  success: "#34E27A",
  warn: "#FFB23E",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 30 };

export const radius = { sm: 10, md: 14, lg: 20, xl: 26, xxl: 32, pill: 999 };

export const font = {
  hero: { fontSize: 34, fontWeight: "900" as const, color: colors.text, letterSpacing: -0.5 },
  h1: { fontSize: 28, fontWeight: "900" as const, color: colors.text, letterSpacing: -0.4 },
  h2: { fontSize: 22, fontWeight: "800" as const, color: colors.text, letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: "800" as const, color: colors.text },
  body: { fontSize: 15, fontWeight: "600" as const, color: colors.text },
  dim: { fontSize: 13, fontWeight: "600" as const, color: colors.textDim },
  tiny: { fontSize: 11, fontWeight: "700" as const, color: colors.textFaint },
};

export const shadow = {
  shadowColor: "#000",
  shadowOpacity: 0.35,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
};
