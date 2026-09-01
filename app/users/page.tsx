'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  Shield,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  StatusBadge,
  UserAvatar,
} from '@/components/enterprise-ui';
import { cn } from '@/lib/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  department: string;
  isActive: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  roles: string[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const CHANGEABLE_ROLES = ['VIEWER', 'INVESTIGATOR', 'OFFICER', 'LEGAL', 'AUDITOR'];

// ---------------------------------------------------------------------------
// Role badge colours
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    ADMIN: 'border-rose-200 bg-rose-50 text-rose-700',
    INVESTIGATOR: 'border-blue-200 bg-blue-50 text-blue-700',
    OFFICER: 'border-amber-200 bg-amber-50 text-amber-800',
    LEGAL: 'border-purple-200 bg-purple-50 text-purple-700',
    AUDITOR: 'border-teal-200 bg-teal-50 text-teal-700',
    VIEWER: 'border-slate-200 bg-slate-50 text-slate-700',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide',
        styles[role] ?? styles['VIEWER']
      )}
    >
      {role}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Confirmation Modal
// ---------------------------------------------------------------------------

function ConfirmModal({
  user,
  newRole,
  onConfirm,
  onCancel,
  loading,
}: {
  user: UserRow;
  newRole: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-900">Confirm Role Change</h2>
            <p className="mt-1 text-sm text-slate-600">
              You are about to change the role of{' '}
              <span className="font-semibold text-slate-900">{user.fullName}</span> (
              {user.email}) from{' '}
              <span className="font-semibold">{user.roles[0] ?? 'none'}</span> to{' '}
              <span className="font-semibold text-sky-600">{newRole}</span>.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              This action is irreversible without another role change and will be recorded in the
              audit log.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <SecondaryButton onClick={onCancel} disabled={loading}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={onConfirm} disabled={loading}>
            {loading ? 'Applying…' : 'Confirm Change'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const router = useRouter();

  // Auth guard
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Data
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Role change
  const [pendingChange, setPendingChange] = useState<{
    user: UserRow;
    newRole: string;
  } | null>(null);
  const [changing, setChanging] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ---------------------------------------------------------------------------
  // Check admin
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const check = async () => {
      const res = await fetch('/api/v1/auth/me');
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      const data = await res.json();
      const roles: string[] = data.user?.roles ?? [];
      setIsAdmin(roles.includes('ADMIN'));
    };
    check();
  }, [router]);

  // ---------------------------------------------------------------------------
  // Fetch users
  // ---------------------------------------------------------------------------
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('q', search);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('isActive', statusFilter === 'active' ? 'true' : 'false');

      const res = await fetch(`/api/v1/admin/users?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to load users');
      }
      const data = await res.json();
      setUsers(data.users ?? []);
      setPagination(data.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 1 });
    } catch (err: any) {
      setError(err.message ?? 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, fetchUsers]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ---------------------------------------------------------------------------
  // Role change confirm
  // ---------------------------------------------------------------------------
  const handleRoleChange = async () => {
    if (!pendingChange) return;
    setChanging(true);
    try {
      const res = await fetch(
        `/api/v1/admin/users/${pendingChange.user.id}/role`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toRole: pendingChange.newRole }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Role change failed');
      setToast({ type: 'success', message: data.message ?? 'Role updated.' });
      setPendingChange(null);
      fetchUsers();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message ?? 'Role change failed.' });
      setPendingChange(null);
    } finally {
      setChanging(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------------
  if (isAdmin === null) {
    return (
      <AppShell breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Users' }]} title="Users">
        <LoadingSkeleton rows={5} />
      </AppShell>
    );
  }

  if (isAdmin === false) {
    return (
      <AppShell breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Users' }]} title="Access Denied">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-200 bg-white">
            <Shield className="h-7 w-7 text-rose-500" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-slate-900">Access Denied</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-600">
            This page is restricted to ADMIN users only. You do not have permission to view user
            management.
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
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Users' }]}
      title="User Management"
      subtitle="Manage user accounts and roles."
    >
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg',
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          )}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-current opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Confirm modal */}
      {pendingChange && (
        <ConfirmModal
          user={pendingChange.user}
          newRole={pendingChange.newRole}
          onConfirm={handleRoleChange}
          onCancel={() => setPendingChange(null)}
          loading={changing}
        />
      )}

      <PageHeader
        eyebrow="Administration"
        title="User Management"
        description={`${pagination.total} registered user${pagination.total !== 1 ? 's' : ''}. Change roles for non-ADMIN accounts.`}
      />

      {/* Filters */}
      <SectionCard>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm min-w-[200px]">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, email, department…"
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-slate-400"
          >
            <option value="">All Roles</option>
            {['ADMIN', 'INVESTIGATOR', 'OFFICER', 'LEGAL', 'AUDITOR', 'VIEWER'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-slate-400"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <SecondaryButton
            onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); setPage(1); }}
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
          title="Failed to load users"
          description={error}
          action={
            <button
              onClick={fetchUsers}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Retry
            </button>
          }
        />
      ) : users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="No users match your current filters."
          icon={<Users className="h-7 w-7" />}
        />
      ) : (
        <div className="space-y-4">
          <DataTable
            columns={[
              { label: 'User' },
              { label: 'Department' },
              { label: 'Role' },
              { label: 'Status' },
              { label: 'MFA' },
              { label: 'Joined' },
              { label: 'Actions' },
            ]}
          >
            {users.map((u) => {
              const isAdminUser = u.roles.includes('ADMIN');
              return (
                <tr key={u.id} className="transition hover:bg-slate-50">
                  {/* User */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={u.fullName} email={u.email} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{u.fullName}</p>
                        <p className="truncate text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  {/* Department */}
                  <td className="px-4 py-3 text-sm text-slate-700">{u.department}</td>
                  {/* Roles */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => <RoleBadge key={r} role={r} />)}
                    </div>
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  {/* MFA */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
                        u.mfaEnabled
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      )}
                    >
                      {u.mfaEnabled ? 'Enabled' : 'Off'}
                    </span>
                  </td>
                  {/* Created */}
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    {isAdminUser ? (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Shield className="h-3.5 w-3.5" />
                        Protected
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <UserCog className="h-4 w-4 shrink-0 text-slate-400" />
                        <select
                          defaultValue={u.roles[0] ?? 'VIEWER'}
                          onChange={(e) => {
                            const newRole = e.target.value;
                            if (newRole !== u.roles[0]) {
                              setPendingChange({ user: u, newRole });
                            }
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm outline-none focus:border-slate-400"
                          title="Change role"
                        >
                          {CHANGEABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </DataTable>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} users
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
          )}
        </div>
      )}
    </AppShell>
  );
}
