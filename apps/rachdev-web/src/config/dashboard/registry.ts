import type { LucideIcon } from 'lucide-react';
import {
  Radio, Stethoscope, ClipboardList, Package, ShieldCheck,
  Settings, Building2, Users, Boxes, Activity, LifeBuoy, Bot,
  LayoutDashboard, FileText, Kanban, Inbox, CalendarClock, HandCoins, ScrollText, Plug,
  Siren, BookOpen, HeartPulse, Receipt, Network, Route,
  UserPlus, Hourglass, Luggage, StickyNote, CalendarDays, Handshake,
  UserRound, MailOpen, MessageCircleQuestion,
} from 'lucide-react';

/**
 * Dashboard module registry — "one shell, content per industry".
 *
 * The dashboard layout is identical for every tenant; only the workspace nav
 * items and role labels vary by the tenant's industry. Onboarding a NEW industry
 * is a config change here (plus its route pages under /dashboard) — not a layout
 * rewrite. This is what makes RachDev multi-industry instead of clinical-only.
 */

export interface DashboardModule {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Roles that see this item. Omitted = visible to every role. */
  roles?: string[];
}

export interface IndustryModule {
  id: string;
  label: string;
  /** Industry-specific role display labels, merged over the platform labels. */
  roleLabels?: Record<string, string>;
  /** Workspace nav items for this industry. */
  modules: DashboardModule[];
}

// Platform role labels — industry-independent (RachDev has no "tenant" wording).
export const platformRoleLabels: Record<string, string> = {
  admin: 'RachDev Admin',
  tenant_admin: 'Org Admin',
  tenant_user: 'Member',
  developer: 'Developer',
};

// Industry-independent nav shown ABOVE the industry workspace.
//   • RachDev platform admin → Organizations / Users / Agent Templates
//   • Org admin → Agent Monitor (every industry has agents)
export const platformNav: DashboardModule[] = [
  { label: 'Organizations',   href: '/dashboard/orgs',          icon: Building2, roles: ['admin'] },
  { label: 'Users',           href: '/dashboard/users',         icon: Users,     roles: ['admin'] },
  { label: 'Agent Templates', href: '/dashboard/agents',         icon: Boxes,     roles: ['admin'] },
  { label: 'Agent Builder',   href: '/dashboard/agents-builder', icon: Bot,       roles: ['tenant_admin'] },
  { label: 'Agent Monitor',   href: '/dashboard/agent-monitor',  icon: Activity,  roles: ['tenant_admin'] },
];

// Industry-independent nav shown BELOW the industry workspace.
export const platformFooterNav: DashboardModule[] = [
  { label: 'Support',  href: '/dashboard/support',  icon: LifeBuoy },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, roles: ['tenant_admin'] },
];

// HR staff roles that see the full HR workspace (everything except the
// employee-only "My Space"). Org Admin is included.
const HR_STAFF = ['tenant_admin', 'hr_executive', 'hr_director', 'project_manager'];

