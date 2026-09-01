import { storeEncryptedDocumentPlaintext, calculateDocumentSha256 } from '../lib/security/document-encryption';
import { prisma } from '../lib/db/prisma';

async function testUploadFlow() {
  console.log('Testing upload flow...');
  try {
    const rawKey = process.env.ENCRYPTION_KEY || process.env.DOCUMENT_ENCRYPTION_KEY;
    console.log('Encryption key present:', Boolean(rawKey));

    const testCase = await prisma.case.findFirst();
    console.log('First case found:', testCase?.id || 'No cases in DB');
  } catch (err: any) {
    console.error('Error during test:', err);
  }
}

testUploadFlow();
