// 통합 테스트: 전체 서비스 헬스 체크
// Design Ref: DESIGN-MTU-P21
// Plan SC: MTU-P21

import { describe, it, expect } from 'vitest';

const SERVICES = [
  { name: 'auth-service', port: 3000 },
  { name: 'user-service', port: 3001 },
  { name: 'tenant-service', port: 3002 },
  { name: 'api-gateway', port: 3003 },
  { name: 'menu-service', port: 3004 },
  { name: 'catalog-service', port: 3005 },
  { name: 'subscription-service', port: 3006 },
  { name: 'billing-service', port: 3007 },
  { name: 'crm-service', port: 3008 },
  { name: 'ai-service', port: 3009 },
  { name: 'notification-service', port: 3010 },
  { name: 'file-service', port: 3011 },
  { name: 'audit-service', port: 3012 },
  { name: 'compliance-service', port: 3013 },
  { name: 'security-service', port: 3014 },
];

describe('서비스 헬스 체크', () => {
  for (const service of SERVICES) {
    it(`${service.name} (포트 ${service.port})`, async () => {
      const response = await fetch(`http://localhost:${service.port}/health`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe(service.name);
    });
  }
});
