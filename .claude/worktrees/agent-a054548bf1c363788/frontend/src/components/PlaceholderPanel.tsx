import type { ReactNode } from "react";
import { Panel } from "./Panel";

interface PlaceholderPanelProps {
  title: string;
  ariaLabel: string;
  heading: string;
  body: string;
  /** Rendered above the empty state (for example the POSITIONS column header row). */
  header?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Hide the body below the desktop breakpoint (collapsed chat on tablet, D-04). */
  collapsedBelowDesk?: boolean;
}

/** Titled empty-state panel for deferred features (D-02). */
export function PlaceholderPanel({
  title,
  ariaLabel,
  heading,
  body,
  header,
  actions,
  className,
  collapsedBelowDesk = false,
}: PlaceholderPanelProps) {
  return (
    <Panel
      title={title}
      ariaLabel={ariaLabel}
      actions={actions}
      className={className}
      bodyClassName={collapsedBelowDesk ? "hidden flex-col desk:flex" : "flex flex-col"}
    >
      {header}
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="max-w-[240px] text-center">
          <h3 className="text-heading font-semibold text-muted">{heading}</h3>
          <p className="text-body text-muted">{body}</p>
        </div>
      </div>
    </Panel>
  );
}
