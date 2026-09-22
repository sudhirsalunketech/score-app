import { LIVE_SOCKET } from '@crickscore/shared';

/** Single source of truth is `LIVE_SOCKET` in packages/shared — re-exported here under the
 * historical name so existing imports keep working without a repo-wide rename. */
export const LIVE_SOCKET_EVENTS = LIVE_SOCKET;
