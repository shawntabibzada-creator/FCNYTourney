# FCNY Tourney

A simple, mobile-friendly tournament tracker. No install, no backend, no
account. Everything is saved automatically to the phone's browser storage
after every action.

Built for a multi-division event: several age groups, each running its
own World Cup style group stage plus knockout bracket. Set up each age
group once, then everything below is scoped to whichever one is active.

## Features

- **Age Groups**: the top-level container for each division (e.g. U10
  Boys, U12 Girls, Open). Each one has its own independent teams, groups,
  and bracket, so running 5 or 6 separate mini-tournaments side by side
  just means adding 5 or 6 age groups. Switch between them from the Ages
  tab or the "Switch" banner shown on every other tab.
- **Teams**: add/remove the teams playing in the currently active age group.
- **Groups**: create groups, assign teams to each, record match results,
  and see a live standings table (P / W / D / L / GF / GA / GD / Pts).
  Points: 3 for a win, 1 for a draw, 0 for a loss. Standings sort by
  points, then goal difference, then goals for.
- **Bracket**: pick the teams playing from a chip list and hit "Generate
  Bracket," the whole single-elimination tree is built at once, correctly
  named (Final, Semifinal, Quarterfinal, Round of N) and sized, with byes
  handled automatically for an odd team count. Score each matchup and the
  winner advances into the next round's slot by itself, live, with no
  manual re-seeding. Once decided, a matchup's losing side is tagged
  "Eliminated". Each matchup's team picker also accepts a live group-
  standings slot (e.g. "Group A 1st") if you'd rather link a slot to an
  in-progress group instead of a fixed team. "Reset bracket" clears it back
  to the team-select screen if you need to rebuild it.
- **Autosave**: every add/edit/delete is saved instantly, either to the
  device's local storage or, with Live Sync connected, to the shared
  tournament. Reloading or reopening the page restores everything.
- **Backup / Restore**: the Ages tab has "Export Backup" (downloads a
  `.json` file of everything) and "Restore Backup" (loads one back in).
  Use it to keep a copy, move the tournament to another phone, or as a
  one-time way to hand your existing data to a Live Sync room.
- **Live Sync** (optional): share one tournament across multiple phones in
  real time: you and your coaches all seeing and entering the same
  scores. Off by default; see "Live Sync setup" below to turn it on.

## Running it

No build step required. Any static file server works, for example:

```
python3 -m http.server 8000
```

Then open `http://<your-computer-ip>:8000` on your phone (same Wi-Fi
network), or deploy the folder to any static host (GitHub Pages, Netlify,
Vercel, etc.) and open the URL on your phone.

On iOS Safari or Android Chrome, use "Add to Home Screen" to launch it
like an app in full-screen mode.

## Live Sync setup

Without any setup, every phone's data is local to that phone (`localStorage`),
exactly as described above. Live Sync is an optional upgrade so multiple
people (e.g. you and two coaches) can run one tournament together, each
entering results on their own phone and seeing everyone else's changes
appear automatically.

It uses Firebase Realtime Database, which is free at this scale and needs
no server of your own; the app talks to it directly from the browser.

1. Go to [console.firebase.google.com](https://console.firebase.google.com),
   sign in with any Google account, and click "Add project". Any name is
   fine; you can decline Google Analytics.
2. On the project's home page, click the "</>" (Web) icon to register a web
   app. Any nickname is fine. Click "Register app".
3. It shows a `firebaseConfig` object. Copy it.
4. Open `firebase-config.js` in this project and paste your config in place
   of `null`.
5. Back in the Firebase console's left sidebar: Build > Realtime Database >
   Create Database. Any region is fine; start in "test mode".
6. Still in Realtime Database, open the "Rules" tab, replace the contents
   with the rules below, and click "Publish":

   ```json
   {
     "rules": {
       "tournaments": {
         "$code": {
           ".read": true,
           ".write": true
         }
       }
     }
   }
   ```

   Test-mode rules expire after 30 days and then lock everyone out, so this
   step matters even though it looks like it's opening things up rather
   than closing them down.
7. Redeploy (push to the branch GitHub Pages serves, or re-upload the
   folder). Reload the app. A "Live Sync" box now appears on the Ages tab.
8. Make up a tournament code (anything, e.g. `FCNY2026`), type it into that
   box, and hit Connect. Give the exact same code to your coaches; when
   they type it into their own copy of the app, all three of you are
   looking at and editing the same tournament.

**Security note:** there's no login system. Anyone who has the code and a
copy of the app can view and edit that tournament's data; the code is the
only thing standing between your data and a stranger. Don't use a guessable
code, and don't put anything sensitive in team or player names. This is a
reasonable tradeoff for a youth tournament; it would not be for anything
higher-stakes.

## Notes

- Without Live Sync, data is stored per-browser via `localStorage` and does
  not sync between devices; it's local to whichever phone or browser you
  use it on. Use Export/Restore Backup to move it or keep a copy.
- With Live Sync connected, `save()` writes the whole tournament to Firebase
  instead of `localStorage`, and every connected device re-renders when
  anyone's change arrives. Two people editing the exact same field at the
  exact same moment is last-write-wins, same as it would be in a shared
  spreadsheet; there's no merge logic beyond that.
- Removing a team also removes it from any groups, results, and bracket
  matchups it was part of, within its age group.
- Removing an age group deletes everything inside it (teams, groups,
  results, bracket). There's a confirmation prompt before this happens.
