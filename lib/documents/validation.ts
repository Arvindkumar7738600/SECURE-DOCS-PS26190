import path from 'path';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.txt', '.docx'];

export function getMaxUploadSizeMb(): number {
  const envSize = process.env.MAX_UPLOAD_SIZE_MB || process.env.MAX_UPLOAD_SIZE;
  return envSize ? parseInt(envSize, 10) : 25;
}

export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed_document';
  // Strip directory paths & path traversal characters
  const basename = path.basename(filename);
  // Remove null bytes, control characters, and unsafe path chars
  return basename
    .replace(/[\0\x00-\x1F\x7F]/g, '')
    .replace(/\.\.+/g, '.')
    .replace(/[^a-zA-Z0-9_\-\.\s]/g, '_')
    .trim();
}

export function validateFileMetadata(
  filename: string,
  mimeType: string,
  sizeInBytes: number
): { valid: boolean; error?: string; errorCode?: number } {
  const sanitized = sanitizeFilename(filename);
  const ext = path.extname(sanitized).toLowerCase();

  // Extension Check
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file extension "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      errorCode: 422,
    };
  }

  // MIME Check
  if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    return {
      valid: false,
      error: `Unsupported MIME type "${mimeType}". Allowed: PDF, PNG, JPG, TIFF, TXT, DOCX`,
      errorCode: 422,
    };
  }

  // Size Check
  const maxMb = getMaxUploadSizeMb();
  const maxBytes = maxMb * 1024 * 1024;
  if (sizeInBytes > maxBytes) {
    return {
      valid: false,
      error: `File size (${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${maxMb} MB`,
      errorCode: 413,
    };
  }

  return { valid: true };
}

export function generateStorageKey(caseId: string, documentId: string, versionNumber: number = 1): string {
  return `cases/${caseId}/documents/${documentId}/versions/${versionNumber}/source`;
}
