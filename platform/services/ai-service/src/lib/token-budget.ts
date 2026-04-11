// 토큰 예산 관리 — FR-ADV8.5
// Design Ref: SVC-AI-ADV-R8 DESIGN §3
// Plan SC: SC-3 (테넌트별 일/월 예산 설정 및 선제 차단)
// CSAP: D-10 리소스 사용량 제한, D-08 접근 통제 (테넌트 격리)

// ── 예산 타입 ────────────────────────────────────────────────────────────────

/** 테넌트 예산 설정 */
export interface TenantBudget {
  tenantId: string;
  /** 일일 토큰 한도 */
  dailyBudgetTokens: number;
  /** 월간 토큰 한도 */
  monthlyBudgetTokens: number;
  /** 경고 임계값 (0.0~1.0, 기본 0.8 = 80%) */
  alertThreshold: number;
}

/** 사용량 레코드 */
interface UsageRecord {
  /** 일일 사용량 (날짜 키 → 토큰 수) */
  daily: Map<string, number>;
  /** 월간 사용량 (연-월 키 → 토큰 수) */
  monthly: Map<string, number>;
  /** 마지막 업데이트 */
  lastUpdated: number;
}

/** 예산 확인 결과 */
export interface BudgetCheckResult {
  /** 허용 여부 */
  allowed: boolean;
  /** 차단 사유 (차단 시) */
  reason?: string;
  /** 경고 여부 (임계값 도달) */
  warning: boolean;
  /** 경고 메시지 */
  warningMessage?: string;
  /** 일일 잔여 토큰 */
  dailyRemaining: number;
  /** 월간 잔여 토큰 */
  monthlyRemaining: number;
  /** 일일 사용 비율 (0.0~1.0) */
  dailyUsageRatio: number;
  /** 월간 사용 비율 (0.0~1.0) */
  monthlyUsageRatio: number;
}

/** 예산 현황 */
export interface BudgetStatus {
  tenantId: string;
  dailyBudget: number;
  monthlyBudget: number;
  dailyUsed: number;
  monthlyUsed: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  alertThreshold: number;
  isWarning: boolean;
  isBlocked: boolean;
}

// ── 기본 설정 ────────────────────────────────────────────────────────────────

const DEFAULT_DAILY_BUDGET = 100_000;   // 10만 토큰/일
const DEFAULT_MONTHLY_BUDGET = 2_000_000; // 200만 토큰/월
const DEFAULT_ALERT_THRESHOLD = 0.8;

// ── 토큰 예산 관리자 ─────────────────────────────────────────────────────────

/**
 * 토큰 예산 관리자
 *
 * 테넌트별로 일일/월간 토큰 사용량을 추적하고 한도를 초과하면 선제 차단합니다.
 *
 * 특징:
 * - 테넌트별 개별 예산 설정
 * - 일일/월간 이중 한도
 * - 80% 경고 알림
 * - 예상 토큰 수 기반 선제 차단
 * - 자동 일/월 리셋
 */
export class TokenBudgetManager {
  private readonly budgets: Map<string, TenantBudget> = new Map();
  private readonly usage: Map<string, UsageRecord> = new Map();

  /** 콜백: 경고 임계값 도달 시 */
  onWarning?: (tenantId: string, message: string) => void;
  /** 콜백: 차단 시 */
  onBlocked?: (tenantId: string, reason: string) => void;

  /**
   * 테넌트 예산을 설정합니다
   */
  setBudget(tenantId: string, budget: Partial<Omit<TenantBudget, 'tenantId'>>): void {
    this.budgets.set(tenantId, {
      tenantId,
      dailyBudgetTokens: budget.dailyBudgetTokens ?? DEFAULT_DAILY_BUDGET,
      monthlyBudgetTokens: budget.monthlyBudgetTokens ?? DEFAULT_MONTHLY_BUDGET,
      alertThreshold: budget.alertThreshold ?? DEFAULT_ALERT_THRESHOLD,
    });
  }

