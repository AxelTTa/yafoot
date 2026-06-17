# YaFoot ⚽🇫🇷

A prediction-first **World Cup 2026** social app — predict match scores, create private leagues with friends, climb leaderboards, and chat. Built like MPP (mpp.football), modernized with a French-flag palette.

Cross-platform (iOS + Android) from one codebase: **Expo (React Native) + Supabase**.

## Stack
- **App:** Expo SDK 52, React Native 0.76, expo-router (file-based), TypeScript
- **Backend:** Supabase — Auth, Postgres (RLS), Realtime (live scores + chat)
- **Data:** `openfootball/worldcup.json` (public domain, no key) + optional `football-data.org` live layer

## Features (working skeleton)
- Email/password auth (auto-confirm enabled) with auto-created profiles
- **Matches** tab — Live / Upcoming / Results, realtime score updates
- **Predict** tab — pick exact scores; progress tracker; scoring (exact = 3 pts, right result = 1 pt)
- **Leagues** — create (shareable 6-char code) / join; leaderboard; realtime league chat
- **Friends** — search, request/accept, 1:1 realtime DMs
- **Profile** — season stats, scoring rules

## Run it
```bash
npm install
npx expo start            # press i (iOS sim), a (Android), or scan QR in Expo Go
```
Supabase URL + anon key are baked into `app.json > extra` (anon key is safe client-side).

## World Cup data
```bash
SERVICE_ROLE=<service_role_key> npm run sync          # seed/refresh from openfootball
# optional true-live in-play minutes:
SERVICE_ROLE=<key> FD_API_KEY=<football-data.org key> npm run sync
```
`scripts/sync-worldcup.mjs` upserts all 104 matches (and past editions via `SEASON=2022` etc).

## Backend
- `supabase/schema.sql` — tables, scoring function + triggers
- `supabase/rls.sql` — RLS policies, auth trigger, helper RPCs
- `supabase/rls-fix.sql` — SECURITY DEFINER membership helpers (avoids RLS recursion)
- `scripts/e2e-test.mjs` — full backend integration test (18 checks). `node scripts/e2e-test.mjs`

## Roadmap to stores
- Apple Developer account ($99/yr) + Google Play ($25) → `eas build` + `eas submit`
- Configure SMTP in Supabase for production email confirmation
- football-data.org key + a per-minute poller (Supabase cron / worker) for second-by-second live
