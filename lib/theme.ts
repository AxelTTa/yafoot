// YaFoot theme — modern, French-flag inspired (bleu / blanc / rouge) on a deep navy base.
export const colors = {
  // brand
  bleu: "#1E5BFF",      // vivid French blue (modernized)
  bleuDeep: "#0A1B3D",  // deep navy background
  bleuCard: "#12245A",  // card surface
  bleuSoft: "#1B306E",  // elevated surface
  rouge: "#EF4135",     // French red accent
  rougeSoft: "#FF6B5E",
  blanc: "#FFFFFF",

  bg: "#070F24",        // app background (near-black navy)
  surface: "#0F1E40",   // card
  surfaceAlt: "#162852",
  border: "#22305C",
  text: "#F4F7FF",
  textDim: "#9AA8CC",
  textFaint: "#6B7AA3",

  live: "#2ED573",      // live green
  liveBg: "rgba(46,213,115,0.15)",
  win: "#2ED573",
  gold: "#FFD24A",
  silver: "#C9D4E8",
  bronze: "#E08A4B",
  danger: "#FF5A5F",
  success: "#2ED573",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const font = {
  h1: { fontSize: 28, fontWeight: "800" as const, color: colors.text },
  h2: { fontSize: 22, fontWeight: "800" as const, color: colors.text },
  h3: { fontSize: 17, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 15, fontWeight: "500" as const, color: colors.text },
  dim: { fontSize: 13, fontWeight: "500" as const, color: colors.textDim },
  tiny: { fontSize: 11, fontWeight: "600" as const, color: colors.textFaint },
};

export const shadow = {
  shadowColor: "#000",
  shadowOpacity: 0.3,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
};
