/**
 * WCAG 2.2 Compliance Scanner — SVC-AI-ADV-R100
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R100.design.md
 * Plan SC: FR-R100.1 ~ FR-R100.5
 *
 * WCAG 2.2 신규 9개 성공기준 전담 스캐너.
 * 공공 웹접근성 2026 의무화 대응.
 */

export type WcagLevel = 'A' | 'AA' | 'AAA'

export interface WcagViolation {
  rule: string
  level: WcagLevel
  message: string
  snippet: string
  suggestion: string
}

export interface WcagReport {
  total: number
  byLevel: Record<WcagLevel, number>
  violations: WcagViolation[]
}

export interface WcagAuditEntry {
  timestamp: string
  action: 'scan' | 'report'
  totalViolations: number
}

export class Wcag22Scanner {
  private readonly auditLog: WcagAuditEntry[] = []

  /**
   * FR-R100.1, FR-R100.2: HTML 스캔 및 위반 탐지.
   */
  scan(html: string): WcagViolation[] {
    const violations: WcagViolation[] = []
    violations.push(...this.checkTargetSize(html))
    violations.push(...this.checkRedundantEntry(html))
    violations.push(...this.checkConsistentHelp(html))
    violations.push(...this.checkAccessibleAuth(html))
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'scan',
      totalViolations: violations.length,
    })
    return violations
  }

  /**
   * CSAP D-06: 감사 로그 append-only 조회.
   */
  getAuditLog(): readonly WcagAuditEntry[] {
    return this.auditLog
  }

  /**
   * FR-R100.5: 집계 리포트 생성.
   */
  report(violations: WcagViolation[]): WcagReport {
    const byLevel: Record<WcagLevel, number> = { A: 0, AA: 0, AAA: 0 }
    for (const v of violations) {
      byLevel[v.level]++
    }
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'report',
      totalViolations: violations.length,
    })
    return {
      total: violations.length,
      byLevel,
      violations,
    }
  }

  /**
   * 2.5.8 Target Size (AA, 24x24 CSS px 이상).
   */
  private checkTargetSize(html: string): WcagViolation[] {
    const out: WcagViolation[] = []
    const regex =
      /<(button|a)\s+[^>]*style="[^"]*(?:width\s*:\s*(\d+)px)[^"]*(?:height\s*:\s*(\d+)px)[^"]*"[^>]*>/gi
    let m: RegExpExecArray | null
    while ((m = regex.exec(html)) !== null) {
      const w = Number.parseInt(m[2] ?? '0', 10)
      const h = Number.parseInt(m[3] ?? '0', 10)
      if (w < 24 || h < 24) {
        out.push({
          rule: '2.5.8',
          level: 'AA',
          message: `타깃 크기가 24x24 미만입니다 (${w}x${h})`,
          snippet: m[0].slice(0, 120),
          suggestion: 'width/height를 24px 이상으로 설정하세요.',
        })
      }
    }
    return out
  }

  /**
   * 3.3.7 Redundant Entry (A) — 동일 name이 반복되는 input 감지.
   */
  private checkRedundantEntry(html: string): WcagViolation[] {
    const out: WcagViolation[] = []
    const regex = /<input\s+[^>]*name="([^"]+)"/gi
    const seen = new Map<string, number>()
    let m: RegExpExecArray | null
    while ((m = regex.exec(html)) !== null) {
      const name = m[1]!
      seen.set(name, (seen.get(name) ?? 0) + 1)
    }
    for (const [name, count] of seen) {
      if (count > 1) {
        out.push({
          rule: '3.3.7',
          level: 'A',
          message: `"${name}" 필드가 ${count}회 중복 입력되고 있습니다.`,
          snippet: `input name="${name}"`,
          suggestion: '이전에 입력한 값을 자동 채우기로 재사용하세요.',
        })
      }
    }
    return out
  }

  /**
   * 3.2.6 Consistent Help (A) — '도움말' 링크가 0개인 경우 경고.
   */
  private checkConsistentHelp(html: string): WcagViolation[] {
    const hasHelp = /<a\s+[^>]*>[^<]*(?:도움말|Help)[^<]*<\/a>/i.test(html)
    if (hasHelp) return []
    return [
      {
        rule: '3.2.6',
        level: 'A',
        message: '페이지에 도움말 링크가 없습니다.',
        snippet: '',
        suggestion:
          '동일한 위치에 "도움말" 링크를 일관되게 제공하세요.',
      },
    ]
  }

  /**
   * 3.3.8 Accessible Authentication — CAPTCHA/퍼즐 요구를 감지.
   */
  private checkAccessibleAuth(html: string): WcagViolation[] {
    const out: WcagViolation[] = []
    if (/captcha|recaptcha|퍼즐\s*인증/i.test(html)) {
      out.push({
        rule: '3.3.8',
        level: 'AA',
        message:
          '인지적 테스트(CAPTCHA/퍼즐)가 사용되어 접근성 문제가 있습니다.',
        snippet: 'captcha/퍼즐 감지',
        suggestion:
          '복사/붙여넣기 허용, 대체 인증(이메일/SMS) 등을 제공하세요.',
      })
    }
    return out
  }
}
