'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { X, Cpu, MemoryStick, Loader2, AlertCircle, Server } from 'lucide-react';
import { monitoring, HistoryPoint } from '@rach/ui/lib/api';
import { cn } from '@rach/ui/lib/utils';

// ── SVG Line Chart ────────────────────────────────────────────────────────────

const W = 520;   // viewBox width
const H = 140;   // viewBox height
const PAD = { top: 10, right: 12, bottom: 28, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function LineChart({
  points,
  color,
  label,
}: {
  points: { x: number; y: number }[];
  color: string;
  label: string;
}) {
  const [hovered, setHovered] = useState<{ x: number; y: number; value: number; label: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const toSvg = (pt: { x: number; y: number }) => ({
    sx: PAD.left + pt.x * PLOT_W,
    sy: PAD.top  + (1 - pt.y / 100) * PLOT_H,
  });

  const pathD = points.length
    ? points.map((pt, i) => {
        const { sx, sy } = toSvg(pt);
        return `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`;
      }).join(' ')
    : '';

  // Area fill path (close at bottom)
  const areaD = points.length
    ? pathD +
      ` L${toSvg(points[points.length - 1]).sx.toFixed(1)},${(PAD.top + PLOT_H).toFixed(1)}` +
      ` L${PAD.left},${(PAD.top + PLOT_H).toFixed(1)} Z`
    : '';

  const gridYs = [0, 25, 50, 75, 100];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !points.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    const plotX = Math.max(0, Math.min(1, (mx - PAD.left) / PLOT_W));
    const idx = Math.round(plotX * (points.length - 1));
    const pt = points[Math.min(idx, points.length - 1)];
    const { sx, sy } = toSvg(pt);
    setHovered({ x: sx, y: sy, value: pt.y, label: pt.x.toFixed(0) });
  };

  return (
    <div className="relative">
      <p className="text-xs font-semibold text-text-secondary mb-2">{label}</p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
          <clipPath id={`clip-${label}`}>
            <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} />
          </clipPath>
        </defs>

        {/* Grid lines */}
        {gridYs.map((pct) => {
          const sy = PAD.top + (1 - pct / 100) * PLOT_H;
          return (
            <g key={pct}>
              <line x1={PAD.left} y1={sy} x2={PAD.left + PLOT_W} y2={sy}
                stroke="#e5e7eb" strokeWidth="0.5" />
              <text x={PAD.left - 5} y={sy + 3.5} textAnchor="end"
                fontSize="8" fill="#9ca3af">{pct}%</text>
            </g>
          );
        })}

        {/* X-axis day labels */}
        {[0, 1, 2, 3, 4, 5, 6].map((d) => {
          const sx = PAD.left + (d / 6) * PLOT_W;
          const daysAgo = 6 - d;
          const label = daysAgo === 0 ? 'Now' : daysAgo === 1 ? '1d ago' : `${daysAgo}d ago`;
          return (
            <text key={d} x={sx} y={H - 6} textAnchor="middle"
              fontSize="7.5" fill="#9ca3af">{label}</text>
          );
        })}

        {/* Area fill */}
        {areaD && (
          <path d={areaD} fill={`url(#grad-${label})`} clipPath={`url(#clip-${label})`} />
        )}

        {/* Line */}
        {pathD && (
          <path d={pathD} fill="none" stroke={color} strokeWidth="1.5"
            strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#clip-${label})`} />
        )}

        {/* Hover crosshair + dot */}
        {hovered && (
          <>
            <line x1={hovered.x} y1={PAD.top} x2={hovered.x} y2={PAD.top + PLOT_H}
              stroke={color} strokeWidth="0.8" strokeDasharray="3,2" opacity="0.6" />
            <circle cx={hovered.x} cy={hovered.y} r="3" fill={color} stroke="white" strokeWidth="1.5" />
            {/* Tooltip */}
            {(() => {
              const tipW = 52, tipH = 20;
              const tx = Math.min(hovered.x + 6, W - tipW - 4);
              const ty = Math.max(hovered.y - tipH - 4, PAD.top);
              return (
                <g>
                  <rect x={tx} y={ty} width={tipW} height={tipH} rx="3"
                    fill="white" stroke="#e5e7eb" strokeWidth="0.8"
                    filter="drop-shadow(0 1px 2px rgb(0 0 0 / 0.08))" />
                  <text x={tx + tipW / 2} y={ty + 13} textAnchor="middle"
                    fontSize="9" fontWeight="600" fill="#111827">
                    {hovered.value.toFixed(1)}%
                  </text>
                </g>
              );
            })()}
          </>
        )}

        {/* Empty state */}
        {!points.length && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="10" fill="#9ca3af">
            No data available
          </text>
        )}
      </svg>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface Props {
  vmId: string;
  vmName: string;
  vmType: string;
  vmStatus: string;
  token: string;
  onClose: () => void;
}

export default function VMHistoryModal({ vmId, vmName, vmType, vmStatus, token, onClose }: Props) {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await monitoring.getHistory(token, vmId, 168); // 7 days
      setPoints(data.points);
    } catch (err) {
      setError((err as Error).message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [token, vmId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Normalise points to 0–1 x-axis
  const normalised = (key: 'cpuPct' | 'memoryPct') =>
    points.map((p, i) => ({ x: i / Math.max(points.length - 1, 1), y: p[key] }));

  const cpuPoints = normalised('cpuPct');
  const ramPoints = normalised('memoryPct');

  // Summary stats
  const avg = (arr: { y: number }[]) =>
    arr.length ? arr.reduce((s, p) => s + p.y, 0) / arr.length : 0;
  const max = (arr: { y: number }[]) =>
    arr.length ? Math.max(...arr.map((p) => p.y)) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-neutral-border bg-white shadow-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-neutral-border px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-blue/10 to-primary-purple/10">
            <Server size={16} className="text-primary-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text-primary truncate">{vmName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-text-muted font-mono">{vmId}</span>
              <span className="rounded-full bg-bg-secondary px-2 py-0.5 text-xs font-medium text-text-secondary uppercase">{vmType}</span>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                vmStatus === 'running' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-text-muted',
              )}>
                <span className={cn('h-1.5 w-1.5 rounded-full', vmStatus === 'running' ? 'bg-emerald-500' : 'bg-neutral-400')} />
                {vmStatus}
              </span>
            </div>
          </div>
          <p className="text-xs text-text-muted mr-2">Last 7 days</p>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-bg-secondary hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-text-muted">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Loading 7-day history…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <AlertCircle size={28} className="text-red-400" />
              <p className="text-sm text-red-500">{error}</p>
              <button onClick={fetchHistory} className="text-xs text-primary-blue hover:underline">Retry</button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Charts */}
              <LineChart
                points={cpuPoints}
                color="#2563EB"
                label="CPU Usage (%)"
              />
              <LineChart
                points={ramPoints}
                color="#7C3AED"
                label="RAM Usage (%)"
              />

              {/* Summary stats */}
              {points.length > 0 && (
                <div className="grid grid-cols-4 gap-3 pt-1 border-t border-neutral-border">
                  {[
                    { label: 'Avg CPU',  value: `${avg(cpuPoints).toFixed(1)}%`, color: 'text-primary-blue',  icon: <Cpu size={12} /> },
                    { label: 'Peak CPU', value: `${max(cpuPoints).toFixed(1)}%`, color: 'text-primary-blue',  icon: <Cpu size={12} /> },
                    { label: 'Avg RAM',  value: `${avg(ramPoints).toFixed(1)}%`, color: 'text-violet-600',    icon: <MemoryStick size={12} /> },
                    { label: 'Peak RAM', value: `${max(ramPoints).toFixed(1)}%`, color: 'text-violet-600',    icon: <MemoryStick size={12} /> },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-bg-secondary p-3 text-center">
                      <div className={cn('flex items-center justify-center gap-1 text-xs mb-1', s.color)}>
                        {s.icon}
                        <span>{s.label}</span>
                      </div>
                      <p className={cn('text-lg font-bold font-mono', s.color)}>{s.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
