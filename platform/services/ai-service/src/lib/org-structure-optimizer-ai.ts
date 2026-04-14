// Design Ref: §R488 — AI기반 공공기관 조직 구조 최적화
// Plan SC: SVC-AI-ADV-R488-SC01

export type DeptType = 'EXECUTIVE' | 'OPERATIONAL' | 'SUPPORT' | 'TECHNICAL' | 'COMPLIANCE'
export type OptimizationAction = 'MERGE' | 'SPLIT' | 'RESTRUCTURE' | 'OUTSOURCE' | 'KEEP'

export interface Department {
  deptId: string
  name: string
  type: DeptType
  headCount: number
  annualBudgetKrw: number
  taskCount: number          // 담당 업무 수
  avgTaskDuration: number    // 평균 처리 일수
  overlapDepts: string[]     // 업무 중복 부서 ID 목록
}

export interface OrgOptimizationSuggestion {
  suggestionId: string
  deptId: string
  action: OptimizationAction
  targetDeptId?: string      // MERGE/RESTRUCTURE 대상
  detail: string
  estimatedSavingKrw: number
  estimatedEfficiencyGain: number  // 0..1
}

export interface OrgOptimizationReport {
  totalDepts: number
  suggestions: OrgOptimizationSuggestion[]
  estimatedTotalSavingKrw: number
  overlapClusters: string[][]   // 중복 부서 묶음
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  deptId: string
  detail: Record<string, unknown>
}

export class OrgStructureOptimizerAI {
  private depts = new Map<string, Department>()
  private auditLog: AuditEntry[] = []

  registerDept(dept: Department): void {
    this.depts.set(dept.deptId, dept)
    this.appendAudit('dept.register', dept.deptId, { name: dept.name, headCount: dept.headCount })
  }

  optimize(): OrgOptimizationReport {
    const allDepts = Array.from(this.depts.values())
    this.appendAudit('org.optimize', 'system', { deptCount: allDepts.length })

    const suggestions: OrgOptimizationSuggestion[] = []

    // 1. 소규모 부서 + 업무 중복 → MERGE 제안
    for (const dept of allDepts) {
      if (dept.overlapDepts.length > 0 && dept.headCount <= 3) {
        for (const targetId of dept.overlapDepts) {
          const target = this.depts.get(targetId)
          if (!target) continue
          suggestions.push({
            suggestionId: `SGT-MERGE-${dept.deptId}-${targetId}`,
            deptId: dept.deptId,
            action: 'MERGE',
            targetDeptId: targetId,
            detail: `'${dept.name}'(${dept.headCount}명)와 '${target.name}' 업무 중복 — 통합 검토`,
            estimatedSavingKrw: Math.round(dept.annualBudgetKrw * 0.2),
            estimatedEfficiencyGain: 0.25,
          })
          break  // 첫 번째 중복 부서와의 합병만 제안
        }
      }
    }

    // 2. 과부하 부서 (1인당 업무 5개 이상, 처리 일수 10일 이상) → SPLIT 제안
    for (const dept of allDepts) {
      const taskPerHead = dept.headCount > 0 ? dept.taskCount / dept.headCount : 0
      if (taskPerHead >= 5 && dept.avgTaskDuration >= 10) {
        suggestions.push({
          suggestionId: `SGT-SPLIT-${dept.deptId}`,
          deptId: dept.deptId,
          action: 'SPLIT',
          detail: `'${dept.name}' 1인당 ${taskPerHead.toFixed(1)}개 업무, 평균 ${dept.avgTaskDuration}일 — 분리 검토`,
          estimatedSavingKrw: 0,
          estimatedEfficiencyGain: 0.3,
        })
      }
    }

    // 3. SUPPORT 부서 대규모 (인원 10명 이상) → OUTSOURCE 검토
    for (const dept of allDepts) {
      if (dept.type === 'SUPPORT' && dept.headCount >= 10) {
        suggestions.push({
          suggestionId: `SGT-OUT-${dept.deptId}`,
          deptId: dept.deptId,
          action: 'OUTSOURCE',
          detail: `'${dept.name}' 지원 부서 ${dept.headCount}명 — 외주 전환 비용 효율 검토`,
          estimatedSavingKrw: Math.round(dept.annualBudgetKrw * 0.3),
          estimatedEfficiencyGain: 0.15,
        })
      }
    }

    // 중복 클러스터 구성
    const visited = new Set<string>()
    const overlapClusters: string[][] = []
    for (const dept of allDepts) {
      if (dept.overlapDepts.length > 0 && !visited.has(dept.deptId)) {
        const cluster = [dept.deptId, ...dept.overlapDepts.filter((id) => this.depts.has(id))]
        cluster.forEach((id) => visited.add(id))
        if (cluster.length >= 2) overlapClusters.push(cluster)
      }
    }

    const estimatedTotalSavingKrw = suggestions.reduce((s, sg) => s + sg.estimatedSavingKrw, 0)
    const recommendations: string[] = []
    if (overlapClusters.length > 0) {
      recommendations.push(`${overlapClusters.length}개 중복 업무 클러스터 재편성 검토`)
    }
    if (suggestions.filter((s) => s.action === 'SPLIT').length > 0) {
      recommendations.push('과부하 부서 인력 보강 또는 업무 재배분 우선 추진')
    }

    return { totalDepts: allDepts.length, suggestions, estimatedTotalSavingKrw, overlapClusters, recommendations }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, deptId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, deptId, detail })
  }
}
