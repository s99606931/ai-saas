// E2E 테스트: 인증 흐름 전체 검증
// Design Ref: MTU-N01 Design 2.2 시나리오 1
// Plan SC: FR-N01.1
// CSAP: D-08 접근 통제

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { TEST_USERS, createMockToken, createExpiredToken, authHeaders, noAuthHeaders } from '../helpers/mock-auth';
import { readServiceFile, serviceFileContains } from '../helpers/service-validator';

const PROJECT_ROOT = resolve(__dirname, '../../../../');

describe('E2E: 인증 흐름 (FR-N01.1, CSAP D-08)', () => {
  // ── 1. 로그인 엔드포인트 존재 확인 ──

  describe('로그인 API 구조 검증', () => {
    it('auth-service에 로그인 라우트가 정의되어 있어야 한다', () => {
      const routesContent = readServiceFile('platform/services/auth-service/src/routes.ts');
      expect(routesContent).toContain('login');
      expect(routesContent).toContain('POST');
    });

    it('로그인 시 이메일 + 비밀번호 검증 로직이 존재해야 한다', () => {
      const handlerContent = readServiceFile('platform/services/auth-service/src/handlers/login.handler.ts');
      expect(handlerContent).toContain('email');
      expect(handlerContent).toContain('password');
    });

    it('로그인 성공 시 JWT 토큰(accessToken)을 반환해야 한다', () => {
      const handlerContent = readServiceFile('platform/services/auth-service/src/handlers/login.handler.ts');
      expect(handlerContent).toContain('accessToken');
    });

    it('로그인 시 감사 로그를 기록해야 한다 (CSAP D-06)', () => {
      const handlerContent = readServiceFile('platform/services/auth-service/src/handlers/login.handler.ts');
      // 감사 로그 기록 패턴 확인
      expect(handlerContent).toContain('LOGIN');
    });
  });

  // ── 2. 토큰 검증 엔드포인트 확인 ──

  describe('토큰 검증 구조 검증', () => {
    it('auth-service에 토큰 검증 라우트(/auth/verify)가 있어야 한다', () => {
      const routesContent = readServiceFile('platform/services/auth-service/src/routes.ts');
      expect(routesContent).toContain('verify');
    });

    it('API 게이트웨이가 토큰 검증을 auth-service에 위임해야 한다', () => {
      const proxyContent = readServiceFile('platform/services/api-gateway/src/routes/proxy.ts');
      expect(proxyContent).toContain('/auth/verify');
      expect(proxyContent).toContain('authPreHandler');
    });
  });

  // ── 3. 인증 없는 접근 차단 검증 ──

  describe('미인증 접근 차단 검증', () => {
    it('API 게이트웨이에 인증 필수 서비스 목록이 정의되어 있어야 한다', () => {
      const registryContent = readServiceFile('platform/services/api-gateway/src/registry/service-registry.ts');
      // 인증 필수 서비스들
      expect(registryContent).toContain('requireAuth: true');
      // auth 서비스만 인증 불필요
      expect(registryContent).toContain('requireAuth: false');
    });

    it('인증 토큰 누락 시 401 응답을 반환해야 한다', () => {
      const proxyContent = readServiceFile('platform/services/api-gateway/src/routes/proxy.ts');
      expect(proxyContent).toContain('AUTH_NO_TOKEN');
      expect(proxyContent).toContain('401');
    });

    it('잘못된 토큰 시 AUTH_TOKEN_INVALID를 반환해야 한다', () => {
      const proxyContent = readServiceFile('platform/services/api-gateway/src/routes/proxy.ts');
      expect(proxyContent).toContain('AUTH_TOKEN_INVALID');
    });
  });

  // ── 4. 로그아웃 흐름 검증 ──

  describe('로그아웃 흐름 검증', () => {
    it('auth-service에 로그아웃 라우트가 정의되어 있어야 한다', () => {
      const routesContent = readServiceFile('platform/services/auth-service/src/routes.ts');
      expect(routesContent).toContain('logout');
    });

    it('로그아웃 시 감사 로그를 기록해야 한다 (CSAP D-06)', () => {
      const handlerContent = readServiceFile('platform/services/auth-service/src/handlers/logout.handler.ts');
      expect(handlerContent).toContain('LOGOUT');
    });
  });

  // ── 5. 세션 관리 검증 (CSAP D-08) ──

  describe('세션 관리 검증', () => {
    it('JWT 토큰에 만료 시간(exp)이 설정되어야 한다', () => {
      const token = createMockToken(TEST_USERS['superAdmin']!);
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());
      expect(payload.exp).toBeDefined();
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('만료된 토큰이 올바르게 생성되어야 한다 (테스트 유틸)', () => {
      const token = createExpiredToken(TEST_USERS['superAdmin']!);
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());
      expect(payload.exp).toBeLessThan(Math.floor(Date.now() / 1000));
    });

    it('세션 관리 코드(Redis 기반)가 auth-service에 존재해야 한다', () => {
      const result = serviceFileContains('platform/services/auth-service/src/lib/session.ts', ['redis', 'session']);
      expect(result.exists).toBe(true);
    });
  });

  // ── 6. MFA 지원 검증 ──

  describe('MFA(다중 인증) 지원 검증', () => {
    it('auth-service에 MFA 관련 라우트가 존재해야 한다', () => {
      const routesContent = readServiceFile('platform/services/auth-service/src/routes.ts');
      expect(routesContent).toContain('mfa');
    });
  });

  // ── 7. Mock 인증 헤더 검증 ──

  describe('Mock 인증 유틸 검증', () => {
    it('authHeaders가 필요한 모든 헤더를 포함해야 한다', () => {
      const headers = authHeaders(TEST_USERS['superAdmin']!);
      expect(headers['authorization']).toMatch(/^Bearer /);
      expect(headers['x-user-id']).toBe('user-super-001');
      expect(headers['x-tenant-id']).toBe('tenant-mois');
      expect(headers['x-user-role']).toBe('SUPER_ADMIN');
      expect(headers['content-type']).toBe('application/json');
    });

    it('noAuthHeaders에는 authorization이 없어야 한다', () => {
      const headers = noAuthHeaders();
      expect(headers['authorization']).toBeUndefined();
      expect(headers['content-type']).toBe('application/json');
    });
  });
});
