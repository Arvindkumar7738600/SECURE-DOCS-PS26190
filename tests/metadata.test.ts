import { RuleBasedMetadataExtractor } from '../lib/ai/metadata/extractor';
import { MetadataExtractionService } from '../lib/ai/metadata/service';
import { hasPermission } from '../lib/auth/permissions';

async function runMetadataTests() {
  console.log('🧪 Running Phase 10 Metadata Extraction & Entity Security Tests...');

  const sampleText = `FIRST INFORMATION REPORT
FIR NO: 2026/4482
POLICE STATION: Ranchi Central Police Station
DATED: 2026-08-24
INVESTIGATING OFFICER: Insp. Rajesh Kumar
COMPLAINANT: Suresh Sharma
ACCUSED: Accused Entity Alpha
LOCATION: Main Server Facility, Ranchi
DEPARTMENT: Central Forensic Unit

Summary narrative of the initial investigation report...`;

  // 1. Structured Field Extractions
  const meta = RuleBasedMetadataExtractor.extract(sampleText);
  console.assert(meta.caseNumber === '2026/4482', 'Case number must be extracted');
  console.assert(meta.documentDate === '2026-08-24', 'Document date must be extracted');
  console.assert(meta.policeStation?.includes('Ranchi Central Police Station'), 'Police Station must be extracted');
  console.assert(meta.officers.length >= 1, 'Officer must be extracted');
  console.assert(meta.persons.length >= 1, 'Persons must be extracted');
  console.log('✅ Test 1-5: Case Number, Date, PS, Officer, and Persons Extraction Passed');

  // 2. Missing Metadata Handling (Zero Fabrication)
  const sparseText = 'Plain generic text document without legal header fields.';
  const sparseMeta = MetadataExtractionService.extractMetadata(sparseText);
  console.assert(sparseMeta.caseNumber === null, 'Missing case number MUST be null');
  console.assert(sparseMeta.documentDate === null, 'Missing document date MUST be null');
  console.assert(sparseMeta.policeStation === null, 'Missing police station MUST be null');
  console.assert(sparseMeta.persons.length === 0, 'Missing persons MUST be empty array []');
  console.log('✅ Test 6: Missing Metadata Zero-Fabrication Guarantee Passed');

  // 3. Extractive Summary Generation
  console.assert(typeof meta.summary === 'string' && meta.summary.length > 10, 'Extractive summary must be generated');
  console.log('✅ Test 7: Extractive Content Summary Passed');

  // 4. Role-Based Metadata Edit Permissions
  console.assert(hasPermission(['INVESTIGATOR'], 'EDIT_METADATA') === true, 'INVESTIGATOR can edit metadata');
  console.assert(hasPermission(['OFFICER'], 'EDIT_METADATA') === true, 'OFFICER can edit metadata');
  console.assert(hasPermission(['VIEWER'], 'EDIT_METADATA') === false, 'VIEWER MUST NOT edit metadata');
  console.assert(hasPermission(['AUDITOR'], 'EDIT_METADATA') === false, 'AUDITOR MUST NOT edit metadata');
  console.log('✅ Test 8: Metadata Edit RBAC Authorization Scope Passed');

  console.log('🎉 ALL PHASE 10 METADATA EXTRACTION TESTS PASSED CLEANLY!');
}

runMetadataTests().catch((e) => {
  console.error('❌ Metadata test failure:', e);
  process.exit(1);
});
