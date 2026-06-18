// Win-probability model so match stats ALWAYS show real numbers (not just sparse crowd data).
// Elo-style team ratings (approx, 2026) + a Poisson score model -> P(home/draw/away) + projected score.

const ELO: Record<string, number> = {
  BRA: 2080, FRA: 2060, ARG: 2055, ESP: 2040, ENG: 2010, POR: 1995, NED: 1970, GER: 1960, BEL: 1935,
  CRO: 1905, URY: 1900, COL: 1890, MAR: 1885, SUI: 1845, NOR: 1835, AUT: 1825, TUR: 1825, JPN: 1820,
  SEN: 1820, SWE: 1810, CZE: 1810, ALG: 1805, USA: 1805, MEX: 1815, ECU: 1795, CIV: 1790, KOR: 1790,
  SCO: 1780, CAN: 1780, IRN: 1775, AUS: 1770, BIH: 1760, GHA: 1760, COD: 1745, TUN: 1740, PAR: 1740,
  RSA: 1730, EGY: 1800, QAT: 1705, PAN: 1700, UZB: 1685, NZL: 1620, CPV: 1640, JOR: 1655, IRQ: 1650,
  HAI: 1585, CUW: 1560,
};
const ratingOf = (code: string | null) => (code && ELO[code]) || 1700;

function poisson(k: number, lambda: number) {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / f;
}

export type Probs = {
  homeWin: number; draw: number; awayWin: number; // 0..1
  expHome: number; expAway: number;
  topScores: { score: string; p: number }[];
};

export function matchProbabilities(homeCode: string | null, awayCode: string | null): Probs {
  const dr = ratingOf(homeCode) - ratingOf(awayCode);
  const sup = Math.max(-3, Math.min(3, dr / 165)); // goal supremacy, clamped
  const base = 2.6; // avg total goals
  const expHome = Math.max(0.25, (base + sup) / 2);
  const expAway = Math.max(0.25, (base - sup) / 2);

  let hw = 0, dr0 = 0, aw = 0;
  const scoreP: Record<string, number> = {};
  for (let i = 0; i <= 7; i++) {
    for (let j = 0; j <= 7; j++) {
      const p = poisson(i, expHome) * poisson(j, expAway);
      if (i > j) hw += p; else if (i === j) dr0 += p; else aw += p;
      scoreP[`${i}-${j}`] = (scoreP[`${i}-${j}`] || 0) + p;
    }
  }
  const total = hw + dr0 + aw || 1;
  const topScores = Object.entries(scoreP)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([score, p]) => ({ score, p: p / total }));

  return {
    homeWin: hw / total, draw: dr0 / total, awayWin: aw / total,
    expHome: Math.round(expHome * 10) / 10, expAway: Math.round(expAway * 10) / 10,
    topScores,
  };
}
