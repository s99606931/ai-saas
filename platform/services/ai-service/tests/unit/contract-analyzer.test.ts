import { describe, it, expect } from 'vitest';
import { parseContract, assessRisks, compareContracts, checkRenewals, getContractAuditLog } from '../../src/lib/contract-analyzer';

const SAMPLE_TEXT = `제1조(목적) 이 계약은 SaaS 서비스 제공에 관한 사항을 규정한다.
제2조(기간) 계약 기간은 시작: 2026-01-01부터 만료: 2026-12-31까지로 한다. 자동 갱신 조항이 적용된다.
제3조(대금) 총 계약금액: 120,000,000원으로 하며, 월 10,000,000원을 지급한다.
제4조(의무) 수급자는 서비스 가용률 99.5% 이상을 유지할 의무가 있다.
제5조(위약) 계약 불이행 시 위약금 10%를 부과한다.
제6조(해지) 일방적 해지가 가능하며 30일 전 통보하여야 한다.
제7조(비밀) 비밀 유지 의무는 계약 종료 후 3년간 유지된다.`;

describe('계약서 자동 분석', () => {
  it('계약서를 파싱해야 한다', () => {
    const doc = parseContract({ title: '테스트 계약', text: SAMPLE_TEXT, parties: ['갑', '을'], actor: 'admin' });
    expect(doc.clauses.length).toBeGreaterThan(0);
    expect(doc.title).toBe('테스트 계약');
  });

  it('금액을 추출해야 한다', () => {
    const doc = parseContract({ title: '금액 테스트', text: SAMPLE_TEXT, parties: ['갑', '을'], actor: 'admin' });
    expect(doc.totalAmount).toBe(120000000);
  });

  it('조항 유형을 분류해야 한다', () => {
    const doc = parseContract({ title: '분류 테스트', text: SAMPLE_TEXT, parties: ['갑', '을'], actor: 'admin' });
    const types = doc.clauses.map((c) => c.type);
    expect(types).toContain('payment');
    expect(types).toContain('duration');
  });

  it('위험 조항을 식별해야 한다', () => {
    const doc = parseContract({ title: '위험 테스트', text: SAMPLE_TEXT, parties: ['갑', '을'], actor: 'admin' });
    const risks = assessRisks(doc.id, 'analyst');
    expect(risks.length).toBeGreaterThan(0);
    // 일방적 해지, 자동 갱신 등
    expect(risks.some((r) => r.riskLevel === 'high' || r.riskLevel === 'medium')).toBe(true);
  });

  it('계약서를 비교해야 한다', () => {
    const docA = parseContract({ title: '계약A', text: SAMPLE_TEXT, parties: ['갑', '을'], actor: 'admin' });
    const altText = SAMPLE_TEXT.replace('120,000,000', '150,000,000');
    const docB = parseContract({ title: '계약B', text: altText, parties: ['갑', '을'], actor: 'admin' });
    const comparison = compareContracts(docA.id, docB.id, 'analyst');
    expect(comparison.differences.length).toBeGreaterThanOrEqual(0);
  });

  it('감사 로그가 기록되어야 한다', () => {
    expect(getContractAuditLog().length).toBeGreaterThan(0);
  });
});
