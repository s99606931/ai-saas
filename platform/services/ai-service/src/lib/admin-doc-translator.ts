// 행정 문서 자동 번역 -- FR-N312.1~FR-N312.4
// Design Ref: MTU-N312
// CSAP: D-06 감사 로그, D-12 개발보안

export type SupportedLanguage = 'ko' | 'en' | 'zh' | 'ja' | 'vi';
export interface TranslationRequest { readonly requestId: string; readonly tenantId: string; readonly sourceText: string; readonly sourceLang: SupportedLanguage; readonly targetLang: SupportedLanguage; readonly documentType: 'official' | 'contract' | 'notice' | 'report'; }
export interface TranslationResult { readonly resultId: string; readonly requestId: string; readonly translatedText: string; readonly confidence: number; readonly glossaryApplied: string[]; readonly translatedAt: string; }
export interface TranslationGlossary { readonly term: string; readonly translations: Record<SupportedLanguage, string>; }
export interface TranslationAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: TranslationAuditEntry[] = [];
function recordAudit(entry: Omit<TranslationAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getTranslationAuditLog(tenantId: string): readonly TranslationAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const ADMIN_GLOSSARY: readonly TranslationGlossary[] = [
  { term: '행정안전부', translations: { ko: '행정안전부', en: 'Ministry of the Interior and Safety', zh: '行政安全部', ja: '行政安全部', vi: 'Bo Noi vu va An toan' } },
  { term: '기안', translations: { ko: '기안', en: 'draft proposal', zh: '起案', ja: '起案', vi: 'du thao' } },
  { term: '결재', translations: { ko: '결재', en: 'approval', zh: '批准', ja: '決裁', vi: 'phe duyet' } },
  { term: '시행문', translations: { ko: '시행문', en: 'official implementation document', zh: '施行文', ja: '施行文', vi: 'van ban thi hanh' } },
  { term: '공고', translations: { ko: '공고', en: 'public notice', zh: '公告', ja: '公告', vi: 'thong bao cong khai' } },
] as const;

export function maskPIIForTranslation(text: string): string {
  return text
    .replace(/\d{6}[-]?\d{7}/g, '[PII_MASKED]')
    .replace(/01[0-9][-]?\d{3,4}[-]?\d{4}/g, '[PHONE_MASKED]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_MASKED]');
}

export function translateDocument(request: TranslationRequest): TranslationResult {
  const maskedText = maskPIIForTranslation(request.sourceText);
  const glossaryApplied: string[] = [];
  let translated = maskedText;

  for (const entry of ADMIN_GLOSSARY) {
    if (maskedText.includes(entry.term)) {
      const target = entry.translations[request.targetLang];
      if (target) {
        translated = translated.replaceAll(entry.term, target);
        glossaryApplied.push(entry.term);
      }
    }
  }

  // 시뮬레이션: 번역되지 않은 텍스트는 그대로 (실제는 AI API 호출)
  if (glossaryApplied.length === 0) {
    translated = `[${request.targetLang}] ${maskedText}`;
  }

  recordAudit({ actor: 'system', tenantId: request.tenantId, action: 'DOCUMENT_TRANSLATED', target: request.requestId, details: { sourceLang: request.sourceLang, targetLang: request.targetLang, glossaryApplied: glossaryApplied.length } });

  return {
    resultId: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    requestId: request.requestId,
    translatedText: translated,
    confidence: glossaryApplied.length > 0 ? 0.9 : 0.7,
    glossaryApplied,
    translatedAt: new Date().toISOString(),
  };
}

export class AdminDocTranslatorService {
  constructor(private readonly tenantId: string) {}
  translate(sourceText: string, sourceLang: SupportedLanguage, targetLang: SupportedLanguage, docType: TranslationRequest['documentType'] = 'official'): TranslationResult {
    return translateDocument({ requestId: `req-${Date.now()}`, tenantId: this.tenantId, sourceText, sourceLang, targetLang, documentType: docType });
  }
  getAuditLog(): readonly TranslationAuditEntry[] { return getTranslationAuditLog(this.tenantId); }
}
