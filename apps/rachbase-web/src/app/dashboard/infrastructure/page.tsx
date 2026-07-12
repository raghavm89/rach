"use client";

import { useState, useEffect, useCallback } from "react";
import { Server, Plus, Check, Loader2, AlertCircle, Pencil, X } from "lucide-react";
import { useAuth } from "@rach/ui/contexts/AuthContext";
import { deployment, tenants } from "@rach/ui/lib/api";
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

interface Tenant {
  id: number;
  name: string;
}

const DEFAULT_FORM = { vm_id: "", tenant_id: "", ip_address: "", ssh_user: "root", ssh_port: "22" };

export default function InfrastructurePage() {
  const { token } = useAuth();

  const [configs, setConfigs]       = useState<VmConfig[]>([]);
  const [tenantList, setTenantList] = useState<Tenant[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  // Form state
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<VmConfig | null>(null);
  const [form, setForm]             = useState(DEFAULT_FORM);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // VM dropdown for selected tenant
  const [tenantVMs, setTenantVMs]       = useState<string[]>([]);
  const [vmsLoading, setVmsLoading]     = useState(false);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [cfgData, tenantData] = await Promise.all([
        deployment.listVmSshConfigs(token),
        tenants.getAll(token),
      ]);
      setConfigs(cfgData.configs);
      setTenantList(tenantData.tenants);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadTenantVMs = async (tenantId: string) => {
    if (!token || !tenantId) { setTenantVMs([]); return; }
    setVmsLoading(true);
    try {
      const data = await tenants.getVMs(token, Number(tenantId));
      setTenantVMs(data.vms.map((v) => v.vm_id));
    } catch {
      setTenantVMs([]);
    } finally {
      setVmsLoading(false);
    }
  };

  const handleTenantChange = (tenantId: string) => {
    setForm((p) => ({ ...p, tenant_id: tenantId, vm_id: "" }));
    loadTenantVMs(tenantId);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setTenantVMs([]);
    setSaveError("");
    setSaveSuccess(false);
    setShowForm(true);
  };

  const openEdit = (cfg: VmConfig) => {
    setEditing(cfg);
    setForm({
      vm_id:      cfg.vm_id,
      tenant_id:  String(cfg.tenant_id),
      ip_address: cfg.ip_address,
      ssh_user:   cfg.ssh_user,
      ssh_port:   String(cfg.ssh_port),
    });
    setSaveError("");
    setSaveSuccess(false);
    setShowForm(true);
    loadTenantVMs(String(cfg.tenant_id));
  };

  const handleSave = async () => {
    if (!token) return;
    if (!form.vm_id || !form.ip_address || !form.tenant_id) {
      setSaveError("VM ID, Tenant and IP Address are required.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await deployment.setVmSshConfig(token, {
        vm_id:      form.vm_id.trim(),
        tenant_id:  Number(form.tenant_id),
        ip_address: form.ip_address.trim(),
        ssh_user:   form.ssh_user.trim() || "root",
        ssh_port:   Number(form.ssh_port) || 22,
      });
      setSaveSuccess(true);
      await fetchData();
      setTimeout(() => { setShowForm(false); setSaveSuccess(false); }, 800);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Infrastructure"
          description="Manage VM SSH access for deploy runner."
        />
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Add VM Config
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-neutral-border bg-white overflow-hidden">
        <div className="border-b border-neutral-border px-6 py-4 flex items-center gap-2">
          <Server size={15} className="text-text-muted" />
          <h3 className="text-sm font-semibold text-text-primary">VM SSH Configurations</h3>
          <span className="ml-auto text-xs text-text-muted">{configs.length} VMs configured</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : configs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Server size={28} className="text-neutral-300" />
            <p className="text-sm text-text-muted">No VMs configured yet.</p>
            <button onClick={openAdd} className="text-xs text-primary-blue hover:underline">
              Add your first VM
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-border bg-bg-secondary">
                  {["VM ID", "Tenant", "IP Address", "SSH User", "Port", ""].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-border">
                {configs.map((cfg) => (
                  <tr key={cfg.id} className="hover:bg-bg-secondary transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-text-primary">{cfg.vm_id}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{cfg.tenant_name || `Tenant ${cfg.tenant_id}`}</td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs bg-bg-secondary border border-neutral-border rounded px-2 py-0.5">
                        {cfg.ip_address}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-text-secondary">{cfg.ssh_user}</td>
                    <td className="px-6 py-4 font-mono text-xs text-text-secondary">{cfg.ssh_port}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openEdit(cfg)}
                        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary-blue transition-colors"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-border">
              <h3 className="font-semibold text-text-primary">
                {editing ? "Edit VM Config" : "Add VM Config"}
              </h3>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-bg-secondary transition-colors">
                <X size={15} className="text-text-muted" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Tenant — select first to populate VM dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Tenant</label>
                <select
                  value={form.tenant_id}
                  onChange={(e) => handleTenantChange(e.target.value)}
                  className="w-full rounded-lg border border-neutral-border px-3 py-2 text-sm focus:outline-none focus:border-primary-blue transition-colors"
                >
                  <option value="">Select tenant...</option>
                  {tenantList.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* VM ID — populated after tenant selected */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">VM ID</label>
                {vmsLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-neutral-border px-3 py-2">
                    <Loader2 size={13} className="animate-spin text-text-muted" />
                    <span className="text-sm text-text-muted">Loading VMs...</span>
                  </div>
                ) : tenantVMs.length > 0 ? (
                  <select
                    value={form.vm_id}
                    onChange={(e) => setForm((p) => ({ ...p, vm_id: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary-blue transition-colors"
                  >
                    <option value="">Select VM...</option>
                    {tenantVMs.map((vmId) => (
                      <option key={vmId} value={vmId}>{vmId}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.vm_id}
                    onChange={(e) => setForm((p) => ({ ...p, vm_id: e.target.value }))}
                    placeholder={form.tenant_id ? "No VMs found — enter manually (e.g. qemu/201)" : "Select a tenant first"}
                    disabled={!form.tenant_id}
                    className="w-full rounded-lg border border-neutral-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary-blue transition-colors disabled:opacity-50"
                  />
                )}
              </div>

              {/* IP Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Public IP Address</label>
                <input
                  value={form.ip_address}
                  onChange={(e) => setForm((p) => ({ ...p, ip_address: e.target.value }))}
                  placeholder="e.g. 103.x.x.x"
                  className="w-full rounded-lg border border-neutral-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary-blue transition-colors"
                />
              </div>

              {/* SSH User + Port */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">SSH User</label>
                  <input
                    value={form.ssh_user}
                    onChange={(e) => setForm((p) => ({ ...p, ssh_user: e.target.value }))}
                    placeholder="root"
                    className="w-full rounded-lg border border-neutral-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary-blue transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary">SSH Port</label>
                  <input
                    value={form.ssh_port}
                    onChange={(e) => setForm((p) => ({ ...p, ssh_port: e.target.value }))}
                    placeholder="22"
                    className="w-full rounded-lg border border-neutral-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary-blue transition-colors"
                  />
                </div>
              </div>

              {saveError && (
                <p className="flex items-center gap-1.5 text-xs text-red-600">
                  <AlertCircle size={12} /> {saveError}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-neutral-border flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-neutral-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || saveSuccess}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {saving     ? <><Loader2 size={13} className="animate-spin" /> Saving…</> :
                 saveSuccess ? <><Check size={13} /> Saved!</> :
                               "Save Config"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
