import { expect, test, type APIResponse } from '@playwright/test';
import { closeAndUnwatch, getPortfolio, trade, watch } from './helpers';

async function expectError(res: APIResponse, status: number, code: string): Promise<void> {
  const text = await res.text();
  expect(res.status(), text).toBe(status);
  const body = JSON.parse(text);
  expect(Object.keys(body)).toEqual(['error']);
  expect(body.error.code).toBe(code);
  expect(typeof body.error.message).toBe('string');
  expect(body.error.message.length).toBeGreaterThan(0);
}

test.describe('API contract', () => {
  test('health check', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  test('portfolio, history and watchlist shapes', async ({ request }) => {
    const p = await getPortfolio(request);
    expect(p.total_value).toBeCloseTo(p.cash_balance + p.positions_value, 2);
    expect(Array.isArray(p.positions)).toBe(true);

    const h = await (await request.get('/api/portfolio/history')).json();
    expect(h.snapshots.length).toBeGreaterThanOrEqual(1);
    expect(h.snapshots[0]).toEqual({ total_value: expect.any(Number), recorded_at: expect.stringMatching(/Z$/) });

    const w = await (await request.get('/api/watchlist')).json();
    expect(w.watchlist.length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(w.watchlist[0]).sort()).toEqual(
      ['added_at', 'day_change_percent', 'direction', 'previous_price', 'price', 'ticker'].sort(),
    );
  });

  test('watchlist add is idempotent and normalizes tickers', async ({ request }) => {
    const ticker = 'ZIDM';
    await request.delete(`/api/watchlist/${ticker}`);
    try {
      const first = await request.post('/api/watchlist', { data: { ticker: ' zidm ' } });
      expect(first.status()).toBe(201);
      expect((await first.json()).ticker).toBe(ticker);
      const second = await request.post('/api/watchlist', { data: { ticker } });
      expect(second.status()).toBe(200);
      expect((await second.json()).ticker).toBe(ticker);
    } finally {
      await request.delete(`/api/watchlist/${ticker}`);
    }
    const del = await request.delete(`/api/watchlist/${ticker}`);
    await expectError(del, 404, 'not_watched');
  });

  test('remove with open position returns 409 position_open', async ({ request }) => {
    const ticker = 'ZAPI';
    await watch(request, ticker);
    await trade(request, ticker, 'buy', 1);
    try {
      await expectError(await request.delete(`/api/watchlist/${ticker}`), 409, 'position_open');
    } finally {
      await closeAndUnwatch(request, ticker);
    }
    const w = await (await request.get('/api/watchlist')).json();
    expect(w.watchlist.map((e: { ticker: string }) => e.ticker)).not.toContain(ticker);
  });

  test('trade validation errors', async ({ request }) => {
    const post = (data: unknown) => request.post('/api/portfolio/trade', { data });

    for (const bad of [
      { ticker: 'AAPL', side: 'buy', quantity: 0 },
      { ticker: 'AAPL', side: 'buy', quantity: -3 },
      { ticker: 'AAPL', side: 'buy', quantity: 1.5 },
      { ticker: 'AAPL', side: 'buy', quantity: '2x' },
      { ticker: 'AAPL', side: 'hold', quantity: 1 },
      { ticker: 'AAPL', side: 'buy' },
      {},
    ]) {
      await test.step(`invalid_request: ${JSON.stringify(bad)}`, async () => {
        await expectError(await post(bad), 422, 'invalid_request');
      });
    }

    await expectError(await post({ ticker: '1BAD', side: 'buy', quantity: 1 }), 400, 'invalid_ticker');
    await expectError(await post({ ticker: 'ABCDEFGHIJK', side: 'buy', quantity: 1 }), 400, 'invalid_ticker');
    await expectError(await post({ ticker: 'ZNOWATCH', side: 'buy', quantity: 1 }), 400, 'ticker_not_watched');
    await expectError(await post({ ticker: 'AAPL', side: 'buy', quantity: 10_000_000 }), 400, 'insufficient_cash');

    const held = (await getPortfolio(request)).positions.find((p) => p.ticker === 'V')?.quantity ?? 0;
    await expectError(await post({ ticker: 'V', side: 'sell', quantity: held + 1 }), 400, 'insufficient_shares');
  });

  test('trade response carries the trade and the updated portfolio', async ({ request }) => {
    const res = await request.post('/api/portfolio/trade', { data: { ticker: 'msft', side: 'buy', quantity: 1 } });
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    expect(body.trade).toMatchObject({ ticker: 'MSFT', side: 'buy', quantity: 1, price: expect.any(Number) });
    expect(body.trade.executed_at).toMatch(/Z$/);
    expect(body.portfolio.positions.some((p: { ticker: string }) => p.ticker === 'MSFT')).toBe(true);
    await trade(request, 'MSFT', 'sell', 1);
  });

  test('watchlist validation errors', async ({ request }) => {
    await expectError(await request.post('/api/watchlist', { data: { ticker: 'not a ticker' } }), 400, 'invalid_ticker');
    await expectError(await request.post('/api/watchlist', { data: {} }), 422, 'invalid_request');
    await expectError(await request.delete('/api/watchlist/ZZNOTHERE'), 404, 'not_watched');
  });

  test('chat validation and history shape', async ({ request }) => {
    await expectError(await request.post('/api/chat', { data: { message: '' } }), 422, 'invalid_request');
    await expectError(await request.post('/api/chat', { data: {} }), 422, 'invalid_request');

    const res = await request.post('/api/chat', { data: { message: 'add ZCHT' } });
    expect(res.status(), await res.text()).toBe(200);
    const { message } = await res.json();
    expect(message).toMatchObject({
      role: 'assistant',
      content: '[mock] Adding ZCHT to your watchlist.',
      actions: { trades: [], watchlist_changes: [{ ticker: 'ZCHT', action: 'add', status: 'executed', error: null }] },
    });
    await request.delete('/api/watchlist/ZCHT');

    const history = await (await request.get('/api/chat')).json();
    const last = history.messages.at(-1);
    expect(last.id).toBe(message.id);
    const prev = history.messages.at(-2);
    expect(prev).toMatchObject({ role: 'user', content: 'add ZCHT', actions: null });
  });
});
