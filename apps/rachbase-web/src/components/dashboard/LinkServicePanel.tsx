"use client";

import { useEffect, useState } from "react";
import { Link2, Loader2, Check, AlertCircle } from "lucide-react";
import { deployment, type DeploymentService } from "@rach/ui/lib/api";

/**
 * Phase 2 · WS7 — auto-CORS service linking.
 * Pick another service (e.g. your frontend) and its public origin(s) are added
 * to THIS service's CORS_ORIGINS, so the browser calls are allowed automatically.
 */
export function LinkServicePanel({ serviceId, token }: { serviceId: number; token: string }) {
  const [services, setServices] = useState<DeploymentService[]>([]);
  const [fromId, setFromId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    deployment.listServices(token)
      .then((d) => setServices(d.services.filter((s) => s.id !== serviceId)))
      .catch(() => {});
  }, [token, serviceId]);

  function label(s: DeploymentService) {
    return s.name || s.repo_full_name || `service-${s.id}`;
  }

  async function link() {
    if (!fromId || busy) return;
    setBusy(true); setError(null); setAdded(null);
    try {
      const r = await deployment.linkService(token, serviceId, Number(fromId));
      setAdded(r.added);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-neutral-border bg-surface-card p-5">
      <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
        <Link2 size={14} /> Link a service (auto-CORS)
      </p>
      <p className="mb-3 text-xs text-text-muted">
        Adds the selected service&apos;s domain to this service&apos;s <span className="font-mono">CORS_ORIGINS</span>.
      </p>
      <div className="flex items-center gap-2">
        <select
          value={fromId}
          onChange={(e) => setFromId(e.target.value)}
          className="flex-1 rounded-lg border border-neutral-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-primary-blue"
        >
          <option value="">Select a service…</option>
          {services.map((s) => <option key={s.id} value={s.id}>{label(s)}</option>)}
        </select>
        <button
          onClick={link}
          disabled={!fromId || busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Link
        </button>
      </div>

      {added && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <Check size={14} className="mt-0.5 shrink-0" />
          <span>Allowed <span className="font-mono">{added.join(", ")}</span>. Redeploy this service for it to take effect.</span>
        </div>
      )}
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
    </div>
  );
}
