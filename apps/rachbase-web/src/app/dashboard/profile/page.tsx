'use client';

import { useState, useCallback } from 'react';
import {
  User, Mail, Phone, Shield, Building2,
  Save, KeyRound, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff,
  Globe, Briefcase, MapPin, CreditCard, Lock, ChevronRight, UserCheck,
} from 'lucide-react';
import { useAuth } from '@rach/ui/contexts/AuthContext';
import { users } from '@rach/ui/lib/api';
import { cn } from '@rach/ui/lib/utils';
import type { UserRole, BillingAddress } from '@rach/ui/lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  admin        : 'RachBase Admin',
  tenant_admin : 'Tenant Admin',
  tenant_user  : 'User',
  developer    : 'Developer',
};

const ROLE_STYLE: Record<UserRole, string> = {
  admin        : 'bg-gradient-to-r from-primary-blue to-primary-purple text-white',
  tenant_admin : 'bg-accent-sky/30 text-primary-blue',
  tenant_user  : 'bg-neutral-100 text-text-secondary',
  developer    : 'bg-amber-100 text-amber-700',
};

const INDUSTRIES = [
  'Technology & Software',
  'E-Commerce & Retail',
  'Healthcare & Life Sciences',
  'Financial Services & Fintech',
  'Media & Entertainment',
  'Education & EdTech',
  'Manufacturing & Industrial',
  'Real Estate & PropTech',
  'Logistics & Supply Chain',
  'Hospitality & Travel',
  'Professional Services',
  'Government & Public Sector',
  'Non-Profit & NGO',
  'Telecommunications',
  'Energy & Utilities',
  'Other',
];

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal',
  'Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu',
  'Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Notice({ type, msg }: { type: 'success' | 'error'; msg: string }) {
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-xl px-4 py-3 text-sm',
      type === 'success'
        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
        : 'bg-red-50 border border-red-200 text-red-600',
    )}>
      {type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
      {msg}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="border-b border-neutral-border px-6 py-4">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
    </div>
  );
}

