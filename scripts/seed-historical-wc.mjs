#!/usr/bin/env node
// Seed historical World Cup matches (1930-2022) from openfootball text files into Supabase

import https from 'https';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const SUPABASE_PAT = process.env.SUPABASE_PAT;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !SUPABASE_PAT) {
  console.error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE, SUPABASE_PAT');
  process.exit(1);
}

// Normalize known team aliases → modern FIFA names
const TEAM_ALIASES = {
  'West Germany': 'Germany',
  'German DR': 'Germany',
  'East Germany': 'Germany',
  'Czechoslovakia': 'Czech Republic',
  'Soviet Union': 'Russia',
  'Yugoslavia': 'Serbia',
  'Zaire': 'DR Congo',
  'South Korea': 'Korea Republic',
  'North Korea': 'Korea DPR',
  "Ivory Coast": "Côte d'Ivoire",
  'Bosnia and Herzegovina': 'Bosnia-Herzegovina',
  'USA': 'United States',
  'United States of America': 'United States',
  'Dutch East Indies': 'Indonesia',
  'Irish Free State': 'Republic of Ireland',
  'Trinidad & Tobago': 'Trinidad and Tobago',
  'Trinidad and Tobago': 'Trinidad and Tobago',
};

function normalizeTeam(name) {
  const t = name ? name.trim() : '';
  return TEAM_ALIASES[t] || t;
}

function httpsGetText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; yafoot-seeder/1.0)' }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(httpsGetText(res.headers.location));
      }
      if (res.statusCode === 404) return resolve(null);
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function applySQL(sql) {
  const ref = 'zfsgclwyaapgwxjtzvyd';
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_PAT}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; yafoot-seeder/1.0)',
        'Content-Length': Buffer.byteLength(body),
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`SQL API ${res.statusCode}: ${data}`));
        else resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

async function bulkInsert(rows) {
  if (!rows.length) return 0;
  let inserted = 0;
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const body = JSON.stringify(rows.slice(i, i + CHUNK));
    await new Promise((resolve, reject) => {
      const req = https.request(`${SUPABASE_URL}/rest/v1/historical_wc_matches`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=ignore-duplicates',
          'Content-Length': Buffer.byteLength(body),
        }
      }, (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          if (res.statusCode >= 400) console.warn(`  Insert warn ${res.statusCode}: ${data.slice(0,200)}`);
          else inserted += rows.slice(i, i + CHUNK).length;
          resolve();
        });
      });
      req.on('error', reject);
      req.write(body); req.end();
    });
  }
  return inserted;
}

// Parse the min format:
//   ▪ Stage Name
//   ▪▪ Group X
//     Team1 v Team2   score1-score2
// scores may include a.e.t. and/or X-Y pen. — we take the regular time score
// for finals decided by penalty shootout, we keep the AET score (or regular time)
function parseMinFile(text, year) {
  const matches = [];
  let currentStage = 'Group Stage';
  let currentGroup = '';

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/[  -‏  　]/g, ' '); // normalize spaces
    const trimmed = line.trim();
    if (!trimmed) continue;

    // ▪▪ Group header
    if (/^▪▪/.test(trimmed)) {
      currentGroup = trimmed.replace(/^▪▪\s*/, '').trim();
      continue;
    }

    // ▪ Stage header
    if (/^▪/.test(trimmed)) {
      currentStage = trimmed.replace(/^▪+\s*/, '').trim();
      currentGroup = '';
      continue;
    }

    // Match line: "  Team1 v Team2    score"
    // The min format uses "v" as separator
    // Try to match: text " v " text  whitespace  score
    const matchLine = trimmed.match(/^(.+?)\s+v\s+(.+?)\s+([\d]+)-([\d]+)/);
    if (matchLine) {
      const team1 = normalizeTeam(matchLine[1].trim());
      const team2 = normalizeTeam(matchLine[2].trim());
      const score1 = parseInt(matchLine[3]);
      const score2 = parseInt(matchLine[4]);

      if (team1 && team2 && !isNaN(score1) && !isNaN(score2)) {
        const stage = currentGroup
          ? (currentStage !== 'Group Stage' ? `${currentStage} – ${currentGroup}` : currentGroup)
          : currentStage;

        matches.push({
          year,
          stage,
          match_date: `${year}-01-01`, // openfootball min doesn't have dates; use year marker
          home_team: team1,
          away_team: team2,
          home_score: score1,
          away_score: score2,
          competition: 'FIFA World Cup',
        });
      }
    }
  }
  return matches;
}

