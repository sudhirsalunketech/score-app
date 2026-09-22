# UI/UX audit

**Product:** CrickScore — tennis-ball / street cricket scoring (CricHeroes-class).  
**Source of truth:** `/reference/ui-screenshots/` (56 captures). See `INDEX.md`.  
**Application:** new monorepo at `/home/sudhir/crickscore-new` (React PWA + NestJS). The previous app at `/home/sudhir/esp/crickscore` is **not** the implementation target.

## Product character

| Trait | Evidence |
|-------|----------|
| White surfaces, black text | Home, Match Centre, lists |
| Teal primary `#00897B` / `#00695C` | Headers, scores, rank badges, primary buttons |
| Orange scoring `#FF9800` | Keypad, striker highlight, wicket sheet |
| Dark gold `#1C232B` + `#FDC02F` | Register Club, Create Tournament |
| Left drawer, not a bottom tab bar | Home hamburger `41` |
| Street cricket | T10, 5 overs, 7 wickets, tennis ball, Mankad, Over The Fence |

## Tokens

Defined in `packages/shared/src/design.ts` and `apps/web/src/styles/tokens.css`. Never scatter hex values in components.

| Token | Hex | Use |
|-------|-----|-----|
| primary | `#00897B` | Chrome, scores, selected state |
| scoring | `#FF9800` | Keypad and scoring sheets |
| gold | `#FDC02F` | Club/tournament forms |
| dark chrome | `#1C232B` | Club/tournament form canvas |
| live | `#E53935` | LIVE badge |

Typography: Inter/system sans. Score display 36–44px bold. Gutter 16px. Touch 44px, scoring keys 48px. Radius 8/12/16/24/pill. Logical CSS properties for RTL readiness.

## Navigation

```
Home (hamburger)
  Drawer (right-aligned labels + icons):
    My Matches, My Tournaments, Profile, My Teams, My Clubs,
    Start Match, Create Tournament, Register As Club, Following, Settings, Logout
  Matches carousel → Open Match / Match Centre
  Profile split card → Profile
  Tournaments carousel → Tournament
```

Match Centre underline tabs: Scoring · Scorecard · Stats · Super Stars.  
Tournament underline tabs: HOME · TEAMS · MATCHES · POINTS · STATISTICS.  
Discovery pills: Teams · Tournaments · Clubs.

## Screen-by-screen (condensed)

### Home — `48`

Purpose: landing for authenticated scorer/player. Header: hamburger, search, news (red dot). Matches carousel with LIVE in red, ALL CAPS team names, “View Tournament”. Profile split card (charcoal avatar | teal name + Matches/Runs). Tournaments peek. Footer in reference: Follow Us On. Responsive: 360–430px primary; drawer persistent from 1024px.

### Drawer — `41`

~85% white panel, dim backdrop (tap to close). Avatar + name. Items right-aligned with icons. Logout in danger colour (product addition for session). Escape + focus trap.

### Open Match — `19` `35` + Toss `21` + Format `15`

TEAM A / TEAM B dashed circles. Venue underline, date, time. Summary `5 Overs - T10 - 7 Wickets - Tennis`. Dual teal SAVE FIXTURE / START MATCH. Toss: who won + Bat/Bowl + START SCORING. Format chips: overs, T10/T20, wickets 5–10, balls/over 4–8, tennis/leather, Over The Fence / Mankad / Last man.

### Scoring — `26` + sheets `05` `12` `14` `23`

Teal `runs-wickets (maxWickets)`. Extras, overs `0.0 / 5`, CRR, partnership `0(0)`. Batsman table R B 4s 6s SR (striker orange pill + `*`). Bowler O M R W Eco. Orange keypad: 0–6, Wide, NB, Bye, LB, Out, Undo. Wicket sheet: Bowled, Caught, Stumped, LBW, Run Out, Mankad, Retired, Over The Fence, One Hand One Bounce, Obstructing, Hit Wicket, Hit The Ball Twice, Timed Out.

API: `GET /matches/:id/live`, `POST /innings/:id/events` (idempotencyKey), `POST /innings/:id/undo`.  
DB: `ball_events` append-only; innings projections replayed.

### Scorecard — `52`

Team toggle, batting, bowling, extras, fall of wickets, partnership circle.

### Statistics hub — `43`–`54`

Teal header, 12 categories listed in `SCREEN-INVENTORY.md`. MVP uses screenshot formula (not fantasy points). See `MVP-FORMULA.md`.

### Tournaments — `01` `36` `50` `55`

Photo banner, groups A/B/C, points table M W L T **P** NRR. Empty group copy + CREATE GROUP.

### Clubs / create tournament — `29` `33` `40`

Dark gold forms. Do not paint these teal/orange.

## Interactions

- Backdrop tap closes drawer/sheets (except abandon countdown).
- Offline scoring queue: pending / synced / failed on Match Centre.
- One-handed scoring: keypad in thumb zone.

## Accessibility

Semantic headers, 44/48px targets, dialog/drawer ARIA, striker `*` plus colour, reduced-motion token `--motion: 0ms`.

## API / database implications

Every screen in the inventory maps to `/api/v1` resources in `SCREEN-COMPONENT-MAP.md`. Match rules (overs, balls/over, max wickets, ball type, street dismissals) live on `matches.settings` + columns — never hardcode 6-ball overs.
