/**
 * Streaming Response Assembler — SVC-AI-ADV-R116
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R116.design.md
 * Plan SC: FR-R116.1 ~ FR-R116.8
 *
 * 스트리밍 LLM 토큰을 구조화 응답으로 실시간 조립 + PII 마스킹.
 * CSAP D-06 감사, D-09 PII 보호, N2SF C/S 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export interface AssemblerOptions {
  grade?: DataGrade
  onPartial?: (partial: unknown) => void
  onComplete?: (final: unknown) => void
  onError?: (err: Error) => void
  maskPII?: boolean
}

export interface AssemblerState {
  tokensReceived: number
  bytesReceived: number
  partialParses: number
  masked: number
  complete: boolean
  failed: boolean
}

export interface AssemblerAuditEntry {
  timestamp: string
  action: 'feed' | 'complete' | 'error' | 'gradeBlocked' | 'piiMasked'
  detail?: Record<string, unknown>
}

const PII_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  {
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    replacement: '[EMAIL]',
  },
  {
    pattern: /\b\d{6}[-]?\d{7}\b/g,
    replacement: '[RRN]',
  },
  {
    pattern: /\b01[0-9]-?\d{3,4}-?\d{4}\b/g,
    replacement: '[PHONE]',
  },
]

export class StreamingResponseAssembler {
  private buffer = ''
  private readonly grade: DataGrade
  private readonly onPartial?: (partial: unknown) => void
  private readonly onComplete?: (final: unknown) => void
  private readonly onError?: (err: Error) => void
  private readonly maskPII: boolean
  private readonly state: AssemblerState = {
    tokensReceived: 0,
    bytesReceived: 0,
    partialParses: 0,
    masked: 0,
    complete: false,
    failed: false,
  }
  private readonly auditLog: AssemblerAuditEntry[] = []
  private lastPartial: unknown = undefined

  constructor(options: AssemblerOptions = {}) {
    const grade = options.grade ?? DataGrade.O
    if (grade === DataGrade.C || grade === DataGrade.S) {
      this.audit('gradeBlocked', { grade })
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`,
      )
    }
    this.grade = grade
    if (options.onPartial) this.onPartial = options.onPartial
    if (options.onComplete) this.onComplete = options.onComplete
    if (options.onError) this.onError = options.onError
    this.maskPII = options.maskPII ?? true
  }

  getAuditLog(): readonly AssemblerAuditEntry[] {
    return this.auditLog
  }

  getState(): AssemblerState {
    return { ...this.state }
  }

  getBuffer(): string {
    return this.buffer
  }

  private audit(
    action: AssemblerAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * FR-R116.6: PII 마스킹.
   */
  private applyMask(text: string): { text: string; masked: number } {
    if (!this.maskPII) return { text, masked: 0 }
    let result = text
    let masked = 0
    for (const { pattern, replacement } of PII_PATTERNS) {
      const matches = result.match(pattern)
      if (matches) {
        masked += matches.length
        result = result.replace(pattern, replacement)
      }
    }
    return { text: result, masked }
  }

  /**
   * FR-R116.1, FR-R116.6: 토큰 feed + 마스킹 + 부분 파싱.
   */
  feed(token: string): void {
    if (this.state.complete || this.state.failed) return

    const { text: masked, masked: maskedCount } = this.applyMask(token)
    if (maskedCount > 0) {
      this.state.masked += maskedCount
      this.audit('piiMasked', { count: maskedCount })
    }

    this.buffer += masked
    this.state.tokensReceived++
    this.state.bytesReceived += masked.length

    const parsed = this.tryPartialParse(this.buffer)
    if (parsed.success) {
      this.state.partialParses++
      this.lastPartial = parsed.value
      this.onPartial?.(parsed.value)
    }

    this.audit('feed', {
      tokens: this.state.tokensReceived,
      bytes: this.state.bytesReceived,
    })
  }

  /**
   * FR-R116.2, FR-R116.5: 점진적 JSON 파서 (부분 허용).
   */
  private tryPartialParse(
    input: string,
  ): { success: true; value: unknown } | { success: false } {
    const trimmed = input.trim()
    if (trimmed.length === 0) return { success: false }
    const first = trimmed[0]
    if (first !== '{' && first !== '[') return { success: false }

    // 단계 1: 원본 그대로 시도
    try {
      const value: unknown = JSON.parse(trimmed)
      return { success: true, value }
    } catch {
      // 단계 2: 복구 시도
    }

    const recovered = this.recoverJson(trimmed)
    if (recovered !== null) {
      try {
        const value: unknown = JSON.parse(recovered)
        return { success: true, value }
      } catch {
        return { success: false }
      }
    }
    return { success: false }
  }

  private recoverJson(input: string): string | null {
    let result = input
    // 미종료 문자열 닫기
    let inString = false
    let escape = false
    for (let i = 0; i < result.length; i++) {
      const ch = result[i]
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') inString = !inString
    }
    if (inString) result += '"'

    // 괄호 균형 맞추기
    let braces = 0
    let brackets = 0
    let inStr = false
    let esc = false
    for (let i = 0; i < result.length; i++) {
      const ch = result[i]
      if (esc) {
        esc = false
        continue
      }
      if (ch === '\\') {
        esc = true
        continue
      }
      if (ch === '"') inStr = !inStr
      if (inStr) continue
      if (ch === '{') braces++
      else if (ch === '}') braces--
      else if (ch === '[') brackets++
      else if (ch === ']') brackets--
    }

    // trailing comma 제거
    result = result.replace(/,\s*$/, '')
    // 마지막 key: 제거
    result = result.replace(/,?\s*"[^"]*"\s*:\s*$/, '')

    for (let i = 0; i < brackets; i++) result += ']'
    for (let i = 0; i < braces; i++) result += '}'

    return result
  }

  /**
   * FR-R116.4: 최종 검증 + onComplete 발행.
   */
  complete(validator?: (value: unknown) => boolean): boolean {
    if (this.state.complete) return true
    if (this.state.failed) return false

    try {
      const finalValue: unknown = JSON.parse(this.buffer.trim())
      if (validator && !validator(finalValue)) {
        const err = new Error('validation failed')
        this.state.failed = true
        this.audit('error', { message: err.message })
        this.onError?.(err)
        return false
      }
      this.state.complete = true
      this.audit('complete', {
        tokens: this.state.tokensReceived,
        bytes: this.state.bytesReceived,
      })
      this.onComplete?.(finalValue)
      return true
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      this.state.failed = true
      this.audit('error', { message: err.message })
      this.onError?.(err)
      return false
    }
  }

  getLastPartial(): unknown {
    return this.lastPartial
  }

  getGrade(): DataGrade {
    return this.grade
  }
}
