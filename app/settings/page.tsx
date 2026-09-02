'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Brain,
  CheckCircle2,
  Database,
  FileText,
  Lock,
  Server,
  Shield,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  SectionCard,
} from '@/components/enterprise-ui';
import { cn } from '@/lib/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SystemConfig {
  system: {
    nodeEnv: string;
    isProduction: boolean;
    nextVersion: string;
  };
  authentication: {
    mfaCapable: boolean;
    jwtConfigured: boolean;
    authSecretConfigured: boolean;
    sessionType: string;
  };
  storage: {
    blobStorageConfigured: boolean;
    encryptionConfigured: boolean;
    encryptionAlgorithm: string;
    maxUploadSizeMb: number;
  };
  ai: {
    ocrEnabled: boolean;
    embeddingProvider: string;
    embeddingProviderConfigured: boolean;
    llmEnabled: boolean;
    llmConfigured: boolean;
  };
  database: {
    provider: string;
    extensions: string[];
    connectionConfigured: boolean;
    rbacEnabled: boolean;
    auditChainEnabled: boolean;
  };
  auditActions: string[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SettingRow({
  label,
  value,
  description,
  status,
}: {
  label: string;
  value: React.ReactNode;
  description?: string;
  status?: 'ok' | 'warn' | 'off';
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0 border-b border-slate-100 last:border-0">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          {status === 'ok' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
          {status === 'warn' && <XCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
          {status === 'off' && <XCircle className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
          <p className="text-sm font-medium text-slate-900">{label}</p>
        </div>
        {description && <p className="text-xs text-slate-500 pl-5">{description}</p>}
      </div>
      <div className="shrink-0 text-right">{value}</div>
    </div>
  );
}

function BoolBadge({ value, onLabel = 'Enabled', offLabel = 'Disabled' }: {
  value: boolean;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
        value
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-50 text-slate-500'
      )}
    >
      {value ? onLabel : offLabel}
    </span>
  );
}

function ValueChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-mono font-medium text-slate-700">
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
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

  // Fetch settings
  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/v1/admin/settings');
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Failed to load settings');
        }
        const data = await res.json();
        setConfig(data.config);
      } catch (err: any) {
        setError(err.message ?? 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin]);

  // ---------------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------------
  if (isAdmin === null) {
    return (
      <AppShell
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]}
        title="Settings"
      >
        <LoadingSkeleton rows={4} />
      </AppShell>
    );
  }

  if (isAdmin === false) {
    return (
      <AppShell
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]}
        title="Access Denied"
      >
        <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-200 bg-white">
            <Shield className="h-7 w-7 text-rose-500" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-slate-900">Access Denied</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-600">
            System settings are restricted to ADMIN users only.
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
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]}
      title="System Settings"
      subtitle="Read-only system configuration status."
    >
      <PageHeader
        eyebrow="Administration"
        title="System Settings"
        description="Live configuration status derived from environment variables and server state. Sensitive values are never exposed here."
      />

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorState title="Failed to load settings" description={error} />
      ) : config ? (
        <div className="grid gap-5 lg:grid-cols-2">

          {/* System */}
          <SectionCard
            title="System"
            description="Runtime environment and platform status."
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 mb-4">
              <Server className="h-5 w-5 text-slate-600" />
            </div>
            <SettingRow
              label="Environment"
              value={<ValueChip>{config.system.nodeEnv}</ValueChip>}
              description="Node.js process environment."
              status={config.system.isProduction ? 'ok' : 'warn'}
            />
            <SettingRow
              label="Production Mode"
              value={<BoolBadge value={config.system.isProduction} onLabel="Production" offLabel="Development" />}
              description="Whether the server is running in production mode."
              status={config.system.isProduction ? 'ok' : 'warn'}
            />
          </SectionCard>

          {/* Authentication */}
          <SectionCard
            title="Authentication & Security"
            description="Session management, JWT, and MFA configuration."
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 mb-4">
              <Lock className="h-5 w-5 text-slate-600" />
            </div>
            <SettingRow
              label="Session Type"
              value={<ValueChip>{config.authentication.sessionType}</ValueChip>}
              description="How user sessions are managed."
              status="ok"
            />
            <SettingRow
              label="JWT Secret"
              value={<BoolBadge value={config.authentication.jwtConfigured} />}
              description="JWT signing secret is configured in the environment."
              status={config.authentication.jwtConfigured ? 'ok' : 'warn'}
            />
            <SettingRow
              label="Auth Secret"
              value={<BoolBadge value={config.authentication.authSecretConfigured} />}
              description="AUTH_SECRET environment variable is set."
              status={config.authentication.authSecretConfigured ? 'ok' : 'warn'}
            />
            <SettingRow
              label="MFA Capable"
              value={<BoolBadge value={config.authentication.mfaCapable} />}
              description="TOTP multi-factor authentication schema and logic is implemented."
              status="ok"
            />
            <SettingRow
              label="RBAC"
              value={<BoolBadge value={config.database.rbacEnabled} />}
              description="Role-based access control is active on all API routes."
              status="ok"
            />
          </SectionCard>

          {/* Document Storage */}
          <SectionCard
            title="Document Storage"
            description="File storage, encryption, and size limits."
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 mb-4">
              <FileText className="h-5 w-5 text-slate-600" />
            </div>
            <SettingRow
              label="Blob Storage"
              value={<BoolBadge value={config.storage.blobStorageConfigured} onLabel="Configured" offLabel="Local / Mock" />}
              description="External blob storage token is configured (not local dev mock)."
              status={config.storage.blobStorageConfigured ? 'ok' : 'warn'}
            />
            <SettingRow
              label="Encryption Key"
              value={<BoolBadge value={config.storage.encryptionConfigured} />}
              description="Document encryption key is present in the environment."
              status={config.storage.encryptionConfigured ? 'ok' : 'warn'}
            />
            <SettingRow
              label="Encryption Algorithm"
              value={<ValueChip>{config.storage.encryptionAlgorithm}</ValueChip>}
              description="Symmetric encryption algorithm used for document storage."
              status="ok"
            />
            <SettingRow
              label="Max Upload Size"
              value={<ValueChip>{config.storage.maxUploadSizeMb} MB</ValueChip>}
              description="Maximum allowed file upload size per document."
              status="ok"
            />
          </SectionCard>

          {/* AI & OCR */}
          <SectionCard
            title="AI & OCR"
            description="Optical character recognition and embedding provider status."
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 mb-4">
              <Brain className="h-5 w-5 text-slate-600" />
            </div>
            <SettingRow
              label="OCR Processing"
              value={<BoolBadge value={config.ai.ocrEnabled} />}
              description="Tesseract OCR engine is enabled for document text extraction."
              status={config.ai.ocrEnabled ? 'ok' : 'off'}
            />
            <SettingRow
              label="Embedding Provider"
              value={<ValueChip>{config.ai.embeddingProvider}</ValueChip>}
              description="Vector embedding provider for semantic search."
              status={config.ai.embeddingProviderConfigured ? 'ok' : 'warn'}
            />
            <SettingRow
              label="Embedding API Key"
              value={<BoolBadge value={config.ai.embeddingProviderConfigured} />}
              description="The selected embedding provider API key is configured."
              status={config.ai.embeddingProviderConfigured ? 'ok' : 'warn'}
            />
            <SettingRow
              label="LLM Enabled"
              value={<BoolBadge value={config.ai.llmEnabled} />}
              description="Large language model integration is enabled."
              status={config.ai.llmEnabled ? 'ok' : 'off'}
            />
            <SettingRow
              label="LLM API Key"
              value={<BoolBadge value={config.ai.llmConfigured} />}
              description="LLM provider API key is configured."
              status={config.ai.llmConfigured ? 'ok' : 'off'}
            />
          </SectionCard>

          {/* Database */}
          <SectionCard
            title="Database"
            description="PostgreSQL connection, extensions, and audit chain."
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 mb-4">
              <Database className="h-5 w-5 text-slate-600" />
            </div>
            <SettingRow
              label="Provider"
              value={<ValueChip>{config.database.provider}</ValueChip>}
              description="Database engine."
              status="ok"
            />
            <SettingRow
              label="Connection"
              value={<BoolBadge value={config.database.connectionConfigured} />}
              description="DATABASE_URL is configured in the environment."
              status={config.database.connectionConfigured ? 'ok' : 'warn'}
            />
            <SettingRow
              label="Extensions"
              value={
                <div className="flex flex-wrap gap-1 justify-end">
                  {config.database.extensions.map((ext) => (
                    <ValueChip key={ext}>{ext}</ValueChip>
                  ))}
                </div>
              }
              description="PostgreSQL extensions enabled for this database."
              status="ok"
            />
            <SettingRow
              label="Audit Chain Integrity"
              value={<BoolBadge value={config.database.auditChainEnabled} />}
              description="SHA-256 hash-chained audit log entries are enabled."
              status="ok"
            />
          </SectionCard>

          {/* Audit Actions Reference */}
          <SectionCard
            title="Audit Action Types"
            description="All action types that can appear in the audit log."
            className="lg:col-span-2"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 mb-4">
              <ShieldCheck className="h-5 w-5 text-slate-600" />
            </div>
            <div className="flex flex-wrap gap-2">
              {config.auditActions.map((action) => (
                <span
                  key={action}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                >
                  {action.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </SectionCard>

        </div>
      ) : null}
    </AppShell>
  );
}
