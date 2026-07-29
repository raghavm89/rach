"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, GitBranch, Database, Layers, Box, Zap, Archive,
  Server, Cpu, MemoryStick, RefreshCw, AlertCircle, ServerOff,
  GitFork, CheckCircle2, ChevronDown, Loader2, Lock, X, TerminalSquare, Bot, Rocket,
  SlidersHorizontal, Eye, EyeOff, Trash2, Settings2, ScrollText, Globe,
  Link2, GitCommit, Copy, Activity, Lock as LockIcon, Power,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@rach/ui/contexts/AuthContext";
import { monitoring, deployment, expansion, endpoints, VM, GithubRepo, DeploymentService, CanvasPosition, ServiceEnvVar, ServiceDomain, MonitoredEndpoint, ServiceGroup } from "@rach/ui/lib/api";
import { cn } from "@rach/ui/lib/utils";
import { useSearchParams, useRouter } from "next/navigation";
import { AgentChat } from "@/components/dashboard/AgentChat";
import { useTerminal } from "@/contexts/TerminalContext";
import { useChat } from "@/contexts/ChatContext";

// ─── Types / constants ──────────────────────────────────────────────────────

type ModalStep = "pick-type" | "github-connect" | "github-repo" | "github-branch" | "github-confirm" | "pg-config";

const VM_W = 288, SERVICE_W = 240, ROW_GAP = 150;

const addOptions = [
  { label: "GitHub Repository", icon: GitBranch, key: "github",   available: true },
  { label: "Database (Postgres)", icon: Database, key: "database", available: true },
  { label: "Template",          icon: Layers,    key: "template",  available: false },
  { label: "Docker Image",      icon: Box,       key: "docker",    available: false },
  { label: "Function",          icon: Zap,       key: "function",  available: false },
  { label: "Bucket",            icon: Archive,   key: "bucket",    available: false },
];

const PG_VERSIONS = ["16", "15", "14", "13"];

const vmKey  = (id: string) => `vm:${id}`;
const svcKey = (id: number) => `svc:${id}`;

type Pos = { x: number; y: number };
type PosMap = Record<string, Pos>;

// ─── Helpers ────────────────────────────────────────────────────────────────

function UsageBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-red-500" : pct >= 60 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function statusBadge(status: string) {
  return cn(
    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
    status === "deployed"  ? "bg-emerald-100 text-emerald-700" :
    status === "deploying" ? "bg-blue-100 text-blue-700" :
    status === "failed"    ? "bg-red-100 text-red-700" :
                             "bg-neutral-100 text-neutral-600",
  );
}

// ─── Service card (draggable node) ──────────────────────────────────────────

