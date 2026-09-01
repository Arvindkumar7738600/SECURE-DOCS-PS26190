export const EMBEDDING_DIMENSIONS = 384;
export const DEFAULT_CHUNK_SIZE = 1200;
export const DEFAULT_CHUNK_OVERLAP = 180;

export interface EmbeddingPageInput {
  pageNumber: number;
  text: string;
}

export interface EmbeddingChunk {
  pageNumber: number;
  chunkIndex: number;
  content: string;
}

export interface SemanticDocumentCandidate {
  id: string;
  title: string;
  originalFilename: string;
  summary?: string | null;
  chunks?: Array<{ content: string }>;
}

export interface RankedDocument<T> {
  document: T;
  score: number;
  matchedChunks: number;
}

function normalizeInput(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  const normalized = normalizeInput(text);
  if (!normalized) return [];
  return normalized.split(/\s+/).filter(Boolean);
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function generateEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    return vector;
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const tokenHash = hashString(token);
    const index = tokenHash % EMBEDDING_DIMENSIONS;
    const sign = tokenHash & 1 ? 1 : -1;
    vector[index] += sign;

    if (i + 1 < tokens.length) {
      const bigram = `${token} ${tokens[i + 1]}`;
      const bigramHash = hashString(bigram);
      const bigramIndex = bigramHash % EMBEDDING_DIMENSIONS;
      const bigramSign = bigramHash & 1 ? 0.8 : -0.8;
      vector[bigramIndex] += bigramSign;
    }
  }

  return normalizeVector(vector);
}

export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return vector.map(() => 0);
  }

  return vector.map((value) => value / magnitude);
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const size = Math.min(left.length, right.length);
  if (size === 0) return 0;

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let i = 0; i < size; i += 1) {
    const leftValue = left[i] || 0;
    const rightValue = right[i] || 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function vectorToPgvectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => Number.isFinite(value) ? Number(value.toFixed(6)) : 0).join(',')}]`;
}

function appendChunk(
  chunks: EmbeddingChunk[],
  pageNumber: number,
  chunkIndex: number,
  content: string
) {
  const trimmed = content.trim();
  if (!trimmed) {
    return;
  }

  chunks.push({
    pageNumber,
    chunkIndex,
    content: trimmed,
  });
}

function splitLongSegment(segment: string, maxChars: number): string[] {
  const words = segment.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const pieces: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      pieces.push(current);
    }

    current = word.length > maxChars ? word.slice(0, maxChars) : word;
  }

  if (current) {
    pieces.push(current);
  }

  return pieces;
}

export function splitTextIntoChunks(
  text: string,
  maxChars: number = DEFAULT_CHUNK_SIZE,
  overlapChars: number = DEFAULT_CHUNK_OVERLAP
): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= maxChars) {
    return [normalized];
  }

  const segments = normalized
    .split(/(?<=[.!?])\s+/)
    .flatMap((segment) => (segment.length > maxChars ? splitLongSegment(segment, maxChars) : [segment]))
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const segment of segments) {
    if (!current) {
      current = segment;
      continue;
    }

    if ((current + ' ' + segment).length <= maxChars) {
      current = `${current} ${segment}`;
      continue;
    }

    chunks.push(current.trim());

    const overlap = overlapChars > 0 ? current.slice(Math.max(0, current.length - overlapChars)).trim() : '';
    current = overlap ? `${overlap} ${segment}`.trim() : segment;

    if (current.length > maxChars) {
      const longSegments = splitLongSegment(current, maxChars);
      if (longSegments.length > 1) {
        chunks.push(...longSegments.slice(0, -1));
        current = longSegments[longSegments.length - 1];
      }
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

export function buildDocumentChunksFromPages(pages: EmbeddingPageInput[]): EmbeddingChunk[] {
  const chunks: EmbeddingChunk[] = [];

  for (const page of pages) {
    const pageChunks = splitTextIntoChunks(page.text);
    pageChunks.forEach((content, index) => {
      appendChunk(chunks, page.pageNumber, index, content);
    });
  }

  return chunks;
}

export function scoreTextSimilarity(query: string, candidateText: string): number {
  return cosineSimilarity(generateEmbedding(query), generateEmbedding(candidateText));
}

export function rankDocumentsBySemanticRelevance<T extends SemanticDocumentCandidate>(
  query: string,
  documents: T[]
): Array<RankedDocument<T>> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return documents.map((document) => ({
      document,
      score: 0,
      matchedChunks: 0,
    }));
  }

  const queryEmbedding = generateEmbedding(trimmedQuery);
  const queryTokens = tokenize(trimmedQuery);

  return documents
    .map((document) => {
      const searchableFields = [document.title, document.originalFilename, document.summary || '']
        .filter(Boolean)
        .join(' ');

      const directScore = scoreTextSimilarity(trimmedQuery, searchableFields);
      let bestScore = directScore;
      let matchedChunks = 0;

      for (const chunk of document.chunks || []) {
        const chunkScore = cosineSimilarity(queryEmbedding, generateEmbedding(chunk.content));
        if (chunkScore > bestScore) {
          bestScore = chunkScore;
        }
        if (chunkScore >= 0.2) {
          matchedChunks += 1;
        }
      }

      const searchableLower = normalizeInput(searchableFields);
      const lexicalHits = queryTokens.filter((token) => searchableLower.includes(token)).length;
      const lexicalBonus = Math.min(0.18, lexicalHits * 0.04) + Math.min(0.08, matchedChunks * 0.015);
      const score = Math.max(0, Math.min(1, bestScore + lexicalBonus));

      return {
        document,
        score,
        matchedChunks,
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function getEmbeddingStatus(params: {
  chunkCount: number;
  documentStatus?: string | null;
  processingStatus?: string | null;
}): 'COMPLETED' | 'PROCESSING' | 'PENDING' {
  if (params.chunkCount > 0) {
    return 'COMPLETED';
  }

  if (params.documentStatus === 'PROCESSING' || params.processingStatus === 'PROCESSING') {
    return 'PROCESSING';
  }

  return 'PENDING';
}
