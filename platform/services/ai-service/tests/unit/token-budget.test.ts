// SVC-AI-ADV-R8 단위 테스트: 토큰 예산 관리
// Design Ref: SVC-AI-ADV-R8 DESIGN §3
// Plan SC: FR-ADV8.5
// CSAP: D-10, D-08

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenBudgetManager, createTokenBudgetManager } from '../../src/lib/token-budget.js';
import type { BudgetCheckResult, BudgetStatus } from '../../src/lib/token-budget.js';

describe('TokenBudgetManager 예산 설정', () => {
  let manager: TokenBudgetManager;

  beforeEach(() => {
    manager = new TokenBudgetManager();
  });

  it('테넌트 예산을 설정한다', () => {
    manager.setBudget('tenant-1', { dailyBudgetTokens: 50_000, monthlyBudgetTokens: 1_000_000 });
    const status = manager.getStatus('tenant-1');
    expect(status.dailyBudget).toBe(50_000);
    expect(status.monthlyBudget).toBe(1_000_000);
  });

  it('기본 예산 값이 적용된다', () => {
    const status = manager.getStatus('tenant-new');
    expect(status.dailyBudget).toBe(100_000);
    expect(status.monthlyBudget).toBe(2_000_000);
  });

  it('경고 임계값을 설정한다', () => {
    manager.setBudget('tenant-1', { alertThreshold: 0.9 });
    const status = manager.getStatus('tenant-1');
    expect(status.alertThreshold).toBe(0.9);
  });
});

describe('TokenBudgetManager 예산 확인 (FR-ADV8.5)', () => {
  let manager: TokenBudgetManager;

  beforeEach(() => {
    manager = new TokenBudgetManager();
    manager.setBudget('tenant-1', {
      dailyBudgetTokens: 10_000,
      monthlyBudgetTokens: 100_000,
      alertThreshold: 0.8,
    });
  });

  it('예산 내이면 allowed: true를 반환한다', () => {
    const result = manager.checkBudget('tenant-1', 500);
    expect(result.allowed).toBe(true);
    expect(result.warning).toBe(false);
  });

  it('일일 한도 초과 시 차단한다', () => {
    manager.recordUsage('tenant-1', 9_500);
    const result = manager.checkBudget('tenant-1', 600);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('일일');
  });

  it('월간 한도 초과 시 차단한다', () => {
    manager.setBudget('tenant-1', {
      dailyBudgetTokens: 1_000_000, // 일일은 넉넉하게
      monthlyBudgetTokens: 10_000,
      alertThreshold: 0.8,
    });
    manager.recordUsage('tenant-1', 9_500);
    const result = manager.checkBudget('tenant-1', 600);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('월간');
  });

  it('80% 사용 시 경고를 발생한다', () => {
    manager.recordUsage('tenant-1', 8_100);
    const result = manager.checkBudget('tenant-1', 0);
    expect(result.warning).toBe(true);
    expect(result.warningMessage).toContain('%');
  });

  it('잔여 토큰을 계산한다', () => {
    manager.recordUsage('tenant-1', 3_000);
    const result = manager.checkBudget('tenant-1');
    expect(result.dailyRemaining).toBe(7_000);
  });

  it('사용 비율을 계산한다', () => {
    manager.recordUsage('tenant-1', 5_000);
    const result = manager.checkBudget('tenant-1');
    expect(result.dailyUsageRatio).toBe(0.5);
  });

  it('선제 차단: 예상 토큰 포함하여 판단한다', () => {
    manager.recordUsage('tenant-1', 9_000);
    // 9000 + 1500 > 10000 → 차단
    const result = manager.checkBudget('tenant-1', 1_500);
    expect(result.allowed).toBe(false);
  });
});