  /**
   * 테넌트 예산을 확인합니다 (요청 전 호출)
   *
   * @param tenantId - 테넌트 ID
   * @param estimatedTokens - 예상 토큰 수 (선제 차단용)
   * @returns 예산 확인 결과
   */
  checkBudget(tenantId: string, estimatedTokens: number = 0): BudgetCheckResult {
    const budget = this.budgets.get(tenantId) ?? {
      tenantId,
      dailyBudgetTokens: DEFAULT_DAILY_BUDGET,
      monthlyBudgetTokens: DEFAULT_MONTHLY_BUDGET,
      alertThreshold: DEFAULT_ALERT_THRESHOLD,
    };

    const todayKey = getTodayKey();
    const monthKey = getMonthKey();
    const usageRecord = this.getOrCreateUsage(tenantId);

    const dailyUsed = usageRecord.daily.get(todayKey) ?? 0;
    const monthlyUsed = usageRecord.monthly.get(monthKey) ?? 0;

    const dailyRemaining = Math.max(0, budget.dailyBudgetTokens - dailyUsed);
    const monthlyRemaining = Math.max(0, budget.monthlyBudgetTokens - monthlyUsed);

    const dailyUsageRatio = budget.dailyBudgetTokens > 0 ? dailyUsed / budget.dailyBudgetTokens : 0;
    const monthlyUsageRatio = budget.monthlyBudgetTokens > 0 ? monthlyUsed / budget.monthlyBudgetTokens : 0;

    // 선제 차단: 예상 토큰을 포함하면 한도 초과
    const dailyAfter = dailyUsed + estimatedTokens;
    const monthlyAfter = monthlyUsed + estimatedTokens;

    // 일일 한도 차단
    if (dailyAfter > budget.dailyBudgetTokens) {
      const reason = `일일 토큰 한도 초과 (${dailyUsed.toLocaleString()}/${budget.dailyBudgetTokens.toLocaleString()}, 예상 추가: ${estimatedTokens.toLocaleString()})`;
      this.onBlocked?.(tenantId, reason);
      return {
        allowed: false,
        reason,
        warning: true,
        dailyRemaining,
        monthlyRemaining,
        dailyUsageRatio,
        monthlyUsageRatio,
      };
    }

    // 월간 한도 차단
    if (monthlyAfter > budget.monthlyBudgetTokens) {
      const reason = `월간 토큰 한도 초과 (${monthlyUsed.toLocaleString()}/${budget.monthlyBudgetTokens.toLocaleString()}, 예상 추가: ${estimatedTokens.toLocaleString()})`;
      this.onBlocked?.(tenantId, reason);
      return {
        allowed: false,
        reason,
        warning: true,
        dailyRemaining,
        monthlyRemaining,
        dailyUsageRatio,
        monthlyUsageRatio,
      };
    }

    // 경고 확인
    let warning = false;
    let warningMessage: string | undefined;

    if (dailyUsageRatio >= budget.alertThreshold) {
      warning = true;
      warningMessage = `일일 토큰 사용량 ${(dailyUsageRatio * 100).toFixed(1)}% 도달 (${dailyUsed.toLocaleString()}/${budget.dailyBudgetTokens.toLocaleString()})`;
      this.onWarning?.(tenantId, warningMessage);
    } else if (monthlyUsageRatio >= budget.alertThreshold) {
      warning = true;
      warningMessage = `월간 토큰 사용량 ${(monthlyUsageRatio * 100).toFixed(1)}% 도달 (${monthlyUsed.toLocaleString()}/${budget.monthlyBudgetTokens.toLocaleString()})`;
      this.onWarning?.(tenantId, warningMessage);
    }

    return {
      allowed: true,
      warning,
      warningMessage,
      dailyRemaining,
      monthlyRemaining,
      dailyUsageRatio,
      monthlyUsageRatio,
    };
  }

