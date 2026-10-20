import type { ConnectionState } from "@/lib/types";

interface ConnectionIndicatorProps {
  connection: ConnectionState;
  hasOpened: boolean;
}

interface Presentation {
  dot: string;
  label: string;
  title: string;
}

function present(connection: ConnectionState, hasOpened: boolean): Presentation {
  if (connection === "open") {
    return { dot: "bg-up", label: "LIVE", title: "Price stream connected" };
  }
  if (connection === "connecting") {
    return {
      dot: "bg-warn dot-pulse",
      label: hasOpened ? "RECONNECTING" : "CONNECTING",
      title: "Price stream reconnecting",
    };
  }
  return { dot: "bg-down", label: "OFFLINE", title: "Price stream disconnected. Retrying." };
}

/** Header dot plus label mapping EventSource state to LIVE / RECONNECTING / OFFLINE (D-19). */
export function ConnectionIndicator({ connection, hasOpened }: ConnectionIndicatorProps) {
  const { dot, label, title } = present(connection, hasOpened);
  return (
    <div
      role="status"
      aria-live="polite"
      title={title}
      className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted"
    >
      <span
        data-testid="connection-dot"
        aria-hidden="true"
        className={`inline-block h-2 w-2 rounded-full ${dot}`}
      />
      <span>{label}</span>
    </div>
  );
}
