import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BadgeAlert,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  FolderOpen,
  Hash,
  Layers3,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  UserCircle2,
} from 'lucide-react';
import { cn } from '@/lib/ui';

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const content = item.href && !isLast ? (
          <Link href={item.href} className="transition hover:text-slate-800">
            {item.label}
          </Link>
        ) : (
          <span className={isLast ? 'text-slate-800' : ''}>{item.label}</span>
        );

        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
            {content}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-6">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          <div className="space-y-1">
            <h1 className="text-[30px] font-semibold tracking-tight text-slate-900 sm:text-[32px]">{title}</h1>
            {description ? <p className="max-w-3xl text-[14px] leading-6 text-slate-600">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]', className)}>
      {(title || description || actions) && (
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? <h2 className="text-[17px] font-semibold text-slate-900">{title}</h2> : null}
            {description ? <p className="text-sm text-slate-600">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function StatCard({
  title,
  value,
  change,
  icon,
  tone = 'slate',
}: {
  title: string;
  value: string;
  change?: string;
  icon: React.ReactNode;
  tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose';
}) {
  const tones: Record<typeof tone, string> = {
    slate: 'border-slate-200 bg-white',
    blue: 'border-blue-100 bg-blue-50/70',
    emerald: 'border-emerald-100 bg-emerald-50/70',
    amber: 'border-amber-100 bg-amber-50/70',
    rose: 'border-rose-100 bg-rose-50/70',
  };

  return (
    <div className={cn('rounded-2xl border p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]', tones[tone])}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">{title}</p>
          <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-900">{value}</div>
          {change ? <p className="mt-2 text-sm text-slate-600">{change}</p> : null}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-slate-700 shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const normalized = status.toUpperCase();
  const tone =
    normalized.includes('VERIFIED') || normalized.includes('COMPLETED') || normalized.includes('SIGNED') || normalized.includes('ACTIVE') || normalized.includes('OPEN') || normalized.includes('APPROVED')
      ? 'emerald'
      : normalized.includes('PROCESS') || normalized.includes('PENDING') || normalized.includes('REVIEW') || normalized.includes('QUEUE')
      ? 'amber'
      : normalized.includes('FAILED') || normalized.includes('INVALID') || normalized.includes('DENIED') || normalized.includes('ARCHIVED')
      ? 'rose'
      : 'slate';

  const styles: Record<typeof tone, string> = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
  };

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.01em]', styles[tone], className)}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const normalized = priority.toUpperCase();
  const styles =
    normalized === 'CRITICAL'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : normalized === 'HIGH'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : normalized === 'MEDIUM'
      ? 'border-blue-100 bg-blue-50 text-blue-700'
      : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.01em]', styles)}>
      {priority.replace(/_/g, ' ')}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-500 shadow-sm">
        {icon || <FolderOpen className="h-7 w-7" />}
      </div>
      <h3 className="mt-5 text-[17px] font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not complete this request.',
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-900">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
        <div className="space-y-2">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-rose-800">{description}</p>
          {action ? <div>{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function LoadingSkeleton({ rows = 5, compact = false }: { rows?: number; compact?: boolean }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'animate-pulse rounded-2xl border border-slate-200 bg-white p-4',
            compact && 'p-3'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-slate-100" />
              <div className="h-3 w-2/3 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DataTable({
  columns,
  children,
  footer,
}: {
  columns: Array<{ label: string; className?: string }>;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-left text-[13px]">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.label}
                  className={cn(
                    'px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500',
                    column.className
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
      {footer ? <div className="border-t border-slate-100 px-4 py-3">{footer}</div> : null}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search...',
  className,
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}) {
  return (
    <form
      className={cn('flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-900/5', className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <Search className="h-4 w-4 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn('w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400', inputClassName)}
      />
    </form>
  );
}

export function Tabs({
  items,
  active,
  onChange,
}: {
  items: Array<{ key: string; label: string; count?: number; disabled?: boolean }>;
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      {items.map((item) => {
        const activeItem = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            disabled={item.disabled}
            onClick={() => onChange(item.key)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15',
              activeItem
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              item.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-slate-600'
            )}
          >
            <span>{item.label}</span>
            {typeof item.count === 'number' ? (
              <span className={cn('ml-2 rounded-full px-2 py-0.5 text-[11px]', activeItem ? 'bg-white/15' : 'bg-slate-100')}>
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function UserAvatar({
  name,
  email,
}: {
  name: string;
  email?: string | null;
}) {
  const initials = (name || email || 'U')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-900 text-sm font-semibold text-white">
      {initials || <UserCircle2 className="h-5 w-5" />}
    </div>
  );
}

export function SecurityStatus({
  label = 'Protected Session',
  details,
}: {
  label?: string;
  details?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
      <ShieldCheck className="h-3.5 w-3.5" />
      <span>{label}</span>
      {details ? <span className="text-emerald-500">• {details}</span> : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    >
      {children}
    </button>
  );
}

export function GhostLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10',
        className
      )}
    >
      {children}
    </Link>
  );
}

export {
  ArrowRight,
  BadgeAlert,
  Briefcase,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Hash,
  Layers3,
  Lock,
  Search,
  Sparkles,
};
