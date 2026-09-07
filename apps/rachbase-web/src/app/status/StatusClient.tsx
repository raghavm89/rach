"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The status page can point at a dedicated status API (useful once the page is hosted
// independently of the main app) or fall back to the shared API base.
const BASE_URL =
  process.env.NEXT_PUBLIC_STATUS_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080";

const CACHE_KEY = "rb_status_cache_v1";

type CompState = "operational" | "degraded" | "down" | "maintenance" | "none" | "unknown";

interface HistoryCell {
  date: string;
  state: CompState;
  uptime: number | null;
}
interface Component {
  key: string;
  name: string;
  group: string;
  state: CompState;
  uptime: number | null;
  history: HistoryCell[];
}
interface IncidentUpdate {
  status: string;
  body: string;
  createdAt: string;
}
interface Incident {
  id: number;
  kind: "incident" | "maintenance";
  title: string;
  status: string;
  impact: string;
  startedAt: string;
  scheduledEnd: string | null;
  resolvedAt: string | null;
  components: string[];
  updates: IncidentUpdate[];
}
interface StatusPayload {
  overall: string;
  overallLabel: string;
  updatedAt: string;
  windowDays: number;
  components: Component[];
  activeIncidents: Incident[];
  scheduledMaintenance: Incident[];
  pastIncidents: Incident[];
}

// Segment colors for the uptime bar (operational = brand blue, not green).
const CELL: Record<CompState, string> = {
  operational: "bg-accent",
  degraded: "bg-amber-500",
  down: "bg-red-500",
  maintenance: "bg-sky-400",
  none: "bg-gray-200",
  unknown: "bg-gray-200",
};
// Status dot colors.
const DOT: Record<string, string> = {
  operational: "bg-accent",
  degraded: "bg-amber-500",
  partial_outage: "bg-orange-500",
  major_outage: "bg-red-500",
  maintenance: "bg-sky-500",
  down: "bg-red-500",
  none: "bg-gray-300",
  unknown: "bg-gray-300",
};
const STATE_LABEL: Record<string, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Outage",
  maintenance: "Maintenance",
  none: "No data",
  unknown: "No data",
};
const OVERALL_WORD: Record<string, string> = {
  operational: "Operational",
  degraded: "Degraded",
  partial_outage: "Partial Outage",
  major_outage: "Major Outage",
  maintenance: "Maintenance",
  unknown: "Unknown",
};
// Banner tint by overall state.
const BANNER: Record<string, string> = {
  operational: "bg-accent-weak border-accent-line",
  degraded: "bg-amber-50 border-amber-200",
  partial_outage: "bg-orange-50 border-orange-200",
  major_outage: "bg-red-50 border-red-200",
  maintenance: "bg-sky-50 border-sky-200",
  unknown: "bg-gray-50 border-gray-200",
};

function fmt(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function ago(ts: number) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}
function avgUptime(comps: Component[]): number | null {
  const vals = comps.map((c) => c.uptime).filter((v): v is number => v != null);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}
const pct = (v: number | null) => (v != null ? `${v.toFixed(2)}% uptime` : "—");

// Continuous bar: 90 flush segments inside one rounded track, so healthy days read as a
// smooth blue line and incidents show as colored notches.
function UptimeBar({ history }: { history: HistoryCell[] }) {
  return (
    <div className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-gray-100">
      {history.map((c) => (
        <div
          key={c.date}
          title={`${c.date}: ${STATE_LABEL[c.state]}${c.uptime != null ? ` · ${c.uptime}%` : ""}`}
          className={`flex-1 ${CELL[c.state]}`}
        />
      ))}
    </div>
  );
}

function BarScale() {
  return (
    <div className="mt-2 flex justify-between text-[11px] text-ink-3">
      <span>90 days ago</span>
      <span>Today</span>
    </div>
  );
}

