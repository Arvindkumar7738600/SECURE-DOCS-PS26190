'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  Filter,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
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
  SearchInput,
  SectionCard,
  StatCard,
  StatusBadge,
  Tabs,
} from '@/components/enterprise-ui';

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
  creator?: { fullName: string; email: string; department: string };
  _count?: { members: number; documents: number };
}

type CaseTab = 'all' | 'active' | 'pending' | 'closed' | 'high';

const TAB_CONFIG: Array<{ key: CaseTab; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending Review' },
  { key: 'closed', label: 'Closed' },
  { key: 'high', label: 'High Priority' },
];

export default function CasesListPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [tab, setTab] = useState<CaseTab>('all');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      params.set('sortBy', 'updatedAt');
      params.set('sortOrder', 'desc');

      const res = await fetch(`/api/v1/cases?${params.toString()}`);
      if (res.status === 401) {
        router.replace('/login');
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load cases');
      }

      setCases(data.cases || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const departments = useMemo(
    () => Array.from(new Set(cases.map((item) => item.department))).sort(),
    [cases]
  );

  const filteredCases = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return cases.filter((item) => {
      const active =
        tab === 'all' ||
        (tab === 'active' && ['OPEN', 'UNDER_INVESTIGATION'].includes(item.status)) ||
        (tab === 'pending' && item.status === 'PENDING_REVIEW') ||
        (tab === 'closed' && ['CLOSED', 'ARCHIVED'].includes(item.status)) ||
        (tab === 'high' && ['HIGH', 'CRITICAL'].includes(item.priority));

      const matchesSearch =
        !search ||
        [item.caseNumber, item.title, item.caseType, item.department, item.creator?.fullName || '']
          .join(' ')
          .toLowerCase()
          .includes(search);

      const matchesDepartment =
        !departmentFilter || item.department.toLowerCase() === departmentFilter.toLowerCase();

      return active && matchesSearch && matchesDepartment;
    });
  }, [cases, searchTerm, departmentFilter, tab]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, departmentFilter, tab]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  const pagedCases = filteredCases.slice((page - 1) * pageSize, page * pageSize);

  const metrics = useMemo(() => {
    return {
      total: cases.length,
      active: cases.filter((item) => ['OPEN', 'UNDER_INVESTIGATION'].includes(item.status)).length,
      pending: cases.filter((item) => item.status === 'PENDING_REVIEW').length,
      high: cases.filter((item) => ['HIGH', 'CRITICAL'].includes(item.priority)).length,
    };
  }, [cases]);

  return (
    <AppShell
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Cases' }]}
      title="Cases"
      subtitle="Manage and track all authorized cases."
      actions={
        <>
          <Link
            href="/cases/new"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            New Case
          </Link>
          <button
            type="button"
            onClick={fetchCases}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </>
      }
    >
      <PageHeader
        eyebrow="Case Management"
        title="Authorized case workspace"
        description="Search, filter, and open cases across your permitted caseload."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Cases"
          value={String(metrics.total)}
          change="All accessible records"
          icon={<FolderOpen className="h-5 w-5" />}
          tone="slate"
        />
        <StatCard
          title="Active Cases"
          value={String(metrics.active)}
          change="Open or under investigation"
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          title="Pending Review"
          value={String(metrics.pending)}
          change="Awaiting action"
          icon={<Filter className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          title="High Priority"
          value={String(metrics.high)}
          change="Critical attention required"
          icon={<Building2 className="h-5 w-5" />}
          tone="rose"
        />
      </section>

      <SectionCard
        title="Search and Filters"
        description="Filter locally across the accessible case set returned by the authenticated API."
      >
        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-4">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search case number, title, type, department, or creator..."
            />
            <Tabs items={TAB_CONFIG} active={tab} onChange={(value) => setTab(value as CaseTab)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Department</span>
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-400"
              >
                <option value="">All departments</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Scope</p>
              <p className="mt-1">Results are limited to cases visible under your current role and membership scope.</p>
            </div>
          </div>
        </div>
      </SectionCard>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorState
          title="Unable to load cases"
          description={error}
          action={
            <button
              type="button"
              onClick={fetchCases}
              className="mt-1 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Retry
            </button>
          }
        />
      ) : filteredCases.length === 0 ? (
        <EmptyState
          icon={<Search className="h-7 w-7" />}
          title="No cases found"
          description="No cases match your current filters. Clear the filters or create a new case."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <PrimaryButton
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setDepartmentFilter('');
                  setTab('all');
                }}
              >
                Clear filters
              </PrimaryButton>
              <Link
                href="/cases/new"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                New Case
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {pagedCases.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(`/cases/${item.id}`)}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {item.caseNumber}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{item.caseType} · {item.department}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge status={item.status} />
                  <PriorityBadge priority={item.priority} />
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>{item._count?.members ?? 0} members</span>
                  <span>{item._count?.documents ?? 0} documents</span>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden md:block">
            <DataTable
              columns={[
                { label: 'Case Number' },
                { label: 'Title' },
                { label: 'Type' },
                { label: 'Department' },
                { label: 'Status' },
                { label: 'Priority' },
                { label: 'Members' },
                { label: 'Documents' },
                { label: 'Updated' },
                { label: 'Action' },
              ]}
              footer={
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>
                    Showing {Math.min((page - 1) * pageSize + 1, filteredCases.length)}-
                    {Math.min(page * pageSize, filteredCases.length)} of {filteredCases.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page === 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={page === totalPages}
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              }
            >
              {pagedCases.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer transition hover:bg-slate-50"
                  onClick={() => router.push(`/cases/${item.id}`)}
                >
                  <td className="px-4 py-4 text-sm font-semibold text-slate-900">{item.caseNumber}</td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.creator?.fullName || 'Unassigned creator'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.caseType}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.department}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-4">
                    <PriorityBadge priority={item.priority} />
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item._count?.members ?? 0}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item._count?.documents ?? 0}</td>
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
        </>
      )}
    </AppShell>
  );
}
