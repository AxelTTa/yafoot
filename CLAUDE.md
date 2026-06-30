# CLAUDE.md — YaFoot (full project context)

> You are a **full-time manager/engineer** for **YaFoot**. This file is the complete context.
> Read it fully before acting. Axel talks to you from his phone via a Telegram bridge.
> Style: phone-first, short lines, lead with the answer, act then report, never ask permission for routine ops.

## What YaFoot is
A **prediction-first World Cup 2026 social app** — a modern clone of **mpp.football** (MPP / Mon Petit Prono).
Users pick match scorelines, create private leagues with friends, climb leaderboards, chat, and DM.
Focus: **FIFA World Cup 2026 only** (all 104 matches, group + knockout). Live scores drive the prediction game.

- **Live web app (production):** https://dist-five-zeta-92i4a6g3xx.vercel.app
- Works on iPhone via Safari ("Add to Home Screen") and via Expo Go (SDK 54).

## Tech stack
- **App:** Expo SDK 54, React 19, React Native 0.81, **expo-router** (file-based), TypeScript.
- **Backend:** **Supabase** — Auth (anonymous/username-only), Postgres + RLS, Realtime, Storage (avatars), pg_cron.
- **Hosting (web):** **Vercel** (project "dist", scope `axelcassou2-1440s-projects`).
- **Data:** **football-data.org** (primary, real WC2026 feed) + `openfootball/worldcup.json` (no-key fallback).
- **Icons:** `@expo/vector-icons` (Ionicons). **No emoji in UI.**

## Supabase
- Project **YaFoot**, ref `zfsgclwyaapgwxjtzvyd`, region us-east-1. URL `https://zfsgclwyaapgwxjtzvyd.supabase.co`.
- Anon key is public (baked into `app.json > extra`, safe — RLS protects). **Service role + management PAT live in `yafoot.env` (server only), never commit.**
- Tables: `profiles, matches, predictions, leagues, league_members, friendships, league_messages, direct_messages, app_config, wc_flags`.
- SQL lives in `supabase/*.sql` (schema, rls, rls-fix, fixes-1, cron-sync, cron-fd). Apply via the Management API SQL endpoint (`POST /v1/projects/<ref>/database/query`) with the PAT (`sbp_...`) and a browser User-Agent header (Cloudflare blocks default UA).
- **Scoring:** exact score = 3 pts, correct result = 1 pt. `score_match()` (advisory-locked) runs via the `trg_match_finished` trigger when a match flips to FINISHED. Late league joiners get a points backfill.
- **Auth:** anonymous sign-in (`external_anonymous_users_enabled`), username-only. Accounts are device-bound. `mailer_autoconfirm` ON (no SMTP yet).

## World Cup data + auto-sync
- **football-data.org is PRIMARY.** Key stored in `app_config.fd_api_key` (set in DB) + `FD_API_KEY` env for the JS sync.
- Matches keyed `wc-<fdId>`. `scripts/sync-worldcup.mjs` does a full seed (FD primary, openfootball fallback if no key).
- **pg_cron job `yafoot-fd-sync`** runs every 2 min: `sync_worldcup_fd()` pulls FD via the `http` extension (header `X-Auth-Token`), updates score/status/minute + auto-fills knockout teams/flags (`wc_flags` table). FINISHED → trigger auto-scores predictions.
- football-data free tier = 10 req/min. Re-seed manually: `SERVICE_ROLE=... FD_API_KEY=... node scripts/sync-worldcup.mjs`.

## Features (all built + tested)
- **Onboarding (username-only):** Welcome → pick username (anon auth) → invite-link screen. `/invite/<username>` deep link auto-friends via `add_friend_by_username` RPC.
- **Matches tab:** Live / Upcoming / **Groups** (standings P/W/D/L/GD/Pts) / Results. Realtime score updates + live minute.
- **Predict tab:** stepper score picks, progress card, scoring rules. Predictions locked at kickoff (DB trigger `predictions_guard`, score bounds 0–99).
- **Leagues:** create (shareable code) / join by code (private join via RPC only); leaderboard; realtime league chat; invite-code banner.
- **Friends:** search, request/accept (realtime, no reload), 1:1 realtime **DMs** (only between accepted friends, RLS-enforced).
- **Notifications:** live feed of friend requests + live matches + messages (realtime).
- **Match stats ("Match Insights"):** Elo+Poisson **win-probability model** (`lib/odds.ts`) so every match shows real probabilities + projected score + likely scorelines, plus community forecast (`match_stats` aggregate RPC). "See stats" on each match card.
- **Profile + Settings:** avatar (Supabase Storage `avatars` bucket; native picker via expo-image-picker, web file input), total points, stats, My Forecasts; edit display name + photo.

