/**
 * Typed API client for the rach-dev backend.
 * Base URL is controlled by NEXT_PUBLIC_API_URL env var (defaults to localhost:3000).
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'tenant_admin' | 'tenant_user' | 'developer';

export interface BillingAddress {
  line1:   string;
  line2?:  string;
  city:    string;
  state:   string;
  pincode: string;
  country: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone_number: string;
  address: string | null;
  role: UserRole;
  tenant_id: number | null;
  tenant_name: string | null;
  pve_pool?: string | null;
  // Business profile (migration 018)
  account_type?:        'individual' | 'business';
  business_name?:       string | null;
  business_website?:    string | null;
  business_industry?:   string | null;
  gstin?:               string | null;
  billing_address?:     BillingAddress | null;
}

export interface Tenant {
  id: number;
  name: string;
  pve_pool?: string | null;
  created_at: string;
  updated_at?: string;
  user_count?: number;
  vm_count?: number;
}

export interface TenantDetail extends Tenant {
  vms: { vm_id: string; assigned_at: string }[];
  users: Pick<User, 'id' | 'name' | 'email' | 'role'>[];
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface RegisterResponse {
  message: string;
  email_sent: boolean;
  pending_id: number;
  expires_at: string; // ISO timestamp — when the OTP expires
}

export interface ApiError {
  error: string;
  details?: unknown;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json();

  if (!res.ok) {
    const errMsg = (data as ApiError).error || 'Request failed';
    // Only treat 401 as "session expired" when it's an auth error (token missing/invalid).
    // Gateway errors (e.g. Razorpay returning 401 proxied as 502) must NOT clear the session.
    if (res.status === 401 && !errMsg.toLowerCase().startsWith('payment gateway')) {
      // On the login/register endpoints a 401 means wrong credentials — don't
      // treat it as session expiry; let the error propagate to the form.
      const isAuthEndpoint = path === '/api/auth/login' || path === '/api/auth/register' || path === '/api/auth/refresh';
      if (!isAuthEndpoint) {
        localStorage.removeItem('rd_access_token');
        localStorage.removeItem('rd_user');
        window.location.href = '/';
      }
      throw new Error(errMsg);
    }
    const err = new Error(errMsg) as Error & { status: number; pending_id?: number; no_account?: boolean };
    err.status = res.status;
    const body = data as Record<string, unknown>;
    if (body.pending_id) err.pending_id = body.pending_id as number;
    if (body.no_account)  err.no_account  = true;
    throw err;
  }

  return data as T;
}

// ─── Auth endpoints ───────────────────────────────────────────────────────────

export const auth = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (payload: { name: string; email: string; password: string; phone_number?: string }) =>
    apiFetch<RegisterResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Called after sign-up (or failed login on unverified email) — user enters OTP.
  verifyEmailOtp: (pendingId: number, code: string) =>
    apiFetch<LoginResponse>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ pending_id: pendingId, code }),
    }),

  resendVerification: (pendingId: number) =>
    apiFetch<{ message: string; resends_remaining: number; expires_at: string }>(
      '/api/auth/resend-verification',
      { method: 'POST', body: JSON.stringify({ pending_id: pendingId }) },
    ),

  logout: (token: string) =>
    apiFetch<{ message: string }>('/api/auth/logout', { method: 'POST' }, token),

  refresh: () =>
    apiFetch<{ access_token: string }>('/api/auth/refresh', { method: 'POST' }),

  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    apiFetch<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
};

// ─── Tenant endpoints (system admin) ─────────────────────────────────────────

export const tenants = {
  getAll: (token: string) =>
    apiFetch<{ tenants: Tenant[] }>('/api/tenants', {}, token),

  getById: (token: string, id: number) =>
    apiFetch<{ tenant: TenantDetail; vms: { vm_id: string; assigned_at: string }[]; users: User[] }>(
      `/api/tenants/${id}`, {}, token
    ),

  create: (token: string, name: string, pve_pool?: string) =>
    apiFetch<{ message: string; tenant: Tenant }>('/api/tenants', {
      method: 'POST',
      body: JSON.stringify({ name, pve_pool: pve_pool || undefined }),
    }, token),

  update: (token: string, id: number, name: string, pve_pool?: string) =>
    apiFetch<{ message: string; tenant: Tenant }>(`/api/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, pve_pool: pve_pool || undefined }),
    }, token),

  delete: (token: string, id: number) =>
    apiFetch<{ message: string }>(`/api/tenants/${id}`, { method: 'DELETE' }, token),

  getVMs: (token: string, id: number) =>
    apiFetch<{ tenantId: number; vms: { vm_id: string; assigned_at: string }[] }>(
      `/api/tenants/${id}/vms`, {}, token
    ),

  setVMs: (token: string, id: number, vmIds: string[]) =>
    apiFetch<{ message: string; tenantId: number; vms: { vm_id: string }[] }>(
      `/api/tenants/${id}/vms`,
      { method: 'POST', body: JSON.stringify({ vmIds }) },
      token
    ),
};

// ─── Users endpoints ──────────────────────────────────────────────────────────

export interface UsersResponse {
  data: User[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export const users = {
  getAll: (token: string, role?: string) => {
    const qs = role ? `?role=${role}` : '';
    return apiFetch<UsersResponse>(`/api/users${qs}`, {}, token);
  },

  create: (token: string, payload: {
    name: string;
    email: string;
    password: string;
    phone_number: string;
    role: UserRole;
    tenant_id?: number | null;
  }) =>
    apiFetch<{ message: string; user: User }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  getVMs: (token: string, userId: number) =>
    apiFetch<{ userId: number; vms: { vm_id: string; assigned_at: string }[] }>(
      `/api/users/${userId}/vms`, {}, token
    ),

  assignVMs: (token: string, userId: number, vmIds: string[]) =>
    apiFetch<{ message: string; userId: number; vms: { vm_id: string }[] }>(
      `/api/users/${userId}/vms`,
      { method: 'POST', body: JSON.stringify({ vmIds }) },
      token
    ),

  updateRole: (token: string, userId: number, role: UserRole) =>
    apiFetch<{ message: string; user: User }>(`/api/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }, token),

  updateTenant: (token: string, userId: number, tenantId: number | null) =>
    apiFetch<{ message: string; user: User }>(`/api/users/${userId}/tenant`, {
      method: 'PATCH',
      body: JSON.stringify({ tenant_id: tenantId }),
    }, token),

  delete: (token: string, userId: number) =>
    apiFetch<{ message: string }>(`/api/users/${userId}`, { method: 'DELETE' }, token),

  updateMe: (token: string, payload: {
    name?:              string;
    phone_number?:      string;
    account_type?:      'individual' | 'business';
    business_name?:     string | null;
    business_website?:  string | null;
    business_industry?: string | null;
    gstin?:             string | null;
    billing_address?:   BillingAddress | null;
  }) =>
    apiFetch<{ message: string; user: User }>('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }, token),

  changePassword: (token: string, payload: { current_password: string; new_password: string }) =>
    apiFetch<{ message: string }>('/api/users/me/password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),
};

// ─── Monitoring endpoints ─────────────────────────────────────────────────────

export interface VMSummary {
  snapshotTime: string;
  poolName: string | null;
  vms: { running: number; stopped: number; total: number };
  lxc: { running: number; stopped: number; total: number };
  guests: { id: string; name: string; type: string; pool: string | null; cpuPct: number }[];
}

export interface VM {
  id: string;
  name: string;
  type: string;
  status: string;
  pool: string | null;
  cpuPct: number;
  memoryUsedGib: number;
  memoryTotalGib: number;
  memoryPct: number;
  diskUsedGib: number;
  diskTotalGib: number;
  diskPct: number;
  uptimeSeconds: number;
}

export interface VMDetail extends VM {
  node: string | null;
}

export interface HistoryPoint {
  time: string;
  cpuPct: number;
  memoryPct: number;
}

export const monitoring = {
  getSummary: (token: string, params?: { userId?: number }) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiFetch<VMSummary>(`/api/monitoring/summary${qs}`, {}, token);
  },

  getVMs: (token: string, params?: { userId?: number }) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiFetch<{ snapshotTime: string; vms: VM[] }>(`/api/monitoring/vms${qs}`, {}, token);
  },

  getVM: (token: string, vmId: string) =>
    apiFetch<VMDetail>(`/api/monitoring/vms/${encodeURIComponent(vmId)}`, {}, token),

  getHistory: (token: string, vmId: string, hours = 1) =>
    apiFetch<{ vmId: string; hours: number; stepSeconds: number; points: HistoryPoint[] }>(
      `/api/monitoring/history?vmId=${encodeURIComponent(vmId)}&hours=${hours}`,
      {},
      token,
    ),

  getAllUsersUsage: (token: string) =>
    apiFetch<{ snapshotTime: string; tenants: unknown[] }>('/api/monitoring/users', {}, token),
};

// ─── VM Expansion / Billing ───────────────────────────────────────────────────

export interface VMPackage {
  id: number;
  name: string;
  description: string | null;
  vm_count: number;
  price_cents: number;
  currency: string;
  billing_period: string;
  is_active: boolean;
}

export interface ExpansionRequest {
  id: number;
  tenant_id: number;
  package_id: number | null;
  requested_by: number;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_plan_id: string | null;
  razorpay_subscription_id: string | null;
  subscription_status: string | null;
  next_charge_at: string | null;
  amount_paid: number;
  currency: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
  notes: string | null;
  custom_description: string | null;
  requested_at: string;
  fulfilled_at: string | null;
  // joined fields
  tenant_name?: string;
  package_name?: string;
  vm_count?: number;
  requested_by_name?: string;
  requested_by_email?: string;
}

export interface CustomOrderItem {
  id: 'vm' | 'disk' | 'lb' | 'ip' | 'db' | 'obs' | 'mon';
  name: string;
  qty: number;
}

export const expansion = {
  listPackages: (token: string) =>
    apiFetch<{ packages: VMPackage[] }>('/api/expansion/packages', {}, token),

  createOrder: (token: string, packageId: number) =>
    apiFetch<{
      package: VMPackage;
      razorpay_order_id: string | null;
      razorpay_key_id: string | null;
    }>('/api/expansion/orders', {
      method: 'POST',
      body: JSON.stringify({ package_id: packageId }),
    }, token),

  verifyPayment: (token: string, payload: {
    package_id: number;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  }) =>
    apiFetch<{ message: string; request: ExpansionRequest; package: VMPackage }>(
      '/api/expansion/verify',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  myRequests: (token: string) =>
    apiFetch<{ requests: ExpansionRequest[] }>('/api/expansion/requests/my', {}, token),

  // Returns vm_ids with obs assigned (null + unlimited:true for admins)
  hasObservability: (token: string) =>
    apiFetch<{ obs_vm_ids: string[] | null; unlimited: boolean }>('/api/expansion/has-observability', {}, token),

  // Admin: list all obs assignments, optionally filtered by tenant
  listObsAssignments: (token: string, tenant_id?: number) => {
    const qs = tenant_id ? `?tenant_id=${tenant_id}` : '';
    return apiFetch<{ assignments: { id: number; tenant_id: number; vm_id: string; assigned_at: string; tenant_name: string; assigned_by_name: string | null }[] }>(
      `/api/expansion/observability/assignments${qs}`, {}, token
    );
  },

  // Admin: obs quota (purchased vs assigned) per tenant
  getObsQuota: (token: string) =>
    apiFetch<{ quotas: { tenant_id: number; tenant_name: string; quota: number; used: number }[] }>(
      '/api/expansion/observability/quota', {}, token
    ),

  // Admin: assign obs to a specific VM
  assignObs: (token: string, tenant_id: number, vm_id: string) =>
    apiFetch<{ message: string; assignment: unknown }>(
      '/api/expansion/observability/assign',
      { method: 'POST', body: JSON.stringify({ tenant_id, vm_id }) },
      token
    ),

  // Admin: remove obs from a specific VM
  unassignObs: (token: string, tenant_id: number, vm_id: string) =>
    apiFetch<{ message: string }>(
      '/api/expansion/observability/assign',
      { method: 'DELETE', body: JSON.stringify({ tenant_id, vm_id }) },
      token
    ),

  cancelMySubscription: (token: string, id: number) =>
    apiFetch<{ message: string; request: ExpansionRequest }>(
      `/api/expansion/requests/${id}/cancel-my`,
      { method: 'PATCH' },
      token
    ),

  // Admin
  allRequests: (token: string, status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return apiFetch<{ requests: ExpansionRequest[] }>(`/api/expansion/requests${qs}`, {}, token);
  },

  fulfilRequest: (token: string, id: number, notes?: string) =>
    apiFetch<{ message: string; request: ExpansionRequest }>(
      `/api/expansion/requests/${id}/fulfil`,
      { method: 'PATCH', body: JSON.stringify({ notes }) },
      token
    ),

  cancelRequest: (token: string, id: number) =>
    apiFetch<{ message: string; request: ExpansionRequest }>(
      `/api/expansion/requests/${id}/cancel`,
      { method: 'PATCH' },
      token
    ),

  // Custom line-item orders (services basket — no package_id)
  createCustomOrder: (token: string, items: CustomOrderItem[], currency = 'USD') =>
    apiFetch<{
      description: string;
      total_cents: number;
      currency: string;
      items: (CustomOrderItem & { unit_price_cents: number })[];
      razorpay_order_id: string | null;
      razorpay_key_id: string | null;
    }>('/api/expansion/custom/orders', {
      method: 'POST',
      body: JSON.stringify({ items, currency }),
    }, token),

  verifyCustomPayment: (token: string, payload: {
    items: CustomOrderItem[];
    total_cents: number;
    currency?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  }) =>
    apiFetch<{ message: string; request: ExpansionRequest }>(
      '/api/expansion/custom/verify',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  // Subscription endpoints
  createSubscription: (token: string, payload: {
    items: CustomOrderItem[];
    description: string;
    total_cents: number;
    currency?: string;
    billing_country?: string;
  }) =>
    apiFetch<{
      subscription_id: string | null;
      plan_id: string | null;
      razorpay_key_id: string | null;
      description: string;
      total_cents: number;
      currency: string;
      billing_currency: string;
      monthly_amount: number;
      customer_country: string | null;
      converted: boolean;
    }>('/api/expansion/subscriptions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  // Called after subscription payment succeeds — creates the DB record.
  activateSubscription: (token: string, payload: {
    razorpay_subscription_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    razorpay_plan_id?: string;
    items: CustomOrderItem[];
    description: string;
    total_cents: number;
    currency?: string;
    billing_currency?: string;
    monthly_amount?: number;
  }) =>
    apiFetch<{ message: string; request: ExpansionRequest }>(
      '/api/expansion/subscriptions/activate',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),
};

// ─── Deployment endpoints ─────────────────────────────────────────────────────

export interface DeploymentService {
  id:              number;
  tenant_id:       number;
  vm_id:           string;
  installation_id: number;
  repo_full_name:  string;
  branch:          string;
  status:          'connected' | 'deploying' | 'deployed' | 'failed';
  created_at:      string;
  updated_at:      string;
}

export interface GithubRepo {
  id:             number;
  full_name:      string;
  name:           string;
  private:        boolean;
  default_branch: string;
  updated_at:     string;
}

// ─── Agent endpoints ──────────────────────────────────────────────────────────

export interface CreditPack {
  id: string; label: string; price_usd: number; credits: number;
}
export interface ChatSession {
  id: number; title: string; created_at: string; updated_at: string; message_count: number;
}
export interface ChatMessage {
  id: number; role: 'user' | 'assistant'; content: string;
  tokens_used: number; credits_used: number; created_at: string;
}

export const agent = {
  getCredits: (token: string) =>
    apiFetch<{ balance: number; packs: CreditPack[] }>('/api/agent/credits', {}, token),

  purchaseCredits: (token: string, pack_id: string) =>
    apiFetch<{ order_id: string; amount: number; currency: string; razorpay_key_id: string; pack: CreditPack }>(
      '/api/agent/credits/purchase', { method: 'POST', body: JSON.stringify({ pack_id }) }, token
    ),

  verifyPurchase: (token: string, payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; pack_id: string }) =>
    apiFetch<{ success: boolean; credits_added: number; balance: number }>(
      '/api/agent/credits/verify', { method: 'POST', body: JSON.stringify(payload) }, token
    ),

  listSessions: (token: string) =>
    apiFetch<{ sessions: ChatSession[] }>('/api/agent/sessions', {}, token),

  createSession: (token: string, title?: string) =>
    apiFetch<{ session: ChatSession }>('/api/agent/sessions', { method: 'POST', body: JSON.stringify({ title }) }, token),

  getMessages: (token: string, sessionId: number) =>
    apiFetch<{ messages: ChatMessage[] }>(`/api/agent/sessions/${sessionId}/messages`, {}, token),

  triggerDeploy: (token: string, sessionId: number, service_id: number) =>
    apiFetch<{ message: string }>(`/api/agent/sessions/${sessionId}/trigger-deploy`, { method: 'POST', body: JSON.stringify({ service_id }) }, token),

  runCommand: (token: string, sessionId: number, vm_id: string, command: string) =>
    apiFetch<{ stdout: string; stderr: string; code: number }>(`/api/agent/sessions/${sessionId}/run-command`, { method: 'POST', body: JSON.stringify({ vm_id, command }) }, token),

  getUsageSummary: (token: string) =>
    apiFetch<{ balance: number; total_purchased: number; total_used: number; total_tokens: number }>(
      '/api/agent/usage', {}, token
    ),

  getCreditHistory: (token: string, page = 1) =>
    apiFetch<{ transactions: { id: number; type: string; amount: number; description: string; tokens_used: number | null; razorpay_payment_id: string | null; user_name: string | null; created_at: string }[]; total: number; page: number; limit: number }>(
      `/api/agent/credits/history?page=${page}`, {}, token
    ),

  getSessionUsage: (token: string) =>
    apiFetch<{ sessions: { id: number; title: string; message_count: number; total_tokens: number; total_credits: number; updated_at: string }[] }>(
      '/api/agent/usage/sessions', {}, token
    ),
};

export const deployment = {
  getGithubStatus: (token: string) =>
    apiFetch<{ connected: boolean; installation_id?: number; github_account?: string; installed_at?: string }>(
      '/api/deployment/github/status', {}, token
    ),

  getInstallUrl: (token: string) =>
    apiFetch<{ install_url: string }>('/api/deployment/github/install', {}, token),

  listRepos: (token: string) =>
    apiFetch<{ repos: GithubRepo[] }>('/api/deployment/github/repos', {}, token),

  listBranches: (token: string, repo: string) =>
    apiFetch<{ branches: string[] }>(
      `/api/deployment/github/branches?repo=${encodeURIComponent(repo)}`, {}, token
    ),

  createService: (token: string, payload: { vm_id: string; repo_full_name: string; branch: string }) =>
    apiFetch<{ service: DeploymentService }>('/api/deployment/services', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  listServices: (token: string) =>
    apiFetch<{ services: DeploymentService[] }>('/api/deployment/services', {}, token),

  getDeployLogs: (token: string, serviceId: number) =>
    apiFetch<{ logs: { id: number; status: string; log_output: string; started_at: string; finished_at: string | null; commit_sha: string | null; triggered_by: string }[] }>(
      `/api/deployment/services/${serviceId}/logs`, {}, token
    ),

  triggerDeploy: (token: string, serviceId: number) =>
    apiFetch<{ message: string }>(`/api/deployment/services/${serviceId}/deploy`, { method: 'POST' }, token),

  setVmSshConfig: (token: string, payload: { vm_id: string; tenant_id: number; ip_address: string; ssh_user?: string; ssh_port?: number }) =>
    apiFetch<{ config: { vm_id: string; ip_address: string; ssh_user: string; ssh_port: number } }>(
      '/api/deployment/vm-ssh-config', { method: 'POST', body: JSON.stringify(payload) }, token
    ),

  listVmSshConfigs: (token: string) =>
    apiFetch<{ configs: { id: number; vm_id: string; tenant_id: number; ip_address: string; ssh_user: string; ssh_port: number }[] }>(
      '/api/deployment/vm-ssh-config', {}, token
    ),
};

// ─── Projects / Services (Railway-style) ──────────────────────────────────────

export interface Project {
  id: number;
  name: string;
  slug: string;
  service_count?: number;
  online_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Environment {
  id: number;
  project_id: number;
  name: string;
  is_default: boolean;
}

export interface Service {
  id: number;
  project_id: number;
  name: string;
  source_type: string;
  repo_full_name: string | null;
  branch: string;
  image: string | null;
  units?: number;
  cpu: string | number;
  memory_mb: number;
  disk_gb: string | number;
  replicas: number;
  compute_target?: string;
  vm_id?: string | null;
  status: string;
  created_at: string;
}

export interface Deployment {
  id: number;
  service_id: number;
  environment_id: number | null;
  commit_sha: string | null;
  image_tag: string | null;
  status: string;
  triggered_by: string;
  created_at: string;
}

export interface NewServiceInput {
  name: string;
  source_type?: string;
  repo_full_name?: string;
  branch?: string;
  image?: string;
  compute_target?: string;
  vm_id?: string;
}

export interface ServiceUnit {
  id: number;
  service_id: number;
  status: string;
  price_cents: number;
  currency: string;
  created_at: string;
  activated_at: string | null;
}

export interface UnitCheckout {
  message: string;
  unit_id: number;
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount: number;
  currency: string;
}

export const projects = {
  list: (token: string) =>
    apiFetch<{ projects: Project[] }>('/api/projects', {}, token),

  create: (token: string, name: string) =>
    apiFetch<{ project: Project }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }, token),

  get: (token: string, id: number) =>
    apiFetch<{ project: Project; services: Service[]; environments: Environment[] }>(
      `/api/projects/${id}`, {}, token,
    ),

  createService: (token: string, projectId: number, input: NewServiceInput) =>
    apiFetch<{ service: Service; quota?: { used: number; limit: number } }>(
      `/api/projects/${projectId}/services`, {
        method: 'POST',
        body: JSON.stringify(input),
      }, token,
    ),

  getService: (token: string, projectId: number, sid: number) =>
    apiFetch<{ service: Service; deployments: Deployment[]; units: ServiceUnit[] }>(
      `/api/projects/${projectId}/services/${sid}`, {}, token,
    ),

  deploy: (token: string, projectId: number, sid: number, body: { commit_sha?: string; image_tag?: string } = {}) =>
    apiFetch<{ message: string; deployment: Deployment }>(
      `/api/projects/${projectId}/services/${sid}/deploy`, {
        method: 'POST',
        body: JSON.stringify(body),
      }, token,
    ),

  // Buy one Service Unit ($15/mo) — used both to bring a draft online and to "Add power".
  checkoutUnit: (token: string, projectId: number, sid: number) =>
    apiFetch<UnitCheckout>(
      `/api/projects/${projectId}/services/${sid}/units/checkout`, { method: 'POST' }, token,
    ),

  verifyUnit: (token: string, projectId: number, sid: number, payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    apiFetch<{ message: string; service: Service; unit: ServiceUnit }>(
      `/api/projects/${projectId}/services/${sid}/units/verify`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }, token,
    ),
};
