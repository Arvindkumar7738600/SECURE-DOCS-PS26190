'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Building2,
  Clock3,
  FileText,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  PriorityBadge,
  PrimaryButton,
  SectionCard,
  SecondaryButton,
  StatCard,
  StatusBadge,
  Tabs,
  UserAvatar,
} from '@/components/enterprise-ui';

interface CaseDetail {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  caseType: string;
  status: string;
  priority: string;
  department: string;
  createdAt: string;
  updatedAt: string;
  creator: { fullName: string; email: string; department: string };
  members: Array<{
    id: string;
    role: string;
    user: { id: string; fullName: string; email: string; department: string };
  }>;
  documents: Array<{
    id: string;
    title: string;
    originalFilename: string;
    documentType: string;
    currentVersion: number;
    status: string;
    createdAt: string;
    mimeType: string;
  }>;
}

type CaseTab = 'overview' | 'documents' | 'members' | 'timeline' | 'security';

export default function CaseDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CaseTab>('overview');
  const [addMemberValue, setAddMemberValue] = useState('');
  const [memberRole, setMemberRole] = useState('INVESTIGATOR');
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const fetchCaseDetails = async () => {
    setLoading(true);
    setPageError(null);
    try {
      const res = await fetch(`/api/v1/cases/${caseId}`);
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load case');
      setCaseData(data.case);
    } catch (err: any) {
      setPageError(err.message || 'Failed to load case');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) fetchCaseDetails();
  }, [caseId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMemberValue.trim()) return;

    setMemberActionLoading(true);
    setBannerError(null);
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: addMemberValue.trim(), role: memberRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add member');

      setAddMemberValue('');
      await fetchCaseDetails();
    } catch (err: any) {
      setBannerError(err.message || 'Failed to add member');
    } finally {
      setMemberActionLoading(false);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!confirm('Remove this member from the case?')) return;
    setBannerError(null);
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/members/${targetUserId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove member');
      await fetchCaseDetails();
    } catch (err: any) {
      setBannerError(err.message || 'Failed to remove member');
    }
  };

  const handleArchiveCase = async () => {
    if (!confirm('Archive this case record?')) return;
    setArchiveLoading(true);
    setBannerError(null);
    try {
      const res = await fetch(`/api/v1/cases/${caseId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to archive case');
      router.push('/cases');
    } catch (err: any) {
      setBannerError(err.message || 'Failed to archive case');
    } finally {
      setArchiveLoading(false);
    }
  };

  const stats = useMemo(() => {
    return {
      members: caseData?.members.length || 0,
      documents: caseData?.documents.length || 0,
    };
  }, [caseData]);

  const tabItems: Array<{ key: CaseTab; label: string; count?: number }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'documents', label: 'Documents', count: caseData?.documents.length || 0 },
    { key: 'members', label: 'Members', count: caseData?.members.length || 0 },
    { key: 'timeline', label: 'Timeline' },
    { key: 'security', label: 'Security' },
  ];

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: 'Cases', href: '/cases' }, { label: 'Case Details' }]} title="Case Details" subtitle="Loading case workspace...">
        <LoadingSkeleton rows={5} />
      </AppShell>
    );
  }

  if (pageError || !caseData) {
    return (
      <AppShell breadcrumbs={[{ label: 'Cases', href: '/cases' }, { label: 'Case Details' }]} title="Case Details" subtitle="Case access state">
        <ErrorState
          title="Case access error"
          description={pageError || 'Case not found'}
          action={
            <Link href="/cases" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
              Return to Cases
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      breadcrumbs={[{ label: 'Cases', href: '/cases' }, { label: caseData.caseNumber }]}
      title={caseData.caseNumber}
      subtitle={caseData.title}
      actions={
        <>
          <Link
            href="/cases"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Cases
          </Link>
          <button
            type="button"
            onClick={handleArchiveCase}
            disabled={archiveLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Archive className="h-4 w-4" />
            {archiveLoading ? 'Archiving...' : 'Archive Case'}
          </button>
        </>
      }
    >
      <PageHeader
        eyebrow="Case Workspace"
        title={caseData.title}
        description={caseData.description}
      />

      {bannerError ? <ErrorState title="Action failed" description={bannerError} /> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard title="Status" value={caseData.status.replace(/_/g, ' ')} change="Current case state" icon={<ShieldCheck className="h-5 w-5" />} tone="blue" />
        <StatCard title="Priority" value={caseData.priority} change="Operational urgency" icon={<PriorityBadge priority={caseData.priority} />} tone={caseData.priority === 'CRITICAL' || caseData.priority === 'HIGH' ? 'rose' : 'amber'} />
        <StatCard title="Members" value={String(stats.members)} change="Assigned users" icon={<Users className="h-5 w-5" />} />
        <StatCard title="Documents" value={String(stats.documents)} change="Linked case documents" icon={<FileText className="h-5 w-5" />} tone="emerald" />
      </section>

      <div className="flex flex-col gap-5">
        <Tabs items={tabItems} active={activeTab} onChange={(value) => setActiveTab(value as CaseTab)} />

        {activeTab === 'overview' ? (
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <SectionCard title="Case Summary" description="Core case information and security context.">
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={caseData.status} />
                  <PriorityBadge priority={caseData.priority} />
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                    {caseData.caseType}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                    {caseData.department}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Case Number</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{caseData.caseNumber}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Case Type</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{caseData.caseType}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Created</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{new Date(caseData.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Last Updated</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{new Date(caseData.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </SectionCard>

            <div className="space-y-5">
              <SectionCard title="Case Owner" description="The creator is automatically assigned and tracked by the backend.">
                <div className="flex items-start gap-3">
                  <UserAvatar name={caseData.creator.fullName} email={caseData.creator.email} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{caseData.creator.fullName}</p>
                    <p className="text-sm text-slate-600">{caseData.creator.email}</p>
                    <p className="text-xs text-slate-500">{caseData.creator.department}</p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Security Context" description="This workspace only shows records you are authorized to access.">
                <div className="space-y-3 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>Access is enforced server-side by case membership and role.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-slate-500" />
                    <span>Case timestamps are sourced from the live database.</span>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        ) : null}

        {activeTab === 'documents' ? (
          <SectionCard
            title="Linked Documents"
            description="Documents associated with this case."
            actions={
              <Link
                href="/documents/upload"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Upload Document
              </Link>
            }
          >
            {caseData.documents.length === 0 ? (
              <EmptyState
                title="No documents yet"
                description="This case does not have any linked documents yet."
                action={
                  <Link
                    href="/documents/upload"
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Upload a document
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                }
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <DataTable
                    columns={[
                      { label: 'Document' },
                      { label: 'Type' },
                      { label: 'Version' },
                      { label: 'Status' },
                      { label: 'Uploaded' },
                      { label: 'Action' },
                    ]}
                  >
                    {caseData.documents.map((document) => (
                      <tr key={document.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">{document.title}</p>
                            <p className="text-xs text-slate-500">{document.originalFilename}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{document.documentType}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">v{document.currentVersion}</td>
                        <td className="px-4 py-4">
                          <StatusBadge status={document.status} />
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500">{new Date(document.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-4">
                          <Link href={`/documents/${document.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-900">
                            Open
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                </div>

                <div className="grid gap-4 md:hidden">
                  {caseData.documents.map((document) => (
                    <Link
                      key={document.id}
                      href={`/documents/${document.id}`}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{document.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{document.originalFilename}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <StatusBadge status={document.status} />
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                          {document.documentType}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </SectionCard>
        ) : null}

        {activeTab === 'members' ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
            <SectionCard title="Assigned Members" description="Users with explicit access to this case.">
              {caseData.members.length === 0 ? (
                <EmptyState title="No members assigned" description="Add the first member using the form on the right." />
              ) : (
                <div className="space-y-3">
                  {caseData.members.map((member) => (
                    <div key={member.id} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start gap-3">
                        <UserAvatar name={member.user.fullName} email={member.user.email} />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{member.user.fullName}</p>
                          <p className="text-sm text-slate-600">{member.user.email}</p>
                          <p className="text-xs text-slate-500">{member.user.department}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                          {member.role}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.user.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Add Member" description="Provide a user ID or email and assign a role.">
              <form onSubmit={handleAddMember} className="space-y-4">
                <label className="space-y-2 block">
                  <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">User ID / Email</span>
                  <input
                    type="text"
                    required
                    value={addMemberValue}
                    onChange={(event) => setAddMemberValue(event.target.value)}
                    placeholder="officer@example.gov"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                  />
                </label>
                <label className="space-y-2 block">
                  <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Role</span>
                  <select
                    value={memberRole}
                    onChange={(event) => setMemberRole(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  >
                    <option value="INVESTIGATOR">INVESTIGATOR</option>
                    <option value="OFFICER">OFFICER</option>
                    <option value="LEGAL">LEGAL</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <PrimaryButton type="submit" disabled={memberActionLoading}>
                    <UserPlus className="h-4 w-4" />
                    {memberActionLoading ? 'Adding...' : 'Add Member'}
                  </PrimaryButton>
                  <SecondaryButton type="button" onClick={() => setAddMemberValue('')}>
                    Clear
                  </SecondaryButton>
                </div>
              </form>
            </SectionCard>
          </div>
        ) : null}

        {activeTab === 'timeline' ? (
          <SectionCard title="Case Timeline" description="A factual lifecycle summary derived from the case record.">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Created</p>
                <p className="mt-1 font-medium text-slate-900">{new Date(caseData.createdAt).toLocaleString()}</p>
                <p className="mt-1 text-sm text-slate-600">Case entered into the secure repository.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Last Updated</p>
                <p className="mt-1 font-medium text-slate-900">{new Date(caseData.updatedAt).toLocaleString()}</p>
                <p className="mt-1 text-sm text-slate-600">Latest database write on the case record.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Current Scope</p>
                <p className="mt-1 font-medium text-slate-900">{caseData.members.length} members</p>
                <p className="mt-1 text-sm text-slate-600">{caseData.documents.length} linked documents in scope.</p>
              </div>
            </div>
          </SectionCard>
        ) : null}

        {activeTab === 'security' ? (
          <SectionCard title="Security Context" description="Authorization and access boundaries for this case.">
            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm text-slate-700">Access is restricted to authorized users, creators, and members.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  <p className="text-sm text-slate-700">Department: {caseData.department}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <p className="text-sm text-slate-700">Members are inherited from explicit case assignments.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Audit Note</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Detailed audit-log browsing is not exposed as a dedicated case-details API in the current backend, so we do not fabricate an activity feed here.
                </p>
              </div>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </AppShell>
  );
}
