'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertCircle,
  Bell,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  LogOut,
  Menu,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Shield,
  ShieldCheck,
  User2,
  FilePlus2,
  BriefcaseBusiness,
  Workflow,
  Fingerprint,
  FileText,
  Settings2,
  Users,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/ui';
import { Breadcrumbs, SecurityStatus, UserAvatar } from '@/components/enterprise-ui';

type NavItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  exact?: boolean;
  disabled?: boolean;
  tooltip?: string;
  adminOnly?: boolean;
};

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: BriefcaseBusiness, exact: true },
      { label: 'Cases', href: '/cases', icon: FileText },
      { label: 'New Case', href: '/cases/new', icon: FilePlus2 },
    ],
  },
  {
    label: 'Documents',
    items: [
      { label: 'Document Repository', href: '/documents', icon: FolderOpen, exact: true },
      { label: 'Upload Documents', href: '/documents/upload', icon: FilePlus2 },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'AI Semantic Search', href: '/search', icon: Search, exact: true },
      { label: 'AI Processing', disabled: true, icon: Workflow, tooltip: 'No processing queue page is exposed yet.' },
    ],
  },
  {
    label: 'Security',
    items: [
      { label: 'Document Integrity', disabled: true, icon: ShieldCheck, tooltip: 'Use a document detail page to verify integrity.' },
      { label: 'Audit Logs', href: '/audit-logs', icon: Fingerprint, adminOnly: true },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', href: '/users', icon: Users, adminOnly: true },
      { label: 'Settings', href: '/settings', icon: Settings2, adminOnly: true },
    ],
  },
];

