// Design Ref: §R262 — 레거시 문법 변환기
// Plan SC: SVC-AI-ADV-R262-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type Language = 'PYTHON2_TO_3' | 'JAVA8_TO_17'

export interface TransformResult {
  language: Language
  transformed: string
  changes: string[]
  warnings: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

const SECRET_PATTERNS: RegExp[] = [
  /api[_-]?key\s*=\s*["'][^"']+["']/i,
  /password\s*=\s*["'][^"']+["']/i,
  /-----BEGIN (RSA |EC |)PRIVATE KEY-----/,
  /secret[_-]?token\s*=\s*["'][^"']+["']/i,
]

export class LegacySyntaxTransformer {
  private stats = new Map<Language, number>()
  private auditLog: AuditEntry[] = []

  transform(source: string, language: Language, caller: string, grade: DataGrade): TransformResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 소스코드 변환 금지 (N2SF N-05)`)
    }
    if (source.length === 0) {
      throw new Error('source가 비어 있습니다')
    }
    if (source.length > 100000) {
      throw new Error('source는 100KB 이내여야 합니다')
    }

    // 시크릿 탐지
    for (const pat of SECRET_PATTERNS) {
      if (pat.test(source)) {
        this.appendAudit('transform.blocked', this.mask(caller), {
          language,
          reason: 'SECRET_DETECTED',
        })
        throw new Error('BLOCKED: 하드코딩 시크릿 감지 — 변환 거부')
      }
    }

    let result: TransformResult
    if (language === 'PYTHON2_TO_3') {
      result = this.applyPython2To3(source)
    } else if (language === 'JAVA8_TO_17') {
      result = this.applyJava8To17(source)
    } else {
      throw new Error(`지원하지 않는 언어: ${language}`)
    }

    this.stats.set(language, (this.stats.get(language) ?? 0) + 1)
    this.appendAudit('transform', this.mask(caller), {
      language,
      changesCount: result.changes.length,
      warningsCount: result.warnings.length,
    })
    return result
  }

  getStats(): Record<Language, number> {
    return {
      PYTHON2_TO_3: this.stats.get('PYTHON2_TO_3') ?? 0,
      JAVA8_TO_17: this.stats.get('JAVA8_TO_17') ?? 0,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private applyPython2To3(source: string): TransformResult {
    const changes: string[] = []
    const warnings: string[] = []
    let text = source

    // print statement → function (식별자 다음 공백 후 인자)
    const printStmt = /^(\s*)print\s+([^\n(][^\n]*)$/gm
    if (printStmt.test(text)) {
      text = text.replace(printStmt, (_m, indent: string, args: string) => {
        return `${indent}print(${args.trim()})`
      })
      changes.push('print statement → print()')
    }

    if (text.includes('xrange(')) {
      text = text.replace(/\bxrange\(/g, 'range(')
      changes.push('xrange → range')
    }

    if (text.includes('raw_input(')) {
      text = text.replace(/\braw_input\(/g, 'input(')
      changes.push('raw_input → input')
    }

    if (text.includes('.iteritems()')) {
      text = text.replace(/\.iteritems\(\)/g, '.items()')
      changes.push('.iteritems() → .items()')
    }

    if (/\.has_key\s*\(/.test(text)) {
      warnings.push('.has_key() 사용 감지 — `key in dict` 형태로 수동 변환 필요')
    }

    return { language: 'PYTHON2_TO_3', transformed: text, changes, warnings }
  }

  private applyJava8To17(source: string): TransformResult {
    const changes: string[] = []
    const warnings: string[] = []
    let text = source

    // 다이아몬드 연산자
    const diamond = /new\s+(\w+)<([^>]+)>\(\)/g
    if (diamond.test(text)) {
      text = text.replace(diamond, (_m, cls: string) => {
        return `new ${cls}<>()`
      })
      changes.push('제네릭 → 다이아몬드 연산자')
    }

    if (/\bcom\.sun\./.test(text)) {
      warnings.push('com.sun.* 내부 API 사용 — 제거 필요 (Java 17 금지)')
    }

    if (/\bString\s+\w+\s*=/.test(text)) {
      warnings.push('지역 변수 `var` 키워드 사용 권고 (Java 10+)')
    }

    return { language: 'JAVA8_TO_17', transformed: text, changes, warnings }
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(action: string, callerMasked: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      callerMasked,
      detail,
    })
  }
}
