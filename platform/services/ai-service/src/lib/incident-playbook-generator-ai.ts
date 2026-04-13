// Design Ref: §R390 — AI기반 자동 장애 복구 플레이북 생성
// Plan SC: SC-R390

export interface IncidentContext {
  incidentId: string
  serviceId: string
  severity: 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4'
  symptoms: string[]
  affectedComponents: string[]
  environmentType: 'PRODUCTION' | 'STAGING' | 'DEV'
}

export interface PlaybookStep {
  stepNumber: number
  action: string
  responsible: string
  estimatedMinutes: number
  rollbackPossible: boolean
}

export interface IncidentPlaybook {
  incidentId: string
  serviceId: string
  severity: IncidentContext['severity']
  playbookTitle: string
  totalEstimatedMinutes: number
  steps: PlaybookStep[]
  escalationContacts: string[]
  communicationTemplate: string
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class IncidentPlaybookGeneratorAi {
  private auditLog: AuditEntry[] = []

  generate(context: IncidentContext): IncidentPlaybook {
    const steps: PlaybookStep[] = []
    const escalationContacts: string[] = []

    // 공통 초기 단계
    steps.push({ stepNumber: 1, action: '장애 상황 확인 및 영향 범위 파악', responsible: '온콜 엔지니어', estimatedMinutes: 5, rollbackPossible: false })
    steps.push({ stepNumber: 2, action: '이해관계자 초기 공지 발송', responsible: '서비스 매니저', estimatedMinutes: 3, rollbackPossible: false })

    // 중증도별 단계 추가
    if (context.severity === 'SEV1' || context.severity === 'SEV2') {
      steps.push({ stepNumber: 3, action: '전쟁방(War Room) 개설 및 대응팀 소집', responsible: '온콜 매니저', estimatedMinutes: 10, rollbackPossible: false })
      steps.push({ stepNumber: 4, action: '최근 배포 롤백 검토 및 실행', responsible: '배포 엔지니어', estimatedMinutes: 15, rollbackPossible: true })
      escalationContacts.push('CTO', '서비스 책임자', '보안팀장')
    } else {
      steps.push({ stepNumber: 3, action: '로그 분석 및 원인 파악', responsible: '담당 엔지니어', estimatedMinutes: 20, rollbackPossible: false })
    }

    // 증상별 단계 추가
    for (const symptom of context.symptoms) {
      if (symptom.includes('DB') || symptom.includes('데이터베이스')) {
        steps.push({ stepNumber: steps.length + 1, action: 'DB 커넥션 풀 상태 확인 및 재시작', responsible: 'DBA', estimatedMinutes: 10, rollbackPossible: true })
      }
      if (symptom.includes('메모리') || symptom.includes('memory')) {
        steps.push({ stepNumber: steps.length + 1, action: '메모리 누수 프로세스 재시작', responsible: '시스템 엔지니어', estimatedMinutes: 5, rollbackPossible: true })
      }
      if (symptom.includes('네트워크') || symptom.includes('network')) {
        steps.push({ stepNumber: steps.length + 1, action: '네트워크 라우팅 및 DNS 점검', responsible: '네트워크 엔지니어', estimatedMinutes: 15, rollbackPossible: false })
      }
    }

    steps.push({ stepNumber: steps.length + 1, action: '복구 확인 및 모니터링 강화', responsible: '온콜 엔지니어', estimatedMinutes: 10, rollbackPossible: false })
    steps.push({ stepNumber: steps.length + 1, action: '포스트모텀 일정 수립 및 최종 공지', responsible: '서비스 매니저', estimatedMinutes: 5, rollbackPossible: false })

    const totalEstimatedMinutes = steps.reduce((s, step) => s + step.estimatedMinutes, 0)

    const communicationTemplate = `[${context.severity}] ${context.serviceId} 서비스 장애 발생\n` +
      `영향 컴포넌트: ${context.affectedComponents.join(', ')}\n` +
      `예상 복구 시간: ${totalEstimatedMinutes}분\n` +
      `대응팀이 즉시 조치 중입니다.`

    this.auditLog.push({ action: 'playbook.generate', timestamp: new Date().toISOString(), detail: `${context.incidentId}:${context.severity}` })
    return {
      incidentId: context.incidentId,
      serviceId: context.serviceId,
      severity: context.severity,
      playbookTitle: `${context.severity} 장애 대응 플레이북 — ${context.serviceId}`,
      totalEstimatedMinutes,
      steps,
      escalationContacts,
      communicationTemplate,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
