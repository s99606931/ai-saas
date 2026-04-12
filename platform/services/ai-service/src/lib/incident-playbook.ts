// SVC-AI-ADV-R65: 인시던트 대응 플레이북 정의 및 실행
// Design Ref: §Playbook 구조, §실행 흐름
// Plan SC: FR-R65.2

export type PlaybookSeverity = 'low' | 'medium' | 'high' | 'critical'
export type PlaybookAction =
  | 'notify'
  | 'isolate'
  | 'scale'
  | 'rollback'
  | 'snapshot'
  | 'runbook'
  | 'manual'

export interface PlaybookTrigger {
  signalType: string
  requiredTags?: string[]
  minSeverity?: PlaybookSeverity
}

export interface PlaybookStep {
  id: string
  name: string
  action: PlaybookAction
  params: Record<string, unknown>
  requiresApproval: boolean
  timeoutMs: number
  rollbackOnFailure?: boolean
}

export interface Playbook {
  id: string
  name: string
  description: string
  triggers: PlaybookTrigger[]
  severity: PlaybookSeverity
  steps: PlaybookStep[]
  requiredRole: string
  autoExecuteUpTo: number      // 자동 실행 허용 단계 번호 (0 = 전부 승인 필요)
  version: string
}

export interface StepExecutionResult {
  stepId: string
  status: 'success' | 'failure' | 'timeout' | 'pending-approval' | 'skipped'
  startedAt: Date
  completedAt?: Date
  output?: unknown
  error?: string
}

export type StepExecutor = (step: PlaybookStep, context: ExecutionContext) => Promise<unknown>

export interface ExecutionContext {
  playbookId: string
  runId: string
  actorId: string
  actorRole: string
  signalPayload: Record<string, unknown>
  previousResults: StepExecutionResult[]
}

/**
 * 기본 제공 플레이북 10개.
 */
export function buildDefaultPlaybooks(): Playbook[] {
  const now = '1.0.0'
  return [
    {
      id: 'pb-critical-auth-failure',
      name: '인증 실패 급증 대응',
      description: '단기간 인증 실패 폭증 시 IP 차단 + SOC 알림',
      triggers: [{ signalType: 'auth-failure-spike', minSeverity: 'high' }],
      severity: 'critical',
      requiredRole: 'soc-operator',
      autoExecuteUpTo: 2,
      version: now,
      steps: [
        { id: 's1', name: 'SOC 알림', action: 'notify', params: { channel: 'soc' }, requiresApproval: false, timeoutMs: 5000 },
        { id: 's2', name: '의심 IP 차단', action: 'isolate', params: { target: 'ip' }, requiresApproval: false, timeoutMs: 10000 },
        { id: 's3', name: '세션 무효화', action: 'manual', params: { scope: 'suspect-users' }, requiresApproval: true, timeoutMs: 300000 },
      ],
    },
    {
      id: 'pb-database-outage',
      name: 'DB 장애 대응',
      description: 'Primary DB 장애 시 읽기 전용 모드 전환 + 복원 준비',
      triggers: [{ signalType: 'db-down', minSeverity: 'critical' }],
      severity: 'critical',
      requiredRole: 'sre-on-call',
      autoExecuteUpTo: 1,
      version: now,
      steps: [
        { id: 's1', name: '읽기 전용 모드 전환', action: 'runbook', params: { book: 'db-readonly' }, requiresApproval: false, timeoutMs: 30000, rollbackOnFailure: true },
        { id: 's2', name: '백업 스냅샷 확인', action: 'snapshot', params: { verify: true }, requiresApproval: true, timeoutMs: 60000 },
        { id: 's3', name: '장애 조치', action: 'manual', params: { playbook: 'dba-failover' }, requiresApproval: true, timeoutMs: 600000 },
      ],
    },
    {
      id: 'pb-high-error-rate',
      name: '에러율 급증 대응',
      description: '최근 배포 롤백 + 캐시 워밍',
      triggers: [{ signalType: 'error-rate-high', minSeverity: 'high' }],
      severity: 'high',
      requiredRole: 'sre-on-call',
      autoExecuteUpTo: 2,
      version: now,
      steps: [
        { id: 's1', name: '알림', action: 'notify', params: { channel: 'sre' }, requiresApproval: false, timeoutMs: 5000 },
        { id: 's2', name: '카나리 롤백', action: 'rollback', params: { target: 'canary' }, requiresApproval: false, timeoutMs: 60000 },
        { id: 's3', name: '캐시 워밍', action: 'runbook', params: { book: 'cache-warmup' }, requiresApproval: true, timeoutMs: 120000 },
      ],
    },
    {
      id: 'pb-ssrf-attempt',
      name: 'SSRF 시도 대응',
      description: '방화벽 규칙 업데이트 + 세션 무효화',
      triggers: [{ signalType: 'ssrf-detected', minSeverity: 'high' }],
      severity: 'critical',
      requiredRole: 'security-eng',
      autoExecuteUpTo: 1,
      version: now,
      steps: [
        { id: 's1', name: '방화벽 차단', action: 'isolate', params: { layer: 'firewall' }, requiresApproval: false, timeoutMs: 10000 },
        { id: 's2', name: '세션 무효화', action: 'manual', params: {}, requiresApproval: true, timeoutMs: 120000 },
      ],
    },
    {
      id: 'pb-data-exfil-suspect',
      name: '데이터 유출 의심',
      description: '대용량 다운로드 탐지 시 토큰 무효화 + DLP 알림',
      triggers: [{ signalType: 'bulk-download', minSeverity: 'high' }],
      severity: 'critical',
      requiredRole: 'security-eng',
      autoExecuteUpTo: 1,
      version: now,
      steps: [
        { id: 's1', name: '토큰 무효화', action: 'isolate', params: { target: 'session' }, requiresApproval: false, timeoutMs: 10000 },
        { id: 's2', name: 'DLP 알림 + 감사', action: 'notify', params: { channel: 'dlp' }, requiresApproval: true, timeoutMs: 30000 },
      ],
    },
    {
      id: 'pb-cert-expiry',
      name: '인증서 만료 임박',
      description: '자동 갱신 + 재배포',
      triggers: [{ signalType: 'cert-expiring', minSeverity: 'medium' }],
      severity: 'medium',
      requiredRole: 'sre-on-call',
      autoExecuteUpTo: 2,
      version: now,
      steps: [
        { id: 's1', name: '자동 갱신', action: 'runbook', params: { book: 'cert-renew' }, requiresApproval: false, timeoutMs: 120000 },
        { id: 's2', name: '재배포', action: 'runbook', params: { book: 'rollout-cert' }, requiresApproval: false, timeoutMs: 180000 },
      ],
    },
    {
      id: 'pb-resource-saturation',
      name: '리소스 포화',
      description: '오토스케일 + 캐시 확장',
      triggers: [{ signalType: 'resource-saturation', minSeverity: 'medium' }],
      severity: 'high',
      requiredRole: 'sre-on-call',
      autoExecuteUpTo: 2,
      version: now,
      steps: [
        { id: 's1', name: '오토스케일', action: 'scale', params: { factor: 1.5 }, requiresApproval: false, timeoutMs: 60000 },
        { id: 's2', name: '캐시 용량 증설', action: 'scale', params: { component: 'cache' }, requiresApproval: false, timeoutMs: 60000 },
      ],
    },
    {
      id: 'pb-ransomware-suspect',
      name: '랜섬웨어 의심',
      description: '의심 파일 변경 → 스냅샷 + 격리',
      triggers: [{ signalType: 'file-mass-change', minSeverity: 'critical' }],
      severity: 'critical',
      requiredRole: 'security-eng',
      autoExecuteUpTo: 2,
      version: now,
      steps: [
        { id: 's1', name: '스냅샷', action: 'snapshot', params: { scope: 'volume' }, requiresApproval: false, timeoutMs: 120000 },
        { id: 's2', name: '네트워크 격리', action: 'isolate', params: { layer: 'network' }, requiresApproval: false, timeoutMs: 30000 },
        { id: 's3', name: '포렌식 준비', action: 'manual', params: {}, requiresApproval: true, timeoutMs: 600000 },
      ],
    },
    {
      id: 'pb-config-drift-critical',
      name: '설정 드리프트 critical',
      description: '롤백 + GitOps 재동기화',
      triggers: [{ signalType: 'config-drift', minSeverity: 'high' }],
      severity: 'high',
      requiredRole: 'sre-on-call',
      autoExecuteUpTo: 2,
      version: now,
      steps: [
        { id: 's1', name: '현재 상태 스냅샷', action: 'snapshot', params: {}, requiresApproval: false, timeoutMs: 30000 },
        { id: 's2', name: 'GitOps 재동기화', action: 'runbook', params: { book: 'gitops-resync' }, requiresApproval: false, timeoutMs: 120000 },
      ],
    },
    {
      id: 'pb-ddos-volumetric',
      name: 'DDoS 볼륨 공격',
      description: 'CDN 실드 + rate limit 강화',
      triggers: [{ signalType: 'ddos-detected', minSeverity: 'high' }],
      severity: 'critical',
      requiredRole: 'security-eng',
      autoExecuteUpTo: 2,
      version: now,
      steps: [
        { id: 's1', name: 'CDN 실드 활성화', action: 'runbook', params: { book: 'cdn-shield' }, requiresApproval: false, timeoutMs: 30000 },
        { id: 's2', name: 'Rate limit 강화', action: 'runbook', params: { multiplier: 0.3 }, requiresApproval: false, timeoutMs: 30000 },
      ],
    },
  ]
}

