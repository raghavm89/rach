'use client';

import { RefreshCw, CalendarDays } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { useHr } from '@/lib/hr/useHr';
import { Pill, CARD } from '@/components/dashboard/hr/bits';
import { type Holiday } from '@/lib/hr/demo';

export default function HrCalendarPage() {
  const { get, loading, error, reload, setLoading } = useHr(['holidays']);
  const holidays = [...get<Holiday>('holidays')].sort((a, b) => a.date.localeCompare(b.date));
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Holiday calendar"
        subtitle="Company holidays feed the leave working-day calculation. National and Karnataka-scoped holidays; optional ones don't reduce leave."
        actions={<button onClick={() => { setLoading(true); reload(); }} disabled={loading} className="flex items-center gap-2 rounded-lg border border-neutral-border bg-surface-card px-4 py-2 text-sm font-medium text-dash-muted hover:bg-surface-hover disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>}
      />
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className={`${CARD} mt-6 divide-y divide-neutral-border`}>
        {loading ? <p className="p-6 text-center text-sm text-dash-muted">Loading…</p>
          : holidays.length === 0 ? <p className="p-6 text-center text-sm text-dash-muted">No holidays configured.</p>
            : holidays.map((h) => {
              const upcoming = h.date >= todayIso;
              const d = new Date(`${h.date}T00:00:00`);
              return (
                <div key={h.date} className={`flex items-center gap-4 px-5 py-3 ${upcoming ? '' : 'opacity-60'}`}>
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-accent-weak">
                    <span className="text-[10px] uppercase text-accent">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                    <span className="text-sm font-bold text-accent">{d.getDate()}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-dash-heading">{h.name}</p>
                    <p className="text-[11px] text-dash-muted">{d.toLocaleDateString('en-IN', { weekday: 'long' })}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Pill className={h.scope === 'national' ? 'bg-accent-weak text-accent' : 'bg-surface-hover text-dash-muted'}>{h.scope}</Pill>
                    {h.optional && <Pill className="bg-surface-hover text-dash-muted">optional</Pill>}
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
