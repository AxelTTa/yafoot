// Humanizes provider team slots. Some feeds use bracket placeholders for the
// knockout stage before participants are decided: "1A" = Winner Group A, "2B" = Runner-up Group B,
// "W73" = Winner of match 73, "L101" = Loser of match 101, "3A/B/C/D/F" = a best-third-place slot.

export function isPlaceholderTeam(name: string): boolean {
  return (
    /^[12][A-L]$/.test(name) ||
    /^3[A-Z/]+$/.test(name) ||
    /^[WL]\d+$/.test(name)
  );
}

export function prettyTeam(name: string): string {
  if (!name) return "TBD";
  let m;
  if ((m = /^([12])([A-L])$/.exec(name))) {
    return `${m[1] === "1" ? "Winner" : "Runner-up"} Group ${m[2]}`;
  }
  if (/^3[A-Z/]+$/.test(name)) return "3rd place qualifier";
  if ((m = /^W(\d+)$/.exec(name))) return `Winner of Match ${m[1]}`;
  if ((m = /^L(\d+)$/.exec(name))) return `Loser of Match ${m[1]}`;
  return name;
}

// Neutral marker shown instead of a white flag for undecided knockout slots.
export function teamFlag(name: string, storedFlag?: string | null): string {
  if (isPlaceholderTeam(name)) return "🏟️";
  return storedFlag && storedFlag !== "🏳️" ? storedFlag : "⚽";
}
