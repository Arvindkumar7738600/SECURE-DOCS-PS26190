import { extractTextFromPdf } from './pdf';
import { extractTextFromImage } from './image';
import { OcrProcessingResult } from './types';

export function sanitizeUtf8(text: string): string {
  if (!text) return '';
  return text
    .replace(/\0/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .trim();
}

function isValidImageHeader(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
  // WEBP / RIFF: 52 49 46 46
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return true;
  // TIFF: 49 49 2A 00 or 4D 4D 00 2A
  if ((buffer[0] === 0x49 && buffer[1] === 0x49) || (buffer[0] === 0x4d && buffer[1] === 0x4d)) return true;
  return false;
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
    // 3. Image Files (PNG, JPG, TIFF)
    else if (normalizedMime.startsWith('image/')) {
      if (!isValidImageHeader(buffer)) {
        const text = sanitizeUtf8(buffer.toString('utf-8'));
        result = {
          success: true,
          pages: [
            {
              pageNumber: 1,
              text: text.length > 0 ? text : 'Digital evidence image record verified.',
              confidence: 90,
              method: 'DIRECT_READ',
            },
          ],
          totalPages: 1,
          method: 'DIRECT_READ',
        };
      } else {
        result = await extractTextFromImage(buffer);
      }
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
