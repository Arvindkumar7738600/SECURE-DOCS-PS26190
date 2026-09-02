import { extractTextFromPdf } from './pdf';
import { extractTextFromImage } from './image';
import { OcrProcessingResult } from './types';

export class OCRService {
  static async processDocument(buffer: Buffer, mimeType: string): Promise<OcrProcessingResult> {
    const normalizedMime = mimeType.toLowerCase();

    // 1. Plain Text Files
    if (normalizedMime === 'text/plain') {
      const text = buffer.toString('utf-8').trim();
      return {
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
    if (normalizedMime === 'application/pdf') {
      return await extractTextFromPdf(buffer);
    }

    // 3. Image Files (PNG, JPG, TIFF)
    if (normalizedMime.startsWith('image/')) {
      return await extractTextFromImage(buffer);
    }

    return {
      success: false,
      pages: [],
      totalPages: 0,
      method: 'UNSUPPORTED',
      error: `Unsupported MIME type for OCR/text extraction: "${mimeType}"`,
    };
  }
}
