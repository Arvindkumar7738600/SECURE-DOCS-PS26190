import { AIClassificationProvider } from './provider';
import { ClassificationResult } from './types';

export class ClassificationService {
  static async classifyDocument(text: string): Promise<ClassificationResult> {
    if (!text || text.trim().length === 0 || text === 'NO_TEXT_DETECTED') {
      return {
        classification: 'OTHER' as any,
        confidence: 0.0,
        method: 'RULE_BASED',
        reason: 'No extractable text content present in document for classification',
      };
    }

    return await AIClassificationProvider.classify(text);
  }
}
