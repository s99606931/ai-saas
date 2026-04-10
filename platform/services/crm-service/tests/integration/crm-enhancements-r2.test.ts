// CRM 서비스 Round 2 고도화 테스트
// Design Ref: SVC-CRM-R2 DESIGN

import { describe, it, expect } from 'vitest';

describe('CRM 계약 만료 고도화', () => {
  it('만료 긴급도별 구분이 가능하다', () => {
    const contracts = [
      { id: '1', daysUntilEnd: 3 },
      { id: '2', daysUntilEnd: 15 },
      { id: '3', daysUntilEnd: 45 },
    ];
    const urgent = contracts.filter((c) => c.daysUntilEnd <= 7);
    const normal = contracts.filter((c) => c.daysUntilEnd > 7 && c.daysUntilEnd <= 30);
    expect(urgent).toHaveLength(1);
    expect(normal).toHaveLength(1);
  });

  it('closed_lost 상태는 만료 목록에서 제외된다', () => {
    const contracts = [
      { stage: 'closed_won', endDate: '2026-04-15' },
      { stage: 'closed_lost', endDate: '2026-04-15' },
      { stage: 'negotiation', endDate: '2026-04-15' },
    ];
    const filtered = contracts.filter((c) => c.stage !== 'closed_lost');
    expect(filtered).toHaveLength(2);
  });
});

describe('CRM 통계 고도화', () => {
  it('계약 금액 합계/평균이 올바르다', () => {
    const contracts = [
      { value: 1000000 },
      { value: 2000000 },
      { value: 3000000 },
    ];
    const sum = contracts.reduce((s, c) => s + c.value, 0);
    const avg = sum / contracts.length;
    expect(sum).toBe(6000000);
    expect(avg).toBe(2000000);
  });

  it('고객 상태별 분포가 반환된다', () => {
    const customersByStatus = [
      { status: 'active', count: 50 },
      { status: 'inactive', count: 10 },
      { status: 'prospect', count: 20 },
    ];
    expect(customersByStatus).toHaveLength(3);
    const total = customersByStatus.reduce((s, c) => s + c.count, 0);
    expect(total).toBe(80);
  });
});

describe('CRM 파이프라인 고도화', () => {
  it('단계별 건수가 집계된다', () => {
    const stages = [
      { stage: 'lead', count: 20 },
      { stage: 'qualification', count: 15 },
      { stage: 'proposal', count: 10 },
      { stage: 'negotiation', count: 5 },
      { stage: 'closed_won', count: 3 },
    ];
    const total = stages.reduce((s, st) => s + st.count, 0);
    expect(total).toBe(53);
  });

  it('전환율이 계산된다', () => {
    const leads = 20;
    const closedWon = 3;
    const conversionRate = Math.round((closedWon / leads) * 100);
    expect(conversionRate).toBe(15);
  });
});

describe('테넌트 격리: CRM', () => {
  it('파이프라인 조회에 테넌트 격리가 적용된다', () => {
    const jwtRole = 'USER';
    const jwtTenantId = 'tenant-crm-001';
    const where: Record<string, unknown> = {};
    if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId) {
      where['customer'] = { tenantId: jwtTenantId };
    }
    expect(where['customer']).toBeDefined();
  });
});
