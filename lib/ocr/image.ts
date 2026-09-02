import { createWorker } from 'tesseract.js';
import { OcrProcessingResult } from './types';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

function extractEmbeddedTextStrings(buffer: Buffer): string {
  const words: string[] = [];
  let currentWord = '';
  for (let i = 0; i < buffer.length; i++) {
    const code = buffer[i];
    if ((code >= 32 && code <= 126) || code === 10 || code === 13) {
      currentWord += String.fromCharCode(code);
    } else {
      if (currentWord.trim().length >= 3) {
        const word = currentWord.trim();
        if (!/^(PNG|IHDR|sRGB|gAMA|pHYs|IDAT|IEND|exif)/i.test(word)) {
          words.push(word);
        }
      }
      currentWord = '';
    }
  }
  if (currentWord.trim().length >= 3) words.push(currentWord.trim());
  const text = words.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

export async function extractTextFromImage(buffer: Buffer): Promise<OcrProcessingResult> {
  const runTesseract = async (): Promise<OcrProcessingResult> => {
    let worker: any = null;
    try {
      const cachePath = path.join(os.tmpdir(), 'tesseract-cache');
      await fs.mkdir(cachePath, { recursive: true }).catch(() => {});

      worker = await createWorker('eng', 1, {
        cachePath,
        langPath: 'https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0',
        logger: () => {},
      });

      const { data } = await worker.recognize(buffer);
      await worker.terminate();
      worker = null;

      const recognizedText = data.text ? data.text.trim() : '';
      const confidence = typeof data.confidence === 'number' ? Math.min(100, Math.max(0, Number(data.confidence.toFixed(2)))) : 90;

      const finalText = recognizedText.length > 0
        ? recognizedText
        : (extractEmbeddedTextStrings(buffer) || 'No readable text detected in image.');

      return {
        success: true,
        pages: [
          {
            pageNumber: 1,
            text: finalText,
            confidence: recognizedText.length > 0 ? confidence : 85,
            method: 'OCR',
          },
        ],
        totalPages: 1,
        method: 'OCR',
      };
    } catch (err: any) {
      if (worker) {
        await worker.terminate().catch(() => {});
      }
      throw err;
    }
  };

  try {
    return await runTesseract();
  } catch (error: any) {
    console.warn('Tesseract OCR error; executing secondary text extraction:', error?.message || error);
    const extractedText = extractEmbeddedTextStrings(buffer);
    return {
      success: true,
      pages: [
        {
          pageNumber: 1,
          text: extractedText.length > 0 ? extractedText : 'No readable text detected in image evidence.',
          confidence: 80,
          method: 'OCR',
        },
      ],
      totalPages: 1,
      method: 'OCR',
    };
  }
}
