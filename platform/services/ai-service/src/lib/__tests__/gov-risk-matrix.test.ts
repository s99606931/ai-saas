// MTU-N359 정부 리스크 매트릭스 테스트
import { describe, it, expect } from 'vitest';
import { GovRiskMatrixService } from '../gov-risk-matrix.js';

describe('MTU-N359 GovRiskMatrix', () => {
  const svc = new GovRiskMatrixService('tenant-n359');

  it('FR-N359.1: 리스크 등록', () => {
    const risk = svc.register('데이터 유출', 'security', 3, 4, '암호화 강화');
    expect(risk).toBeDefined();
    expect(svc.list().length).toBeGreaterThan(0);
  });

  it('FR-N359.2: 히트맵 생성', () => {
    svc.register('예산 초과', 'financial', 4, 3, '예산 관리');
    const heatmap = svc.heatmap();
    expect(heatmap).toBeDefined();
  });

  it('FR-N359.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
