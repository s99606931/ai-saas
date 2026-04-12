// Cost-Aware Batch Scheduler — FR-R70.1~R70.5
// Design Ref: SVC-AI-ADV-R70 DESIGN §모듈
// Plan SC: 비용 30% 절감, 마감 완료율 99%
// CSAP: D-06 감사
// N2SF: N-05 등급

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type DataGrade = 'C' | 'S' | 'O';

export interface BatchJob {
  id: string;
  name: string;
  payloadSize: number;
  estimatedTokens: number;
  deadline: number;       // epoch ms
  grade: DataGrade;
  run: () => Promise<void>;
  priority?: number;
  maxRetries?: number;
}

export interface PricingSlot {
  startHour: number;
  endHour: number;        // exclusive
  pricePerToken: number;
  capacityTokens: number;
}

export interface SchedulePlan {
  jobId: string;
  plannedAt: number;
  slotHour: number;
  estimatedCost: number;
}

export interface RunResult {
  jobId: string;
  startedAt: number;
  finishedAt: number;
  cost: number;
  status: 'ok' | 'error' | 'missed';
  error?: string;
  retries: number;
}

export interface SchedulerSummary {
  totalJobs: number;
  totalCost: number;
  completed: number;
  failed: number;
  missed: number;
  byHour: Record<number, number>;
}

export type SchedAuditAction =
  | 'JOB_ADD'
  | 'PLAN'
  | 'EXECUTE'
  | 'RETRY'
  | 'MISS_DEADLINE'
  | 'GRADE_BLOCK';

export interface SchedAuditEntry {
  timestamp: string;
  action: SchedAuditAction;
  jobId?: string;
  reason?: string;
}

// ── 메인 클래스 ──────────────────────────────────────────────────────────────

export class CostAwareBatchScheduler {
  private readonly pricing: PricingSlot[];
  private readonly jobs = new Map<string, BatchJob>();
  private readonly plans = new Map<string, SchedulePlan>();
  private readonly results: RunResult[] = [];
  private readonly remainingCapacity = new Map<number, number>(); // slotHour → tokens
  private readonly audit: SchedAuditEntry[] = [];

  public constructor(pricing: PricingSlot[]) {
    if (pricing.length === 0) throw new Error('SCHED_PRICING_EMPTY');
    this.pricing = pricing;
    for (const slot of pricing) {
      for (let h = slot.startHour; h < slot.endHour; h += 1) {
        this.remainingCapacity.set(h, slot.capacityTokens);
      }
    }
  }

  public addJob(job: BatchJob): void {
    if (job.grade !== 'O') {
      this.record('GRADE_BLOCK', { jobId: job.id, reason: `grade:${job.grade}` });
      throw new Error('BATCH_GRADE_BLOCKED');
    }
    this.jobs.set(job.id, job);
    this.record('JOB_ADD', { jobId: job.id });
  }

  public plan(nowEpochMs: number): SchedulePlan[] {
    const pending = [...this.jobs.values()]
      .filter((j) => !this.plans.has(j.id))
      .sort((a, b) => {
        const pa = a.priority ?? 5;
        const pb = b.priority ?? 5;
        if (pa !== pb) return pb - pa;
        return a.deadline - b.deadline;
      });

    const result: SchedulePlan[] = [];
    for (const job of pending) {
      const plan = this.planOne(job, nowEpochMs);
      if (plan) {
        this.plans.set(job.id, plan);
        result.push(plan);
        this.record('PLAN', { jobId: job.id });
      }
    }
    return result;
  }

  public async executeDue(nowEpochMs: number): Promise<RunResult[]> {
    const due = [...this.plans.values()].filter(
      (p) => p.plannedAt <= nowEpochMs,
    );
    const out: RunResult[] = [];
    for (const plan of due) {
      const job = this.jobs.get(plan.jobId);
      if (!job) continue;
      if (nowEpochMs > job.deadline) {
        const miss: RunResult = {
          jobId: job.id,
          startedAt: nowEpochMs,
          finishedAt: nowEpochMs,
          cost: 0,
          status: 'missed',
          retries: 0,
        };
        this.results.push(miss);
        this.record('MISS_DEADLINE', { jobId: job.id });
        this.plans.delete(job.id);
        out.push(miss);
        continue;
      }
      const result = await this.runWithRetry(job, plan, nowEpochMs);
      this.results.push(result);
      this.plans.delete(job.id);
      out.push(result);
    }
    return out;
  }

