/**
 * Knowledge Distillation Engine — SVC-AI-ADV-R103
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R103.design.md
 * Plan SC: FR-R103.1 ~ FR-R103.5
 *
 * 대형 LLM(Teacher) → 소형 모델(Student) 지식 증류 오프라인 파이프라인.
 * 증류 메타데이터/통계만 담당. 실제 학습은 외부 ML 파이프라인.
 * CSAP D-06 감사 로그, N2SF N-05 등급 차단.
 */

export type DataGrade = 'O' | 'C' | 'S'

export interface DistillationSample {
  prompt: string
  teacherOutput: string
  studentOutput: string
  agreementScore: number
  addedAt: string
}

export interface DistillationJob {
  jobId: string
  teacherModel: string
  studentModel: string
  createdAt: string
  samples: DistillationSample[]
}

export interface DistillationAuditEntry {
  timestamp: string
  action:
    | 'registerDistillationJob'
    | 'addSample'
    | 'guardDataGrade'
    | 'computeAgreement'
    | 'selectHighValueSamples'
    | 'exportTrainingSet'
  detail?: Record<string, unknown>
}

export interface TrainingRecord {
  prompt: string
  output: string
}

const EMAIL_REGEX = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g
const KR_RRN_REGEX = /\b\d{6}-[1-4]\d{6}\b/g
const KR_PHONE_REGEX = /\b01\d-\d{3,4}-\d{4}\b/g

export class KnowledgeDistillationEngine {
  private readonly jobs = new Map<string, DistillationJob>()
  private readonly auditLog: DistillationAuditEntry[] = []

  /**
   * CSAP D-06: 감사 로그 조회 (append-only).
   */
  getAuditLog(): readonly DistillationAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: DistillationAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * N2SF N-05: C/S 등급 입력 차단.
   */
  private guardDataGrade(grade: DataGrade): void {
    this.audit('guardDataGrade', { grade })
    if (grade === 'C' || grade === 'S') {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 증류 엔진 입력 금지 (N2SF N-05)`,
      )
    }
  }

  /**
   * FR-R103.1: 증류 작업 등록.
   */
  registerDistillationJob(
    jobId: string,
    teacherModel: string,
    studentModel: string,
  ): DistillationJob {
    if (this.jobs.has(jobId)) {
      throw new Error(`job already exists: ${jobId}`)
    }
    const job: DistillationJob = {
      jobId,
      teacherModel,
      studentModel,
      createdAt: new Date().toISOString(),
      samples: [],
    }
    this.jobs.set(jobId, job)
    this.audit('registerDistillationJob', {
      jobId,
      teacherModel,
      studentModel,
    })
    return job
  }

  /**
   * FR-R103.2: Teacher-Student 샘플 추가 (C/S 등급 차단).
   */
  addSample(
    jobId: string,
    prompt: string,
    teacherOutput: string,
    studentOutput: string,
    dataGrade: DataGrade,
  ): DistillationSample {
    this.guardDataGrade(dataGrade)
    const job = this.requireJob(jobId)
    const agreement = this.jaccard(teacherOutput, studentOutput)
    const sample: DistillationSample = {
      prompt,
      teacherOutput,
      studentOutput,
      agreementScore: agreement,
      addedAt: new Date().toISOString(),
    }
    job.samples.push(sample)
    this.audit('addSample', { jobId, agreement })
    return sample
  }

  /**
   * FR-R103.3: Job 전체 평균 일치율.
   */
  computeAgreement(jobId: string): number {
    const job = this.requireJob(jobId)
    if (job.samples.length === 0) {
      this.audit('computeAgreement', { jobId, average: 0 })
      return 0
    }
    const sum = job.samples.reduce((acc, s) => acc + s.agreementScore, 0)
    const average = sum / job.samples.length
    this.audit('computeAgreement', { jobId, average })
    return average
  }

  /**
   * FR-R103.4: 불일치 높은 고가치 샘플 상위 N건.
   */
  selectHighValueSamples(
    jobId: string,
    topN: number,
  ): DistillationSample[] {
    const job = this.requireJob(jobId)
    const sorted = [...job.samples].sort(
      (a, b) => a.agreementScore - b.agreementScore,
    )
    const selected = sorted.slice(0, Math.max(0, topN))
    this.audit('selectHighValueSamples', {
      jobId,
      topN,
      selected: selected.length,
    })
    return selected
  }

  /**
   * FR-R103.5: JSONL 학습셋 출력 (PII 마스킹).
   */
  exportTrainingSet(jobId: string): TrainingRecord[] {
    const job = this.requireJob(jobId)
    const records = job.samples.map((s) => ({
      prompt: this.maskPii(s.prompt),
      output: this.maskPii(s.teacherOutput),
    }))
    this.audit('exportTrainingSet', {
      jobId,
      records: records.length,
    })
    return records
  }

  private requireJob(jobId: string): DistillationJob {
    const job = this.jobs.get(jobId)
    if (!job) throw new Error(`no such job: ${jobId}`)
    return job
  }

  private jaccard(a: string, b: string): number {
    const tokA = new Set(this.tokenize(a))
    const tokB = new Set(this.tokenize(b))
    if (tokA.size === 0 && tokB.size === 0) return 1
    let inter = 0
    for (const t of tokA) if (tokB.has(t)) inter++
    const union = tokA.size + tokB.size - inter
    return union === 0 ? 0 : inter / union
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s,.!?;:()\[\]{}]+/u)
      .filter((t) => t.length > 0)
  }

  private maskPii(text: string): string {
    return text
      .replace(KR_RRN_REGEX, '[RRN]')
      .replace(KR_PHONE_REGEX, '[PHONE]')
      .replace(EMAIL_REGEX, '[EMAIL]')
  }
}
