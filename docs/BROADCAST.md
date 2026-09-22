# CrickScore broadcast overlay

Transparent browser-source overlay for OBS, vMix, Streamlabs, PRISM, and YouTube Live.

## Route

`/live/match/:slug/overlay`

No app chrome. `html`/`body` background is transparent. YouTube is **not** embedded here — the overlay sits on top of the camera/stream.

## Modes

Default **standard**. Also: `full`, `compact`, `minimal`.

Themes: `classic`, `dark`, `transparent`.

Saved on `Match.settings.broadcast` from Open Match or Match Centre (TV button). Copy the overlay URL and add a Browser Source at 1920×1080 (or 1280×720). Enable a transparent background.

## Live data

Initial snapshot: `GET /api/v1/public/matches/:slug/live`  
Updates: Socket.IO `join.public-match` → `match.score.updated`

If `publicLiveEnabled` is false, the overlay renders nothing. The public match page can still load chrome.

FOUR / SIX / WICKET / milestone / over-complete animations fire only for **new** sequences (`sessionStorage` + last event id). Refresh does not replay them.

Pause states `DRINKS_BREAK`, `RAIN_DELAY`, and `MATCH_DELAY` are real `MatchStatus` values. Scorers pause/resume from Match Centre actions. Scoring is rejected while paused.

## Public live page

`/live/match/:slug` has summary, video (if YouTube configured), scorecard, commentary, stats, Super Stars, balls, teams, chat, quiz, and fans. Chat/quiz stay off the overlay.
