// Design Ref: §R490 — AI기반 공공 행정 언어 교정 v3
// Plan SC: SVC-AI-ADV-R490-SC01

export type CorrectionCategory =
  | 'JARGON' | 'PASSIVE_VOICE' | 'HONORIFIC' | 'FOREIGN_TERM'
  | 'AMBIGUOUS' | 'EXCESSIVE_LENGTH' | 'PLAIN_LANGUAGE'

export type CorrectionSeverity = 'SUGGESTION' | 'RECOMMENDED' | 'REQUIRED'

export interface TextDocument {
  docId: string
  title: string
  content: string
  targetAudience: 'CITIZEN' | 'GOVERNMENT' | 'BUSINESS'
}

export interface LanguageCorrection {
  correctionId: string
  docId: string
  category: CorrectionCategory
  severity: CorrectionSeverity
  original: string
  suggested: string
  reason: string
}

export interface LanguageCorrectionReport {
  docId: string
  title: string
  corrections: LanguageCorrection[]
  readabilityScore: number    // 0..100 (높을수록 평이함)
  plainLanguageCompliant: boolean
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  docId: string
  detail: Record<string, unknown>
}

// 행정 전문 용어 → 쉬운 표현 매핑
const JARGON_MAP: Record<string, string> = {
  '시행': '실시',
  '귀하': '고객님',
  '불허': '허용하지 않음',
  '익일': '다음 날',
  '즉일': '당일',
  '당해': '해당',
  '차후': '앞으로',
  '추후': '나중에',
  '기타': '그 밖에',
  '제반': '모든',
  '상기': '위에서 언급한',
  '하기': '아래에서 언급할',
}

// 외래어 → 한국어 대체
const FOREIGN_TERM_MAP: Record<string, string> = {
  '플랫폼': '운영 체계',
  '프로세스': '절차',
  '매뉴얼': '안내서',
  '컨설팅': '자문',
  '인프라': '기반 시설',
  '모니터링': '점검',
  '피드백': '의견',
  '리포트': '보고서',
}

export class PublicAdminLanguageCorrectorV3 {
  private documents = new Map<string, TextDocument>()
  private auditLog: AuditEntry[] = []

  registerDocument(doc: TextDocument): void {
    this.documents.set(doc.docId, doc)
    this.appendAudit('doc.register', doc.docId, { title: doc.title, audience: doc.targetAudience })
  }

  correct(docId: string): LanguageCorrectionReport {
    const doc = this.documents.get(docId)
    if (!doc) throw new Error(`Unknown document: ${docId}`)

    this.appendAudit('lang.correct', docId, { title: doc.title })

    const corrections: LanguageCorrection[] = []
    const content = doc.content

    // 1. 행정 전문 용어 교정
    for (const [jargon, plain] of Object.entries(JARGON_MAP)) {
      if (content.includes(jargon)) {
        corrections.push({
          correctionId: `COR-JARGON-${docId}-${jargon}`,
          docId,
          category: 'JARGON',
          severity: doc.targetAudience === 'CITIZEN' ? 'REQUIRED' : 'RECOMMENDED',
          original: jargon,
          suggested: plain,
          reason: `행정 전문 용어 '${jargon}'→'${plain}' 교체 권장 (공공언어 개선 지침)`,
        })
      }
    }

    // 2. 외래어 교정 (대민 문서만)
    if (doc.targetAudience === 'CITIZEN') {
      for (const [foreign, korean] of Object.entries(FOREIGN_TERM_MAP)) {
        if (content.includes(foreign)) {
          corrections.push({
            correctionId: `COR-FOREIGN-${docId}-${foreign}`,
            docId,
            category: 'FOREIGN_TERM',
            severity: 'RECOMMENDED',
            original: foreign,
            suggested: korean,
            reason: `외래어 '${foreign}'→'${korean}' 한국어 순화 권장`,
          })
        }
      }
    }

    // 3. 과도한 수동태 탐지 (~되어집니다, ~되어 있습니다)
    const passivePattern = /\S+되어\s*(?:집니다|있습니다)/g
    const passiveMatches = content.match(passivePattern) ?? []
    if (passiveMatches.length > 0) {
      corrections.push({
        correctionId: `COR-PASSIVE-${docId}`,
        docId,
        category: 'PASSIVE_VOICE',
        severity: 'SUGGESTION',
        original: passiveMatches[0] ?? '',
        suggested: '능동형 표현으로 교체',
        reason: '이중 피동 표현 — 능동형으로 개선 권장',
      })
    }

    // 4. 과도한 경어 탐지 (~하여 주시기 바랍니다)
    if (content.includes('하여 주시기 바랍니다')) {
      corrections.push({
        correctionId: `COR-HON-${docId}`,
        docId,
        category: 'HONORIFIC',
        severity: 'SUGGESTION',
        original: '하여 주시기 바랍니다',
        suggested: '해 주세요',
        reason: '불필요한 과도한 경어 — 간결한 표현으로 개선',
      })
    }

    const requiredCount = corrections.filter((c) => c.severity === 'REQUIRED').length
    const recommendedCount = corrections.filter((c) => c.severity === 'RECOMMENDED').length
    const readabilityScore = Math.max(0, 100 - requiredCount * 10 - recommendedCount * 3)
    const plainLanguageCompliant = requiredCount === 0

    const recommendations: string[] = []
    if (!plainLanguageCompliant) {
      recommendations.push(`필수 교정 ${requiredCount}건 처리 후 공공언어 개선 지침 준수 가능`)
    }
    if (corrections.length === 0) {
      recommendations.push('공공언어 개선 지침 준수 수준 양호')
    }

    return { docId, title: doc.title, corrections, readabilityScore, plainLanguageCompliant, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, docId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, docId, detail })
  }
}
