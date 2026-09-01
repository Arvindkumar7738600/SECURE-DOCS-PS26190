import { DocumentType } from '@prisma/client';
import { ClassificationResult } from './types';

export class RuleBasedClassifier {
  static classifyText(text: string): ClassificationResult {
    const content = text.toUpperCase();

    // 1. FIR (First Information Report)
    const firSignals = [
      'FIRST INFORMATION REPORT',
      'FIR NO',
      'FIR NUMBER',
      'P.S.',
      'POLICE STATION',
      'FORM NO. 5.1',
      'U/S',
      'UNDER SECTION',
      'IPC',
      'DATE & TIME OF OCCURRENCE',
    ];
    const firMatches = firSignals.filter((signal) => content.includes(signal));
    if (firMatches.length >= 3 || content.includes('FIRST INFORMATION REPORT')) {
      const score = Math.min(0.95, 0.65 + firMatches.length * 0.08);
      return {
        classification: DocumentType.FIR,
        confidence: Number(score.toFixed(2)),
        method: 'RULE_BASED',
        reason: `Detected ${firMatches.length} FIR indicators (e.g. ${firMatches.slice(0, 3).join(', ')})`,
      };
    }

    // 2. WITNESS STATEMENT
    const witnessSignals = [
      'STATEMENT OF WITNESS',
      'STATEMENT RECORDED UNDER SECTION 161',
      'WITNESS STATEMENT',
      'DEPOSES AS UNDER',
      'DEPOSITION OF',
      'QUESTION:',
      'ANSWER:',
      'WITNESS NO',
      'SOLEMNLY AFFIRM',
    ];
    const witnessMatches = witnessSignals.filter((signal) => content.includes(signal));
    if (witnessMatches.length >= 2 || content.includes('STATEMENT OF WITNESS')) {
      const score = Math.min(0.95, 0.70 + witnessMatches.length * 0.08);
      return {
        classification: DocumentType.WITNESS_STATEMENT,
        confidence: Number(score.toFixed(2)),
        method: 'RULE_BASED',
        reason: `Detected witness statement structure (${witnessMatches.slice(0, 3).join(', ')})`,
      };
    }

    // 3. CHARGE SHEET
    const chargeSheetSignals = [
      'CHARGE SHEET',
      'FINAL REPORT UNDER SECTION 173',
      'CHARGESHEET',
      'ACCUSED PERSONS SENT UP FOR TRIAL',
      'COGNIZANCE',
      'OFFENCES CHARGED',
    ];
    const chargeMatches = chargeSheetSignals.filter((signal) => content.includes(signal));
    if (chargeMatches.length >= 2 || content.includes('CHARGE SHEET')) {
      const score = Math.min(0.95, 0.72 + chargeMatches.length * 0.08);
      return {
        classification: DocumentType.CHARGE_SHEET,
        confidence: Number(score.toFixed(2)),
        method: 'RULE_BASED',
        reason: `Detected charge sheet legal terminology (${chargeMatches.slice(0, 2).join(', ')})`,
      };
    }

    // 4. FORENSIC REPORT
    const forensicSignals = [
      'FORENSIC',
      'CENTRAL FORENSIC SCIENCE LABORATORY',
      'CHEMICAL ANALYSIS',
      'DNA PROFILE',
      'FINGERPRINT ANALYSIS',
      'BALLISTICS REPORT',
      'TOXICOLOGY EXAMINER',
      'LABORATORY EXAMINATION',
    ];
    const forensicMatches = forensicSignals.filter((signal) => content.includes(signal));
    if (forensicMatches.length >= 2 || content.includes('FORENSIC')) {
      const score = Math.min(0.95, 0.75 + forensicMatches.length * 0.08);
      return {
        classification: DocumentType.FORENSIC_REPORT,
        confidence: Number(score.toFixed(2)),
        method: 'RULE_BASED',
        reason: `Detected scientific forensic examination signals (${forensicMatches.slice(0, 2).join(', ')})`,
      };
    }

    // 5. COURT FILING
    const courtFilingSignals = [
      'IN THE COURT OF',
      'PETITION FOR',
      'AFFIDAVIT',
      'APPLICANT VERSUS',
      'RESPONDENT',
      'WRIT PETITION',
      'BAIL APPLICATION',
      'MEMORANDUM OF APPEAL',
    ];
    const courtMatches = courtFilingSignals.filter((signal) => content.includes(signal));
    if (courtMatches.length >= 2 || content.includes('IN THE COURT OF')) {
      const score = Math.min(0.95, 0.70 + courtMatches.length * 0.08);
      return {
        classification: DocumentType.COURT_FILING,
        confidence: Number(score.toFixed(2)),
        method: 'RULE_BASED',
        reason: `Detected court filing and petition structure (${courtMatches.slice(0, 2).join(', ')})`,
      };
    }

    // 6. JUDGMENT
    const judgmentSignals = [
      'JUDGMENT',
      'ORDER AND DECREE',
      "HON'BLE MR. JUSTICE",
      'ACCUSED IS HEREBY CONVICTED',
      'ACCUSED IS HEREBY ACQUITTED',
      'PROPRIA PERSONA',
    ];
    const judgmentMatches = judgmentSignals.filter((signal) => content.includes(signal));
    if (judgmentMatches.length >= 2 || content.includes('JUDGMENT')) {
      const score = Math.min(0.95, 0.75 + judgmentMatches.length * 0.08);
      return {
        classification: DocumentType.JUDGMENT,
        confidence: Number(score.toFixed(2)),
        method: 'RULE_BASED',
        reason: `Detected judicial ruling and court order signals (${judgmentMatches.slice(0, 2).join(', ')})`,
      };
    }

    // 7. EVIDENCE REPORT
    const evidenceSignals = [
      'EVIDENCE REPORT',
      'EXHIBIT NO',
      'SEIZURE MEMO',
      'PANCHANAMA',
      'MEMORANDUM OF RECOVERY',
      'CHAIN OF CUSTODY',
    ];
    const evidenceMatches = evidenceSignals.filter((signal) => content.includes(signal));
    if (evidenceMatches.length >= 2 || content.includes('EVIDENCE REPORT')) {
      const score = Math.min(0.95, 0.70 + evidenceMatches.length * 0.08);
      return {
        classification: DocumentType.EVIDENCE_REPORT,
        confidence: Number(score.toFixed(2)),
        method: 'RULE_BASED',
        reason: `Detected evidence collection and exhibit signals (${evidenceMatches.slice(0, 2).join(', ')})`,
      };
    }

    // 8. INVESTIGATION REPORT
    const invSignals = [
      'INVESTIGATION REPORT',
      'INVESTIGATING OFFICER',
      'ENQUIRY REPORT',
      'CRIME SCENE EXAMINATION',
      'SUMMARY OF FINDINGS',
    ];
    const invMatches = invSignals.filter((signal) => content.includes(signal));
    if (invMatches.length >= 2 || content.includes('INVESTIGATION REPORT')) {
      const score = Math.min(0.95, 0.70 + invMatches.length * 0.08);
      return {
        classification: DocumentType.INVESTIGATION_REPORT,
        confidence: Number(score.toFixed(2)),
        method: 'RULE_BASED',
        reason: `Detected official investigation findings indicators (${invMatches.slice(0, 2).join(', ')})`,
      };
    }

    // 9. POLICE REPORT
    const policeSignals = ['POLICE REPORT', 'DAILY DIARY', 'GD ENTRY', 'GENERAL DIARY', 'STATION HOUSE OFFICER'];
    const policeMatches = policeSignals.filter((signal) => content.includes(signal));
    if (policeMatches.length >= 1 || content.includes('POLICE REPORT')) {
      return {
        classification: DocumentType.POLICE_REPORT,
        confidence: 0.70,
        method: 'RULE_BASED',
        reason: 'Detected general police report entry indicators',
      };
    }

    // 10. LEGAL DOCUMENT
    const legalSignals = ['AGREEMENT', 'POWER OF ATTORNEY', 'DEED', 'LEGAL NOTICE', 'NOTARY PUBLIC'];
    const legalMatches = legalSignals.filter((signal) => content.includes(signal));
    if (legalMatches.length >= 1) {
      return {
        classification: DocumentType.LEGAL_DOCUMENT,
        confidence: 0.65,
        method: 'RULE_BASED',
        reason: 'Detected general legal contract and notarization signals',
      };
    }

    // Fallback default: OTHER
    return {
      classification: DocumentType.OTHER,
      confidence: 0.50,
      method: 'RULE_BASED',
      reason: 'No specific high-confidence legal/police document structure recognized in content',
    };
  }
}
