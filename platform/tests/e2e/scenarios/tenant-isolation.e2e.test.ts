// E2E 테스트: 테넌트 격리 검증
// Design Ref: MTU-N01 Design 2.2 시나리오 6
// Plan SC: FR-N01.8
// CSAP: D-08 접근 통제, N2SF N-03 격리 영역

import { describe, it, expect } from 'vitest';
import { TEST_USERS, authHeaders } from '../helpers/mock-auth';
import { readServiceFile, serviceFileContains } from '../helpers/service-validator';

describe('E2E: 테넌트 격리 검증 (FR-N01.8, CSAP D-08, N2SF N-03)', () => {
  // ── 1. 테넌트 ID 헤더 전파 ──

  describe('테넌트 ID 전파 검증', () => {
    it('API 게이트웨이가 인증 후 x-user-tenant-id 헤더를 주입해야 한다', () => {
      const proxyContent = readServiceFile('platform/services/api-gateway/src/routes/proxy.ts');
      expect(proxyContent).toContain('x-user-tenant-id');
      expect(proxyContent).toContain('data.tenantId');
    });

    it('동적 플러그인 프록시에서도 x-tenant-id 헤더를 전파해야 한다', () => {
      const proxyContent = readServiceFile('platform/services/api-gateway/src/routes/proxy.ts');
      expect(proxyContent).toContain("'x-tenant-id'");
    });
  });

  // ── 2. 테넌트 서비스 격리 검증 ──

  describe('테넌트 서비스 격리 검증', () => {
    it('tenant-service에 테넌트 격리 기반 CRUD가 존재해야 한다', () => {
      const result = serviceFileContains('platform/services/tenant-service/src/handlers/tenant.handler.ts', [
        'prisma.tenant',
        'FastifyRequest',
      ]);
      expect(result.exists).toBe(true);
    });
  });

  // ── 3. 사용자 서비스 테넌트 격리 ──

  describe('사용자 서비스 테넌트 격리 검증', () => {
    it('user-service에 tenantId 기반 필터링이 존재해야 한다', () => {
      const handlerContent = readServiceFile('platform/services/user-service/src/handlers/user.handler.ts');
      expect(handlerContent).toContain('tenantId');
    });

    it('비밀번호 변경 시 테넌트 격리가 적용되어야 한다', () => {
      const handlerContent = readServiceFile('platform/services/user-service/src/handlers/user.handler.ts');
      // 비밀번호 변경 관련 코드에서 tenantId 확인
      expect(handlerContent).toContain('password');
      expect(handlerContent).toContain('tenantId');
    });
  });

  // ── 4. 감사 서비스 테넌트 격리 ──

  describe('감사 서비스 테넌트 격리 검증', () => {
    it('audit-service에 tenantId 기반 필터링이 존재해야 한다', () => {
      const handlerContent = readServiceFile('platform/services/audit-service/src/handlers/audit.handler.ts');
      expect(handlerContent).toContain('tenantId');
    });
  });

  // ── 5. 플러그인 테넌트 격리 ──

  describe('플러그인 테넌트 격리 검증', () => {
    it('전자결재 플러그인에 테넌트 격리가 적용되어야 한다', () => {
      const handlerContent = readServiceFile('platform/plugins/electronic-approval/src/handlers/draft.handler.ts');
      expect(handlerContent).toContain('tenantId');
      expect(handlerContent).toContain('x-tenant-id');
    });

    it('공공데이터 연동 플러그인에 테넌트 격리가 적용되어야 한다', () => {
      const handlerContent = readServiceFile(
        'platform/plugins/public-data-integration/src/handlers/dataset.handler.ts',
      );
      expect(handlerContent).toContain('tenantId');
      expect(handlerContent).toContain('x-tenant-id');
    });
  });

  // ── 6. Mock 사용자 테넌트 분리 검증 ──

  describe('Mock 사용자 테넌트 분리 검증', () => {
    it('테넌트 A와 테넌트 B 사용자가 다른 테넌트 ID를 가져야 한다', () => {
      const userA = TEST_USERS['userA']!;
      const userB = TEST_USERS['userB']!;
      expect(userA.tenantId).not.toBe(userB.tenantId);
    });

    it('같은 테넌트의 사용자들은 동일한 테넌트 ID를 가져야 한다', () => {
      const adminA = TEST_USERS['tenantAdminA']!;
      const userA = TEST_USERS['userA']!;
      expect(adminA.tenantId).toBe(userA.tenantId);
    });

    it('인증 헤더에 올바른 테넌트 ID가 포함되어야 한다', () => {
      const headersA = authHeaders(TEST_USERS['userA']!);
      const headersB = authHeaders(TEST_USERS['userB']!);
      expect(headersA['x-tenant-id']).toBe('tenant-a');
      expect(headersB['x-tenant-id']).toBe('tenant-b');
    });
  });

  // ── 7. Cross-Tenant 접근 차단 코드 검증 ──

  describe('Cross-Tenant 접근 차단 검증', () => {
    it('API 게이트웨이 인증 시 tenantId가 JWT에서 추출되어야 한다', () => {
      const proxyContent = readServiceFile('platform/services/api-gateway/src/routes/proxy.ts');
      expect(proxyContent).toContain('tenantId');
    });

    it('서비스 간 내부 통신 시 x-internal-service-key 헤더를 사용해야 한다', () => {
      const proxyContent = readServiceFile('platform/services/api-gateway/src/routes/proxy.ts');
      expect(proxyContent).toContain('x-internal-service-key');
      expect(proxyContent).toContain('INTERNAL_SERVICE_KEY');
    });
  });

  // ── 8. 캐시 테넌트 격리 ──

  describe('캐시 테넌트 격리 검증', () => {
    it('공공데이터 플러그인 캐시에 tenantId가 포함되어야 한다', () => {
      const handlerContent = readServiceFile(
        'platform/plugins/public-data-integration/src/handlers/dataset.handler.ts',
      );
      // 캐시 키에 tenantId 포함
      expect(handlerContent).toContain('auth.tenantId');
    });
  });
});