  /**
   * 토큰 사용량을 기록합니다 (요청 후 호출)
   *
   * @param tenantId - 테넌트 ID
   * @param tokens - 실제 사용된 토큰 수
   */
  recordUsage(tenantId: string, tokens: number): void {
    const usageRecord = this.getOrCreateUsage(tenantId);
    const todayKey = getTodayKey();
    const monthKey = getMonthKey();

    usageRecord.daily.set(todayKey, (usageRecord.daily.get(todayKey) ?? 0) + tokens);
    usageRecord.monthly.set(monthKey, (usageRecord.monthly.get(monthKey) ?? 0) + tokens);
    usageRecord.lastUpdated = Date.now();
  }

  /**
   * 테넌트 예산 현황을 조회합니다
   */
  getStatus(tenantId: string): BudgetStatus {
    const budget = this.budgets.get(tenantId) ?? {
      tenantId,
      dailyBudgetTokens: DEFAULT_DAILY_BUDGET,
      monthlyBudgetTokens: DEFAULT_MONTHLY_BUDGET,
      alertThreshold: DEFAULT_ALERT_THRESHOLD,
    };

    const usageRecord = this.getOrCreateUsage(tenantId);
    const todayKey = getTodayKey();
    const monthKey = getMonthKey();

    const dailyUsed = usageRecord.daily.get(todayKey) ?? 0;
    const monthlyUsed = usageRecord.monthly.get(monthKey) ?? 0;

    const dailyRemaining = Math.max(0, budget.dailyBudgetTokens - dailyUsed);
    const monthlyRemaining = Math.max(0, budget.monthlyBudgetTokens - monthlyUsed);

    const dailyRatio = budget.dailyBudgetTokens > 0 ? dailyUsed / budget.dailyBudgetTokens : 0;
    const monthlyRatio = budget.monthlyBudgetTokens > 0 ? monthlyUsed / budget.monthlyBudgetTokens : 0;

    return {
      tenantId,
      dailyBudget: budget.dailyBudgetTokens,
      monthlyBudget: budget.monthlyBudgetTokens,
      dailyUsed,
      monthlyUsed,
      dailyRemaining,
      monthlyRemaining,
      alertThreshold: budget.alertThreshold,
      isWarning: dailyRatio >= budget.alertThreshold || monthlyRatio >= budget.alertThreshold,
      isBlocked: dailyUsed >= budget.dailyBudgetTokens || monthlyUsed >= budget.monthlyBudgetTokens,
    };
  }

  /**
   * 모든 테넌트의 현재 일자 사용량을 초기화합니다 (일일 리셋)
   */
  resetDaily(): void {
    const todayKey = getTodayKey();
    for (const usageRecord of this.usage.values()) {
      usageRecord.daily.delete(todayKey);
    }
  }

  /**
   * 오래된 사용량 기록을 정리합니다 (30일 이전)
   */
  cleanupOldRecords(): void {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffKey = thirtyDaysAgo.toISOString().slice(0, 10);

    for (const usageRecord of this.usage.values()) {
      for (const key of usageRecord.daily.keys()) {
        if (key < cutoffKey) {
          usageRecord.daily.delete(key);
        }
      }
    }
  }

  // ── 내부 메서드 ────────────────────────────────────────────────────

  private getOrCreateUsage(tenantId: string): UsageRecord {
    let record = this.usage.get(tenantId);
    if (!record) {
      record = {
        daily: new Map(),
        monthly: new Map(),
        lastUpdated: Date.now(),
      };
      this.usage.set(tenantId, record);
    }
    return record;
  }
}

// ── 유틸리티 ─────────────────────────────────────────────────────────────────

/** 오늘 날짜 키 (YYYY-MM-DD) */
function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 이번 달 키 (YYYY-MM) */
function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

/**
 * 토큰 예산 관리자 인스턴스 생성
 */
export function createTokenBudgetManager(): TokenBudgetManager {
  return new TokenBudgetManager();
}
