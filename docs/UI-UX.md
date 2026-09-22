# UI / UX

## Identity

| Token | Value |
|-------|--------|
| Primary | `#00897B` |
| Scoring | `#FF9800` |
| Danger / LIVE | `#E53935` / `#e53935` |
| Background | `#FFFFFF` |
| Text | `#111827` |
| Muted | `#6B7280` |
| Border | `#E5E7EB` |
| Touch min | 44px |

Source: `apps/web/src/styles/tokens.css`. Navigation is a **left drawer**, not a bottom tab bar.

## Screens that exist

See `docs/SCREEN-INVENTORY.md`. High-traffic: Home, Matches, Open Match, Match Centre (score + summary), Public live, Teams, Players, Tournaments + Points, Login/Register.

## Rules

- Mobile-first (360–414 widths)
- User-facing strings via i18n (`en` / `hi` / `mr`)
- Share bodies use `share.body.*` (including `watchLiveOf`) — never hardcode translated sentences in components
- Tournament dashboard tabs: Overview, Groups, Points, Fixtures, Knockout, Stats, MVP, Quiz, Rules, Settings
- Notifications: header bell + `/notifications` inbox (in-app only unless email is configured)
- Empty lists need a CTA, not a white page
- Scoring stays high contrast even if dark theme is added later
- Do not copy competitor branding or assets
