# Authentication

CrickScore uses **email/mobile + password** and **email OTP**. There is no SMS provider.

## Tokens

| Token | Storage | Lifetime | Notes |
|-------|---------|----------|-------|
| Access JWT | `localStorage` `cs.access` | 15 minutes (`JWT_ACCESS_SECRET`) | Payload: `sub`, `email`, `role`, `name` |
| Refresh | `localStorage` `cs.refresh` | `JWT_REFRESH_DAYS` (default 365) | SHA-256 stored in `RefreshToken`; rotated on refresh, which resets the 365-day countdown, so an active user is never logged out until they log out themselves |

Passwords: bcrypt cost 12. Never returned to the client.

## HTTP

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/v1/auth/register` | Public, 10/min | Creates `PLAYER` |
| POST | `/api/v1/auth/login` | Public, 20/min | |
| POST | `/api/v1/auth/refresh` | Public | Rotates refresh |
| POST | `/api/v1/auth/logout` | Public | Revokes presented refresh |
| POST | `/api/v1/auth/forgot-password` | Public | Always `{ sent: true }`; token logged in non-prod only |
| POST | `/api/v1/auth/reset-password` | Public | `{ token, password }`; revokes all refresh tokens |
| GET | `/api/v1/users/me` | JWT | |
| PATCH | `/api/v1/users/me` | JWT | `name`, `locale`, `phone` |
| POST | `/api/v1/users/me/change-password` | JWT | `{ currentPassword, newPassword }`; revokes all refresh tokens |
| GET | `/api/v1/users/me/sessions` | JWT | Active sessions: device, browser, last active (no raw IP) |
| DELETE | `/api/v1/users/me/sessions/:sid` | JWT | Revoke one |
| POST | `/api/v1/users/me/logout-all` | JWT | Revoke all refresh tokens |

## Roles (backend must enforce)

| Role | Intended |
|------|----------|
| SUPER_ADMIN | Bypass `@Roles`; everything |
| ADMIN | Club / tournament / match management |
| SCORER | Score assigned matches |
| TEAM_MANAGER | Team / player writes |
| PLAYER | Own profile / stats |
| VIEWER | Read |

Runtime checks use `User.role` + `JwtAuthGuard` + `AccessService` / `PermissionGuard`. Seeded `Permission` tables are **not** consulted at runtime.

`canScoreMatch` allows SUPER_ADMIN/ADMIN always; SCORER only if `settings.scorerId` matches, else the match `createdById`. Viewers cannot score. Enforced on `POST /innings/:id/events` and undo.

## Frontend screens

| Screen | Route | Status |
|--------|-------|--------|
| Login | `/login` | Exists |
| Register | `/register` | Exists |
| Forgot | `/forgot` | Exists |
| Reset | `/reset` | Exists |
| Profile | `/profile` | Edit name, phone, avatar |
| Settings | `/settings` | Language, change password, sessions, logout all |
| Logout confirm | Drawer | Exists |
| Sessions | Settings | Device + browser + last active |
| OTP | `/login` | Email OTP exists; no SMS provider |

Guest-only: `GuestOnly`. Protected: `AuthGuard`. Public live does **not** require login.
