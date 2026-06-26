# YaFoot

YaFoot is a prediction-first football app for private friend competitions. Users create competitions, add their own country-vs-country matches, invite friends, pick exact scores, chat, and settle standings when hosts enter final scores.

Cross-platform (iOS + Android) from one codebase: **Expo (React Native) + Supabase**.

## Stack
- **App:** Expo SDK 54, React Native 0.81, expo-router (file-based), TypeScript
- **Backend:** Supabase - Auth, Postgres (RLS), Realtime chat and private competition updates
- **Data:** user-created football match challenges for private competitions

## Features
- Username-only onboarding with anonymous auth
- **Competitions** - create private competitions, choose a punishment, add custom matches, and share invite codes
- **Predictions** - friends pick exact scores before each match starts
- **Standings** - hosts enter final scores and leaderboards update
- **Friends** - search, request/accept, and 1:1 realtime DMs
- **Profile** - stats, forecasts, display name, and profile photo

## Run it
```bash
npm install
npx expo start            # press i (iOS sim), a (Android), or scan QR in Expo Go
```
Supabase URL + anon key are baked into `app.json > extra` (anon key is safe client-side).

## Backend
- `supabase/schema.sql` — tables, scoring function + triggers
- `supabase/rls.sql` — RLS policies, auth trigger, helper RPCs
- `supabase/rls-fix.sql` — SECURITY DEFINER membership helpers (avoids RLS recursion)
- `scripts/e2e-test.mjs` — full backend integration test (18 checks). `node scripts/e2e-test.mjs`

## Roadmap to stores
- Apple Developer account ($99/yr) + Google Play ($25) → `eas build` + `eas submit`
- Configure SMTP in Supabase for production email confirmation
