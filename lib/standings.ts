import { Match, isFinished } from "./types";

export type TeamRow = {
  team: string;
  code: string | null;
  flag: string | null;
  P: number; W: number; D: number; L: number; GF: number; GA: number; GD: number; Pts: number;
};

// Compute group-stage standings from finished matches, grouped by group_name.
export function computeGroups(matches: Match[]): { group: string; rows: TeamRow[] }[] {
  const groups: Record<string, Record<string, TeamRow>> = {};

  const ensure = (g: string, team: string, code: string | null, flag: string | null) => {
    groups[g] = groups[g] || {};
    if (!groups[g][team])
      groups[g][team] = { team, code, flag, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
    return groups[g][team];
  };

  for (const m of matches) {
    if (!m.group_name || !/^Group /.test(m.group_name)) continue;
    // register both teams even before they play (so the group shows all 4)
    const h = ensure(m.group_name, m.home_team, m.home_code, m.home_flag);
    const a = ensure(m.group_name, m.away_team, m.away_code, m.away_flag);
    if (!isFinished(m.status) || m.home_score == null || m.away_score == null) continue;
    h.P++; a.P++;
    h.GF += m.home_score; h.GA += m.away_score;
    a.GF += m.away_score; a.GA += m.home_score;
    if (m.home_score > m.away_score) { h.W++; h.Pts += 3; a.L++; }
    else if (m.home_score < m.away_score) { a.W++; a.Pts += 3; h.L++; }
    else { h.D++; a.D++; h.Pts++; a.Pts++; }
  }

  return Object.keys(groups)
    .sort()
    .map((g) => {
      const rows = Object.values(groups[g]).map((r) => ({ ...r, GD: r.GF - r.GA }));
      rows.sort((x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || x.team.localeCompare(y.team));
      return { group: g, rows };
    });
}
