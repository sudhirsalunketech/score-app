# YouTube + OBS overlay

Two different features:

1. **YouTube iframe on the CrickScore live page** — viewers watch the stream *inside* CrickScore, with the live score beside/below it.
2. **OBS Browser Source overlay** — CrickScore score is drawn *on top of* the YouTube livestream itself.

An iframe cannot change the pixels of a YouTube video. Use OBS for (2).

## Overlay URL

```text
https://YOUR_DOMAIN/live/match/{publicSlug}/overlay
```

Example (local):

```text
http://localhost:5173/live/match/ye-vs-mestry-xi-2026/overlay
```

The page has a **transparent** background, no app chrome, and listens to `match.score.updated`.

## Modes

Query string (OBS-friendly):

| Param | Default | Meaning |
| --- | --- | --- |
| `mode` | `standard` | `minimal` · `compact` · `standard` · `full` |
| `score` | on | Bottom scoreboard |
| `over` | on (not minimal) | Current over chips |
| `batters` | on (not minimal) | Striker / non-striker |
| `bowler` | on in `full` | Current bowler |
| `partnership` | on in `full` | Partnership |
| `recent` | on in `full` | Last overs strip |
| `moments` | on in `full` | 4 / 6 / W strip |
| `projected` | off | First-innings projected total from current rate |
| `fan` | off | Existing TOTAL_RUNS fan prediction (virtual points only) |
| `sound` | off | Short tones for four / six / wicket |

Examples:

```text
/live/match/{slug}/overlay
/live/match/{slug}/overlay?mode=full
/live/match/{slug}/overlay?mode=minimal
/live/match/{slug}/overlay?mode=full&projected=1
```

Win probability is **not** shown. There is no backend calculation.

## OBS setup

1. Start the YouTube Live event in YouTube Studio.
2. Open OBS Studio.
3. Add your camera/game capture as usual.
4. **Add → Browser Source**.
5. URL: the overlay URL above.
6. Width / height: `1920` × `1080` (or `1280` × `720`).
7. Enable **Shutdown source when not visible**.
8. Custom CSS (optional):

```css
body { background-color: rgba(0, 0, 0, 0); margin: 0; overflow: hidden; }
```

9. Enable **Browser Source Hardware Acceleration** if available.
10. Place the source over the full frame. The score sits in the safe margin at the bottom; the centre stays clear for video.

Transparency: `html.cs-overlay` forces a transparent document. Glass panels are charcoal at ~72% opacity.

## Public live must be ON

If **Public Live Score** is off, the overlay cannot load match data.

## Local testing

1. `pnpm db:migrate && pnpm db:seed`
2. `pnpm dev`
3. Open the overlay URL for a public match
4. Score from Match Centre — FOUR / SIX / WICKET banners fire only for **new** balls, not on refresh
