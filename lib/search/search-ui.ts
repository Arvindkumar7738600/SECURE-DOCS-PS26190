export type SearchScope = 'all' | 'cases' | 'documents';

export interface SearchFilters {
  query: string;
  scope: SearchScope;
  limit: number;
  caseId?: string;
  documentType?: string;
}

export interface SearchRequestConfig {
  filters: SearchFilters;
}

export const SEARCH_SCOPE_LABELS: Record<SearchScope, string> = {
  all: 'All Records',
  cases: 'Cases',
  documents: 'Documents',
};

export const SEARCH_LIMIT_OPTIONS = [5, 10, 20] as const;

export function canRunSearch(query: string): boolean {
  return query.trim().length >= 2;
}

export function buildSearchRequestUrl(config: SearchRequestConfig): string {
  const params = new URLSearchParams();
  const query = config.filters.query.trim();

  if (query) params.set('q', query);
  if (config.filters.scope && config.filters.scope !== 'all') params.set('scope', config.filters.scope);
  if (config.filters.caseId?.trim()) params.set('case_id', config.filters.caseId.trim());
  if (config.filters.documentType?.trim()) params.set('document_type', config.filters.documentType.trim());
  if (config.filters.limit) params.set('limit', String(config.filters.limit));

  const queryString = params.toString();
  return queryString ? `/api/v1/search?${queryString}` : '/api/v1/search';
}

export function formatSearchSubtitle(filters: SearchFilters): string {
  const scopeLabel = SEARCH_SCOPE_LABELS[filters.scope];
  const extras: string[] = [];

  if (filters.caseId?.trim()) {
    extras.push(`Case ${filters.caseId.trim()}`);
  }

  if (filters.documentType?.trim()) {
    extras.push(filters.documentType.trim());
  }

  return extras.length > 0 ? `${scopeLabel} • ${extras.join(' • ')}` : scopeLabel;
}

export function getSearchModeLabel(searchMode?: string | null): string {
  switch ((searchMode || '').toUpperCase()) {
    case 'HYBRID':
      return 'Hybrid Search';
    case 'SEMANTIC':
      return 'Semantic Search';
    case 'TEXT':
      return 'Text Search';
    default:
      return 'Search';
  }
}

