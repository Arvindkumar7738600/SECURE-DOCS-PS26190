import { DocumentType } from '@prisma/client';

export interface ClassificationResult {
  classification: DocumentType;
  confidence: number;
  method: 'AI_OPENAI' | 'AI_HUGGINGFACE' | 'RULE_BASED';
  reason: string;
}
