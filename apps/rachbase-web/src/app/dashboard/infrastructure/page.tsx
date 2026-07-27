"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Server, Check, Loader2, AlertCircle, Pencil, X, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "@rach/ui/contexts/AuthContext";
import { deployment, tenants, vmKeys, type VmKey } from "@rach/ui/lib/api";
import { PageHeader } from "@/components/dashboard/PageHeader";

interface VmConfig {
  id: number;
  vm_id: string;
  tenant_id: number;
  tenant_name?: string;
  ip_address: string;
  ssh_user: string;
  ssh_port: number;
}

interface Tenant { id: number; name: string }

const EDIT_FORM = { vm_id: "", tenant_id: "", ip_address: "", ssh_user: "rachops", ssh_port: "22" };
const ACT_FORM  = { vm_id: "", ip_address: "", ssh_port: "22" };

export default function InfrastructurePage() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [configs, setConfigs]       = useState<VmConfig[]>([]);
  const [keys, setKeys]             = useState<VmKey[]>([]);
  const [tenantList, setTenantList] = useState<Tenant[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [notice, setNotice]         = useState("");

  // Activate-key modal
  const [activatingKey, setActivatingKey] = useState<VmKey | null>(null);
  const [actForm, setActForm]             = useState(ACT_FORM);
  const [actSaving, setActSaving]         = useState(false);
  const [actError, setActError]           = useState("");

  // Edit-config modal (setVmSshConfig — IP/port edits)
  const [editing, setEditing]     = useState<VmConfig | null>(null);
  const [editForm, setEditForm]   = useState(EDIT_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [reissuingVm, setReissuingVm] = useState<string | null>(null);

  // Admin-only page
  useEffect(() => {
    if (user && user.role !== "admin") router.replace("/dashboard");
  }, [user, router]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [cfgData, tenantData, keyData] = await Promise.all([
        deployment.listVmSshConfigs(token),
        tenants.getAll(token),
        vmKeys.list(token),
      ]);
      setConfigs(cfgData.configs);
      setTenantList(tenantData.tenants);
      setKeys(keyData.keys);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tenantName = (id: number | null) => tenantList.find((t) => t.id === id)?.name ?? (id ? `Tenant ${id}` : "—");
  const pendingKeys = keys.filter((k) => k.status === "pending" || k.status === "rotating");

  // ── Activate a pending key ──────────────────────────────────────────────────
  const openActivate = (key: VmKey) => {
    setActivatingKey(key);
    setActForm(ACT_FORM);
    setActError("");
  };
  const handleActivate = async () => {
    if (!token || !activatingKey) return;
    if (!/^(qemu|lxc)\/\d+$/.test(actForm.vm_id.trim())) { setActError("VM ID must be qemu/<n> or lxc/<n>"); return; }
    if (!actForm.ip_address.trim()) { setActError("IP address is required"); return; }
    setActSaving(true); setActError("");
    try {
      await vmKeys.activate(token, activatingKey.id, {
        vm_id: actForm.vm_id.trim(),
        ip_address: actForm.ip_address.trim(),
        ssh_port: Number(actForm.ssh_port) || 22,
      });
      setActivatingKey(null);
      setNotice(`Key activated for ${actForm.vm_id.trim()}.`);
      await fetchData();
    } catch (err) {
      setActError((err as Error).message);
    } finally {
      setActSaving(false);
    }
  };

  // ── Edit an existing SSH config (IP/port) ───────────────────────────────────
  const openEdit = (cfg: VmConfig) => {
    setEditing(cfg);
    setEditForm({ vm_id: cfg.vm_id, tenant_id: String(cfg.tenant_id), ip_address: cfg.ip_address, ssh_user: cfg.ssh_user, ssh_port: String(cfg.ssh_port) });
    setEditError("");
  };
  const handleEditSave = async () => {
    if (!token || !editing) return;
    setEditSaving(true); setEditError("");
    try {
      await deployment.setVmSshConfig(token, {
        vm_id: editing.vm_id,
        tenant_id: editing.tenant_id,
        ip_address: editForm.ip_address.trim(),
        ssh_user: editForm.ssh_user.trim() || "rachops",
        ssh_port: Number(editForm.ssh_port) || 22,
      });
      setEditing(null);
      await fetchData();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setEditSaving(false);
    }
  };

  // ── Break-glass reissue ─────────────────────────────────────────────────────
  const handleReissue = async (vmId: string) => {
    if (!token) return;
    if (!window.confirm(`Re-issue the SSH key for ${vmId}? ARKA will be emailed a new public key to install.`)) return;
    setReissuingVm(vmId);
    try {
      await vmKeys.reissue(token, vmId);
      setNotice(`Re-issued key for ${vmId} — public key emailed to ARKA. Activate it once installed.`);
      await fetchData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReissuingVm(null);
    }
  };

  if (user && user.role !== "admin") return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Infrastructure" description="Activate per-VM SSH keys and manage VM access." />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <Check size={14} className="shrink-0" /> {notice}
        </div>
      )}

      {/* ── Pending keys (activate) ── */}
      <div className="rounded-xl border border-neutral-border bg-white overflow-hidden">
        <div className="border-b border-neutral-border px-6 py-4 flex items-center gap-2">
          <KeyRound size={15} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-text-primary">Pending Keys</h3>
          <span className="ml-auto text-xs text-text-muted">{pendingKeys.length} awaiting activation</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-text-muted" /></div>
        ) : pendingKeys.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-muted">No keys awaiting activation.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-border bg-bg-secondary">
                  {["Fingerprint", "Order", "Tenant", "SSH User", "Created", ""].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border">
                {pendingKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-bg-secondary transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-text-secondary truncate max-w-[220px]" title={k.fingerprint}>{k.fingerprint}</td>
                    <td className="px-6 py-4 text-xs text-text-secondary">{k.order_id ?? "—"}</td>
                    <td className="px-6 py-4 text-xs text-text-secondary">{tenantName(k.tenant_id)}</td>
                    <td className="px-6 py-4 font-mono text-xs text-text-secondary">{k.ssh_user}</td>
                    <td className="px-6 py-4 text-xs text-text-muted">{new Date(k.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openActivate(k)}
                        className="flex items-center gap-1.5 rounded-lg bg-primary-blue/10 px-3 py-1.5 text-xs font-semibold text-primary-blue hover:bg-primary-blue/20 transition-colors"
                      >
                        <ShieldCheck size={12} /> Activate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Active VM access ── */}
      <div className="rounded-xl border border-neutral-border bg-white overflow-hidden">
        <div className="border-b border-neutral-border px-6 py-4 flex items-center gap-2">
          <Server size={15} className="text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">Active VM Access</h3>
          <span className="ml-auto text-xs text-text-muted">{configs.length} VMs</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-text-muted" /></div>
        ) : configs.length === 0 ? (
          <div className="py-16 text-center text-sm text-text-muted">No active VM access yet. Activate a pending key above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-border bg-bg-secondary">
                  {["VM ID", "Tenant", "IP Address", "SSH User", "Port", ""].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border">
                {configs.map((cfg) => (
                  <tr key={cfg.id} className="hover:bg-bg-secondary transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-text-primary">{cfg.vm_id}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{cfg.tenant_name || tenantName(cfg.tenant_id)}</td>
                    <td className="px-6 py-4"><span className="font-mono text-xs bg-bg-secondary border border-neutral-border rounded px-2 py-0.5">{cfg.ip_address}</span></td>
                    <td className="px-6 py-4 font-mono text-xs text-text-secondary">{cfg.ssh_user}</td>
                    <td className="px-6 py-4 font-mono text-xs text-text-secondary">{cfg.ssh_port}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEdit(cfg)} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary-blue transition-colors">
                          <Pencil size={12} /> Edit IP
                        </button>
                        <button
                          onClick={() => handleReissue(cfg.vm_id)}
                          disabled={reissuingVm === cfg.vm_id}
                          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-amber-600 transition-colors disabled:opacity-50"
                          title="Break-glass: re-issue key (ARKA re-installs)"
                        >
                          {reissuingVm === cfg.vm_id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Reissue
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Activate modal ── */}
      {activatingKey && (
        <Modal title="Activate VM Key" onClose={() => setActivatingKey(null)}>
          <div className="px-6 py-5 space-y-4">
            <p className="text-xs text-text-muted">
              Link this key to the VM ARKA created. Fingerprint:{" "}
              <span className="font-mono text-text-secondary">{activatingKey.fingerprint}</span>
            </p>
            <Field label="VM ID">
              <input value={actForm.vm_id} onChange={(e) => setActForm((p) => ({ ...p, vm_id: e.target.value }))}
                placeholder="qemu/201" className={inputCls} />
            </Field>
            <Field label="Public IP Address">
              <input value={actForm.ip_address} onChange={(e) => setActForm((p) => ({ ...p, ip_address: e.target.value }))}
                placeholder="103.x.x.x" className={inputCls} />
            </Field>
            <Field label="SSH Port">
              <input value={actForm.ssh_port} onChange={(e) => setActForm((p) => ({ ...p, ssh_port: e.target.value }))}
                placeholder="22" className={inputCls} />
            </Field>
            {actError && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertCircle size={12} /> {actError}</p>}
          </div>
          <ModalFooter onCancel={() => setActivatingKey(null)} onSave={handleActivate} saving={actSaving} label="Activate" />
        </Modal>
      )}

      {/* ── Edit config modal ── */}
      {editing && (
        <Modal title={`Edit ${editing.vm_id}`} onClose={() => setEditing(null)}>
          <div className="px-6 py-5 space-y-4">
            <Field label="Public IP Address">
              <input value={editForm.ip_address} onChange={(e) => setEditForm((p) => ({ ...p, ip_address: e.target.value }))} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SSH User">
                <input value={editForm.ssh_user} onChange={(e) => setEditForm((p) => ({ ...p, ssh_user: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="SSH Port">
                <input value={editForm.ssh_port} onChange={(e) => setEditForm((p) => ({ ...p, ssh_port: e.target.value }))} className={inputCls} />
              </Field>
            </div>
            {editError && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertCircle size={12} /> {editError}</p>}
          </div>
          <ModalFooter onCancel={() => setEditing(null)} onSave={handleEditSave} saving={editSaving} label="Save" />
        </Modal>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-neutral-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary-blue transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-text-secondary">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-border">
          <h3 className="font-semibold text-text-primary">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-bg-secondary transition-colors"><X size={15} className="text-text-muted" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onSave, saving, label }: { onCancel: () => void; onSave: () => void; saving: boolean; label: string }) {
  return (
    <div className="px-6 py-4 border-t border-neutral-border flex justify-end gap-3">
      <button onClick={onCancel} className="rounded-lg border border-neutral-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors">Cancel</button>
      <button onClick={onSave} disabled={saving}
        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity">
        {saving ? <><Loader2 size={13} className="animate-spin" /> Working…</> : label}
      </button>
    </div>
  );
}
