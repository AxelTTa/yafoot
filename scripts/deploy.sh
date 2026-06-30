#!/usr/bin/env bash
# YaFoot one-shot deploy: push changes to BOTH targets.
#   - Vercel web URL (always; uses $VERCEL_TOKEN)
#   - Expo Go via EAS Update OTA (if $EXPO_TOKEN is set)
# Run from anywhere: bash scripts/deploy.sh   (env is sourced by the systemd bridge from yafoot.env)
set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "[1/6] typecheck"; npx tsc --noEmit
echo "[2/6] build web bundle"; rm -rf dist; npx expo export --platform web --output-dir dist
echo "[3/6] ship icon font + SPA rewrite"; mkdir -p dist/fonts dist/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts; cp assets/fonts/Ionicons.ttf dist/fonts/ionicons.ttf; cp assets/fonts/Ionicons.ttf dist/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf; find dist/_expo/static/js -name '*.js' -exec perl -0pi -e 's#/assets/node_modules/\@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons\.[A-Za-z0-9]+\.ttf#/fonts/ionicons.ttf#g' {} +
if [ -d public ]; then cp -R public/. dist/; fi
printf '%s' '{ "routes": [ { "handle": "filesystem" }, { "src": "/.*", "dest": "/index.html" } ] }' > dist/vercel.json
echo "[4/6] sanity: native bundle compiles (Expo Go must always work)"; npx expo export --platform ios --output-dir /tmp/yf-ios-check >/dev/null 2>&1 && echo "  native OK" && rm -rf /tmp/yf-ios-check || echo "  WARN: native bundle failed — fix before relying on Expo Go"
echo "[5/6] deploy web -> Vercel"; ( cd dist && npx -y vercel@latest deploy --prod --yes --token "$VERCEL_TOKEN" --scope axelcassou2-1440s-projects | tail -1 )
if [ -n "${EXPO_TOKEN:-}" ] && [ "$EXPO_TOKEN" != "__SET_EXPO_TOKEN__" ]; then
  echo "[6/6] OTA -> Expo Go (EAS Update)"
  ( cd "$ROOT" && EXPO_TOKEN="$EXPO_TOKEN" npx eas-cli@latest update --branch production --message "server deploy $(date -u +%FT%TZ)" --non-interactive 2>&1 | tail -4 ) \
    || echo "  eas update failed — if first run, do: EXPO_TOKEN=... npx eas-cli init  (creates projectId), then eas update:configure"
else
  echo "[6/6] EXPO_TOKEN not set -> skipping Expo Go OTA. Set EXPO_TOKEN in yafoot.env to enable."
fi
echo "--- committing + pushing source ---"
git add -A && git commit -m "deploy $(date -u +%FT%TZ)" >/dev/null 2>&1 || echo "(nothing to commit)"
git push >/dev/null 2>&1 || echo "(push skipped)"
echo "DONE. Web: https://dist-five-zeta-92i4a6g3xx.vercel.app"
