import { cn } from "@rach/ui/lib/utils";

type Status = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusIndicatorProps {
  status: Status;
  label: string;
  size?: "sm" | "md";
}

const statusStyles: Record<Status, { dot: string; text: string }> = {
  success: { dot: "bg-status-success", text: "text-status-success" },
  warning: { dot: "bg-status-warning", text: "text-status-warning" },
  danger: { dot: "bg-status-danger", text: "text-status-danger" },
  info: { dot: "bg-status-info", text: "text-status-info" },
  neutral: { dot: "bg-status-neutral", text: "text-status-neutral" },
};

export function StatusIndicator({ status, label, size = "md" }: StatusIndicatorProps) {
  const styles = statusStyles[status];

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "rounded-full shrink-0",
          styles.dot,
          size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2"
        )}
      />
      <span
        className={cn(
          "font-medium",
          styles.text,
          size === "sm" ? "text-xs" : "text-sm"
        )}
      >
        {label}
      </span>
    </span>
  );
}

export function StatusBadge({ status, label }: { status: Status; label: string }) {
  const bgMap: Record<Status, string> = {
    success: "bg-status-success-bg text-status-success",
    warning: "bg-status-warning-bg text-status-warning",
    danger: "bg-status-danger-bg text-status-danger",
    info: "bg-status-info-bg text-status-info",
    neutral: "bg-status-neutral-bg text-status-neutral",
  };

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", bgMap[status])}>
      {label}
    </span>
  );
}
