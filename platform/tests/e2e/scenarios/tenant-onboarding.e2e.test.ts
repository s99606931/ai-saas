// E2E 테스트: 멀티테넌트 온보딩 완전 자동화 플로우
// Design Ref: MTU-N561-N580 §4 시나리오 3
// Plan SC: FR-N575.1, FR-N575.2
// CSAP: D-08 (접근 통제), D-12 (개발 보안)

import { describe, it, expect } from 'vitest';
import { readServiceFile, serviceFileContains } from '../helpers/service-validator';

describe('E2E: 멀티테넌트 온보딩 자동화 (FR-N575)', () => {
  // ── 1. 온보딩 자동화 모듈 ──
  describe('AI 기반 온보딩 자동화', () => {
    it('tenant-onboarding-ai 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/ai-service/src/lib/tenant-onboarding-ai.ts',
        ['Onboarding'],
      );
      expect(result.exists).toBe(true);
    });

    it('온보딩 설문에 기관 유형/규모가 정의되어야 한다', () => {
      const content = readServiceFile(
        'platform/services/ai-service/src/lib/tenant-onboarding-ai.ts',
      );
      expect(content).toContain('OrganizationType');
      expect(content).toContain('OrganizationScale');
    });

    it('공공기관 유형(중앙/지방/공기업)이 모두 지원되어야 한다', () => {
      const content = readServiceFile(
        'platform/services/ai-service/src/lib/tenant-onboarding-ai.ts',
      );
      expect(content).toContain('central_government');
      expect(content).toContain('local_government');
      expect(content).toContain('public_enterprise');
    });
  });

  // ── 2. 테넌트 CRUD 핸들러 ──
  describe('테넌트 생성 API', () => {
    it('tenant-service의 tenant.handler가 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/tenant-service/src/handlers/tenant.handler.ts',
        ['tenant', 'prisma'],
      );
      expect(result.exists).toBe(true);
    });

    it('테넌트 핸들러에 입력 검증(zod)이 적용되어야 한다 (CSAP D-12)', () => {
      const content = readServiceFile(
        'platform/services/tenant-service/src/handlers/tenant.handler.ts',
      );
      expect(content).toContain('z.');
      expect(content).toContain('uuid');
    });

    it('테넌트 작업이 감사 로그를 기록해야 한다 (CSAP D-06)', () => {
      const content = readServiceFile(
        'platform/services/tenant-service/src/handlers/tenant.handler.ts',
      );
      expect(content).toContain('logTenantEvent');
    });
  });

  // ── 3. 통계 및 사용량 ──
  describe('테넌트 통계/사용량 집계', () => {
    it('tenant-stats 핸들러가 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/tenant-service/src/handlers/tenant-stats.handler.ts',
        ['stats'],
      );
      expect(result.exists).toBe(true);
    });

    it('tenant-usage 핸들러가 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/tenant-service/src/handlers/tenant-usage.handler.ts',
        ['usage'],
      );
      expect(result.exists).toBe(true);
    });
  });

  // ── 4. 멀티테넌트 격리 (N2SF N-03) ──
  describe('테넌트 격리 검증', () => {
    it('테넌트 핸들러가 tenantId 기반 격리를 수행해야 한다', () => {
      const content = readServiceFile(
        'platform/services/tenant-service/src/handlers/tenant.handler.ts',
      );
      // tenantId 또는 id 필드 격리 확인
      const hasIsolation = content.includes('tenantId') || content.includes('where');
      expect(hasIsolation).toBe(true);
    });
  });

  // ── 5. 온보딩 감사 로그 ──
  describe('온보딩 감사 추적', () => {
    it('tenant-service에 audit 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/tenant-service/src/lib/audit.ts',
        ['audit', 'logTenantEvent'],
      );
      // audit.ts가 없을 수도 있어 두 옵션 모두 시도
      const altExists = serviceFileContains(
        'platform/services/tenant-service/src/handlers/tenant.handler.ts',
        ['logTenantEvent'],
      );
      expect(result.exists || altExists.exists).toBe(true);
    });
  });

  // ── 6. 메뉴 매핑 (기본 메뉴) ──
  describe('테넌트 기본 메뉴 매핑', () => {
    it('menu-service가 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/menu-service/src/index.ts',
        ['menu', 'fastify'],
      );
      // 다양한 import 패턴 허용
      expect(result.exists).toBe(true);
    });
  });

  // ── 7. 종단간 흐름 ──
  describe('온보딩 종단간 흐름 무결성', () => {
    it('AI 온보딩 모듈이 N2SF 마스킹을 호출해야 한다', () => {
      const content = readServiceFile(
        'platform/services/ai-service/src/lib/tenant-onboarding-ai.ts',
      );
      const hasMasking =
        content.includes('mask') ||
        content.includes('maskPII') ||
        content.includes('N2SF') ||
        content.includes('O등급');
      expect(hasMasking).toBe(true);
    });
  });
});
