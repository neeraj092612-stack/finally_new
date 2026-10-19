import type { ConnectionStatus as Status } from "@/hooks/usePriceStream";
import { formatMoney, formatSignedMoney, signClass } from "@/lib/format";

const STARTING_VALUE = 10000;

const STATUS_LABEL: Record<Status, string> = {
  connected: "Live",
  reconnecting: "Reconnecting",
  disconnected: "Disconnected",
};

export function ConnectionStatus({ status }: { status: Status }) {
  return (
    <div className="flex items-center gap-2" title={`Price stream: ${STATUS_LABEL[status]}`}>
      <span
        data-testid="connection-status"
        data-status={status}
        className="status-dot"
        role="status"
        aria-label={`Price stream ${STATUS_LABEL[status]}`}
      />
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
        {STATUS_LABEL[status]}
      </span>
    </div>
  );
}

interface HeaderProps {
  totalValue: number | null;
  cash: number | null;
  status: Status;
}

export default function Header({ totalValue, cash, status }: HeaderProps) {
  const pnl = totalValue == null ? null : totalValue - STARTING_VALUE;
  return (
    <header className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-line bg-panel px-4 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold tracking-tight">
          Fin<span className="text-accent">Ally</span>
        </span>
        <span className="hidden text-[10px] uppercase tracking-[0.18em] text-faint sm:inline">
          AI Trading Workstation
        </span>
      </div>

      <div className="ml-auto flex items-center gap-8">
        <Stat label="Portfolio">
          <span data-testid="header-total-value" className="num text-lg font-semibold text-text">
            {formatMoney(totalValue)}
          </span>
          {pnl != null && (
            <span className={`num ml-2 text-xs ${signClass(Math.round(pnl * 100))}`}>
              {formatSignedMoney(pnl)}
            </span>
          )}
        </Stat>
        <Stat label="Cash">
          <span data-testid="header-cash" className="num text-lg font-semibold text-accent">
            {formatMoney(cash)}
          </span>
        </Stat>
        <ConnectionStatus status={status} />
      </div>
    </header>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className="flex items-baseline">{children}</span>
    </div>
  );
}
