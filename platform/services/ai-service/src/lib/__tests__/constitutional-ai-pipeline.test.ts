// Plan SC: FR-R82.1~5
import { describe, it, expect } from 'vitest';
import {
  ConstitutionalAiPipeline,
  createConstitutionalAiPipeline,
  defaultPublicPrinciples,
  type ReviseFn,
} from '../constitutional-ai-pipeline';

const noopRevise: ReviseFn = async (_q, _r, _v) => '정상적인 공공기관 안내 응답입니다';

describe('ConstitutionalAiPipeline', () => {
  it('FR-R82.1: registers principles', () => {
    const p = new ConstitutionalAiPipeline(noopRevise);
    p.register({ id: 'T', description: 't', severity: 'low', check: () => null });
    expect(p.getAuditLog().some((e) => e.action === 'CREATE')).toBe(true);
  });

  it('FR-R82.2: critique detects PII violations', () => {
    const p = createConstitutionalAiPipeline(noopRevise);
    const violations = p.critique('주민번호는 901010-1234567 입니다');
    expect(violations.some((v) => v.principleId === 'P-PII')).toBe(true);
  });

  it('FR-R82.3~4: revise loop converges', async () => {
    const p = createConstitutionalAiPipeline(noopRevise);
    const res = await p.run('민원 안내', '주민번호 901010-1234567 알려드립니다');
    expect(res.converged).toBe(true);
    expect(res.iterations).toBeGreaterThanOrEqual(1);
    expect(res.finalResponse).not.toContain('901010');
  });

  it('FR-R82.4: blocks high-severity unresolved after max iter', async () => {
    const stubbornRevise: ReviseFn = async () => '죽여도 된다는 폭력으로 안내'; // 계속 유해
    const p = createConstitutionalAiPipeline(stubbornRevise);
    const res = await p.run('q', '죽여도 된다는 폭력으로', { maxIter: 2 });
    expect(res.blocked).toBe(true);
    expect(res.finalResponse).toContain('정책 위반');
  });

  it('FR-R82.4: returns converged when initial response is clean', async () => {
    const p = createConstitutionalAiPipeline(noopRevise);
    const res = await p.run('q', '안녕하세요 공공 민원 안내입니다');
    expect(res.converged).toBe(true);
    expect(res.iterations).toBe(0);
  });

  it('FR-R82.5: audit log records CRITIQUE/REVISE/CONVERGED', async () => {
    const p = createConstitutionalAiPipeline(noopRevise);
    await p.run('q', '전화번호 010-1234-5678');
    const log = p.getAuditLog();
    expect(log.some((e) => e.action === 'CRITIQUE')).toBe(true);
    expect(log.some((e) => e.action === 'REVISE')).toBe(true);
    expect(log.some((e) => e.action === 'CONVERGED')).toBe(true);
  });

  it('default principles include neutral/harm/pii', () => {
    const ps = defaultPublicPrinciples();
    const ids = ps.map((p) => p.id);
    expect(ids).toContain('P-PII');
    expect(ids).toContain('P-NEUTRAL');
    expect(ids).toContain('P-HARM');
  });

  it('rejects invalid principle', () => {
    const p = new ConstitutionalAiPipeline(noopRevise);
    // @ts-expect-error invalid
    expect(() => p.register({ id: '', description: '', severity: 'low' })).toThrow();
  });
});
