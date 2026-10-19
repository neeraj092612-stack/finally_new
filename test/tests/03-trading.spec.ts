import { expect, test } from '@playwright/test';
import {
  closeAndUnwatch,
  expectHeaderCash,
  getPortfolio,
  headerCash,
  openApp,
  positionQty,
  trade,
  tradeViaUi,
  watch,
} from './helpers';

test.describe('trading', () => {
  test('buy shares: cash decreases, position and heatmap cell appear', async ({ page, request }) => {
    const ticker = 'ZBUY';
    await watch(request, ticker);
    try {
      await openApp(page);
      const before = await getPortfolio(request);
      expect(positionQty(before, ticker)).toBe(0);
      await expectHeaderCash(page, before.cash_balance);

      await tradeViaUi(page, ticker, 'buy', 3);

      const row = page.getByTestId(`position-row-${ticker}`);
      await expect(row).toBeVisible();
      await expect(row).toHaveAttribute('data-quantity', '3');
      await expect(page.getByTestId(`heatmap-cell-${ticker}`)).toBeVisible();
      await expect(page.getByTestId('trade-error')).toBeHidden();

      const after = await getPortfolio(request);
      expect(positionQty(after, ticker)).toBe(3);
      const pos = after.positions.find((p) => p.ticker === ticker)!;
      expect(after.cash_balance).toBeCloseTo(before.cash_balance - 3 * pos.avg_cost, 2);
      expect(after.cash_balance).toBeLessThan(before.cash_balance);
      await expectHeaderCash(page, after.cash_balance);
    } finally {
      await closeAndUnwatch(request, ticker);
    }
  });

  test('sell shares: cash increases, position updates then disappears', async ({ page, request }) => {
    const ticker = 'ZSEL';
    await watch(request, ticker);
    await trade(request, ticker, 'buy', 5);
    try {
      await openApp(page);
      const row = page.getByTestId(`position-row-${ticker}`);
      await expect(row).toHaveAttribute('data-quantity', '5');
      const cash0 = (await getPortfolio(request)).cash_balance;
      await expectHeaderCash(page, cash0);

      // Partial sell.
      await tradeViaUi(page, ticker, 'sell', 2);
      await expect(row).toHaveAttribute('data-quantity', '3');
      const cash1 = (await getPortfolio(request)).cash_balance;
      expect(cash1).toBeGreaterThan(cash0);
      await expectHeaderCash(page, cash1);

      // Full sell removes the position row and its heatmap cell.
      await tradeViaUi(page, ticker, 'sell', 3);
      await expect(row).toHaveCount(0);
      await expect(page.getByTestId(`heatmap-cell-${ticker}`)).toHaveCount(0);
      const after = await getPortfolio(request);
      expect(positionQty(after, ticker)).toBe(0);
      expect(after.cash_balance).toBeGreaterThan(cash1);
      await expectHeaderCash(page, after.cash_balance);
    } finally {
      await closeAndUnwatch(request, ticker);
    }
  });

  test('buying with insufficient cash shows an inline error and changes nothing', async ({ page, request }) => {
    await openApp(page);
    const before = await getPortfolio(request);

    await tradeViaUi(page, 'AAPL', 'buy', 1_000_000);

    const error = page.getByTestId('trade-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/\$/); // e.g. "Need $191,240,000.00 but only $9,000.00 is available."

    const after = await getPortfolio(request);
    expect(after.cash_balance).toBe(before.cash_balance);
    expect(positionQty(after, 'AAPL')).toBe(positionQty(before, 'AAPL'));
    expect(await headerCash(page)).toBeCloseTo(before.cash_balance, 2);
  });

  test('selling more than held shows an inline error', async ({ page, request }) => {
    await openApp(page);
    const before = await getPortfolio(request);
    const held = positionQty(before, 'JPM');

    await tradeViaUi(page, 'JPM', 'sell', held + 1);

    await expect(page.getByTestId('trade-error')).toBeVisible();
    await expect(page.getByTestId('trade-error')).not.toHaveText('');
    expect((await getPortfolio(request)).cash_balance).toBe(before.cash_balance);
  });
});
