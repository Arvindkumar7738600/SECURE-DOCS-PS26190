import { createWorker } from 'tesseract.js';
import { OcrProcessingResult } from './types';

export async function extractTextFromImage(buffer: Buffer): Promise<OcrProcessingResult> {
  let worker: any = null;
  try {
    worker = await createWorker('eng');
    const { data } = await worker.recognize(buffer);
    await worker.terminate();

    const recognizedText = data.text ? data.text.trim() : '';

    return {
      success: true,
      pages: [
        {
          pageNumber: 1,
          text: recognizedText.length > 0 ? recognizedText : 'NO_TEXT_DETECTED',
          confidence: typeof data.confidence === 'number' ? Number(data.confidence.toFixed(2)) : null,
          method: 'OCR',
        },
      ],
      totalPages: 1,
      method: 'OCR',
    };
  } catch (error: any) {
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {}
    }
    console.error('Tesseract OCR error:', error.message);
    return {
      success: false,
      pages: [],
      totalPages: 0,
      method: 'OCR',
      error: `Tesseract OCR failed: ${error.message}`,
    };
  }
}
