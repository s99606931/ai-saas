// MTU-N344 리포트 템플릿 엔진 테스트
import { describe, it, expect } from 'vitest';
import { ReportTemplateEngineService } from '../report-template-engine.js';

describe('MTU-N344 ReportTemplateEngine', () => {
  const svc = new ReportTemplateEngineService('tenant-n344');

  it('FR-N344.1: 템플릿 생성', () => {
    const tpl = svc.create('t1', '월간 리포트', 'monthly', 'Hello {{name}}');
    expect(tpl).toBeDefined();
    expect(svc.get('t1')).toBeDefined();
  });

  it('FR-N344.2: 템플릿 렌더링', () => {
    svc.create('t2', '알림', 'alert', 'Alert: {{message}}');
    const rendered = svc.render('t2', { message: 'test alert' }, 'text');
    expect(rendered).toBeDefined();
  });

  it('FR-N344.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
