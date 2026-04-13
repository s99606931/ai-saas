// Design Ref: §핵심 알고리즘 — 용어집 기반 번역, 품질 점수
// Plan SC: SVC-AI-ADV-R323
import { randomUUID } from 'node:crypto'

export type DataGrade = 'O' | 'C' | 'S'

export interface GlossaryTerm {
  sourceTerms: string[]
  targetTerm: string
}

export interface Glossary {
  id: string
  sourceLang: string
  targetLang: string
  terms: GlossaryTerm[]
}

export interface TranslationResult {
  translationId: string
  sourceText: string
  translatedText: string
  glossaryHits: number
  qualityScore: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

const BASE_SCORE = 50

export class PublicServiceTranslatorV2 {
  private glossaries = new Map<string, Glossary>()
  private translations = new Map<string, TranslationResult>()
  private auditLog: AuditEntry[] = []

  registerGlossary(id: string, sourceLang: string, targetLang: string, terms: GlossaryTerm[]): void {
    if (!id || !sourceLang || !targetLang) throw new Error('id, sourceLang, targetLang은 필수')
    this.glossaries.set(id, { id, sourceLang, targetLang, terms: [...terms] })
    this.auditLog.push({ action: 'glossary.register', timestamp: new Date().toISOString(), detail: `${sourceLang}→${targetLang}` })
  }

  translate(glossaryId: string, sourceText: string, grade: DataGrade = 'O'): TranslationResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 텍스트 번역 금지 (N2SF N-05)`)
    }
    const glossary = this.glossaries.get(glossaryId)
    if (!glossary) throw new Error(`glossaryId 없음: ${glossaryId}`)
    if (!sourceText) throw new Error('sourceText는 필수')

    let translatedText = sourceText
    let glossaryHits = 0

    for (const term of glossary.terms) {
      for (const sourceTerm of term.sourceTerms) {
        if (translatedText.includes(sourceTerm)) {
          translatedText = translatedText.split(sourceTerm).join(term.targetTerm)
          glossaryHits++
          break
        }
      }
    }

    const qualityScore = Math.min(100, glossaryHits * 20 + BASE_SCORE)
    const translationId = randomUUID()
    const result: TranslationResult = { translationId, sourceText, translatedText, glossaryHits, qualityScore }
    this.translations.set(translationId, result)
    this.auditLog.push({ action: 'text.translate', timestamp: new Date().toISOString(), detail: `${glossaryId}:hits=${glossaryHits}` })
    return result
  }

  getQualityScore(translationId: string): number {
    const t = this.translations.get(translationId)
    if (!t) throw new Error(`translationId 없음: ${translationId}`)
    return t.qualityScore
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
