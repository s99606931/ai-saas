// 에이전트 버저닝/롤백 — FR-N394.1~5

export interface AgentVersion {
  agentId: string;
  version: string;
  manifest: Record<string, unknown>;
  publishedAt: string;
  rollout: number; // 0..100
  metrics: { invocations: number; errors: number };
}

export interface RolloutPlan {
  active: string;
  canary?: { version: string; weight: number };
}

export class AgentVersionRegistry {
  private readonly versions = new Map<string, AgentVersion[]>();
  private readonly plans = new Map<string, RolloutPlan>();
  private readonly autoRollbackErrorRate: number;

  constructor(autoRollbackErrorRate = 0.2) {
    if (autoRollbackErrorRate <= 0 || autoRollbackErrorRate > 1) {
      throw new Error('VERSION_INVALID_ERROR_RATE');
    }
    this.autoRollbackErrorRate = autoRollbackErrorRate;
  }

  publish(agentId: string, version: string, manifest: Record<string, unknown>): AgentVersion {
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('VERSION_INVALID_SEMVER');
    const list = this.versions.get(agentId) ?? [];
    if (list.some((v) => v.version === version)) throw new Error('VERSION_DUPLICATE');
    const entry: AgentVersion = {
      agentId,
      version,
      manifest,
      publishedAt: new Date().toISOString(),
      rollout: 0,
      metrics: { invocations: 0, errors: 0 },
    };
    list.push(entry);
    this.versions.set(agentId, list);
    if (!this.plans.has(agentId)) {
      this.plans.set(agentId, { active: version });
      entry.rollout = 100;
    }
    return entry;
  }

  startCanary(agentId: string, canaryVersion: string, weight: number): RolloutPlan {
    if (weight <= 0 || weight >= 100) throw new Error('VERSION_INVALID_WEIGHT');
    const plan = this.requirePlan(agentId);
    this.requireVersion(agentId, canaryVersion);
    plan.canary = { version: canaryVersion, weight };
    return plan;
  }

  promote(agentId: string): RolloutPlan {
    const plan = this.requirePlan(agentId);
    if (!plan.canary) throw new Error('VERSION_NO_CANARY');
    plan.active = plan.canary.version;
    plan.canary = undefined;
    return plan;
  }

  rollback(agentId: string, toVersion: string): RolloutPlan {
    this.requireVersion(agentId, toVersion);
    const plan = this.requirePlan(agentId);
    plan.active = toVersion;
    plan.canary = undefined;
    return plan;
  }

  recordInvocation(agentId: string, version: string, isError: boolean): void {
    const v = this.requireVersion(agentId, version);
    v.metrics.invocations += 1;
    if (isError) v.metrics.errors += 1;
  }

  checkAutoRollback(agentId: string): { triggered: boolean; from?: string; to?: string } {
    const plan = this.plans.get(agentId);
    if (!plan?.canary) return { triggered: false };
    const canaryVer = this.requireVersion(agentId, plan.canary.version);
    if (canaryVer.metrics.invocations < 10) return { triggered: false };
    const rate = canaryVer.metrics.errors / canaryVer.metrics.invocations;
    if (rate >= this.autoRollbackErrorRate) {
      const from = plan.canary.version;
      plan.canary = undefined;
      return { triggered: true, from, to: plan.active };
    }
    return { triggered: false };
  }

  diff(agentId: string, fromVersion: string, toVersion: string): Record<string, { from: unknown; to: unknown }> {
    const a = this.requireVersion(agentId, fromVersion);
    const b = this.requireVersion(agentId, toVersion);
    const keys = new Set([...Object.keys(a.manifest), ...Object.keys(b.manifest)]);
    const out: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of keys) {
      const fromVal = a.manifest[key];
      const toVal = b.manifest[key];
      if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
        out[key] = { from: fromVal, to: toVal };
      }
    }
    return out;
  }

  listVersions(agentId: string): AgentVersion[] {
    return this.versions.get(agentId) ?? [];
  }

  private requirePlan(agentId: string): RolloutPlan {
    const plan = this.plans.get(agentId);
    if (!plan) throw new Error('VERSION_NO_PLAN');
    return plan;
  }

  private requireVersion(agentId: string, version: string): AgentVersion {
    const list = this.versions.get(agentId) ?? [];
    const found = list.find((v) => v.version === version);
    if (!found) throw new Error('VERSION_NOT_FOUND');
    return found;
  }
}
