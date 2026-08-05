"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronsUpDown, Check, Plus, Loader2 } from "lucide-react";
import { cn } from "@rach/ui/lib/utils";
import { deployment, type ServiceGroup } from "@rach/ui/lib/api";

const PRESET_COLORS = ["#477EF7", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#64748B"];

/**
 * Phase 2 · WS6 — assign a service to a group (or create one inline).
 */
export function GroupSelector({
  serviceId,
  currentGroupId,
  token,
  onChange,
}: {
  serviceId: number;
  currentGroupId: number | null | undefined;
  token: string;
  onChange?: (groupId: number | null) => void;
}) {
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const load = useCallback(() => {
    deployment.listGroups(token).then((d) => setGroups(d.groups)).catch(() => {});
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const current = groups.find((g) => g.id === currentGroupId) || null;

  async function assign(groupId: number | null) {
    setBusy(true);
    try {
      await deployment.setServiceGroup(token, serviceId, groupId);
      onChange?.(groupId);
      setOpen(false);
    } finally { setBusy(false); }
  }

  async function createAndAssign() {
    if (busy) return;
    setBusy(true);
    try {
      // Name is optional — the server auto-names it "Group N" when blank.
      const { group } = await deployment.createGroup(token, newName.trim(), newColor);
      await deployment.setServiceGroup(token, serviceId, group.id);
      setGroups((g) => [...g, group]);
      onChange?.(group.id);
      setCreating(false);
      setNewName("");
      setOpen(false);
    } finally { setBusy(false); }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-2.5 py-1.5 text-sm hover:bg-bg-secondary"
      >
        {current ? (
          <>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: current.color }} />
            <span className="text-text-primary">{current.name}</span>
          </>
        ) : (
          <span className="text-text-muted">No group</span>
        )}
        {busy ? <Loader2 size={13} className="animate-spin text-text-muted" /> : <ChevronsUpDown size={13} className="text-text-muted" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-lg border border-neutral-border bg-surface-card py-1 shadow-lg">
            <button onClick={() => assign(null)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-muted hover:bg-bg-secondary">
              <span className="h-2.5 w-2.5 rounded-full border border-neutral-border" />
              No group
              {!currentGroupId && <Check size={14} className="ml-auto text-primary-blue" />}
            </button>
            {groups.map((g) => (
              <button key={g.id} onClick={() => assign(g.id)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
                <span className="flex-1 truncate text-left">{g.name}</span>
                {currentGroupId === g.id && <Check size={14} className="text-primary-blue" />}
              </button>
            ))}

            <div className="border-t border-neutral-border pt-1">
              {creating ? (
                <div className="px-3 py-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createAndAssign()}
                    placeholder="Group name (optional)"
                    className="mb-2 w-full rounded-md border border-neutral-border px-2 py-1.5 text-sm outline-none focus:border-primary-blue"
                  />
                  <div className="mb-2 flex items-center gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button key={c} onClick={() => setNewColor(c)}
                        className={cn("h-5 w-5 rounded-full", newColor === c && "ring-2 ring-offset-1 ring-primary-blue")}
                        style={{ background: c }} />
                    ))}
                  </div>
                  <button onClick={createAndAssign} disabled={busy}
                    className="w-full rounded-md bg-primary-blue py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                    {newName.trim() ? "Create & assign" : "Create unnamed & assign"}
                  </button>
                </div>
              ) : (
                <button onClick={() => setCreating(true)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-muted hover:bg-bg-secondary">
                  <Plus size={14} /> New group
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
