import { generateEmbedding, cosineSimilarity, rankDocumentsBySemanticRelevance, SemanticDocumentCandidate } from '@/lib/embeddings/semantic-search';

export interface SearchCaseCandidate {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  caseType: string;
  status: string;
  priority: string;
  department: string;
}

export interface RankedCase<T> {
  caseRecord: T;
  score: number;
}

function normalizeQuery(query: string): string {
  return query
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(query: string): string[] {
  return normalizeQuery(query).split(/\s+/).filter(Boolean);
}

function scoreLexicalHits(queryTokens: string[], haystack: string): number {
  const normalizedHaystack = normalizeQuery(haystack);
  if (!normalizedHaystack || queryTokens.length === 0) return 0;
  const matches = queryTokens.filter((token) => normalizedHaystack.includes(token)).length;
  return matches / queryTokens.length;
}

export function rankCasesBySemanticRelevance<T extends SearchCaseCandidate>(
  query: string,
  cases: T[]
): Array<RankedCase<T>> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return cases.map((caseRecord) => ({ caseRecord, score: 0 }));
  }

  const queryEmbedding = generateEmbedding(trimmedQuery);
  const queryTokens = tokenize(trimmedQuery);

  return cases
    .map((caseRecord) => {
      const combined = [
        caseRecord.caseNumber,
        caseRecord.title,
        caseRecord.description,
        caseRecord.department,
        caseRecord.caseType,
        caseRecord.status,
        caseRecord.priority,
      ].join(' ');

      const embeddingScore = cosineSimilarity(queryEmbedding, generateEmbedding(combined));
      const lexicalScore = scoreLexicalHits(queryTokens, combined);
      const score = Math.max(0, Math.min(1, (embeddingScore * 0.72) + (lexicalScore * 0.28)));

      return { caseRecord, score };
    })
    .sort((left, right) => right.score - left.score);
}

export function rankSearchDocuments<T extends SemanticDocumentCandidate>(
  query: string,
  documents: T[]
): Array<{ document: T; score: number; matchedChunks: number }> {
  return rankDocumentsBySemanticRelevance(query, documents);
}

export function buildSearchSummary(text: string, maxLength = 220): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLength) {
    return collapsed;
  }
  return `${collapsed.slice(0, maxLength).trimEnd()}…`;
}

