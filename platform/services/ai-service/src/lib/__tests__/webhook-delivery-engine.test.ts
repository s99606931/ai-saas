// MTU-N331 웹훅 전달 엔진 테스트
import { describe, it, expect } from 'vitest';
import { WebhookDeliveryService } from '../webhook-delivery-engine.js';

describe('MTU-N331 WebhookDelivery', () => {
  const svc = new WebhookDeliveryService('tenant-n331');

  it('FR-N331.1: 엔드포인트 등록', () => {
    const ep = svc.register('https://example.com/hook', ['user.created'], 'secret-key');
    expect(ep).toBeDefined();
  });

  it('FR-N331.2: 전달 실행', () => {
    const ep = svc.register('https://test.com/hook', ['order.placed'], 'sec');
    const delivery = svc.deliver(ep.endpointId, 'order.placed', { orderId: 'o1' }, 'sec');
    expect(delivery).toBeDefined();
  });

  it('FR-N331.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
