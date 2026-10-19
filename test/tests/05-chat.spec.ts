import { expect, test } from '@playwright/test';
import { getPortfolio, openAppWithChat, positionQty } from './helpers';

// Requires the backend to run with LLM_MOCK=true (TEAM_CONTRACT §5).
test.describe('AI chat (mocked)', () => {
  test('buy via chat executes the trade inline and history persists across reload', async ({ page, request }) => {
    const before = positionQty(await getPortfolio(request), 'AAPL');
    await openAppWithChat(page);
    const failed = page.locator('[data-testid="chat-action"][data-status="failed"]');
    const failedBefore = await failed.count();

    const prompt = 'buy 2 shares of AAPL';
    await page.getByTestId('chat-input').fill(prompt);
    await page.getByTestId('chat-send-button').click();

    const assistant = page.locator('[data-testid="chat-message"][data-role="assistant"]', {
      hasText: '[mock] Buying 2 shares of AAPL.',
    });
    await expect(assistant.last()).toBeVisible();
    await expect(page.getByTestId('chat-loading')).toBeHidden();
    await expect(
      page.locator('[data-testid="chat-message"][data-role="user"]', { hasText: prompt }).last(),
    ).toBeVisible();

    // The buy (and the idempotent watchlist add) are rendered as executed actions.
    const lastAssistant = assistant.last();
    const actions = page.getByTestId('chat-action');
    await expect(actions.filter({ hasText: /AAPL/ }).first()).toBeVisible();
    await expect(failed).toHaveCount(failedBefore);
    await expect(page.locator('[data-testid="chat-action"][data-status="executed"]').first()).toBeVisible();

    // The trade went through and the UI refreshed.
    expect(positionQty(await getPortfolio(request), 'AAPL')).toBe(before + 2);
    await expect(page.getByTestId('position-row-AAPL')).toHaveAttribute('data-quantity', String(before + 2));
    await expect(page.getByTestId('heatmap-cell-AAPL')).toBeVisible();

    // History is loaded from GET /api/chat after a reload.
    const userCount = await page.locator('[data-testid="chat-message"][data-role="user"]').count();
    const reloadedHistory = page.waitForResponse(
      (r) => r.request().method() === 'GET' && new URL(r.url()).pathname.replace(/\/$/, '') === '/api/chat',
    );
    await page.reload();
    await reloadedHistory;
    await expect(lastAssistant).toBeVisible();
    await expect(page.locator('[data-testid="chat-message"][data-role="user"]')).toHaveCount(userCount);
    await expect(
      page.locator('[data-testid="chat-action"][data-status="executed"]').filter({ hasText: /AAPL/ }).first(),
    ).toBeVisible();
  });

  test('a failed chat action is shown inline as failed', async ({ page, request }) => {
    const held = positionQty(await getPortfolio(request), 'META');
    await openAppWithChat(page);
    const failedBefore = await page.locator('[data-testid="chat-action"][data-status="failed"]').count();
    // Earlier runs against the same DB may already show this reply; count instead of matching one element.
    const replies = page.locator('[data-testid="chat-message"][data-role="assistant"]', {
      hasText: `[mock] Selling ${held + 5} shares of META.`,
    });
    const repliesBefore = await replies.count();

    await page.getByTestId('chat-input').fill(`sell ${held + 5} shares of META`);
    await page.getByTestId('chat-send-button').click();

    await expect(replies).toHaveCount(repliesBefore + 1);
    await expect(page.locator('[data-testid="chat-action"][data-status="failed"]')).toHaveCount(failedBefore + 1);
    expect(positionQty(await getPortfolio(request), 'META')).toBe(held);
  });

  test('a plain question gets the portfolio summary', async ({ page }) => {
    await openAppWithChat(page);
    const summaries = page
      .locator('[data-testid="chat-message"][data-role="assistant"]')
      .filter({ hasText: /\[mock\] Your portfolio is worth \$[\d,]+\.\d{2} with \$[\d,]+\.\d{2} in cash\./ });
    const before = await summaries.count();
    await page.getByTestId('chat-input').fill('how am I doing?');
    await page.getByTestId('chat-send-button').click();
    await expect(summaries).toHaveCount(before + 1);
  });
});
