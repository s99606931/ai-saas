// MTU-N318 멀티테넌트 알림 테스트
import { describe, it, expect } from 'vitest';
import { MultitenantNotificationService } from '../multitenant-notification.js';

describe('MTU-N318 MultitenantNotification', () => {
  const svc = new MultitenantNotificationService('tenant-n318');

  it('FR-N318.1: 템플릿 생성', () => {
    const tpl = svc.createTemplate('welcome', 'email', '환영합니다', 'Hello {{name}}');
    expect(tpl).toBeDefined();
    expect(svc.getTemplates().length).toBeGreaterThan(0);
  });

  it('FR-N318.2: 알림 발송', () => {
    const tpl = svc.createTemplate('alert', 'push', '경고', '{{msg}}');
    const result = svc.send(tpl.templateId, 'push', ['user-1'], { msg: 'test' });
    expect(result).toBeDefined();
  });

  it('FR-N318.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
