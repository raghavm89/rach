"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Loader2, Radio, ChevronRight } from "lucide-react";
import { cn } from "@rach/ui/lib/utils";
import { deployment } from "@rach/ui/lib/api";

interface DeployLog {
  id: number;
  status: string;
  log_output: string;
  started_at: string;
  finished_at: string | null;
  commit_sha: string | null;
  triggered_by: string;
}

/**
 * Phase 2 · WS7 — service logs.
 * Runtime tab live-tails the app logs (poll while "Live"); Deploys tab shows
 * build history with expandable per-deploy output.
 */
export function LogsPanel({ serviceId, token }: { serviceId: number; token: string }) {
  const [view, setView] = useState<"runtime" | "deploys">("runtime");
  const [runtime, setRuntime] = useState("");
  const [deploys, setDeploys] = useState<DeployLog[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const loadRuntime = useCallback(async (spin = true) => {
    if (spin) setLoading(true);
    setError(null);
    try {
      const d = await deployment.getRuntimeLogs(token, serviceId);
      setRuntime(d.logs || "");
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [token, serviceId]);

  const loadDeploys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await deployment.getDeployLogs(token, serviceId);
      setDeploys(d.logs);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [token, serviceId]);

  useEffect(() => {
    if (view === "runtime") loadRuntime();
    else loadDeploys();
  }, [view, loadRuntime, loadDeploys]);

  // Live tail
  useEffect(() => {
    if (view !== "runtime" || !live) return;
    const t = setInterval(() => loadRuntime(false), 4000);
    return () => clearInterval(t);
  }, [view, live, loadRuntime]);

  // Autoscroll to the newest output
  useEffect(() => {
    if (view === "runtime" && preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [runtime, view]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-neutral-border bg-white p-0.5 text-xs">
          {(["runtime", "deploys"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={cn("rounded-md px-3 py-1 font-medium capitalize transition-colors",
                view === v ? "bg-primary-blue text-white" : "text-text-muted hover:text-text-primary")}>
              {v === "runtime" ? "Runtime" : "Deploys"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {view === "runtime" && (
            <button onClick={() => setLive((l) => !l)}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                live ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-neutral-border bg-bg-secondary text-text-muted")}>
              <Radio size={12} className={live ? "animate-pulse" : ""} /> {live ? "Live" : "Paused"}
            </button>
          )}
          <button onClick={() => (view === "runtime" ? loadRuntime() : loadDeploys())}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-border px-2.5 py-1 text-xs text-text-muted hover:text-text-primary">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{error}</div>}

      {view === "runtime" ? (
        <pre ref={preRef}
          className="max-h-[460px] overflow-auto rounded-xl bg-ink/95 p-4 font-mono text-xs leading-relaxed text-neutral-200">
          {loading && !runtime ? "Loading…" : runtime || "No runtime logs yet."}
        </pre>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-border bg-white">
          {loading && deploys.length === 0 ? (
            <div className="flex justify-center py-6 text-text-muted"><Loader2 className="animate-spin" size={16} /></div>
          ) : deploys.length === 0 ? (
            <p className="px-3 py-4 text-xs text-text-muted">No deployments yet.</p>
          ) : (
            deploys.map((d) => (
              <div key={d.id} className="border-b border-neutral-border last:border-0">
                <button onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-bg-secondary">
                  <ChevronRight size={13} className={cn("text-text-muted transition-transform", expanded === d.id && "rotate-90")} />
                  <span className={cn("h-2 w-2 rounded-full",
                    d.status === "success" ? "bg-emerald-500" : d.status === "failed" ? "bg-red-500" : "bg-amber-500")} />
                  <span className="font-mono text-text-secondary">#{d.id}</span>
                  <span className="text-text-primary">{d.status}</span>
                  {d.commit_sha && <span className="font-mono text-text-muted">{d.commit_sha.slice(0, 7)}</span>}
                  <span className="ml-auto text-text-muted">{new Date(d.started_at).toLocaleString()}</span>
                </button>
                {expanded === d.id && (
                  <pre className="max-h-[320px] overflow-auto bg-ink/95 p-3 font-mono text-[11px] leading-relaxed text-neutral-200">
                    {d.log_output || "(no output)"}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
