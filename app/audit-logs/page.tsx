'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  Shield,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  SecondaryButton,
  SectionCard,
} from '@/components/enterprise-ui';
import { cn } from '@/lib/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLogRow {
  id: string;
  action: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, unknown>;
  userId: string | null;
  caseId: string | null;
  documentId: string | null;
  user: { fullName: string; email: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTION_COLOURS: Record<string, string> = {
  LOGIN: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  LOGOUT: 'border-slate-200 bg-slate-50 text-slate-600',
  FAILED_ACCESS: 'border-rose-200 bg-rose-50 text-rose-700',
  ADMIN_ACTION: 'border-purple-200 bg-purple-50 text-purple-700',
  CREATE_CASE: 'border-blue-200 bg-blue-50 text-blue-700',
  DELETE_CASE: 'border-rose-200 bg-rose-50 text-rose-700',
  UPLOAD_DOCUMENT: 'border-sky-200 bg-sky-50 text-sky-700',
  DOWNLOAD_DOCUMENT: 'border-sky-200 bg-sky-50 text-sky-700',
  PROCESS_DOCUMENT: 'border-amber-200 bg-amber-50 text-amber-800',
  SEARCH: 'border-slate-200 bg-slate-50 text-slate-600',
  MFA_ENABLED: 'border-teal-200 bg-teal-50 text-teal-700',
  MFA_FAILED: 'border-rose-200 bg-rose-50 text-rose-700',
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_COLOURS[action] ?? 'border-slate-200 bg-slate-50 text-slate-600';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide',
        style
      )}
    >
      {action.replace(/_/g, ' ')}
    </span>
  );
}

function truncate(str: string, n: number): string {
  return str.length > n ? `${str.substring(0, n)}…` : str;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AuditLogsPage() {
  const router = useRouter();

  // Auth guard
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Data
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [validActions, setValidActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  // ---------------------------------------------------------------------------
  // Check admin
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const check = async () => {
      const res = await fetch('/api/v1/auth/me');
      if (res.status === 401) { router.replace('/login'); return; }
      const data = await res.json();
      const roles: string[] = data.user?.roles ?? [];
      setIsAdmin(roles.includes('ADMIN'));
    };
    check();
  }, [router]);

  // ---------------------------------------------------------------------------
  // Fetch logs
  // ---------------------------------------------------------------------------
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('q', search);
      if (actionFilter) params.set('action', actionFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/v1/admin/audit-logs?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to load audit logs');
      }
      const data = await res.json();
      setLogs(data.logs ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 1 });
      if (data.validActions?.length) setValidActions(data.validActions);
    } catch (err: any) {
      setError(err.message ?? 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (isAdmin) fetchLogs();
  }, [isAdmin, fetchLogs]);

  // ---------------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------------
  if (isAdmin === null) {
    return (
      <AppShell
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Audit Logs' }]}
        title="Audit Logs"
      >
        <LoadingSkeleton rows={5} />
      </AppShell>
    );
  }

  if (isAdmin === false) {
    return (
      <AppShell
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Audit Logs' }]}
        title="Access Denied"
      >
        <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-200 bg-white">
            <Shield className="h-7 w-7 text-rose-500" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-slate-900">Access Denied</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-600">
            This page is restricted to ADMIN users only.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Return to Dashboard
          </button>
        </div>
      </AppShell>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <AppShell
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Audit Logs' }]}
      title="Audit Logs"
      subtitle="Tamper-evident, hash-chained audit trail."
    >
      <PageHeader
        eyebrow="Security & Compliance"
        title="Audit Logs"
        description={`Immutable, hash-chained record of all system events. ${pagination.total.toLocaleString()} entries total. Read-only.`}
      />

      {/* Filters */}
      <SectionCard>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm min-w-[200px]">
            <Fingerprint className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by user, IP address, user agent…"
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Action filter */}
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-slate-400"
          >
            <option value="">All Actions</option>
            {validActions.map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </select>

          {/* Date from */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-slate-400"
            />
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-slate-400"
            />
          </div>

          <SecondaryButton
            onClick={() => { setSearch(''); setActionFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
          >
            Clear
          </SecondaryButton>
        </div>
      </SectionCard>

      {/* Table */}
      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <ErrorState
          title="Failed to load audit logs"
          description={error}
          action={
            <button
              onClick={fetchLogs}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Retry
            </button>
          }
        />
      ) : logs.length === 0 ? (
        <EmptyState
          title="No audit logs found"
          description="No events match your current filters."
          icon={<Fingerprint className="h-7 w-7" />}
        />
      ) : (
        <div className="space-y-4">
          <DataTable
            columns={[
              { label: 'Timestamp' },
              { label: 'User' },
              { label: 'Action' },
              { label: 'Resource' },
              { label: 'IP Address' },
              { label: 'User Agent' },
            ]}
          >
            {logs.map((log) => (
              <tr key={log.id} className="group transition hover:bg-slate-50">
                {/* Timestamp */}
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                  <div className="space-y-0.5">
                    <p className="font-medium text-slate-700">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </p>
                    <p className="font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </p>
                  </div>
                </td>

                {/* User */}
                <td className="px-4 py-3">
                  {log.user ? (
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-slate-900">{log.user.fullName}</p>
                      <p className="text-xs text-slate-500">{log.user.email}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">System / Anonymous</span>
                  )}
                </td>

                {/* Action */}
                <td className="px-4 py-3">
                  <ActionBadge action={log.action} />
                </td>

                {/* Resource */}
                <td className="px-4 py-3">
                  <div className="space-y-0.5 text-xs text-slate-500">
                    {log.caseId && (
                      <p>
                        <span className="font-semibold text-slate-600">Case:</span>{' '}
                        {log.caseId.substring(0, 8)}…
                      </p>
                    )}
                    {log.documentId && (
                      <p>
                        <span className="font-semibold text-slate-600">Doc:</span>{' '}
                        {log.documentId.substring(0, 8)}…
                      </p>
                    )}
                    {!log.caseId && !log.documentId && (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </td>

                {/* IP */}
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{log.ipAddress}</td>

                {/* User Agent */}
                <td className="max-w-[160px] px-4 py-3 text-xs text-slate-500" title={log.userAgent}>
                  {truncate(log.userAgent, 40)}
                </td>
              </tr>
            ))}
          </DataTable>

          {/* Pagination */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total.toLocaleString()} entries
            </p>
            <div className="flex items-center gap-2">
              <SecondaryButton
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </SecondaryButton>
              <SecondaryButton
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </SecondaryButton>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