describe('TokenBudgetManager 사용량 기록', () => {
  let manager: TokenBudgetManager;

  beforeEach(() => {
    manager = new TokenBudgetManager();
    manager.setBudget('tenant-1', { dailyBudgetTokens: 100_000, monthlyBudgetTokens: 2_000_000 });
  });

  it('토큰 사용량을 누적한다', () => {
    manager.recordUsage('tenant-1', 1_000);
    manager.recordUsage('tenant-1', 2_000);
    const status = manager.getStatus('tenant-1');
    expect(status.dailyUsed).toBe(3_000);
  });

  it('테넌트별 독립적으로 기록한다', () => {
    manager.setBudget('tenant-2', { dailyBudgetTokens: 100_000, monthlyBudgetTokens: 2_000_000 });
    manager.recordUsage('tenant-1', 1_000);
    manager.recordUsage('tenant-2', 5_000);
    expect(manager.getStatus('tenant-1').dailyUsed).toBe(1_000);
    expect(manager.getStatus('tenant-2').dailyUsed).toBe(5_000);
  });
});

describe('TokenBudgetManager 콜백', () => {
  it('차단 시 onBlocked 콜백을 호출한다', () => {
    const manager = new TokenBudgetManager();
    manager.setBudget('tenant-1', { dailyBudgetTokens: 100, monthlyBudgetTokens: 10_000 });
    const blockedFn = vi.fn();
    manager.onBlocked = blockedFn;

    manager.recordUsage('tenant-1', 90);
    manager.checkBudget('tenant-1', 20);
    expect(blockedFn).toHaveBeenCalledWith('tenant-1', expect.stringContaining('일일'));
  });

  it('경고 시 onWarning 콜백을 호출한다', () => {
    const manager = new TokenBudgetManager();
    manager.setBudget('tenant-1', { dailyBudgetTokens: 100, monthlyBudgetTokens: 10_000, alertThreshold: 0.8 });
    const warningFn = vi.fn();
    manager.onWarning = warningFn;

    manager.recordUsage('tenant-1', 85);
    manager.checkBudget('tenant-1', 0);
    expect(warningFn).toHaveBeenCalled();
  });
});

describe('TokenBudgetManager 현황 조회', () => {
  it('예산 현황을 반환한다', () => {
    const manager = new TokenBudgetManager();
    manager.setBudget('tenant-1', { dailyBudgetTokens: 50_000, monthlyBudgetTokens: 1_000_000 });
    manager.recordUsage('tenant-1', 10_000);

    const status = manager.getStatus('tenant-1');
    expect(status.tenantId).toBe('tenant-1');
    expect(status.dailyBudget).toBe(50_000);
    expect(status.dailyUsed).toBe(10_000);
    expect(status.dailyRemaining).toBe(40_000);
    expect(status.isWarning).toBe(false);
    expect(status.isBlocked).toBe(false);
  });

  it('한도 초과 시 isBlocked가 true다', () => {
    const manager = new TokenBudgetManager();
    manager.setBudget('tenant-1', { dailyBudgetTokens: 100, monthlyBudgetTokens: 10_000 });
    manager.recordUsage('tenant-1', 150);

    const status = manager.getStatus('tenant-1');
    expect(status.isBlocked).toBe(true);
  });

  it('경고 임계값 초과 시 isWarning이 true다', () => {
    const manager = new TokenBudgetManager();
    manager.setBudget('tenant-1', { dailyBudgetTokens: 100, monthlyBudgetTokens: 10_000, alertThreshold: 0.8 });
    manager.recordUsage('tenant-1', 85);

    const status = manager.getStatus('tenant-1');
    expect(status.isWarning).toBe(true);
  });
});

describe('TokenBudgetManager 리셋', () => {
  it('resetDaily로 일일 사용량을 초기화한다', () => {
    const manager = new TokenBudgetManager();
    manager.setBudget('tenant-1', { dailyBudgetTokens: 100_000, monthlyBudgetTokens: 2_000_000 });
    manager.recordUsage('tenant-1', 50_000);
    manager.resetDaily();
    const status = manager.getStatus('tenant-1');
    expect(status.dailyUsed).toBe(0);
  });
});

describe('createTokenBudgetManager 팩토리', () => {
  it('TokenBudgetManager 인스턴스를 생성한다', () => {
    const manager = createTokenBudgetManager();
    expect(manager).toBeInstanceOf(TokenBudgetManager);
  });
});
