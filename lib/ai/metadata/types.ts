export interface ExtractedMetadata {
  caseNumber: string | null;
  documentDate: string | null;
  policeStation: string | null;
  officers: string[];
  persons: string[];
  locations: string[];
  organizations: string[];
  importantEntities: string[];
  summary: string;
}
