// Design Ref: §R224 — AI기반 공공 민원 자동 처리
// Plan SC: SVC-AI-ADV-R224-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type ProcessingStatus = 'RECEIVED' | 'AUTO_PROCESSING' | 'COMPLETED' | 'ESCALATED' | 'REJECTED'
export type RequestType = 'DOCUMENT_REQUEST' | 'COMPLAINT' | 'INQUIRY' | 'SUGGESTION' | 'REPORT'

export interface CitizenRequest {
  requestId: string
  citizenName: string
  requestType: RequestType
  subject: string
  body: string
  attachments: number
  grade?: DataGrade
  submittedAt: string
}

export interface ProcessingResult {
  requestId: string
  status: ProcessingStatus
  requestType: RequestType
  autoResolved: boolean
  response?: string
  escalatedTo?: string
  processingTimeMs: number
  completedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  requestId: string
  detail: Record<string, unknown>
}

const AUTO_RESOLVABLE_TYPES: RequestType[] = ['DOCUMENT_REQUEST', 'INQUIRY']
const ESCALATION_KEYWORDS = ['부패', '비리', '불법', '고발', '소송', '언론']

export class CitizenRequestAutoProcessor {
  private auditLog: AuditEntry[] = []

  process(request: CitizenRequest): ProcessingResult {
    // N2SF: C/S 등급 민원 자동 처리 차단
    if (request.grade === 'C' || request.grade === 'S') {
      throw new Error(`BLOCKED: ${request.grade}등급 민원은 AI 자동 처리 금지 (N2SF N-05)`)
    }

    const startMs = Date.now()
    this.appendAudit('request.receive', request.requestId, { type: request.requestType })

    const text = `${request.subject} ${request.body}`.toLowerCase()
    const needsEscalation = ESCALATION_KEYWORDS.some((kw) => text.includes(kw))

    let status: ProcessingStatus
    let autoResolved = false
    let response: string | undefined
    let escalatedTo: string | undefined

    if (needsEscalation) {
      status = 'ESCALATED'
      escalatedTo = '민원감사팀'
      response = `민원 ${request.requestId}는 전문 처리팀으로 이관되었습니다.`
    } else if (AUTO_RESOLVABLE_TYPES.includes(request.requestType)) {
      status = 'COMPLETED'
      autoResolved = true
      response = this.generateAutoResponse(request.requestType, request.subject)
    } else {
      status = 'ESCALATED'
      escalatedTo = '담당부서'
      response = `민원 ${request.requestId}는 담당 부서로 배정되었습니다.`
    }

    const processingTimeMs = Date.now() - startMs
    this.appendAudit('request.complete', request.requestId, { status, autoResolved })

    return {
      requestId: request.requestId,
      status,
      requestType: request.requestType,
      autoResolved,
      response,
      escalatedTo,
      processingTimeMs,
      completedAt: new Date().toISOString(),
    }
  }

  private generateAutoResponse(type: RequestType, subject: string): string {
    if (type === 'DOCUMENT_REQUEST') return `요청하신 "${subject}" 문서 발급이 자동으로 처리되었습니다. 3영업일 내 수령 가능합니다.`
    if (type === 'INQUIRY') return `문의하신 "${subject}"에 대한 답변을 안내드립니다. 추가 문의는 120 콜센터를 이용해 주십시오.`
    return `민원이 접수되었습니다.`
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, requestId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, requestId, detail })
  }
}
