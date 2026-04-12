// 개발 환경 자동 프로비저닝 AI — FR-N406.1~5

export interface ResourceRequest {
  cpu: number;
  memoryGb: number;
  storageGb: number;
}

export interface DevEnvProfile {
  id: string;
  name: string;
  runtime: 'node' | 'python' | 'java' | 'go';
  services: Array<'postgres' | 'redis' | 'kafka' | 'minio'>;
  resources: ResourceRequest;
  lifetimeHours: number;
}

export interface ProvisionPlan {
  id: string;
  profileId: string;
  requesterId: string;
  status: 'pending' | 'active' | 'terminated';
  createdAt: string;
  expiresAt: string;
  steps: string[];
  resources: ResourceRequest;
}

export interface TenantQuota {
  tenantId: string;
  maxCpu: number;
  maxMemoryGb: number;
  maxStorageGb: number;
  maxActiveEnvs: number;
}

export class DevEnvProvisioner {
  private readonly profiles = new Map<string, DevEnvProfile>();
  private readonly plans = new Map<string, ProvisionPlan>();
  private readonly quotas = new Map<string, TenantQuota>();

  registerProfile(profile: DevEnvProfile): void {
    if (profile.lifetimeHours <= 0) throw new Error('DEVENV_INVALID_LIFETIME');
    this.profiles.set(profile.id, profile);
  }

  setQuota(quota: TenantQuota): void {
    this.quotas.set(quota.tenantId, quota);
  }

  provision(planId: string, tenantId: string, requesterId: string, profileId: string): ProvisionPlan {
    const profile = this.profiles.get(profileId);
    if (!profile) throw new Error('DEVENV_PROFILE_NOT_FOUND');
    const quota = this.quotas.get(tenantId);
    if (!quota) throw new Error('DEVENV_QUOTA_NOT_FOUND');
    this.checkQuota(tenantId, quota, profile.resources);
    const now = new Date();
    const expires = new Date(now.getTime() + profile.lifetimeHours * 3600_000);
    const plan: ProvisionPlan = {
      id: planId,
      profileId,
      requesterId,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      steps: this.buildSteps(profile),
      resources: profile.resources,
    };
    this.plans.set(planId, plan);
    return plan;
  }

  activate(planId: string): ProvisionPlan {
    const plan = this.requirePlan(planId);
    if (plan.status !== 'pending') throw new Error('DEVENV_INVALID_STATE');
    plan.status = 'active';
    return plan;
  }

  terminate(planId: string): ProvisionPlan {
    const plan = this.requirePlan(planId);
    plan.status = 'terminated';
    return plan;
  }

  reapExpired(now: Date = new Date()): string[] {
    const reaped: string[] = [];
    for (const plan of this.plans.values()) {
      if (plan.status === 'active' && plan.expiresAt <= now.toISOString()) {
        plan.status = 'terminated';
        reaped.push(plan.id);
      }
    }
    return reaped;
  }

  usage(tenantId: string): { activeEnvs: number; cpuUsed: number; memoryUsed: number; storageUsed: number } {
    let activeEnvs = 0;
    let cpuUsed = 0;
    let memoryUsed = 0;
    let storageUsed = 0;
    for (const plan of this.plans.values()) {
      if (plan.status !== 'active') continue;
      const profile = this.profiles.get(plan.profileId);
      if (!profile) continue;
      const profileTenant = this.findTenantByPlan(plan.id, tenantId);
      if (!profileTenant) continue;
      activeEnvs += 1;
      cpuUsed += plan.resources.cpu;
      memoryUsed += plan.resources.memoryGb;
      storageUsed += plan.resources.storageGb;
    }
    return { activeEnvs, cpuUsed, memoryUsed, storageUsed };
  }

  private findTenantByPlan(_planId: string, tenantId: string): string | undefined {
    return tenantId;
  }

  private buildSteps(profile: DevEnvProfile): string[] {
    const steps = [`프로비저닝 시작: ${profile.name}`, `런타임 ${profile.runtime} 설치`];
    for (const svc of profile.services) steps.push(`서비스 ${svc} 배포`);
    steps.push('헬스체크 실행', '접속정보 발급');
    return steps;
  }

  private checkQuota(tenantId: string, quota: TenantQuota, req: ResourceRequest): void {
    const activeCount = Array.from(this.plans.values()).filter(
      (p) => p.status === 'active' || p.status === 'pending',
    ).length;
    if (activeCount >= quota.maxActiveEnvs) {
      throw new Error('DEVENV_MAX_ENVS_EXCEEDED');
    }
    if (req.cpu > quota.maxCpu || req.memoryGb > quota.maxMemoryGb || req.storageGb > quota.maxStorageGb) {
      throw new Error('DEVENV_QUOTA_EXCEEDED');
    }
    // tenantId 사용 (감사 로그 키로 예비)
    if (tenantId.length === 0) throw new Error('DEVENV_INVALID_TENANT');
  }

  private requirePlan(id: string): ProvisionPlan {
    const plan = this.plans.get(id);
    if (!plan) throw new Error('DEVENV_PLAN_NOT_FOUND');
    return plan;
  }
}
