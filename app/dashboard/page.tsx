'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  FileText,
  FolderOpen,
  Plus,
  Search,
  ShieldCheck,
  UploadCloud,
  Activity,
  AlertTriangle,
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
  StatCard,
  StatusBadge,
} from '@/components/enterprise-ui';

interface CurrentUserResponse {
  user?: {
    fullName?: string;
    email?: string;
    roles?: string[];
  };
}

interface CaseItem {
  id: string;
  caseNumber: string;
  title: string;
  caseType: string;
  status: string;
  priority: string;
  department: string;
  createdAt: string;
  updatedAt?: string;
  creator?: { fullName: string };
  _count?: { members: number; documents: number };
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('Officer');
  const [roles, setRoles] = useState<string[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [meResponse, casesResponse] = await Promise.all([
          fetch('/api/v1/auth/me'),
          fetch('/api/v1/cases?limit=20&sortBy=updatedAt&sortOrder=desc'),
        ]);

        if (meResponse.status === 401 || casesResponse.status === 401) {
          router.replace('/login');
          return;
        }

        const meData = (await meResponse.json()) as CurrentUserResponse;
        const casesData = await casesResponse.json();

        if (!meResponse.ok) {
          throw new Error('Unable to load dashboard session');
        }
        if (!casesResponse.ok) {
          throw new Error(casesData.error || 'Unable to load dashboard data');
        }

        setUserName(meData.user?.fullName || meData.user?.email || 'Officer');
        setRoles(meData.user?.roles || []);
        setCases(casesData.cases || []);
      } catch (err: any) {
        setError(err.message || 'Unable to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const metrics = useMemo(() => {
    return {
      total: cases.length,
      active: cases.filter((item) => ['OPEN', 'UNDER_INVESTIGATION'].includes(item.status)).length,
      pending: cases.filter((item) => item.status === 'PENDING_REVIEW').length,
      high: cases.filter((item) => ['HIGH', 'CRITICAL'].includes(item.priority)).length,
    };
  }, [cases]);

  const recentActivity = useMemo(() => {
    return cases.slice(0, 4).map((item) => ({
      label: `${item.caseNumber} updated`,
      detail: `${item.title} · ${item.department}`,
      tone: ['HIGH', 'CRITICAL'].includes(item.priority) ? 'warning' : 'default',
    }));
  }, [cases]);

  const quickActions = [
    { href: '/cases/new', label: 'Create New Case', icon: Plus },
    { href: '/documents/upload', label: 'Upload Document', icon: UploadCloud },
    { href: '/cases', label: 'Search Cases', icon: Search },
    { href: '/search', label: 'Verify Document', icon: ShieldCheck },
  ];

  return (
    <AppShell
      breadcrumbs={[{ label: 'Dashboard' }]}
      title="Dashboard"
      subtitle="Command center for authorized case work."
    >
      <PageHeader
        eyebrow="Secure Operations"
        title={`Good morning, ${userName}`}
        description={`Here's an overview of your accessible case management activity. Your current roles: ${
          roles.length > 0 ? roles.join(', ') : 'Not loaded'
        }.`}
        actions={
          <Link
            href="/cases/new"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            New Case
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Cases"
          value={String(metrics.total)}
          change="Accessible to your session"
          icon={<FolderOpen className="h-5 w-5" />}
        />
        <StatCard
          title="Active Cases"
          value={String(metrics.active)}
          change="Open and under investigation"
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          title="Pending Review"
          value={String(metrics.pending)}
          change="Awaiting next action"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          title="High Priority"
          value={String(metrics.high)}
          change="Requires immediate attention"
          icon={<Activity className="h-5 w-5" />}
          tone="rose"
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Recent Cases"
          description="The latest accessible cases, ordered by update activity."
          actions={
            <Link href="/cases" className="text-sm font-medium text-slate-700 transition hover:text-slate-900">
              View all
            </Link>
          }
        >
          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : error ? (
            <ErrorState title="Unable to load dashboard" description={error} action={<button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white" onClick={() => window.location.reload()}>Retry</button>} />
          ) : cases.length === 0 ? (
            <EmptyState
              title="No cases available"
              description="There are no authorized cases in your current scope yet."
              action={
                <Link
                  href="/cases/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Create your first case
                  <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
          ) : (
            <>
              <div className="hidden md:block">
                <DataTable
                  columns={[
                    { label: 'Case ID' },
                    { label: 'Case Title' },
                    { label: 'Case Type' },
                    { label: 'Status' },
                    { label: 'Priority' },
                    { label: 'Assigned Team' },
                    { label: 'Last Updated' },
                    { label: 'Action' },
                  ]}
                >
                  {cases.slice(0, 6).map((item) => (
                    <tr
                      key={item.id}
                      className="cursor-pointer transition hover:bg-slate-50"
                      onClick={() => router.push(`/cases/${item.id}`)}
                    >
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">{item.caseNumber}</td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">{item.title}</p>
                          <p className="text-xs text-slate-500">{item.department}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.caseType}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-4">
                        <PriorityBadge priority={item.priority} />
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item._count?.members ?? 0} members</td>
                      <td className="px-4 py-4 text-sm text-slate-500">
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                          Open
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              </div>

              <div className="grid gap-3 md:hidden">
                {cases.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => router.push(`/cases/${item.id}`)}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          {item.caseNumber}
                        </p>
                        <h3 className="mt-1 text-base font-semibold text-slate-900">{item.title}</h3>
                        <p className="mt-1 text-sm text-slate-600">{item.caseType}</p>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusBadge status={item.status} />
                      <PriorityBadge priority={item.priority} />
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        <div className="space-y-5">
          <SectionCard
            title="Recent Activity"
            description="Recent case updates derived from the authenticated case set."
          >
            {loading ? (
              <LoadingSkeleton rows={3} compact />
            ) : recentActivity.length === 0 ? (
              <EmptyState title="No activity yet" description="Recent activity appears here once cases are updated." />
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="mt-0.5 rounded-xl border border-slate-200 bg-white p-2 text-slate-700">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Quick Actions" description="Shortcuts to the most common workflows.">
            <div className="grid gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium text-slate-900">{action.label}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
                  </Link>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
