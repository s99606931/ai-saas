// Plan SC: SVC-AI-ADV-R471
// Design Ref: §커버리지공식 — unique caseTypes / 3 * 100
type TestCaseType = 'happy' | 'edge' | 'error'
type Complexity = 'low' | 'medium' | 'high'
type DataGrade = 'O' | 'C' | 'S'

interface TestableFunction { funcId: string; name: string; complexity: Complexity }
interface TestCase { funcId: string; caseType: TestCaseType }
interface AuditEntry { action: string; detail: string; timestamp: string }

export class CodeTestAutoGeneratorV3 {
  private functions = new Map<string, TestableFunction>()
  private testCases: TestCase[] = []
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerFunction(funcId: string, name: string, complexity: Complexity): TestableFunction {
    const func: TestableFunction = { funcId, name, complexity }
    this.functions.set(funcId, func)
    this.log('function.register', `funcId=${funcId} complexity=${complexity}`)
    return func
  }

  addTestCase(funcId: string, caseType: TestCaseType, dataGrade?: DataGrade): void {
    this.checkGrade(dataGrade)
    if (!this.functions.has(funcId)) throw new Error('funcId 없음')
    this.testCases.push({ funcId, caseType })
    this.log('testcase.add', `funcId=${funcId} caseType=${caseType}`)
  }

  getCoverageRate(funcId: string): number {
    const cases = this.testCases.filter((t) => t.funcId === funcId)
    const uniqueTypes = new Set(cases.map((t) => t.caseType))
    return (uniqueTypes.size / 3) * 100
  }

  getUncoveredFunctions(): TestableFunction[] {
    return Array.from(this.functions.values()).filter((f) => this.getCoverageRate(f.funcId) < 100)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
