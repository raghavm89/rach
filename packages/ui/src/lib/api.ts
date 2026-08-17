/**
 * Typed API client for the rach-dev backend.
 * Base URL is controlled by NEXT_PUBLIC_API_URL env var (defaults to localhost:8080).
 */

// Local dev: the backend listens on :3000 (apps/rachbase-backend/.env sets
// PORT=3000) and this web app runs on :3002. Docker and .env.example use :8080.
// apps/rachbase-web has no .env, so local development relies on this fallback —
// it must match the local backend port, not the container one.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'admin' | 'tenant_admin' | 'tenant_user' | 'developer'
  // Healthcare workspace roles (migration 047)
  | 'doctor' | 'reception' | 'store_manager'
  // HR workspace roles (migration 052)
  | 'hr_executive' | 'hr_director' | 'project_manager';

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
  /** Tenant's industry (e.g. 'healthcare') — gates the industry workspace nav. */
  tenant_industry?: string | null;
  /** 'personal' (self-serve owner → "Member") | 'org' (enterprise). */
  tenant_kind?: string | null;
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
  /** Seconds until the access token expires — drives the silent-refresh timer. */
  expires_in?: number;
  user: User;
}

export interface RefreshResponse {
  access_token: string;
  expires_in?: number;
  /** Returned so an OAuth callback can hydrate from the cookie alone. */
  user?: User;
}

/** Thrown by apiFetch; carries the fields the auth screens branch on. */
export interface AuthApiError extends Error {
  status: number;
  pending_id?: number;
  no_account?: boolean;
  expires_at?: string;
  resends_remaining?: number;
  attempts_left?: number;
  locked?: boolean;
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

const TOKEN_KEY = 'rd_access_token';
const USER_KEY  = 'rd_user';

/** Endpoints where a 401 means "bad credentials", not "session expired". */
const CREDENTIAL_ENDPOINTS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/verify-email',
  '/api/auth/reset-password',
]);

/**
 * In-flight refresh, shared across callers.
 *
 * Without this, a dashboard that fires six requests on mount would kick off six
 * concurrent refreshes. Because refresh tokens rotate and replaying a rotated
 * token trips the reuse detector, that would revoke the whole family and log
 * the user out — the exact failure the rotation scheme exists to catch.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = (await res.json()) as RefreshResponse;
      if (data.access_token) {
        localStorage.setItem(TOKEN_KEY, data.access_token);
        if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return data.access_token;
      }
      return null;
    } catch {
      return null;   // network blip — caller keeps the existing session
    } finally {
      // Cleared on the next tick so concurrent callers share this result.
      setTimeout(() => { refreshInFlight = null; }, 0);
    }
  })();

  return refreshInFlight;
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function rawFetch(path: string, options: RequestInit, token?: string | null) {
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    // Let the browser set the multipart boundary for FormData uploads.
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: 'include' });
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
  /** Internal: prevents an infinite refresh loop. */
  _isRetry = false,
): Promise<T> {
  let res = await rawFetch(path, options, token);

  // Access tokens are short-lived. On the first 401 from a token-authenticated
  // request, silently refresh and replay once. Previously any expired token
  // dumped the user straight to the marketing page mid-task.
  if (res.status === 401 && token && !_isRetry && !CREDENTIAL_ENDPOINTS.has(path)) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      res = await rawFetch(path, options, fresh);
    }
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const body = (data ?? {}) as Record<string, unknown>;
    const errMsg = (body.error as string) || 'Request failed';

    // Gateway errors (e.g. Razorpay 401 proxied through) must not clear the session.
    const isGatewayError = errMsg.toLowerCase().startsWith('payment gateway');

    if (res.status === 401 && !isGatewayError && !CREDENTIAL_ENDPOINTS.has(path)) {
      // Refresh already had its chance above — this session is genuinely done.
      clearSession();
      if (typeof window !== 'undefined') window.location.href = '/login?error=session_expired';
    }

    const err = new Error(errMsg) as AuthApiError;
    err.status = res.status;
    if (body.pending_id)        err.pending_id        = body.pending_id as number;
    if (body.no_account)        err.no_account        = true;
    if (body.expires_at)        err.expires_at        = body.expires_at as string;
    if (body.locked)            err.locked            = true;
    if (typeof body.resends_remaining === 'number') err.resends_remaining = body.resends_remaining;
    if (typeof body.attempts_left     === 'number') err.attempts_left     = body.attempts_left;
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

  register: (payload: { name: string; email: string; password: string; phone_number?: string; workspace_name?: string }) =>
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
    apiFetch<{ message: string; email_sent: boolean; resends_remaining: number; expires_at: string }>(
      '/api/auth/resend-verification',
      { method: 'POST', body: JSON.stringify({ pending_id: pendingId }) },
    ),

  logout: (token: string) =>
    apiFetch<{ message: string }>('/api/auth/logout', { method: 'POST' }, token),

  logoutAll: (token: string) =>
    apiFetch<{ message: string }>('/api/auth/logout-all', { method: 'POST' }, token),

  refresh: () =>
    apiFetch<RefreshResponse>('/api/auth/refresh', { method: 'POST' }),

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

  remove: (token: string, userId: number) =>
    apiFetch<{ message: string }>(`/api/users/${userId}`, { method: 'DELETE' }, token),

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

// ─── Cart (persistent, per-user billing cart) ─────────────────────────────────

export interface CartItem {
  id: string;   // catalog service id, or bundle id when kind === 'bundle'
  qty: number;
  kind?: 'service' | 'bundle';
}

export interface CartResponse {
  items: CartItem[];
  updatedAt: string | null;
}

export const cart = {
  get: (token: string) =>
    apiFetch<CartResponse>('/api/cart', {}, token),

  save: (token: string, items: CartItem[]) =>
    apiFetch<CartResponse>('/api/cart', { method: 'PUT', body: JSON.stringify({ items }) }, token),

  clear: (token: string) =>
    apiFetch<CartResponse>('/api/cart', { method: 'DELETE' }, token),
};

// ─── VM keypairs (admin) ──────────────────────────────────────────────────────

export interface VmKey {
  id: number;
  order_id: number | null;
  vm_id: string | null;
  user_id: number | null;
  tenant_id: number | null;
  public_key: string;
  fingerprint: string;
  ssh_user: string;
  status: 'pending' | 'active' | 'rotating' | 'revoked';
  key_version: number;
  created_at: string;
  activated_at: string | null;
  rotated_at: string | null;
}

export const vmKeys = {
  list: (token: string, params?: { status?: string; order_id?: number }) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return apiFetch<{ keys: VmKey[] }>(`/api/vm-keys${qs}`, {}, token);
  },

  activate: (token: string, id: number, body: { vm_id: string; ip_address: string; ssh_port?: number }) =>
    apiFetch<{ message: string; key: VmKey }>(
      `/api/vm-keys/${id}/activate`, { method: 'POST', body: JSON.stringify(body) }, token,
    ),

  reissue: (token: string, vm_id: string) =>
    apiFetch<{ message: string; key: Partial<VmKey> }>(
      `/api/vm-keys/reissue`, { method: 'POST', body: JSON.stringify({ vm_id }) }, token,
    ),
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
  /**
   * A catalog service id. Not a closed union — adding a service to
   * catalog.json must not require editing a type here. The server validates
   * the id against the catalog and rejects unknown ones.
   */
  id: string;
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

  // ── VM Logs entitlement (per-VM, admin-assigned; mirrors Observability) ──
  hasLogs: (token: string) =>
    apiFetch<{ logs_vm_ids: string[] | null; unlimited: boolean }>('/api/expansion/has-logs', {}, token),

  listLogsAssignments: (token: string, tenant_id?: number) => {
    const qs = tenant_id ? `?tenant_id=${tenant_id}` : '';
    return apiFetch<{ assignments: { id: number; tenant_id: number; vm_id: string; assigned_at: string; tenant_name: string; assigned_by_name: string | null }[] }>(
      `/api/expansion/logs/assignments${qs}`, {}, token
    );
  },

  getLogsQuota: (token: string) =>
    apiFetch<{ quotas: { tenant_id: number; tenant_name: string; quota: number; used: number }[] }>(
      '/api/expansion/logs/quota', {}, token
    ),

  assignLogs: (token: string, tenant_id: number, vm_id: string) =>
    apiFetch<{ message: string; assignment: unknown }>(
      '/api/expansion/logs/assign',
      { method: 'POST', body: JSON.stringify({ tenant_id, vm_id }) },
      token
    ),

  unassignLogs: (token: string, tenant_id: number, vm_id: string) =>
    apiFetch<{ message: string }>(
      '/api/expansion/logs/assign',
      { method: 'DELETE', body: JSON.stringify({ tenant_id, vm_id }) },
      token
    ),

  // ── Additional Public IPs ──
  myIps: (token: string) =>
    apiFetch<{ ips: { id: number; vm_id: string; ip_address: string; purpose: string | null; created_at: string }[] }>(
      '/api/expansion/my-ips', {}, token),

  getIpQuota: (token: string) =>
    apiFetch<{ quotas: { tenant_id: number; tenant_name: string; quota: number; used: number }[] }>(
      '/api/expansion/ips/quota', {}, token),

  listIpAssignments: (token: string, tenant_id?: number) => {
    const qs = tenant_id ? `?tenant_id=${tenant_id}` : '';
    return apiFetch<{ assignments: { id: number; tenant_id: number; vm_id: string; ip_address: string; purpose: string | null; status: string; created_at: string; tenant_name: string; assigned_by_name: string | null }[] }>(
      `/api/expansion/ips/assignments${qs}`, {}, token
    );
  },

  assignIp: (token: string, payload: { tenant_id: number; vm_id: string; ip_address: string; purpose?: string; request_id?: number }) =>
    apiFetch<{ message: string; assignment: unknown }>(
      '/api/expansion/ips/assign', { method: 'POST', body: JSON.stringify(payload) }, token),

  releaseIp: (token: string, id: number) =>
    apiFetch<{ message: string }>(
      '/api/expansion/ips/assign', { method: 'DELETE', body: JSON.stringify({ id }) }, token),

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

  /**
   * Create a subscription order.
   *
   * Send cart IDENTITY only — a `bundle_id` or a list of `{ id, qty }`. Prices
   * are deliberately not part of this payload: the server prices the cart from
   * `packages/billing/catalog.json` and ignores any amount a client sends.
   * `total_cents` used to be accepted here and passed straight to
   * razorpay.plans.create.
   */
  createSubscription: (token: string, payload: {
    bundle_id?: string;
    items?: CustomOrderItem[];
    billing_country?: string;
  }) =>
    apiFetch<{
      subscription_id: string | null;
      plan_id: string | null;
      razorpay_key_id: string | null;
      description: string;
      /** Server-priced. */
      total_cents: number;
      currency: string;
      billing_currency: string;
      monthly_amount: number;
      customer_country: string | null;
      converted: boolean;
      fx_rate: number | null;
      lines: { id: string; name: string; qty: number; unit_price_cents: number; subtotal_cents: number }[];
      bundle_id?: string;
      list_price_cents?: number;
      saving_cents?: number;
    }>('/api/expansion/subscriptions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  /**
   * Called after subscription payment succeeds — creates the DB record.
   *
   * The three `razorpay_*` signature fields are REQUIRED. They were optional,
   * and the server skipped verification entirely when any were absent, which
   * meant a request omitting them created an active subscription with no
   * payment. Prices are again not accepted; the server re-prices from the cart.
   */
  activateSubscription: (token: string, payload: {
    razorpay_subscription_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    razorpay_plan_id?: string;
    bundle_id?: string;
    items?: CustomOrderItem[];
    billing_country?: string;
  }) =>
    apiFetch<{ message: string; request: ExpansionRequest }>(
      '/api/expansion/subscriptions/activate',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),
};

