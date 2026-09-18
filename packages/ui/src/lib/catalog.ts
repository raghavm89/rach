/**
 * Typed view of the shared catalog.
 *
 * Imports the SAME `catalog.json` the server prices from, so the marketing
 * page, the dashboard and the checkout can no longer drift from what a customer
 * is actually charged. Previously the catalog was copy-pasted into four files
 * and had drifted: Managed PostgreSQL displayed at $200 but was priced at $100
 * server-side, and the Growth/Scale bundles advertised savings of $80/$130 when
 * the real figure was $30.
 *
 * Display only. Never compute an order total from this module and send it to
 * the server — the server prices every cart itself and ignores client amounts.
 */

import catalogJson from '@rach/billing/catalog.json';

export interface CatalogService {
  id: string;
  name: string;
  specs: string;
  unit_price_cents: number;
  unit: string;
  orderable?: boolean;
  featured?: boolean;
  /** Display-only: when true, hidden from marketing + dashboard UIs. Still priced server-side. */
  hidden?: boolean;
}

export interface CatalogBundleRaw {
  id: string;
  name: string;
  tagline: string;
  best_for: string;
  price_cents: number;
  badge: string | null;
  highlight: boolean;
  items: Record<string, number>;
}

export interface UsageBasedItem {
  id: string;
  name: string;
  note: string;
  price_cents_per_gb: number;
}

export type ComputeSize = 'nano' | 'micro' | 'small';

export interface ProComputeSize {
  delta_cents: number;
  memory_mb: number;
  cpu: string;
  specs: string;
}

export type PlanTier = 'starter' | 'pro';
export type BillingCurrency = 'USD' | 'INR';

export interface ProTier {
  label: string;
  /** Region-independent included allowance. Native price lives in `regions`. */
  base_includes_containers: number;
  /** @deprecated moved to `regions[currency].tiers` — may be absent. */
  base_cents?: number;
}

/** Native price block for one billing region (USD = Rest-of-World, INR = India). */
export interface ProRegion {
  currency: BillingCurrency;
  tiers: Record<PlanTier, { base_cents: number }>;
  container_cents: number;
  compute_delta_cents: Record<ComputeSize, number>;
}

export interface ProPricing {
  /** Back-compat: mirrors the USD region's STARTER tier. */
  base_cents: number;
  base_includes_containers: number;
  default_tier: PlanTier;
  default_region: BillingCurrency;
  tiers: Record<PlanTier, ProTier>;
  /** Geo-native prices — the display + charge authority per region. */
  regions: Record<BillingCurrency, ProRegion>;
  container_cents: number;
  inr_per_usd: number;
  default_compute_size: ComputeSize;
  compute_sizes: Record<ComputeSize, ProComputeSize>;
}

interface CatalogShape {
  currency: string;
  sac_code: string;
  services: CatalogService[];
  bundles: CatalogBundleRaw[];
  usage_based: UsageBasedItem[];
  included: string[];
  footnotes: string[];
  pro: ProPricing;
}

const catalog = catalogJson as unknown as CatalogShape;

export const CURRENCY = catalog.currency;
export const SERVICES: CatalogService[] = catalog.services;

/**
 * Services safe to show in user-facing UIs — excludes any flagged `hidden`.
 * `SERVICES` stays complete so server-parity previews and pricing lookups still
 * resolve every id.
 */
export const VISIBLE_SERVICES: CatalogService[] = catalog.services.filter((s) => !s.hidden);
export const USAGE_BASED: UsageBasedItem[] = catalog.usage_based;
export const INCLUDED: string[] = catalog.included;
export const FOOTNOTES: string[] = catalog.footnotes;

// Pro container pricing (display only — the server prices every charge). Mirrors
// packages/billing/src/proPricing.js. GEO-NATIVE: each region has its own price block.
export const PRO: ProPricing = catalog.pro;
export const COMPUTE_SIZES: ComputeSize[] = Object.keys(PRO.compute_sizes) as ComputeSize[];

