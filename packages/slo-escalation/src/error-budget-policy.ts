/**
 * SRE 에러 버짓 정책 엔진
 * Design Ref: docs/02-design/mtus/MTU-N255-sre-error-budget.design.md §1~§2
 * Plan SC: FR-N255.SC-1, FR-N255.SC-2
 *
 * 에러 버짓 소진율 추적, 소진 예측, 자동 배포 동결 판정
 * CSAP D-06 침해사고 관리 준수
 */

import { z } from 'zod';

/** 에러 버짓 상태 */
export enum BudgetStatus {
  /** 정상 (50% 미만 소진) */
  Healthy = 'healthy',
  /** 주의 (50~75% 소진) */
  Caution = 'caution',
  /** 경고 (75~90% 소진) */
  Warning = 'warning',
  /** 위험 (90~100% 소진) */
  Danger = 'danger',
  /** 소진 (100% 초과 — 배포 동결) */
  Exhausted = 'exhausted',
}

/** 자동 액션 유형 */
export enum AutoAction {
  /** 알림만 전송 */
  Notify = 'notify',
  /** 배포 동결 권고 */
  FreezeRecommend = 'freeze_recommend',
  /** 배포 자동 동결 */
  FreezeEnforce = 'freeze_enforce',
  /** 에스컬레이션 */
  Escalate = 'escalate',
  /** 포스트모템 생성 */
  CreatePostmortem = 'create_postmortem',
}

/** SLO 정의 */
export interface SLODefinition {
  /** SLO 이름 */
  name: string;
  /** 서비스 이름 */
  service: string;
  /** 목표 가용률 (0.0 ~ 1.0, 예: 0.999 = 99.9%) */
  target: number;
  /** 측정 기간 (일) */
  windowDays: number;
  /** 현재 가용률 */
  currentAvailability: number;
}

/** 에러 버짓 계산 결과 */
export interface ErrorBudgetResult {
  /** SLO 정의 */
  slo: SLODefinition;
  /** 전체 에러 버짓 (분) */
  totalBudgetMinutes: number;
  /** 소진된 에러 버짓 (분) */
  consumedMinutes: number;
  /** 잔여 에러 버짓 (분) */
  remainingMinutes: number;
  /** 소진율 (%) */
  burnRate: number;
  /** 현재 상태 */
  status: BudgetStatus;
  /** 소진 예측일 */
  projectedExhaustionDate: string | null;
  /** 자동 액션 목록 */
  actions: AutoAction[];
  /** 계산 시각 */
  calculatedAt: string;
}

/** 정책 설정 스키마 (Zod 검증 — CSAP D-12) */
const PolicyConfigSchema = z.object({
  /** 배포 동결 임계값 (소진율 %) */
  freezeThreshold: z.number().min(0).max(100).default(90),
  /** 배포 동결 강제 임계값 (소진율 %) */
  enforceThreshold: z.number().min(0).max(200).default(100),
  /** 에스컬레이션 임계값 (소진율 %) */
  escalateThreshold: z.number().min(0).max(200).default(100),
  /** 포스트모템 자동 생성 임계값 (소진율 %) */
  postmortemThreshold: z.number().min(0).max(200).default(100),
  /** 소진 예측 시 사용할 기간 (일) */
  projectionDays: z.number().min(1).max(90).default(30),
});

export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

/** 온콜 에스컬레이션 레벨 */
export interface OnCallLevel {
  /** 레벨 (P1~P4) */
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  /** 응답 시간 제한 (분) */
  responseTimeMinutes: number;
  /** 에스컬레이션 대기 시간 (분) */
  escalationWaitMinutes: number;
  /** 알림 대상 */
  targets: string[];
  /** 알림 채널 */
  channels: string[];
}

/** 온콜 에스컬레이션 결과 */
export interface OnCallEscalationResult {
  /** 인시던트 ID */
  incidentId: string;
  /** 우선순위 */
  priority: string;
  /** 에스컬레이션 레벨 */
  currentLevel: number;
  /** 알림된 대상 */
  notifiedTargets: string[];
  /** 에스컬레이션 시각 */
  escalatedAt: string;
  /** 다음 에스컬레이션 시각 */
  nextEscalationAt: string | null;
}

