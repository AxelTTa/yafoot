# App Store-safe mode

YaFoot defaults to App Store-safe mode through `app.json > expo.extra.appStoreSafe: true`.

Safe mode behavior:
- Shows private friend-created football prediction competitions only.
- Uses Competitions as the primary surface; there is no standalone/global match feed in the review path.
- Lets users create a competition, add multiple custom matches with side A, side B, and start time, then invite friends.
- Predictions are made from inside the competition detail, alongside previous picks/history, standings, and chat.
- Hides live group round mode, tournament standings, match insight screens, preset fixtures, and official event framing from the review path.

Full/tournament mode:
- The richer fixture/feed code path is still present.
- To build the full app path locally, set `EXPO_PUBLIC_APP_STORE_SAFE=false` and ensure `app.json > expo.extra.appStoreSafe` is false for that build profile.
- Do not use full mode for App Store review unless licensed event references are allowed again.

App Store listing fields for resubmission:
- Version: `1.0.1`
- iOS build number: `6`
- Subtitle: `Friend Score Predictions`
- Description: `Create private football prediction competitions with friends. Add your own matches by entering two sides and a start time, invite friends with a code, pick exact scores inside each competition, and follow standings, chat, previous picks, and results history. YaFoot keeps setup fast with username-only play, shareable competition codes, friend invites, chat, and direct messages. Free to play. No email required.`
- Keywords: `football,soccer,predictions,friends,competition,leaderboard,scores,challenge,chat`
- Support URL: `https://dist-five-zeta-92i4a6g3xx.vercel.app/support`
- Marketing URL: `https://dist-five-zeta-92i4a6g3xx.vercel.app`

Reviewer note:
`YaFoot is a generic friend-created football prediction competition app. The review build does not show licensed event names, preset event fixture lists, event logos, crests, award imagery, or marks. Reviewers can create a competition from the Competitions tab, add custom matches by entering two sides and a start time, invite friends by code, save predictions inside the competition detail, and use friends/chat. There is no standalone match feed or live group round mode in the review path. Support and privacy/delete-account information are available at /support and /privacy.`
