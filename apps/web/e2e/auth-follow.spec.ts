import { expect, test } from '@playwright/test';
import { API, EMAIL, PASSWORD, apiJson, apiLogin, browserLogin } from './helpers';

test.describe('auth and following', () => {
  test('email password login and guest public nav', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /menu|open/i }).click().catch(() => undefined);
    await page.goto('/login');
    await browserLogin(page);
    await expect(page.locator('body')).toContainText(/home|matches|profile/i);
  });

  test('mobile password login after phone is saved', async ({ request, page }) => {
    const token = await apiLogin(request);
    const phone = `98${String(Date.now()).slice(-8)}`;
    const patch = await apiJson(request, 'PATCH', '/api/v1/users/me', token, { phone });
    expect(patch.status).toBeLessThan(300);
    await page.goto('/login');
    await page.getByRole('button', { name: /use password instead/i }).click();
    await page.getByLabel(/^email$/i).fill(phone);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: /log in|login/i }).click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('follow team and tournament, isolate by user', async ({ request, page }) => {
    const token = await apiLogin(request);
    const teams = await apiJson(request, 'GET', '/api/v1/teams', token);
    const tns = await apiJson(request, 'GET', '/api/v1/tournaments', token);
    const team = (teams.body as Array<{ id: string; name: string }>)[0];
    const tn = (tns.body as Array<{ id: string; name: string }>)[0];
    expect(team && tn).toBeTruthy();
    await apiJson(request, 'POST', '/api/v1/follows', token, { targetType: 'TEAM', targetId: team.id });
    await apiJson(request, 'POST', '/api/v1/follows', token, { targetType: 'TOURNAMENT', targetId: tn.id });
    const dup = await apiJson(request, 'POST', '/api/v1/follows', token, { targetType: 'TEAM', targetId: team.id });
    expect(dup.status).toBeLessThan(300);
    await browserLogin(page);
    await page.goto('/following');
    await expect(page.getByText(team.name, { exact: false })).toBeVisible();
    await expect(page.getByText(tn.name, { exact: false })).toBeVisible();
    await apiJson(request, 'DELETE', `/api/v1/follows?targetType=TEAM&targetId=${team.id}`, token);
    await page.reload();
    await expect(page.getByText(team.name, { exact: false })).toHaveCount(0);
    const other = await request.post(`${API}/api/v1/auth/register`, {
      data: { email: `e2e-${Date.now()}@example.com`, password: 'ChangeMe123!', name: 'E2E Other' },
    });
    const otherBody = await other.json();
    const otherToken = (otherBody.data ?? otherBody).accessToken as string;
    const list = await apiJson(request, 'GET', '/api/v1/users/me/following', otherToken);
    expect((list.body.teams ?? []).length).toBe(0);
  });

  test('forgot password issues a reset without enumerating accounts', async ({ request }) => {
    const known = await apiJson(request, 'POST', '/api/v1/auth/forgot-password', undefined, { email: EMAIL });
    const unknown = await apiJson(request, 'POST', '/api/v1/auth/forgot-password', undefined, { email: 'missing-e2e@example.com' });
    expect(known.body.sent).toBe(true);
    expect(unknown.body.sent).toBe(true);
    expect(unknown.body.devResetUrl).toBeFalsy();
  });
});