function isActivePath(pathname: string, item: NavItem) {
  if (!item.href) return false;
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({
  children,
  breadcrumbs,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [user, setUser] = useState<{ name: string; email: string; roles: string[] } | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('shell.sidebarCollapsed');
    if (saved) {
      setCollapsed(saved === 'true');
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('shell.sidebarCollapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
    setProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch('/api/v1/auth/me');
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        if (!res.ok) {
          throw new Error('Unable to load current user');
        }

        const data = await res.json();
        setUser({
          name: data.user?.fullName || data.user?.email || 'Officer',
          email: data.user?.email || '',
          roles: data.user?.roles || [],
        });
      } catch {
        setUser({ name: 'Officer', email: '', roles: [] });
      } finally {
        setLoadingUser(false);
      }
    };

    loadUser();
  }, [router]);

  const topBreadcrumbs = useMemo(() => breadcrumbs || [{ label: 'Secure Case Management' }], [breadcrumbs]);

  const handleLogout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

  const handleGlobalSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchValue.trim();
    if (!query) return;
    window.localStorage.setItem('globalSearchQuery', query);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.04),_transparent_24%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] text-slate-900">
      <div className="flex h-full">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex h-full w-[280px] flex-col border-r border-slate-800 bg-slate-950 text-slate-100 shadow-2xl shadow-slate-950/50 transition-all duration-300 lg:static lg:translate-x-0',
            collapsed ? 'lg:w-[88px]' : 'lg:w-[280px]',
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-4">
            <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900">
                <Shield className="h-5 w-5 text-sky-400" />
              </div>
              {!collapsed && (
                <div className="space-y-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Solvexa</p>
                  <p className="text-sm font-semibold text-white">Secure Case Management</p>
                </div>
              )}
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCollapsed((current) => !current)}
                className="hidden rounded-xl border border-slate-800 p-2 text-slate-300 transition hover:bg-slate-900 hover:text-white lg:inline-flex"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl border border-slate-800 p-2 text-slate-300 transition hover:bg-slate-900 hover:text-white lg:hidden"
                aria-label="Close navigation drawer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            {NAV_SECTIONS.map((section) => {
              const visibleItems = section.items.filter(
                (item) => !item.adminOnly || (user?.roles ?? []).includes('ADMIN')
              );
              if (visibleItems.length === 0) return null;
              return (
              <div key={section.label} className="space-y-2">
                {!collapsed ? (
                  <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {section.label}
                  </p>
                ) : (
                  <div className="h-3" />
                )}
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const active = item.href ? isActivePath(pathname, item) : false;
                    const icon = <item.icon className="h-4 w-4" />;
                    const shared = cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200',
                      active
                        ? 'bg-sky-500/10 text-sky-400 font-medium shadow-[inset_0_0_0_1px_rgba(14,165,233,0.2)]'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100',
                      item.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-slate-400',
                      collapsed && 'justify-center px-2'
                    );

                    if (item.disabled || !item.href) {
                      return (
                        <div key={item.label} className={shared} title={item.tooltip || item.label}>
                          {active ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]" /> : null}
                          <span className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-xl border transition-colors duration-200",
                            active ? "border-sky-500/30 bg-sky-500/10 text-sky-400" : "border-slate-800 bg-slate-900 text-slate-400 group-hover:border-slate-700 group-hover:bg-slate-800 group-hover:text-slate-200"
                          )}>
                            {icon}
                          </span>
                          {!collapsed && (
                            <div className="min-w-0">
                              <p className="truncate font-medium">{item.label}</p>
                              <p className="truncate text-[11px] text-slate-500">{item.tooltip || 'Unavailable'}</p>
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={shared}
                        aria-current={active ? 'page' : undefined}
                        title={collapsed ? item.label : item.tooltip || item.label}
                      >
                        {active ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]" /> : null}
                        <span className={cn(
                          "inline-flex h-8 w-8 items-center justify-center rounded-xl border transition-colors duration-200",
                          active ? "border-sky-500/30 bg-sky-500/10 text-sky-400" : "border-slate-800 bg-slate-900 text-slate-400 group-hover:border-slate-700 group-hover:bg-slate-800 group-hover:text-slate-200"
                        )}>
                          {icon}
                        </span>
                        {!collapsed && <span className="font-medium">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>

          <div className="border-t border-slate-800 p-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
              {loadingUser ? (
                <div className="h-14 animate-pulse rounded-xl bg-slate-800/70" />
              ) : (
                <div ref={profileMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((current) => !current)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-left transition hover:bg-slate-900',
                      collapsed && 'justify-center'
                    )}
                    aria-haspopup="menu"
                    aria-expanded={profileMenuOpen}
                  >
                    <UserAvatar name={user?.name || 'Officer'} email={user?.email || undefined} />
                    {!collapsed && (
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{user?.name || 'Officer'}</p>
                        <p className="truncate text-xs text-slate-400">{user?.roles?.join(', ') || 'Authenticated user'}</p>
                      </div>
                    )}
                    {!collapsed ? <ChevronRight className="h-4 w-4 text-slate-500" /> : null}
                  </button>

                  {profileMenuOpen && !collapsed ? (
                    <div className="absolute bottom-[calc(100%+12px)] left-0 right-0 rounded-2xl border border-slate-800 bg-slate-950 p-3 shadow-2xl shadow-slate-950/30">
                      <div className="flex items-start gap-3">
                        <UserAvatar name={user?.name || 'Officer'} email={user?.email || undefined} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{user?.name || 'Officer'}</p>
                          <p className="truncate text-xs text-slate-400">{user?.email || 'No email available'}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {user?.roles?.slice(0, 3).map((role) => (
                              <span key={role} className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                                {role}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 border-t border-slate-800 pt-3">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 hover:text-white"
                        >
                          <LogOut className="h-4 w-4" />
                          Logout
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {!collapsed ? (
                    <div className="mt-3">
                      <SecurityStatus label="Protected" details="MFA Ready" />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </aside>

        {mobileOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation drawer"
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col h-full overflow-y-auto">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <button
                type="button"
                className="inline-flex rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation drawer"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1 space-y-1">
                <Breadcrumbs items={topBreadcrumbs} />
                <div className="flex flex-wrap items-center gap-2">
                  {title ? <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{title}</h1> : null}
                  {subtitle ? <span className="text-xs text-slate-500">{subtitle}</span> : null}
                </div>
              </div>

              <form onSubmit={handleGlobalSearch} className="hidden w-full max-w-md items-center gap-2 lg:flex">
                <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Global search"
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex rounded-2xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Search
                </button>
              </form>

              <div className="flex items-center gap-2">
                <SecurityStatus label="Session Active" details="RBAC enforced" />
                <button
                  type="button"
                  className="inline-flex rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                >
                  <UserAvatar name={user?.name || 'Officer'} email={user?.email || undefined} />
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm font-medium text-slate-900">{user?.name || 'Officer'}</span>
                    <span className="block text-xs text-slate-500">{user?.roles?.[0] || 'User'}</span>
                  </span>
                  <MoreVertical className="h-4 w-4 text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50"
                  aria-label="Logout"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
              {actions ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  {actions}
                </div>
              ) : null}
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
