import { expect, test } from '@playwright/test';
import { DEFAULT_TICKERS, getPortfolio, openApp, parseMoney } from './helpers';

// Runs first (file-name order, one worker) and requires a freshly seeded database.
test.describe('fresh start', () => {
  test('shows the default watchlist, $10,000 cash and a connected stream', async ({ page, request }) => {
    const portfolio = await getPortfolio(request);
    expect(portfolio.cash_balance, 'this spec needs a fresh database').toBe(10000);
    expect(portfolio.positions).toEqual([]);

    await openApp(page);

    await expect(page.getByTestId('connection-status')).toHaveAttribute('data-status', 'connected');
    await expect(page.getByTestId('header-cash')).toHaveText('$10,000.00');
    // Total value equals cash while nothing is held.
    await expect(page.getByTestId('header-total-value')).toHaveText('$10,000.00');

    const watchlist = page.getByTestId('watchlist');
    await expect(watchlist).toBeVisible();
    for (const ticker of DEFAULT_TICKERS) {
      await expect(page.getByTestId(`watchlist-row-${ticker}`)).toBeVisible();
      await expect(page.getByTestId(`watchlist-price-${ticker}`)).toHaveText(/\d/);
    }
    await expect(watchlist.locator('[data-testid^="watchlist-row-"]')).toHaveCount(DEFAULT_TICKERS.length);

    await expect(page.getByTestId('positions-table')).toBeVisible();
    await expect(page.locator('[data-testid^="position-row-"]')).toHaveCount(0);
    await expect(page.getByTestId('chat-panel')).toBeVisible();
  });

  test('prices stream and flash on change', async ({ page }) => {
    await openApp(page);

    // Snapshot every displayed price, then wait until at least one has changed.
    const readPrices = () =>
      Promise.all(DEFAULT_TICKERS.map((t) => page.getByTestId(`watchlist-price-${t}`).textContent()));
    const initial = await readPrices();
    await expect
      .poll(async () => (await readPrices()).some((p, i) => p !== initial[i]), { timeout: 15_000 })
      .toBe(true);

    // Some price cell receives a flash class at some point while streaming.
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            document.querySelectorAll('[data-testid^="watchlist-price-"].flash-up, [data-testid^="watchlist-price-"].flash-down').length,
          ),
        { timeout: 15_000, intervals: [100] },
      )
      .toBeGreaterThan(0);

    // Header total value is a money value while streaming.
    expect(parseMoney(await page.getByTestId('header-total-value').textContent())).toBeGreaterThan(0);
  });

  test('clicking a watchlist row selects it in the main chart', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('watchlist-row-MSFT').click();
    await expect(page.getByTestId('main-chart')).toHaveAttribute('data-ticker', 'MSFT');
    await page.getByTestId('watchlist-row-NVDA').click();
    await expect(page.getByTestId('main-chart')).toHaveAttribute('data-ticker', 'NVDA');
  });
});
