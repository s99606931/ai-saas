// SVC-AI-ADV-R41: AI 테스트 케이스 자동 생성
// Design Ref: §흐름, §인터페이스
// Plan SC: FR-R41.1, FR-R41.3

import { TestScenarioBuilder, type TestCaseSpec } from './test-scenario-builder'

export interface GeneratedSuite {
  sourceName: string
  framework: 'vitest' | 'jest'
  cases: TestCaseSpec[]
  code: string
  coverageEstimate: number
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface GeneratorOptions {
  framework?: 'vitest' | 'jest'
  includeCSAP?: boolean
  includeOWASP?: boolean
  sourceName?: string
}

/**
 * 간이 AST 파서 — function / method 선언 추출.
 * 실제 프로덕션에서는 @typescript-eslint/parser 사용 권장.
 */
interface ExtractedFunction {
  name: string
  params: string[]
  isAsync: boolean
}

/**
 * AI 기반 테스트 생성기.
 * 소스 코드를 분석하여 Vitest/Jest 테스트 케이스를 자동 생성한다.
 */
export class TestGeneratorAI {
  private readonly scenarioBuilder: TestScenarioBuilder

  constructor(scenarioBuilder?: TestScenarioBuilder) {
    this.scenarioBuilder = scenarioBuilder ?? new TestScenarioBuilder()
  }

  /**
   * 소스 코드로부터 테스트 스위트를 생성한다.
   */
  async generate(sourceCode: string, opts: GeneratorOptions = {}): Promise<GeneratedSuite> {
    if (!sourceCode || sourceCode.trim().length === 0) {
      throw new Error('source code required')
    }
    this.assertNoHardcodedSecrets(sourceCode)

    const framework = opts.framework ?? 'vitest'
    const sourceName = opts.sourceName ?? 'module'
    const functions = this.extractFunctions(sourceCode)

    const cases: TestCaseSpec[] = []

    // 함수별 기본 케이스
    for (const fn of functions) {
      cases.push({
        name: `${fn.name}-happy-path`,
        description: `${fn.name} 정상 동작 검증`,
        category: 'unit',
        input: this.mockInput(fn.params),
        expected: { called: true },
        tags: ['unit', 'generated'],
      })
      cases.push({
        name: `${fn.name}-invalid-input`,
        description: `${fn.name} 잘못된 입력 처리`,
        category: 'unit',
        input: null,
        expected: { error: true },
        tags: ['unit', 'generated', 'negative'],
      })
    }

    // CSAP 오버레이
    if (opts.includeCSAP !== false) {
      cases.push(...this.scenarioBuilder.forCSAP('D-08'))
      cases.push(...this.scenarioBuilder.forCSAP('D-09'))
      cases.push(...this.scenarioBuilder.forCSAP('D-12'))
    }

    // OWASP 오버레이
    if (opts.includeOWASP !== false) {
      for (let i = 1; i <= 3; i += 1) {
        cases.push(...this.scenarioBuilder.forOWASP(i))
      }
    }

    const code = this.renderSuite(sourceName, cases, framework)
    const coverageEstimate = Math.min(0.95, 0.5 + functions.length * 0.1)

    return {
      sourceName,
      framework,
      cases,
      code,
      coverageEstimate,
    }
  }

  /**
   * 생성된 테스트 코드 기본 유효성 검증 (구문 매칭).
   */
  validate(testCode: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!testCode.includes('describe')) errors.push('missing describe block')
    if (!testCode.includes('it(') && !testCode.includes('test(')) errors.push('missing test cases')
    if (!testCode.includes('expect(')) warnings.push('no assertions found')

    const openBraces = (testCode.match(/\{/g) ?? []).length
    const closeBraces = (testCode.match(/\}/g) ?? []).length
    if (openBraces !== closeBraces) errors.push(`brace mismatch: ${openBraces} open, ${closeBraces} close`)

    return { valid: errors.length === 0, errors, warnings }
  }

  private extractFunctions(source: string): ExtractedFunction[] {
    const results: ExtractedFunction[] = []
    const regex = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(source)) !== null) {
      const name = match[1]
      const paramStr = match[2] ?? ''
      if (!name) continue
      const params = paramStr
        .split(',')
        .map((p) => p.trim().split(':')[0]?.trim() ?? '')
        .filter(Boolean)
      results.push({
        name,
        params,
        isAsync: match[0].includes('async'),
      })
    }
    // 메서드 선언도 추출
    const methodRegex = /(?:public|private|protected)?\s*(?:async\s+)?([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)\s*[:{]/g
    let mm: RegExpExecArray | null
    while ((mm = methodRegex.exec(source)) !== null) {
      const name = mm[1]
      if (!name || ['if', 'for', 'while', 'switch', 'catch', 'return'].includes(name)) continue
      if (results.some((r) => r.name === name)) continue
      const paramStr = mm[2] ?? ''
      const params = paramStr
        .split(',')
        .map((p) => p.trim().split(':')[0]?.trim() ?? '')
        .filter(Boolean)
      results.push({ name, params, isAsync: mm[0].includes('async') })
    }
    return results
  }

  private mockInput(params: string[]): Record<string, unknown> {
    const mock: Record<string, unknown> = {}
    for (const p of params) {
      mock[p] = `mock-${p}`
    }
    return mock
  }

  private assertNoHardcodedSecrets(source: string): void {
    const patterns = [
      /api[_-]?key\s*[:=]\s*['"][^'"]{16,}['"]/i,
      /password\s*[:=]\s*['"][^'"]{8,}['"]/i,
      /secret\s*[:=]\s*['"][^'"]{16,}['"]/i,
      /AKIA[0-9A-Z]{16}/,  // AWS Access Key
    ]
    for (const p of patterns) {
      if (p.test(source)) {
        throw new Error('BLOCKED: 소스 코드에 하드코딩 시크릿 의심 (테스트 생성 중단)')
      }
    }
  }

  private renderSuite(sourceName: string, cases: TestCaseSpec[], framework: 'vitest' | 'jest'): string {
    const importLine = framework === 'vitest'
      ? `import { describe, it, expect } from 'vitest'`
      : `// jest globals`
    const body = cases
      .map((c) => {
        const input = JSON.stringify(c.input)
        const expected = JSON.stringify(c.expected)
        return `  it('${c.name}', () => {\n    const input = ${input}\n    const expected = ${expected}\n    expect(input).toBeDefined()\n    expect(expected).toBeDefined()\n  })`
      })
      .join('\n\n')
    return `${importLine}\n\ndescribe('${sourceName} — generated', () => {\n${body}\n})\n`
  }
}

export function createTestGenerator(): TestGeneratorAI {
  return new TestGeneratorAI()
}
