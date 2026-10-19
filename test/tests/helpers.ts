import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const DEFAULT_TICKERS = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'V', 'NFLX'];

export interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
}

export interface Portfolio {
  cash_balance: number;
  positions_value: number;
  total_value: number;
  unrealized_pnl: number;
  positions: Position[];
}

/** Parses "$10,000.00" / "-$1,234.5" style text into a number. */
export function parseMoney(text: string | null): number {
  const cleaned = (text ?? '').replace(/[^0-9.\-]/g, '');
  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) throw new Error(`Not a money value: ${JSON.stringify(text)}`);
  return value;
}

export async function getPortfolio(request: APIRequestContext): Promise<Portfolio> {
  const res = await request.get('/api/portfolio');
  expect(res.status(), await res.text()).toBe(200);
  return res.json();
}

export function positionQty(portfolio: Portfolio, ticker: string): number {
  return portfolio.positions.find((p) => p.ticker === ticker)?.quantity ?? 0;
}

/** Adds a ticker via the API and waits until the cache has a price for it. */
export async function watch(request: APIRequestContext, ticker: string): Promise<void> {
  const res = await request.post('/api/watchlist', { data: { ticker } });
  expect([200, 201], await res.text()).toContain(res.status());
  await expect
    .poll(async () => {
      const wl = await (await request.get('/api/watchlist')).json();
      return wl.watchlist.find((e: { ticker: string }) => e.ticker === ticker)?.price ?? null;
    }, { message: `price for ${ticker}`, timeout: 20_000 })
    .not.toBeNull();
}

export async function trade(
  request: APIRequestContext,
  ticker: string,
  side: 'buy' | 'sell',
  quantity: number,
): Promise<{ trade: { price: number }; portfolio: Portfolio }> {
  const res = await request.post('/api/portfolio/trade', { data: { ticker, side, quantity } });
  expect(res.status(), await res.text()).toBe(200);
  return res.json();
}

/** Sells any open position in `ticker` and removes it from the watchlist (best-effort cleanup). */
export async function closeAndUnwatch(request: APIRequestContext, ticker: string): Promise<void> {
  const qty = positionQty(await getPortfolio(request), ticker);
  if (qty > 0) await trade(request, ticker, 'sell', qty);
  await request.delete(`/api/watchlist/${ticker}`);
}

/** Opens the app and waits until the price stream is connected and prices have rendered. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-status', 'connected', { timeout: 20_000 });
  await expect(page.getByTestId('watchlist-price-AAPL')).toHaveText(/\d/, { timeout: 20_000 });
}

/** Like openApp, but also waits for the chat history (GET /api/chat) to be loaded and rendered. */
export async function openAppWithChat(page: Page): Promise<void> {
  const history = page.waitForResponse(
    (r) => r.request().method() === 'GET' && new URL(r.url()).pathname.replace(/\/$/, '') === '/api/chat',
  );
  await openApp(page);
  const res = await history;
  expect(res.status()).toBe(200);
  const { messages } = await res.json();
  await expect(page.getByTestId('chat-message')).toHaveCount(messages.length);
}

export async function headerCash(page: Page): Promise<number> {
  return parseMoney(await page.getByTestId('header-cash').textContent());
}

export async function expectHeaderCash(page: Page, expected: number): Promise<void> {
  await expect.poll(() => headerCash(page)).toBeCloseTo(expected, 2);
}

/** Fills the trade bar and clicks buy or sell. */
export async function tradeViaUi(page: Page, ticker: string, side: 'buy' | 'sell', quantity: number): Promise<void> {
  await page.getByTestId('trade-ticker-input').fill(ticker);
  await page.getByTestId('trade-quantity-input').fill(String(quantity));
  await page.getByTestId(side === 'buy' ? 'trade-buy-button' : 'trade-sell-button').click();
}