/**
 * 플레이북 실행기 — 단계별 실행 + 타임아웃 + 승인 게이트.
 */
export class PlaybookExecutor {
  async execute(
    playbook: Playbook,
    ctx: ExecutionContext,
    stepExecutor: StepExecutor,
  ): Promise<StepExecutionResult[]> {
    const results: StepExecutionResult[] = []

    for (let i = 0; i < playbook.steps.length; i += 1) {
      const step = playbook.steps[i]
      if (!step) continue

      // 자동 실행 허용 범위 검사
      const autoAllowed = i < playbook.autoExecuteUpTo
      if (step.requiresApproval || !autoAllowed) {
        results.push({
          stepId: step.id,
          status: 'pending-approval',
          startedAt: new Date(),
        })
        // 승인 대기 → 이후 단계 skip
        for (let j = i + 1; j < playbook.steps.length; j += 1) {
          const next = playbook.steps[j]
          if (next) {
            results.push({
              stepId: next.id,
              status: 'skipped',
              startedAt: new Date(),
            })
          }
        }
        break
      }

      const startedAt = new Date()
      try {
        const output = await this.withTimeout(stepExecutor(step, { ...ctx, previousResults: results }), step.timeoutMs)
        results.push({
          stepId: step.id,
          status: 'success',
          startedAt,
          completedAt: new Date(),
          output,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const status: StepExecutionResult['status'] = message === 'timeout' ? 'timeout' : 'failure'
        results.push({
          stepId: step.id,
          status,
          startedAt,
          completedAt: new Date(),
          error: message,
        })
        if (step.rollbackOnFailure) {
          break
        }
      }
    }

    return results
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), ms)
      promise.then(
        (v) => {
          clearTimeout(timer)
          resolve(v)
        },
        (e) => {
          clearTimeout(timer)
          reject(e)
        },
      )
    })
  }
}