/** The native price block for a billing currency (falls back to the default region). */
export function proRegion(currency: BillingCurrency = 'USD'): ProRegion {
  return PRO.regions[currency] ?? PRO.regions[PRO.default_region] ?? PRO.regions.USD;
}

/** Tier base price in the region's native minor units. */
export function proBaseCents(tier: PlanTier, currency: BillingCurrency = 'USD'): number {
  return proRegion(currency).tiers[tier].base_cents;
}

/** Additional-container fee in the region's native minor units. */
export function proContainerCents(currency: BillingCurrency = 'USD'): number {
  return proRegion(currency).container_cents;
}

/** Per-container compute add-on delta for a size, in the region's native minor units. */
export function computeDeltaCents(size: ComputeSize, currency: BillingCurrency = 'USD'): number {
  return proRegion(currency).compute_delta_cents[size] ?? 0;
}

/** Display monthly cost of one container: fee (waived on the free app slot) + compute delta. */
export function containerMonthlyCents(size: ComputeSize, isFreeAppSlot: boolean, currency: BillingCurrency = 'USD'): number {
  const fee = isFreeAppSlot ? 0 : proContainerCents(currency);
  return fee + computeDeltaCents(size, currency);
}

const SERVICE_BY_ID = new Map(SERVICES.map((s) => [s.id, s]));

export function getService(id: string): CatalogService | null {
  return SERVICE_BY_ID.get(id) ?? null;
}

export interface CatalogBundle extends CatalogBundleRaw {
  /** Retail total of the contents — derived, never stored. */
  listPriceCents: number;
  savingCents: number;
  savingPct: number;
  lines: { id: string; name: string; qty: number; unitPriceCents: number }[];
}

/** Mirrors `bundleListPriceCents` in packages/billing/src/catalog/index.js. */
function listPriceOf(bundle: CatalogBundleRaw): number {
  return Object.entries(bundle.items).reduce((sum, [id, qty]) => {
    const svc = SERVICE_BY_ID.get(id);
    return sum + (svc ? svc.unit_price_cents * qty : 0);
  }, 0);
}

export const BUNDLES: CatalogBundle[] = catalog.bundles.map((b) => {
  const listPriceCents = listPriceOf(b);
  const savingCents = listPriceCents - b.price_cents;
  return {
    ...b,
    listPriceCents,
    savingCents,
    savingPct: listPriceCents > 0 ? Math.round((savingCents / listPriceCents) * 100) : 0,
    lines: Object.entries(b.items).map(([id, qty]) => {
      const svc = SERVICE_BY_ID.get(id);
      return { id, name: svc?.name ?? id, qty, unitPriceCents: svc?.unit_price_cents ?? 0 };
    }),
  };
});

export function getBundle(id: string): CatalogBundle | null {
  return BUNDLES.find((b) => b.id === id) ?? null;
}

/**
 * Format integer cents for display.
 * Drops the decimals on whole amounts so $100.00 renders as "$100", but keeps
 * them where they matter ($0.15).
 */
export function formatCents(cents: number, currency = CURRENCY): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Preview a basket for display. The server re-prices independently at checkout;
 * a mismatch means this module and catalog.json are out of sync.
 */
export function previewCart(items: { id: string; qty: number }[]) {
  const lines = items
    .filter((i) => i.qty > 0)
    .map((i) => {
      const svc = SERVICE_BY_ID.get(i.id);
      if (!svc) return null;
      return {
        id: i.id,
        name: svc.name,
        qty: i.qty,
        unitPriceCents: svc.unit_price_cents,
        subtotalCents: svc.unit_price_cents * i.qty,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  return {
    lines,
    subtotalCents: lines.reduce((s, l) => s + l.subtotalCents, 0),
    description: lines.map((l) => `${l.qty}× ${l.name}`).join(', '),
  };
}
