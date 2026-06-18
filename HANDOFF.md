# YaFoot — Full Context Handoff (for server-side claud/codx managers)

> Written 2026-06-18 by the local Claude Code session on Axel's Linux desktop.
> Purpose: give the **server-hosted manager agents** (claud/codx, controlled from Axel's
> phone via a Telegram bot) the COMPLETE context of this project — everything decided and
> done across two conversations — so they can run as full-time managers without re-discovery.

---

## 0. The mission these managers serve
Axel wants YaFoot developed/managed from a server (this box, `axel-pipeline`), mirroring the
`autoapply` setup: the whole project lives on the server, claud/codx run as persistent
managers, and Axel sends instructions **from his phone via a Telegram bot**. The managers
should hold ALL context below and act on Axel's chat instructions.

**Launcher rule (machine-wide):** always launch agents via the wrappers **`claud`** (Claude
Code) and **`codx`** (Codex) — NEVER the raw `claude`/`codex` binaries (they bypass required
config/proxy). In code, read the binary from an env var defaulting to the wrapper.

---

## 1. What YaFoot is
A **prediction-first World Cup 2026 social app** — an MPP / mpp.football clone. Predict exact
scores → join private leagues with friends → leaderboards + league chat + friend DMs.
Cross-platform (iOS + Android) from one **Expo (React Native)** codebase; also deployed as a
web app on Vercel.

- **Scoring:** exact score = **3 pts**, correct result = **1 pt**, else 0. DB-enforced via
  `score_match()` + a FINISHED trigger.
- **Core loop is prediction-first**, NOT live-streaming.
- **Stores strategy:** build-now, submit-later.

### Stack
- **App:** Expo (now **SDK 54** — see §4), React Native 0.81, expo-router (file-based), TypeScript.
- **Backend:** Supabase — Auth, Postgres + RLS, Realtime (live scores + chat).
- **Data:** **football-data.org is PRIMARY** (real WC2026 feed); `openfootball/worldcup.json`
  (public domain, no key) is the no-key fallback.

---

## 2. Infrastructure & credentials (operationally critical)
- **Supabase project "YaFoot"** ref `zfsgclwyaapgwxjtzvyd` (org Yotoia2), URL
  `https://zfsgclwyaapgwxjtzvyd.supabase.co`. Anon key is in `app.json > extra` (public, safe
  client-side). **Service role key is a secret** — needed for `npm run sync`; not committed.
- **Supabase auth:** `mailer_autoconfirm` ON (no SMTP yet) so signups work instantly. Onboarding
  is now **username-only** (anonymous auth; username carried in user metadata → profile trigger).
- **football-data.org:** API key stored in the `app_config` table (key `fd_api_key`), NOT in
  source. Free tier = 10 req/min. Matches keyed `wc-<fdId>`.
- **pg_cron `yafoot-fd-sync`** runs every 2 min: updates score/status/minute, auto-fills knockout
  teams + flags (`wc_flags` table). The FINISHED trigger auto-scores predictions.
  openfootball fallback lives in `scripts/sync-worldcup.mjs`.
- **Vercel:** Hobby account (axel.cassou2@gmail.com / axelcassou2@gmail.com). Live web app:
  **https://dist-five-zeta-92i4a6g3xx.vercel.app** (project "dist", scope
  `axelcassou2-1440s-projects`). Redeploy:
  `cd dist && npx vercel deploy --prod --yes --token <vcp_...> --scope axelcassou2-1440s-projects`.
- **Direct Supabase REST access** (anon key, PostgREST) is fine for debugging/backfills.
  Read the anon key from `app.json`/`.env` at runtime.

---

## 3. Codebase map (~2,900 LOC app)
- `app/` (expo-router routes): `(auth)/welcome` (username-only onboarding) → `onboarding/invite`;
  tabs `index`(matches) `predict` `leagues` `social`(friends/DMs) `profile`; detail routes
  `match/[id]` `stats/[id]` `league/[id]` `chat/[id]` `invite/[code]` `settings` `notifications`.
- `lib/`: `api.ts` (all Supabase calls), `supabase.ts`, `auth.tsx`, `theme.ts` (design tokens),
  `standings.ts`, `teams.ts`, `avatar.ts`, `invite.ts`, `notify.ts` (**RN `Alert` is a NO-OP on
  web — use this**), `odds.ts` (match probabilities), `types.ts`.
- `components/`: `MatchCard`, `GroupStandings`, `Brand`, `ui.tsx` (shared primitives:
  `Screen`, `Card`, `Button`, `Avatar`, `Header`/`ScreenHeader`, `Icon`, etc.).
- `supabase/` (apply in order): `schema.sql` → `rls.sql` → `rls-fix.sql` → `fixes-1.sql`
  (security hardening) → `cron-fd.sql` (live football-data cron).
- `scripts/` test harness (run `URL=<vercel> node scripts/<x>.mjs`): `e2e-test` (18/18),
  `load-test`, `multiplayer-test`, `friends-predict-test`, `invite-flow-test`, `onboarding-test`,
  plus `sync-worldcup.mjs`. Browser tests use **puppeteer-core + `/usr/bin/google-chrome`**;
  two users need separate `browser.createBrowserContext()` (shared localStorage otherwise);
  RN-web inputs set via native value setter + input event.

### Security fixes already applied (`supabase/fixes-1.sql`)
Predictions locked at kickoff + score bounds (DB trigger, not just UI); private leagues join
by-code only (no enumerable-id insert); DMs only between accepted friends; advisory-lock against
double-scoring; late-joiner league-points backfill.

---

