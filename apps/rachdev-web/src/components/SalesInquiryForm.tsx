'use client';

import { useState } from 'react';
import type { ChangeEvent as Ev } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Input } from '@rach/ui/components/ui/Input';
import { Textarea } from '@rach/ui/components/ui/Textarea';
import { Select } from '@rach/ui/components/ui/Select';
import { Button } from '@rach/ui/components/ui/Button';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { leads } from '@rach/ui/lib/api';

const INDUSTRY = [
  { label: 'Healthcare', value: 'healthcare' },
  { label: 'Human Resources', value: 'hr' },
  { label: 'Other / not sure', value: 'other' },
];
const SCALE = [
  { label: '1–20', value: '1-20' },
  { label: '20–100', value: '20-100' },
  { label: '100–500', value: '100-500' },
  { label: '500+', value: '500+' },
];
const DEPLOYMENT = [
  { label: 'Your managed cloud', value: 'cloud' },
  { label: 'On-prem / our own cloud', value: 'onprem' },
  { label: 'Not sure yet', value: 'unsure' },
];
const TIMELINE = [
  { label: 'Just exploring', value: 'exploring' },
  { label: 'This quarter', value: 'quarter' },
  { label: 'As soon as possible', value: 'asap' },
];

const labelOf = (opts: { label: string; value: string }[], v: string) => opts.find((o) => o.value === v)?.label ?? v;

export function SalesInquiryForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [scale, setScale] = useState('');
  const [deployment, setDeployment] = useState('');
  const [timeline, setTimeline] = useState('');
  const [useCase, setUseCase] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (!lastName.trim()) e.lastName = 'Last name is required';
    if (!email.trim()) e.email = 'Work email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email';
    if (!company.trim()) e.company = 'Company is required';
    if (!useCase.trim()) e.useCase = 'Tell us a little about what you want to build';
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }
    setErrors({}); setServerError(''); setLoading(true);
    try {
      const goal = [
        `Use case: ${useCase.trim()}`,
        industry ? `Industry / workspace: ${labelOf(INDUSTRY, industry)}` : null,
        scale ? `Team size: ${labelOf(SCALE, scale)}` : null,
        deployment ? `Deployment: ${labelOf(DEPLOYMENT, deployment)}` : null,
        timeline ? `Timeline: ${labelOf(TIMELINE, timeline)}` : null,
        role.trim() ? `Role: ${role.trim()}` : null,
      ].filter(Boolean).join('\n');

      await leads.submit({
        name: `${firstName} ${lastName}`.trim(),
        email: email.trim(),
        company: company.trim(),
        source: 'contact',
        goal,
        meta: { subject: 'pricing', role: role.trim(), industry, scale, deployment, timeline, useCase: useCase.trim() },
      });
      setSubmitted(true);
    } catch (e) {
      setServerError((e as Error).message || 'Something went wrong. Please try again or email us.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <AnimateIn>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="font-display text-2xl font-bold text-ink">Thanks — we&apos;ll be in touch</h3>
          <p className="mt-2 max-w-md text-ink-2">
            We&apos;ve got your details. Our team will review your use case and come back with next steps
            and a tailored quote, usually within one business day.
          </p>
        </div>
      </AnimateIn>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {serverError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{serverError}</div>}

      <div className="grid gap-6 sm:grid-cols-2">
        <Input label="First name" placeholder="Jane" value={firstName} onChange={(e: Ev<HTMLInputElement>) => setFirstName(e.target.value)} error={errors.firstName} required />
        <Input label="Last name" placeholder="Doe" value={lastName} onChange={(e: Ev<HTMLInputElement>) => setLastName(e.target.value)} error={errors.lastName} required />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <Input label="Work email" type="email" placeholder="jane@company.com" value={email} onChange={(e: Ev<HTMLInputElement>) => setEmail(e.target.value)} error={errors.email} required />
        <Input label="Company / organisation" placeholder="Acme Inc." value={company} onChange={(e: Ev<HTMLInputElement>) => setCompany(e.target.value)} error={errors.company} required />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <Input label="Your role (optional)" placeholder="Head of Talent, CTO…" value={role} onChange={(e: Ev<HTMLInputElement>) => setRole(e.target.value)} />
        <Select label="Industry / workspace" options={INDUSTRY} placeholder="Select one" value={industry} onChange={(e: Ev<HTMLSelectElement>) => setIndustry(e.target.value)} />
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        <Select label="Team size" options={SCALE} placeholder="Select" value={scale} onChange={(e: Ev<HTMLSelectElement>) => setScale(e.target.value)} />
        <Select label="Deployment" options={DEPLOYMENT} placeholder="Select" value={deployment} onChange={(e: Ev<HTMLSelectElement>) => setDeployment(e.target.value)} />
        <Select label="Timeline" options={TIMELINE} placeholder="Select" value={timeline} onChange={(e: Ev<HTMLSelectElement>) => setTimeline(e.target.value)} />
      </div>
      <Textarea
        label="What do you want your agents to do?"
        placeholder="e.g. draft and screen job descriptions across our hiring pipeline; or turn OPD visit transcripts into signed clinical notes."
        rows={4}
        value={useCase}
        onChange={(e: Ev<HTMLTextAreaElement>) => setUseCase(e.target.value)}
        error={errors.useCase}
        required
      />
      <Button type="submit" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Sending…</> : 'Talk to us'}
      </Button>
    </form>
  );
}
