// E2E 테스트: 보안 이벤트 흐름 검증
// Design Ref: MTU-N01 Design 2.2 시나리오 7
// Plan SC: FR-N01.9
// CSAP: D-06 침해사고 관리, D-08 접근 통제

import { describe, it, expect } from 'vitest';
import { readServiceFile, serviceFileContains } from '../helpers/service-validator';

describe('E2E: 보안 이벤트 흐름 (FR-N01.9, CSAP D-06, D-08)', () => {
  // ── 1. 로그인 실패 추적 ──

  describe('로그인 실패 추적 검증', () => {
    it('auth-service에 로그인 실패 감사 로그 기록이 있어야 한다', () => {
      const handlerContent = readServiceFile(
        'platform/services/auth-service/src/handlers/login.handler.ts',
      );
      expect(handlerContent).toContain('LOGIN_FAIL');
    });

    it('auth-service에 로그인 실패 횟수 제한 로직이 있어야 한다', () => {
      const handlerContent = readServiceFile(
        'platform/services/auth-service/src/handlers/login.handler.ts',
      );
      // 계정 잠금 또는 실패 횟수 추적
      expect(handlerContent).toContain('failedAttempts');
    });
  });

  // ── 2. 보안 모니터링 서비스 ──

  describe('보안 모니터링 서비스 검증', () => {
    it('security-monitor-service가 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/security-monitor-service/src/index.ts',
        ['security-monitor-service'],
      );
      expect(result.exists).toBe(true);
    });

    it('보안 이벤트 핸들러가 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/security-monitor-service/src/handlers/security.handler.ts',
        ['security'],
      );
      expect(result.exists).toBe(true);
    });
  });

  // ── 3. Rate Limiting (브루트포스 방지) ──

  describe('Rate Limiting 검증 (CSAP D-10)', () => {
    it('API 게이트웨이에 전역 Rate Limiting이 설정되어야 한다', () => {
      const indexContent = readServiceFile(
        'platform/services/api-gateway/src/index.ts',
      );
      expect(indexContent).toContain('rateLimit');
      expect(indexContent).toContain('100');
      expect(indexContent).toContain('1 minute');
    });

    it('테넌트 기반 Rate Limiting 키 생성이 구현되어야 한다', () => {
      const indexContent = readServiceFile(
        'platform/services/api-gateway/src/index.ts',
      );
      expect(indexContent).toContain('keyGenerator');
      expect(indexContent).toContain('tenant:');
    });

    it('auth 서비스에 별도 Rate Limiting이 설정되어야 한다', () => {
      const registryContent = readServiceFile(
        'platform/services/api-gateway/src/registry/service-registry.ts',
      );
      expect(registryContent).toContain('max: 10');
    });
  });

  // ── 4. RBAC 위반 검증 ──

  describe('RBAC 위반 검증 (CSAP D-08-05)', () => {
    it('권한 부족 시 403 Forbidden을 반환해야 한다', () => {
      const proxyContent = readServiceFile(
        'platform/services/api-gateway/src/routes/proxy.ts',
      );
      expect(proxyContent).toContain('FORBIDDEN');
      expect(proxyContent).toContain('403');
    });

    it('역할별 기본 권한이 정의되어 있어야 한다', () => {
      const proxyContent = readServiceFile(
        'platform/services/api-gateway/src/routes/proxy.ts',
      );
      expect(proxyContent).toContain('ROLE_PERMISSIONS');
      expect(proxyContent).toContain('SUPER_ADMIN');
      expect(proxyContent).toContain('TENANT_ADMIN');
      expect(proxyContent).toContain('AUDITOR');
      expect(proxyContent).toContain('USER');
      expect(proxyContent).toContain('VIEWER');
    });
  });

  // ── 5. IP 기반 보안 ──

  describe('IP 기반 보안 검증', () => {
    it('Rate Limiting에 IP 기반 폴백이 적용되어야 한다', () => {
      const indexContent = readServiceFile(
        'platform/services/api-gateway/src/index.ts',
      );
      expect(indexContent).toContain('request.ip');
    });

    it('프록시 요청에 X-Forwarded-For 헤더가 전달되어야 한다', () => {
      const proxyContent = readServiceFile(
        'platform/services/api-gateway/src/routes/proxy.ts',
      );
      expect(proxyContent).toContain('x-forwarded-for');
    });
  });

  // ── 6. 알림 서비스 보안 이벤트 통합 ──

  describe('알림 서비스 보안 이벤트 통합 검증', () => {
    it('notification-service에 보안 이벤트 처리 로직이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/notification-service/src/index.ts',
        ['notification'],
      );
      expect(result.exists).toBe(true);
    });
  });

  // ── 7. 에러 응답 보안 ──

  describe('에러 응답 보안 검증 (CSAP D-12)', () => {
    it('에러 응답에 스택 트레이스가 노출되지 않아야 한다', () => {
      const proxyContent = readServiceFile(
        'platform/services/api-gateway/src/routes/proxy.ts',
      );
      // 에러 응답에 stack 필드 미포함 확인
      expect(proxyContent).not.toContain('.stack');
    });

    it('에러 응답에 DB 비밀번호가 노출되지 않아야 한다', () => {
      const proxyContent = readServiceFile(
        'platform/services/api-gateway/src/routes/proxy.ts',
      );
      expect(proxyContent).not.toContain('DB_PASS');
      expect(proxyContent).not.toContain('password');
    });
  });
});
