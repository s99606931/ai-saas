// Design Ref: §핵심 알고리즘 — PII 마스킹 + k-익명성 검증
// Plan SC: FR-R216.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type AnonymizationTechnique = 'masking' | 'generalization' | 'suppression';

interface AnonymizationProfile {
  id: string;
  name: string;
  techniques: AnonymizationTechnique[];
  suppressFields?: string[];
}

interface AnonymizedResult {
  profileId: string;
  original: Record<string, unknown>;
  anonymized: Record<string, unknown>;
  techniquesApplied: AnonymizationTechnique[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R216.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

function maskPII(value: string): string {
  return value
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    .replace(/\d{6}-\d{7}/g, '[RRN]')
    .replace(/010-\d{4}-\d{4}/g, '[PHONE]');
}

function generalizeAge(value: unknown): string {
  const age = Number(value);
  if (isNaN(age)) return String(value);
  const decade = Math.floor(age / 10) * 10;
  return `${decade}대`;
}

export class AdvancedDataAnonymizerAI {
  private profiles = new Map<string, AnonymizationProfile>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R216.1
  registerProfile(id: string, name: string, techniques: AnonymizationTechnique[], suppressFields: string[] = []): void {
    this.profiles.set(id, { id, name, techniques, suppressFields });
    this.log('REGISTER_PROFILE', { id, name, techniques });
  }

  // Plan SC: FR-R216.2
  anonymize(data: Record<string, unknown>, profileId: string, grade: DataGrade = DataGrade.O): AnonymizedResult {
    guardDataGrade(grade);

    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`프로파일 미등록: ${profileId}`);
    }

    const anonymized: Record<string, unknown> = { ...data };
    const techniquesApplied: AnonymizationTechnique[] = [];

    if (profile.techniques.includes('masking')) {
      for (const [key, value] of Object.entries(anonymized)) {
        if (typeof value === 'string') {
          anonymized[key] = maskPII(value);
        }
      }
      techniquesApplied.push('masking');
    }

    if (profile.techniques.includes('generalization')) {
      if ('age' in anonymized) {
        anonymized['age'] = generalizeAge(anonymized['age']);
      }
      techniquesApplied.push('generalization');
    }

    if (profile.techniques.includes('suppression') && profile.suppressFields) {
      for (const field of profile.suppressFields) {
        delete anonymized[field];
      }
      techniquesApplied.push('suppression');
    }

    this.log('ANONYMIZE', { profileId, techniquesApplied });
    return { profileId, original: data, anonymized, techniquesApplied };
  }

  // Plan SC: FR-R216.3
  validateKAnonymity(dataset: Record<string, unknown>[], quasiIdentifiers: string[], k: number): boolean {
    const groups = new Map<string, number>();

    for (const record of dataset) {
      const key = quasiIdentifiers.map(qi => String(record[qi] ?? '')).join('|');
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }

    const satisfies = Array.from(groups.values()).every(count => count >= k);
    this.log('VALIDATE_K_ANONYMITY', { k, groupCount: groups.size, satisfies });
    return satisfies;
  }

  // Plan SC: FR-R216.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
