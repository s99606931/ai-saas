// Design Ref: §핵심 알고리즘 — 마이그레이션 복잡도 점수, 전략 추천
// Plan SC: SVC-AI-ADV-R383
export type DataGrade = 'O' | 'C' | 'S'
export type MigrationStrategy = 'lift-and-shift' | 'replatform' | 'refactor'

const TECH_STACK_COMPLEXITY: Record<string, number> = {
  cobol: 40, mainframe: 40, dotnet: 20, java: 20, python: 10, nodejs: 10, go: 10,
}

export interface ComplexityResult {
  appId: string
  name: string
  complexityScore: number
  strategy: MigrationStrategy
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function getTechComplexity(techStack: string): number {
  return TECH_STACK_COMPLEXITY[techStack.toLowerCase()] ?? 10
}

function recommendStrategy(score: number): MigrationStrategy {
  if (score >= 70) return 'refactor'
  if (score >= 40) return 'replatform'
  return 'lift-and-shift'
}

export class CloudNativeMigrationAdvisor {
  private apps = new Map<string, { name: string; techStack: string; dependencyCount: number }>()
  private auditLog: AuditEntry[] = []

  registerApplication(id: string, name: string, techStack: string, dependencyCount: number): void {
    if (!id || !name || !techStack) throw new Error('id, name, techStack은 필수')
    if (dependencyCount < 0) throw new Error('dependencyCount는 0 이상이어야 합니다')
    this.apps.set(id, { name, techStack, dependencyCount })
    this.auditLog.push({ action: 'app.register', timestamp: new Date().toISOString(), detail: id })
  }

  getComplexityScore(appId: string): ComplexityResult {
    const app = this.apps.get(appId)
    if (!app) throw new Error(`appId 없음: ${appId}`)
    const techScore = getTechComplexity(app.techStack)
    const complexityScore = Math.min(100, app.dependencyCount * 10 + techScore)
    const strategy = recommendStrategy(complexityScore)
    this.auditLog.push({ action: 'strategy.evaluate', timestamp: new Date().toISOString(), detail: `${appId}:${strategy}` })
    return { appId, name: app.name, complexityScore, strategy }
  }

  getMigrationStrategy(appId: string): MigrationStrategy {
    return this.getComplexityScore(appId).strategy
  }

  getTopComplexApps(topN: number): ComplexityResult[] {
    return [...this.apps.keys()]
      .map((id) => this.getComplexityScore(id))
      .sort((a, b) => b.complexityScore - a.complexityScore)
      .slice(0, topN)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
