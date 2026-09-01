import pdfParse from 'pdf-parse';
import { OcrProcessingResult, OcrPageResult } from './types';

export async function extractTextFromPdf(buffer: Buffer): Promise<OcrProcessingResult> {
  try {
    const data = await pdfParse(buffer);
    const rawText = data.text ? data.text.trim() : '';

    if (!rawText || rawText.length === 0) {
      return {
        success: true,
        pages: [
          {
            pageNumber: 1,
            text: 'NO_TEXT_DETECTED',
            confidence: null,
            method: 'TEXT_EXTRACTION',
          },
        ],
        totalPages: data.numpages || 1,
        method: 'TEXT_EXTRACTION',
      };
    }

    // Split text into page sections if markers exist, otherwise single page
    const pageTexts = rawText.split(/\n\s*\n\s*\n/).filter((t) => t.trim().length > 0);
    const pages: OcrPageResult[] = (pageTexts.length > 0 ? pageTexts : [rawText]).map((text, idx) => ({
      pageNumber: idx + 1,
      text: text.trim(),
      confidence: null, // pdf-parse does not provide OCR confidence
      method: 'TEXT_EXTRACTION',
    }));

    return {
      success: true,
      pages,
      totalPages: data.numpages || pages.length,
      method: 'TEXT_EXTRACTION',
    };
  } catch (error: any) {
    console.error('PDF text extraction error:', error.message);
    return {
      success: false,
      pages: [],
      totalPages: 0,
      method: 'TEXT_EXTRACTION',
      error: `PDF extraction failed: ${error.message}`,
    };
  }
}
