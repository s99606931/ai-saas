// Design Ref: §R399 — AI기반 공공 서비스 언어 자동 교정 v2
// Plan SC: SVC-AI-ADV-R399-SC01

export type CorrectionType = 'HONORIFIC' | 'TYPO' | 'JARGON' | 'PLAIN_LANGUAGE' | 'FORMAL'
export type DataGrade = 'C' | 'S' | 'O'

export interface TextInput {
  textId: string
  content: string
  documentType: 'NOTICE' | 'FORM' | 'GUIDE' | 'LETTER' | 'ANNOUNCEMENT'
  grade: DataGrade
}

export interface Correction {
  type: CorrectionType
  original: string
  suggested: string
  reason: string
  position?: number
}

export interface CorrectionResult {
  textId: string
  correctedText: string
  corrections: Correction[]
  readabilityScore: number  // 0..100 (높을수록 읽기 쉬움)
  formalityScore: number    // 0..100 (높을수록 격식체)
}

interface AuditEntry {
  timestamp: string
  action: string
  textId: string
  detail: Record<string, unknown>
}

// 전문 용어 → 쉬운 말 사전
const JARGON_MAP: Record<string, string> = {
  '인터페이스': '화면',
  '프로세스': '처리 절차',
  '시스템': '전산 시스템',
  '데이터베이스': '자료 저장소',
  '업로드': '올리기',
  '다운로드': '내려받기',
  '로그인': '접속',
  '아이디': '사용자 번호',
}

// 비공식/구어체 → 공식 표현
const INFORMAL_MAP: Record<string, string> = {
  '됩니다요': '됩니다',
  '해요': '합니다',
  '이에요': '입니다',
  '인데요': '입니다',
  '그런데': '그러나',
  '근데': '그러나',
  '맞죠': '맞습니까',
}

export class PublicLanguageCorrectorV2 {
  private auditLog: AuditEntry[] = []

  correct(input: TextInput): CorrectionResult {
    // N2SF C/S 등급 차단
    if (input.grade === 'C' || input.grade === 'S') {
      throw new Error(`BLOCKED: ${input.grade}등급 문서는 AI 언어 교정 금지 (N2SF N-05)`)
    }

    const corrections: Correction[] = []
    let text = input.content

    // 전문 용어 교정
    for (const [jargon, plain] of Object.entries(JARGON_MAP)) {
      if (text.includes(jargon)) {
        corrections.push({ type: 'JARGON', original: jargon, suggested: plain, reason: '쉬운 우리말 사용 권장 (공공언어 지침)' })
        text = text.replaceAll(jargon, plain)
      }
    }

    // 비공식 표현 교정
    for (const [informal, formal] of Object.entries(INFORMAL_MAP)) {
      if (text.includes(informal)) {
        corrections.push({ type: 'FORMAL', original: informal, suggested: formal, reason: '공식 문서 격식체 사용 필요' })
        text = text.replaceAll(informal, formal)
      }
    }

    // 이중 경어 탐지
    const doubleHonorific = text.match(/(?:시겠습니다|시었습니다|하겠사옵니다)/g)
    if (doubleHonorific) {
      corrections.push({ type: 'HONORIFIC', original: doubleHonorific[0] ?? '', suggested: '하겠습니다', reason: '이중 경어 사용 지양' })
    }

    // 가독성 점수: 평균 문장 길이 기반
    const sentences = text.split(/[.。!?]+/).filter((s) => s.trim().length > 0)
    const avgSentenceLength = sentences.length > 0
      ? sentences.reduce((s, sentence) => s + sentence.length, 0) / sentences.length
      : 0
    const readabilityScore = Math.max(0, Math.min(100, Math.round(100 - (avgSentenceLength - 20) * 1.5)))

    // 격식 점수: 공식 종결어미 비율
    const formalEndings = (text.match(/습니다|입니다|합니다|됩니다/g) ?? []).length
    const totalSentences = Math.max(1, sentences.length)
    const formalityScore = Math.min(100, Math.round((formalEndings / totalSentences) * 100))

    this.appendAudit('text.correct', input.textId, {
      correctionCount: corrections.length,
      readabilityScore,
      formalityScore,
    })

    return { textId: input.textId, correctedText: text, corrections, readabilityScore, formalityScore }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, textId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, textId, detail })
  }
}
