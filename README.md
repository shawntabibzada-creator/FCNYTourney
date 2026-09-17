# FCNY Tourney

A simple, mobile-friendly tournament tracker. No install, no backend, no
account — everything is saved automatically to the phone's browser storage
after every action.

Built for a multi-division event (e.g. several age groups each running
their own World Cup–style group stage + knockout bracket) — set up each
age group once, then everything below is scoped to whichever one is active.

## Features

- **Age Groups** — the top-level container for each division (e.g. U10
  Boys, U12 Girls, Open). Each one has its own independent teams, groups,
  and bracket, so running 5–6 separate mini-tournaments side by side just
  means adding 5–6 age groups. Switch between them from the Ages tab or
  the "Switch ›" banner shown on every other tab.
- **Teams** — add/remove the teams playing in the currently active age group.
- **Groups** — create groups, assign teams to each, record match results,
  and see a live standings table (P / W / D / L / GF / GA / GD / Pts).
  Points: 3 for a win, 1 for a draw, 0 for a loss. Standings sort by
  points, then goal difference, then goals for.
- **Bracket** — build a custom knockout bracket: add rounds (e.g.
  Quarterfinal, Semifinal, Final), add matchups, and pick teams for each
  side. A side can be a specific team, or a live group-standings slot
  (e.g. "Group A – 1st") that automatically resolves to whichever team
  currently holds that spot — no manual re-seeding once group results
  change. The winner is highlighted automatically; if scores are tied you
  can pick the winner manually (e.g. penalties).
- **Autosave** — every add/edit/delete is saved instantly to the device's
  local storage. Reloading or reopening the page restores everything.
- **Backup / Restore** — since data lives only on this one device, the
  Ages tab has "Export Backup" (downloads a `.json` file of everything)
  and "Restore Backup" (loads one back in) — use it to keep a copy or
  move the tournament to another phone.

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
  devices — it's local to whichever phone/browser you use it on. Use
  Export/Restore Backup to move it or keep a copy.
- Removing a team also removes it from any groups, results, and bracket
  matchups it was part of, within its age group.
- Removing an age group deletes everything inside it (teams, groups,
  results, bracket) — there's a confirmation prompt before this happens.
