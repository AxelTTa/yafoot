# App Store-safe mode

YaFoot defaults to App Store-safe mode through `app.json > expo.extra.appStoreSafe: true`.

Safe mode behavior:
- Shows friend-created football prediction challenges only.
- Filters the app UI to matches where `competition = 'YaFoot Challenge'`.
- Lets users create a challenge manually with team/country A, team/country B, start time, and optional challenge name.
- Keeps predictions, leagues, friends, chat, leaderboards, and Party Mode usable with those challenges.
- Hides tournament standings and match insight screens from the review path.

Full/tournament mode:
- The richer fixture/feed code path is still present.
- To build the full app path locally, set `EXPO_PUBLIC_APP_STORE_SAFE=false` and ensure `app.json > expo.extra.appStoreSafe` is false for that build profile.
- Do not use full mode for App Store review unless licensed event references are allowed again.

App Store listing fields for resubmission:
- Version: `1.0.1`
- iOS build number: `6`
- Subtitle: `Friend Score Predictions`
- Description: `Create football prediction challenges with friends. Add your own match by entering two teams or countries and a start time, invite friends, pick exact scores, and follow private league leaderboards. YaFoot keeps setup fast with username-only play, shareable league codes, friend invites, chat, direct messages, and Party Mode for live friend-hosted prediction rounds. Free to play. No email required.`
- Keywords: `football,soccer,predictions,friends,league,leaderboard,scores,challenge,chat,party`
- Support URL: `https://dist-five-zeta-92i4a6g3xx.vercel.app/support`
- Marketing URL: `https://dist-five-zeta-92i4a6g3xx.vercel.app`

Reviewer note:
`YaFoot is a generic friend-created football prediction challenge app. The review build does not show licensed event names, preset event fixture lists, event logos, crests, trophies, or marks. Reviewers can create a challenge from the Challenges tab by entering two teams/countries and a start time, then save predictions, create/join private leagues, use friends/chat, and try Party Mode. Support and privacy/delete-account information are available at /support and /privacy.`
