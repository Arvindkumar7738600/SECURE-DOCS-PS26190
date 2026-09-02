import { ExtractedMetadata } from './types';

export class RuleBasedMetadataExtractor {
  static extract(text: string): ExtractedMetadata {
    if (!text || text.trim().length === 0 || text === 'NO_TEXT_DETECTED') {
      return {
        caseNumber: null,
        documentDate: null,
        policeStation: null,
        officers: [],
        persons: [],
        locations: [],
        organizations: [],
        importantEntities: [],
        summary: 'No document text content available for metadata extraction.',
      };
    }

    // 1. Extract Case Number
    let caseNumber: string | null = null;
    const caseMatch = text.match(/(?:CASE|FIR|CRIME)[-\s_]*NO[S]?[\.:\s_-]*([A-Z0-9\/-]+)/i);
    if (caseMatch && caseMatch[1]) {
      caseNumber = caseMatch[1].trim();
    }

    // 2. Extract Document Date
    let documentDate: string | null = null;
    const dateMatch = text.match(/(?:DATED|DATE|TIME)[\.:\s_-]*([0-9]{2,4}[-\/\.][0-9]{1,2}[-\/\.][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i);
    if (dateMatch && dateMatch[1]) {
      documentDate = dateMatch[1].trim();
    }

    // 3. Extract Police Station
    let policeStation: string | null = null;
    const psMatch = text.match(/(?:POLICE STATION|P\.S\.)[\.:\s_-]*([A-Za-z0-9\s]+?)(?:,|\.|\n|DISTRICT|SECTIONS|UNDER)/i);
    if (psMatch && psMatch[1] && psMatch[1].trim().length > 1) {
      policeStation = psMatch[1].trim();
    }

    // 4. Extract Officers
    const officers: string[] = [];
    const officerMatch = text.match(/(?:INVESTIGATING OFFICER|INSPECTING OFFICER|OFFICER|SHO)[\.:\s_-]*([A-Za-z\.\s]+?)(?:,|\.|\n|RANK|DEPT)/i);
    if (officerMatch && officerMatch[1] && officerMatch[1].trim().length > 2) {
      officers.push(officerMatch[1].trim());
    }

    // 5. Extract Persons (Accused, Complainant, Witnesses)
    const persons: string[] = [];
    const personMatches = text.matchAll(/(?:ACCUSED|COMPLAINANT|WITNESS|SUBJECT|DEPONENT)[\.:\s_-]*([A-Za-z\.\s]+?)(?:,|\.|\n|RESIDENT|AGE)/gi);
    for (const match of personMatches) {
      if (match[1] && match[1].trim().length > 2 && !persons.includes(match[1].trim())) {
        persons.push(match[1].trim());
      }
    }

    // 6. Extract Locations & Organizations
    const locations: string[] = [];
    const locMatch = text.match(/(?:LOCATION|PLACE OF OCCURRENCE|ADDRESS|CITY|DISTRICT)[\.:\s_-]*([A-Za-z0-9\.\s,]+?)(?:\.|\n|TIME)/i);
    if (locMatch && locMatch[1] && locMatch[1].trim().length > 2) {
      locations.push(locMatch[1].trim());
    }

    const organizations: string[] = [];
    const orgMatch = text.match(/(?:DEPARTMENT|BRANCH|LABORATORY|COURT|DIVISION)[\.:\s_-]*([A-Za-z0-9\.\s,]+?)(?:\.|\n|ADDRESS)/i);
    if (orgMatch && orgMatch[1] && orgMatch[1].trim().length > 2) {
      organizations.push(orgMatch[1].trim());
    }

    // 7. Extractive Summary Generation
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 15);
    const summarySentences = sentences.slice(0, 3);
    const summary = summarySentences.length > 0 ? summarySentences.join(' ') : text.substring(0, 250) + '...';

    return {
      caseNumber,
      documentDate,
      policeStation,
      officers,
      persons,
      locations,
      organizations,
      importantEntities: [...new Set([...persons, ...locations, ...organizations])],
      summary,
    };
  }
}
