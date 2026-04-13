// Design Ref: §핵심 알고리즘 — 테스트 커버리지 계산, 유형 다양성
// Plan SC: SVC-AI-ADV-R405
export type DataGrade = 'O' | 'C' | 'S'
export type TestCaseType = 'positive' | 'negative' | 'edge'

export interface FeatureEntry {
  id: string
  name: string
  complexity: string
}

export interface TestCaseEntry {
  featureId: string
  testCaseId: string
  type: TestCaseType
  description: string
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

const ALL_TYPES: TestCaseType[] = ['positive', 'negative', 'edge']

export class TestCaseGeneratorV2 {
  private features = new Map<string, FeatureEntry>()
  private testCases = new Map<string, TestCaseEntry[]>()
  private auditLog: AuditEntry[] = []

  registerFeature(id: string, name: string, complexity: string): void {
    if (!id || !name) throw new Error('id와 name은 필수')
    this.features.set(id, { id, name, complexity })
    this.testCases.set(id, [])
    this.auditLog.push({ action: 'feature.register', timestamp: new Date().toISOString(), detail: id })
  }

  addTestCase(featureId: string, testCaseId: string, type: TestCaseType, description: string, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 테스트 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!this.features.has(featureId)) throw new Error(`featureId 없음: ${featureId}`)
    this.testCases.get(featureId)!.push({ featureId, testCaseId, type, description })
    this.auditLog.push({ action: 'testcase.add', timestamp: new Date().toISOString(), detail: `${featureId}:${testCaseId}:${type}` })
  }

  getCoverageRate(featureId: string): number {
    if (!this.features.has(featureId)) throw new Error(`featureId 없음: ${featureId}`)
    const cases = this.testCases.get(featureId) ?? []
    const coveredTypes = new Set(cases.map((c) => c.type))
    return Math.round((coveredTypes.size / ALL_TYPES.length) * 10000) / 100
  }

  getUncoveredFeatures(): FeatureEntry[] {
    return [...this.features.values()].filter((f) => (this.testCases.get(f.id) ?? []).length === 0)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
