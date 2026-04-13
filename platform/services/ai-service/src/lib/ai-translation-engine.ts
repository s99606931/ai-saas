// SVC-AI-ADV-R398 AI-Powered Translation Engine
// Design Ref: SVC-AI-ADV-R398.design.md
// Plan SC: SC-R398-1~5
// CSAP D-06 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';
export type TargetLang = 'en' | 'ja' | 'zh';

export interface GlossaryEntry {
  readonly en: string;
  readonly ja: string;
  readonly zh: string;
}

export interface TranslationResult {
  readonly sourceText: string;
  readonly translated: string;
  readonly lang: TargetLang;
  readonly coverage: number;
  readonly missingTerms: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

export class AITranslationEngine {
  private readonly glossary = new Map<string, GlossaryEntry>();
  private readonly auditLog: AuditEntry[] = [];

  registerTerm(ko: string, entry: GlossaryEntry): void {
    if (!ko) throw new Error('INVALID_TERM: 빈 한국어 용어');
    this.glossary.set(ko, entry);
    this.record('REGISTER_TERM', ko, {});
  }

  translate(text: string, lang: TargetLang, grade: DataGrade = 'O'): TranslationResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 번역 데이터 차단 (N2SF N-05)`);
    }
    if (!text.trim()) {
      return { sourceText: text, translated: '', lang, coverage: 1, missingTerms: [] };
    }

    const tokens = text.split(/\s+/).filter(Boolean);
    const missingTerms: string[] = [];
    const translatedTokens = tokens.map((t) => {
      const entry = this.glossary.get(t);
      if (!entry) {
        missingTerms.push(t);
        return t;
      }
      return entry[lang];
    });

    const matchedCount = tokens.length - missingTerms.length;
    const coverage = tokens.length > 0 ? Number((matchedCount / tokens.length).toFixed(4)) : 1;

    const result: TranslationResult = {
      sourceText: text,
      translated: translatedTokens.join(' '),
      lang,
      coverage,
      missingTerms,
    };

    this.record('TRANSLATE', lang, { tokens: tokens.length, missing: missingTerms.length });
    return result;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