## 4. SDK 52 → 54 UPGRADE (done this session, 2026-06-18)
**Why:** Axel wants to test on his **iPhone 13** for free via **Expo Go**. Physical iPhones can
only install the *latest* App Store Expo Go, which as of June 2026 is pinned to **SDK 54**
(SDK 55/56 exist but are stuck in Apple review). YaFoot was on SDK 52 → would show "incompatible
with this version of Expo Go". So we upgraded to **SDK 54**. This is also a prerequisite for a
clean App Store submission later.

**What changed (deps/config only — ZERO app-code changes were needed):**
- `npm i expo@^54` → `npx expo install --fix` → clean reinstall (`rm -rf node_modules
  package-lock.json && npm install`). React 18→**19.1**, RN 0.76→**0.81**, expo-router 4→**6**.
- Bumped `@types/react` → `~19.1.0`.
- **GOTCHA:** `babel-preset-expo` was installed nested under `node_modules/expo/` and not hoisted,
  so Metro failed with `Cannot find module 'babel-preset-expo'`. **Fix = add it explicitly to
  devDependencies at top level** (`babel-preset-expo@~54.0.11`). Already done.
- Node must be ≥ 20.19.4 (box has v20.20 ✓). babel.config is clean (no reanimated/worklets).
- Verified: `npx expo-doctor` **18/18**, `expo export --platform web` ✓, forced iOS Hermes
  bundle ✓ (HTTP 200, ~8 MB), manifest reports `runtimeVersion: exposdk:54.0.0`.

---

## 5. Local on-device testing (Expo Go) — current state & known issue
- Dev server runs **LAN mode**: `npx expo start --lan` → `exp://192.168.1.88:8081`
  (local desktop LAN IP `192.168.1.88`, port 8081). Manifest verified reachable on the LAN IP.
- **`--tunnel` FAILS in this environment** — ngrok is blocked (same network restriction that
  blocks WebFetch to expo.dev). Use `--lan`, or fix ngrok auth for off-WiFi access.
- **OPEN ISSUE:** Axel's iPhone got "Could not connect to the server" in Expo Go. The dev server
  had died once (an `npm install` restarts Metro — don't run installs while testing). After
  restart it's reachable from the desktop. Remaining suspect = phone↔PC network path: phone must
  be on the **same WiFi** as the desktop (192.168.1.x), and the router must not have **AP/client
  isolation** (common on guest networks). Diagnostic given to Axel: open `http://192.168.1.88:8081`
  in iPhone Safari — if that fails too, it's network isolation, fix via tunnel.

---

## 6. App Store / Play Store submission path (NOT done — needs Axel's accounts/$$)
- **iOS:** needs **$99/yr Apple Developer Program** (mandatory for TestFlight AND App Store; a
  free Apple ID cannot distribute). Then `eas build` (free tier: 15 iOS + 15 Android builds/mo) +
  `eas submit` → TestFlight → review — **all runs from Linux, no Mac**.
- **Android:** free to install directly — EAS build with `eas.json` profile `buildType: "apk"`
  (default AAB can't be sideloaded). Google Play submission = $25 one-time.
- **NOT yet configured:** `eas.json`, EAS project init (`eas login` is interactive — needs Axel's
  Expo account). Bundle ids already set: `com.yafoot.app` (both platforms).
- **Submission prerequisites to prep:** privacy policy URL (app collects email/auth via Supabase),
  privacy "nutrition label" data disclosures, store listing copy + screenshots, age rating.

---

## 7. IMPORTANT: a concurrent redesign is in flight
During this session a **lime-green "design system v3"** redesign was being actively edited on disk
(by Axel and/or another agent), file-by-file — `lib/theme.ts` flipped navy→lime mid-session;
`(tabs)/*`, `components/*`, `app/*/[id].tsx`, `lib/avatar.ts`, `lib/odds.ts`, new
`expo-image-picker`/`expo-font` plugins in `app.json`, etc. New files appear continuously.
**Consequence:** because Expo Go bundles every route together, a route saved mid-edit (e.g.
half-finished JSX) breaks the WHOLE bundle until valid — we hit exactly this on
`app/league/[id].tsx`. Managers: if a build breaks, run `git status` first; it may just be a file
caught mid-save, not a real regression.

---

## 8. Pre-existing notes / gotchas
- The checked-in `~/Downloads/CLAUDE.md` describes a DIFFERENT project ("Funnex", a Shopify CRO
  app) — it is **stale/unrelated to YaFoot**. Ignore it for YaFoot work.
- `git` history: `fcc55b9` v1 → cron/web → football-data primary → security hardening →
  Wave 1/2 redesigns → username-only onboarding + invite flow. (Now: SDK 54 + v3 redesign.)
- Polish backlog (non-blocking): match-detail live refresh, efficient realtime (patch single match
  vs full refetch), message pagination order, username-taken friendly error, date grouping/timezone,
  text contrast. Infra: SMTP for prod email; football-data.org per-minute live polling already via cron.

---

## 9. Suggested first actions for the server managers
1. Get YaFoot onto the server (GitHub repo from this codebase, then `git pull` / clone here).
2. Recreate `.env` / secrets on the server: Supabase **service role** key (for `npm run sync`),
   football-data key (lives in DB `app_config`), Vercel token. None are in git.
3. Wire the Telegram bot → manager loop so Axel can drive from his phone.
4. Then resume the open threads: (a) finish the v3 redesign cleanly, (b) get Expo Go connecting on
   Axel's iPhone (network/tunnel), (c) when Axel funds it, stand up EAS → TestFlight/Play.
