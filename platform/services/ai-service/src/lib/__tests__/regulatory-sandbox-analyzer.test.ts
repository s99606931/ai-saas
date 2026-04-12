// MTU-N298 규제 샌드박스 분석 테스트
import { describe, it, expect } from 'vitest';
import { RegulatorySandboxAnalyzerService } from '../regulatory-sandbox-analyzer.js';

describe('MTU-N298 RegulatorySandboxAnalyzer', () => {
  const svc = new RegulatorySandboxAnalyzerService('tenant-n298');

  it('FR-N298.1~6: 규제 분석 + 감사', () => {
    const r = svc.analyze(
      '드론 배송 규제 샌드박스',
      '제1조. 도심 드론 배송은 항공안전법에 따른다.\n제2조. 야간 비행은 금지한다.\n제3조. 5kg 이하 화물에 한정한다.',
      '항공안전법',
    );
    expect(r.analysisId).toBeDefined();
    expect(r.affectedSectors).toBeDefined();
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
