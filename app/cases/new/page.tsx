'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  ErrorState,
  PageHeader,
  PrimaryButton,
  SectionCard,
} from '@/components/enterprise-ui';

const DEFAULT_FORM = {
  caseNumber: '',
  title: '',
  description: '',
  caseType: 'FINANCIAL_CRIME',
  status: 'OPEN',
  priority: 'MEDIUM',
  department: 'Special Crime Branch',
};

type FormState = typeof DEFAULT_FORM;

export default function CreateCasePage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const validate = () => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (!formData.caseNumber.trim()) nextErrors.caseNumber = 'Case number is required.';
    if (!formData.title.trim()) nextErrors.title = 'Case title is required.';
    if (!formData.description.trim()) nextErrors.description = 'Description is required.';
    if (!formData.caseType.trim()) nextErrors.caseType = 'Case type is required.';
    if (!formData.department.trim()) nextErrors.department = 'Department is required.';

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setLoading(true);

    try {
      const res = await fetch('/api/v1/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.details) {
          const detailMsgs = Object.entries(data.details)
            .map(([field, msgs]: [string, any]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
            .join(' | ');
          throw new Error(`Validation Error: ${detailMsgs}`);
        }
        throw new Error(data.error || 'Failed to create case');
      }

      router.push(`/cases/${data.case.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create case');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={[{ label: 'Cases', href: '/cases' }, { label: 'New Case' }]}
      title="New Case"
      subtitle="Create a structured case record."
      actions={
        <Link
          href="/cases"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Cases
        </Link>
      }
    >
      <PageHeader
        eyebrow="Case Registration"
        title="Create a new digital case"
        description="Enter the core case record first. The creator is automatically assigned as a member by the backend."
      />

      {error ? (
        <ErrorState title="Case creation failed" description={error} />
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Case Information"
          description="The backend accepts only these core fields, so we keep the form aligned with the API schema."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                Case Number *
              </span>
              <input
                type="text"
                required
                value={formData.caseNumber}
                onChange={(event) => setFormData({ ...formData, caseNumber: event.target.value })}
                placeholder="CASE-2026-001"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                aria-invalid={Boolean(fieldErrors.caseNumber)}
              />
              {fieldErrors.caseNumber ? <p className="text-xs text-rose-600">{fieldErrors.caseNumber}</p> : null}
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                Case Type *
              </span>
              <input
                type="text"
                required
                value={formData.caseType}
                onChange={(event) => setFormData({ ...formData, caseType: event.target.value })}
                placeholder="FINANCIAL_CRIME"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                aria-invalid={Boolean(fieldErrors.caseType)}
              />
              {fieldErrors.caseType ? <p className="text-xs text-rose-600">{fieldErrors.caseType}</p> : null}
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                Case Title *
              </span>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                placeholder="Short, descriptive investigation title"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                aria-invalid={Boolean(fieldErrors.title)}
              />
              {fieldErrors.title ? <p className="text-xs text-rose-600">{fieldErrors.title}</p> : null}
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                Description *
              </span>
              <textarea
                rows={5}
                required
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                placeholder="Official case narrative, investigation summary, and scope notes."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                aria-invalid={Boolean(fieldErrors.description)}
              />
              {fieldErrors.description ? <p className="text-xs text-rose-600">{fieldErrors.description}</p> : null}
            </label>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Case Controls" description="These fields map directly to the case creation API.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Status</span>
                <select
                  value={formData.status}
                  onChange={(event) => setFormData({ ...formData, status: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="UNDER_INVESTIGATION">UNDER_INVESTIGATION</option>
                  <option value="PENDING_REVIEW">PENDING_REVIEW</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Priority</span>
                <select
                  value={formData.priority}
                  onChange={(event) => setFormData({ ...formData, priority: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                  Department *
                </span>
                <input
                  type="text"
                  required
                  value={formData.department}
                  onChange={(event) => setFormData({ ...formData, department: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                  aria-invalid={Boolean(fieldErrors.department)}
                />
                {fieldErrors.department ? <p className="text-xs text-rose-600">{fieldErrors.department}</p> : null}
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Operational Note" description="Team assignment is handled automatically after case creation.">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              The creator is added as an initial member by the backend. After creation, open the case workspace to add
              additional members and upload documents.
            </div>
          </SectionCard>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              href="/cases"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </Link>
            <PrimaryButton type="submit" disabled={loading}>
              <ShieldCheck className="h-4 w-4" />
              {loading ? 'Creating...' : 'Create Case'}
            </PrimaryButton>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
