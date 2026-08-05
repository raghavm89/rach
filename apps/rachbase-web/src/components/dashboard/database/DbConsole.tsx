"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, Table2, Loader2, Database, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@rach/ui/lib/utils";
import { dbBrowser, type DbTable, type DbQueryResult } from "@rach/ui/lib/api";

/**
 * Phase 2 · WS3 — Postgres data viewer + read-only query runner.
 * Lives in the service detail "Data" tab for source_type='postgres' services.
 * All queries run read-only server-side (see dbBrowserController).
 */
export function DbConsole({ serviceId, token }: { serviceId: number; token: string }) {
  const [tables, setTables] = useState<DbTable[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [tablesError, setTablesError] = useState<string | null>(null);

  const [sql, setSql] = useState("SELECT * FROM information_schema.tables\nWHERE table_schema NOT IN ('pg_catalog','information_schema')\nLIMIT 50;");
  const [result, setResult] = useState<DbQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [writeMode, setWriteMode] = useState(false);

  const loadTables = useCallback(() => {
    setLoadingTables(true);
    setTablesError(null);
    dbBrowser
      .tables(token, serviceId)
      .then((d) => setTables(d.tables))
      .catch((e) => setTablesError((e as Error).message))
      .finally(() => setLoadingTables(false));
  }, [token, serviceId]);

  useEffect(() => { loadTables(); }, [loadTables]);

  const run = useCallback(async () => {
    if (!sql.trim() || running) return;
    setRunning(true);
    setError(null);
    try {
      setResult(await dbBrowser.query(token, serviceId, sql, writeMode));
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }, [sql, running, token, serviceId, writeMode]);

  function pickTable(t: DbTable) {
    setSql(`SELECT * FROM "${t.table_schema}"."${t.table_name}" LIMIT 100;`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      {/* Tables list */}
      <div className="rounded-xl border border-neutral-border bg-surface-card">
        <div className="flex items-center justify-between border-b border-neutral-border px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <Database size={13} /> Tables
          </span>
          <button onClick={loadTables} className="text-text-muted hover:text-text-primary" title="Refresh">
            <RefreshCw size={13} className={loadingTables ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-1">
          {loadingTables ? (
            <div className="flex items-center justify-center py-6 text-text-muted"><Loader2 size={16} className="animate-spin" /></div>
          ) : tablesError ? (
            <p className="px-2 py-3 text-xs text-red-600">{tablesError}</p>
          ) : tables.length === 0 ? (
            <p className="px-2 py-3 text-xs text-text-muted">No tables yet.</p>
          ) : (
            tables.map((t) => (
              <button
                key={`${t.table_schema}.${t.table_name}`}
                onClick={() => pickTable(t)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-text-secondary hover:bg-bg-secondary"
                title={`${t.table_schema}.${t.table_name}`}
              >
                <Table2 size={12} className="shrink-0 text-text-muted" />
                <span className="truncate">{t.table_name}</span>
                <span className="ml-auto shrink-0 text-[10px] text-text-muted">{t.column_count}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Query editor + results */}
      <div className="space-y-3">
        <div className="rounded-xl border border-neutral-border bg-surface-card">
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(); }}
            spellCheck={false}
            rows={5}
            className="w-full resize-y rounded-t-xl bg-ink/95 p-3 font-mono text-xs text-neutral-100 outline-none"
            placeholder="SELECT * FROM your_table LIMIT 100;"
          />
          <div className="flex items-center justify-between px-3 py-2">
            <button
              type="button"
              onClick={() => setWriteMode((w) => !w)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                writeMode
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-neutral-border bg-bg-secondary text-text-muted hover:text-text-primary",
              )}
              title="Toggle read-only vs write mode"
            >
              <span className={cn("h-2 w-2 rounded-full", writeMode ? "bg-amber-500" : "bg-emerald-500")} />
              {writeMode ? "Write mode" : "Read-only"}
            </button>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-text-muted sm:inline">{"⌘"}/Ctrl+Enter</span>
              <button
                onClick={run}
                disabled={running || !sql.trim()}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-white disabled:opacity-50",
                  writeMode ? "bg-amber-600 hover:bg-amber-700" : "bg-primary-blue hover:bg-blue-700",
                )}
              >
                {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                {writeMode ? "Run (write)" : "Run"}
              </button>
            </div>
          </div>
          {writeMode && (
            <p className="border-t border-amber-100 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
              Write mode commits changes to your database. Statements run in a transaction with a 5s timeout.
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span className="font-mono">{error}</span>
          </div>
        )}

        {result && (
          <div className="overflow-hidden rounded-xl border border-neutral-border bg-surface-card">
            <div className="flex items-center justify-between border-b border-neutral-border px-3 py-2 text-xs text-text-muted">
              <span>{result.rowCount} row{result.rowCount === 1 ? "" : "s"}{result.truncated && " · showing first 1000"}</span>
            </div>
            {result.fields.length === 0 ? (
              <p className="px-3 py-3 text-xs text-text-muted">Query ran successfully (no rows returned).</p>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-bg-secondary">
                    <tr>
                      {result.fields.map((f, i) => (
                        <th key={i} className="whitespace-nowrap border-b border-neutral-border px-3 py-2 font-semibold text-text-primary">{f}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, ri) => (
                      <tr key={ri} className="hover:bg-bg-secondary">
                        {row.map((cell, ci) => (
                          <td key={ci} className="max-w-[320px] truncate border-b border-neutral-border px-3 py-1.5 font-mono text-text-secondary" title={fmt(cell)}>
                            {fmt(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
