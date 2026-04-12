/**
 * Multi-Tenant Model Fine-tuner — SVC-AI-ADV-R105
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R105.design.md
 * Plan SC: FR-R105.1 ~ FR-R105.5
 *
 * 테넌트별 파인튜닝 작업 제출 + 버전 관리 + 활성 버전 전환/롤백.
 * 테넌트 격리 강제. CSAP D-06 / N2SF N-05.
 */

export type DataGrade = 'O' | 'C' | 'S'

export type JobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export interface FineTuneJob {
  jobId: string
  tenantId: string
  baseModel: string
  datasetHash: string
  status: JobStatus
  submittedAt: string
  modelVersionTag?: string
  updatedAt: string
}

export interface ModelVersion {
  versionTag: string
  tenantId: string
  baseModel: string
  datasetHash: string
  createdAt: string
  isActive: boolean
  activatedAt?: string
  /** 활성화 순번 (결정적 롤백 정렬 기준). */
  activationOrder?: number
}

export interface FineTunerAuditEntry {
  timestamp: string
  action:
    | 'submitFineTuneJob'
    | 'updateJobStatus'
    | 'promoteVersion'
    | 'rollback'
    | 'guardDataGrade'
    | 'tenantIsolation'
  detail?: Record<string, unknown>
}

export interface FineTunerOptions {
  idGen?: () => string
}

export class MultiTenantModelFinetuner {
  private readonly jobs = new Map<string, FineTuneJob>()
  private readonly versionsByTenant = new Map<string, ModelVersion[]>()
  private readonly auditLog: FineTunerAuditEntry[] = []
  private readonly idGen: () => string
  private seq = 0
  private activationSeq = 0

  constructor(opts: FineTunerOptions = {}) {
    this.idGen = opts.idGen ?? (() => `job-${++this.seq}`)
  }

  getAuditLog(): readonly FineTunerAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: FineTunerAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  private guardDataGrade(grade: DataGrade): void {
    this.audit('guardDataGrade', { grade })
    if (grade === 'C' || grade === 'S') {
      throw new Error(
        `BLOCKED: ${grade}등급 학습 데이터는 파인튜닝 금지 (N2SF N-05)`,
      )
    }
  }

  private checkTenantIsolation(job: FineTuneJob, tenantId: string): void {
    if (job.tenantId !== tenantId) {
      this.audit('tenantIsolation', {
        jobId: job.jobId,
        expected: job.tenantId,
        actual: tenantId,
      })
      throw new Error(
        `BLOCKED: tenant isolation violation job=${job.jobId} expected=${job.tenantId}`,
      )
    }
  }

  /**
   * FR-R105.1: 파인튜닝 작업 제출.
   */
  submitFineTuneJob(
    tenantId: string,
    baseModel: string,
    datasetHash: string,
    dataGrade: DataGrade,
  ): FineTuneJob {
    this.guardDataGrade(dataGrade)
    const now = new Date().toISOString()
    const job: FineTuneJob = {
      jobId: this.idGen(),
      tenantId,
      baseModel,
      datasetHash,
      status: 'queued',
      submittedAt: now,
      updatedAt: now,
    }
    this.jobs.set(job.jobId, job)
    this.audit('submitFineTuneJob', {
      jobId: job.jobId,
      tenantId,
      baseModel,
    })
    return job
  }

  /**
   * FR-R105.2: 작업 상태 갱신. succeeded 시 버전 기록.
   */
  updateJobStatus(
    tenantId: string,
    jobId: string,
    status: JobStatus,
    modelVersionTag?: string,
  ): FineTuneJob {
    const job = this.jobs.get(jobId)
    if (!job) throw new Error(`no such job: ${jobId}`)
    this.checkTenantIsolation(job, tenantId)

    if (status === 'succeeded') {
      if (!modelVersionTag) {
        throw new Error(`modelVersionTag required on succeeded status`)
      }
      job.modelVersionTag = modelVersionTag
      const history = this.getOrCreateVersions(tenantId)
      history.push({
        versionTag: modelVersionTag,
        tenantId,
        baseModel: job.baseModel,
        datasetHash: job.datasetHash,
        createdAt: new Date().toISOString(),
        isActive: false,
      })
    }
    job.status = status
    job.updatedAt = new Date().toISOString()
    this.audit('updateJobStatus', {
      jobId,
      status,
      modelVersionTag,
    })
    return job
  }

  /**
   * FR-R105.3: 활성 버전 전환.
   */
  promoteVersion(tenantId: string, modelVersionTag: string): ModelVersion {
    const versions = this.versionsByTenant.get(tenantId) ?? []
    const target = versions.find((v) => v.versionTag === modelVersionTag)
    if (!target) {
      throw new Error(`version not found: ${modelVersionTag}`)
    }
    const now = new Date().toISOString()
    for (const v of versions) {
      if (v.isActive) v.isActive = false
    }
    target.isActive = true
    target.activatedAt = now
    target.activationOrder = ++this.activationSeq
    this.audit('promoteVersion', { tenantId, modelVersionTag })
    return target
  }

  /**
   * FR-R105.4: 이전 활성 버전으로 롤백 (activationOrder 기준).
   */
  rollback(tenantId: string): ModelVersion | null {
    const versions = this.versionsByTenant.get(tenantId) ?? []
    const current = versions.find((v) => v.isActive)
    if (!current) return null

    const previous = versions
      .filter(
        (v) =>
          v.versionTag !== current.versionTag &&
          v.activationOrder !== undefined,
      )
      .sort((a, b) => (b.activationOrder ?? 0) - (a.activationOrder ?? 0))

    let next: ModelVersion | null = null
    if (previous.length > 0) {
      next = previous[0]!
    } else {
      // 활성화 이력이 없으면 가장 최근 생성된 비활성 버전
      const untouched = versions
        .filter(
          (v) =>
            v.versionTag !== current.versionTag &&
            v.activationOrder === undefined,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      if (untouched.length === 0) return null
      next = untouched[0]!
    }

    current.isActive = false
    next.isActive = true
    next.activatedAt = new Date().toISOString()
    next.activationOrder = ++this.activationSeq
    this.audit('rollback', {
      tenantId,
      from: current.versionTag,
      to: next.versionTag,
    })
    return next
  }

  /**
   * FR-R105.5: 테넌트 버전 히스토리.
   */
  listVersions(tenantId: string): ModelVersion[] {
    return [...(this.versionsByTenant.get(tenantId) ?? [])]
  }

  private getOrCreateVersions(tenantId: string): ModelVersion[] {
    let list = this.versionsByTenant.get(tenantId)
    if (!list) {
      list = []
      this.versionsByTenant.set(tenantId, list)
    }
    return list
  }
}
