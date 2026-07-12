import { cn } from '../../lib/utils';

const rows = [
  { id: 1, name: "Alice Johnson", email: "alice@acme.co", status: "Active" },
  { id: 2, name: "Bob Smith", email: "bob@startup.io", status: "Active" },
  { id: 3, name: "Carol Lee", email: "carol@corp.com", status: "Pending" },
  { id: 4, name: "David Kim", email: "david@dev.co", status: "Active" },
];

export function DashboardMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-[340px] overflow-hidden rounded-xl border border-neutral-border bg-white shadow-xl",
        className
      )}
    >
      {/* Window Chrome */}
      <div className="flex items-center gap-2 border-b border-neutral-border bg-bg-secondary px-4 py-3">
        <div className="h-3 w-3 rounded-full bg-red-400" />
        <div className="h-3 w-3 rounded-full bg-yellow-400" />
        <div className="h-3 w-3 rounded-full bg-green-400" />
        <span className="ml-3 text-xs font-medium text-text-muted">users_table</span>
      </div>

      {/* Table */}
      <div className="text-xs">
        {/* Header */}
        <div className="grid grid-cols-[40px_1fr_1fr_70px] gap-2 border-b border-neutral-border bg-bg-secondary px-4 py-2 font-semibold text-text-muted">
          <span>id</span>
          <span>name</span>
          <span>email</span>
          <span>status</span>
        </div>

        {/* Rows */}
        {rows.map((row, i) => (
          <div
            key={row.id}
            className={cn(
              "grid grid-cols-[40px_1fr_1fr_70px] gap-2 px-4 py-2.5 text-text-secondary",
              i % 2 === 1 && "bg-bg-secondary/50"
            )}
          >
            <span className="font-mono text-text-muted">{row.id}</span>
            <span className="truncate">{row.name}</span>
            <span className="truncate text-text-muted">{row.email}</span>
            <span
              className={cn(
                "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                row.status === "Active"
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              )}
            >
              {row.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
