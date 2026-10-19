import { expect, test, type Locator } from '@playwright/test';
import { closeAndUnwatch, openApp, trade, watch } from './helpers';

/** Returns the [r, g, b] the cell is painted with (CSS background, or SVG fill on it / its first shape). */
async function cellColor(cell: Locator): Promise<[number, number, number] | null> {
  return cell.evaluate((el) => {
    const parse = (c: string | null): [number, number, number] | null => {
      const m = c?.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?/);
      if (!m) return null;
      if (m[4] !== undefined && Number.parseFloat(m[4]) === 0) return null; // fully transparent
      return [Number(m[1]), Number(m[2]), Number(m[3])];
    };
    const candidates: Element[] = [el, ...Array.from(el.querySelectorAll('rect, path, div'))];
    for (const node of candidates) {
      const style = getComputedStyle(node);
      const color = parse(style.backgroundColor) ?? (node instanceof SVGElement ? parse(style.fill) : null);
      if (color) return color;
    }
    return null;
  });
}

test.describe('portfolio visualizations', () => {
  test('heatmap cells are coloured by P&L and the P&L chart has data points after a trade', async ({ page, request }) => {
    const tickers = ['ZHMA', 'ZHMB'];
    for (const t of tickers) {
      await watch(request, t);
      await trade(request, t, 'buy', 2);
    }
    try {
      await openApp(page);

      const heatmap = page.getByTestId('heatmap');
      await expect(heatmap).toBeVisible();
      for (const t of tickers) {
        const cell = page.getByTestId(`heatmap-cell-${t}`);
        await expect(cell).toBeVisible();
        await expect(cell).toHaveAttribute('data-pnl', /^(positive|negative|flat)$/);
      }

      // Wait for prices to move so cells show a non-flat P&L, then check the colour matches the sign.
      const cells = heatmap.locator('[data-testid^="heatmap-cell-"]');
      await expect
        .poll(async () => cells.evaluateAll((els) => els.filter((e) => e.getAttribute('data-pnl') !== 'flat').length), {
          timeout: 15_000,
        })
        .toBeGreaterThan(0);

      let checked = 0;
      for (const cell of await cells.all()) {
        // Read sign and colour back to back; re-read the sign so a tick in between does not cause a false failure.
        const sign = await cell.getAttribute('data-pnl');
        const rgb = await cellColor(cell);
        if (sign === 'flat' || sign !== (await cell.getAttribute('data-pnl'))) continue;
        expect(rgb, `heatmap cell colour (${sign})`).not.toBeNull();
        const [r, g] = rgb!;
        if (sign === 'positive') expect(g, `green > red for positive cell, got rgb(${rgb})`).toBeGreaterThan(r);
        else expect(r, `red > green for negative cell, got rgb(${rgb})`).toBeGreaterThan(g);
        checked++;
      }
      expect(checked).toBeGreaterThan(0);

      // Startup snapshot + one snapshot per trade, plus the live final point.
      const history = await (await request.get('/api/portfolio/history')).json();
      expect(history.snapshots.length).toBeGreaterThanOrEqual(2);
      const pnl = page.getByTestId('pnl-chart');
      await expect(pnl).toBeVisible();
      await expect
        .poll(async () => Number(await pnl.getAttribute('data-points')))
        .toBeGreaterThanOrEqual(2);
    } finally {
      for (const t of tickers) await closeAndUnwatch(request, t);
    }
  });
});