/**
 * 기본 온콜 에스컬레이션 정책
 * Design Ref: §SC-3 — P1→5분, P2→30분, P3→4시간
 */
const DEFAULT_ONCALL_LEVELS: OnCallLevel[] = [
  {
    priority: 'P1',
    responseTimeMinutes: 5,
    escalationWaitMinutes: 5,
    targets: ['oncall-primary', 'oncall-secondary', 'engineering-manager'],
    channels: ['slack', 'pagerduty', 'phone'],
  },
  {
    priority: 'P2',
    responseTimeMinutes: 30,
    escalationWaitMinutes: 30,
    targets: ['oncall-primary', 'oncall-secondary'],
    channels: ['slack', 'pagerduty'],
  },
  {
    priority: 'P3',
    responseTimeMinutes: 240,
    escalationWaitMinutes: 240,
    targets: ['oncall-primary'],
    channels: ['slack', 'email'],
  },
  {
    priority: 'P4',
    responseTimeMinutes: 1440,
    escalationWaitMinutes: 1440,
    targets: ['team-channel'],
    channels: ['slack'],
  },
];

export class ErrorBudgetPolicyEngine {
  private readonly config: PolicyConfig;
  private readonly oncallLevels: OnCallLevel[];
  private budgetHistory: ErrorBudgetResult[] = [];
  private escalationHistory: OnCallEscalationResult[] = [];
  private deployFreezeActive = false;
  private readonly maxHistory = 10000;

  constructor(config?: Partial<PolicyConfig>, oncallLevels?: OnCallLevel[]) {
    this.config = PolicyConfigSchema.parse(config || {});
    this.oncallLevels = oncallLevels || DEFAULT_ONCALL_LEVELS;
  }

  /**
   * 에러 버짓 계산
   * Design Ref: §SC-1 — 소진율, 잔여량, 소진 예측
   */
  calculateErrorBudget(slo: SLODefinition): ErrorBudgetResult {
    // 전체 에러 버짓 = (1 - target) * window_days * 24 * 60 (분)
    const totalBudgetMinutes = (1 - slo.target) * slo.windowDays * 24 * 60;

    // 실제 다운타임 = (1 - currentAvailability) * window_days * 24 * 60 (분)
    const consumedMinutes = (1 - slo.currentAvailability) * slo.windowDays * 24 * 60;

    // 잔여 에러 버짓
    const remainingMinutes = Math.max(0, totalBudgetMinutes - consumedMinutes);

    // 소진율 (%)
    const burnRate = totalBudgetMinutes > 0 ? (consumedMinutes / totalBudgetMinutes) * 100 : 0;

    // 상태 판정
    const status = this.determineBudgetStatus(burnRate);

    // 소진 예측일
    const projectedExhaustionDate = this.projectExhaustionDate(consumedMinutes, totalBudgetMinutes, slo.windowDays);

    // 자동 액션 결정
    const actions = this.determineActions(burnRate);

    // 배포 동결 상태 업데이트
    if (burnRate >= this.config.enforceThreshold) {
      this.deployFreezeActive = true;
    } else if (burnRate < this.config.freezeThreshold) {
      this.deployFreezeActive = false;
    }

    const result: ErrorBudgetResult = {
      slo,
      totalBudgetMinutes: Math.round(totalBudgetMinutes * 100) / 100,
      consumedMinutes: Math.round(consumedMinutes * 100) / 100,
      remainingMinutes: Math.round(remainingMinutes * 100) / 100,
      burnRate: Math.round(burnRate * 100) / 100,
      status,
      projectedExhaustionDate,
      actions,
      calculatedAt: new Date().toISOString(),
    };

    // 히스토리 저장
    this.budgetHistory.push(result);
    if (this.budgetHistory.length > this.maxHistory) {
      this.budgetHistory = this.budgetHistory.slice(-this.maxHistory);
    }

    return result;
  }

