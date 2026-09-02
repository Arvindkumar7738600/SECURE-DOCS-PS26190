import { createWorker } from 'tesseract.js';
import { OcrProcessingResult } from './types';
import path from 'path';
import os from 'os';

export async function extractTextFromImage(buffer: Buffer): Promise<OcrProcessingResult> {
  let worker: any = null;
  try {
    const cachePath = path.join(os.tmpdir(), 'tesseract-cache');

    // Tesseract worker initialize karein
    worker = await createWorker('eng', 1, {
      cachePath,
      logger: () => { },
    });

    // Image recognize karein (Ise ab pura time milega)
    const { data } = await worker.recognize(buffer);
    await worker.terminate();

    const recognizedText = data.text ? data.text.trim() : '';

    return {
      success: true,
      pages: [
        {
          pageNumber: 1,
          text: recognizedText.length > 0 ? recognizedText : 'No text found in image.',
          confidence: typeof data.confidence === 'number' ? Number(data.confidence.toFixed(2)) : 90,
          method: 'OCR',
        },
      ],
      totalPages: 1,
      method: 'OCR',
    };
  } catch (err: any) {
    if (worker) {
      await worker.terminate().catch(() => { });
    }
    console.error('OCR Extraction Error:', err);
    return {
      success: false,
      pages: [
        {
          pageNumber: 1,
          text: `OCR Error: ${err.message || 'Failed to extract text'}`,
          confidence: 0,
          method: 'OCR',
        },
      ],
      totalPages: 1,
      method: 'OCR',
    };
  }
}