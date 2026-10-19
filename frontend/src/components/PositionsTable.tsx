import { formatMoney, formatPercent, formatPrice, formatSignedMoney, signClass } from "@/lib/format";
import type { Position } from "@/lib/types";

interface PositionsTableProps {
  positions: Position[];
  onSelect?: (ticker: string) => void;
}

export default function PositionsTable({ positions, onSelect }: PositionsTableProps) {
  return (
    <section className="panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="panel-title">Positions</h2>
        <span className="num text-[10px] text-faint">{positions.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table data-testid="positions-table" className="w-full text-xs">
          <thead className="sticky top-0 bg-panel text-[10px] uppercase tracking-wider text-faint">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Ticker</th>
              <th className="px-2 py-1.5 text-right font-medium">Qty</th>
              <th className="px-2 py-1.5 text-right font-medium">Avg Cost</th>
              <th className="px-2 py-1.5 text-right font-medium">Price</th>
              <th className="px-2 py-1.5 text-right font-medium">Mkt Value</th>
              <th className="px-2 py-1.5 text-right font-medium">Unrl P&amp;L</th>
              <th className="px-3 py-1.5 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr
                key={p.ticker}
                data-testid={`position-row-${p.ticker}`}
                data-quantity={p.quantity}
                onClick={() => onSelect?.(p.ticker)}
                className="num cursor-pointer border-t border-line/60 hover:bg-panel-2"
              >
                <td className="px-3 py-1.5 text-left font-semibold text-text">{p.ticker}</td>
                <td className="px-2 py-1.5 text-right">{p.quantity}</td>
                <td className="px-2 py-1.5 text-right text-muted">{formatPrice(p.avg_cost)}</td>
                <td className="px-2 py-1.5 text-right">{formatPrice(p.current_price)}</td>
                <td className="px-2 py-1.5 text-right">{formatMoney(p.market_value)}</td>
                <td className={`px-2 py-1.5 text-right ${signClass(p.unrealized_pnl)}`}>
                  {formatSignedMoney(p.unrealized_pnl)}
                </td>
                <td className={`px-3 py-1.5 text-right ${signClass(p.unrealized_pnl_percent)}`}>
                  {formatPercent(p.unrealized_pnl_percent)}
                </td>
              </tr>
            ))}
            {positions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-faint">
                  No open positions. Use the trade bar or ask the assistant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
