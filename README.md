# FCNY Tourney

A simple, mobile-friendly tournament tracker. No install, no backend, no
account — everything is saved automatically to the phone's browser storage
after every action.

## Features

- **Teams** — add/remove the teams playing in the tournament.
- **Groups** — create groups, assign teams to each, record match results,
  and see a live standings table (P / W / D / L / GF / GA / GD / Pts).
  Points: 3 for a win, 1 for a draw, 0 for a loss. Standings sort by
  points, then goal difference, then goals for.
- **Bracket** — build a custom knockout bracket: add rounds (e.g.
  Quarterfinal, Semifinal, Final), add matchups, pick teams and enter
  scores. The winner is highlighted automatically; if scores are tied you
  can pick the winner manually (e.g. penalties).
- **Autosave** — every add/edit/delete is saved instantly to the device's
  local storage. Reloading or reopening the page restores everything.

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

## Notes

- Data is stored per-browser via `localStorage`. It does not sync between
  devices — it's local to whichever phone/browser you use it on.
- Removing a team also removes it from any groups, results, and bracket
  matchups it was part of.
