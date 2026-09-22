import { describe, expect, it } from 'vitest';
import { NotificationsService } from './notifications.service';

describe('NotificationsService channels', () => {
  it('marks in-app as configured and push as not configured', () => {
    const svc = new NotificationsService({} as never);
    const channels = svc.channels();
    expect(channels.IN_APP.configured).toBe(true);
    expect(channels.PUSH.configured).toBe(false);
    expect(channels.PUSH.note).toMatch(/not configured/i);
  });
});
