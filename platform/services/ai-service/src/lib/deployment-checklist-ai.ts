/**
 * AI 기반 배포 체크리스트 자동 생성기 — SVC-AI-ADV-R124
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R124/SVC-AI-ADV-R124.design.md
 * Plan SC: FR-R124.1 ~ FR-R124.6
 *
 * PR 변경 내용 분석 → 배포 전 체크리스트 자동 생성.
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard 적용.
 */

export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export type ChangeType =
  | 'schema-migration'
  | 'api-breaking'
  | 'config-change'
  | 'security-patch'
  | 'infra-change'
  | 'feature'
  | 'bugfix'
  | 'dependency-update'

export interface PrChange {
  file: string
  changeType: ChangeType
  linesAdded: number
  linesRemoved: number
  grade: DataGrade
}

export interface ChecklistItem {
  id: string
  category: string
  description: string
  required: boolean
  completed: boolean
}

export interface DeploymentChecklist {
  prId: string
  generatedAt: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  items: ChecklistItem[]
  totalRequired: number
  completedRequired: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

// Plan SC: FR-R124.2 — rule templates per change type
const RULES: Record<ChangeType, ChecklistItem[]> = {
  'schema-migration': [
    { id: 'DB-01', category: 'Database', description: '롤백 마이그레이션 스크립트 검증', required: true, completed: false },
    { id: 'DB-02', category: 'Database', description: '스테이징 환경 마이그레이션 사전 실행', required: true, completed: false },
    { id: 'DB-03', category: 'Database', description: '데이터 백업 완료 확인', required: true, completed: false },
  ],
  'api-breaking': [
    { id: 'API-01', category: 'API', description: 'API 버전 번호 업데이트', required: true, completed: false },
    { id: 'API-02', category: 'API', description: '클라이언트 호환성 테스트', required: true, completed: false },
    { id: 'API-03', category: 'API', description: 'OpenAPI 명세 업데이트', required: false, completed: false },
  ],
  'config-change': [
    { id: 'CFG-01', category: 'Config', description: '환경별 설정 파일 검토', required: true, completed: false },
    { id: 'CFG-02', category: 'Config', description: '시크릿/환경변수 업데이트 확인', required: true, completed: false },
  ],
  'security-patch': [
    { id: 'SEC-01', category: 'Security', description: 'CSAP 보안 검토 완료', required: true, completed: false },
    { id: 'SEC-02', category: 'Security', description: 'CVE 취약점 스캔 통과', required: true, completed: false },
    { id: 'SEC-03', category: 'Security', description: '감사 로그 항목 추가 확인', required: true, completed: false },
  ],
  'infra-change': [
    { id: 'INFR-01', category: 'Infra', description: 'k8s 리소스 제한 설정 검토', required: true, completed: false },
    { id: 'INFR-02', category: 'Infra', description: '헬스체크 엔드포인트 동작 확인', required: true, completed: false },
    { id: 'INFR-03', category: 'Infra', description: 'PodDisruptionBudget 설정', required: false, completed: false },
  ],
  'feature': [
    { id: 'FEAT-01', category: 'Feature', description: '기능 테스트 커버리지 80%+ 확인', required: true, completed: false },
    { id: 'FEAT-02', category: 'Feature', description: '사용자 승인 테스트(UAT) 완료', required: false, completed: false },
  ],
  'bugfix': [
    { id: 'BUG-01', category: 'Bugfix', description: '재현 테스트 케이스 추가', required: true, completed: false },
    { id: 'BUG-02', category: 'Bugfix', description: '회귀 테스트 통과', required: true, completed: false },
  ],
  'dependency-update': [
    { id: 'DEP-01', category: 'Dependency', description: '라이선스 호환성 검토', required: false, completed: false },
    { id: 'DEP-02', category: 'Dependency', description: '보안 취약성 스캔 통과', required: true, completed: false },
  ],
}

// Common items added for all deployments — Plan SC: FR-R124.3
const COMMON_ITEMS: ChecklistItem[] = [
  { id: 'CMN-01', category: 'Common', description: '스테이징 환경 배포 확인', required: true, completed: false },
  { id: 'CMN-02', category: 'Common', description: '모니터링 알림 설정 확인', required: true, completed: false },
  { id: 'CMN-03', category: 'Common', description: '롤백 절차 문서화', required: true, completed: false },
]

export class DeploymentChecklistAi {
  private readonly auditLog: AuditEntry[] = []

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog
  }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  // Plan SC: FR-R124.4 — risk level from change types
  private assessRisk(changes: PrChange[]): DeploymentChecklist['riskLevel'] {
    const types = new Set(changes.map(c => c.changeType))
    if (types.has('security-patch') || types.has('schema-migration')) return 'CRITICAL'
    if (types.has('api-breaking') || types.has('infra-change')) return 'HIGH'
    if (types.has('config-change') || types.has('dependency-update')) return 'MEDIUM'
    return 'LOW'
  }

  // Plan SC: FR-R124.1, FR-R124.2
  generateChecklist(prId: string, changes: PrChange[]): DeploymentChecklist {
    for (const c of changes) {
      if (c.grade === DataGrade.C || c.grade === DataGrade.S) {
        throw new Error(`BLOCKED: ${c.grade}등급 변경 파일 분석 금지 (N2SF N-05)`)
      }
    }

    const seen = new Set<string>()
    const items: ChecklistItem[] = []

    // Add change-type specific items (deduplicated by id)
    for (const change of changes) {
      const rules = RULES[change.changeType] ?? []
      for (const rule of rules) {
        if (!seen.has(rule.id)) {
          seen.add(rule.id)
          items.push({ ...rule })
        }
      }
    }

    // Add common items
    for (const item of COMMON_ITEMS) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        items.push({ ...item })
      }
    }

    const riskLevel = this.assessRisk(changes)
    const totalRequired = items.filter(i => i.required).length
    const checklist: DeploymentChecklist = {
      prId,
      generatedAt: new Date().toISOString(),
      riskLevel,
      items,
      totalRequired,
      completedRequired: 0,
    }
    this.audit('generateChecklist', { prId, riskLevel, itemCount: items.length })
    return checklist
  }

  // Plan SC: FR-R124.5
  completeItem(checklist: DeploymentChecklist, itemId: string): DeploymentChecklist {
    const item = checklist.items.find(i => i.id === itemId)
    if (!item) throw new Error(`item not found: ${itemId}`)
    item.completed = true
    checklist.completedRequired = checklist.items.filter(i => i.required && i.completed).length
    this.audit('completeItem', { prId: checklist.prId, itemId })
    return checklist
  }

  // Plan SC: FR-R124.6
  isReadyToDeploy(checklist: DeploymentChecklist): boolean {
    return checklist.completedRequired === checklist.totalRequired
  }
}
