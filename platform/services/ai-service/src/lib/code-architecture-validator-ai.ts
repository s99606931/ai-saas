// Plan SC: SVC-AI-ADV-R442
// Design Ref: §VIOLATION_SCORE — 위반 유형별 점수 누적 합산
type ViolationType = 'circular' | 'layerSkip' | 'god-class'
type DataGrade = 'O' | 'C' | 'S'

interface Component {
  componentId: string
  name: string
  layer: string
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

const VIOLATION_SCORE: Record<ViolationType, number> = {
  circular: 30,
  layerSkip: 20,
  'god-class': 15,
}

export class CodeArchitectureValidatorAI {
  private components = new Map<string, Component>()
  private violations = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
  }

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerComponent(componentId: string, name: string, layer: string): Component {
    const component: Component = { componentId, name, layer }
    this.components.set(componentId, component)
    this.violations.set(componentId, 0)
    this.log('component.register', `componentId=${componentId} layer=${layer}`)
    return component
  }

  recordViolation(componentId: string, violationType: ViolationType, dataGrade?: DataGrade): void {
    this.checkGrade(dataGrade)
    if (!this.components.has(componentId)) throw new Error('componentId 없음')
    const current = this.violations.get(componentId) ?? 0
    this.violations.set(componentId, current + VIOLATION_SCORE[violationType])
    this.log('violation.record', `componentId=${componentId} type=${violationType}`)
  }

  getViolationScore(componentId: string): number {
    if (!this.components.has(componentId)) throw new Error('componentId 없음')
    return this.violations.get(componentId) ?? 0
  }

  getHighRiskComponents(threshold: number): Component[] {
    return Array.from(this.components.values()).filter(
      (c) => (this.violations.get(c.componentId) ?? 0) >= threshold,
    )
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
