'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ShieldCheck, FunctionSquare, HardDrive, KeyRound, Table2, Play, Database, Telescope, DatabaseBackup, Radio } from 'lucide-react';
import { cn } from '@rach/ui/lib/utils';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import BaasPanel from '@/components/dashboard/BaasPanel';
import AuthSection from '@/components/dashboard/AuthSection';
import FunctionsSection from '@/components/dashboard/FunctionsSection';
import StorageSection from '@/components/dashboard/StorageSection';
import DatabaseSection from '@/components/dashboard/DatabaseSection';
import TableEditorSection from '@/components/dashboard/TableEditorSection';
import SqlEditorSection from '@/components/dashboard/SqlEditorSection';
import ObservabilitySection from '@/components/dashboard/ObservabilitySection';
import BackupsSection from '@/components/dashboard/BackupsSection';
import RealtimeSection from '@/components/dashboard/RealtimeSection';

const TABS = [
  { key: 'keys', label: 'API keys', icon: KeyRound },
  { key: 'editor', label: 'Table Editor', icon: Table2 },
  { key: 'data', label: 'SQL Editor', icon: Play },
  { key: 'database', label: 'Database', icon: Database },
  { key: 'users', label: 'Auth', icon: ShieldCheck },
  { key: 'functions', label: 'Functions', icon: FunctionSquare },
  { key: 'storage', label: 'Storage', icon: HardDrive },
  { key: 'realtime', label: 'Realtime', icon: Radio },
  { key: 'backups', label: 'Backups', icon: DatabaseBackup },
  { key: 'observability', label: 'Observability', icon: Telescope },
] as const;

export default function BackendConsolePage() {
  const { token } = useAuth();
  const projectId = Number(useParams().id);
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('keys');
  const [editorNewTable, setEditorNewTable] = useState(false);
  const [obsPage, setObsPage] = useState<'overview' | 'connections'>('overview');

  const active = TABS.find((t) => t.key === tab);
  return (
    <div className="max-w-6xl">
      <Link href="/dashboard/backend" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft size={15} /> Backend
      </Link>
      <div className="grid grid-cols-[200px_1fr] gap-6">
        {/* Left sub-nav (Supabase-style, scoped to this backend) */}
        <nav className="space-y-0.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
                tab === t.key ? 'bg-blue-50 text-primary-blue' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary')}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </nav>
        {/* Content */}
        <div className="min-w-0">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold font-display text-text-primary">
            {active && <active.icon size={18} className="text-text-muted" />} {active?.label}
          </h2>
          {token && tab === 'keys' && <BaasPanel token={token} projectId={projectId} />}
          {token && tab === 'editor' && <TableEditorSection token={token} projectId={projectId} openNew={editorNewTable} onOpenedNew={() => setEditorNewTable(false)} />}
          {token && tab === 'data' && <SqlEditorSection token={token} projectId={projectId} onViewRunningQueries={() => { setObsPage('connections'); setTab('observability'); }} />}
          {token && tab === 'database' && <DatabaseSection token={token} projectId={projectId} onCreateTable={() => { setEditorNewTable(true); setTab('editor'); }} />}
          {token && tab === 'users' && <AuthSection token={token} projectId={projectId} />}
          {token && tab === 'functions' && <FunctionsSection token={token} projectId={projectId} />}
          {token && tab === 'storage' && <StorageSection token={token} projectId={projectId} />}
          {token && tab === 'realtime' && <RealtimeSection token={token} projectId={projectId} />}
          {token && tab === 'backups' && <BackupsSection token={token} projectId={projectId} />}
          {token && tab === 'observability' && <ObservabilitySection token={token} projectId={projectId} initialPage={obsPage} />}
        </div>
      </div>
    </div>
  );
}
