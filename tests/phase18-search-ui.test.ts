import {
  buildSearchRequestUrl,
  canRunSearch,
  formatSearchSubtitle,
  getSearchModeLabel,
  SEARCH_SCOPE_LABELS,
} from '../lib/search/search-ui';

async function runPhase18SearchUiTests() {
  console.log('🧪 Running Phase 18 Search UI Tests...\n');

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
    test('Search scope labels are stable and readable', () => {
      return SEARCH_SCOPE_LABELS.all === 'All Records'
        && SEARCH_SCOPE_LABELS.cases === 'Cases'
        && SEARCH_SCOPE_LABELS.documents === 'Documents';
    }),

    test('Search query guard blocks short inputs', () => {
      return !canRunSearch(' ') && !canRunSearch('a') && canRunSearch('ab');
    }),

    test('Search URL builder encodes all filters correctly', () => {
      const url = buildSearchRequestUrl({
        filters: {
          query: 'witness statement',
          scope: 'documents',
          limit: 20,
          caseId: 'case-123',
          documentType: 'WITNESS_STATEMENT',
        },
      });

      return (
        url === '/api/v1/search?q=witness+statement&scope=documents&case_id=case-123&document_type=WITNESS_STATEMENT&limit=20'
        || url === '/api/v1/search?q=witness%20statement&scope=documents&case_id=case-123&document_type=WITNESS_STATEMENT&limit=20'
      );
    }),

    test('Search subtitle summarizes active filters', () => {
      const subtitle = formatSearchSubtitle({
        query: 'fraud',
        scope: 'cases',
        limit: 10,
        caseId: 'CASE-9',
        documentType: 'FIR',
      });

      return subtitle.includes('Cases') && subtitle.includes('Case CASE-9') && subtitle.includes('FIR');
    }),

    test('Search mode labels remain aligned with API values', () => {
      return getSearchModeLabel('HYBRID') === 'Hybrid Search'
        && getSearchModeLabel('SEMANTIC') === 'Semantic Search'
        && getSearchModeLabel('TEXT') === 'Text Search'
        && getSearchModeLabel(undefined) === 'Search';
    }),
  ];

  for (const run of tests) {
    await run();
  }

  console.log(`\n📊 Phase 18 Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase18SearchUiTests().catch((e) => {
  console.error('❌ Phase 18 test failure:', e);
  process.exit(1);
});
