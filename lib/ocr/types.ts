export interface OcrPageResult {
  pageNumber: number;
  text: string;
  confidence: number | null;
  method: 'TEXT_EXTRACTION' | 'OCR' | 'DIRECT_READ';
}

export interface OcrProcessingResult {
  success: boolean;
  pages: OcrPageResult[];
  totalPages: number;
  method: string;
  error?: string;
}
