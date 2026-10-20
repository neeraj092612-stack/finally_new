"use client";

import { usePriceStream } from "@/lib/priceStore";
import { ConnectionIndicator } from "./ConnectionIndicator";

/** 48px terminal header: wordmark on the left, connection dot right-aligned (UI-SPEC "Layout and Panels"). */
export function Header() {
  const { connection, hasOpened } = usePriceStream();

  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-6 border-b border-border bg-surface px-2">
      <span className="text-heading font-semibold text-text">
        Fin<span className="text-accent">Ally</span>
      </span>
      <span data-testid="total-value" className="text-muted">
        —
      </span>
      <span data-testid="cash-value" className="text-muted">
        —
      </span>
      <div className="ml-auto">
        <ConnectionIndicator connection={connection} hasOpened={hasOpened} />
      </div>
    </header>
  );
}