  /**
   * 온콜 에스컬레이션 실행
   * Design Ref: §SC-3 — P1→5분, P2→30분, P3→4시간
   */
  escalateOnCall(
    incidentId: string,
    priority: 'P1' | 'P2' | 'P3' | 'P4',
    currentLevel: number = 0,
  ): OnCallEscalationResult {
    const level = this.oncallLevels.find((l) => l.priority === priority);

    if (!level) {
      return {
        incidentId,
        priority,
        currentLevel,
        notifiedTargets: [],
        escalatedAt: new Date().toISOString(),
        nextEscalationAt: null,
      };
    }

    const now = new Date();
    const nextEscalation = new Date(now.getTime() + level.escalationWaitMinutes * 60 * 1000);

    const result: OnCallEscalationResult = {
      incidentId,
      priority,
      currentLevel: currentLevel + 1,
      notifiedTargets: level.targets,
      escalatedAt: now.toISOString(),
      nextEscalationAt: nextEscalation.toISOString(),
    };

    // 히스토리 저장
    this.escalationHistory.push(result);
    if (this.escalationHistory.length > this.maxHistory) {
      this.escalationHistory = this.escalationHistory.slice(-this.maxHistory);
    }

    return result;
  }

  /**
   * 배포 동결 상태 확인
   */
  isDeployFrozen(): boolean {
    return this.deployFreezeActive;
  }

  /**
   * 에러 버짓 히스토리 조회
   */
  getBudgetHistory(service?: string, limit: number = 100): ErrorBudgetResult[] {
    let results = this.budgetHistory;
    if (service) {
      results = results.filter((r) => r.slo.service === service);
    }
    return results.slice(-limit);
  }

  /**
   * 에스컬레이션 히스토리 조회
   */
  getEscalationHistory(limit: number = 100): OnCallEscalationResult[] {
    return this.escalationHistory.slice(-limit);
  }

  /**
   * 온콜 정책 조회
   */
  getOnCallPolicy(priority: 'P1' | 'P2' | 'P3' | 'P4'): OnCallLevel | undefined {
    return this.oncallLevels.find((l) => l.priority === priority);
  }

  /**
   * 버짓 상태 판정
   */
  private determineBudgetStatus(burnRate: number): BudgetStatus {
    if (burnRate >= 100) return BudgetStatus.Exhausted;
    if (burnRate >= 90) return BudgetStatus.Danger;
    if (burnRate >= 75) return BudgetStatus.Warning;
    if (burnRate >= 50) return BudgetStatus.Caution;
    return BudgetStatus.Healthy;
  }

  /**
   * 자동 액션 결정
   */
  private determineActions(burnRate: number): AutoAction[] {
    const actions: AutoAction[] = [];

    if (burnRate >= 50) {
      actions.push(AutoAction.Notify);
    }

    if (burnRate >= this.config.freezeThreshold) {
      actions.push(AutoAction.FreezeRecommend);
    }

    if (burnRate >= this.config.enforceThreshold) {
      actions.push(AutoAction.FreezeEnforce);
    }

    if (burnRate >= this.config.escalateThreshold) {
      actions.push(AutoAction.Escalate);
    }

    if (burnRate >= this.config.postmortemThreshold) {
      actions.push(AutoAction.CreatePostmortem);
    }

    return actions;
  }

  /**
   * 소진 예측일 계산
   */
  private projectExhaustionDate(consumed: number, total: number, windowDays: number): string | null {
    if (consumed <= 0 || total <= 0) return null;
    if (consumed >= total) return new Date().toISOString();

    // 현재 소진 속도 기준 잔여 에러 버짓 소진 예측
    const dailyBurnRate = consumed / windowDays;
    if (dailyBurnRate <= 0) return null;

    const daysUntilExhaustion = (total - consumed) / dailyBurnRate;
    const projectedDate = new Date(Date.now() + daysUntilExhaustion * 24 * 60 * 60 * 1000);

    return projectedDate.toISOString();
  }
}
