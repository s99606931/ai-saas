/**
 * LLM Input Injection Sentinel — SVC-AI-ADV-R124
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R124.design.md
 * Plan SC: FR-R124.1 ~ FR-R124.9
 *
 * 입력 측 프롬프트 인젝션 결정적 탐지(direct/indirect/jailbreak).
 * 한·영 패턴, 위험도 채점, allow/sanitize/block 결정.
 * CSAP D-12 시스템 개발 보안, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export type InjectionCategory = 'direct' | 'indirect' | 'jailbreak'

export interface InjectionPattern {
  id: string
  category: InjectionCategory
  pattern: RegExp
  weight: number
  description: string
}

export type SentinelSeverity = 'safe' | 'suspicious' | 'high' | 'critical'
export type SentinelDecision = 'allow' | 'sanitize' | 'block'

export interface SentinelMatch {
  patternId: string
  category: InjectionCategory
  snippet: string
}

export interface SentinelVerdict {
  score: number
  severity: SentinelSeverity
  decision: SentinelDecision
  matches: SentinelMatch[]
  sanitized: string
}

export interface SentinelAuditEntry {
  timestamp: string
  action:
    | 'scan'
    | 'addPattern'
    | 'addWhitelist'
    | 'gradeBlocked'
    | 'decision'
  detail?: Record<string, unknown>
}

const DEFAULT_PATTERNS: InjectionPattern[] = [
  {
    id: 'direct.ignore.ko',
    category: 'direct',
    pattern: /이전\s*(지시|명령|규칙).*?(무시|잊)/u,
    weight: 0.8,
    description: '한국어 직접 지시 무시',
  },
  {
    id: 'direct.ignore.en',
    category: 'direct',
    pattern: /ignore\s+(?:all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/iu,
    weight: 0.8,
    description: 'English direct ignore',
  },
  {
    id: 'direct.role.ko',
    category: 'direct',
    pattern: /너는\s*이제\s*\S+/u,
    weight: 0.5,
    description: '역할 재정의(한국어)',
  },
  {
    id: 'direct.role.en',
    category: 'direct',
    pattern: /you\s+are\s+now\s+(a|an|the)\s+\w+/iu,
    weight: 0.5,
    description: 'Role override (English)',
  },
  {
    id: 'jailbreak.dan',
    category: 'jailbreak',
    pattern: /\b(DAN\s+mode|developer\s+mode|jailbroken)\b/iu,
    weight: 0.9,
    description: 'DAN/Developer mode jailbreak',
  },
  {
    id: 'jailbreak.system.ko',
    category: 'jailbreak',
    pattern: /시스템\s*프롬프트.*?(공개|출력|보여|알려)/u,
    weight: 0.9,
    description: '시스템 프롬프트 추출 시도',
  },
  {
    id: 'jailbreak.system.en',
    category: 'jailbreak',
    pattern: /(print|reveal|show)\s+(your\s+)?system\s+(prompt|instructions)/iu,
    weight: 0.9,
    description: 'System prompt extraction',
  },
  {
    id: 'indirect.html.script',
    category: 'indirect',
    pattern: /<\/?(script|iframe|object)\b/iu,
    weight: 0.6,
    description: 'HTML script/iframe injection',
  },
  {
    id: 'indirect.markdown.javascript',
    category: 'indirect',
    pattern: /!\[[^\]]*\]\(javascript:/iu,
    weight: 0.7,
    description: 'Markdown javascript: payload',
  },
  {
    id: 'indirect.comment.injection',
    category: 'indirect',
    pattern: /<!--\s*(injection|prompt)/iu,
    weight: 0.7,
    description: 'HTML comment injection marker',
  },
]

export class LLMInputInjectionSentinel {
  private readonly patterns: InjectionPattern[] = []
  private readonly whitelist: Set<string> = new Set()
  private readonly auditLog: SentinelAuditEntry[] = []

  constructor() {
    for (const p of DEFAULT_PATTERNS) {
      this.patterns.push(p)
    }
  }

  getAuditLog(): readonly SentinelAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: SentinelAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * FR-R124.6: 커스텀 패턴 등록.
   */
  addPattern(p: InjectionPattern): void {
    if (p.weight < 0 || p.weight > 1) {
      throw new Error('weight must be in [0, 1]')
    }
    this.patterns.push(p)
    this.audit('addPattern', { id: p.id, category: p.category })
  }

  /**
   * FR-R124.7: 화이트리스트 토큰 추가.
   */
  addWhitelistToken(token: string): void {
    if (!token) return
    this.whitelist.add(token.toLowerCase())
    this.audit('addWhitelist', { token })
  }

  private maskPII(text: string): string {
    return text
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, '***@***')
      .replace(/\d{3}-\d{4}-\d{4}/gu, '***-****-****')
      .replace(/\d{6}-\d{7}/gu, '******-*******')
  }

  private classify(score: number): {
    severity: SentinelSeverity
    decision: SentinelDecision
  } {
    if (score < 0.2) return { severity: 'safe', decision: 'allow' }
    if (score < 0.5) return { severity: 'suspicious', decision: 'sanitize' }
    if (score < 0.8) return { severity: 'high', decision: 'sanitize' }
    return { severity: 'critical', decision: 'block' }
  }

  /**
   * FR-R124.1~5 / FR-R124.8: 입력 스캔 + 점수 + 결정 + 등급 guard.
   */
  scan(text: string, grade: DataGrade): SentinelVerdict {
    if (grade === DataGrade.C || grade === DataGrade.S) {
      this.audit('gradeBlocked', { grade })
      throw new Error(
        `BLOCKED: ${grade}등급 입력은 인젝션 스캐너 전송 금지 (N2SF N-05)`,
      )
    }

    const matches: SentinelMatch[] = []
    let rawScore = 0
    let sanitized = text

    for (const p of this.patterns) {
      // 새 RegExp로 전역 매칭 (lastIndex 격리)
      const re = new RegExp(p.pattern.source, p.pattern.flags.includes('g') ? p.pattern.flags : `${p.pattern.flags}g`)
      let m: RegExpExecArray | null
      let matchedAny = false
      while ((m = re.exec(text)) !== null) {
        matchedAny = true
        const raw = m[0]
        matches.push({
          patternId: p.id,
          category: p.category,
          snippet: this.maskPII(raw),
        })
        sanitized = sanitized.split(raw).join('[REDACTED:injection]')
        if (re.lastIndex === m.index) {
          re.lastIndex++ // zero-width 보호
        }
      }
      if (matchedAny) {
        rawScore += p.weight
      }
    }

    // 화이트리스트 감점
    let deduction = 0
    const lowerText = text.toLowerCase()
    for (const token of this.whitelist) {
      if (lowerText.includes(token)) {
        deduction += 0.2
      }
    }

    const score = Math.max(0, Math.min(1, rawScore - deduction))
    const { severity, decision } = this.classify(score)

    this.audit('scan', { score, severity, decision, matches: matches.length })
    if (decision !== 'allow') {
      this.audit('decision', { decision, score })
    }

    return {
      score,
      severity,
      decision,
      matches,
      sanitized,
    }
  }
}
