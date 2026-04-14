// Design Ref: §설계결정 — AI기반 공공기관 다국어 서비스 번역 v3
// Plan SC: FR-R592.1~5

interface LanguagePair { pairId: string; sourceLang: string; targetLang: string }
interface TranslationRecord { text: string; translatedText: string; quality: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class PublicServiceTranslatorV3 {
  private pairs = new Map<string, LanguagePair>()
  private translations = new Map<string, TranslationRecord[]>()
  private auditLog: AuditEntry[] = []

  registerLanguagePair(pairId: string, sourceLang: string, targetLang: string): void {
    this.pairs.set(pairId, { pairId, sourceLang, targetLang })
    this.translations.set(pairId, [])
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_PAIR', details: { pairId, sourceLang, targetLang } })
  }

  recordTranslation(pairId: string, text: string, translatedText: string, quality: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const entries = this.translations.get(pairId) ?? []
    entries.push({ text, translatedText, quality })
    this.translations.set(pairId, entries)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_TRANSLATION', details: { pairId, quality } })
  }

  getAverageQuality(pairId: string): number {
    const entries = this.translations.get(pairId) ?? []
    if (entries.length === 0) return 0
    return entries.reduce((sum, e) => sum + e.quality, 0) / entries.length
  }

  getLowQualityPairs(): LanguagePair[] {
    return Array.from(this.pairs.values()).filter(p => this.getAverageQuality(p.pairId) < 70)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