function ServiceNode({
  service, pos, onDragStart, onDeploy, onOpen, deploying, group,
}: {
  service: DeploymentService;
  pos: Pos;
  onDragStart: (e: React.PointerEvent, key: string) => void;
  onDeploy: (s: DeploymentService) => void;
  onOpen: (s: DeploymentService) => void;
  deploying: boolean;
  group?: ServiceGroup;
}) {
  const isPg = service.source_type === "postgres";
  const title = isPg ? (service.name || "postgres") : (service.repo_full_name?.split("/").slice(-1)[0] || "repo");
  const subtitle = isPg ? `Postgres ${String(service.config?.version ?? "")}` : (service.branch || "");
  const Icon = isPg ? Database : GitBranch;

  return (
    <div
      className="absolute select-none"
      style={{ left: pos.x, top: pos.y, width: SERVICE_W }}
    >
      <div className="bg-white rounded-xl border border-black/12 shadow-sm">
        <div
          onPointerDown={(e) => onDragStart(e, svcKey(service.id))}
          className="flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing border-b border-black/8"
        >
          <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg shrink-0", isPg ? "bg-violet-50" : "bg-black/5")}>
            <Icon size={13} className={isPg ? "text-violet-600" : "text-black/50"} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-black truncate">{title}</p>
            <p className="text-[10px] text-black/40 font-mono truncate">{subtitle}</p>
            {group && (
              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                style={{ background: `${group.color}1a`, color: group.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: group.color }} /> {group.name}
              </span>
            )}
          </div>
          <span className={statusBadge(service.status)}>{service.status}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={() => onOpen(service)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-black/50 hover:bg-black/5 hover:text-black/70 transition-colors">
            <SlidersHorizontal size={11} /> Manage
          </button>
          <Link href={`/dashboard/deployment/services/${service.id}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-black/50 hover:bg-black/5 hover:text-black/70 transition-colors">
            <Eye size={11} /> Open
          </Link>
          <div className="flex-1" />
          <button
            onClick={() => onDeploy(service)}
            disabled={deploying}
            className="inline-flex items-center gap-1 rounded-md bg-black/5 px-2 py-1 text-[11px] font-semibold text-black/70 hover:bg-black/10 disabled:opacity-50 transition-colors"
          >
            {deploying ? <Loader2 size={11} className="animate-spin" /> : <Rocket size={11} />}
            {isPg ? "Provision" : "Deploy"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── VM card (draggable node) ───────────────────────────────────────────────

function VMNode({
  vm, pos, onDragStart, onAdd, onTerminal,
}: {
  vm: VM;
  pos: Pos;
  onDragStart: (e: React.PointerEvent, key: string) => void;
  onAdd: (vm: VM) => void;
  onTerminal: (vm: VM) => void;
}) {
  const isRunning = vm.status === "running";
  return (
    <div className="absolute select-none" style={{ left: pos.x, top: pos.y, width: VM_W }}>
      <div className="bg-white rounded-xl border border-black/12 shadow-sm">
        <div
          onPointerDown={(e) => onDragStart(e, vmKey(vm.id))}
          className="flex items-start justify-between gap-2 px-4 py-3 cursor-grab active:cursor-grabbing border-b border-black/8"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/5 shrink-0">
              <Server size={15} className="text-black/50" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-black truncate">{vm.name}</p>
              <p className="text-[10px] text-black/40 font-mono truncate">{vm.id}</p>
            </div>
          </div>
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0",
            isRunning ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500",
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", isRunning ? "bg-emerald-500" : "bg-neutral-400")} />
            {vm.status}
          </span>
        </div>

        <div className="px-4 py-3 space-y-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-black/50"><Cpu size={11} /> CPU</span>
              <span className={cn("font-mono font-medium", vm.cpuPct >= 80 ? "text-red-600" : "text-black/70")}>{vm.cpuPct}%</span>
            </div>
            <UsageBar pct={vm.cpuPct} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-black/50"><MemoryStick size={11} /> RAM</span>
              <span className={cn("font-mono font-medium", vm.memoryPct >= 85 ? "text-red-600" : "text-black/70")}>
                {vm.memoryUsedGib}/{vm.memoryTotalGib} GiB
              </span>
            </div>
            <UsageBar pct={vm.memoryPct} />
          </div>
        </div>

        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => onAdd(vm)}
            disabled={!isRunning}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-black/20 py-2 text-xs font-semibold text-black/50 hover:border-black/40 hover:text-black hover:bg-black/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={12} /> Add service
          </button>
          <button
            onClick={() => onTerminal(vm)}
            disabled={!isRunning}
            title="Open SSH terminal"
            className="flex items-center justify-center rounded-lg border border-black/15 px-3 py-2 text-xs font-semibold text-black/50 hover:border-black/40 hover:text-black hover:bg-black/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <TerminalSquare size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Arrows layer (service → VM) ────────────────────────────────────────────

function Arrows({ vms, services, pos }: { vms: VM[]; services: DeploymentService[]; pos: PosMap }) {
  // Rough card heights for anchor points.
  const vmH = 176, svcH = 84;
  const paths: { id: number; d: string }[] = [];

  for (const s of services) {
    const vp = pos[vmKey(s.vm_id)];
    const sp = pos[svcKey(s.id)];
    if (!vp || !sp) continue;
    // Anchor from the VM's right-middle to the service's left-middle.
    const x1 = vp.x + VM_W, y1 = vp.y + vmH / 2;
    const x2 = sp.x,         y2 = sp.y + svcH / 2;
    const mx = (x1 + x2) / 2;
    paths.push({ id: s.id, d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}` });
  }

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: "visible" }}>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="rgba(0,0,0,0.35)" />
        </marker>
      </defs>
      {paths.map((p) => (
        <path key={p.id} d={p.d} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth={1.5} markerEnd="url(#arrowhead)" />
      ))}
    </svg>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function DeploymentPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [vms, setVMs]           = useState<VM[]>([]);
  const [services, setServices] = useState<DeploymentService[]>([]);
  const [groups, setGroups]     = useState<ServiceGroup[]>([]);
  const [pos, setPos]           = useState<PosMap>({});
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState("");
  const [deployingId, setDeployingId] = useState<number | null>(null);
  const [detailService, setDetailService]     = useState<DeploymentService | null>(null);
  // Service groups (WS6) — for the colored badge on each card.
  useEffect(() => {
    if (token) deployment.listGroups(token).then((d) => setGroups(d.groups)).catch(() => {});
  }, [token]);

  const [githubConnected, setGithubConnected] = useState(false);
  const [githubAccount, setGithubAccount]     = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep]           = useState<ModalStep>("pick-type");
  const [targetVM, setTargetVM]   = useState<VM | null>(null);
  const [search, setSearch]       = useState("");
  const [connectingGithub, setConnectingGithub] = useState(false);
  const [checkingGithub, setCheckingGithub]     = useState(false);
  const [repos, setRepos]         = useState<GithubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [branches, setBranches]   = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [pgName, setPgName]       = useState("app");
  const [pgVersion, setPgVersion] = useState("16");
  const [newRootDir, setNewRootDir] = useState("");
  const [saving, setSaving]       = useState(false);
  const [flowError, setFlowError] = useState("");

  const { openTerminal } = useTerminal();
  const { chatOpen, closeChat, toggleChat } = useChat();

  const canvasRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tenant-admin page.
  useEffect(() => {
    if (user && user.role !== "tenant_admin") router.replace("/dashboard");
  }, [user, router]);

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const [vmsData, servicesData, githubStatus, canvas] = await Promise.all([
        monitoring.getVMs(token),
        deployment.listServices(token),
        deployment.getGithubStatus(token),
        deployment.getCanvas(token),
      ]);
      setVMs(vmsData.vms);
      setServices(servicesData.services);
      setGithubConnected(githubStatus.connected);
      setGithubAccount(githubStatus.github_account || null);
      const saved: PosMap = {};
      for (const p of canvas.positions) saved[p.node_key] = { x: p.x, y: p.y };
      setPos((prev) => ({ ...saved, ...prev }));
    } catch (err) {
      setError((err as Error).message || "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Seed default positions for any node without a saved one (auto-layout).
  useEffect(() => {
    if (loading || seededRef.current) return;
    if (!vms.length) return;
    seededRef.current = true;
    setPos((prev) => {
      const next = { ...prev };
      vms.forEach((vm, i) => {
        if (!next[vmKey(vm.id)]) next[vmKey(vm.id)] = { x: 48, y: 48 + i * (176 + ROW_GAP) };
        const vmServices = services.filter((s) => s.vm_id === vm.id);
        vmServices.forEach((s, j) => {
          if (!next[svcKey(s.id)]) {
            const base = next[vmKey(vm.id)];
            next[svcKey(s.id)] = { x: base.x + VM_W + 120, y: base.y + j * (84 + 24) };
          }
        });
      });
      return next;
    });
  }, [loading, vms, services]);

  // GitHub callback redirect handling
  useEffect(() => {
    const connected = searchParams.get("github_connected");
    const ghError   = searchParams.get("github_error");
    if (connected === "1") { fetchAll(); router.replace("/dashboard/deployment"); }
    if (ghError) { setFlowError(decodeURIComponent(ghError)); router.replace("/dashboard/deployment"); }
  }, [searchParams, fetchAll, router]);

  // ── Persist positions (debounced) ────────────────────────────────────────
  const persist = useCallback((map: PosMap) => {
    if (!token) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const positions: CanvasPosition[] = Object.entries(map).map(([node_key, p]) => ({ node_key, x: p.x, y: p.y }));
      deployment.saveCanvas(token, positions).catch(() => {});
    }, 600);
  }, [token]);

  // ── Drag ─────────────────────────────────────────────────────────────────
  const drag = useRef<{ key: string; offX: number; offY: number } | null>(null);

  const onDragStart = (e: React.PointerEvent, key: string) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cur = pos[key] || { x: 0, y: 0 };
    drag.current = {
      key,
      offX: e.clientX - rect.left - cur.x,
      offY: e.clientY - rect.top - cur.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { key, offX, offY } = drag.current;
      const x = Math.max(0, e.clientX - rect.left - offX);
      const y = Math.max(0, e.clientY - rect.top - offY);
      setPos((prev) => ({ ...prev, [key]: { x, y } }));
    };
    const onUp = () => {
      if (!drag.current) return;
      drag.current = null;
      setPos((prev) => { persist(prev); return prev; });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [persist]);

  // ── Deploy / provision a service ──────────────────────────────────────────
  const handleDeploy = async (service: DeploymentService) => {
    if (!token) return;
    setDeployingId(service.id);
    try {
      await deployment.triggerDeploy(token, service.id);
      setServices((prev) => prev.map((s) => s.id === service.id ? { ...s, status: "deploying" } : s));
      setTimeout(() => fetchAll(true), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeployingId(null);
    }
  };

  // ── Modal flow ────────────────────────────────────────────────────────────
  const openAdd = (vm: VM) => { setTargetVM(vm); setStep("pick-type"); setSearch(""); setFlowError(""); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setSelectedRepo(null); setSelectedBranch(""); setBranches([]); setRepos([]); setFlowError(""); setPgName("app"); setPgVersion("16"); setNewRootDir(""); };

  const handlePickType = async (key: string) => {
    setFlowError("");
    if (key === "github") {
      if (!githubConnected) setStep("github-connect");
      else { setStep("github-repo"); loadRepos(); }
    } else if (key === "database") {
      setStep("pg-config");
    }
  };

  const handleConnectGithub = async () => {
    if (!token) return;
    setConnectingGithub(true); setFlowError("");
    try {
      const { install_url } = await deployment.getInstallUrl(token);
      window.open(install_url, "_blank", "noopener");
      const poll = setInterval(async () => {
        try {
          // Reconcile pulls the installation straight from GitHub's API, so this
          // resolves even if GitHub's post-install redirect never came back.
          const status = await deployment.reconcileGithub(token);
          if (status.connected) {
            clearInterval(poll);
            setGithubConnected(true); setGithubAccount(status.github_account || null);
            setConnectingGithub(false); setStep("github-repo"); loadRepos();
          }
        } catch { /* ignore */ }
      }, 3000);
      setTimeout(() => { clearInterval(poll); setConnectingGithub(false); }, 300000);
    } catch (err) { setFlowError((err as Error).message); setConnectingGithub(false); }
  };

  // Manual re-check — reconciles straight from GitHub's API, so it works even if
  // the post-install redirect never reached the callback.
  const checkGithubNow = async () => {
    if (!token) return;
    setCheckingGithub(true); setFlowError("");
    try {
      const r = await deployment.reconcileGithub(token);
      if (r.connected) {
        setGithubConnected(true); setGithubAccount(r.github_account || null);
        setConnectingGithub(false); setStep("github-repo"); loadRepos();
      } else if (r.reason === "no_installations") {
        setFlowError("No installation found yet. Click “Install on GitHub” and grant access first.");
      } else if (r.reason === "ambiguous") {
        setFlowError(`Multiple GitHub installations found (${(r.accounts || []).join(", ")}). Click “Install on GitHub” once more so we can link the right one.`);
      } else {
        setFlowError("Not connected yet. Finish installing on GitHub, then check again.");
      }
    } catch (err) { setFlowError((err as Error).message); }
    finally { setCheckingGithub(false); }
  };

  const loadRepos = async () => {
    if (!token) return;
    setReposLoading(true); setFlowError("");
    try { const data = await deployment.listRepos(token); setRepos(data.repos); }
    catch (err) { setFlowError((err as Error).message); }
    finally { setReposLoading(false); }
  };

  // Opens the GitHub App's config page (add/remove repos), then polls the repo
  // list so a newly-granted repo shows up without leaving the modal.
  const manageRepoAccess = async () => {
    if (!token) return;
    try {
      const { install_url } = await deployment.getInstallUrl(token);
      window.open(install_url, "_blank", "noopener");
    } catch (err) { setFlowError((err as Error).message); return; }
    // Re-fetch a few times — GitHub takes a moment to reflect new grants.
    let tries = 0;
    const before = repos.length;
    const poll = setInterval(async () => {
      tries++;
      try {
        const data = await deployment.listRepos(token);
        setRepos(data.repos);
        if (data.repos.length !== before) { clearInterval(poll); }
      } catch { /* ignore */ }
      if (tries >= 20) clearInterval(poll);
    }, 3000);
  };

  const handleSelectRepo = async (repo: GithubRepo) => {
    if (!token) return;
    setSelectedRepo(repo); setSelectedBranch(repo.default_branch); setStep("github-branch");
    setBranchesLoading(true); setFlowError("");
    try { const data = await deployment.listBranches(token, repo.full_name); setBranches(data.branches); }
    catch (err) { setFlowError((err as Error).message); }
    finally { setBranchesLoading(false); }
  };

  const placeNewService = (svc: DeploymentService) => {
    // Drop the new card near its VM.
    setPos((prev) => {
      const base = prev[vmKey(svc.vm_id)] || { x: 48, y: 48 };
      const siblings = services.filter((s) => s.vm_id === svc.vm_id).length;
      const next = { ...prev, [svcKey(svc.id)]: { x: base.x + VM_W + 120, y: base.y + siblings * (84 + 24) } };
      persist(next);
      return next;
    });
  };

  const handleConfirmGithub = async () => {
    if (!token || !targetVM || !selectedRepo || !selectedBranch) return;
    setSaving(true); setFlowError("");
    try {
      const { service } = await deployment.createService(token, {
        vm_id: targetVM.id, repo_full_name: selectedRepo.full_name, branch: selectedBranch,
        config: newRootDir.trim() ? { root_dir: newRootDir.trim().replace(/^\/+|\/+$/g, "") } : undefined,
      });
      setServices((prev) => [service, ...prev]);
      placeNewService(service);
      closeModal();
    } catch (err) { setFlowError((err as Error).message); }
    finally { setSaving(false); }
  };

  const handleCreatePg = async () => {
    if (!token || !targetVM) return;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(pgName.trim())) { setFlowError("Name: letters, digits, underscore"); return; }
    setSaving(true); setFlowError("");
    try {
      const { service } = await deployment.createService(token, {
        vm_id: targetVM.id, source_type: "postgres", name: pgName.trim(), config: { version: pgVersion },
      });
      setServices((prev) => [service, ...prev]);
      placeNewService(service);
      closeModal();
    } catch (err) { setFlowError((err as Error).message); }
    finally { setSaving(false); }
  };

  const filtered = addOptions.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));

  if (user && user.role !== "tenant_admin") return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex w-full min-h-[calc(100vh-64px)] rounded-xl border border-black/12 overflow-hidden" style={{ isolation: "isolate" }}>
      <div className="relative flex-1 bg-white overflow-auto">
        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px",
        }} />

        {/* Toolbar */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur border-b border-black/8">
          <p className="text-xs font-semibold text-black/40 uppercase tracking-wider">Deployment canvas — drag cards to arrange</p>
          <div className="flex items-center gap-2">
            <button onClick={toggleChat} className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors shadow-sm",
              chatOpen ? "bg-primary-blue text-white border-primary-blue" : "bg-white border-black/12 text-black/60 hover:text-black hover:bg-black/5",
            )}><Bot size={13} /> Agent</button>
            {githubConnected && githubAccount && (
              <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-black/12 text-xs text-black/50 shadow-sm">
                <GitFork size={12} /> {githubAccount}
              </span>
            )}
            <button onClick={() => fetchAll(true)} disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-black/12 text-xs font-medium text-black/60 hover:text-black hover:bg-black/5 transition-colors shadow-sm disabled:opacity-50">
              <RefreshCw size={12} className={cn(refreshing && "animate-spin")} /> Refresh
            </button>
          </div>
        </div>

        {/* States */}
        {loading && (
          <div className="flex items-center justify-center py-32"><div className="h-6 w-6 animate-spin rounded-full border-2 border-black/20 border-t-black/60" /></div>
        )}
        {!loading && (error || vms.length === 0) && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center max-w-sm mx-auto">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5"><ServerOff size={28} className="text-black/30" /></div>
            <div>
              <p className="font-semibold text-black/70">{error && !error.toLowerCase().includes("assigned") ? "Something went wrong" : "No VMs assigned yet"}</p>
              <p className="mt-1 text-sm text-black/40">{error && !error.toLowerCase().includes("assigned") ? error : "Your VMs appear here once resources are assigned."}</p>
            </div>
            {error && !error.toLowerCase().includes("assigned") && (
              <button onClick={() => fetchAll()} className="text-sm text-primary-blue hover:underline">Try again</button>
            )}
          </div>
        )}

        {/* Canvas */}
        {!loading && !error && vms.length > 0 && services.length === 0 && (
          <div className="absolute left-1/2 top-8 z-20 -translate-x-1/2 rounded-xl border border-primary-blue/20 bg-blue-50/80 px-4 py-2.5 text-center shadow-sm backdrop-blur">
            <p className="text-sm font-semibold text-black/80">Deploy your first service</p>
            <p className="mt-0.5 text-xs text-black/50">Click the <span className="font-semibold text-primary-blue">+</span> on a VM to add a GitHub app or a Postgres database.</p>
          </div>
        )}

        {!loading && !error && vms.length > 0 && (
          <div ref={canvasRef} className="relative z-10" style={{ minHeight: 1200, minWidth: 1400 }}>
            <Arrows vms={vms} services={services} pos={pos} />
            {vms.map((vm) => pos[vmKey(vm.id)] && (
              <VMNode key={vm.id} vm={vm} pos={pos[vmKey(vm.id)]} onDragStart={onDragStart} onAdd={openAdd} onTerminal={openTerminal} />
            ))}
            {services.map((s) => pos[svcKey(s.id)] && (
              <ServiceNode key={s.id} service={s} pos={pos[svcKey(s.id)]} onDragStart={onDragStart} onDeploy={handleDeploy} onOpen={setDetailService} deploying={deployingId === s.id} group={groups.find((g) => g.id === s.group_id)} />
            ))}
          </div>
        )}

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
            <div className="absolute inset-0 bg-black/20" onClick={closeModal} />
            <div className="relative w-full max-w-sm bg-white border border-black/12 rounded-xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div>
                  {targetVM && <p className="text-xs text-black/40 mb-0.5 flex items-center gap-1"><Server size={11} /> {targetVM.name}</p>}
                  <p className="text-sm font-semibold text-black">
                    {step === "pick-type"      && "What would you like to create?"}
                    {step === "github-connect" && "Connect GitHub"}
                    {step === "github-repo"    && "Select repository"}
                    {step === "github-branch"  && "Select branch"}
                    {step === "github-confirm" && "Confirm deployment"}
                    {step === "pg-config"      && "New Postgres database"}
                  </p>
                </div>
                <button onClick={closeModal} className="rounded-md p-1 hover:bg-black/5"><X size={15} className="text-black/40" /></button>
              </div>

              {flowError && (
                <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" /><p className="text-xs text-red-600">{flowError}</p>
                </div>
              )}

              {step === "pick-type" && (
                <div className="px-4 pb-3">
                  <input autoFocus type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-neutral-50 border border-black/12 rounded-lg px-3 py-2 text-sm text-black placeholder:text-black/30 focus:outline-none focus:border-black/30 mb-2" />
                  {filtered.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button key={option.key} onClick={() => option.available && handlePickType(option.key)} disabled={!option.available}
                        className={cn("flex items-center gap-3 w-full px-3 py-3 rounded-lg text-left transition-colors",
                          option.available ? "hover:bg-black/5 text-black" : "text-black/30 cursor-not-allowed")}>
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="text-sm font-medium flex-1">{option.label}</span>
                        {!option.available && <span className="text-[10px] bg-black/5 text-black/30 rounded px-1.5 py-0.5 font-medium">Soon</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {step === "pg-config" && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-black/60">Database name</label>
                    <input value={pgName} onChange={(e) => setPgName(e.target.value)} placeholder="app"
                      className="w-full bg-neutral-50 border border-black/12 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-black/30" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-black/60">Postgres version</label>
                    <div className="relative">
                      <select value={pgVersion} onChange={(e) => setPgVersion(e.target.value)}
                        className="w-full appearance-none bg-neutral-50 border border-black/12 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-black/30 pr-8">
                        {PG_VERSIONS.map((v) => <option key={v} value={v}>Postgres {v}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none" />
                    </div>
                  </div>
                  <p className="text-[11px] text-black/40">Installed natively on {targetVM?.name} (apt). Connection details appear on the card once ready.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setStep("pick-type")} className="flex-1 rounded-lg border border-black/12 py-2 text-xs font-semibold text-black/60 hover:bg-black/5">Back</button>
                    <button onClick={handleCreatePg} disabled={saving}
                      className="flex-1 rounded-lg bg-black text-white py-2 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {saving ? <><Loader2 size={12} className="animate-spin" /> Creating…</> : <><Database size={12} /> Create database</>}
                    </button>
                  </div>
                </div>
              )}

              {step === "github-connect" && (
                <div className="px-4 pb-4 space-y-4">
                  <div className="rounded-xl border border-black/10 bg-neutral-50 p-4 text-center space-y-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black mx-auto"><GitBranch size={22} className="text-white" /></div>
                    <div>
                      <p className="text-sm font-semibold text-black">Install GitHub App</p>
                      <p className="text-xs text-black/50 mt-1">Grant RachBase access to your repositories. You choose which repos to share.</p>
                    </div>
                  </div>
                  <button onClick={handleConnectGithub} disabled={connectingGithub}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-black text-white py-2.5 text-sm font-semibold hover:bg-neutral-800 disabled:opacity-60">
                    {connectingGithub ? <><Loader2 size={14} className="animate-spin" /> Waiting for installation…</> : <><GitBranch size={14} /> Install on GitHub</>}
                  </button>
                  <button onClick={checkGithubNow} disabled={checkingGithub}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-black/12 py-2 text-xs font-semibold text-black/60 hover:bg-black/5 disabled:opacity-60">
                    {checkingGithub ? <><Loader2 size={13} className="animate-spin" /> Checking…</> : <><RefreshCw size={13} /> I&apos;ve installed it — check now</>}
                  </button>
                  <p className="text-[11px] text-black/40 text-center">Already granted access on GitHub? Use this if the window didn&apos;t bring you back.</p>
                </div>
              )}

              {step === "github-repo" && (
                <div className="pb-3">
                  <div className="px-2 max-h-64 overflow-y-auto">
                    {reposLoading ? <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-black/30" /></div>
                      : repos.length === 0 ? <p className="text-center text-black/30 text-sm py-8">No repositories shared yet.</p>
                      : repos.map((repo) => (
                          <button key={repo.id} onClick={() => handleSelectRepo(repo)} className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover:bg-black/5 text-left">
                            <GitFork size={15} className="text-black/40 shrink-0" />
                            <div className="min-w-0 flex-1"><p className="text-sm font-medium text-black truncate">{repo.full_name}</p><p className="text-xs text-black/40">default: {repo.default_branch}</p></div>
                            {repo.private && <Lock size={11} className="text-black/30 shrink-0" />}
                          </button>
                        ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-4 pt-2 mt-1 border-t border-black/8">
                    <p className="text-[11px] text-black/40">Don&apos;t see a repo? Grant it access on GitHub.</p>
                    <div className="flex items-center gap-1">
                      <button onClick={loadRepos} disabled={reposLoading} title="Refresh"
                        className="p-1.5 rounded-md text-black/40 hover:bg-black/5 disabled:opacity-50"><RefreshCw size={13} className={cn(reposLoading && "animate-spin")} /></button>
                      <button onClick={manageRepoAccess}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-black/12 px-2.5 py-1.5 text-xs font-semibold text-black/70 hover:bg-black/5">
                        <GitBranch size={13} /> Add repository
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === "github-branch" && selectedRepo && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-xs text-black/50 font-mono">{selectedRepo.full_name}</p>
                  {branchesLoading ? <div className="flex items-center justify-center py-6"><Loader2 size={18} className="animate-spin text-black/30" /></div>
                    : (
                      <div className="relative">
                        <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}
                          className="w-full appearance-none bg-neutral-50 border border-black/12 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-black/30 pr-8">
                          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none" />
                      </div>
                    )}
                  <div className="flex gap-2">
                    <button onClick={() => setStep("github-repo")} className="flex-1 rounded-lg border border-black/12 py-2 text-xs font-semibold text-black/60 hover:bg-black/5">Back</button>
                    <button onClick={() => setStep("github-confirm")} disabled={!selectedBranch} className="flex-1 rounded-lg bg-black text-white py-2 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50">Continue</button>
                  </div>
                </div>
              )}

              {step === "github-confirm" && selectedRepo && targetVM && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="rounded-xl border border-black/10 bg-neutral-50 p-4 space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-black/50">Repository</span><span className="font-medium text-black font-mono text-xs">{selectedRepo.full_name}</span></div>
                    <div className="flex justify-between"><span className="text-black/50">Branch</span><span className="font-medium text-black font-mono text-xs">{selectedBranch}</span></div>
                    <div className="flex justify-between"><span className="text-black/50">Deploy to</span><span className="font-medium text-black text-xs">{targetVM.name}</span></div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-black/60">Root directory <span className="font-normal text-black/35">(optional — for monorepos)</span></label>
                    <input value={newRootDir} onChange={(e) => setNewRootDir(e.target.value)} placeholder="e.g. apps/web — leave blank for repo root"
                      className="w-full bg-neutral-50 border border-black/12 rounded-lg px-2.5 py-2 text-xs font-mono focus:outline-none focus:border-black/30" />
                    <p className="text-[11px] text-black/40">Only pushes that touch this folder will redeploy this service. A free port is assigned automatically.</p>
                  </div>
                  {(() => {
                    const norm = (p?: string) => (p || "").replace(/^\/+|\/+$/g, "");
                    const dup = services.some((s) =>
                      s.source_type !== "postgres" &&
                      s.vm_id === targetVM.id &&
                      s.repo_full_name === selectedRepo.full_name &&
                      s.branch === selectedBranch &&
                      norm((s.config as { root_dir?: string } | undefined)?.root_dir) === norm(newRootDir.trim()),
                    );
                    return dup ? (
                      <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                        <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-700">
                          A service for this repo, branch{newRootDir.trim() ? " and folder" : ""} already exists on {targetVM.name}. Creating another will run a duplicate — delete the old one first, or change the branch or root directory.
                        </p>
                      </div>
                    ) : null;
                  })()}
                  <div className="flex gap-2">
                    <button onClick={() => setStep("github-branch")} className="flex-1 rounded-lg border border-black/12 py-2 text-xs font-semibold text-black/60 hover:bg-black/5">Back</button>
                    <button onClick={handleConfirmGithub} disabled={saving} className="flex-1 rounded-lg bg-black text-white py-2 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {saving ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : <><CheckCircle2 size={12} /> Connect</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {chatOpen && token && (
        <div className="w-80 shrink-0 border-l border-black/10 flex flex-col"><AgentChat token={token} onClose={closeChat} /></div>
      )}

      {detailService && token && (
        <ServiceDetailPanel
          service={detailService}
          token={token}
          onDeploy={handleDeploy}
          onSaved={(svc) => { setServices((prev) => prev.map((s) => (s.id === svc.id ? svc : s))); setDetailService(svc); }}
          onDeleted={(id) => {
            setServices((prev) => prev.filter((s) => s.id !== id));
            setPos((prev) => { const n = { ...prev }; delete n[svcKey(id)]; return n; });
            setDetailService(null);
          }}
          onClose={() => setDetailService(null)}
        />
      )}
    </div>
  );
}

// ─── Service detail panel (Railway-style tabs) ───────────────────────────────

type DetailTab = "deployments" | "variables" | "settings" | "logs" | "connect" | "monitoring";

function ServiceDetailPanel({
  service, token, onDeploy, onSaved, onDeleted, onClose,
}: {
  service: DeploymentService;
  token: string;
  onDeploy: (s: DeploymentService) => void;
  onSaved: (s: DeploymentService) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
}) {
  const isPg = service.source_type === "postgres";
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [delErr, setDelErr]         = useState("");

  const doDelete = async () => {
    setDeleting(true); setDelErr("");
    try { await deployment.deleteService(token, service.id); onDeleted(service.id); }
    catch (e) { setDelErr((e as Error).message); setDeleting(false); }
  };

  // VM Logs entitlement (paid add-on, admin-assigned per VM). null = loading.
  const [logsEntitled, setLogsEntitled] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    expansion.hasLogs(token)
      .then((d) => { if (!cancelled) setLogsEntitled(d.unlimited || !!d.logs_vm_ids?.includes(service.vm_id)); })
      .catch(() => { if (!cancelled) setLogsEntitled(false); });
    return () => { cancelled = true; };
  }, [token, service.vm_id]);

  const tabs: { key: DetailTab; label: string; icon: React.ReactNode }[] = isPg
    ? [
        { key: "variables", label: "Variables", icon: <SlidersHorizontal size={13} /> },
        { key: "connect",   label: "Connect",   icon: <Link2 size={13} /> },
      ]
    : [
        { key: "deployments", label: "Deployments", icon: <Rocket size={13} /> },
        { key: "variables",   label: "Variables",   icon: <SlidersHorizontal size={13} /> },
        { key: "settings",    label: "Settings",    icon: <Settings2 size={13} /> },
        { key: "logs",        label: "Logs",        icon: <ScrollText size={13} /> },
        { key: "monitoring",  label: "Monitoring",  icon: <Activity size={13} /> },
      ];
  const [tab, setTab] = useState<DetailTab>(tabs[0].key);

  const title = isPg
    ? (service.name || "postgres")
    : (service.repo_full_name?.split("/").slice(-1)[0] || "service");

  const Icon = isPg ? Database : GitBranch;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white border border-black/12 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/8">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid place-items-center w-8 h-8 rounded-lg bg-black/5 text-black/60"><Icon size={15} /></div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-black truncate">{title}</p>
              <p className="text-[11px] text-black/40 font-mono truncate">{isPg ? "PostgreSQL service" : service.repo_full_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-black/5"><X size={16} className="text-black/40" /></button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-3 border-b border-black/8">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors",
                tab === t.key
                  ? "border-black text-black"
                  : "border-transparent text-black/40 hover:text-black/70",
              )}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {tab === "deployments" && <DeploymentsTab service={service} token={token} onDeploy={onDeploy} logsEntitled={logsEntitled} />}
          {tab === "variables"   && <VariablesTab   service={service} token={token} />}
          {tab === "settings"    && <SettingsTab    service={service} token={token} onSaved={onSaved} />}
          {tab === "logs"        && <LogsTab        service={service} token={token} logsEntitled={logsEntitled} />}
          {tab === "connect"     && <ConnectTab     service={service} />}
          {tab === "monitoring"  && <MonitoringTab  service={service} token={token} />}
        </div>

        {/* Danger zone — delete service */}
        <div className="border-t border-black/8 px-5 py-3 bg-neutral-50/60">
          {delErr && <p className="mb-2 flex items-center gap-1.5 text-xs text-red-600"><AlertCircle size={12} /> {delErr}</p>}
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700">
              <Trash2 size={13} /> Delete service
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-black/50">
                Remove <span className="font-semibold">{isPg ? (service.name || "this database") : (service.repo_full_name?.split("/").slice(-1)[0] || "this service")}</span>?
                {isPg ? " The database files stay on the VM." : " Stops it and removes its files, systemd unit, and domains."}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setConfirmDel(false)} disabled={deleting}
                  className="rounded-lg border border-black/12 px-3 py-1.5 text-xs font-semibold text-black/60 hover:bg-black/5 disabled:opacity-50">Cancel</button>
                <button onClick={doDelete} disabled={deleting}
                  className="rounded-lg bg-red-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5">
                  {deleting ? <><Loader2 size={12} className="animate-spin" /> Deleting…</> : <><Trash2 size={12} /> Delete</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Deployments tab ─────────────────────────────────────────────────────────

// Shown in the Deployments / Logs tabs when VM Logs isn't purchased for the VM.
function LogsPaywall() {
  return (
    <div className="mx-1 my-2 rounded-xl border border-amber-200 bg-amber-50 p-5 text-center space-y-2">
      <div className="mx-auto grid place-items-center w-10 h-10 rounded-lg bg-amber-100 text-amber-700"><LockIcon size={18} /></div>
      <p className="text-sm font-semibold text-amber-800">VM Logs is a paid add-on</p>
      <p className="text-xs text-amber-700/90 max-w-sm mx-auto">Deployment &amp; runtime logs for this VM require the VM Logs add-on. Purchase it from Billing, then an admin enables it for this VM.</p>
      <a href="/dashboard/billing" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-700">
        Go to Billing
      </a>
    </div>
  );
}

function DeploymentsTab({ service, token, onDeploy, logsEntitled }: { service: DeploymentService; token: string; onDeploy: (s: DeploymentService) => void; logsEntitled: boolean | null }) {
  const [logs, setLogs]       = useState<{ id: number; status: string; log_output: string; started_at: string; finished_at: string | null; commit_sha: string | null; triggered_by: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [open, setOpen]       = useState<number | null>(null);

  const load = useCallback(() => {
    if (logsEntitled === false) { setLoading(false); return; }
    setLoading(true); setError("");
    deployment.getDeployLogs(token, service.id)
      .then((d) => setLogs(d.logs))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [token, service.id, logsEntitled]);

  useEffect(() => { if (logsEntitled !== null) load(); }, [load, logsEntitled]);

  const badge = (s: string) => cn(
    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize",
    s === "success" || s === "live" ? "bg-emerald-100 text-emerald-700" :
    s === "failed" || s === "error" ? "bg-red-100 text-red-700" :
    "bg-amber-100 text-amber-700",
  );

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-black/60">Deployment history</p>
        <div className="flex items-center gap-1.5">
          <button onClick={load} disabled={loading} className="p-1.5 rounded-md text-black/40 hover:bg-black/5 disabled:opacity-50"><RefreshCw size={13} className={cn(loading && "animate-spin")} /></button>
          <button onClick={() => onDeploy(service)}
            className="inline-flex items-center gap-1 rounded-lg bg-black text-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-800">
            <Rocket size={12} /> Deploy
          </button>
        </div>
      </div>

      {error && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertCircle size={12} /> {error}</p>}

      {logsEntitled === null ? (
        <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-black/30" /></div>
      ) : logsEntitled === false ? (
        <LogsPaywall />
      ) : loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-black/30" /></div>
      ) : logs.length === 0 ? (
        <p className="text-center text-black/30 text-sm py-8">No deployments yet. Hit Deploy to ship the latest commit.</p>
      ) : (
        <div className="space-y-1.5">
          {logs.map((l) => (
            <div key={l.id} className="rounded-lg border border-black/10 overflow-hidden">
              <button onClick={() => setOpen(open === l.id ? null : l.id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/[0.02] text-left">
                <span className={badge(l.status)}>{l.status}</span>
                <GitCommit size={12} className="text-black/30 shrink-0" />
                <span className="text-xs font-mono text-black/60 shrink-0">{l.commit_sha ? l.commit_sha.slice(0, 7) : "—"}</span>
                <span className="text-[11px] text-black/40 truncate flex-1">by {l.triggered_by}</span>
                <span className="text-[11px] text-black/35 shrink-0">{new Date(l.started_at).toLocaleString()}</span>
                <ChevronDown size={13} className={cn("text-black/30 shrink-0 transition-transform", open === l.id && "rotate-180")} />
              </button>
              {open === l.id && (
                <pre className="max-h-64 overflow-auto bg-neutral-950 text-neutral-100 text-[11px] leading-relaxed font-mono p-3 whitespace-pre-wrap border-t border-black/8">
                  {l.log_output || "(no output)"}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Connect tab (Postgres connection details) ───────────────────────────────

function ConnectTab({ service }: { service: DeploymentService }) {
  const cfg = (service.config || {}) as Record<string, unknown>;
  const host = String(cfg.host ?? cfg.hostname ?? "");
  const port = String(cfg.port ?? "5432");
  const db   = String(cfg.database ?? cfg.db_name ?? "");
  const user = String(cfg.user ?? cfg.username ?? "");
  const pass = String(cfg.password ?? "");
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState("");

  const uri = host && user
    ? `postgresql://${user}:${reveal ? pass : "••••••"}@${host}:${port}/${db}`
    : "";
  const realUri = host && user ? `postgresql://${user}:${pass}@${host}:${port}/${db}` : "";

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(""), 1200); }).catch(() => {});
  };

  const row = (label: string, value: string) => (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[11px] font-semibold text-black/45">{label}</span>
      <code className="flex-1 truncate text-xs font-mono text-black bg-neutral-50 border border-black/10 rounded-lg px-2.5 py-1.5">{value || "—"}</code>
      {value && (
        <button onClick={() => copy(value, label)} className="shrink-0 p-1.5 rounded-md text-black/30 hover:text-black/70 hover:bg-black/5">
          {copied === label ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} />}
        </button>
      )}
    </div>
  );

  if (!host) {
    return <p className="px-5 py-10 text-center text-sm text-black/30">Not provisioned yet. Hit Provision on the service card, then reopen this tab.</p>;
  }

  return (
    <div className="px-5 py-4 space-y-3">
      <p className="text-xs font-semibold text-black/60">Connection details</p>
      {row("Host", host)}
      {row("Port", port)}
      {row("Database", db)}
      {row("User", user)}
      <div className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-[11px] font-semibold text-black/45">Password</span>
        <code className="flex-1 truncate text-xs font-mono text-black bg-neutral-50 border border-black/10 rounded-lg px-2.5 py-1.5">{reveal ? pass : "••••••••••"}</code>
        <button onClick={() => setReveal((v) => !v)} className="shrink-0 p-1.5 rounded-md text-black/30 hover:text-black/70 hover:bg-black/5">{reveal ? <EyeOff size={13} /> : <Eye size={13} />}</button>
        <button onClick={() => copy(pass, "Password")} className="shrink-0 p-1.5 rounded-md text-black/30 hover:text-black/70 hover:bg-black/5">{copied === "Password" ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} />}</button>
      </div>

      <div className="pt-2 space-y-1.5">
        <p className="text-[11px] font-semibold text-black/45">Connection string</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate text-xs font-mono text-black bg-neutral-950 text-neutral-100 rounded-lg px-2.5 py-2">{uri}</code>
          <button onClick={() => copy(realUri, "URI")} className="shrink-0 p-1.5 rounded-md text-black/30 hover:text-black/70 hover:bg-black/5">{copied === "URI" ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} />}</button>
        </div>
      </div>
      <p className="text-[11px] text-black/40">Reachable from services on the same VM at <code className="font-mono">127.0.0.1:{port}</code>.</p>
    </div>
  );
}

// ─── Service settings (build/start commands) ─────────────────────────────────

function SettingsTab({ service, token, onSaved }: { service: DeploymentService; token: string; onSaved: (s: DeploymentService) => void }) {
  const cfg = (service.config || {}) as Record<string, unknown>;
  const [form, setForm] = useState({
    root_dir:    String(cfg.root_dir ?? ""),
    install_cmd: String(cfg.install_cmd ?? "npm ci || npm install"),
    build_cmd:   String(cfg.build_cmd ?? "npm run build --if-present"),
    start_cmd:   String(cfg.start_cmd ?? "npm start"),
    port:        String(cfg.port ?? "3000"),
    watch_paths: Array.isArray(cfg.watch_paths) ? (cfg.watch_paths as string[]).join(", ") : "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState("");

  // Domains (Caddy)
  const [domains, setDomains]   = useState<ServiceDomain[]>([]);
  const [host, setHost]         = useState("");
  const [domErr, setDomErr]     = useState("");
  const [domBusy, setDomBusy]   = useState(false);
  const [genBusy, setGenBusy]   = useState(false);
  const [sub, setSub]           = useState(() => {
    const base = (service.name || service.repo_full_name?.split("/").slice(-1)[0] || "app")
      .toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);
    return base || "app";
  });

  const loadDomains = useCallback(() => {
    deployment.getDomains(token, service.id).then((d) => setDomains(d.domains)).catch(() => {});
  }, [token, service.id]);

  useEffect(() => { loadDomains(); }, [loadDomains]);

  // Poll while any domain is provisioning.
  useEffect(() => {
    if (!domains.some((d) => d.status === "provisioning")) return;
    const t = setInterval(loadDomains, 4000);
    return () => clearInterval(t);
  }, [domains, loadDomains]);

  const addDomain = async () => {
    const h = host.trim().toLowerCase();
    if (!h) return;
    setDomBusy(true); setDomErr("");
    try {
      await deployment.addDomain(token, service.id, h);
      setHost("");
      loadDomains();
    } catch (e) { setDomErr((e as Error).message); }
    finally { setDomBusy(false); }
  };

  const removeDomain = async (id: number) => {
    try { await deployment.removeDomain(token, service.id, id); loadDomains(); }
    catch (e) { setDomErr((e as Error).message); }
  };

  const generate = async () => {
    const s = sub.trim().toLowerCase();
    if (!s) return;
    setGenBusy(true); setDomErr("");
    try { await deployment.addAutoDomain(token, service.id, s); loadDomains(); }
    catch (e) { setDomErr((e as Error).message); }
    finally { setGenBusy(false); }
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      const { service: updated } = await deployment.updateServiceConfig(token, service.id, {
        root_dir: form.root_dir.trim(),
        install_cmd: form.install_cmd.trim(),
        build_cmd: form.build_cmd.trim(),
        start_cmd: form.start_cmd.trim(),
        port: Number(form.port) || 3000,
        watch_paths: form.watch_paths.split(",").map((p) => p.trim()).filter(Boolean),
      });
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const field = (label: string, key: keyof typeof form, mono = true) => (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-black/60">{label}</label>
      <input value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        className={cn("w-full bg-neutral-50 border border-black/12 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-black/30", mono && "font-mono")} />
    </div>
  );

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="space-y-3">
          <p className="text-xs font-semibold text-black/60">Build &amp; start</p>
          {field("Root directory (optional)", "root_dir")}
          {field("Install command", "install_cmd")}
          {field("Build command", "build_cmd")}
          {field("Start command", "start_cmd")}
          {field("Port", "port")}
          {field("Watch paths (optional, comma-separated)", "watch_paths")}
          <p className="text-[11px] text-black/40 -mt-1">Pushes touching these folders redeploy this service. Defaults to the root directory. Add extras like <code className="font-mono">packages/shared</code> if this service depends on them.</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-black/40">Runs on the VM under systemd. Env vars (Variables) are injected at start.</p>
            <button onClick={save} disabled={saving}
              className="shrink-0 rounded-lg bg-black text-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-1.5">
              {saving ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : saved ? <><CheckCircle2 size={12} /> Saved</> : "Save"}
            </button>
          </div>
          {error && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertCircle size={12} /> {error}</p>}

          {/* Domains */}
          <div className="pt-3 mt-1 border-t border-black/8 space-y-2">
            <div className="flex items-center gap-1.5">
              <Globe size={13} className="text-black/50" />
              <span className="text-xs font-semibold text-black/60">Domains</span>
            </div>
            {domains.length > 0 && (
              <div className="space-y-1.5">
                {domains.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-lg border border-black/10 px-2.5 py-1.5">
                    <span className="text-xs font-mono text-black truncate flex-1">{d.hostname}</span>
                    <span className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      d.status === "live" ? "bg-emerald-100 text-emerald-700" :
                      d.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700",
                    )}>{d.status}</span>
                    <button onClick={() => removeDomain(d.id)} title="Remove"
                      className="shrink-0 p-1 rounded-md text-black/30 hover:text-red-600 hover:bg-red-50"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            {/* Free RachBase domain */}
            <div className="rounded-lg bg-neutral-50 border border-black/10 p-2.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-black/50">Free RachBase domain</p>
              <div className="flex items-center gap-1">
                <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="myapp"
                  className="w-32 bg-white border border-black/12 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-black/30" />
                <span className="text-xs text-black/40 font-mono">.rachbase.com</span>
                <div className="flex-1" />
                <button onClick={generate} disabled={genBusy || !sub.trim()}
                  className="shrink-0 rounded-lg bg-primary-blue px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-1">
                  {genBusy ? <Loader2 size={12} className="animate-spin" /> : "Generate"}
                </button>
              </div>
            </div>

            {/* Custom domain */}
            <div className="flex items-center gap-2">
              <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="app.example.com (custom domain)"
                onKeyDown={(e) => e.key === "Enter" && addDomain()}
                className="flex-1 bg-neutral-50 border border-black/12 rounded-lg px-2.5 py-2 text-xs font-mono focus:outline-none focus:border-black/30" />
              <button onClick={addDomain} disabled={domBusy || !host.trim()}
                className="shrink-0 rounded-lg bg-black/5 px-3 py-2 text-xs font-semibold text-black/70 hover:bg-black/10 disabled:opacity-50">
                {domBusy ? <Loader2 size={12} className="animate-spin" /> : "Add"}
              </button>
            </div>
            <p className="text-[11px] text-black/40">Custom domains: point the DNS A record at the VM&apos;s IP; Caddy issues HTTPS automatically.</p>
            {domErr && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertCircle size={12} /> {domErr}</p>}
          </div>
      </div>
    </div>
  );
}

// ─── Runtime logs (journalctl) ───────────────────────────────────────────────

function LogsTab({ service, token, logsEntitled }: { service: DeploymentService; token: string; logsEntitled: boolean | null }) {
  const [logs, setLogs]       = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const load = useCallback(() => {
    if (logsEntitled === false) { setLoading(false); return; }
    setLoading(true); setError("");
    deployment.getRuntimeLogs(token, service.id)
      .then((d) => setLogs(d.logs))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [token, service.id, logsEntitled]);

  useEffect(() => { if (logsEntitled !== null) load(); }, [load, logsEntitled]);

  if (logsEntitled === null) return <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-black/30" /></div>;
  if (logsEntitled === false) return <div className="px-5 py-4"><LogsPaywall /></div>;

  return (
    <div className="px-5 py-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-black/60">Runtime logs <span className="text-black/35 font-normal">(journalctl)</span></p>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-md text-black/40 hover:bg-black/5 disabled:opacity-50"><RefreshCw size={13} className={cn(loading && "animate-spin")} /></button>
      </div>
      {error ? (
        <p className="text-xs text-red-600 py-4">{error}</p>
      ) : (
        <pre className="max-h-[55vh] overflow-auto rounded-lg bg-neutral-950 text-neutral-100 text-[11px] leading-relaxed font-mono p-3 whitespace-pre-wrap">
          {loading ? "Loading…" : (logs || "(no logs)")}
        </pre>
      )}
    </div>
  );
}

// ─── Application Workload Monitoring (endpoint health checks) ─────────────────

function MonitoringTab({ service, token }: { service: DeploymentService; token: string }) {
  const [eps, setEps]         = useState<MonitoredEndpoint[]>([]);
  const [quota, setQuota]     = useState<{ quota: number | null; used: number; unlimited: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [adding, setAdding]   = useState(false);
  const [busy, setBusy]       = useState(false);
  const [form, setForm]       = useState({ name: "", url: "", expected_status: "200", interval_seconds: "300" });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([endpoints.list(token, service.id), endpoints.getQuota(token)])
      .then(([l, q]) => { setEps(l.endpoints); setQuota(q); })
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, [token, service.id]);

  useEffect(() => { load(); }, [load]);
  // Keep statuses fresh while the tab is open.
  useEffect(() => {
    const t = setInterval(() => { endpoints.list(token, service.id).then((l) => setEps(l.endpoints)).catch(() => {}); }, 15000);
    return () => clearInterval(t);
  }, [token, service.id]);

  const noQuota      = !!quota && quota.quota === 0 && !quota.unlimited;
  const quotaReached = !!quota && quota.quota !== null && !quota.unlimited && quota.used >= quota.quota;

  const create = async () => {
    if (!form.name.trim() || !form.url.trim()) return;
    setBusy(true); setErr("");
    try {
      await endpoints.create(token, {
        name: form.name.trim(), url: form.url.trim(),
        expected_status: Number(form.expected_status) || 200,
        interval_seconds: Number(form.interval_seconds) || 300,
        service_id: service.id,
      });
      setForm({ name: "", url: "", expected_status: "200", interval_seconds: "300" });
      setAdding(false); load();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  const toggle = async (ep: MonitoredEndpoint) => { try { await endpoints.update(token, ep.id, { enabled: !ep.enabled }); load(); } catch (e) { setErr((e as Error).message); } };
  const remove = async (id: number) => { try { await endpoints.remove(token, id); load(); } catch (e) { setErr((e as Error).message); } };

  const dot = (ep: MonitoredEndpoint) => {
    const s = !ep.enabled ? "paused" : ep.last_status;
    const cls = s === "up" ? "bg-emerald-500" : s === "down" ? "bg-red-500" : s === "paused" ? "bg-black/25" : "bg-amber-400";
    return <span className={cn("shrink-0 w-2 h-2 rounded-full", cls)} title={s || "pending"} />;
  };

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-black/30" /></div>;

  if (noQuota) {
    return (
      <div className="px-5 py-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center space-y-2">
          <div className="mx-auto grid place-items-center w-10 h-10 rounded-lg bg-amber-100 text-amber-700"><LockIcon size={18} /></div>
          <p className="text-sm font-semibold text-amber-800">Application Workload Monitoring is a paid add-on</p>
          <p className="text-xs text-amber-700/90 max-w-sm mx-auto">Monitor your app&apos;s endpoints with uptime checks and failure alerts. Purchase monitoring slots (per endpoint) from Billing to enable it.</p>
          <a href="/dashboard/billing" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-700">Go to Billing</a>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-black/60">Endpoint monitoring</p>
        <div className="flex items-center gap-2">
          {quota && !quota.unlimited && (
            <span className="text-[11px] text-black/45 font-mono">{quota.used}/{quota.quota} slots</span>
          )}
          <button onClick={() => setAdding((v) => !v)} disabled={quotaReached}
            title={quotaReached ? "Endpoint quota reached — buy more slots" : "Add endpoint"}
            className="inline-flex items-center gap-1 rounded-lg bg-black text-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50">
            <Plus size={12} /> Add
          </button>
        </div>
      </div>

      {err && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertCircle size={12} /> {err}</p>}

      {adding && (
        <div className="rounded-lg border border-black/10 bg-neutral-50 p-3 space-y-2">
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name (e.g. API health)"
            className="w-full bg-white border border-black/12 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-black/30" />
          <input value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://api.example.com/health"
            className="w-full bg-white border border-black/12 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-black/30" />
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-black/45">Expects</label>
            <input value={form.expected_status} onChange={(e) => setForm((p) => ({ ...p, expected_status: e.target.value }))}
              className="w-16 bg-white border border-black/12 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-black/30" />
            <label className="text-[11px] text-black/45">every</label>
            <input value={form.interval_seconds} onChange={(e) => setForm((p) => ({ ...p, interval_seconds: e.target.value }))}
              className="w-16 bg-white border border-black/12 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-black/30" />
            <span className="text-[11px] text-black/45">sec</span>
            <div className="flex-1" />
            <button onClick={create} disabled={busy || !form.name.trim() || !form.url.trim()}
              className="rounded-lg bg-black text-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-1.5">
              {busy ? <><Loader2 size={12} className="animate-spin" /> Adding…</> : "Add endpoint"}
            </button>
          </div>
        </div>
      )}

      {eps.length === 0 ? (
        <p className="text-center text-black/30 text-sm py-8">No endpoints monitored yet.</p>
      ) : (
        <div className="space-y-1.5">
          {eps.map((ep) => (
            <div key={ep.id} className="rounded-lg border border-black/10 px-3 py-2">
              <div className="flex items-center gap-2">
                {dot(ep)}
                <span className="text-sm font-medium text-black truncate">{ep.name}</span>
                <span className="text-[10px] font-semibold uppercase text-black/35">{ep.method}</span>
                <div className="flex-1" />
                <button onClick={() => toggle(ep)} title={ep.enabled ? "Pause" : "Resume"}
                  className={cn("p-1.5 rounded-md hover:bg-black/5", ep.enabled ? "text-black/40" : "text-emerald-600")}><Power size={13} /></button>
                <button onClick={() => remove(ep.id)} title="Delete"
                  className="p-1.5 rounded-md text-black/30 hover:text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>
              </div>
              <p className="text-[11px] font-mono text-black/45 truncate mt-0.5">{ep.url}</p>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-black/40">
                <span>expects {ep.expected_status}</span>
                <span>every {ep.interval_seconds}s</span>
                {ep.last_checked_at ? (
                  <span className={cn(ep.last_status === "down" && "text-red-600")}>
                    last: {ep.last_status === "up" ? "up" : ep.last_status === "down" ? `down${ep.last_code ? ` (${ep.last_code})` : ep.last_error ? ` (${ep.last_error})` : ""}` : "—"}
                    {ep.last_latency_ms != null && ` · ${ep.last_latency_ms}ms`}
                  </span>
                ) : <span>not checked yet</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Environment variables editor ────────────────────────────────────────────

function VariablesTab({ service, token }: { service: DeploymentService; token: string }) {
  const [rows, setRows]       = useState<ServiceEnvVar[]>([]);
  const [reveal, setReveal]   = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    deployment.getEnv(token, service.id)
      .then((d) => { if (!cancelled) setRows(d.vars); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, service.id]);

  const update = (i: number, patch: Partial<ServiceEnvVar>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, { key: "", value: "", is_secret: true }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i));

  const save = async () => {
    setSaving(true); setError("");
    try {
      const clean = rows.filter((r) => /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(r.key.trim()));
      const { count } = await deployment.setEnv(token, service.id, clean.map((r) => ({ ...r, key: r.key.trim() })));
      setRows(clean);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      void count;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-black/60">Environment variables</p>
        <button onClick={save} disabled={saving || loading}
          className="rounded-lg bg-black text-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-1.5">
          {saving ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : saved ? <><CheckCircle2 size={12} /> Saved</> : "Save"}
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" /><p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      <div className="max-h-[55vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-black/30" /></div>
          ) : rows.length === 0 ? (
            <p className="text-center text-black/30 text-sm py-6">No variables yet.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={row.key}
                    onChange={(e) => update(i, { key: e.target.value })}
                    placeholder="KEY"
                    className="w-40 shrink-0 bg-neutral-50 border border-black/12 rounded-lg px-2.5 py-2 text-xs font-mono focus:outline-none focus:border-black/30"
                  />
                  <div className="relative flex-1">
                    <input
                      value={row.value}
                      onChange={(e) => update(i, { value: e.target.value })}
                      type={row.is_secret && !reveal[i] ? "password" : "text"}
                      placeholder="value"
                      className="w-full bg-neutral-50 border border-black/12 rounded-lg pl-2.5 pr-8 py-2 text-xs font-mono focus:outline-none focus:border-black/30"
                    />
                    {row.is_secret && (
                      <button type="button" onClick={() => setReveal((r) => ({ ...r, [i]: !r[i] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60">
                        {reveal[i] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    )}
                  </div>
                  <button type="button" onClick={() => removeRow(i)} title="Remove"
                    className="shrink-0 p-1.5 rounded-md text-black/30 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {!loading && (
            <button onClick={addRow} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-blue hover:underline">
              <Plus size={12} /> Add variable
            </button>
          )}
      </div>
      <p className="text-[11px] text-black/35 mt-3">Secrets are encrypted at rest.</p>
    </div>
  );
}