function IncidentCard({ inc }: { inc: Incident }) {
  const accent =
    inc.impact === "critical" || inc.impact === "major" ? "before:bg-red-500" :
    inc.kind === "maintenance" ? "before:bg-sky-400" : "before:bg-amber-500";
  return (
    <div className={`relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 pl-6 before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${accent}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-black">{inc.title}</h3>
        <span className="shrink-0 text-[11px] uppercase tracking-wide text-ink-3">
          {inc.kind === "maintenance" ? "Maintenance" : inc.impact}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-2">
        {inc.kind === "maintenance" && inc.status === "scheduled"
          ? `Scheduled for ${fmt(inc.startedAt)}${inc.scheduledEnd ? ` – ${fmt(inc.scheduledEnd)}` : ""}`
          : `Started ${fmt(inc.startedAt)}${inc.resolvedAt ? ` · Resolved ${fmt(inc.resolvedAt)}` : ""}`}
      </p>
      {inc.updates.length > 0 && (
        <ul className="mt-4 space-y-3 border-l border-gray-200 pl-4">
          {inc.updates.map((u, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium capitalize text-black">{u.status}</span>
              <span className="text-ink-3"> · {fmt(u.createdAt)}</span>
              <p className="text-ink-2">{u.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-ink-3 transition-transform ${open ? "" : "-rotate-90"}`}
      viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75"
    >
      <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function StatusClient() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [stale, setStale] = useState(false);
  const [lastLive, setLastLive] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const fails = useRef(0);

  const toggle = (g: string) => setCollapsed((c) => ({ ...c, [g]: !c[g] }));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { payload, at } = JSON.parse(raw);
        setData(payload);
        setLastLive(at);
        setStale(true);
      }
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(`${BASE_URL}/api/status`, { cache: "no-store", signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j: StatusPayload = await r.json();
      fails.current = 0;
      const at = Date.now();
      setData(j);
      setStale(false);
      setLastLive(at);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ payload: j, at })); } catch { /* ignore */ }
    } catch {
      fails.current += 1;
      setStale(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading && !data) {
    return <p className="text-ink-3">Loading status…</p>;
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          <p className="text-lg font-medium text-black">Unable to reach our systems</p>
        </div>
        <p className="mt-2 text-sm text-ink-2">
          We can&apos;t currently load live status. If this persists, we may be experiencing a
          major outage. This page keeps retrying automatically.
        </p>
        <button onClick={load} className="mt-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-50">
          Retry now
        </button>
      </div>
    );
  }

  const groups = Array.from(new Set(data.components.map((c) => c.group)));
  const bannerState = stale ? "unknown" : data.overall;
  const bannerLabel = stale ? "Live status unavailable" : data.overallLabel;
  const bannerWord = stale ? "Unknown" : (OVERALL_WORD[data.overall] || "Operational");

  return (
    <div className="space-y-8">
      {/* Overall banner */}
      <div className={`rounded-2xl border ${BANNER[bannerState] || BANNER.unknown}`}>
        <div className="flex items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <span className={`inline-block h-3 w-3 rounded-full ${DOT[bannerState] || "bg-gray-300"}`} />
            <p className="text-base font-semibold text-black">{bannerLabel}</p>
          </div>
          <span className="text-sm text-ink-2">{bannerWord}</span>
        </div>
        <div className="border-t border-black/[0.06] px-5 py-3">
          <p className="border-l-2 border-accent pl-3 text-[13px] leading-relaxed text-ink-3">
            This page reports incidents with significant, widespread impact. Smaller or isolated
            issues may not appear here. Updated {stale ? (lastLive ? ago(lastLive) : "recently") : fmt(data.updatedAt)}.
          </p>
        </div>
      </div>

      {/* Stale banner */}
      {stale && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-ink-2">
          <span className="font-medium text-black">We can&apos;t reach our monitoring right now.</span>{" "}
          Showing last known status{lastLive ? ` from ${ago(lastLive)}` : ""} — if you&apos;re seeing
          this, we may be experiencing a major outage.
          <button onClick={load} className="ml-2 text-amber-600 underline underline-offset-2">Retry</button>
        </div>
      )}

      {/* Active incidents */}
      {data.activeIncidents.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Active incidents</h2>
          {data.activeIncidents.map((i) => <IncidentCard key={i.id} inc={i} />)}
        </section>
      )}

      {/* Scheduled maintenance */}
      {data.scheduledMaintenance.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Scheduled maintenance</h2>
          {data.scheduledMaintenance.map((i) => <IncidentCard key={i.id} inc={i} />)}
        </section>
      )}

      {/* Component groups */}
      {groups.map((g) => {
        const comps = data.components.filter((c) => c.group === g);
        const open = !collapsed[g];
        return (
          <section key={g} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <button
              onClick={() => toggle(g)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50"
            >
              <span className="flex items-center gap-2.5">
                <Chevron open={open} />
                <span className="font-semibold text-black">{g}</span>
              </span>
              <span className="text-sm text-ink-3">{pct(avgUptime(comps))}</span>
            </button>
            {open && (
              <div className="divide-y divide-gray-100 border-t border-gray-100">
                {comps.map((c) => (
                  <div key={c.key} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${DOT[c.state] || "bg-gray-300"}`} />
                        <span className="text-sm font-medium text-black">{c.name}</span>
                      </span>
                      <span className="text-sm text-ink-3">{pct(c.uptime)}</span>
                    </div>
                    <div className="mt-3">
                      <UptimeBar history={c.history} />
                      <BarScale />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Past incidents */}
      {data.pastIncidents.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Past incidents</h2>
          {data.pastIncidents.map((i) => <IncidentCard key={i.id} inc={i} />)}
        </section>
      )}
    </div>
  );
}
