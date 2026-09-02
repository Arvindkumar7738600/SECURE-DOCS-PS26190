import { rankCasesBySemanticRelevance, buildSearchSummary } from '../lib/search/search-service';
import { rankDocumentsBySemanticRelevance, generateEmbedding, EMBEDDING_DIMENSIONS } from '../lib/embeddings/semantic-search';

async function runPhase17SearchTests() {
  console.log('🧪 Running Phase 17 Global Search Tests...\n');

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
    test('Case search ranks the matching case highest', () => {
      const ranked = rankCasesBySemanticRelevance('cyber crime evidence seizure', [
        {
          id: 'case-1',
          caseNumber: 'CASE-001',
          title: 'Fraud Investigation',
          description: 'Financial fraud and accounting irregularities.',
          caseType: 'FINANCIAL_CRIME',
          status: 'OPEN',
          priority: 'HIGH',
          department: 'Economic Offences',
        },
        {
          id: 'case-2',
          caseNumber: 'CASE-002',
          title: 'Cyber Crime Evidence Review',
          description: 'Seizure memo and digital evidence collection for server compromise.',
          caseType: 'CYBER_CRIME',
          status: 'UNDER_INVESTIGATION',
          priority: 'CRITICAL',
          department: 'Cyber Cell',
        },
      ]);

      return ranked[0].caseRecord.id === 'case-2' && ranked[0].score >= ranked[1].score;
    }),

    test('Document search ranks the matching document highest', () => {
      const ranked = rankDocumentsBySemanticRelevance('witness statement section 161', [
        {
          id: 'doc-1',
          title: 'Forensic Report',
          originalFilename: 'report.pdf',
          summary: 'Lab analysis of seized media.',
          chunks: [{ content: 'Lab analysis of seized media.' }],
        },
        {
          id: 'doc-2',
          title: 'Witness Statement',
          originalFilename: 'statement.pdf',
          summary: 'Witness statement recorded under section 161.',
          chunks: [{ content: 'Witness statement recorded under section 161 with answers.' }],
        },
      ]);

      return ranked[0].document.id === 'doc-2' && ranked[0].matchedChunks >= 1;
    }),

    test('Search summary truncates long text safely', () => {
      const summary = buildSearchSummary('A'.repeat(500), 64);
      return summary.length <= 65 && summary.endsWith('…');
    }),

    test('Embedding helper still returns 384 dimensions for search pipeline', () => {
      return generateEmbedding('global search ranking helper').length === EMBEDDING_DIMENSIONS;
    }),
  ];

  for (const run of tests) {
    await run();
  }

  console.log(`\n📊 Phase 17 Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase17SearchTests().catch((e) => {
  console.error('❌ Phase 17 test failure:', e);
  process.exit(1);
});
