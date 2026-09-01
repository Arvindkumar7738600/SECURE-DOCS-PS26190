'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Briefcase,
  Database,
  Filter,
  FileText,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
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
  Tabs,
  SecondaryButton,
} from '@/components/enterprise-ui';
import {
  buildSearchRequestUrl,
  canRunSearch,
  formatSearchSubtitle,
  getSearchModeLabel,
  SEARCH_LIMIT_OPTIONS,
  SEARCH_SCOPE_LABELS,
  SearchFilters,
  SearchScope,
} from '@/lib/search/search-ui';

interface SearchCaseResult {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  caseType: string;
  status: string;
  priority: string;
  department: string;
  relevanceScore: number;
  creator: { fullName: string; email: string; department: string };
  documentCount: number;
  memberCount: number;
  summary: string;
}

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
  scope: SearchScope;
  searchMode: string;
  cases: SearchCaseResult[];
  documents: SearchDocumentResult[];
  counts: {
    cases: number;
    documents: number;
  };
}

const DEFAULT_FILTERS: SearchFilters = {
  query: '',
  scope: 'all',
  limit: 10,
  caseId: '',
  documentType: '',
};

function formatRelevance(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function highlightText(text: string, query: string) {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((term) => term.length > 1)
    .slice(0, 5);

  if (terms.length === 0) {
    return text;
  }

  const pattern = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
  const parts = text.split(pattern);

  return parts.map((part, index) =>
    terms.some((term) => term.toLowerCase() === part.toLowerCase()) ? (
      <mark key={`${part}-${index}`} className="rounded bg-amber-100 px-0.5 text-amber-950">
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    )
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
          <div className="h-4 w-32 rounded bg-slate-100" />
          <div className="mt-3 h-5 w-2/3 rounded bg-slate-100" />
          <div className="mt-2 h-4 w-full rounded bg-slate-100" />
          <div className="mt-2 h-4 w-5/6 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draftQuery, setDraftQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const subtitle = useMemo(() => formatSearchSubtitle(filters), [filters]);

  const runSearch = async (nextFilters: SearchFilters) => {
    if (!canRunSearch(nextFilters.query)) {
      setError('Search requires at least 2 characters.');
      setResults(null);
      setTouched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setTouched(true);

    try {
      const res = await fetch(buildSearchRequestUrl({ filters: nextFilters }));
      if (res.status === 401) {
        router.replace('/login');
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');

      setResults(data as SearchResponse);
      setFilters(nextFilters);
    } catch (err: any) {
      setError(err.message || 'Search failed');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlQuery = searchParams.get('q');
    const savedQuery = urlQuery || window.localStorage.getItem('globalSearchQuery');
    
    if (savedQuery && !draftQuery) {
      setDraftQuery(savedQuery);
      if (savedQuery.trim().length >= 2) {
        void runSearch({ ...DEFAULT_FILTERS, query: savedQuery });
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch({ ...filters, query: draftQuery });
  };

  const applyFilter = async (patch: Partial<SearchFilters>) => {
    const nextFilters = {
      ...filters,
      ...patch,
      query: patch.query !== undefined ? patch.query : draftQuery,
    };
    setDraftQuery(nextFilters.query);
    await runSearch(nextFilters);
  };

  const clearSearch = () => {
    setDraftQuery('');
    setFilters(DEFAULT_FILTERS);
    setResults(null);
    setError(null);
    setTouched(false);
  };

  useEffect(() => {
    document.title = 'AI Semantic Search | Secure Case Management';
  }, []);

  const caseResults = results?.cases || [];
  const documentResults = results?.documents || [];
  const hasResults = Boolean(results && (caseResults.length > 0 || documentResults.length > 0));
  const hasExecutedSearch = touched && Boolean(results || error);
  const tabItems = [
    { key: 'all', label: 'All' },
    { key: 'cases', label: 'Cases' },
    { key: 'documents', label: 'Documents' },
  ] as const;

  return (
    <AppShell
      breadcrumbs={[{ label: 'Intelligence' }, { label: 'AI Semantic Search' }]}
      title="AI Semantic Search"
      subtitle="Natural language search across authorized cases and documents."
      actions={
        <button
          type="button"
          onClick={clearSearch}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Clear Search
        </button>
      }
    >
      <PageHeader
        eyebrow="Intelligence"
        title="Semantic search across authorized records"
        description="Search cases and documents with server-side RBAC filtering, hybrid ranking, and relevance scoring from the live API."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard title="Search Mode" value={getSearchModeLabel(results?.searchMode || 'HYBRID')} change="Backend ranking strategy" icon={<Sparkles className="h-5 w-5" />} tone="blue" />
        <StatCard title="Case Matches" value={String(results?.counts.cases || 0)} change="Accessible case results" icon={<Briefcase className="h-5 w-5" />} />
        <StatCard title="Document Matches" value={String(results?.counts.documents || 0)} change="Accessible document results" icon={<FileText className="h-5 w-5" />} tone="emerald" />
        <StatCard title="Scope" value={SEARCH_SCOPE_LABELS[filters.scope]} change="Current filter context" icon={<Database className="h-5 w-5" />} tone="slate" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <SectionCard title="Search Controls" description="Query the live search API and adjust scope, document type, or case filters.">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[1fr_0.45fr]">
                <div className="space-y-4">
                  <label className="block space-y-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Search query</span>
                    <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                      <input
                        value={draftQuery}
                        onChange={(e) => setDraftQuery(e.target.value)}
                        placeholder="Describe what you are looking for..."
                        className="w-full rounded-xl border-0 bg-transparent px-2 py-2 text-base text-slate-900 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </label>

                  <Tabs items={tabItems as any} active={filters.scope} onChange={(value) => void applyFilter({ scope: value as SearchScope })} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <label className="space-y-2 block">
                    <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Result limit</span>
                    <select
                      value={filters.limit}
                      onChange={(e) => void applyFilter({ limit: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    >
                      {SEARCH_LIMIT_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {value} results
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 block">
                    <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Case ID</span>
                    <input
                      value={filters.caseId || ''}
                      onChange={(e) => setFilters((current) => ({ ...current, caseId: e.target.value }))}
                      onBlur={() => void applyFilter({ caseId: filters.caseId || '' })}
                      placeholder="Optional"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    />
                  </label>

                  <label className="space-y-2 block">
                    <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Document type</span>
                    <select
                      value={filters.documentType || ''}
                      onChange={(e) => void applyFilter({ documentType: e.target.value })}
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

                  <div className="flex items-end gap-2">
                    <PrimaryButton type="submit" className="w-full">
                      <Search className="h-4 w-4" />
                      Search
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={clearSearch}>
                      <RefreshCw className="h-4 w-4" />
                    </SecondaryButton>
                  </div>
                </div>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Search Results"
            description={subtitle}
            actions={
              results ? (
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={`${results.counts.cases} Cases`} />
                  <StatusBadge status={`${results.counts.documents} Documents`} />
                </div>
              ) : null
            }
          >
            {loading ? (
              <ResultSkeleton />
            ) : error ? (
              <ErrorState
                title="Search failed"
                description={error}
                action={
                  <PrimaryButton type="button" onClick={() => void runSearch({ ...filters, query: draftQuery })}>
                    Retry Search
                  </PrimaryButton>
                }
              />
            ) : !touched ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <Briefcase className="h-5 w-5 text-slate-700" />
                  <h3 className="mt-3 text-sm font-semibold text-slate-900">Case Search</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Find investigations by number, title, department, or narrative text.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <FileText className="h-5 w-5 text-slate-700" />
                  <h3 className="mt-3 text-sm font-semibold text-slate-900">Document Search</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Search titles, OCR text, metadata, and semantic chunks in the authorized repository.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <ShieldCheck className="h-5 w-5 text-slate-700" />
                  <h3 className="mt-3 text-sm font-semibold text-slate-900">RBAC Protected</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Results respect the same server-side authorization rules as the API.
                  </p>
                </div>
              </div>
            ) : hasResults ? (
              <div className="space-y-6">
                {caseResults.length > 0 && (
                  <SectionCard
                    title="Cases"
                    description="Ranked by semantic relevance and filtered by authorization."
                    className="border-slate-200 shadow-none"
                    actions={<StatusBadge status={`${caseResults.length} Found`} />}
                  >
                    <div className="hidden lg:block">
                      <DataTable
                        columns={[
                          { label: 'Case' },
                          { label: 'Title' },
                          { label: 'Department' },
                          { label: 'Priority' },
                          { label: 'Status' },
                          { label: 'Relevance' },
                          { label: 'Action' },
                        ]}
                      >
                        {caseResults.map((item) => (
                          <tr key={item.id} className="transition hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <div className="space-y-1">
                                <p className="font-medium text-slate-900">{highlightText(item.caseNumber, draftQuery)}</p>
                                <p className="text-xs text-slate-500">{item.caseType}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="space-y-1">
                                <p className="font-medium text-slate-900">{highlightText(item.title, draftQuery)}</p>
                                <p className="text-xs text-slate-500">{highlightText(item.summary, draftQuery)}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">{item.department}</td>
                            <td className="px-4 py-4"><PriorityBadge priority={item.priority} /></td>
                            <td className="px-4 py-4"><StatusBadge status={item.status} /></td>
                            <td className="px-4 py-4 text-sm text-slate-700">{formatRelevance(item.relevanceScore)}</td>
                            <td className="px-4 py-4">
                              <Link href={`/cases/${item.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-900">
                                Open
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </DataTable>
                    </div>

                    <div className="grid gap-4 lg:hidden">
                      {caseResults.map((item) => (
                        <Link
                          key={item.id}
                          href={`/cases/${item.id}`}
                          className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                                {highlightText(item.caseNumber, draftQuery)}
                              </p>
                              <h3 className="mt-1 text-base font-semibold text-slate-900">{highlightText(item.title, draftQuery)}</h3>
                            </div>
                            <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{highlightText(item.summary, draftQuery)}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <PriorityBadge priority={item.priority} />
                            <StatusBadge status={item.status} />
                            <StatusBadge status={`${formatRelevance(item.relevanceScore)} relevance`} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {documentResults.length > 0 && (
                  <SectionCard
                    title="Documents"
                    description="OCR, metadata, and semantic chunk matches from authorized content."
                    className="border-slate-200 shadow-none"
                    actions={<StatusBadge status={`${documentResults.length} Found`} />}
                  >
                    <div className="hidden lg:block">
                      <DataTable
                        columns={[
                          { label: 'Document' },
                          { label: 'Case' },
                          { label: 'Type' },
                          { label: 'Uploader' },
                          { label: 'Relevance' },
                          { label: 'Embedding' },
                          { label: 'Action' },
                        ]}
                      >
                        {documentResults.map((item) => (
                          <tr key={item.id} className="transition hover:bg-slate-50">
                            <td className="px-4 py-4">
                              <div className="space-y-1">
                                <p className="font-medium text-slate-900">{highlightText(item.title, draftQuery)}</p>
                                <p className="text-xs text-slate-500">{highlightText(item.originalFilename, draftQuery)}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="space-y-1">
                                <p className="font-medium text-slate-900">{highlightText(item.caseNumber, draftQuery)}</p>
                                <p className="text-xs text-slate-500">{highlightText(item.caseTitle, draftQuery)}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">{item.documentType}</td>
                            <td className="px-4 py-4 text-sm text-slate-700">{item.uploader.fullName}</td>
                            <td className="px-4 py-4 text-sm text-slate-700">{formatRelevance(item.relevanceScore)}</td>
                            <td className="px-4 py-4"><StatusBadge status={item.embeddingStatus} /></td>
                            <td className="px-4 py-4">
                              <Link href={`/documents/${item.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-900">
                                Open
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </DataTable>
                    </div>

                    <div className="grid gap-4 lg:hidden">
                      {documentResults.map((item) => (
                        <Link
                          key={item.id}
                          href={`/documents/${item.id}`}
                          className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{highlightText(item.originalFilename, draftQuery)}</p>
                              <h3 className="mt-1 text-base font-semibold text-slate-900">{highlightText(item.title, draftQuery)}</h3>
                            </div>
                            <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{highlightText(item.caseTitle, draftQuery)}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <StatusBadge status={item.embeddingStatus} />
                            <StatusBadge status={item.status} />
                            <StatusBadge status={`${formatRelevance(item.relevanceScore)} relevance`} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </SectionCard>
                )}
              </div>
            ) : hasExecutedSearch ? (
              <EmptyState
                title="No matches found"
                description="No accessible cases or documents matched the current query and filters."
                action={
                  <PrimaryButton type="button" onClick={clearSearch}>
                    Clear Filters
                  </PrimaryButton>
                }
              />
            ) : (
              <EmptyState
                title="Ready to search"
                description="Run a query to retrieve RBAC-filtered cases and documents. Semantic ranking surfaces the most relevant records first."
              />
            )}
          </SectionCard>
        </div>

        <aside className="space-y-5">
          <SectionCard title="Search Controls" description="Current query state and authorization scope.">
            <div className="space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Active Scope</p>
                <p className="mt-1 font-medium text-slate-900">{SEARCH_SCOPE_LABELS[filters.scope]}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Query</p>
                <p className="mt-1 break-words font-medium text-slate-900">{filters.query || 'Not entered yet'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Security</p>
                <p className="mt-1 text-slate-700">Results are always constrained by server-side authorization.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Search Tips" description="Best practices for higher quality results.">
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-slate-900" />
                Search by case number, filing title, OCR text, or metadata terms.
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-slate-900" />
                Use filters to scope results to cases, documents, or a document type.
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-slate-900" />
                Highlighting is applied to returned text only, never fabricated results.
              </li>
            </ul>
          </SectionCard>
        </aside>
      </div>
    </AppShell>
  );
}
