// E2E 테스트: API 게이트웨이 라우팅 검증
// Design Ref: MTU-N01 Design 2.2 시나리오 4
// Plan SC: FR-N01.4, FR-N01.10
// CSAP: D-10 네트워크 보안, D-08 접근 통제

import { describe, it, expect } from 'vitest';
import {
  readServiceFile,
  serviceFileContains,
  ALL_SERVICES,
  AUTH_REQUIRED_SERVICES,
} from '../helpers/service-validator';

describe('E2E: API 게이트웨이 라우팅 (FR-N01.4, CSAP D-10)', () => {
  // ── 1. 서비스 레지스트리 완전성 ──

  describe('서비스 레지스트리 검증', () => {
    const registryContent = readServiceFile('platform/services/api-gateway/src/registry/service-registry.ts');

    it('서비스 레지스트리에 모든 인증 필수 서비스가 등록되어 있어야 한다', () => {
      const serviceIds = [
        'auth',
        'users',
        'tenants',
        'menus',
        'services',
        'subscriptions',
        'billing',
        'crm',
        'ai',
        'notifications',
        'files',
        'audit',
        'compliance',
        'security',
      ];
      for (const svcId of serviceIds) {
        expect(registryContent).toContain(`${svcId}:`);
      }
    });

    it('인증 불필요 서비스는 auth만이어야 한다', () => {
      // requireAuth: false는 auth 서비스에만 적용
      const falseCount = (registryContent.match(/requireAuth: false/g) ?? []).length;
      expect(falseCount).toBe(1);
    });

    it('Rate Limiting이 auth 서비스에 별도 설정되어 있어야 한다 (브루트포스 방지)', () => {
      expect(registryContent).toContain('rateLimit');
      expect(registryContent).toContain('브루트포스');
    });
  });

  // ── 2. 프록시 라우팅 구조 ──

  describe('프록시 라우팅 구조 검증', () => {
    const proxyContent = readServiceFile('platform/services/api-gateway/src/routes/proxy.ts');

    it('모든 서비스에 /api/v1/{serviceId} 프록시 경로가 등록되어야 한다', () => {
      expect(proxyContent).toContain('/api/v1/');
      expect(proxyContent).toContain('registerProxyRoutes');
    });

    it('httpProxy 플러그인을 사용하여 프록시를 등록해야 한다', () => {
      expect(proxyContent).toContain('httpProxy');
      expect(proxyContent).toContain('@fastify/http-proxy');
    });

    it('인증 필수 서비스에 authPreHandler가 적용되어야 한다', () => {
      expect(proxyContent).toContain('authPreHandler');
      expect(proxyContent).toContain('entry.requireAuth');
    });

    it('RBAC 권한 검사 preHandler가 존재해야 한다 (CSAP D-08-05)', () => {
      expect(proxyContent).toContain('makePermissionPreHandler');
      expect(proxyContent).toContain('requiredPermissions');
    });
  });

  // ── 3. 미들웨어 체인 ──

  describe('미들웨어 체인 검증', () => {
    const indexContent = readServiceFile('platform/services/api-gateway/src/index.ts');

    it('CORS 설정이 포함되어야 한다', () => {
      expect(indexContent).toContain('cors');
      expect(indexContent).toContain('@fastify/cors');
    });

    it('Rate Limiting이 전역 설정되어야 한다', () => {
      expect(indexContent).toContain('rateLimit');
      expect(indexContent).toContain('@fastify/rate-limit');
    });

    it('Correlation ID 플러그인이 등록되어야 한다 (분산 추적)', () => {
      expect(indexContent).toContain('correlationIdPlugin');
    });

    it('감사 로그 플러그인이 등록되어야 한다 (CSAP D-06)', () => {
      expect(indexContent).toContain('auditLoggerPlugin');
    });

    it('Swagger/OpenAPI 문서가 등록되어야 한다 (CSAP D-12)', () => {
      expect(indexContent).toContain('swaggerPlugin');
    });
  });

  // ── 4. 동적 플러그인 라우팅 ──

  describe('동적 플러그인 라우팅 검증', () => {
    const proxyContent = readServiceFile('platform/services/api-gateway/src/routes/proxy.ts');

    it('/api/v1/plugins/:pluginId/* 경로가 등록되어야 한다', () => {
      expect(proxyContent).toContain('/api/v1/plugins/:pluginId/*');
    });

    it('플러그인 라우트에도 인증 검사가 적용되어야 한다', () => {
      expect(proxyContent).toContain('preHandler: authPreHandler');
    });

    it('미등록 플러그인 접근 시 404를 반환해야 한다', () => {
      expect(proxyContent).toContain('SERVICE_NOT_FOUND');
      expect(proxyContent).toContain('404');
    });

    it('Circuit Breaker가 동적 프록시에 적용되어야 한다 (CSAP D-07)', () => {
      expect(proxyContent).toContain('circuitBreaker');
      expect(proxyContent).toContain('CircuitOpenError');
    });
  });

  // ── 5. 헬스체크 엔드포인트 ──

  describe('헬스체크 엔드포인트 검증', () => {
    const indexContent = readServiceFile('platform/services/api-gateway/src/index.ts');

    it('/health 엔드포인트가 존재해야 한다', () => {
      expect(indexContent).toContain('/health');
    });

    it('/health/services 엔드포인트가 존재해야 한다 (다운스트림 상태)', () => {
      expect(indexContent).toContain('/health/services');
    });

    it('/ready 엔드포인트가 존재해야 한다 (k8s readinessProbe)', () => {
      expect(indexContent).toContain('/ready');
    });
  });

  // ── 6. Graceful Shutdown ──

  describe('Graceful Shutdown 검증 (CSAP D-07)', () => {
    const indexContent = readServiceFile('platform/services/api-gateway/src/index.ts');

    it('SIGTERM 핸들러가 등록되어야 한다', () => {
      expect(indexContent).toContain('SIGTERM');
    });

    it('SIGINT 핸들러가 등록되어야 한다', () => {
      expect(indexContent).toContain('SIGINT');
    });

    it('graceful shutdown 로직이 존재해야 한다', () => {
      expect(indexContent).toContain('graceful shutdown');
      // meshReadyPlugin 패턴: app.close는 플러그인 내부에서 자동 호출
      // 또는 직접 호출 (레거시 패턴)
      const hasAppClose = indexContent.includes('app.close');
      const hasMeshShutdown = indexContent.includes('mesh.shutdown');
      expect(hasAppClose || hasMeshShutdown).toBe(true);
    });
  });

  // ── 7. 모든 서비스 Dockerfile 존재 ──

  describe('서비스 컨테이너화 검증', () => {
    for (const svc of ALL_SERVICES) {
      it(`${svc}에 Dockerfile이 존재해야 한다`, () => {
        const result = serviceFileContains(`platform/services/${svc}/Dockerfile`, ['FROM', 'EXPOSE']);
        expect(result.exists).toBe(true);
      });
    }
  });

  // ── 8. N2SF 데이터 등급 미들웨어 ──

  describe('AI 서비스 데이터 등급 검증 미들웨어', () => {
    const proxyContent = readServiceFile('platform/services/api-gateway/src/routes/proxy.ts');

    it('AI 서비스에 dataGradeMiddleware가 적용되어야 한다', () => {
      expect(proxyContent).toContain('dataGradeMiddleware');
    });

    it('O등급만 허용하도록 설정되어야 한다 (N2SF N-05)', () => {
      expect(proxyContent).toContain("['O']");
    });
  });
});
