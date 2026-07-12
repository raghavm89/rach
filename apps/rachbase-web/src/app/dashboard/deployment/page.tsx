"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, GitBranch, Database, Layers, Box, Zap, Archive,
  Server, Cpu, MemoryStick, RefreshCw, AlertCircle, ServerOff,
  GitFork, CheckCircle2, ChevronDown, Loader2, Lock, X, TerminalSquare, Bot,
} from "lucide-react";
import { useAuth } from "@rach/ui/contexts/AuthContext";
import { monitoring, deployment, VM, GithubRepo, DeploymentService } from "@rach/ui/lib/api";
import { cn } from "@rach/ui/lib/utils";
import { useSearchParams, useRouter } from "next/navigation";
import { AgentChat } from "@/components/dashboard/AgentChat";
import { useTerminal } from "@/contexts/TerminalContext";
import { useChat } from "@/contexts/ChatContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalStep = "pick-type" | "github-connect" | "github-repo" | "github-branch" | "github-confirm";

// ─── Add options ──────────────────────────────────────────────────────────────

const addOptions = [
  { label: "GitHub Repository", icon: GitBranch, key: "github",   available: true },
  { label: "Database",          icon: Database,  key: "database",  available: false },
  { label: "Template",          icon: Layers,    key: "template",  available: false },
  { label: "Docker Image",      icon: Box,       key: "docker",    available: false },
  { label: "Function",          icon: Zap,       key: "function",  available: false },
  { label: "Bucket",            icon: Archive,   key: "bucket",    available: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function UsageBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-red-500" : pct >= 60 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

// ─── Service card on VM ───────────────────────────────────────────────────────

function ServiceCard({ service }: { service: DeploymentService }) {
  const [repo] = service.repo_full_name.split("/").slice(-1);
  return (
    <div className="flex items-center gap-2 bg-black/5 border border-black/10 rounded-lg px-3 py-2">
      <GitBranch size={12} className="text-black/40 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-black truncate">{repo}</p>
        <p className="text-[10px] text-black/40 font-mono">{service.branch}</p>
      </div>
      <span className={cn(
        "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        service.status === "deployed"   ? "bg-emerald-100 text-emerald-700" :
        service.status === "deploying"  ? "bg-blue-100 text-blue-700" :
        service.status === "failed"     ? "bg-red-100 text-red-700" :
                                          "bg-neutral-100 text-neutral-600"
      )}>
        {service.status}
      </span>
    </div>
  );
}

// ─── VM Card ─────────────────────────────────────────────────────────────────

function VMCard({
  vm, services, onDeploy, onTerminal,
}: {
  vm: VM;
  services: DeploymentService[];
  onDeploy: (vm: VM) => void;
  onTerminal: (vm: VM) => void;
}) {
  const isRunning = vm.status === "running";
  const vmServices = services.filter((s) => s.vm_id === vm.id);

  return (
    <div className="bg-white rounded-xl border border-black/12 shadow-sm p-4 flex flex-col gap-3 w-72">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
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
          isRunning ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
        )}>
          <span className={cn("h-1.5 w-1.5 rounded-full", isRunning ? "bg-emerald-500" : "bg-neutral-400")} />
          {vm.status}
        </span>
      </div>

      {/* Metrics */}
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-black/50"><Cpu size={11} /> CPU</span>
            <span className={cn("font-mono font-medium", vm.cpuPct >= 80 ? "text-red-600" : "text-black/70")}>
              {vm.cpuPct}%
            </span>
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

      {/* Connected services */}
      {vmServices.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-black/40 uppercase tracking-wider">Services</p>
          {vmServices.map((s) => <ServiceCard key={s.id} service={s} />)}
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex gap-2">
        <button
          onClick={() => onDeploy(vm)}
          disabled={!isRunning}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-black/20 py-2 text-xs font-semibold text-black/50 hover:border-black/40 hover:text-black hover:bg-black/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={12} />
          Deploy
        </button>
        <button
          onClick={() => onTerminal(vm)}
          disabled={!isRunning}
          title="Open SSH terminal"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-black/15 px-3 py-2 text-xs font-semibold text-black/50 hover:border-black/40 hover:text-black hover:bg-black/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <TerminalSquare size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DeploymentPage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // VM + service data
  const [vms, setVMs]               = useState<VM[]>([]);
  const [services, setServices]     = useState<DeploymentService[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState("");

  // GitHub App connection status
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubAccount, setGithubAccount]     = useState<string | null>(null);

  // Modal
  const [modalOpen, setModalOpen]     = useState(false);
  const [step, setStep]               = useState<ModalStep>("pick-type");
  const [targetVM, setTargetVM]       = useState<VM | null>(null);
  const [search, setSearch]           = useState("");

  // GitHub flow state
  const [connectingGithub, setConnectingGithub] = useState(false);
  const [repos, setRepos]             = useState<GithubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [branches, setBranches]       = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [saving, setSaving]           = useState(false);
  const [flowError, setFlowError]     = useState("");

  // Terminal — persists across navigation via context
  const { openTerminal } = useTerminal();

  // Chat panel — shared via context so layout can offset terminal
  const { chatOpen, closeChat, toggleChat } = useChat();

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const [vmsData, servicesData, githubStatus] = await Promise.all([
        monitoring.getVMs(token),
        deployment.listServices(token),
        deployment.getGithubStatus(token),
      ]);
      setVMs(vmsData.vms);
      setServices(servicesData.services);
      setGithubConnected(githubStatus.connected);
      setGithubAccount(githubStatus.github_account || null);
    } catch (err) {
      setError((err as Error).message || "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Handle GitHub callback redirects
  useEffect(() => {
    const connected = searchParams.get("github_connected");
    const ghError   = searchParams.get("github_error");
    if (connected === "1") {
      fetchAll();
      router.replace("/dashboard/deployment");
    }
    if (ghError) {
      setFlowError(decodeURIComponent(ghError));
      router.replace("/dashboard/deployment");
    }
  }, [searchParams, fetchAll, router]);

  // ── Modal helpers ───────────────────────────────────────────────────────────

  const openDeploy = (vm: VM) => {
    setTargetVM(vm);
    setStep("pick-type");
    setSearch("");
    setFlowError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedRepo(null);
    setSelectedBranch("");
    setBranches([]);
    setRepos([]);
    setFlowError("");
  };

  const handlePickType = async (key: string) => {
    if (key !== "github") return; // others coming soon
    setFlowError("");
    if (!githubConnected) {
      setStep("github-connect");
    } else {
      setStep("github-repo");
      loadRepos();
    }
  };

  const handleConnectGithub = async () => {
    if (!token) return;
    setConnectingGithub(true);
    setFlowError("");
    try {
      const { install_url } = await deployment.getInstallUrl(token);
      window.open(install_url, "_blank", "noopener");
      // Poll for connection
      const poll = setInterval(async () => {
        try {
          const status = await deployment.getGithubStatus(token);
          if (status.connected) {
            clearInterval(poll);
            setGithubConnected(true);
            setGithubAccount(status.github_account || null);
            setConnectingGithub(false);
            setStep("github-repo");
            loadRepos();
          }
        } catch { /* ignore */ }
      }, 3000);
      // Stop polling after 5 minutes
      setTimeout(() => { clearInterval(poll); setConnectingGithub(false); }, 300000);
    } catch (err) {
      setFlowError((err as Error).message);
      setConnectingGithub(false);
    }
  };

  const loadRepos = async () => {
    if (!token) return;
    setReposLoading(true);
    setFlowError("");
    try {
      const data = await deployment.listRepos(token);
      setRepos(data.repos);
    } catch (err) {
      setFlowError((err as Error).message);
    } finally {
      setReposLoading(false);
    }
  };

  const handleSelectRepo = async (repo: GithubRepo) => {
    if (!token) return;
    setSelectedRepo(repo);
    setSelectedBranch(repo.default_branch);
    setStep("github-branch");
    setBranchesLoading(true);
    setFlowError("");
    try {
      const data = await deployment.listBranches(token, repo.full_name);
      setBranches(data.branches);
    } catch (err) {
      setFlowError((err as Error).message);
    } finally {
      setBranchesLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!token || !targetVM || !selectedRepo || !selectedBranch) return;
    setSaving(true);
    setFlowError("");
    try {
      const { service } = await deployment.createService(token, {
        vm_id:          targetVM.id,
        repo_full_name: selectedRepo.full_name,
        branch:         selectedBranch,
      });
      setServices((prev) => [service, ...prev]);
      closeModal();
    } catch (err) {
      setFlowError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = addOptions.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex w-full min-h-[calc(100vh-64px)] rounded-xl border border-black/12 overflow-hidden" style={{ isolation: "isolate" }}>
    {/* ── Canvas ── */}
    <div className="relative flex-1 bg-white overflow-hidden">
      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Toolbar */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button
          onClick={toggleChat}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors shadow-sm",
            chatOpen
              ? "bg-primary-blue text-white border-primary-blue"
              : "bg-white border-black/12 text-black/60 hover:text-black hover:bg-black/5"
          )}
        >
          <Bot size={13} />
          Agent
        </button>
        {githubConnected && githubAccount && (
          <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-black/12 text-xs text-black/50 shadow-sm">
            <GitFork size={12} />
            {githubAccount}
          </span>
        )}
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-black/12 text-xs font-medium text-black/60 hover:text-black hover:bg-black/5 transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={12} className={cn(refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 pt-16">
        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/20 border-t-black/60" />
          </div>
        )}
        {error && !loading && (() => {
          const isNoVMs = error.toLowerCase().includes('no vm') || error.toLowerCase().includes('assigned');
          return isNoVMs ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-center max-w-sm mx-auto">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5">
                <ServerOff size={28} className="text-black/30" />
              </div>
              <div>
                <p className="font-semibold text-black/70">No VMs assigned yet</p>
                <p className="mt-1 text-sm text-black/40">Your VMs will appear here once your plan is confirmed and resources are assigned by our team.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-center max-w-sm mx-auto">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5">
                <ServerOff size={28} className="text-black/30" />
              </div>
              <div>
                <p className="font-semibold text-black/70">Something went wrong</p>
                <p className="mt-1 text-sm text-black/40">{error}</p>
              </div>
              <button onClick={() => fetchAll()} className="text-sm text-primary-blue hover:underline transition-colors">
                Try again
              </button>
            </div>
          );
        })()}
        {!loading && !error && vms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center max-w-sm mx-auto">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5">
              <ServerOff size={28} className="text-black/30" />
            </div>
            <div>
              <p className="font-semibold text-black/70">No VMs assigned yet</p>
              <p className="mt-1 text-sm text-black/40">Your VMs will appear here once your plan is confirmed and resources are assigned by our team.</p>
            </div>
          </div>
        )}
        {!loading && !error && vms.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-black/40 uppercase tracking-wider mb-4">
              Your VMs — click a VM to deploy a service
            </p>
            <div className="flex flex-wrap gap-4">
              {vms.map((vm) => (
                <VMCard key={vm.id} vm={vm} services={services} onDeploy={openDeploy} onTerminal={openTerminal} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
          <div className="absolute inset-0 bg-black/20" onClick={closeModal} />
          <div className="relative w-full max-w-sm bg-white border border-black/12 rounded-xl shadow-xl overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div>
                {targetVM && (
                  <p className="text-xs text-black/40 mb-0.5 flex items-center gap-1">
                    <Server size={11} /> {targetVM.name}
                  </p>
                )}
                <p className="text-sm font-semibold text-black">
                  {step === "pick-type"       && "What would you like to create?"}
                  {step === "github-connect"  && "Connect GitHub"}
                  {step === "github-repo"     && "Select repository"}
                  {step === "github-branch"   && "Select branch"}
                  {step === "github-confirm"  && "Confirm deployment"}
                </p>
              </div>
              <button onClick={closeModal} className="rounded-md p-1 hover:bg-black/5 transition-colors">
                <X size={15} className="text-black/40" />
              </button>
            </div>

            {/* Error */}
            {flowError && (
              <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600">{flowError}</p>
              </div>
            )}

            {/* ── Step: pick type ── */}
            {step === "pick-type" && (
              <div className="px-4 pb-3">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-neutral-50 border border-black/12 rounded-lg px-3 py-2 text-sm text-black placeholder:text-black/30 focus:outline-none focus:border-black/30 transition-colors mb-2"
                />
                {filtered.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.key}
                      onClick={() => option.available && handlePickType(option.key)}
                      disabled={!option.available}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-3 rounded-lg text-left transition-colors",
                        option.available
                          ? "hover:bg-black/5 text-black"
                          : "text-black/30 cursor-not-allowed"
                      )}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="text-sm font-medium flex-1">{option.label}</span>
                      {!option.available && (
                        <span className="text-[10px] bg-black/5 text-black/30 rounded px-1.5 py-0.5 font-medium">Soon</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Step: connect GitHub ── */}
            {step === "github-connect" && (
              <div className="px-4 pb-4 space-y-4">
                <div className="rounded-xl border border-black/10 bg-neutral-50 p-4 text-center space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black mx-auto">
                    <GitBranch size={22} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-black">Install GitHub App</p>
                    <p className="text-xs text-black/50 mt-1">
                      Grant Rach Dev access to your repositories. You choose which repos to share.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleConnectGithub}
                  disabled={connectingGithub}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-black text-white py-2.5 text-sm font-semibold hover:bg-neutral-800 disabled:opacity-60 transition-colors"
                >
                  {connectingGithub ? (
                    <><Loader2 size={14} className="animate-spin" /> Waiting for installation…</>
                  ) : (
                    <><GitBranch size={14} /> Install on GitHub</>
                  )}
                </button>
                {connectingGithub && (
                  <p className="text-xs text-black/40 text-center">
                    Complete the installation in the GitHub tab, then come back here.
                  </p>
                )}
              </div>
            )}

            {/* ── Step: select repo ── */}
            {step === "github-repo" && (
              <div className="px-2 pb-3 max-h-72 overflow-y-auto">
                {reposLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 size={18} className="animate-spin text-black/30" />
                  </div>
                ) : repos.length === 0 ? (
                  <p className="text-center text-black/30 text-sm py-8">No repositories found.</p>
                ) : (
                  repos.map((repo) => (
                    <button
                      key={repo.id}
                      onClick={() => handleSelectRepo(repo)}
                      className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover:bg-black/5 transition-colors text-left"
                    >
                      <GitFork size={15} className="text-black/40 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-black truncate">{repo.full_name}</p>
                        <p className="text-xs text-black/40">default: {repo.default_branch}</p>
                      </div>
                      {repo.private && <Lock size={11} className="text-black/30 shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* ── Step: select branch ── */}
            {step === "github-branch" && selectedRepo && (
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-black/50 font-mono">{selectedRepo.full_name}</p>
                {branchesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 size={18} className="animate-spin text-black/30" />
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full appearance-none bg-neutral-50 border border-black/12 rounded-lg px-3 py-2.5 text-sm text-black focus:outline-none focus:border-black/30 pr-8"
                    >
                      {branches.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none" />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep("github-repo")}
                    className="flex-1 rounded-lg border border-black/12 py-2 text-xs font-semibold text-black/60 hover:bg-black/5 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep("github-confirm")}
                    disabled={!selectedBranch}
                    className="flex-1 rounded-lg bg-black text-white py-2 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* ── Step: confirm ── */}
            {step === "github-confirm" && selectedRepo && targetVM && (
              <div className="px-4 pb-4 space-y-3">
                <div className="rounded-xl border border-black/10 bg-neutral-50 p-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-black/50">Repository</span>
                    <span className="font-medium text-black font-mono text-xs">{selectedRepo.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-black/50">Branch</span>
                    <span className="font-medium text-black font-mono text-xs">{selectedBranch}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-black/50">Deploy to</span>
                    <span className="font-medium text-black text-xs">{targetVM.name}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep("github-branch")}
                    className="flex-1 rounded-lg border border-black/12 py-2 text-xs font-semibold text-black/60 hover:bg-black/5 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={saving}
                    className="flex-1 rounded-lg bg-black text-white py-2 text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {saving ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : <><CheckCircle2 size={12} /> Connect</>}
                  </button>
                </div>
              </div>
            )}

            {/* No VM selected warning for global + Add */}
            {step === "github-confirm" && !targetVM && (
              <div className="px-4 pb-4">
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Please deploy from a specific VM card to select a target VM.
                </p>
              </div>
            )}

          </div>
        </div>
      )}

    </div>{/* end canvas */}

    {/* ── Agent Chat Panel ── */}
    {chatOpen && token && (
      <div className="w-80 shrink-0 border-l border-black/10 flex flex-col">
        <AgentChat token={token} onClose={closeChat} />
      </div>
    )}
    </div>
  );
}
