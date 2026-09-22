# Screen inventory

Source: `reference/ui-screenshots/` (56 PNG captures, 14 Aug 2026). Only these product screens are in scope.

| # | Screen | Screenshot | Implemented route |
|---|--------|------------|-------------------|
| 01 | Home dashboard | 48 | `/` |
| 02 | Left drawer | 41 | `AppDrawer` |
| 03 | Teams discovery | 30 | `/teams` |
| 04 | Create team modal | 32 | `/teams` modal |
| 05 | Select team | 39 | Open Match pickers |
| 06 | Clubs list | 29 | `/clubs` |
| 07 | Register as club | 33 | `/clubs?register=1` |
| 08 | Tournaments list | 42 | `/tournaments` |
| 09 | Create tournament | 40 | `/tournaments/new` |
| 10 | Tournament home | 36, 45 | `/tournaments/:id` |
| 10b | Tournament custom rules | — | `/tournaments/:id/rules` |
| 11 | Tournament teams empty | 50 | `/tournaments/:id` teams tab |
| 12 | Points empty | 01, 11 | `/tournaments/:id` points |
| 13 | Points populated | 55 | `/tournaments/:id` points |
| 14 | Tournament statistics | 51 | `/tournaments/:id` statistics |
| 15 | Open Match | 19, 35, 28 | `/matches/new`, `/matches/:id` |
| 16 | Format modal | 15 | Open Match |
| 17 | Toss modal | 21 | Open Match |
| 18 | Live scoring + orange keypad | 26 | `/matches/:id/score` |
| 19 | Wicket sheet short | 05, 22 | scoring |
| 20 | Wicket sheet full | 12 | scoring |
| 21 | Extra / more runs | 14, 23 | scoring |
| 22 | Penalty | 08 | extras sheet |
| 23 | Retired hurt | 07 | wicket sheet |
| 24 | Match settings | 06 | format + settings |
| 25 | Select batsman / bowler | 17, 18, 20 | player picker |
| 26 | End innings / abandon | 09, 10, 13, 16 | scoring more (partial) |
| 27 | Match centre summary | 02 | scoring tab |
| 28 | Scorecard | 52, 56 | score tab |
| 29 | Balls log | 03 | live events |
| 30 | Super Stars | 04 | stars tab |
| 31 | Match info | 49 | match open + live |
| 32 | Statistics hub | 43–54 | `/statistics` |
| 33 | Player overview | 31, 37 | `/players/:id` |
| 34 | Player statistics | 34 | `/players/:id` |
| 35 | Profile / edit | 25, 27 | `/profile` |
| 36 | Manage devices | 24 | settings (session via refresh tokens) |
| 37 | Add player | 38 | team detail |
| 38 | Login / register / forgot | implied | `/login` `/register` `/forgot` |
| 39 | Settings / language | implied | `/settings` |
| 40 | Following | implied | `/following` |

Statistics categories from screenshots (do not invent extras):

1. Most Runs  
2. Most Wickets  
3. Highest Score  
4. Best Bowl  
5. Best Economy  
6. Most Maidens  
7. Bowl Dots  
8. Fastest 50  
9. Fastest 100  
10. Best Partnership  
11. Most Balls  
12. MVP  
