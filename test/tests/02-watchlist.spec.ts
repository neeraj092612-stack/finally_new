import { expect, test } from '@playwright/test';
import { closeAndUnwatch, openApp, trade, watch } from './helpers';

test.describe('watchlist', () => {
  test('add and remove a ticker', async ({ page, request }) => {
    const ticker = 'PYPL';
    await request.delete(`/api/watchlist/${ticker}`); // in case a previous run left it behind
    await openApp(page);
    await expect(page.getByTestId(`watchlist-row-${ticker}`)).toHaveCount(0);

    // Input is lower-case and padded: the backend normalizes it.
    await page.getByTestId('watchlist-add-input').fill(' pypl ');
    await page.getByTestId('watchlist-add-button').click();

    await expect(page.getByTestId(`watchlist-row-${ticker}`)).toBeVisible();
    await expect(page.getByTestId(`watchlist-price-${ticker}`)).toHaveText(/\d/, { timeout: 20_000 });

    const wl = await (await request.get('/api/watchlist')).json();
    expect(wl.watchlist.map((e: { ticker: string }) => e.ticker)).toContain(ticker);

    // Survives a reload (persisted).
    await page.reload();
    await expect(page.getByTestId(`watchlist-row-${ticker}`)).toBeVisible();

    await page.getByTestId(`watchlist-remove-${ticker}`).click();
    await expect(page.getByTestId(`watchlist-row-${ticker}`)).toHaveCount(0);

    const after = await (await request.get('/api/watchlist')).json();
    expect(after.watchlist.map((e: { ticker: string }) => e.ticker)).not.toContain(ticker);
  });

  test('removing a ticker with an open position shows an inline error', async ({ page, request }) => {
    const ticker = 'ZPOS';
    await watch(request, ticker);
    await trade(request, ticker, 'buy', 1);
    try {
      await openApp(page);
      await expect(page.getByTestId(`watchlist-row-${ticker}`)).toBeVisible();

      await page.getByTestId(`watchlist-remove-${ticker}`).click();

      const error = page.getByTestId('watchlist-error');
      await expect(error).toBeVisible();
      await expect(error).not.toHaveText('');
      // Row stays: the removal was rejected.
      await expect(page.getByTestId(`watchlist-row-${ticker}`)).toBeVisible();
      const wl = await (await request.get('/api/watchlist')).json();
      expect(wl.watchlist.map((e: { ticker: string }) => e.ticker)).toContain(ticker);
    } finally {
      await closeAndUnwatch(request, ticker);
    }
  });
});