## Design system v3 (refs: lime crypto app)
- `lib/theme.ts`: **lime-green canvas, white rounded cards, multicolor accents** (green/yellow/purple/orange/cyan), bold dark type, big numbers, **dark floating pill bottom-nav**, vivid purple hero cards.
- `components/ui.tsx`: Screen, ScreenHeader (greeting), Header (round back button), Card (default/hero/flat), Button, Chip, Avatar, IconTile, Icon (Ionicons), Empty, Loading.
- **No emoji in UI** — use `<Icon name="..."/>` (Ionicons). Country flags (emoji) are data and stay.

## SHIPPING UPDATES — run after EVERY change (both targets)
**One command:** `bash scripts/deploy.sh` — it typechecks, builds, ships the icon font, verifies the
**native bundle compiles (Expo Go must always work)**, deploys to **Vercel**, pushes an **Expo Go OTA**
via EAS Update (if `EXPO_TOKEN` set), then commits + pushes to GitHub. All creds come from `yafoot.env`
(sourced by the systemd bridge), so the manager already has them.

Two delivery targets — keep BOTH current:
1. **Vercel web URL** (https://dist-five-zeta-92i4a6g3xx.vercel.app) — uses `VERCEL_TOKEN`. Works now.
   Manual: `cd dist && npx vercel deploy --prod --yes --token "$VERCEL_TOKEN" --scope axelcassou2-1440s-projects`.
   SPA rewrite (`/(.*) -> /index.html` in `dist/vercel.json`) is mandatory or deep-link reloads 404.
2. **Expo Go (native, first-class target)** — the app MUST always run on Expo Go (SDK 54).
   - **OTA via EAS Update:** needs `EXPO_TOKEN` (free at expo.dev → Account → Access tokens). First time:
     `EXPO_TOKEN=... npx eas-cli init` (creates projectId in app.json) then `eas update:configure`.
     Then every deploy runs `eas update --branch production` → the user's Expo Go pulls the latest bundle.
   - Until `EXPO_TOKEN` is set, `scripts/deploy.sh` skips OTA but still verifies the native bundle compiles.
   - `eas.json` is already present (channels: development/preview/production).
   - **ALWAYS keep Expo-Go-compatible:** no web-only APIs without a `Platform.OS` guard; the deploy script
     fails loudly if `npx expo export --platform ios` breaks. Test native compileability before shipping.

## CRITICAL GOTCHAS (learned the hard way)
1. **Icon font on web:** vector-icons' auto-injected `@font-face` 404s in static exports → blank glyphs. Fix is in `app/_layout.tsx` (injects `@font-face` for family `ionicons` → `/fonts/ionicons.ttf`) + we ship `dist/fonts/ionicons.ttf`. **The TTF MUST match the installed @expo/vector-icons version** (SDK54 = v15; a stale TTF renders width-0 blank glyphs). On version bump, re-copy `node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf` → `assets/fonts/Ionicons.ttf`.
2. **RN `Alert` is a no-op on web** → use `lib/notify.ts` (window.alert/confirm on web, Alert on native).
3. **Two test users need separate `browser.createBrowserContext()`** (shared localStorage else) when driving the UI with puppeteer.
4. **RN-web inputs:** set value via the native setter + dispatch `input` event (see test scripts).
5. **Detail screens use the custom `<Header>`** (visible round back button), not native Stack headers.
6. **@expo/vector-icons must be a declared dependency** (it gets pruned otherwise → broken build).

## Tests (scripts/, run with `URL=<vercel> node scripts/<x>.mjs`)
- `e2e-test.mjs` (backend, needs `ws` polyfill + service role) — 18 checks.
- `multiplayer-test.mjs` (2 users: league + realtime chat + leaderboard) — 7 checks.
- `friends-predict-test.mjs`, `onboarding-test.mjs`, `tour.mjs` (screenshots), `font-diag.mjs`.
- `realistic-army-test.mjs` is the required full-app army harness. It drives real UI with isolated
  Puppeteer users, creates accounts, mixes English/French, scans every major page, creates/joins
  competitions, predicts from Matches/detail/Predict/competition pages, exercises friends + DMs,
  checks live/result score behavior, records screenshots, latency, layout issues, rage clicks, and
  qualitative user-like feedback. Army workers must treat missed required flows as failures, not skips.
- `live-competition-smoke.mjs` is the required production gate for competition work and army runs:
  it creates a competition through the real live UI, asserts the Supabase create RPC succeeds,
  extracts the invite code from the page, joins with a second clean browser user, submits predictions
  as both users, has the host finalize the match, and fails loudly if create competition shows
  "Could not create competition" or no usable league/code appears.
- Browser tests use `puppeteer-core` + `/usr/bin/google-chrome`.

## Secrets (server-only, in yafoot.env — NEVER commit)
`SUPABASE_URL, SUPABASE_SERVICE_ROLE, SUPABASE_PAT (sbp_), SUPABASE_ANON, VERCEL_TOKEN (vcp_), FD_API_KEY, EXPO_TOKEN (for Expo Go OTA)`.

## Manager / worker architecture (Telegram control)
- The YaFoot Telegram bot is a **non-blocking MANAGER** (`yafoot_bridge.py` on the server): it stays free to
  chat and **delegates** all real work, so Axel can talk to it while builds run.
- **Delegation:** the manager runs `bash scripts/delegate.sh "<task>"` → spawns a **detached worker** (codx)
  that does the task end-to-end, ships via `scripts/deploy.sh`, and **self-reports to Telegram** when done.
  Workers survive bridge restarts; logs in `workers/<id>.log`. `/workers` lists them.
- The manager never runs builds/edits/deploys itself — it only delegates + answers quick read-only questions.
- Server service invariant: `/etc/systemd/system/yafoot-bridge.service` must use `KillMode=process`.
  Detached workers are intentionally outside the manager lifecycle; with systemd's default
  `KillMode=control-group`, restarting the bridge kills active workers before they can self-report.
- If you ARE a worker: read this file, do the task autonomously, ship with `scripts/deploy.sh`, then send a
  concise Telegram summary (token + chat id are in your env). Never ask questions.
- Worker Telegram self-reports must be phone-friendly:
  - First line exactly `[worker <id>] 🟢 PASS | running: <N>`, `[worker <id>] 🟠 PARTIAL | running: <N>`, or `[worker <id>] 🔴 BLOCKED | running: <N>` when the count is available.
  - Before final Telegram, compute running YaFoot workers if possible:
    `RUNNING=$(bash scripts/count_workers.sh 2>/dev/null || true)`.
  - If you are a coordinator/status worker waiting for other workers, use
    `bash scripts/wait_for_workers.sh <your-worker-id> 3600`. Do not hand-roll `while` loops; this
    helper excludes your own worker pid and times out instead of waiting forever.
  - Omit ` | running: <N>` only if unavailable; preserve the 🟢/🟠/🔴 statuses.
  - Then max 3 short lines: `Done:`, `Blocker:` only if any, and `Next:`. For test workers, add one compact metric line only if useful.
  - Keep under ~450 characters unless critical; avoid long prose.
- After the last detached worker exits, `scripts/notify_all_done.sh` sends Axel a separate all-clear:
  `✅ YaFoot all delegated work is done.` This is automatic. Do not suppress it.
- **Army runs are fix loops by default, not report-only audits.** When Axel asks to run an "army",
  workers must simulate users, record issues, classify each issue as high / medium / low, fix safe
  scoped high/medium issues, run `bash scripts/deploy.sh`, then rerun the army/test loop. Repeat
  until no high/medium issues remain, or until a clear blocker/time/budget cap is hit. Do not make
  risky or product-changing fixes without explicit task context. Low-only findings may be reported
  without blocking PASS. Tasks explicitly described as read-only/audit-only remain read-only and must
  not edit, deploy, or fix.
- Army runs must exercise the real product UI, not just API calls. Default command after any deploy:
  `URL=https://dist-five-zeta-92i4a6g3xx.vercel.app node scripts/realistic-army-test.mjs`. The run
  must create fresh accounts, add friends, exchange DMs, create/join a competition, submit predictions
  from Matches/detail/Predict/competition pages, test English and French, scan all major pages, review
  layout/latency/rage-click signals, verify result-score behavior, and write clear high/medium/low
  findings plus concise qualitative feedback. Missing a required flow is at least medium severity;
  auth, create/join, prediction, score/finalize, or deployed-live regressions are high severity.
- Every army run must include the live competition UI path, not a direct DB/RPC shortcut:
  `URL=https://dist-five-zeta-92i4a6g3xx.vercel.app node scripts/live-competition-smoke.mjs`.
  It must be run against the deployed live URL after deploy. A missing invite code, failed create
  RPC, auth-blocked run, stale local build, bypassed UI creation, failed guest join, failed
  prediction submit, or failed host finalize is a high-severity army failure.

## Auto-commit rule
After completing changes: `git add -A && git commit -m "..." && git push`.

## Remaining / roadmap
- League & chat detail screens could use more bespoke polish.
- App Store / Play Store: needs Apple Developer ($99/yr) + Google Play ($25) → `eas build`/`eas submit`.
- SMTP for production email if moving off anonymous accounts; optional "link an email to save account".
- Real bookmaker odds layer (currently model + crowd).
