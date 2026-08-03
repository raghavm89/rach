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
  /** Tenant's industry (e.g. 'healthcare') — gates the industry workspace nav. */
  tenant_industry?: string | null;
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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

export interface ClinicalNote {
  id: number;
  patient_ref: string | null;
  transcript: string;
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
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const scribe = {
  list: (token: string) =>
    apiFetch<{ notes: ClinicalNoteSummary[] }>('/api/scribe/notes', {}, token),
  get: (token: string, id: number) =>
    apiFetch<{ note: ClinicalNote }>(`/api/scribe/notes/${id}`, {}, token),
  /** Generate a SOAP draft from a transcript and persist it. */
  create: (token: string, body: { transcript: string; patient_ref?: string; source?: string }) =>
    apiFetch<{ note: ClinicalNote }>('/api/scribe/notes', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),
  /** Clinician edits to a draft before signing. */
  update: (
    token: string,
    id: number,
    patch: { soap?: SoapNote; codes?: CodeSuggestion[]; follow_ups?: string[]; patient_ref?: string },
  ) =>
    apiFetch<{ note: ClinicalNote }>(`/api/scribe/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }, token),
  /** Clinician sign-off (human-in-the-loop gate). */
  sign: (token: string, id: number) =>
    apiFetch<{ note: ClinicalNote }>(`/api/scribe/notes/${id}/sign`, {
      method: 'POST',
    }, token),
};
