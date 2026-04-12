/**
 * Conversational Form Filler — SVC-AI-ADV-R106
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R106.design.md
 * Plan SC: FR-R106.1 ~ FR-R106.5
 *
 * 자연어 대화 → 공공 민원 서류 필드 자동 입력 (결정적 슬롯 필링).
 * PII 마스킹 저장, CSAP D-06, N2SF N-05.
 */

export type DataGrade = 'O' | 'C' | 'S'

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'phone'
  | 'email'
  | 'rrn'
  | 'enum'

export interface FormField {
  id: string
  label: string
  type: FieldType
  required: boolean
  options?: string[]
  pattern?: string
  pii?: boolean
}

export interface FormSchema {
  formId: string
  title: string
  fields: FormField[]
}

export interface FormSession {
  sessionId: string
  formId: string
  slots: Record<string, string>
  startedAt: string
  lastUpdatedAt: string
}

export interface SlotFillResult {
  filled: string[]
  unrecognized: boolean
}

export interface FormFillerAuditEntry {
  timestamp: string
  action:
    | 'registerForm'
    | 'startSession'
    | 'processUtterance'
    | 'guardDataGrade'
    | 'finalize'
    | 'finalizeRejected'
  detail?: Record<string, unknown>
}

const PHONE_REGEX = /01\d-?\d{3,4}-?\d{4}/
const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/
const RRN_REGEX = /\d{6}-[1-4]\d{6}/
const DATE_REGEX = /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/
const NUMBER_REGEX = /-?\d+(\.\d+)?/

export class ConversationalFormFiller {
  private readonly forms = new Map<string, FormSchema>()
  private readonly sessions = new Map<string, FormSession>()
  private readonly auditLog: FormFillerAuditEntry[] = []

  getAuditLog(): readonly FormFillerAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: FormFillerAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  private guardDataGrade(grade: DataGrade): void {
    this.audit('guardDataGrade', { grade })
    if (grade === 'C' || grade === 'S') {
      throw new Error(
        `BLOCKED: ${grade}등급 대화 입력은 폼 필러 사용 금지 (N2SF N-05)`,
      )
    }
  }

  /**
   * FR-R106.1: 민원 서류 스키마 등록.
   */
  registerForm(schema: FormSchema): void {
    if (schema.fields.length === 0) {
      throw new Error(`form must have at least one field`)
    }
    this.forms.set(schema.formId, schema)
    this.audit('registerForm', {
      formId: schema.formId,
      fields: schema.fields.length,
    })
  }

  /**
   * FR-R106.2: 대화 세션 시작.
   */
  startSession(sessionId: string, formId: string): FormSession {
    if (!this.forms.has(formId)) {
      throw new Error(`no such form: ${formId}`)
    }
    const now = new Date().toISOString()
    const session: FormSession = {
      sessionId,
      formId,
      slots: {},
      startedAt: now,
      lastUpdatedAt: now,
    }
    this.sessions.set(sessionId, session)
    this.audit('startSession', { sessionId, formId })
    return session
  }

  /**
   * FR-R106.3: 자연어 → 슬롯 추출.
   */
  processUtterance(
    sessionId: string,
    text: string,
    dataGrade: DataGrade,
  ): SlotFillResult {
    this.guardDataGrade(dataGrade)
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`no such session: ${sessionId}`)
    const form = this.forms.get(session.formId)
    if (!form) throw new Error(`no such form: ${session.formId}`)

    const filled: string[] = []
    for (const field of form.fields) {
      const extracted = this.extractField(text, field)
      if (extracted !== null) {
        session.slots[field.id] = field.pii
          ? this.mask(extracted, field.type)
          : extracted
        filled.push(field.id)
      }
    }
    session.lastUpdatedAt = new Date().toISOString()
    this.audit('processUtterance', {
      sessionId,
      filledCount: filled.length,
    })
    return {
      filled,
      unrecognized: filled.length === 0,
    }
  }

  /**
   * FR-R106.4: 누락 필수 필드 조회.
   */
  getMissingRequiredFields(sessionId: string): FormField[] {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`no such session: ${sessionId}`)
    const form = this.forms.get(session.formId)
    if (!form) return []
    return form.fields.filter(
      (f) => f.required && !(f.id in session.slots),
    )
  }

  /**
   * FR-R106.5: 완성 시 접수 레코드 반환.
   */
  finalize(sessionId: string): Record<string, string> {
    const missing = this.getMissingRequiredFields(sessionId)
    if (missing.length > 0) {
      this.audit('finalizeRejected', {
        sessionId,
        missing: missing.map((m) => m.id),
      })
      throw new Error(
        `form incomplete: missing ${missing.map((m) => m.id).join(', ')}`,
      )
    }
    const session = this.sessions.get(sessionId)!
    this.audit('finalize', { sessionId })
    return { ...session.slots }
  }

  private extractField(text: string, field: FormField): string | null {
    // 라벨이 포함된 구문 우선 탐지
    const labelIdx = text.indexOf(field.label)
    const scope = labelIdx >= 0 ? text.slice(labelIdx) : text

    switch (field.type) {
      case 'phone': {
        const m = scope.match(PHONE_REGEX)
        return m ? m[0] : null
      }
      case 'email': {
        const m = scope.match(EMAIL_REGEX)
        return m ? m[0] : null
      }
      case 'rrn': {
        const m = scope.match(RRN_REGEX)
        return m ? m[0] : null
      }
      case 'date': {
        const m = scope.match(DATE_REGEX)
        if (!m) return null
        const y = m[1]!
        const mo = m[2]!.padStart(2, '0')
        const d = m[3]!.padStart(2, '0')
        return `${y}-${mo}-${d}`
      }
      case 'number': {
        if (labelIdx < 0) return null
        const m = scope.match(NUMBER_REGEX)
        return m ? m[0] : null
      }
      case 'enum': {
        if (!field.options) return null
        for (const opt of field.options) {
          if (scope.includes(opt)) return opt
        }
        return null
      }
      case 'text': {
        if (labelIdx < 0) return null
        // 라벨 뒤 구분자 이후 단어 (공백/쉼표/마침표까지)
        const after = scope.slice(field.label.length)
        const m = after.match(/[:：]?\s*([^\s,.!?;]+)/u)
        if (!m) return null
        const value = m[1]!
        if (field.pattern && !new RegExp(field.pattern).test(value)) {
          return null
        }
        return value
      }
    }
  }

  private mask(value: string, type: FieldType): string {
    switch (type) {
      case 'rrn': {
        const parts = value.split('-')
        if (parts.length !== 2) return '******-*******'
        return `${parts[0]}-${parts[1]!.charAt(0)}******`
      }
      case 'phone': {
        const digits = value.replace(/-/g, '')
        if (digits.length < 10) return '***-****-****'
        const prefix = digits.slice(0, 3)
        const suffix = digits.slice(-4)
        return `${prefix}-****-${suffix}`
      }
      case 'email': {
        const at = value.indexOf('@')
        if (at <= 1) return `***${value.slice(at)}`
        return `${value.charAt(0)}***${value.slice(at)}`
      }
      default:
        return '***'
    }
  }
}
