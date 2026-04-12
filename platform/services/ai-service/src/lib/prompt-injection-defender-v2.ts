/**
 * Prompt Injection Defender v2 — SVC-AI-ADV-R148
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R148.design.md
 * Plan SC: FR-R148.1 ~ FR-R148.6
 *
 * 컨텍스트 분리 + 3레이어 방어로 프롬프트 인젝션 차단.
 * 기존 prompt-injection-detector / llm-input-injection-sentinel 과 별개.
 */

export type DataGrade = 'O' | 'C' | 'S'

export interface PromptSections {
  system: string
  user: string
  context?: string
}

export interface LayerViolation {
  layer: 1 | 2 | 3
  rule: string
  section: 'system' | 'user' | 'context'
  score: number
}

export interface DefendResult {
  allowed: boolean
  layers: LayerViolation[]
  sanitized: PromptSections
  riskScore: number
  nonceBoundary: string
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export interface DefenderOptions {
  now?: () => number
  rng?: () => number
  blockThreshold?: number
}

const DELIMITER_PATTERNS: ReadonlyArray<{ rule: string; regex: RegExp }> = [
  { rule: 'sys_tag', regex: /<<SYS>>/gi },
  { rule: 'sys_close', regex: /<<\/SYS>>/gi },
  { rule: 'user_bracket', regex: /\[\[USER\]\]/gi },
  { rule: 'hash_system', regex: /###\s*SYSTEM/gi },
  { rule: 'im_start', regex: /<\|im_start\|>/gi },
  { rule: 'im_end', regex: /<\|im_end\|>/gi },
  { rule: 'eos', regex: /<\/s>/gi },
]

const KEYWORD_PATTERNS: ReadonlyArray<{ rule: string; regex: RegExp }> = [
  { rule: 'ignore_previous', regex: /ignore\s+(all\s+)?previous/gi },
  { rule: 'disregard_instructions', regex: /disregard\s+(all\s+)?instructions?/gi },
  { rule: 'reveal_prompt', regex: /reveal\s+(the\s+)?(system\s+)?prompt/gi },
  { rule: 'kr_ignore_prev', regex: /이전\s*지시\s*무시/g },
  { rule: 'kr_system_prompt', regex: /시스템\s*프롬프트/g },
]

const CONTROL_CHAR_REGEX = /[\u200b\u200c\u200d\ufeff\u0000-\u0008\u000b\u000c\u000e-\u001f]/g

const DELIMITER_SCORE = 0.4
const KEYWORD_SCORE = 0.5
const CONTROL_SCORE = 0.3

export class PromptInjectionDefenderV2 {
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number
  private readonly rng: () => number
  private readonly blockThreshold: number

  constructor(opts: DefenderOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
    this.rng = opts.rng ?? Math.random
    this.blockThreshold = opts.blockThreshold ?? 0.5
  }

  /** FR-R148.1~FR-R148.5: 3레이어 방어 실행 */
  defend(sections: PromptSections, grade: DataGrade = 'O'): DefendResult {
    this.assertGrade(grade)
    this.assertSections(sections)

    const violations: LayerViolation[] = []
    const sanitized: PromptSections = {
      system: sections.system,
      user: sections.user,
      context: sections.context,
    }

    // Layer 1: delimiter
    for (const sec of ['system', 'user', 'context'] as const) {
      const text = sanitized[sec]
      if (text === undefined) continue
      let current = text
      for (const { rule, regex } of DELIMITER_PATTERNS) {
        if (regex.test(current)) {
          violations.push({ layer: 1, rule, section: sec, score: DELIMITER_SCORE })
          current = current.replace(regex, '')
        }
      }
      sanitized[sec] = current
    }

    // Layer 2: keyword
    for (const sec of ['system', 'user', 'context'] as const) {
      const text = sanitized[sec]
      if (text === undefined) continue
      let current = text
      for (const { rule, regex } of KEYWORD_PATTERNS) {
        if (regex.test(current)) {
          violations.push({ layer: 2, rule, section: sec, score: KEYWORD_SCORE })
          current = current.replace(regex, '[REDACTED]')
        }
      }
      sanitized[sec] = current
    }

    // Layer 3: control char
    for (const sec of ['system', 'user', 'context'] as const) {
      const text = sanitized[sec]
      if (text === undefined) continue
      if (CONTROL_CHAR_REGEX.test(text)) {
        violations.push({ layer: 3, rule: 'control_char', section: sec, score: CONTROL_SCORE })
        sanitized[sec] = text.replace(CONTROL_CHAR_REGEX, '')
      }
    }

    const riskScore = Math.min(
      1,
      violations.reduce((acc, v) => acc + v.score, 0),
    )
    const allowed = riskScore < this.blockThreshold
    const nonceBoundary = this.makeNonce()

    this.audit('defend_evaluated', {
      allowed,
      riskScore,
      violations: violations.length,
    })

    return { allowed, layers: violations, sanitized, riskScore, nonceBoundary }
  }

  /** FR-R148.4: nonce 경계로 감싼 보호된 프롬프트 생성 */
  buildProtectedPrompt(sections: PromptSections, grade: DataGrade = 'O'): string {
    const result = this.defend(sections, grade)
    if (!result.allowed) {
      throw new Error('prompt_blocked')
    }
    const { sanitized, nonceBoundary } = result
    const parts: string[] = []
    parts.push(`[SYSTEM:${nonceBoundary}]`)
    parts.push(sanitized.system)
    parts.push(`[/SYSTEM:${nonceBoundary}]`)
    if (sanitized.context !== undefined && sanitized.context.length > 0) {
      parts.push(`[CONTEXT:${nonceBoundary}]`)
      parts.push(sanitized.context)
      parts.push(`[/CONTEXT:${nonceBoundary}]`)
    }
    parts.push(`[USER:${nonceBoundary}]`)
    parts.push(sanitized.user)
    parts.push(`[/USER:${nonceBoundary}]`)
    return parts.join('\n')
  }

  /** FR-R148.6: 감사 로그 */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  // === 내부 ===

  private makeNonce(): string {
    let out = ''
    for (let i = 0; i < 16; i += 1) {
      const n = Math.floor(this.rng() * 16)
      out += n.toString(16)
    }
    return out
  }

  private assertSections(sections: PromptSections): void {
    if (!sections.system || !sections.user) {
      throw new Error('invalid_input')
    }
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
