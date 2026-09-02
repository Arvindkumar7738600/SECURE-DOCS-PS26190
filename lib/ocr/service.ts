import { extractTextFromPdf } from './pdf';
import { extractTextFromImage } from './image';
import { OcrProcessingResult } from './types';

export function sanitizeUtf8(text: string): string {
  if (!text) return '';
  const clean = text
    .replace(/\0/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD]/g, '')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const nonAlphaNum = (clean.match(/[^a-zA-Z0-9\s.,?!'\":;\-()\/\$\%\&]/g) || []).length;
  if (clean.length > 20 && nonAlphaNum / clean.length > 0.20) {
    return 'No readable OCR text detected in image evidence.';
  }

  return clean;
}

export class OCRService {
  static async processDocument(buffer: Buffer, mimeType: string): Promise<OcrProcessingResult> {
    const normalizedMime = mimeType.toLowerCase();
    let result: OcrProcessingResult;

    // 1. Plain Text Files
    if (normalizedMime === 'text/plain') {
      const text = sanitizeUtf8(buffer.toString('utf-8'));
      result = {
        success: true,
        pages: [
          {
            pageNumber: 1,
            text: text.length > 0 ? text : 'NO_TEXT_DETECTED',
            confidence: 100,
            method: 'DIRECT_READ',
          },
        ],
        totalPages: 1,
        method: 'DIRECT_READ',
      };
    }
    // 2. PDF Documents
    else if (normalizedMime === 'application/pdf') {
      result = await extractTextFromPdf(buffer);
    }
    // 3. Image Files (PNG, JPG, TIFF, WEBP, etc.)
    else if (normalizedMime.startsWith('image/')) {
      result = await extractTextFromImage(buffer);
    } else {
      result = {
        success: false,
        pages: [],
        totalPages: 0,
        method: 'UNSUPPORTED',
        error: `Unsupported MIME type for OCR/text extraction: "${mimeType}"`,
      };
    }

    if (result.success && result.pages) {
      result.pages = result.pages.map((p) => ({
        ...p,
        text: sanitizeUtf8(p.text),
      }));
    }

    return result;
  }
}
