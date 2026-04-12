// Prompt Variant Experimenter — FR-R78.1~R78.5
// Design Ref: SVC-AI-ADV-R78 DESIGN §모듈
// Plan SC: 할당 편차 ≤ 2%p, 판정 일관성 ≥ 95%
// CSAP: D-06 감사, D-12 변경 관리

export type VariantStatus = 'draft' | 'running' | 'concluded';

export interface Variant {
  id: string;
  label: string;
  template: string;
  weight: number; // 0~1
}

export interface ExperimentDef {
  id: string;
  name: string;
  control: Variant;
  variants: Variant[];
  minSamples?: number;
}

interface ExperimentState extends ExperimentDef {
  minSamples: number;
  status: VariantStatus;
  trials: TrialResult[];
}

export interface TrialResult {
  sessionId: string;
  variantId: string;
  quality: number; // 0~1
  latencyMs: number;
  success: boolean;
}

export interface VariantStats {
  variantId: string;
  n: number;
  avgQuality: number;
  avgLatency: number;
  successRate: number;
}

export interface Verdict {
  status: 'running' | 'concluded';
  winner?: string;
  reason: string;
  stats: VariantStats[];
}

export type AuditAction = 'CREATE' | 'ASSIGN' | 'RECORD' | 'CONCLUDE';

export interface AuditEvent {
  action: AuditAction;
  detail?: string;
  at: number;
}

const WEIGHT_TOLERANCE = 0.001;
const DEFAULT_MIN_SAMPLES = 30;
const QUALITY_DELTA = 0.05;

export class PromptVariantExperimenter {
  private readonly experiments = new Map<string, ExperimentState>();
  private readonly audit: AuditEvent[] = [];

  create(def: ExperimentDef): void {
    if (!def.id || !def.control || !Array.isArray(def.variants)) {
      throw new Error('EXPERIMENT_DEF_INVALID');
    }
    const all = [def.control, ...def.variants];
    const total = all.reduce((s, v) => s + v.weight, 0);
    if (Math.abs(total - 1) > WEIGHT_TOLERANCE) {
      throw new Error('EXPERIMENT_WEIGHT_INVALID');
    }
    for (const v of all) {
      if (v.weight < 0 || v.weight > 1) {
        throw new Error('EXPERIMENT_WEIGHT_INVALID');
      }
      if (!v.id || !v.template) {
        throw new Error('EXPERIMENT_VARIANT_INVALID');
      }
    }
    this.experiments.set(def.id, {
      ...def,
      minSamples: def.minSamples ?? DEFAULT_MIN_SAMPLES,
      status: 'running',
      trials: [],
    });
    this.logEvent({
      action: 'CREATE',
      detail: `${def.id}/${all.length}`,
      at: Date.now(),
    });
  }

  assign(expId: string, sessionId: string): string {
    const exp = this.getExp(expId);
    if (exp.status !== 'running') {
      throw new Error('EXPERIMENT_NOT_RUNNING');
    }
    const h = this.fnv1a(`${expId}:${sessionId}`) / 0xffffffff;
    const all = [exp.control, ...exp.variants];
    let cum = 0;
    for (const v of all) {
      cum += v.weight;
      if (h < cum) {
        this.logEvent({
          action: 'ASSIGN',
          detail: `${expId}/${sessionId}/${v.id}`,
          at: Date.now(),
        });
        return v.id;
      }
    }
    // safety fallback: last variant
    const last = all[all.length - 1];
    if (!last) throw new Error('EXPERIMENT_NO_VARIANTS');
    this.logEvent({
      action: 'ASSIGN',
      detail: `${expId}/${sessionId}/${last.id}`,
      at: Date.now(),
    });
    return last.id;
  }

  recordResult(expId: string, result: TrialResult): void {
    const exp = this.getExp(expId);
    if (exp.status !== 'running') {
      throw new Error('EXPERIMENT_NOT_RUNNING');
    }
    const all = [exp.control, ...exp.variants];
    if (!all.some((v) => v.id === result.variantId)) {
      throw new Error('EXPERIMENT_VARIANT_UNKNOWN');
    }
    if (
      result.quality < 0 ||
      result.quality > 1 ||
      result.latencyMs < 0
    ) {
      throw new Error('EXPERIMENT_RESULT_INVALID');
    }
    exp.trials.push({ ...result });
    this.logEvent({
      action: 'RECORD',
      detail: `${expId}/${result.variantId}/${result.quality.toFixed(3)}`,
      at: Date.now(),
    });
  }

  stats(expId: string): VariantStats[] {
    const exp = this.getExp(expId);
    const all = [exp.control, ...exp.variants];
    return all.map((v) => {
      const rows = exp.trials.filter((t) => t.variantId === v.id);
      const n = rows.length;
      if (n === 0) {
        return {
          variantId: v.id,
          n: 0,
          avgQuality: 0,
          avgLatency: 0,
          successRate: 0,
        };
      }
      const avgQuality = rows.reduce((s, r) => s + r.quality, 0) / n;
      const avgLatency = rows.reduce((s, r) => s + r.latencyMs, 0) / n;
      const succ = rows.filter((r) => r.success).length;
      return {
        variantId: v.id,
        n,
        avgQuality,
        avgLatency,
        successRate: succ / n,
      };
    });
  }

  conclude(expId: string): Verdict {
    const exp = this.getExp(expId);
    const stats = this.stats(expId);
    const controlStats = stats.find((s) => s.variantId === exp.control.id);
    if (!controlStats) {
      throw new Error('EXPERIMENT_CONTROL_MISSING');
    }

    const insufficient = stats.some((s) => s.n < exp.minSamples);
    if (insufficient) {
      return {
        status: 'running',
        reason: 'MIN_SAMPLES_NOT_MET',
        stats,
      };
    }

    // find best variant (non-control) by quality
    const nonControl = stats.filter((s) => s.variantId !== exp.control.id);
    const best = nonControl.reduce<VariantStats | undefined>((acc, cur) => {
      if (!acc) return cur;
      return cur.avgQuality > acc.avgQuality ? cur : acc;
    }, undefined);

    let winner: string | undefined;
    let reason = 'INCONCLUSIVE';
    if (best) {
      if (best.avgQuality - controlStats.avgQuality >= QUALITY_DELTA) {
        winner = best.variantId;
        reason = 'VARIANT_BETTER';
      } else if (controlStats.avgQuality - best.avgQuality >= QUALITY_DELTA) {
        winner = exp.control.id;
        reason = 'CONTROL_BETTER';
      }
    } else {
      winner = exp.control.id;
      reason = 'NO_VARIANTS';
    }

    exp.status = 'concluded';
    const verdict: Verdict = {
      status: 'concluded',
      reason,
      stats,
    };
    if (winner !== undefined) {
      verdict.winner = winner;
    }

    this.logEvent({
      action: 'CONCLUDE',
      detail: `${expId}/${winner ?? 'none'}/${reason}`,
      at: Date.now(),
    });
    return verdict;
  }

  getAuditLog(): AuditEvent[] {
    return this.audit.map((e) => ({ ...e }));
  }

  // ── 내부 ─────────────────────────────────────────────────────────────────
  private logEvent(ev: AuditEvent): void {
    this.audit.push(ev);
  }

  private getExp(id: string): ExperimentState {
    const exp = this.experiments.get(id);
    if (!exp) throw new Error('EXPERIMENT_NOT_FOUND');
    return exp;
  }

  private fnv1a(text: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    return hash >>> 0;
  }
}
