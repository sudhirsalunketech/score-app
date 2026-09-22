export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailTransport = {
  send(message: MailMessage): Promise<void>;
};

const memoryInbox: MailMessage[] = [];
let testTransport: MailTransport | null = null;

export function isDevMailDelivery() {
  return process.env.NODE_ENV !== 'production' && process.env.APP_ENV !== 'beta';
}

export function appName() {
  return process.env.APP_NAME ?? 'CrickScore';
}

export function mailFrom() {
  return process.env.MAIL_FROM ?? `${appName()} <noreply@crickscore.app>`;
}

export function supportUrl() {
  return (process.env.SUPPORT_URL ?? process.env.WEB_ORIGIN ?? 'https://crickscore.app').replace(/\/$/, '');
}

export function mailInbox() {
  return memoryInbox;
}

export function clearMailInbox() {
  memoryInbox.length = 0;
}

export function setMailTransportForTests(transport: MailTransport | null) {
  testTransport = transport;
}

export function buildPasswordResetEmail(input: { to: string; resetUrl: string; expiresIn?: string }): MailMessage {
  const name = appName();
  const expires = input.expiresIn ?? '1 hour';
  const help = supportUrl();
  const text = [
    `${name} password reset`,
    '',
    `We received a request to reset the password for this ${name} account.`,
    `Open this secure link to choose a new password. The link expires in ${expires} and can be used only once.`,
    '',
    input.resetUrl,
    '',
    `If you did not request this, you can ignore this email. Your password will stay the same.`,
    `Need help? ${help}`,
  ].join('\n');
  const html = `<p>We received a request to reset the password for this ${escapeHtml(name)} account.</p>
<p>Open this secure link to choose a new password. The link expires in ${escapeHtml(expires)} and can be used only once.</p>
<p><a href="${escapeHtml(input.resetUrl)}">Reset your password</a></p>
<p>If you did not request this, you can ignore this email. Your password will stay the same.</p>
<p>Need help? <a href="${escapeHtml(help)}">${escapeHtml(help)}</a></p>`;
  return {
    to: input.to,
    subject: `Reset your ${name} password`,
    text,
    html,
  };
}

export function buildOtpEmail(input: { to: string; code: string }): MailMessage {
  const name = appName();
  return {
    to: input.to,
    subject: `Your ${name} login code`,
    text: `Your ${name} login code is ${input.code}. It expires in 10 minutes.`,
  };
}

export async function deliverResetEmail(to: string, resetUrl: string) {
  const message = buildPasswordResetEmail({ to, resetUrl });
  if (isDevMailDelivery()) {
    console.info(`[reset-email] to=${to} link-issued`);
  }
  await sendMail(message);
  return message;
}

export async function deliverOtpEmail(to: string, code: string) {
  const message = buildOtpEmail({ to, code });
  if (isDevMailDelivery()) {
    console.info(`[otp-email] to=${to} Your ${appName()} login code is ${code}. It expires in 10 minutes.`);
  }
  await sendMail(message);
  return message;
}

export async function sendMail(message: MailMessage) {
  const transport = resolveTransport();
  await transport.send(message);
}

function resolveTransport(): MailTransport {
  if (testTransport) return testTransport;
  const provider = (process.env.MAIL_PROVIDER ?? (isDevMailDelivery() ? 'log' : 'smtp')).toLowerCase();
  if (provider === 'memory' || process.env.NODE_ENV === 'test') return memoryTransport;
  if (provider === 'log' || isDevMailDelivery()) return logTransport;
  if (provider === 'resend' || process.env.RESEND_API_KEY) return httpTransport('resend');
  if (provider === 'sendgrid' || process.env.SENDGRID_API_KEY) return httpTransport('sendgrid');
  if (provider === 'webhook' || process.env.MAIL_WEBHOOK_URL) return httpTransport('webhook');
  return smtpTransport;
}

const memoryTransport: MailTransport = {
  async send(message) {
    memoryInbox.push(message);
  },
};

const logTransport: MailTransport = {
  async send(message) {
    memoryInbox.push(message);
    console.info(`[mail] to=${message.to} subject=${message.subject}`);
  },
};

const smtpTransport: MailTransport = {
  async send(message) {
    const host = process.env.SMTP_HOST;
    const url = process.env.SMTP_URL;
    if (!host && !url) {
      console.error('[mail] production delivery skipped: SMTP_HOST or SMTP_URL is not configured');
      throw new Error('MAIL_NOT_CONFIGURED');
    }
    const nodemailer = await import('nodemailer');
    const transporter = url
      ? nodemailer.createTransport(url)
      : nodemailer.createTransport({
          host,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth:
            process.env.SMTP_USER && process.env.SMTP_PASS
              ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
              : undefined,
        });
    await transporter.sendMail({
      from: mailFrom(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  },
};

function httpTransport(kind: 'resend' | 'sendgrid' | 'webhook'): MailTransport {
  return {
    async send(message) {
      if (kind === 'resend') {
        const key = process.env.RESEND_API_KEY ?? process.env.MAIL_API_KEY;
        if (!key) throw new Error('MAIL_NOT_CONFIGURED');
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: mailFrom(),
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
        });
        if (!res.ok) throw new Error(`MAIL_PROVIDER_ERROR ${res.status}`);
        return;
      }
      if (kind === 'sendgrid') {
        const key = process.env.SENDGRID_API_KEY ?? process.env.MAIL_API_KEY;
        if (!key) throw new Error('MAIL_NOT_CONFIGURED');
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: message.to }] }],
            from: parseFrom(mailFrom()),
            subject: message.subject,
            content: [
              { type: 'text/plain', value: message.text },
              ...(message.html ? [{ type: 'text/html', value: message.html }] : []),
            ],
          }),
        });
        if (!res.ok) throw new Error(`MAIL_PROVIDER_ERROR ${res.status}`);
        return;
      }
      const hook = process.env.MAIL_WEBHOOK_URL;
      if (!hook) throw new Error('MAIL_NOT_CONFIGURED');
      const res = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(process.env.MAIL_API_KEY ? { Authorization: `Bearer ${process.env.MAIL_API_KEY}` } : {}) },
        body: JSON.stringify({ from: mailFrom(), ...message }),
      });
      if (!res.ok) throw new Error(`MAIL_PROVIDER_ERROR ${res.status}`);
    },
  };
}

function parseFrom(raw: string) {
  const match = raw.match(/^(.*)<([^>]+)>$/);
  if (!match) return { email: raw };
  return { name: match[1]!.trim(), email: match[2]!.trim() };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
}