  public summary(): SchedulerSummary {
    const byHour: Record<number, number> = {};
    let totalCost = 0;
    let completed = 0;
    let failed = 0;
    let missed = 0;
    for (const r of this.results) {
      totalCost += r.cost;
      if (r.status === 'ok') completed += 1;
      else if (r.status === 'error') failed += 1;
      else missed += 1;
      const hour = new Date(r.startedAt).getUTCHours();
      byHour[hour] = (byHour[hour] ?? 0) + 1;
    }
    return {
      totalJobs: this.jobs.size,
      totalCost,
      completed,
      failed,
      missed,
      byHour,
    };
  }

  public getJobCount(): number {
    return this.jobs.size;
  }

  public getPlans(): SchedulePlan[] {
    return [...this.plans.values()];
  }

  public getAuditLog(): SchedAuditEntry[] {
    return [...this.audit];
  }

  private planOne(job: BatchJob, nowEpochMs: number): SchedulePlan | null {
    const nowHour = new Date(nowEpochMs).getUTCHours();
    const deadlineMs = job.deadline;
    const deadlineHour = new Date(deadlineMs).getUTCHours();
    const maxLookaheadHours = Math.max(
      1,
      Math.ceil((deadlineMs - nowEpochMs) / (60 * 60 * 1000)),
    );

    let best: SchedulePlan | null = null;
    let bestCost = Number.POSITIVE_INFINITY;

    for (let offset = 0; offset < maxLookaheadHours; offset += 1) {
      const hour = (nowHour + offset) % 24;
      const slot = this.pricing.find(
        (s) => hour >= s.startHour && hour < s.endHour,
      );
      if (!slot) continue;
      const remaining = this.remainingCapacity.get(hour) ?? 0;
      if (remaining < job.estimatedTokens) continue;
      const slotStartMs = nowEpochMs + offset * 60 * 60 * 1000;
      if (slotStartMs > deadlineMs) break;
      if (hour === deadlineHour && slotStartMs > deadlineMs) break;
      const cost = slot.pricePerToken * job.estimatedTokens;
      if (cost < bestCost) {
        bestCost = cost;
        best = {
          jobId: job.id,
          plannedAt: slotStartMs,
          slotHour: hour,
          estimatedCost: cost,
        };
      }
    }

    if (best) {
      const remaining = this.remainingCapacity.get(best.slotHour) ?? 0;
      this.remainingCapacity.set(best.slotHour, remaining - job.estimatedTokens);
    }
    return best;
  }

  private async runWithRetry(
    job: BatchJob,
    plan: SchedulePlan,
    nowEpochMs: number,
  ): Promise<RunResult> {
    const maxRetries = job.maxRetries ?? 3;
    let attempt = 0;
    let lastError = '';
    const start = nowEpochMs;
    while (attempt <= maxRetries) {
      try {
        await job.run();
        this.record('EXECUTE', { jobId: job.id });
        return {
          jobId: job.id,
          startedAt: start,
          finishedAt: Date.now(),
          cost: plan.estimatedCost,
          status: 'ok',
          retries: attempt,
        };
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        attempt += 1;
        this.record('RETRY', { jobId: job.id, reason: lastError });
        if (attempt > maxRetries) break;
      }
    }
    return {
      jobId: job.id,
      startedAt: start,
      finishedAt: Date.now(),
      cost: plan.estimatedCost,
      status: 'error',
      retries: attempt,
      error: lastError,
    };
  }

  private record(
    action: SchedAuditAction,
    extra: Partial<SchedAuditEntry> = {},
  ): void {
    this.audit.push({
      timestamp: new Date().toISOString(),
      action,
      ...extra,
    });
  }
}
