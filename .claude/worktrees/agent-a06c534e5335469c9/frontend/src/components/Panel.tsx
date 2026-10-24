import type { ReactNode } from "react";

interface PanelProps {
  title: ReactNode;
  ariaLabel: string;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

/** Shared terminal panel chrome (D-03): 28px title bar, 1px border, square corners, no shadow. */
export function Panel({
  title,
  ariaLabel,
  actions,
  className = "",
  bodyClassName = "",
  children,
}: PanelProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={`flex min-h-0 min-w-0 flex-col border border-border bg-bg ${className}`}
    >
      <div className="flex h-7 shrink-0 items-center justify-between bg-surface px-2">
        <h2 className="text-label font-semibold uppercase tracking-[0.06em] text-muted">
          {title}
        </h2>
        {actions}
      </div>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