// ─── Application Workload Monitoring (HTTP endpoints) ──────────────────────────

export interface MonitoredEndpoint {
  id: number;
  service_id: number | null;
  name: string;
  url: string;
  method: string;
  expected_status: number;
  interval_seconds: number;
  enabled: boolean;
  last_status: 'up' | 'down' | null;
  last_code: number | null;
  last_latency_ms: number | null;
  last_checked_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  created_at: string;
}

export interface EndpointCheck {
  checked_at: string;
  ok: boolean;
  status_code: number | null;
  latency_ms: number | null;
  error: string | null;
}

export const endpoints = {
  getQuota: (token: string) =>
    apiFetch<{ quota: number | null; used: number; unlimited: boolean }>('/api/endpoints/quota', {}, token),

  list: (token: string, serviceId?: number) =>
    apiFetch<{ endpoints: MonitoredEndpoint[] }>(
      `/api/endpoints${serviceId ? `?service_id=${serviceId}` : ''}`, {}, token),

  create: (token: string, payload: { name: string; url: string; method?: string; expected_status?: number; interval_seconds?: number; service_id?: number | null }) =>
    apiFetch<{ endpoint: MonitoredEndpoint }>('/api/endpoints', { method: 'POST', body: JSON.stringify(payload) }, token),

  update: (token: string, id: number, patch: Partial<{ name: string; url: string; method: string; expected_status: number; interval_seconds: number; enabled: boolean }>) =>
    apiFetch<{ endpoint: MonitoredEndpoint }>(`/api/endpoints/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, token),

  remove: (token: string, id: number) =>
    apiFetch<{ ok: boolean; id: number }>(`/api/endpoints/${id}`, { method: 'DELETE' }, token),

  checks: (token: string, id: number) =>
    apiFetch<{ checks: EndpointCheck[] }>(`/api/endpoints/${id}/checks`, {}, token),
};

// ─── Invoices & tax ───────────────────────────────────────────────────────────

/**
 * All money is in the currency's MINOR unit (paise/cents) as an integer.
 * Format with `formatMinor` rather than dividing in component code.
 */
export interface InvoiceSummary {
  id:              number;
  invoice_number:  string;
  status:          'issued' | 'paid' | 'void';
  currency:        string;
  subtotal_minor:  number;
  tax_total_minor: number;
  total_minor:     number;
  tax_treatment:   string | null;
  place_of_supply: string | null;
  issued_at:       string;
  user_name?:      string;
  email?:          string;
}

export interface InvoiceLine {
  id:               number;
  line_no:          number;
  description:      string;
  sac_code:         string | null;
  quantity:         number;
  unit_price_minor: number;
  subtotal_minor:   number;
  tax_rate_bps:     number;
  tax_amount_minor: number;
  tax_breakdown:    { name: string; rate_bps: number; amount_minor: number }[];
  total_minor:      number;
}

export interface TaxComponent {
  name:         string;
  rate_bps:     number;
  amount_minor: number;
}

export interface TaxQuote {
  currency:        string;
  subtotal_minor:  number;
  tax_total_minor: number;
  total_minor:     number;
  treatment:       string;
  place_of_supply: string;
  notes:           string | null;
  components:      TaxComponent[];
  lines: {
    description: string; quantity: number; unit_price_minor: number;
    subtotal_minor: number; tax_rate_bps: number; tax_amount_minor: number; total_minor: number;
  }[];
}

/** Format integer minor units. Never divide by 100 inline — see money.js. */
export function formatMinor(amountMinor: number, currency = 'USD') {
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format((amountMinor ?? 0) / 100);
}

/** 1800 → "18%" */
export function formatRateBps(rateBps: number) {
  const pct = (rateBps ?? 0) / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/\.?0+$/, '')}%`;
}

/** Human label for the tax treatment recorded on an invoice. */
export const TAX_TREATMENT_LABELS: Record<string, string> = {
  intra_state:         'GST (CGST + SGST)',
  inter_state:         'IGST',
  export_zero_rated:   'Zero-rated export',
  export_taxable:      'Export (IGST paid)',
  us_state_tax:        'US sales tax',
  no_registration:     'No tax charged',
  provider_unavailable:'No tax charged',
  exempt:              'Exempt',
};

export const invoices = {
  list: (token: string, params: { limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.limit  != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const suffix = qs.toString() ? `?${qs}` : '';
    return apiFetch<{ data: InvoiceSummary[]; total: number }>(`/api/invoices${suffix}`, {}, token);
  },

  get: (token: string, id: number) =>
    apiFetch<{ invoice: InvoiceSummary & { seller_json: unknown; buyer_json: unknown }; lines: InvoiceLine[] }>(
      `/api/invoices/${id}`, {}, token
    ),

  /** Absolute URL for the PDF. Fetched with the bearer token by `download`. */
  pdfUrl: (id: number) => `${BASE_URL}/api/invoices/${id}/pdf`,

  /**
   * Downloads the PDF. Uses fetch + blob rather than a plain link because the
   * endpoint requires an Authorization header.
   */
  download: async (token: string, id: number, filename?: string) => {
    const res = await fetch(`${BASE_URL}/api/invoices/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Could not download invoice');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `invoice-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  /** Tax preview for the checkout review step. */
  quote: (token: string, payload: {
    lines: { description: string; quantity: number; unit_price_minor: number }[];
    currency?: string;
    billing?: Record<string, unknown>;
  }) =>
    apiFetch<TaxQuote>('/api/invoices/quote', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),
};

// ─── Deployment endpoints ─────────────────────────────────────────────────────

export interface DeploymentService {
  id:              number;
  tenant_id:       number;
  vm_id:           string;
  source_type:     'github' | 'postgres';
  installation_id: number | null;
  repo_full_name:  string | null;
  branch:          string | null;
  name:            string | null;
  config:          Record<string, unknown> | null;
  status:          'connected' | 'deploying' | 'deployed' | 'failed';
  group_id?:       number | null;
  created_at:      string;
  updated_at:      string;
}

export interface ServiceGroup {
  id: number;
  name: string;
  color: string;
  created_at: string;
  service_count?: number;
}

export interface CanvasPosition { node_key: string; x: number; y: number }

export interface ServiceEnvVar { key: string; value: string; is_secret: boolean }

export interface ServiceDomain {
  id: number;
  hostname: string;
  is_auto: boolean;
  status: 'provisioning' | 'live' | 'failed';
  created_at: string;
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
    apiFetch<{ connected: boolean; installation_id?: number; github_account?: string; installed_at?: string; installations?: { installation_id: number; github_account: string; installed_at: string }[] }>(
      '/api/deployment/github/status', {}, token
    ),

  removeInstallation: (token: string, installationId: number | string) =>
    apiFetch<{ message: string; installation_id: string }>(
      `/api/deployment/github/installations/${installationId}`, { method: 'DELETE' }, token
    ),

  getInstallUrl: (token: string) =>
    apiFetch<{ install_url: string }>('/api/deployment/github/install', {}, token),

  reconcileGithub: (token: string) =>
    apiFetch<{ connected: boolean; reconciled?: boolean; installation_id?: number; github_account?: string; reason?: string; accounts?: string[] }>(
      '/api/deployment/github/reconcile', { method: 'POST' }, token
    ),

  listRepos: (token: string) =>
    apiFetch<{ repos: GithubRepo[] }>('/api/deployment/github/repos', {}, token),

  listBranches: (token: string, repo: string) =>
    apiFetch<{ branches: string[] }>(
      `/api/deployment/github/branches?repo=${encodeURIComponent(repo)}`, {}, token
    ),

  createService: (
    token: string,
    payload:
      | { vm_id: string; source_type?: 'github'; repo_full_name: string; branch: string; name?: string;
          config?: { root_dir?: string; install_cmd?: string; build_cmd?: string; start_cmd?: string; port?: number; watch_paths?: string[] } }
      | { vm_id: string; source_type: 'postgres'; name: string; config: { version: string } },
  ) =>
    apiFetch<{ service: DeploymentService }>('/api/deployment/services', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),

  deleteService: (token: string, serviceId: number) =>
    apiFetch<{ ok: boolean; id: number }>(`/api/deployment/services/${serviceId}`, { method: 'DELETE' }, token),

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

  updateServiceConfig: (
    token: string,
    serviceId: number,
    config: Partial<{ root_dir: string; install_cmd: string; build_cmd: string; start_cmd: string; port: number; watch_paths: string[] }>,
  ) =>
    apiFetch<{ service: DeploymentService }>(
      `/api/deployment/services/${serviceId}`, { method: 'PATCH', body: JSON.stringify(config) }, token,
    ),

  getRuntimeLogs: (token: string, serviceId: number) =>
    apiFetch<{ logs: string }>(`/api/deployment/services/${serviceId}/runtime-logs`, {}, token),

  getDomains: (token: string, serviceId: number) =>
    apiFetch<{ domains: ServiceDomain[]; target_ip: string | null }>(`/api/deployment/services/${serviceId}/domains`, {}, token),

  verifyDomain: (token: string, serviceId: number, domainId: number) =>
    apiFetch<{ hostname: string; target_ip: string | null; resolved: string[]; matches: boolean }>(
      `/api/deployment/services/${serviceId}/domains/${domainId}/check`, {}, token,
    ),

  addDomain: (token: string, serviceId: number, hostname: string) =>
    apiFetch<{ domain: ServiceDomain; message: string }>(
      `/api/deployment/services/${serviceId}/domains`, { method: 'POST', body: JSON.stringify({ hostname }) }, token,
    ),

  addAutoDomain: (token: string, serviceId: number, subdomain: string) =>
    apiFetch<{ domain: ServiceDomain; message: string }>(
      `/api/deployment/services/${serviceId}/domains/auto`, { method: 'POST', body: JSON.stringify({ subdomain }) }, token,
    ),

  removeDomain: (token: string, serviceId: number, domainId: number) =>
    apiFetch<{ ok: boolean }>(
      `/api/deployment/services/${serviceId}/domains/${domainId}`, { method: 'DELETE' }, token,
    ),

  getEnv: (token: string, serviceId: number) =>
    apiFetch<{ vars: ServiceEnvVar[] }>(`/api/deployment/services/${serviceId}/env`, {}, token),

  setEnv: (token: string, serviceId: number, vars: ServiceEnvVar[]) =>
    apiFetch<{ ok: boolean; count: number }>(
      `/api/deployment/services/${serviceId}/env`, { method: 'PUT', body: JSON.stringify({ vars }) }, token,
    ),

  getCanvas: (token: string) =>
    apiFetch<{ positions: CanvasPosition[] }>('/api/deployment/canvas', {}, token),

  saveCanvas: (token: string, positions: CanvasPosition[]) =>
    apiFetch<{ ok: boolean }>('/api/deployment/canvas', { method: 'PUT', body: JSON.stringify({ positions }) }, token),

  // Service groups (Phase 2 · WS6)
  listGroups: (token: string) =>
    apiFetch<{ groups: ServiceGroup[] }>('/api/deployment/groups', {}, token),
  createGroup: (token: string, name: string, color?: string) =>
    apiFetch<{ group: ServiceGroup }>('/api/deployment/groups', { method: 'POST', body: JSON.stringify({ name, color }) }, token),
  updateGroup: (token: string, groupId: number, patch: { name?: string; color?: string }) =>
    apiFetch<{ group: ServiceGroup }>(`/api/deployment/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify(patch) }, token),
  deleteGroup: (token: string, groupId: number) =>
    apiFetch<{ ok: boolean }>(`/api/deployment/groups/${groupId}`, { method: 'DELETE' }, token),
  setServiceGroup: (token: string, serviceId: number, groupId: number | null) =>
    apiFetch<{ service: { id: number; group_id: number | null } }>(
      `/api/deployment/services/${serviceId}/group`, { method: 'PATCH', body: JSON.stringify({ group_id: groupId }) }, token,
    ),

  // Auto-CORS: append the linked service's origin(s) to this service's CORS_ORIGINS.
  linkService: (token: string, serviceId: number, fromServiceId: number) =>
    apiFetch<{ ok: boolean; cors_origins: string; added: string[] }>(
      `/api/deployment/services/${serviceId}/link`, { method: 'POST', body: JSON.stringify({ from_service_id: fromServiceId }) }, token,
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

// ── Postgres data viewer + read-only query runner (Phase 2 · WS3) ─────────────
export interface DbTable {
  table_schema: string;
  table_name: string;
  column_count: number;
}
export interface DbQueryResult {
  fields: string[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  mode?: 'read' | 'write';
}

export const dbBrowser = {
  tables: (token: string, serviceId: number) =>
    apiFetch<{ tables: DbTable[] }>(
      `/api/deployment/services/${serviceId}/db/tables`, {}, token,
    ),
  /** Run SQL. `write: true` opts into a committing (read-write) transaction. */
  query: (token: string, serviceId: number, sql: string, write = false) =>
    apiFetch<DbQueryResult>(
      `/api/deployment/services/${serviceId}/db/query`, {
        method: 'POST',
        body: JSON.stringify({ sql, write }),
      }, token,
    ),
};

// ─── Workspace (RachDev): a tenant_admin sets their own tenant's industry ──────

export interface WorkspaceTenant {
  id: number;
  name: string | null;
  industry: string | null;
  /** Healthcare sub-category: true = military (AFMS) hospital. */
  military?: boolean;
}

export const workspace = {
  /** The caller's own tenant (id, name, industry). */
  get: (token: string) =>
    apiFetch<{ tenant: WorkspaceTenant | null }>('/api/tenant', {}, token),
  /** Set the tenant's industry (e.g. 'healthcare'); pass null to clear. */
  setIndustry: (token: string, industry: string | null) =>
    apiFetch<{ tenant: WorkspaceTenant | null }>('/api/tenant/industry', {
      method: 'PATCH',
      body: JSON.stringify({ industry }),
    }, token),
  /** Set the healthcare sub-category (military = AFMS hospital). */
  setHealthcare: (token: string, military: boolean) =>
    apiFetch<{ tenant: { id: number; military: boolean } }>('/api/tenant/healthcare', {
      method: 'PATCH',
      body: JSON.stringify({ military }),
    }, token),
};

// ─── Scribe (RachDev Healthcare): transcript → SOAP note → clinician sign-off ──

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface CodeSuggestion {
  system: string;      // 'CPT' | 'ICD-10-CM'
  code: string;
  description: string;
}

export interface Medication {
  drug: string;
  strength?: string;
  dose?: string;
  frequency?: string;
  route?: string;
  duration?: string;
  quantity?: string;
  instructions?: string;
}

export interface DrugInteraction {
  severity: 'major' | 'moderate' | 'minor';
  drugs: string[];
  description: string;
}

export interface ClinicalNote {
  id: number;
  patient_ref: string | null;
  visit_id?: number | null;
  transcript: string;
  medications?: Medication[];
  source: string;      // 'text' | 'dictation' | 'asr'
  soap: SoapNote;
  codes: CodeSuggestion[];
  follow_ups: string[];
  status: 'draft' | 'signed';
  model: string | null;
  signed_by: number | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicalNoteSummary {
  id: number;
  patient_ref: string | null;
  source: string;
  status: 'draft' | 'signed';
  model: string | null;
  preview: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const scribe = {
  list: (token: string) =>
    apiFetch<{ notes: ClinicalNoteSummary[] }>('/api/scribe/notes', {}, token),
  get: (token: string, id: number) =>
    apiFetch<{ note: ClinicalNote }>(`/api/scribe/notes/${id}`, {}, token),
  /** Generate a SOAP draft. Pass note_id to continue an OPEN draft in place; visit_id links it to an OPD visit. */
  create: (token: string, body: { transcript: string; patient_ref?: string; source?: string; note_id?: number; visit_id?: number }) =>
    apiFetch<{ note: ClinicalNote }>('/api/scribe/notes', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),
  /** Delete a draft (signed notes cannot be deleted). */
  remove: (token: string, id: number) =>
    apiFetch<{ ok: boolean }>(`/api/scribe/notes/${id}`, { method: 'DELETE' }, token),
  /** Clinician edits to a draft before signing. Returns refreshed interaction warnings. */
  update: (
    token: string,
    id: number,
    patch: { soap?: SoapNote; codes?: CodeSuggestion[]; follow_ups?: string[]; patient_ref?: string; medications?: Medication[] },
  ) =>
    apiFetch<{ note: ClinicalNote; interactions: DrugInteraction[] }>(`/api/scribe/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }, token),
  /** Clinician sign-off (human-in-the-loop gate). */
  sign: (token: string, id: number) =>
    apiFetch<{ note: ClinicalNote }>(`/api/scribe/notes/${id}/sign`, {
      method: 'POST',
    }, token),
  /** Draft a structured e-prescription from the note's transcript/plan. */
  prescribe: (token: string, id: number) =>
    apiFetch<{ note: ClinicalNote; interactions: DrugInteraction[] }>(`/api/scribe/notes/${id}/prescribe`, { method: 'POST' }, token),
  /** Stateless drug-interaction screen for a medication list. */
  checkInteractions: (token: string, medications: Medication[]) =>
    apiFetch<{ interactions: DrugInteraction[] }>('/api/scribe/interactions', { method: 'POST', body: JSON.stringify({ medications }) }, token),
};

// ─── Public: sales leads (marketing contact / "talk to us") ───────────────────
export const leads = {
  submit: (payload: {
    name: string; email: string; company?: string;
    goal?: string; source?: string; meta?: Record<string, unknown>;
  }) =>
    apiFetch<{ ok: boolean; id: number }>('/api/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ─── RachDev platform admin (role: 'admin') ───────────────────────────────────

export interface Org {
  id: number;
  name: string;
  industry: string | null;
  created_at: string;
  user_count: number;
  llm_model?: string | null;
  military?: boolean;
}

export interface AgentTemplate {
  id: number;
  tenant_id: number | null;
  key: string;
  name: string;
  role: string;
  industry: string | null;
  provider: string;
  model: string | null;
  prompt: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface DoctorProfile {
  user_id: number;
  tenant_id: number;
  department: string | null;
  specialty: string | null;
}

export const admin = {
  orgs: (token: string) =>
    apiFetch<{ orgs: Org[] }>('/api/admin/orgs', {}, token),
  createOrg: (token: string, payload: { name: string; industry?: string | null }) =>
    apiFetch<{ org: Org }>('/api/admin/orgs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token),
  setOrgIndustry: (token: string, id: number, industry: string | null) =>
    apiFetch<{ org: Org }>(`/api/admin/orgs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ industry }),
    }, token),
  setOrgModel: (token: string, id: number, model: string | null) =>
    apiFetch<{ org: { id: number; llm_model: string | null } }>(`/api/admin/orgs/${id}/model`, {
      method: 'PATCH',
      body: JSON.stringify({ model }),
    }, token),
  /** Set an org's healthcare sub-category (military = AFMS hospital). */
  setOrgHealthcare: (token: string, id: number, military: boolean) =>
    apiFetch<{ org: { id: number; military: boolean } }>(`/api/admin/orgs/${id}/healthcare`, {
      method: 'PATCH',
      body: JSON.stringify({ military }),
    }, token),
  deleteOrg: (token: string, id: number) =>
    apiFetch<{ ok: boolean }>(`/api/admin/orgs/${id}`, { method: 'DELETE' }, token),

  /** Doctor department profiles (RachDev healthcare vertical). */
  doctorProfiles: (token: string) =>
    apiFetch<{ profiles: DoctorProfile[] }>('/api/admin/doctors', {}, token),
  /** Set/clear a doctor's department (and optional specialty). */
  setDoctorProfile: (token: string, userId: number, department: string | null, specialty?: string | null) =>
    apiFetch<{ profile: DoctorProfile }>(`/api/admin/doctors/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ department, specialty: specialty ?? null }),
    }, token),

  templates: (token: string) =>
    apiFetch<{ templates: AgentTemplate[] }>('/api/admin/agent-templates', {}, token),
  createTemplate: (
    token: string,
    body: { key: string; name: string; role?: string; industry?: string | null; provider?: string; model?: string; prompt?: string },
  ) =>
    apiFetch<{ template: AgentTemplate }>('/api/admin/agent-templates', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),
  updateTemplate: (
    token: string,
    id: number,
    patch: { name?: string; role?: string; provider?: string; model?: string; prompt?: string; enabled?: boolean },
  ) =>
    apiFetch<{ template: AgentTemplate }>(`/api/admin/agent-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }, token),
};

// ─── Agent Monitor — operations view over the tenant's agents + teams ─────────

/** A built agent or assembled team, with activity + credit spend. */
export interface AgentMonitorEntity {
  kind: 'agent' | 'team';
  id: number;
  name: string;
  subtitle: string;
  status: string;              // draft | published | deployed | disabled
  model: string;
  runs_today: number;
  runs_total: number;
  credits_spent: number;
  last_run: string | null;
}

export interface AgentMonitorActivity {
  type: 'usage' | 'purchase';
  description: string;
  credits: number;             // spent (usage) or added (purchase)
  tokens: number | null;
  at: string;
}

export interface AgentMonitorOverview {
  summary: {
    agents: number;
    teams: number;
    deployed: number;
    balance: number;
    spent_today: number;
    spent_total: number;
    activity_today: number;
  } | null;
  entities: AgentMonitorEntity[];
  recent: AgentMonitorActivity[];
}

/** One handled message across any channel (the Conversations inbox row). */
export interface AgentRunRow {
  id: number;
  subject_type: 'agent' | 'team';
  subject_id: number;
  subject_name: string | null;
  channel: 'widget' | 'whatsapp' | 'slack' | 'api' | 'test';
  conversation_id: string | null;
  user_message: string | null;
  reply: string | null;
  model: string | null;
  credits_used: number;
  status: 'ok' | 'error';
  created_at: string;
}

export interface ConversationsFilter {
  channel?: string;
  subject_type?: 'agent' | 'team';
  subject_id?: number;
  limit?: number;
}

export const agentMonitor = {
  overview: (token: string) =>
    apiFetch<AgentMonitorOverview>('/api/agent-monitor', {}, token),
  conversations: (token: string, filter: ConversationsFilter = {}) => {
    const qs = new URLSearchParams();
    if (filter.channel) qs.set('channel', filter.channel);
    if (filter.subject_type) qs.set('subject_type', filter.subject_type);
    if (filter.subject_id != null) qs.set('subject_id', String(filter.subject_id));
    if (filter.limit != null) qs.set('limit', String(filter.limit));
    const q = qs.toString();
    return apiFetch<{ runs: AgentRunRow[] }>(`/api/agent-monitor/conversations${q ? `?${q}` : ''}`, {}, token);
  },
};

// ─── Clinical Control Tower (healthcare workspace) — fixed persona roster ──────

export interface ControlTowerAgent {
  key: string;
  name: string;
  role: string;
  enabled: boolean;
  status: 'active' | 'idle' | 'disabled';
  runs_today: number;
  runs_total: number;
  signed: number;
  success_rate: number | null;
  last_run: string | null;
  model: string;
}

export interface ControlTowerActivity {
  agent: string;
  kind: string;
  ref: string | null;
  status: string;
  model: string | null;
  source: string;
  author: string | null;
  at: string;
}

export interface ControlTowerOverview {
  summary: {
    active_agents: number;
    runs_today: number;
    notes_draft: number;
    notes_signed: number;
    tokens_used: number;
    credits_used: number;
    last_run: string | null;
  } | null;
  agents: ControlTowerAgent[];
  recent: ControlTowerActivity[];
  /** Handoff pipeline derived from the org's live Agent Team graph. */
  pipeline?: { label: string; role: string; type: 'conductor' | 'specialist' | 'handoff' | string }[];
  team?: { id: number; name: string; key: string } | null;
  health: { models: string[]; drafts_pending: number; shortage_alerts?: number; disabled: string[] };
}

export const controlTower = {
  overview: (token: string) =>
    apiFetch<ControlTowerOverview>('/api/control-tower', {}, token),
};

// ── Audit trail (governance) ──────────────────────────────────────────────────
export type AuditDecision =
  | 'created' | 'confirmed' | 'signed' | 'assigned' | 'completed' | 'cancelled' | 'flagged' | 'overridden' | 'modified';

export interface AuditEntry {
  id: number;
  agent: string | null;
  action: string;
  decision: AuditDecision | null;
  entity_type: string | null;
  entity_id: number | null;
  patient_ref: string | null;
  source: string | null;
  model: string | null;
  summary: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface AuditSummary {
  total: number;
  today: number;
  last_at: string | null;
  decisions: Partial<Record<AuditDecision, number>>;
  agents: Record<string, number>;
}

// ── Vihaan · Triage & Safety ──────────────────────────────────────────────────
export type Acuity = 'critical' | 'urgent' | 'semi-urgent' | 'routine';
export type TriageRoute = 'ER' | 'ICU' | 'OPD' | 'specialist';

export interface TriageAssessment {
  id: number;
  patient_ref: string | null;
  visit_id?: number | null;
  presentation?: string;
  vitals?: string | null;
  acuity: Acuity | null;
  acuity_score: number | null;
  red_flags: string[];
  recommended_route: TriageRoute | null;
  page_on_call: boolean;
  rationale?: string | null;
  disposition?: string | null;
  status: 'draft' | 'acknowledged';
  model: string | null;
  created_at: string;
  acknowledged_at?: string | null;
}

export const triage = {
  list: (token: string) =>
    apiFetch<{ assessments: TriageAssessment[] }>('/api/triage', {}, token),
  get: (token: string, id: number) =>
    apiFetch<{ assessment: TriageAssessment }>(`/api/triage/${id}`, {}, token),
  create: (token: string, body: { presentation: string; vitals?: string; patient_ref?: string; visit_id?: number }) =>
    apiFetch<{ assessment: TriageAssessment }>('/api/triage', { method: 'POST', body: JSON.stringify(body) }, token),
  acknowledge: (token: string, id: number, recommended_route?: string) =>
    apiFetch<{ assessment: TriageAssessment }>(`/api/triage/${id}/acknowledge`, { method: 'POST', body: JSON.stringify(recommended_route ? { recommended_route } : {}) }, token),
};

// ── Ira · Knowledge ───────────────────────────────────────────────────────────
export interface KnowledgeDoc {
  id: number;
  title: string;
  body: string;
  citation: string | null;
  author?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeAnswer {
  answer: string;
  citations: { title: string; ref: string }[];
  can_answer: boolean;
  used?: { id: number; title: string; citation: string | null }[];
  model: string | null;
  web_available?: boolean;
}

export interface WebReference { title: string; url: string; snippet: string }
export interface WebReferences {
  enabled: boolean;
  source: 'web' | 'web-demo' | 'off';
  references: WebReference[];
  note?: string;
}

export const knowledge = {
  docs: (token: string) =>
    apiFetch<{ docs: KnowledgeDoc[] }>('/api/knowledge/docs', {}, token),
  addDoc: (token: string, body: { title: string; body: string; citation?: string }) =>
    apiFetch<{ doc: KnowledgeDoc }>('/api/knowledge/docs', { method: 'POST', body: JSON.stringify(body) }, token),
  deleteDoc: (token: string, id: number) =>
    apiFetch<{ ok: boolean }>(`/api/knowledge/docs/${id}`, { method: 'DELETE' }, token),
  ask: (token: string, question: string) =>
    apiFetch<KnowledgeAnswer>('/api/knowledge/ask', { method: 'POST', body: JSON.stringify({ question }) }, token),
  /** Controlled external web-reference lookup (no PHI; gated + logged). */
  web: (token: string, question: string) =>
    apiFetch<WebReferences>('/api/knowledge/web', { method: 'POST', body: JSON.stringify({ question }) }, token),
};

// ── Umeed · ICU Sentinel ──────────────────────────────────────────────────────
export type IcuSeverity = 'watch' | 'urgent' | 'critical';
export type IcuCondition = 'sepsis' | 'aki' | 'mi' | 'arrhythmia' | 'deterioration';

export interface IcuVitals {
  hr?: number | string; rr?: number | string; sbp?: number | string; dbp?: number | string;
  spo2?: number | string; temp?: number | string; gcs?: number | string;
  creatinine?: number | string; lactate?: number | string; troponin?: number | string;
  wbc?: number | string; urine_output?: number | string; ecg_note?: string;
}

export interface IcuBoardPatient {
  patient_id: number;
  patient_name: string;
  uhid: string | null;
  hr: number | null; rr: number | null; sbp: number | null; dbp: number | null;
  spo2: number | null; temp: number | null; gcs: number | null;
  creatinine: number | null; lactate: number | null; troponin: number | null; urine_output: number | null;
  ecg_note: string | null;
  news2: number | null;
  created_at: string;
  open_alerts: number;
  worst: IcuSeverity | null;
}

export interface IcuAlert {
  id: number;
  patient_id: number;
  patient_name?: string;
  uhid?: string | null;
  condition: IcuCondition | string;
  severity: IcuSeverity;
  score: number | null;
  evidence: string[];
  message: string | null;
  status: 'open' | 'acknowledged' | 'resolved';
  model: string | null;
  created_at: string;
}

export const icu = {
  board: (token: string) =>
    apiFetch<{ patients: IcuBoardPatient[] }>('/api/icu', {}, token),
  alerts: (token: string, status: 'open' | 'all' = 'open') =>
    apiFetch<{ alerts: IcuAlert[] }>(`/api/icu/alerts?status=${status}`, {}, token),
  record: (token: string, patientId: number, vitals: IcuVitals & { visit_id?: number }) =>
    apiFetch<{ observation: unknown; news2: number; alerts: IcuAlert[] }>('/api/icu/observations', {
      method: 'POST', body: JSON.stringify({ patient_id: patientId, ...vitals }),
    }, token),
  acknowledge: (token: string, id: number) =>
    apiFetch<{ alert: IcuAlert }>(`/api/icu/alerts/${id}/ack`, { method: 'POST' }, token),
  resolve: (token: string, id: number) =>
    apiFetch<{ alert: IcuAlert }>(`/api/icu/alerts/${id}/resolve`, { method: 'POST' }, token),
};

// ── Rhea · Coding & Revenue ───────────────────────────────────────────────────
export type DenialRisk = 'low' | 'medium' | 'high';
export type ClaimStatus = 'draft' | 'submitted' | 'paid' | 'denied';
export type Payer = 'ECHS' | 'CGHS' | 'ex-serviceman' | 'self' | 'TPA';

export interface ClaimCode { system: string; code: string; description: string }
export interface ClaimCharge { code: string; description: string; amount: number }

export interface Claim {
  id: number;
  note_id?: number | null;
  visit_id?: number | null;
  patient_ref: string | null;
  payer: Payer | string;
  codes: ClaimCode[];
  charges: ClaimCharge[];
  total_amount: number;
  currency: string;
  denial_risk: DenialRisk;
  denial_reasons: string[];
  notes: string | null;
  status: ClaimStatus;
  edited?: boolean;
  model: string | null;
  submitted_at?: string | null;
  created_at: string;
}

export interface ClaimSummary {
  id: number;
  patient_ref: string | null;
  payer: string;
  total_amount: number;
  currency: string;
  denial_risk: DenialRisk;
  status: ClaimStatus;
  created_at: string;
  submitted_at: string | null;
}

export const claims = {
  list: (token: string, status?: ClaimStatus) =>
    apiFetch<{ claims: ClaimSummary[] }>(`/api/claims${status ? `?status=${status}` : ''}`, {}, token),
  get: (token: string, id: number) =>
    apiFetch<{ claim: Claim }>(`/api/claims/${id}`, {}, token),
  generate: (token: string, noteId: number, payer?: string) =>
    apiFetch<{ claim: Claim }>('/api/claims', { method: 'POST', body: JSON.stringify({ note_id: noteId, payer }) }, token),
  update: (token: string, id: number, patch: { codes?: ClaimCode[]; charges?: ClaimCharge[]; payer?: string; denial_risk?: string; notes?: string }) =>
    apiFetch<{ claim: Claim }>(`/api/claims/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, token),
  submit: (token: string, id: number) =>
    apiFetch<{ claim: Claim }>(`/api/claims/${id}/submit`, { method: 'POST' }, token),
};

// ── Kabir · Coordination ──────────────────────────────────────────────────────
export type BedKind = 'general' | 'ICU' | 'OT';
export type BedStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

export interface Bed {
  id: number;
  ward: string;
  bed_number: string;
  kind: BedKind | string;
  status: BedStatus | string;
  patient_id: number | null;
  patient_name?: string | null;
  uhid?: string | null;
  visit_id: number | null;
  note: string | null;
}

export interface Referral {
  id: number;
  patient_id: number | null;
  patient_name?: string | null;
  uhid?: string | null;
  patient_ref: string | null;
  from_dept: string | null;
  to_dept: string | null;
  to_hospital: string | null;
  reason: string | null;
  priority: 'routine' | 'urgent';
  status: 'open' | 'accepted' | 'completed' | 'cancelled';
  created_at: string;
}

export interface DischargeSummaryBody {
  diagnosis: string;
  hospital_course: string;
  medications: string[];
  follow_up: string;
  advice: string;
}

export interface DischargeSummary {
  id: number;
  visit_id: number | null;
  patient_ref: string | null;
  summary: DischargeSummaryBody;
  status: 'draft' | 'signed';
  edited?: boolean;
  model: string | null;
  signed_at?: string | null;
  created_at: string;
}

export const coordination = {
  beds: (token: string) =>
    apiFetch<{ beds: Bed[] }>('/api/coordination/beds', {}, token),
  addBed: (token: string, body: { ward: string; bed_number: string; kind?: string }) =>
    apiFetch<{ bed: Bed }>('/api/coordination/beds', { method: 'POST', body: JSON.stringify(body) }, token),
  updateBed: (token: string, id: number, patch: { status?: string; patient_id?: number | null; visit_id?: number | null; note?: string }) =>
    apiFetch<{ bed: Bed }>(`/api/coordination/beds/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, token),
  referrals: (token: string) =>
    apiFetch<{ referrals: Referral[] }>('/api/coordination/referrals', {}, token),
  createReferral: (token: string, body: { patient_id?: number; patient_ref?: string; from_dept?: string; to_dept?: string; to_hospital?: string; reason?: string; priority?: string }) =>
    apiFetch<{ referral: Referral }>('/api/coordination/referrals', { method: 'POST', body: JSON.stringify(body) }, token),
  updateReferral: (token: string, id: number, status: string) =>
    apiFetch<{ referral: Referral }>(`/api/coordination/referrals/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, token),
  generateDischarge: (token: string, visitId: number) =>
    apiFetch<{ discharge: DischargeSummary }>('/api/coordination/discharge', { method: 'POST', body: JSON.stringify({ visit_id: visitId }) }, token),
  getDischarge: (token: string, id: number) =>
    apiFetch<{ discharge: DischargeSummary }>(`/api/coordination/discharge/${id}`, {}, token),
  updateDischarge: (token: string, id: number, summary: DischargeSummaryBody) =>
    apiFetch<{ discharge: DischargeSummary }>(`/api/coordination/discharge/${id}`, { method: 'PATCH', body: JSON.stringify({ summary }) }, token),
  signDischarge: (token: string, id: number) =>
    apiFetch<{ discharge: DischargeSummary }>(`/api/coordination/discharge/${id}/sign`, { method: 'POST' }, token),
  scheduleFollowUp: (token: string, body: { patient_id: number; appointment_at: string; department?: string; reason?: string }) =>
    apiFetch<{ visit: Visit }>('/api/coordination/follow-up', { method: 'POST', body: JSON.stringify(body) }, token),
};

// ── Patient journey (step-in → step-out) ──────────────────────────────────────
export interface JourneyStep {
  agent: string | null;
  action: string;
  decision: string | null;
  source: string | null;
  summary: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface PatientJourney {
  patient: { id: number; name: string; uhid: string | null; age: string | null; sex: string | null; phone: string | null; military?: MilitaryInfo | null };
  timeline: JourneyStep[];
  next: {
    follow_up: { id: number; appointment_at: string; department: string | null; reason: string | null } | null;
    discharge: { summary: DischargeSummaryBody; status: string; created_at: string } | null;
    medications: Medication[];
  };
}

export const journey = {
  get: (token: string, patientId: number) =>
    apiFetch<PatientJourney>(`/api/journey/${patientId}`, {}, token),
};

export const audit = {
  list: (token: string, opts: { agent?: string; decision?: string; q?: string; limit?: number; offset?: number } = {}) => {
    const p = new URLSearchParams();
    if (opts.agent) p.set('agent', opts.agent);
    if (opts.decision) p.set('decision', opts.decision);
    if (opts.q) p.set('q', opts.q);
    if (opts.limit != null) p.set('limit', String(opts.limit));
    if (opts.offset != null) p.set('offset', String(opts.offset));
    const qs = p.toString();
    return apiFetch<{ entries: AuditEntry[]; total: number; limit: number; offset: number }>(
      `/api/audit${qs ? `?${qs}` : ''}`, {}, token);
  },
  summary: (token: string) =>
    apiFetch<AuditSummary>('/api/audit/summary', {}, token),
};

// ─── Agent Builder (AgentSpec build → publish → deploy) ───────────────────────
// Contract: docs/RACHDEV_AGENTSPEC_CONTRACT.md + RACHDEV_RUNTIME_CONTRACT.md.

export type ModelClass = 'fast' | 'balanced' | 'reasoning';
export type AgentStatus = 'draft' | 'published' | 'deployed' | 'disabled';

export interface AgentSpec {
  id: number;
  key: string;
  name: string;
  role: string;
  description?: string;
  prompt?: string;
  industry: string | null;
  status: AgentStatus;
  version: number;
  model_policy: { class: ModelClass; pin?: string };
  runtime_target: { type: 'rachbase' | 'onprem' | 'byoc'; ref?: string };
  tools: unknown[];
  guardrails: Record<string, unknown>;
}

export interface AgentSpecInput {
  key?: string;
  name?: string;
  role?: string;
  industry?: string | null;
  prompt?: string;
  model_policy?: { class: ModelClass; pin?: string };
  tools?: unknown[];
  guardrails?: Record<string, unknown>;
  runtime_target?: { type: 'rachbase' | 'onprem' | 'byoc'; ref?: string };
}

export interface AgentDeployment {
  id: number;
  agent_key: string;
  version: number;
  runtime_target: { type: string };
  status: 'pending' | 'running' | 'stopped' | 'failed';
  last_error?: string | null;
  last_status_at?: string | null;
}

/** A model a tenant can pick for an agent/specialist. `billed` = consumes credits. */
export interface ModelOption { id: string; label: string; provider: 'auto' | 'anthropic' | 'openai'; billed: boolean }

export type DeployTarget = 'rachbase' | 'self_hosted';
export type Placement = 'onprem' | 'aws' | 'gcp' | 'azure' | 'k8s';

export interface RuntimeRecipeFile { name: string; language: string; content: string }
export interface RuntimeRecipe {
  placement: Placement;
  label: string;
  image: string;
  control_url: string;
  files: RuntimeRecipeFile[];
  notes: string;
}

/** Result of a deploy. Self-hosted includes an export bundle; managed includes the live run surface. */
export interface DeployResult {
  mode: DeployTarget;
  deployment?: AgentDeployment;
  error?: string;
  config?: unknown;
  instructions?: { steps: string[]; docs_url?: string };
  publicToken?: string;
  widgetUrl?: string;
  messageUrl?: string;
  embed?: string;
  // Self-hosted (on-prem / BYOC) bundle:
  placement?: Placement;
  runtime_token?: string;   // shown ONCE
  image?: string;
  control_url?: string;
  recipe?: RuntimeRecipe;
}

export type EvalExpectType = 'contains' | 'not_contains' | 'regex';
export interface AgentEvalCase {
  id: number;
  name: string;
  input: string;
  expect_type: EvalExpectType;
  expect_value: string;
  last_status: 'pass' | 'fail' | null;
  last_output: string | null;
  last_run_at: string | null;
}
export interface EvalReadiness { total: number; passed: number; ran: number; readiness: number }

export interface AgentIntegration {
  public_token: string | null;
  deployed: boolean;
  api_base: string;
  message_url: string | null;
  widget_url: string | null;
  openai_base_url: string;
  openai_model: string | null;
}

export interface ApiKeyInfo {
  id: number;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface AgentDeploymentLogs {
  deployment_id: number;
  agent_key: string;
  version: number;
  status: string;
  target: string | null;
  last_error: string | null;
  last_status_at: string | null;
  logs: unknown[];
  note: string | null;
}

export const agentBuilder = {
  list: (token: string) =>
    apiFetch<{ definitions: AgentSpec[] }>('/api/agent/definitions', {}, token),

  /** Models this workspace can run (platform Claude + any connected BYOK keys). */
  models: (token: string) =>
    apiFetch<{ models: ModelOption[] }>('/api/agent/models', {}, token).then((r) => r.models),

  create: (body: AgentSpecInput, token: string) =>
    apiFetch<{ definition: AgentSpec }>('/api/agent/definitions',
      { method: 'POST', body: JSON.stringify(body) }, token),

  update: (id: number, body: AgentSpecInput, token: string) =>
    apiFetch<{ definition: AgentSpec }>(`/api/agent/definitions/${id}`,
      { method: 'PUT', body: JSON.stringify(body) }, token),

  publish: (id: number, token: string) =>
    apiFetch<{ version: number; definition: AgentSpec }>(`/api/agent/definitions/${id}/publish`,
      { method: 'POST' }, token),

  versions: (id: number, token: string) =>
    apiFetch<{ versions: { version: number; published_at: string }[] }>(
      `/api/agent/definitions/${id}/versions`, {}, token),

  /** Deploy to a target ('rachbase' | 'self_hosted'); self-hosted returns an export bundle + runtime recipe. */
  deploy: (id: number, token: string, target?: DeployTarget, placement?: Placement) =>
    apiFetch<DeployResult>(`/api/agent/definitions/${id}/deploy`,
      { method: 'POST', body: JSON.stringify({ ...(target ? { target } : {}), ...(placement ? { placement } : {}) }) }, token),

  /** Workspace default deploy target + whether RachBase is wired on the server. */
  deploySettings: (token: string) =>
    apiFetch<{ target: DeployTarget | null; rachbase_ready: boolean }>('/api/agent/deploy-settings', {}, token),
  setDeployTarget: (target: DeployTarget, token: string) =>
    apiFetch<{ target: DeployTarget }>('/api/agent/deploy-settings', { method: 'PUT', body: JSON.stringify({ target }) }, token),

  deployments: (token: string) =>
    apiFetch<{ deployments: AgentDeployment[] }>('/api/agent/deployments', {}, token),

  stop: (deploymentId: number, token: string) =>
    apiFetch<{ deployment: AgentDeployment }>(`/api/agent/deployments/${deploymentId}/stop`,
      { method: 'POST' }, token),

  /** Deployment run logs + status/error (runtime logs are best-effort). */
  logs: (deploymentId: number, token: string) =>
    apiFetch<AgentDeploymentLogs>(`/api/agent/deployments/${deploymentId}/logs`, {}, token),

  /** Integration surface for an agent (public token + endpoint URLs). */
  integration: (id: number, token: string) =>
    apiFetch<AgentIntegration>(`/api/agent/definitions/${id}/integration`, {}, token),

  /** Per-agent evals + readiness. */
  evals: (id: number, token: string) =>
    apiFetch<{ evals: AgentEvalCase[]; readiness: EvalReadiness }>(`/api/agent/definitions/${id}/evals`, {}, token),
  createEval: (id: number, body: { name?: string; input: string; expect_type: EvalExpectType; expect_value: string }, token: string) =>
    apiFetch<{ eval: AgentEvalCase }>(`/api/agent/definitions/${id}/evals`, { method: 'POST', body: JSON.stringify(body) }, token).then((r) => r.eval),
  deleteEval: (evalId: number, token: string) =>
    apiFetch<{ ok: boolean }>(`/api/agent/evals/${evalId}`, { method: 'DELETE' }, token),
  runEvals: (id: number, token: string) =>
    apiFetch<{ results: { id: number; status: 'pass' | 'fail'; output: string }[]; readiness: EvalReadiness }>(`/api/agent/definitions/${id}/evals/run`, { method: 'POST' }, token),
  readiness: (id: number, token: string) =>
    apiFetch<EvalReadiness>(`/api/agent/definitions/${id}/readiness`, {}, token),

  /** Workspace API keys for programmatic access. */
  apiKeys: (token: string) =>
    apiFetch<{ keys: ApiKeyInfo[] }>('/api/agent/api-keys', {}, token).then((r) => r.keys),
  createApiKey: (name: string, token: string) =>
    apiFetch<{ key: ApiKeyInfo & { key: string } }>('/api/agent/api-keys', { method: 'POST', body: JSON.stringify({ name }) }, token).then((r) => r.key),
  revokeApiKey: (id: number, token: string) =>
    apiFetch<{ ok: boolean }>(`/api/agent/api-keys/${id}`, { method: 'DELETE' }, token),

  /** Platform starter templates the builder can begin from. */
  templates: (token: string) =>
    apiFetch<{ templates: AgentSpec[] }>('/api/agent/templates', {}, token),

  /** Copy a platform template into the workspace as a new draft agent. */
  fromTemplate: (templateId: number, token: string) =>
    apiFetch<{ definition: AgentSpec }>(`/api/agent/definitions/from-template/${templateId}`,
      { method: 'POST' }, token),

  /** Delete one of the workspace's agents. */
  remove: (id: number, token: string) =>
    apiFetch<{ ok: boolean }>(`/api/agent/definitions/${id}`, { method: 'DELETE' }, token),

  /** Credit balance for the header chip. */
  credits: (token: string) =>
    apiFetch<{ balance: number }>('/api/agent/credits', {}, token),

  /** Test-run an agent's own prompt against a message (spends metered credits). */
  test: (id: number, message: string, token: string) =>
    apiFetch<{ reply: string; creditsUsed: number; model: string; balance: number }>(
      `/api/agent/definitions/${id}/test`, { method: 'POST', body: JSON.stringify({ message }) }, token),
};

// ─── HR vertical (tenant-scoped data; returns domain objects as stored) ───────
// ─── Agent Teams (multi-agent canvas) ────────────────────────────────────────

export interface TeamNode {
  id: string;
  type: 'channel' | 'conductor' | 'specialist' | 'integration' | 'handoff';
  position: { x: number; y: number };
  data: {
    label?: string;
    role?: string;
    prompt?: string;
    model_class?: ModelClass;
    integration?: string;
    agentDefId?: number;
    [k: string]: unknown;
  };
}
export interface TeamEdge { id: string; source: string; target: string; label?: string }
export interface TeamGraph { nodes: TeamNode[]; edges: TeamEdge[] }
export interface AgentTeam {
  id: number;
  key: string;
  name: string;
  description: string | null;
  industry: string | null;
  graph: TeamGraph;
  status: string;
  version: number;
  updated_at: string;
}

export interface TeamTraceStep { node: string; label: string; detail: string }
export interface TeamRunResult { reply: string; trace: TeamTraceStep[]; creditsUsed: number; model?: string; balance: number }

export const agentTeams = {
  list: (token: string) =>
    apiFetch<{ teams: AgentTeam[] }>('/api/agent/teams', {}, token).then((r) => r.teams),
  get: (id: number, token: string) =>
    apiFetch<{ team: AgentTeam }>(`/api/agent/teams/${id}`, {}, token).then((r) => r.team),
  create: (body: { name: string; description?: string; industry?: string | null; graph?: TeamGraph }, token: string) =>
    apiFetch<{ team: AgentTeam }>('/api/agent/teams', { method: 'POST', body: JSON.stringify(body) }, token).then((r) => r.team),
  update: (id: number, body: { name?: string; description?: string; industry?: string | null; graph?: TeamGraph }, token: string) =>
    apiFetch<{ team: AgentTeam }>(`/api/agent/teams/${id}`, { method: 'PUT', body: JSON.stringify(body) }, token).then((r) => r.team),
  publish: (id: number, token: string) =>
    apiFetch<{ team: AgentTeam }>(`/api/agent/teams/${id}/publish`, { method: 'POST' }, token).then((r) => r.team),
  remove: (id: number, token: string) =>
    apiFetch<{ ok: boolean }>(`/api/agent/teams/${id}`, { method: 'DELETE' }, token),
  /** Run the team on a message (metered). Returns reply + decision trace. */
  run: (id: number, message: string, token: string) =>
    apiFetch<TeamRunResult>(`/api/agent/teams/${id}/run`, { method: 'POST', body: JSON.stringify({ message }) }, token),
  /** Make a published team live. Mints the website-widget embed. */
  deploy: (id: number, token: string) =>
    apiFetch<{ team: AgentTeam; endpoint: string } & WidgetEmbed>(`/api/agent/teams/${id}/deploy`, { method: 'POST' }, token),
  /** Rotate the public widget token (invalidates existing embeds). */
  rotateToken: (id: number, token: string) =>
    apiFetch<WidgetEmbed>(`/api/agent/teams/${id}/rotate-token`, { method: 'POST' }, token),
  /** Edit the graph from a natural-language instruction (metered). */
  edit: (id: number, instruction: string, token: string) =>
    apiFetch<{ team: AgentTeam; creditsUsed: number }>(`/api/agent/teams/${id}/edit`, { method: 'POST', body: JSON.stringify({ instruction }) }, token),
};

/** Public channel surface returned by deploy / rotate-token. */
export interface WidgetEmbed { publicToken: string; widgetUrl: string; embed: string; whatsappWebhookUrl?: string }

// ─── Integrations / Connections ──────────────────────────────────────────────

export interface ConnectorField { key: string; label: string; secret: boolean }
export interface Connector {
  id: string;
  name: string;
  category: 'channel' | 'tool' | 'model';
  auth: 'api_key' | 'oauth' | 'none';
  blurb: string;
  fields: ConnectorField[];
  actions: string[];
  connected: boolean;
  config: Record<string, unknown>;
}

export const integrations = {
  list: (token: string) =>
    apiFetch<{ connectors: Connector[] }>('/api/integrations', {}, token).then((r) => r.connectors),
  connect: (id: string, body: { credentials?: Record<string, string>; config?: Record<string, unknown> }, token: string) =>
    apiFetch<{ connection: unknown }>(`/api/integrations/${id}/connect`, { method: 'POST', body: JSON.stringify(body) }, token),
  disconnect: (id: string, token: string) =>
    apiFetch<{ ok: boolean }>(`/api/integrations/${id}/disconnect`, { method: 'POST' }, token),
  /** Begin an OAuth connect; returns the provider authorize URL to redirect to.
   *  Pass `shop` for Shopify (the *.myshopify.com domain). */
  oauthStart: (id: string, token: string, shop?: string) => {
    const q = new URLSearchParams({ return: typeof window !== 'undefined' ? window.location.origin : '' });
    if (shop) q.set('shop', shop);
    return apiFetch<{ url: string }>(`/api/integrations/${id}/oauth/start?${q.toString()}`, {}, token);
  },
};

// ─── Knowledge base (agent reference docs — /api/kb) ──────────────────────────

export interface KbDoc {
  id: number;
  title: string;
  citation: string | null;
  chunk_count: number;
  embedded_count: number;
  char_len: number;
  created_at: string;
  updated_at: string;
}

export const knowledgeBase = {
  list: (token: string) =>
    apiFetch<{ docs: KbDoc[] }>('/api/kb/docs', {}, token).then((r) => r.docs),
  /** Embed any chunks missing an embedding (enable semantic search). */
  reindex: (token: string) =>
    apiFetch<{ embedded: number; pending: number }>('/api/kb/reindex', { method: 'POST' }, token),
  add: (body: { title: string; body: string; citation?: string }, token: string) =>
    apiFetch<{ doc: KbDoc }>('/api/kb/docs', { method: 'POST', body: JSON.stringify(body) }, token).then((r) => r.doc),
  remove: (id: number, token: string) =>
    apiFetch<{ ok: boolean }>(`/api/kb/docs/${id}`, { method: 'DELETE' }, token),
  /** Upload a .txt/.md/.pdf file; the server extracts text and chunks it. */
  upload: (file: File, token: string, title?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (title) fd.append('title', title);
    return apiFetch<{ doc: KbDoc }>('/api/kb/upload', { method: 'POST', body: fd }, token).then((r) => r.doc);
  },
};

export type HrEntity =
  | 'requisitions' | 'applications' | 'candidates'
  | 'approvals' | 'interviews' | 'offers' | 'audit'
  // Layers 2–4 — Onboard · Operate · Discover
  | 'employees' | 'onboarding' | 'probation' | 'leave' | 'leave_balances'
  | 'payslips' | 'letters' | 'tickets' | 'review_cycles' | 'review_evals'
  | 'partnerships' | 'holidays' | 'announcements';

export const hr = {
  /** One entity's rows for the caller's tenant. */
  list: <T = unknown>(entity: HrEntity, token: string) =>
    apiFetch<Record<string, T[]>>(`/api/hr/${entity}`, {}, token).then((r) => r[entity] ?? []),

  /** Create one record for an entity. Returns the stored object. */
  create: <T = unknown>(entity: HrEntity, body: Record<string, unknown>, token: string) =>
    apiFetch<{ item: T }>(`/api/hr/${entity}`, { method: 'POST', body: JSON.stringify(body) }, token).then((r) => r.item),

  /** Delete one record (gated to HR Director / admin). */
  remove: (entity: HrEntity, id: string, token: string) =>
    apiFetch<{ ok: boolean }>(`/api/hr/${entity}/${encodeURIComponent(id)}`, { method: 'DELETE' }, token),

  /** Act on an approval's current step. */
  actApproval: <T = unknown>(id: string, action: 'approve' | 'request_changes', token: string, comment?: string) =>
    apiFetch<{ approval: T }>(`/api/hr/approvals/${encodeURIComponent(id)}/act`,
      { method: 'POST', body: JSON.stringify({ action, comment }) }, token).then((r) => r.approval),

  summary: (token: string) =>
    apiFetch<{ counts: Record<HrEntity, number> }>('/api/hr/summary', {}, token),

  /** Run the JD-writer agent for a requisition; routes a jd_approval into the chain. */
  draftJd: (requisition: Record<string, unknown>, token: string) =>
    apiFetch<{ jd: string; approval: unknown; model: string }>('/api/hr/jd/draft',
      { method: 'POST', body: JSON.stringify({ requisition }) }, token),

  getConfig: (token: string) =>
    apiFetch<{ config: HrConfig }>('/api/hr/config', {}, token).then((r) => r.config),
  saveConfig: (patch: Partial<HrConfig>, token: string) =>
    apiFetch<{ config: HrConfig }>('/api/hr/config', { method: 'PUT', body: JSON.stringify(patch) }, token).then((r) => r.config),

  // ── Layers 2–4 module actions ───────────────────────────────────────────────
  post: <T = unknown>(pathSuffix: string, body: Record<string, unknown>, token: string) =>
    apiFetch<T>(`/api/hr/${pathSuffix}`, { method: 'POST', body: JSON.stringify(body) }, token),

  onboarding: {
    toggleChecklist: (id: string, itemId: string, token: string) =>
      apiFetch<{ item: unknown }>(`/api/hr/onboarding/${encodeURIComponent(id)}/checklist`, { method: 'POST', body: JSON.stringify({ itemId }) }, token).then((r) => r.item),
    sendInvites: (id: string, token: string) =>
      apiFetch<{ item: unknown }>(`/api/hr/onboarding/${encodeURIComponent(id)}/invites`, { method: 'POST' }, token).then((r) => r.item),
    generateKit: (id: string, token: string) =>
      apiFetch<{ item: unknown }>(`/api/hr/onboarding/${encodeURIComponent(id)}/induction-kit`, { method: 'POST' }, token).then((r) => r.item),
    approveKit: (id: string, token: string) =>
      apiFetch<{ item: unknown }>(`/api/hr/onboarding/${encodeURIComponent(id)}/induction-kit/approve`, { method: 'POST' }, token).then((r) => r.item),
    completeModule: (id: string, moduleKey: string, token: string) =>
      apiFetch<{ item: unknown }>(`/api/hr/onboarding/${encodeURIComponent(id)}/module`, { method: 'POST', body: JSON.stringify({ moduleKey }) }, token).then((r) => r.item),
  },

  probation: {
    checkIn: (id: string, notes: string, token: string) =>
      apiFetch<{ item: unknown }>(`/api/hr/probation/${encodeURIComponent(id)}/checkin`, { method: 'POST', body: JSON.stringify({ notes }) }, token).then((r) => r.item),
    submitEvaluation: (taskId: string, body: { rating: number; strengths: string; growthAreas: string }, token: string) =>
      apiFetch<{ item: unknown }>(`/api/hr/probation/evaluations/${encodeURIComponent(taskId)}/submit`, { method: 'POST', body: JSON.stringify(body) }, token).then((r) => r.item),
    approveSummary: (id: string, token: string) =>
      apiFetch<{ item: unknown }>(`/api/hr/probation/${encodeURIComponent(id)}/approve-summary`, { method: 'POST' }, token).then((r) => r.item),
    confirm: (employeeId: string, token: string) =>
      apiFetch<{ ok: boolean; letterId: string }>(`/api/hr/probation/employees/${encodeURIComponent(employeeId)}/confirm`, { method: 'POST' }, token),
    extend: (employeeId: string, body: { reason: string; newEndDate: string }, token: string) =>
      apiFetch<{ ok: boolean }>(`/api/hr/probation/employees/${encodeURIComponent(employeeId)}/extend`, { method: 'POST', body: JSON.stringify(body) }, token),
    terminate: (employeeId: string, body: { reason: string; counselAck: boolean }, token: string) =>
      apiFetch<{ ok: boolean }>(`/api/hr/probation/employees/${encodeURIComponent(employeeId)}/terminate`, { method: 'POST', body: JSON.stringify(body) }, token),
  },

  applyLeave: (body: { type: string; from: string; to: string; reason?: string }, token: string) =>
    apiFetch<{ ok: boolean; requestId: string; workingDays: number }>('/api/hr/leave/apply', { method: 'POST', body: JSON.stringify(body) }, token),
  requestLetter: (body: { kind: string; note?: string }, token: string) =>
    apiFetch<{ ok: boolean; letterId: string }>('/api/hr/letters/request', { method: 'POST', body: JSON.stringify(body) }, token),

  askHr: (question: string, token: string) =>
    apiFetch<{ escalated: boolean; answer: string; matchedFaq?: string; ticketId?: string }>('/api/hr/helpdesk/ask', { method: 'POST', body: JSON.stringify({ question }) }, token),
  ticket: {
    draftReply: (id: string, token: string) =>
      apiFetch<{ item: unknown }>(`/api/hr/tickets/${encodeURIComponent(id)}/draft-reply`, { method: 'POST' }, token).then((r) => r.item),
    reply: (id: string, body: { body: string; resolve: boolean }, token: string) =>
      apiFetch<{ item: unknown }>(`/api/hr/tickets/${encodeURIComponent(id)}/reply`, { method: 'POST', body: JSON.stringify(body) }, token).then((r) => r.item),
  },

  review: {
    record: (id: string, body: { rating: number; strengths: string; growthAreas: string }, token: string) =>
      apiFetch<{ item: unknown }>(`/api/hr/reviews/${encodeURIComponent(id)}/record`, { method: 'POST', body: JSON.stringify(body) }, token).then((r) => r.item),
    approveSummary: (id: string, token: string) =>
      apiFetch<{ item: unknown }>(`/api/hr/reviews/${encodeURIComponent(id)}/approve-summary`, { method: 'POST' }, token).then((r) => r.item),
  },

  partnership: {
    decide: (id: string, body: { decision: 'accept' | 'decline' | 'archive'; reason?: string }, token: string) =>
      apiFetch<{ item: unknown }>(`/api/hr/partnerships/${encodeURIComponent(id)}/decide`, { method: 'POST', body: JSON.stringify(body) }, token).then((r) => r.item),
    draftBrief: (id: string, token: string) =>
      apiFetch<{ item: unknown }>(`/api/hr/partnerships/${encodeURIComponent(id)}/brief`, { method: 'POST' }, token).then((r) => r.item),
  },

  createAnnouncement: (body: { title: string; body: string }, token: string) =>
    apiFetch<{ item: unknown }>('/api/hr/announcements', { method: 'POST', body: JSON.stringify(body) }, token).then((r) => r.item),

  /** The employee's own record + their leave/letters/payslips/tickets/balance. */
  mySpace: (token: string) =>
    apiFetch<{ employee: unknown; leave?: unknown[]; letters?: unknown[]; payslips?: unknown[]; tickets?: unknown[]; balance?: unknown }>('/api/hr/me', {}, token),
};

export interface HrConfig {
  aiFeatures: Record<string, boolean>;
  policyGates: Record<string, boolean>;
  integrations: Record<string, 'connected' | 'available'>;
}

// ─── Support tickets ──────────────────────────────────────────────────────────

export type TicketStatus = 'open' | 'in_progress' | 'waiting_on_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'billing' | 'deployment' | 'vm' | 'account' | 'other';

export interface Ticket {
  id: number;
  tenant_id: number | null;
  user_id: number;
  subject: string;
  body: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  source: 'human' | 'bot';
  assigned_to: number | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  user_name?: string;
  user_email?: string;
  message_count?: number;
}

export interface TicketMessage {
  id: number;
  author_type: 'customer' | 'support' | 'bot';
  author_id: number | null;
  author_name?: string | null;
  body: string;
  created_at: string;
}

export interface ChatOption { label: string; intent?: string; action?: string }

export const support = {
  /** Rule-based support bot (no LLM): send a message or a quick-reply intent. */
  ask: (token: string, payload: { message?: string; intent?: string }) =>
    apiFetch<{ reply: string; options: ChatOption[] }>('/api/support/chat', { method: 'POST', body: JSON.stringify(payload) }, token),

  list: (token: string, opts: { status?: TicketStatus; page?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.status) q.set('status', opts.status);
    if (opts.page)   q.set('page', String(opts.page));
    return apiFetch<{ tickets: Ticket[]; total: number; page: number; limit: number }>(
      `/api/support/tickets${q.toString() ? `?${q}` : ''}`, {}, token,
    );
  },
  get: (token: string, id: number) =>
    apiFetch<{ ticket: Ticket; messages: TicketMessage[] }>(`/api/support/tickets/${id}`, {}, token),
  create: (token: string, payload: { subject: string; body?: string; category?: TicketCategory; priority?: TicketPriority; source?: 'human' | 'bot' }) =>
    apiFetch<{ ticket: Ticket }>('/api/support/tickets', { method: 'POST', body: JSON.stringify(payload) }, token),
  reply: (token: string, id: number, body: string) =>
    apiFetch<{ message: TicketMessage; status: TicketStatus }>(`/api/support/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }, token),
  update: (token: string, id: number, patch: { status?: TicketStatus; priority?: TicketPriority; assigned_to?: number | null }) =>
    apiFetch<{ ticket: Ticket }>(`/api/support/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, token),
};

// ─── Reception (Ava) — patient intake → structured encounter → confirm ────────

export interface IntakeData {
  patient: { name: string; age: string; sex: string };
  reason: string;
  history: string;
  medications: string[];
  allergies: string[];
  vitals: string;
  triage_summary: string;
}

export interface Encounter {
  id: number;
  patient_ref: string | null;
  patient_name: string | null;
  reason: string | null;
  intake: IntakeData;
  transcript: string;
  source: string;
  status: 'open' | 'confirmed';
  model: string | null;
  confirmed_by: number | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EncounterSummary {
  id: number;
  patient_ref: string | null;
  patient_name: string | null;
  reason: string | null;
  source: string;
  status: 'open' | 'confirmed';
  model: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const reception = {
  list: (token: string) =>
    apiFetch<{ encounters: EncounterSummary[] }>('/api/reception/encounters', {}, token),
  get: (token: string, id: number) =>
    apiFetch<{ encounter: Encounter }>(`/api/reception/encounters/${id}`, {}, token),
  /** Structure an intake from a transcript and persist a draft (optionally continue one). */
  create: (token: string, body: { transcript: string; patient_ref?: string; source?: string; encounter_id?: number }) =>
    apiFetch<{ encounter: Encounter }>('/api/reception/encounters', {
      method: 'POST', body: JSON.stringify(body),
    }, token),
  update: (token: string, id: number, patch: { intake?: IntakeData; patient_ref?: string }) =>
    apiFetch<{ encounter: Encounter }>(`/api/reception/encounters/${id}`, {
      method: 'PATCH', body: JSON.stringify(patch),
    }, token),
  /** Reception/clinician confirms the intake (human-in-the-loop). */
  confirm: (token: string, id: number) =>
    apiFetch<{ encounter: Encounter }>(`/api/reception/encounters/${id}/confirm`, { method: 'POST' }, token),
};

// ─── Inventory (Kiran) — drug stock, dispense, shortage alerts ────────────────

export interface StockItem {
  id: number;
  drug: string;
  unit: string;
  quantity: number;
  reorder_threshold: number;
  low: boolean;
  updated_at: string;
}

export interface ReorderAlert {
  id: number;
  drug: string;
  quantity: number;
  qty_suggested: number;
  message: string | null;
  status: 'open' | 'ordered' | 'dismissed';
  created_at: string;
  resolved_at: string | null;
}

export const inventory = {
  stock: (token: string) =>
    apiFetch<{ stock: StockItem[] }>('/api/inventory/stock', {}, token),
  upsertStock: (token: string, body: { drug: string; unit?: string; quantity: number; reorder_threshold: number }) =>
    apiFetch<{ item: StockItem }>('/api/inventory/stock', { method: 'POST', body: JSON.stringify(body) }, token),
  /** An approved prescription consumes stock; returns the item + any shortage alert raised. */
  dispense: (token: string, body: { drug?: string; qty?: number; prescription?: string }) =>
    apiFetch<{ item: StockItem; alert: ReorderAlert | null }>('/api/inventory/dispense', { method: 'POST', body: JSON.stringify(body) }, token),
  restock: (token: string, body: { drug: string; qty: number }) =>
    apiFetch<{ item: StockItem }>('/api/inventory/restock', { method: 'POST', body: JSON.stringify(body) }, token),
  alerts: (token: string) =>
    apiFetch<{ alerts: ReorderAlert[] }>('/api/inventory/alerts', {}, token),
  resolveAlert: (token: string, id: number, status: 'ordered' | 'dismissed') =>
    apiFetch<{ alert: ReorderAlert }>(`/api/inventory/alerts/${id}/resolve`, { method: 'POST', body: JSON.stringify({ status }) }, token),
};

// ─── OPD Reception (Dhanvantri-style): patients, visits, queue ────────────────

export interface MilitaryInfo {
  service_number?: string;
  rank?: string;
  relation?: string;       // SELF / dependent
  category?: string;       // e.g. Army(ECHS)
  arms_corps?: string;
  unit?: string;
  formation?: string;
  trade?: string;
  record_office?: string;
  echs_number?: string;
  validity_from?: string;
  validity_to?: string;
}

export interface Patient {
  id: number;
  uhid: string | null;
  external_id: string | null;
  source_system: string;
  name: string;
  dob: string | null;
  age: string | null;
  sex: string | null;
  phone: string | null;
  address: string | null;
  military?: MilitaryInfo | null;
  abha_number?: string | null;
  abha_address?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EligibilityCheck {
  id: number;
  patient_id: number | null;
  claim_id?: number | null;
  payer: string;
  kind: 'eligibility' | 'preauth';
  eligible: boolean | null;
  valid_from: string | null;
  valid_to: string | null;
  category: string | null;
  cashless: boolean | null;
  reference_id: string | null;
  amount: number | null;
  status: string | null;
  remarks: string | null;
  source: string;
  created_at: string;
}

export const echs = {
  verifyEligibility: (token: string, patientId: number) =>
    apiFetch<{ check: EligibilityCheck; live: boolean }>('/api/echs/eligibility', { method: 'POST', body: JSON.stringify({ patient_id: patientId }) }, token),
  latestEligibility: (token: string, patientId: number) =>
    apiFetch<{ check: EligibilityCheck | null; live: boolean }>(`/api/echs/eligibility/${patientId}`, {}, token),
  preAuth: (token: string, claimId: number) =>
    apiFetch<{ check: EligibilityCheck; live: boolean }>('/api/echs/preauth', { method: 'POST', body: JSON.stringify({ claim_id: claimId }) }, token),
};

export const abdm = {
  linkAbha: (token: string, patientId: number, opts?: { abha_address?: string; abha_number?: string }) =>
    apiFetch<{ patient: { id: number; name: string; uhid: string | null; abha_number: string | null; abha_address: string | null }; live: boolean }>(
      `/api/abdm/patients/${patientId}/abha`, { method: 'POST', body: JSON.stringify(opts || {}) }, token),
};

export type VisitStatus = 'scheduled' | 'waiting' | 'in_consultation' | 'completed' | 'cancelled';

export interface Visit {
  id: number;
  patient_id: number;
  patient_name?: string;
  uhid?: string | null;
  phone?: string | null;
  hospital_name?: string | null;   // for the token slip
  department: string | null;
  doctor_id: number | null;
  doctor_name: string | null;
  token_no: number | null;
  appointment_at: string | null;
  status: VisitStatus;
  reason: string | null;
  patient_type?: string;           // routine | urgent | schedule
  visit_type?: string;             // OPD | AME | PME
  referral_hospital?: string | null;
  referred_by?: string | null;
  source_system: string;
  created_at: string;
  updated_at: string;
}

export interface Doctor {
  id: number;
  name: string;
  department?: string | null;
  active_load?: number;
}

export interface VisitNote {
  id: number;
  patient_ref: string | null;
  soap: SoapNote;
  status: 'draft' | 'signed';
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VisitDetail extends Visit {
  age?: string | null;
  sex?: string | null;
  address?: string | null;
  military?: MilitaryInfo | null;
}

export type ConsentPurpose = 'treatment' | 'data_processing' | 'echs_claim' | 'research';
export type ConsentMethod = 'verbal' | 'written' | 'digital';

export interface Consent {
  purpose: ConsentPurpose | string;
  granted: boolean;
  method: ConsentMethod | string;
  notes?: string | null;
  created_at: string;
}

export const opd = {
  searchPatients: (token: string, q = '') =>
    apiFetch<{ patients: Patient[]; dhanvantri: boolean }>(`/api/reception/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`, {}, token),
  upsertPatient: (token: string, body: Partial<Patient> & { name: string; military?: MilitaryInfo }) =>
    apiFetch<{ patient: Patient }>('/api/reception/patients', { method: 'POST', body: JSON.stringify(body) }, token),
  doctors: (token: string) =>
    apiFetch<{ doctors: Doctor[] }>('/api/reception/doctors', {}, token),
  visits: (token: string, scope: 'today' | 'all' = 'today', mine = false) =>
    apiFetch<{ visits: Visit[] }>(`/api/reception/visits?scope=${scope}${mine ? '&mine=1' : ''}`, {}, token),
  getVisit: (token: string, id: number) =>
    apiFetch<{ visit: VisitDetail; notes: VisitNote[]; consent: Consent[] }>(`/api/reception/visits/${id}`, {}, token),
  getPatient: (token: string, id: number) =>
    apiFetch<{ patient: Patient; consent: Consent[] }>(`/api/reception/patients/${id}`, {}, token),
  /** Record a DPDP consent decision for a patient. */
  recordConsent: (token: string, patientId: number, body: { purpose?: string; granted?: boolean; method?: string; notes?: string }) =>
    apiFetch<{ consent: Consent }>(`/api/reception/patients/${patientId}/consent`, { method: 'POST', body: JSON.stringify(body) }, token),
  createVisit: (token: string, body: {
    patient_id: number; department?: string; doctor_id?: number; appointment_at?: string; reason?: string;
    patient_type?: string; visit_type?: string; referral_hospital?: string; referred_by?: string;
  }) =>
    apiFetch<{ visit: Visit }>('/api/reception/visits', { method: 'POST', body: JSON.stringify(body) }, token),
  /** Assign a doctor. Omit doctorId to let the AI pick the best available for the department. */
  assignDoctor: (token: string, id: number, doctorId?: number) =>
    apiFetch<{ visit: Visit; rationale: string }>(`/api/reception/visits/${id}/assign`, {
      method: 'POST', body: JSON.stringify(doctorId ? { doctor_id: doctorId } : {}),
    }, token),
  updateVisit: (token: string, id: number, patch: { status?: VisitStatus; doctor_id?: number; department?: string }) =>
    apiFetch<{ visit: Visit }>(`/api/reception/visits/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, token),
};
