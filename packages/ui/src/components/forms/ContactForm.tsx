"use client";

import { useState } from "react";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Select } from "../ui/Select";
import { AnimateIn } from "../ui/AnimateIn";
import { CheckCircle, Loader2 } from "lucide-react";

const subjectOptions = [
  { label: "General Inquiry", value: "general" },
  { label: "Pricing Question", value: "pricing" },
  { label: "Migration Help", value: "migration" },
  { label: "Custom Development", value: "custom-development" },
  { label: "Partnership", value: "partnership" },
];

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  subject?: string;
  message?: string;
}

export function ContactForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): FormErrors {
    const newErrors: FormErrors = {};

    if (!firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    if (!lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!subject) {
      newErrors.subject = "Please select a subject";
    }
    if (!message.trim()) {
      newErrors.message = "Message is required";
    }

    return newErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setServerError('');
    setLoading(true);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${firstName} ${lastName}`.trim(),
          email,
          company: company || undefined,
          goal: `[${subject}] ${message}`,
          source: 'contact',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to send message');
      setSubmitted(true);
    } catch (err) {
      setServerError((err as Error).message || 'Something went wrong. Please try again.');
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
          <h3 className="font-display text-2xl font-bold text-text-primary">
            Thank you!
          </h3>
          <p className="mt-2 max-w-md text-text-secondary">
            Your message has been received. We&apos;ll get back to you within 24
            hours.
          </p>
        </div>
      </AnimateIn>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {serverError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}
      {/* First Name / Last Name — 2-col grid */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Input
          label="First Name"
          placeholder="Jane"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          error={errors.firstName}
          required
        />
        <Input
          label="Last Name"
          placeholder="Doe"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          error={errors.lastName}
          required
        />
      </div>

      <Input
        label="Email"
        type="email"
        placeholder="jane@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        required
      />

      <Input
        label="Company"
        placeholder="Acme Inc. (optional)"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
      />

      <Select
        label="Subject"
        options={subjectOptions}
        placeholder="Select a subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        error={errors.subject}
        required
      />

      <Textarea
        label="Message"
        placeholder="Tell us about your project or question..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        error={errors.message}
        required
      />

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary-blue to-primary-purple px-6 py-3 text-base font-semibold text-white shadow-md transition-all duration-200 hover:opacity-90 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed sm:w-auto"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        {loading ? 'Sending…' : 'Send Message →'}
      </button>
    </form>
  );
}
