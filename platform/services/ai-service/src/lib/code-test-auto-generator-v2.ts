// Design Ref: §R318 — AI기반 코드 테스트 자동 생성 v2
// Plan SC: SC-R318

export interface FunctionSignature {
  functionId: string
  name: string
  params: { name: string; type: string; required: boolean }[]
  returnType: string
  throwsOn?: string[]
  isAsync: boolean
}

export interface GeneratedTest {
  testId: string
  testName: string
  testType: 'HAPPY_PATH' | 'EDGE_CASE' | 'ERROR_CASE' | 'BOUNDARY'
  description: string
  pseudoCode: string
}

export interface TestSuite {
  functionId: string
  functionName: string
  tests: GeneratedTest[]
  coverageEstimate: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

let testIdCounter = 1

function nextId(): string {
  return `TEST-${String(testIdCounter++).padStart(4, '0')}`
}

export class CodeTestAutoGeneratorV2 {
  private functions = new Map<string, FunctionSignature>()
  private auditLog: AuditEntry[] = []

  registerFunction(fn: FunctionSignature): void {
    this.functions.set(fn.functionId, fn)
    this.auditLog.push({ action: 'function.register', timestamp: new Date().toISOString(), detail: fn.functionId })
  }

  generate(functionId: string): TestSuite {
    const fn = this.functions.get(functionId)
    if (!fn) throw new Error(`Function not found: ${functionId}`)

    const tests: GeneratedTest[] = []

    // Happy path
    tests.push({
      testId: nextId(),
      testName: `${fn.name} — 정상 입력 처리`,
      testType: 'HAPPY_PATH',
      description: '유효한 입력으로 정상 동작 확인',
      pseudoCode: `const result = ${fn.isAsync ? 'await ' : ''}${fn.name}(/* 유효한 인자 */)\nexpect(result).toBeDefined()`,
    })

    // Required params missing
    const requiredParams = fn.params.filter((p) => p.required)
    if (requiredParams.length > 0) {
      tests.push({
        testId: nextId(),
        testName: `${fn.name} — 필수 파라미터 누락`,
        testType: 'ERROR_CASE',
        description: `필수 파라미터 ${requiredParams.map((p) => p.name).join(', ')} 누락 시 에러`,
        pseudoCode: `expect(() => ${fn.name}()).toThrow()`,
      })
    }

    // Null/undefined input
    tests.push({
      testId: nextId(),
      testName: `${fn.name} — null/undefined 입력`,
      testType: 'EDGE_CASE',
      description: 'null 또는 undefined 입력 처리',
      pseudoCode: `expect(() => ${fn.name}(null)).not.toThrow()\n// 또는 적절한 기본값 반환 확인`,
    })

    // Boundary values for number params
    const numberParams = fn.params.filter((p) => p.type === 'number')
    if (numberParams.length > 0) {
      tests.push({
        testId: nextId(),
        testName: `${fn.name} — 경계값 입력 (0, -1, MAX_SAFE_INTEGER)`,
        testType: 'BOUNDARY',
        description: '숫자 파라미터 경계값 처리',
        pseudoCode: `[0, -1, Number.MAX_SAFE_INTEGER].forEach(v => {\n  const result = ${fn.isAsync ? '/* await */' : ''}${fn.name}(v)\n  expect(result).toBeDefined()\n})`,
      })
    }

    // Error throws
    if (fn.throwsOn && fn.throwsOn.length > 0) {
      for (const condition of fn.throwsOn) {
        tests.push({
          testId: nextId(),
          testName: `${fn.name} — ${condition} 시 예외 발생`,
          testType: 'ERROR_CASE',
          description: `${condition} 조건에서 에러 throw 확인`,
          pseudoCode: `expect(() => ${fn.name}(/* ${condition} 조건 입력 */)).toThrow()`,
        })
      }
    }

    // Async specific
    if (fn.isAsync) {
      tests.push({
        testId: nextId(),
        testName: `${fn.name} — async/await 정상 완료`,
        testType: 'HAPPY_PATH',
        description: 'Promise resolve 확인',
        pseudoCode: `await expect(${fn.name}(/* 유효 인자 */)).resolves.not.toThrow()`,
      })
    }

    const coverageEstimate = Math.min(60 + tests.length * 5, 95)

    this.auditLog.push({ action: 'test.generate', timestamp: new Date().toISOString(), detail: `${functionId}:${tests.length}개` })
    return { functionId, functionName: fn.name, tests, coverageEstimate }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