// Also try to get dates from the full cup.txt files
// Format varies but dates appear like "July 13" or "Sun Nov 20" before match lines
function parseCupFileForDates(text, year) {
  const dateMap = {}; // "team1|team2" -> date string
  let currentDate = null;

  const monthNames = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/[  -‏  　]/g, ' ');
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Date line patterns:
    // "July 13" or "Mon Nov 21" or "Fri Nov 25" or "Sun Jul 13"
    const dateMatch = trimmed.match(/^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+)?([A-Za-z]{3})\s+(\d{1,2})/i);
    if (dateMatch && !trimmed.includes('v ') && !trimmed.includes('-')) {
      const month = monthNames[dateMatch[1].toLowerCase()];
      if (month) {
        const day = dateMatch[2].padStart(2, '0');
        currentDate = `${year}-${month}-${day}`;
      }
      continue;
    }

    // Match line in cup.txt format: "  Team1  score1-score2 (ht1-ht2)  Team2  @ stadium"
    // OR older format: "  Team1  score1-score2  (score)  Team2"
    if (currentDate && trimmed.includes('-')) {
      // Try: team1  score-score  ...  team2
      const m = trimmed.match(/^(.+?)\s+([\d]+)-([\d]+)(?:\s*\([^)]*\))?\s+(.+?)(?:\s+@|$)/);
      if (m) {
        const t1 = normalizeTeam(m[1].trim());
        const t2 = normalizeTeam(m[4].trim().split('@')[0].trim());
        if (t1 && t2) {
          const key1 = `${t1}|${t2}`;
          const key2 = `${t2}|${t1}`;
          dateMap[key1] = currentDate;
          dateMap[key2] = currentDate;
        }
      }
    }
  }
  return dateMap;
}

const YEAR_DIRS = {
  1930: '1930--uruguay',
  1934: '1934--italy',
  1938: '1938--france',
  1950: '1950--brazil',
  1954: '1954--switzerland',
  1958: '1958--sweden',
  1962: '1962--chile',
  1966: '1966--england',
  1970: '1970--mexico',
  1974: '1974--west-germany',
  1978: '1978--argentina',
  1982: '1982--spain',
  1986: '1986--mexico',
  1990: '1990--italy',
  1994: '1994--usa',
  1998: '1998--france',
  2002: '2002--south-korea-n-japan',
  2006: '2006--germany',
  2010: '2010--south-africa',
  2014: '2014--brazil',
  2018: '2018--russia',
  2022: '2022--qatar',
};

const BASE = 'https://raw.githubusercontent.com/openfootball/world-cup/master';

async function main() {
  console.log('=== Step 1: Create historical_wc_matches table ===');
  await applySQL(`
    CREATE TABLE IF NOT EXISTS public.historical_wc_matches (
      id SERIAL PRIMARY KEY,
      year INT NOT NULL,
      stage TEXT,
      match_date DATE,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      home_score INT,
      away_score INT,
      competition TEXT DEFAULT 'FIFA World Cup'
    );
    CREATE INDEX IF NOT EXISTS idx_hwc_home ON public.historical_wc_matches(home_team);
    CREATE INDEX IF NOT EXISTS idx_hwc_away ON public.historical_wc_matches(away_team);
  `);
  console.log('Table created/verified OK');

  console.log('\n=== Step 2: Fetch + parse openfootball data ===');
  const allMatches = [];

  for (const [yearStr, dir] of Object.entries(YEAR_DIRS)) {
    const year = parseInt(yearStr);
    const minUrl = `${BASE}/min/${year}.txt`;
    const cupUrl = `${BASE}/${dir}/cup.txt`;

    try {
      const [minText, cupText] = await Promise.all([
        httpsGetText(minUrl),
        httpsGetText(cupUrl),
      ]);

      if (!minText) {
        console.log(`  ${year}: min file not found — skipped`);
        continue;
      }

      const matches = parseMinFile(minText, year);

      // Try to enrich with dates from cup.txt
      if (cupText) {
        const dateMap = parseCupFileForDates(cupText, year);
        let enriched = 0;
        for (const m of matches) {
          const key = `${m.home_team}|${m.away_team}`;
          if (dateMap[key]) {
            m.match_date = dateMap[key];
            enriched++;
          }
        }
        if (enriched > 0) console.log(`  ${year}: ${matches.length} matches (${enriched} dates enriched)`);
        else console.log(`  ${year}: ${matches.length} matches`);
      } else {
        console.log(`  ${year}: ${matches.length} matches`);
      }

      allMatches.push(...matches);
    } catch (e) {
      console.warn(`  ${year}: error — ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\nTotal parsed: ${allMatches.length} matches`);

  console.log('\n=== Step 3: Insert into Supabase (clearing first) ===');
  try {
    await applySQL('DELETE FROM public.historical_wc_matches;');
    console.log('Cleared existing rows');
  } catch (e) {
    console.warn('Could not clear:', e.message);
  }

  const byYear = {};
  for (const m of allMatches) {
    if (!byYear[m.year]) byYear[m.year] = [];
    byYear[m.year].push(m);
  }

  let totalInserted = 0;
  for (const [year, rows] of Object.entries(byYear)) {
    const n = await bulkInsert(rows);
    console.log(`  ${year}: ${n} inserted`);
    totalInserted += n;
  }

  console.log(`\n=== Total inserted: ${totalInserted} matches ===`);

  // Verify
  const verifyRes = await applySQL('SELECT COUNT(*) as cnt FROM public.historical_wc_matches;');
  console.log(`DB count: ${JSON.stringify(verifyRes)}`);

  // Sample H2H test
  const sampleRes = await applySQL(`
    SELECT year, home_team, away_team, home_score, away_score
    FROM public.historical_wc_matches
    WHERE (home_team = 'Germany' AND away_team = 'France')
       OR (home_team = 'France' AND away_team = 'Germany')
    ORDER BY year;
  `);
  console.log('\nSample H2H (Germany vs France):', JSON.stringify(sampleRes));

  return totalInserted;
}

main().catch(e => { console.error(e); process.exit(1); });
