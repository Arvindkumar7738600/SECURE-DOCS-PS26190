'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Download,
  FileText,
  FolderOpen,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  BadgeAlert,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  PrimaryButton,
  SearchInput,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/enterprise-ui';
import { buildSearchRequestUrl } from '@/lib/search/search-ui';

interface SearchDocumentResult {
  id: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  title: string;
  originalFilename: string;
  documentType: string;
  status: string;
  sha256: string;
  embeddingStatus: string;
  relevanceScore: number;
  matchedChunks: number;
  uploader: { fullName: string; email: string; department: string };
  summary: string | null;
  storageKey: string;
}

interface SearchResponse {
  query: string;
  scope: string;
  searchMode: string;
  cases: unknown[];
  documents: SearchDocumentResult[];
  counts: { cases: number; documents: number };
}

export default function DocumentsRepositoryPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [results, setResults] = useState<SearchDocumentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('globalSearchQuery');
    if (saved && !query) {
      setQuery(saved);
    }
  }, []);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      setTouched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setTouched(true);

    try {
      const params = new URLSearchParams();
      params.set('q', q);
      params.set('scope', 'documents');
      params.set('limit', '20');
      if (caseNumber.trim()) params.set('case_id', caseNumber.trim());
      if (documentType.trim()) params.set('document_type', documentType.trim());

      const res = await fetch(buildSearchRequestUrl({ filters: { query: q, scope: 'documents', limit: 20, caseId: caseNumber, documentType } }));
      if (res.status === 401) {
        router.replace('/login');
        return;
      }

      const data = (await res.json()) as SearchResponse;
      if (!res.ok) throw new Error((data as any).error || 'Failed to search documents');
      setResults(data.documents || []);
    } catch (err: any) {
      setError(err.message || 'Failed to search documents');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void runSearch();
    }, 250);

    return () => window.clearTimeout(handle);
  }, [query, caseNumber, documentType]);

  const stats = useMemo(() => {
    return {
      total: results.length,
      verified: results.filter((item) => item.status === 'COMPLETED' || item.status === 'VERIFIED').length,
      processing: results.filter((item) => item.status === 'PROCESSING' || item.status === 'QUEUED').length,
      review: results.filter((item) => ['FAILED', 'PENDING'].includes(item.status)).length,
    };
  }, [results]);

  return (
    <AppShell
      breadcrumbs={[{ label: 'Documents' }]}
      title="Document Repository"
      subtitle="Search within authorized records and open document workspaces."
      actions={
        <Link
          href="/documents/upload"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <UploadCloud className="h-4 w-4" />
          Upload Document
        </Link>
      }
    >
      <PageHeader
        eyebrow="Document Management"
        title="Document repository search"
        description="The backend currently exposes document search rather than a raw unfiltered repository list, so this page uses search-backed results to stay aligned with actual data."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard title="Results" value={String(stats.total)} change="Current search output" icon={<FolderOpen className="h-5 w-5" />} />
        <StatCard title="Verified" value={String(stats.verified)} change="Completed or verified" icon={<ShieldCheck className="h-5 w-5" />} tone="emerald" />
        <StatCard title="Processing" value={String(stats.processing)} change="Queued or running" icon={<Sparkles className="h-5 w-5" />} tone="blue" />
        <StatCard title="Review" value={String(stats.review)} change="Failed or pending" icon={<BadgeAlert className="h-5 w-5" />} tone="amber" />
      </section>

      <SectionCard title="Search Documents" description="Use semantic search with optional case and type filters.">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Describe the document, keywords, officer, or evidence text..."
            />
            <p className="text-xs text-slate-500">
              Search requires at least 2 characters because the backend enforces a minimum query length.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Case Number</span>
              <input
                value={caseNumber}
                onChange={(event) => setCaseNumber(event.target.value)}
                placeholder="Optional"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Document Type</span>
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              >
                <option value="">Any type</option>
                <option value="FIR">FIR</option>
                <option value="POLICE_REPORT">POLICE_REPORT</option>
                <option value="INVESTIGATION_REPORT">INVESTIGATION_REPORT</option>
                <option value="WITNESS_STATEMENT">WITNESS_STATEMENT</option>
                <option value="CHARGE_SHEET">CHARGE_SHEET</option>
                <option value="COURT_FILING">COURT_FILING</option>
                <option value="EVIDENCE_REPORT">EVIDENCE_REPORT</option>
                <option value="FORENSIC_REPORT">FORENSIC_REPORT</option>
                <option value="LEGAL_DOCUMENT">LEGAL_DOCUMENT</option>
                <option value="JUDGMENT">JUDGMENT</option>
                <option value="OTHER">OTHER</option>
              </select>
            </label>
          </div>
        </div>
      </SectionCard>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState
          title="Unable to search documents"
          description={error}
          action={
            <button
              type="button"
              onClick={runSearch}
              className="mt-1 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Retry
            </button>
          }
        />
      ) : !touched || query.trim().length < 2 ? (
        <EmptyState
          icon={<Search className="h-7 w-7" />}
          title="Search to populate results"
          description="Enter a query to search authorized documents. Search results will show integrity, status, and upload metadata."
          action={
            <Link
              href="/documents/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Upload a new document
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      ) : results.length === 0 ? (
        <EmptyState
          title="No documents found"
          description="No authorized documents matched your current search and filter set."
          action={
            <PrimaryButton
              type="button"
              onClick={() => {
                setQuery('');
                setCaseNumber('');
                setDocumentType('');
              }}
            >
              Clear filters
            </PrimaryButton>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(`/documents/${item.id}`)}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {item.originalFilename}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{item.caseNumber} · {item.caseTitle}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge status={item.status} />
                  <StatusBadge status={item.embeddingStatus} />
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>{Math.round(item.relevanceScore * 100)}% relevance</span>
                  <span>{item.documentType}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden md:block">
            <DataTable
              columns={[
                { label: 'Document Name' },
                { label: 'Case' },
                { label: 'Type' },
                { label: 'Uploaded By' },
                { label: 'Relevance' },
                { label: 'Integrity' },
                { label: 'Status' },
                { label: 'Action' },
              ]}
            >
              {results.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer transition hover:bg-slate-50"
                  onClick={() => router.push(`/documents/${item.id}`)}
                >
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.originalFilename}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">{item.caseNumber}</p>
                      <p className="text-xs text-slate-500">{item.caseTitle}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.documentType}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{item.uploader.fullName}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{Math.round(item.relevanceScore * 100)}%</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={item.sha256 ? 'Verified' : 'Pending'} />
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={item.status} />
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
