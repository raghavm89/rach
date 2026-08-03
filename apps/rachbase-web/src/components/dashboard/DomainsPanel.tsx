"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe, Plus, Loader2, Trash2, Copy, Check, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@rach/ui/lib/utils";
import { deployment, type ServiceDomain } from "@rach/ui/lib/api";

/**
 * Phase 2 · WS4 — apex-friendly custom domains.
 * Shows copy-paste DNS records (A → ingress IP) and live DNS status, so a user
 * can point their apex `@` at RachBase with no registrar CNAME dead-ends.
 */
export function DomainsPanel({ serviceId, token }: { serviceId: number; token: string }) {
  const [domains, setDomains] = useState<ServiceDomain[]>([]);
  const [targetIp, setTargetIp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState("");
  const [sub, setSub] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    deployment
      .getDomains(token, serviceId)
      .then((d) => { setDomains(d.domains); setTargetIp(d.target_ip); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [token, serviceId]);

  useEffect(() => { load(); }, [load]);

  // Poll while anything is provisioning.
  useEffect(() => {
    if (!domains.some((d) => d.status === "provisioning")) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [domains, load]);

  async function addCustom() {
    if (!host.trim() || busy) return;
    setBusy(true); setError(null);
    try { await deployment.addDomain(token, serviceId, host.trim()); setHost(""); load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function addAuto() {
    if (!sub.trim() || busy) return;
    setBusy(true); setError(null);
    try { await deployment.addAutoDomain(token, serviceId, sub.trim()); setSub(""); load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function remove(id: number) {
    try { await deployment.removeDomain(token, serviceId, id); load(); }
    catch (e) { setError((e as Error).message); }
  }

  if (loading) return <div className="flex justify-center py-8 text-text-muted"><Loader2 className="animate-spin" size={18} /></div>;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Existing domains */}
      {domains.length > 0 && (
        <div className="space-y-3">
          {domains.map((d) => (
            <DomainRow key={d.id} domain={d} targetIp={targetIp} serviceId={serviceId} token={token} onRemove={() => remove(d.id)} />
          ))}
        </div>
      )}

      {/* Free RachBase subdomain */}
      <Panel title="Free RachBase subdomain">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center rounded-lg border border-neutral-border bg-white px-2">
            <input value={sub} onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addAuto()}
              placeholder="myapp" className="flex-1 py-2 text-sm outline-none" />
            <span className="text-sm text-text-muted">.rachbase.app</span>
          </div>
          <button onClick={addAuto} disabled={busy || !sub.trim()}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary-blue px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            <Plus size={14} /> Add
          </button>
        </div>
        <p className="pt-2 text-xs text-text-muted">We create the DNS + TLS automatically — live in a few minutes.</p>
      </Panel>

      {/* Custom domain */}
      <Panel title="Custom domain">
        <div className="flex items-center gap-2">
          <input value={host} onChange={(e) => setHost(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()}
            placeholder="app.example.com or example.com"
            className="flex-1 rounded-lg border border-neutral-border bg-white px-3 py-2 text-sm outline-none" />
          <button onClick={addCustom} disabled={busy || !host.trim()}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary-blue px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            <Plus size={14} /> Add
          </button>
        </div>
        <p className="pt-2 text-xs text-text-muted">
          Works on the apex too — you point a simple <span className="font-mono">A</span> record at our IP, no registrar CNAME limits.
        </p>
      </Panel>
    </div>
  );
}

function DomainRow({ domain, targetIp, serviceId, token, onRemove }:
  { domain: ServiceDomain; targetIp: string | null; serviceId: number; token: string; onRemove: () => void }) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<{ matches: boolean; resolved: string[] } | null>(null);

  const labels = domain.hostname.split(".");
  const recordName = labels.length <= 2 ? "@" : labels.slice(0, labels.length - 2).join(".");

  function copy(value: string) {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }
  async function runCheck() {
    setChecking(true);
    try { setCheck(await deployment.verifyDomain(token, serviceId, domain.id)); }
    catch { setCheck(null); }
    finally { setChecking(false); }
  }

  const statusColor = domain.status === "live" ? "bg-emerald-500" : domain.status === "failed" ? "bg-red-500" : "bg-amber-500";

  return (
    <div className="rounded-xl border border-neutral-border bg-white p-4">
      <div className="flex items-center gap-2">
        <Globe size={15} className="text-text-muted" />
        <span className="text-sm font-medium text-text-primary">{domain.hostname}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-secondary px-2 py-0.5 text-xs text-text-muted">
          <span className={cn("h-1.5 w-1.5 rounded-full", statusColor)} /> {domain.status}
        </span>
        {domain.is_auto && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-primary-blue">managed</span>}
        <button onClick={onRemove} className="ml-auto text-text-muted hover:text-red-600" title="Remove"><Trash2 size={14} /></button>
      </div>

      {/* Copy-paste DNS record — only for custom domains (managed ones need no user DNS) */}
      {!domain.is_auto && (
        <div className="mt-3 overflow-hidden rounded-lg border border-neutral-border">
          <div className="grid grid-cols-[70px_1fr_1.4fr_auto] items-center gap-2 border-b border-neutral-border bg-bg-secondary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            <span>Type</span><span>Name</span><span>Value</span><span></span>
          </div>
          <div className="grid grid-cols-[70px_1fr_1.4fr_auto] items-center gap-2 px-3 py-2 font-mono text-xs text-text-primary">
            <span>A</span>
            <span className="truncate">{recordName}</span>
            <span className="truncate">{targetIp || "—"}</span>
            <button onClick={() => targetIp && copy(targetIp)} className="text-text-muted hover:text-text-primary" title="Copy IP">
              {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-neutral-border px-3 py-2">
            <span className="text-[11px] text-text-muted">
              {check
                ? check.matches
                  ? <span className="text-emerald-600">DNS points here ✓ — TLS will issue shortly</span>
                  : <span className="text-amber-600">Not resolving to {targetIp} yet {check.resolved.length ? `(currently ${check.resolved.join(", ")})` : "(no A record found)"}</span>
                : "Add this record at your DNS provider, then check."}
            </span>
            <button onClick={runCheck} disabled={checking}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-border px-2.5 py-1 text-xs text-text-muted hover:text-text-primary disabled:opacity-50">
              <RefreshCw size={12} className={checking ? "animate-spin" : ""} /> Check DNS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-border bg-white p-4">
      <p className="mb-2 text-sm font-semibold text-text-primary">{title}</p>
      {children}
    </div>
  );
}