function Field({
  label, required, hint, children,
}: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {hint && <span className="ml-1 font-normal text-text-muted">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-neutral-border bg-bg-secondary pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20';
const selectCls = 'w-full rounded-lg border border-neutral-border bg-bg-secondary pl-9 pr-4 py-2.5 text-sm text-text-primary focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20 appearance-none';
const SaveBtn = ({ saving, label }: { saving: boolean; label?: string }) => (
  <button
    type="submit"
    disabled={saving}
    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-blue to-primary-purple px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
  >
    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
    {label ?? 'Save Changes'}
  </button>
);

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, token, updateUser } = useAuth();

  // ── Personal info ─────────────────────────────────────────────────────────
  const [name,  setName]  = useState(user?.name         ?? '');
  const [phone, setPhone] = useState(user?.phone_number ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ── Password ──────────────────────────────────────────────────────────────
  const [curPwd,  setCurPwd]  = useState('');
  const [newPwd,  setNewPwd]  = useState('');
  const [confPwd, setConfPwd] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdNotice, setPwdNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ── Business info ─────────────────────────────────────────────────────────
  const [accountType, setAccountType] = useState<'individual' | 'business'>(
    user?.account_type ?? 'individual'
  );
  const [bizName,     setBizName]     = useState(user?.business_name     ?? '');
  const [bizWebsite,  setBizWebsite]  = useState(user?.business_website  ?? '');
  const [bizIndustry, setBizIndustry] = useState(user?.business_industry ?? '');
  const [gstin,       setGstin]       = useState(user?.gstin             ?? '');
  const [bizSaving, setBizSaving] = useState(false);
  const [bizNotice, setBizNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ── Billing address ───────────────────────────────────────────────────────
  const saved = user?.billing_address;
  const [addrLine1,   setAddrLine1]   = useState(saved?.line1   ?? '');
  const [addrLine2,   setAddrLine2]   = useState(saved?.line2   ?? '');
  const [addrCity,    setAddrCity]    = useState(saved?.city    ?? '');
  const [addrState,   setAddrState]   = useState(saved?.state   ?? '');
  const [addrPincode, setAddrPincode] = useState(saved?.pincode ?? '');
  const [addrCountry, setAddrCountry] = useState(saved?.country ?? 'India');
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrNotice, setAddrNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleProfileSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setProfileSaving(true);
    setProfileNotice(null);
    try {
      const res = await users.updateMe(token, { name: name.trim(), phone_number: phone.trim() });
      updateUser(res.user);
      setProfileNotice({ type: 'success', msg: 'Profile updated successfully.' });
    } catch (err) {
      setProfileNotice({ type: 'error', msg: (err as Error).message || 'Failed to update profile.' });
    } finally {
      setProfileSaving(false);
    }
  }, [token, name, phone, updateUser]);

  const handlePasswordSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdNotice(null);
    if (newPwd !== confPwd) { setPwdNotice({ type: 'error', msg: 'New passwords do not match.' }); return; }
    if (newPwd.length < 8)  { setPwdNotice({ type: 'error', msg: 'Password must be at least 8 characters.' }); return; }
    if (!token) return;
    setPwdSaving(true);
    try {
      await users.changePassword(token, { current_password: curPwd, new_password: newPwd });
      setPwdNotice({ type: 'success', msg: 'Password changed successfully.' });
      setCurPwd(''); setNewPwd(''); setConfPwd('');
    } catch (err) {
      setPwdNotice({ type: 'error', msg: (err as Error).message || 'Failed to change password.' });
    } finally {
      setPwdSaving(false);
    }
  }, [token, curPwd, newPwd, confPwd]);

  const handleBizSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setBizSaving(true);
    setBizNotice(null);
    try {
      const res = await users.updateMe(token, {
        account_type:      accountType,
        business_name:     accountType === 'business' ? bizName.trim() || null : null,
        business_website:  accountType === 'business' ? bizWebsite.trim() || null : null,
        business_industry: accountType === 'business' ? bizIndustry || null : null,
        gstin:             gstin.trim() || null,
      });
      updateUser(res.user);
      setBizNotice({ type: 'success', msg: 'Business information saved.' });
    } catch (err) {
      setBizNotice({ type: 'error', msg: (err as Error).message || 'Failed to save.' });
    } finally {
      setBizSaving(false);
    }
  }, [token, accountType, bizName, bizWebsite, bizIndustry, gstin, updateUser]);

  const handleAddrSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setAddrSaving(true);
    setAddrNotice(null);
    try {
      const billing_address: BillingAddress = {
        line1:   addrLine1.trim(),
        line2:   addrLine2.trim() || undefined,
        city:    addrCity.trim(),
        state:   addrState,
        pincode: addrPincode.trim(),
        country: addrCountry,
      };
      const res = await users.updateMe(token, { billing_address });
      updateUser(res.user);
      setAddrNotice({ type: 'success', msg: 'Billing address saved. It will be used to prefill checkout.' });
    } catch (err) {
      setAddrNotice({ type: 'error', msg: (err as Error).message || 'Failed to save address.' });
    } finally {
      setAddrSaving(false);
    }
  }, [token, addrLine1, addrLine2, addrCity, addrState, addrPincode, addrCountry, updateUser]);

  if (!user) return null;

  const role        = user.role as UserRole;
  const initials    = user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const isBiz       = accountType === 'business';
  const isTenantAdmin = role === 'tenant_admin';

  return (
    <div className="max-w-2xl space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold font-display text-text-primary">Profile</h2>
        <p className="mt-0.5 text-sm text-text-muted">Manage your account, business details, and billing preferences.</p>
      </div>

      {/* Avatar + identity card */}
      <div className="rounded-2xl border border-neutral-border bg-white p-6 flex items-center gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-blue to-primary-purple text-white text-xl font-bold select-none">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold text-text-primary truncate">{user.name}</p>
          <p className="text-sm text-text-muted truncate">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', ROLE_STYLE[role])}>
              <Shield size={10} /> {ROLE_LABELS[role] ?? role}
            </span>
            {user.tenant_name && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                <Building2 size={10} /> {user.tenant_name}
              </span>
            )}
            {user.account_type === 'business' && user.business_name && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                <Briefcase size={10} /> {user.business_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Personal Information ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-neutral-border bg-white overflow-hidden">
        <SectionHeader title="Personal Information" subtitle="Update your name and phone number." />
        <form onSubmit={handleProfileSave} className="p-6 space-y-4">
          {profileNotice && <Notice {...profileNotice} />}

          <Field label="Full Name" required>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className={inputCls} placeholder="Your full name" />
            </div>
          </Field>

          <Field label="Email" hint="cannot be changed">
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type="email" value={user.email} readOnly
                className="w-full rounded-lg border border-neutral-border bg-neutral-50 pl-9 pr-4 py-2.5 text-sm text-text-muted cursor-not-allowed" />
            </div>
          </Field>

          <Field label="Phone Number">
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className={inputCls} placeholder="+91 98765 43210" />
            </div>
          </Field>

          <div className="pt-1 flex justify-end">
            <SaveBtn saving={profileSaving} />
          </div>
        </form>
      </div>

      {/* ── Business / Billing / Payment — tenant admins only ────────────────── */}
      {isTenantAdmin && <>

      {/* ── Business Information ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-neutral-border bg-white overflow-hidden">
        <SectionHeader
          title="Business Information"
          subtitle="Tell us whether you're signing up as an individual or a business. This helps us tailor invoices and support."
        />
        <form onSubmit={handleBizSave} className="p-6 space-y-5">
          {bizNotice && <Notice {...bizNotice} />}

          {/* Account type toggle */}
          <div>
            <p className="text-xs font-medium text-text-secondary mb-2">Account Type</p>
            <div className="grid grid-cols-2 gap-3">
              {(['individual', 'business'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAccountType(type)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all',
                    accountType === type
                      ? 'border-primary-blue bg-accent-sky/10 text-primary-blue'
                      : 'border-neutral-border bg-bg-secondary text-text-secondary hover:border-primary-blue/40',
                  )}
                >
                  {type === 'individual'
                    ? <UserCheck size={16} className={accountType === type ? 'text-primary-blue' : 'text-text-muted'} />
                    : <Briefcase  size={16} className={accountType === type ? 'text-primary-blue' : 'text-text-muted'} />}
                  {type === 'individual' ? 'Individual' : 'Business'}
                  {accountType === type && (
                    <CheckCircle2 size={14} className="ml-auto text-primary-blue" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Business-only fields */}
          {isBiz && (
            <div className="space-y-4 rounded-xl border border-neutral-border/60 bg-bg-secondary/50 p-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Business Details</p>

              <Field label="Business / Company Name" required={isBiz}>
                <div className="relative">
                  <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input type="text" value={bizName} onChange={(e) => setBizName(e.target.value)}
                    required={isBiz} className={inputCls} placeholder="Acme Pvt. Ltd." />
                </div>
              </Field>

              <Field label="Website">
                <div className="relative">
                  <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input type="url" value={bizWebsite} onChange={(e) => setBizWebsite(e.target.value)}
                    className={inputCls} placeholder="https://yourcompany.com" />
                </div>
              </Field>

              <Field label="Industry" required={isBiz}>
                <div className="relative">
                  <Briefcase size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  <select value={bizIndustry} onChange={(e) => setBizIndustry(e.target.value)}
                    required={isBiz} className={selectCls}>
                    <option value="">Select your industry…</option>
                    {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                  </select>
                </div>
              </Field>
            </div>
          )}

          {/* GSTIN — visible for both individual (for sole proprietors) and business */}
          <Field label="GST Identification Number" hint="optional">
            <div className="relative">
              <Shield size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type="text" value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())}
                maxLength={15} className={inputCls} placeholder="22AAAAA0000A1Z5" />
            </div>
            <p className="mt-1 text-xs text-text-muted">
              GSTIN will appear on your tax invoices. Leave blank if not applicable.
            </p>
          </Field>

          <div className="pt-1 flex justify-end">
            <SaveBtn saving={bizSaving} label="Save Business Info" />
          </div>
        </form>
      </div>

      {/* ── Billing Address ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-neutral-border bg-white overflow-hidden">
        <SectionHeader
          title="Billing Address"
          subtitle="Saved here and automatically prefilled when you check out."
        />
        <form onSubmit={handleAddrSave} className="p-6 space-y-4">
          {addrNotice && <Notice {...addrNotice} />}

          <Field label="Address Line 1" required>
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type="text" value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)}
                required className={inputCls} placeholder="Street / building / floor" />
            </div>
          </Field>

          <Field label="Address Line 2" hint="optional">
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type="text" value={addrLine2} onChange={(e) => setAddrLine2(e.target.value)}
                className={inputCls} placeholder="Area / landmark" />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="City" required>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input type="text" value={addrCity} onChange={(e) => setAddrCity(e.target.value)}
                  required className={inputCls} placeholder="Mumbai" />
              </div>
            </Field>
            <Field label="PIN Code" required>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input type="text" value={addrPincode} onChange={(e) => setAddrPincode(e.target.value)}
                  required maxLength={10} className={inputCls} placeholder="400001" />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="State" required>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <select value={addrState} onChange={(e) => setAddrState(e.target.value)}
                  required className={selectCls}>
                  <option value="">Select state…</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </Field>
            <Field label="Country">
              <div className="relative">
                <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input type="text" value={addrCountry} onChange={(e) => setAddrCountry(e.target.value)}
                  className={inputCls} placeholder="India" />
              </div>
            </Field>
          </div>

          <div className="pt-1 flex justify-end">
            <SaveBtn saving={addrSaving} label="Save Address" />
          </div>
        </form>
      </div>

      {/* ── Payment Methods ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-neutral-border bg-white overflow-hidden">
        <SectionHeader
          title="Payment Methods"
          subtitle="Saved cards and UPI handles used for subscription billing."
        />
        <div className="p-6">
          <div className="rounded-xl border border-dashed border-neutral-border bg-bg-secondary/40 px-6 py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <CreditCard size={20} className="text-text-muted" />
            </div>
            <p className="text-sm font-medium text-text-secondary">No saved payment methods</p>
            <p className="mt-1 text-xs text-text-muted">
              Your payment method is managed securely by Razorpay.
              It will appear here after your first successful subscription payment.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs text-text-muted">
                <Lock size={10} /> Secured by Razorpay
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs text-text-muted">
                PCI DSS compliant
              </span>
            </div>
          </div>

          {/* Future: list saved methods */}
          <p className="mt-4 text-xs text-text-muted flex items-center gap-1">
            <ChevronRight size={12} className="text-primary-blue" />
            To update or remove a payment method, cancel your active subscription and resubscribe with the new method.
          </p>
        </div>
      </div>

      </>}

      {/* ── Change Password ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-neutral-border bg-white overflow-hidden">
        <SectionHeader title="Change Password" subtitle="Use a strong password of at least 8 characters." />
        <form onSubmit={handlePasswordSave} className="p-6 space-y-4">
          {pwdNotice && <Notice {...pwdNotice} />}

          <Field label="Current Password">
            <div className="relative">
              <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type={showCur ? 'text' : 'password'} value={curPwd}
                onChange={(e) => setCurPwd(e.target.value)} required
                className="w-full rounded-lg border border-neutral-border bg-bg-secondary pl-9 pr-10 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
                placeholder="Enter current password" />
              <button type="button" onClick={() => setShowCur((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                {showCur ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          <Field label="New Password">
            <div className="relative">
              <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type={showNew ? 'text' : 'password'} value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)} required minLength={8}
                className="w-full rounded-lg border border-neutral-border bg-bg-secondary pl-9 pr-10 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-blue focus:outline-none focus:ring-2 focus:ring-primary-blue/20"
                placeholder="At least 8 characters" />
              <button type="button" onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          <Field label="Confirm New Password">
            <div className="relative">
              <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type="password" value={confPwd}
                onChange={(e) => setConfPwd(e.target.value)} required
                className={cn(
                  'w-full rounded-lg border bg-bg-secondary pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2',
                  confPwd && confPwd !== newPwd
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                    : 'border-neutral-border focus:border-primary-blue focus:ring-primary-blue/20',
                )}
                placeholder="Repeat new password" />
            </div>
            {confPwd && confPwd !== newPwd && (
              <p className="mt-1 text-xs text-red-500">Passwords do not match.</p>
            )}
          </Field>

          <div className="pt-1 flex justify-end">
            <button
              type="submit"
              disabled={pwdSaving || (!!confPwd && confPwd !== newPwd)}
            >
              {pwdSaving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              Change Password
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
