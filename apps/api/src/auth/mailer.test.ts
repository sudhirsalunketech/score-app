import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildPasswordResetEmail,
  clearMailInbox,
  deliverResetEmail,
  isDevMailDelivery,
  mailInbox,
  sendMail,
  setMailTransportForTests,
  type MailMessage,
} from './mailer';

describe('password reset mail', () => {
  afterEach(() => {
    setMailTransportForTests(null);
    clearMailInbox();
    delete process.env.MAIL_PROVIDER;
    process.env.NODE_ENV = 'test';
    delete process.env.APP_ENV;
  });

  it('builds a user-facing reset email without the password', () => {
    const message = buildPasswordResetEmail({
      to: 'player@example.com',
      resetUrl: 'http://localhost:5173/reset?token=abc123secret',
    });
    expect(message.subject).toMatch(/CrickScore/i);
    expect(message.text).toMatch(/expires in 1 hour/i);
    expect(message.text).toMatch(/reset\?token=abc123secret/);
    expect(message.text).toMatch(/need help/i);
    expect(message.text).not.toMatch(/passwordHash|ChangeMe/i);
    expect(message.html).toMatch(/Reset your password/);
  });

  it('invokes the configured transport in production without logging the token', async () => {
    const sent: MailMessage[] = [];
    setMailTransportForTests({
      async send(message) {
        sent.push(message);
      },
    });
    const prev = process.env.NODE_ENV;
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'production';
    expect(isDevMailDelivery()).toBe(false);
    await deliverResetEmail('owner@example.com', 'https://app.example/reset?token=prod-secret-token');
    process.env.NODE_ENV = prev;
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('owner@example.com');
    expect(sent[0]?.text).toContain('prod-secret-token');
    expect(log.mock.calls.flat().join(' ')).not.toContain('prod-secret-token');
    log.mockRestore();
  });

  it('keeps development delivery on the log/memory path', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.APP_ENV;
    process.env.MAIL_PROVIDER = 'log';
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await deliverResetEmail('dev@example.com', 'http://localhost:5173/reset?token=dev-token');
    expect(mailInbox()[0]?.to).toBe('dev@example.com');
    expect(log.mock.calls.flat().join(' ')).toMatch(/link-issued/);
    expect(log.mock.calls.flat().join(' ')).not.toContain('dev-token');
    log.mockRestore();
  });

  it('uses the injected test transport when sendMail is called', async () => {
    let hit = 0;
    setMailTransportForTests({
      async send() {
        hit += 1;
      },
    });
    await sendMail({ to: 'a@b.c', subject: 't', text: 'hello' });
    expect(hit).toBe(1);
  });
});
