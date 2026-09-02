import {
  EMBEDDING_DIMENSIONS,
  buildDocumentChunksFromPages,
  cosineSimilarity,
  generateEmbedding,
  getEmbeddingStatus,
  rankDocumentsBySemanticRelevance,
  splitTextIntoChunks,
  vectorToPgvectorLiteral,
} from '../lib/embeddings/semantic-search';

async function runPhase16EmbeddingsTests() {
  console.log('🧪 Running Phase 16 Embeddings & Semantic Search Tests...\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => boolean | Promise<boolean>) {
    return async () => {
      try {
        const result = await fn();
        if (result) {
          console.log(`✅ ${name}`);
          passed++;
        } else {
          console.log(`❌ ${name}`);
          failed++;
        }
      } catch (e) {
        console.log(`❌ ${name} - Error: ${e}`);
        failed++;
      }
    };
  }

  const tests = [
    test('generateEmbedding returns a 384-dimensional vector', () => {
      const embedding = generateEmbedding('FIRST INFORMATION REPORT from Ranchi police station');
      return embedding.length === EMBEDDING_DIMENSIONS;
    }),

    test('generateEmbedding normalizes non-empty text', () => {
      const embedding = generateEmbedding('Witness statement recorded under section 161');
      const magnitude = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));
      return magnitude > 0.95 && magnitude < 1.05;
    }),

    test('vectorToPgvectorLiteral formats a pgvector-safe literal', () => {
      const literal = vectorToPgvectorLiteral([0.1, -0.2, 0]);
      return literal === '[0.1,-0.2,0]';
    }),

    test('splitTextIntoChunks creates overlapping chunks for long content', () => {
      const text = Array.from({ length: 80 }, (_, index) => `Sentence ${index + 1} carries case details.`).join(' ');
      const chunks = splitTextIntoChunks(text, 220, 40);
      const sharedToken = chunks[0]?.split(/\s+/).slice(-3)[0];
      return chunks.length > 1 && Boolean(sharedToken) && chunks[1].includes(sharedToken);
    }),

    test('buildDocumentChunksFromPages preserves page numbers and chunk indexes', () => {
      const chunks = buildDocumentChunksFromPages([
        { pageNumber: 1, text: 'Page one text. '.repeat(30) },
        { pageNumber: 2, text: 'Page two text. '.repeat(30) },
      ]);

      return (
        chunks.length >= 2 &&
        chunks[0].pageNumber === 1 &&
        chunks[0].chunkIndex === 0 &&
        chunks.some((chunk) => chunk.pageNumber === 2)
      );
    }),

    test('cosineSimilarity returns 1 for identical vectors', () => {
      const vector = generateEmbedding('charge sheet forensic laboratory');
      return Math.abs(cosineSimilarity(vector, vector) - 1) < 0.0001;
    }),

    test('Semantic ranking prefers relevant witness document', () => {
      const ranked = rankDocumentsBySemanticRelevance('witness statement under section 161', [
        {
          id: 'doc-1',
          title: 'Unrelated Memorandum',
          originalFilename: 'memo.pdf',
          summary: 'General administrative note about logistics.',
          chunks: [{ content: 'General administrative note about logistics and scheduling.' }],
        },
        {
          id: 'doc-2',
          title: 'Witness Statement',
          originalFilename: 'witness_statement.pdf',
          summary: 'Witness statement recorded under section 161.',
          chunks: [{ content: 'Witness statement recorded under section 161 with detailed answers.' }],
        },
      ]);

      return ranked[0].document.id === 'doc-2' && ranked[0].score >= ranked[1].score;
    }),

    test('Embedding status reflects completed chunk indexing', () => {
      return (
        getEmbeddingStatus({ chunkCount: 4, documentStatus: 'COMPLETED' }) === 'COMPLETED' &&
        getEmbeddingStatus({ chunkCount: 0, documentStatus: 'PROCESSING' }) === 'PROCESSING' &&
        getEmbeddingStatus({ chunkCount: 0, documentStatus: 'QUEUED' }) === 'PENDING'
      );
    }),
  ];

  for (const run of tests) {
    await run();
  }

  console.log(`\n📊 Phase 16 Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase16EmbeddingsTests().catch((e) => {
  console.error('❌ Phase 16 test failure:', e);
  process.exit(1);
});
