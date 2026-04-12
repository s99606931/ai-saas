/**
 * Adversarial Input Detector — SVC-AI-ADV-R154
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R154.design.md
 * Plan SC: FR-R154.1 ~ FR-R154.8
 *
 * 적대적 입력(제로폭, 반복, 과도길이, 비정상 유니코드, 인코딩 페이로드)을 탐지한다.
 */

export type DataGrade = 'O' | 'C' | 'S'

export type Category =
  | 'zero_width'
  | 'repetition'
  | 'oversize'
  | 'abnormal_unicode'
  | 'encoded_payload'

export type Verdict = 'pass' | 'warn' | 'block'

export interface DetectionResult {
  verdict: Verdict
  categories: Category[]
  score: number
  sample: string
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface DetectorOptions {
  maxLength?: number
  now?: () => number
}

export class AdversarialInputDetector {
  private readonly maxLength: number
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number

  constructor(opts: DetectorOptions = {}) {
    this.maxLength = opts.maxLength ?? 10_000
    this.now = opts.now ?? (() => Date.now())
  }

  /** FR-R154.1~FR-R154.7: 적대적 입력 탐지 */
  detect(input: string, grade: DataGrade = 'O'): DetectionResult {
    this.assertGrade(grade)
    if (!input || input.length === 0) {
      throw new Error('invalid_input')
    }

    const categories: Category[] = []

    // FR-R154.1: 제로폭 문자
    if (/[\u200B\u200C\u200D\uFEFF]/.test(input)) {
      categories.push('zero_width')
    }

    // FR-R154.2: 반복 문자 폭탄
    if (/(.)\1{49,}/.test(input)) {
      categories.push('repetition')
    }

    // FR-R154.3: 과도 길이
    if (input.length > this.maxLength) {
      categories.push('oversize')
    }

    // FR-R154.4: 비정상 유니코드 비율
    const controlCount = this.countControlChars(input)
    const ratio = controlCount / input.length
    if (ratio > 0.05) {
      categories.push('abnormal_unicode')
    }

    // FR-R154.5: 인코딩 페이로드
    if (/[A-Za-z0-9+/=]{2000,}/.test(input)) {
      categories.push('encoded_payload')
    }

    // FR-R154.6: 점수
    const rawScore = categories.length * 0.25
    const score = Math.min(1.0, Math.round(rawScore * 1e6) / 1e6)

    // FR-R154.7: verdict
    const verdict: Verdict = score >= 0.5 ? 'block' : score >= 0.25 ? 'warn' : 'pass'

    const result: DetectionResult = {
      verdict,
      categories,
      score,
      sample: input.slice(0, 80),
    }

    this.audit('detected', {
      verdict,
      categories,
      score,
      length: input.length,
    })
    return result
  }

  /** 차단 판정 헬퍼 */
  shouldBlock(result: DetectionResult): boolean {
    return result.verdict === 'block'
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private countControlChars(text: string): number {
    let count = 0
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i)
      // C0 controls (exclude \t, \n, \r), C1 controls, surrogates
      if (
        (code >= 0x00 && code <= 0x08) ||
        code === 0x0b ||
        code === 0x0c ||
        (code >= 0x0e && code <= 0x1f) ||
        (code >= 0x7f && code <= 0x9f) ||
        (code >= 0xd800 && code <= 0xdfff)
      ) {
        count += 1
      }
    }
    return count
  }

  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}