// ── Registered industries ────────────────────────────────────────────────────
// Add a vertical by adding an entry here and its route pages under /dashboard.
export const industryModules: Record<string, IndustryModule> = {
  healthcare: {
    id: 'healthcare',
    label: 'Healthcare',
    roleLabels: {
      doctor: 'Doctor',
      reception: 'Reception',
      store_manager: 'Store Manager',
    },
    modules: [
      { label: 'Control Tower', href: '/dashboard/clinical/control-tower', icon: Radio,         roles: ['tenant_admin'] },
      { label: 'My Patients',   href: '/dashboard/clinical/my-patients',   icon: CalendarClock, roles: ['doctor'] },
      { label: 'Triage',        href: '/dashboard/clinical/triage',        icon: Siren,         roles: ['reception', 'doctor', 'tenant_admin'] },
      { label: 'Scribe',        href: '/dashboard/clinical/scribe',        icon: Stethoscope,   roles: ['doctor'] },
      { label: 'Reception',     href: '/dashboard/clinical/reception',     icon: ClipboardList, roles: ['reception'] },
      { label: 'Doctor Notes',  href: '/dashboard/clinical/notes',         icon: FileText,      roles: ['reception'] },
      { label: 'Knowledge',     href: '/dashboard/clinical/knowledge',     icon: BookOpen,      roles: ['reception', 'doctor', 'store_manager', 'tenant_admin'] },
      { label: 'ICU Sentinel',  href: '/dashboard/clinical/icu',           icon: HeartPulse,    roles: ['doctor', 'tenant_admin'] },
      { label: 'Coordination',  href: '/dashboard/clinical/coordination',  icon: Network,       roles: ['reception', 'doctor', 'tenant_admin'] },
      { label: 'Patient Journey', href: '/dashboard/clinical/journey',     icon: Route,         roles: ['reception', 'doctor', 'tenant_admin'] },
      { label: 'Billing',       href: '/dashboard/clinical/billing',       icon: Receipt,       roles: ['doctor', 'tenant_admin'] },
      { label: 'Inventory',     href: '/dashboard/clinical/inventory',     icon: Package,       roles: ['store_manager', 'tenant_admin'] },
      { label: 'Audit',         href: '/dashboard/clinical/audit',         icon: ShieldCheck,   roles: ['tenant_admin'] },
    ],
  },

  // Human Resources (ported from HR Layers — Layers 1–4: Hire → Onboard →
  // Operate → Discover, plus the employee "My Space" self-service portal).
  hr: {
    id: 'hr',
    label: 'Human Resources',
    roleLabels: {
      hr_executive: 'HR Executive',
      hr_director: 'HR Director',
      project_manager: 'Project Manager',
      employee: 'Employee',
    },
    modules: [
      // Overview + Hire (Layer 1)
      { label: 'Dashboard',    href: '/dashboard/hr',              icon: LayoutDashboard, roles: HR_STAFF },
      { label: 'Requisitions', href: '/dashboard/hr/requisitions', icon: FileText,        roles: HR_STAFF },
      { label: 'Pipeline',     href: '/dashboard/hr/pipeline',     icon: Kanban,          roles: HR_STAFF },
      { label: 'Interviews',   href: '/dashboard/hr/interviews',   icon: CalendarClock,   roles: HR_STAFF },
      { label: 'Offers',       href: '/dashboard/hr/offers',       icon: HandCoins,       roles: ['tenant_admin', 'hr_executive', 'hr_director'] },
      // Onboard · Operate (Layers 2–3)
      { label: 'Onboarding',   href: '/dashboard/hr/onboarding',   icon: UserPlus,        roles: HR_STAFF },
      { label: 'Probation',    href: '/dashboard/hr/probation',    icon: Hourglass,       roles: HR_STAFF },
      { label: 'People',       href: '/dashboard/hr/people',       icon: Users,           roles: HR_STAFF },
      { label: 'Leave',        href: '/dashboard/hr/leave',        icon: Luggage,         roles: HR_STAFF },
      { label: 'Letters',      href: '/dashboard/hr/letters',      icon: StickyNote,      roles: HR_STAFF },
      { label: 'Helpdesk',     href: '/dashboard/hr/helpdesk',     icon: LifeBuoy,        roles: HR_STAFF },
      { label: 'Calendar',     href: '/dashboard/hr/calendar',     icon: CalendarDays,    roles: HR_STAFF },
      // Discover (Layer 4)
      { label: 'Partnerships', href: '/dashboard/hr/partnerships', icon: Handshake,       roles: HR_STAFF },
      // Governance
      { label: 'Approvals',    href: '/dashboard/hr/approvals',    icon: Inbox,           roles: HR_STAFF },
      { label: 'Audit Log',    href: '/dashboard/hr/audit',        icon: ScrollText,      roles: HR_STAFF },
      { label: 'Integrations', href: '/dashboard/hr/integrations', icon: Plug,            roles: HR_STAFF },
      { label: 'Settings',     href: '/dashboard/hr/settings',     icon: Settings,        roles: HR_STAFF },
      // Employee "My Space" (self-service portal — employee role only)
      { label: 'Profile',      href: '/dashboard/hr/me',           icon: UserRound,             roles: ['employee'] },
      { label: 'My leave',     href: '/dashboard/hr/me/leave',     icon: Luggage,               roles: ['employee'] },
      { label: 'My payslips',  href: '/dashboard/hr/me/payslips',  icon: Receipt,               roles: ['employee'] },
      { label: 'My letters',   href: '/dashboard/hr/me/letters',   icon: MailOpen,              roles: ['employee'] },
      { label: 'Ask HR',       href: '/dashboard/hr/me/ask',       icon: MessageCircleQuestion, roles: ['employee'] },
    ],
  },
};

/** Nav items visible to a user, in order: platform → industry workspace → footer. */
export function navForUser(role: string, industry?: string | null): DashboardModule[] {
  const industryMods = industry && industryModules[industry] ? industryModules[industry].modules : [];
  return [...platformNav, ...industryMods, ...platformFooterNav].filter(
    (m) => !m.roles || m.roles.includes(role),
  );
}

/** Display label for a role, using the industry's labels if it defines them. */
export function roleLabel(role: string, industry?: string | null): string {
  const industryLabels =
    industry && industryModules[industry] ? industryModules[industry].roleLabels ?? {} : {};
  return { ...platformRoleLabels, ...industryLabels }[role] ?? role;
}
