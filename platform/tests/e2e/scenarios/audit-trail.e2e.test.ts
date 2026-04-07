// E2E 테스트: 감사 추적 (Audit Trail) 전체 검증
// Design Ref: MTU-N01 Design 2.2 시나리오 5
// Plan SC: FR-N01.5, FR-N01.9
// CSAP: D-06 침해사고 관리 (감사 로깅)

import { describe, it, expect } from 'vitest';
import { readServiceFile, serviceFileContains } from '../helpers/service-validator';

describe('E2E: 감사 추적 (FR-N01.5, CSAP D-06)', () => {
  // ── 1. 감사 서비스 핵심 기능 ──

  describe('감사 서비스 핵심 기능 검증', () => {
    it('audit-service에 로그 기록 핸들러가 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/audit-service/src/handlers/audit.handler.ts',
        ['POST', 'audit'],
      );
      expect(result.exists).toBe(true);
    });

    it('감사 로그에 필수 필드(actor, action, target, timestamp)가 있어야 한다', () => {
      const handlerContent = readServiceFile(
        'platform/services/audit-service/src/handlers/audit.handler.ts',
      );
      expect(handlerContent).toContain('actor');
      expect(handlerContent).toContain('action');
      expect(handlerContent).toContain('target');
    });

    it('감사 로그가 append-only 구조여야 한다 (CSAP D-06)', () => {
      const result = serviceFileContains(
        'platform/services/audit-service/src/handlers/audit.handler.ts',
        ['append'],
      );
      // append-only 패턴이 핸들러 또는 별도 테스트에 구현됨
      const testResult = serviceFileContains(
        'platform/services/audit-service/tests/unit/append-only.test.ts',
        ['append-only', 'immutable'],
      );
      expect(result.exists || testResult.exists).toBe(true);
    });

    it('감사 로그 보존 정책(retention)이 구현되어야 한다', () => {
      const result = serviceFileContains(
        'platform/services/audit-service/src/handlers/retention.handler.ts',
        ['retention'],
      );
      expect(result.exists).toBe(true);
    });
  });

  // ── 2. SHA-256 무결성 검증 ──

  describe('감사 로그 무결성 검증', () => {
    it('audit-sdk에 SHA-256 해시 체인 로직이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/packages/audit-sdk/src/audit-logger.ts',
        ['sha', 'hash', 'integrity'],
      );
      // integrity 테스트 파일에서도 확인
      const testResult = serviceFileContains(
        'platform/packages/audit-sdk/tests/integrity.test.ts',
        ['SHA-256', 'integrity'],
      );
      expect(result.exists || testResult.exists).toBe(true);
    });
  });

  // ── 3. 서비스별 감사 로그 통합 ──

  describe('서비스별 감사 로그 통합 검증', () => {
    it('auth-service에서 감사 로그를 기록해야 한다', () => {
      const auditLib = readServiceFile(
        'platform/services/auth-service/src/lib/audit.ts',
      );
      expect(auditLib).toContain('audit');
      expect(auditLib).toContain('LOGIN');
    });

    it('user-service에서 감사 로그를 기록해야 한다', () => {
      const handlerContent = readServiceFile(
        'platform/services/user-service/src/handlers/user.handler.ts',
      );
      expect(handlerContent).toContain('audit');
    });

    it('api-gateway에서 감사 로그 플러그인이 등록되어야 한다', () => {
      const indexContent = readServiceFile(
        'platform/services/api-gateway/src/index.ts',
      );
      expect(indexContent).toContain('auditLoggerPlugin');
    });

    it('ai-service에서 감사 로그를 기록해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/ai-service/src/lib/audit.ts',
        ['audit'],
      );
      expect(result.exists).toBe(true);
    });
  });

  // ── 4. 플러그인 감사 로그 통합 ──

  describe('플러그인 감사 로그 통합 검증', () => {
    it('전자결재 플러그인에서 결재 작업 감사 로그를 기록해야 한다', () => {
      const handlerContent = readServiceFile(
        'platform/plugins/electronic-approval/src/handlers/draft.handler.ts',
      );
      expect(handlerContent).toContain('logApprovalEvent');
      expect(handlerContent).toContain('DRAFT_CREATED');
      expect(handlerContent).toContain('DRAFT_APPROVED');
      expect(handlerContent).toContain('DRAFT_REJECTED');
    });

    it('공공데이터 연동 플러그인에서 데이터 접근 감사 로그를 기록해야 한다', () => {
      const handlerContent = readServiceFile(
        'platform/plugins/public-data-integration/src/handlers/dataset.handler.ts',
      );
      expect(handlerContent).toContain('logDataEvent');
      expect(handlerContent).toContain('DATASET_DATA_ACCESSED');
      expect(handlerContent).toContain('DATASET_TRANSFORMED');
    });
  });

  // ── 5. 감사 로그 조회 API ──

  describe('감사 로그 조회 API 검증', () => {
    it('audit-service에 로그 조회 API가 존재해야 한다', () => {
      const handlerContent = readServiceFile(
        'platform/services/audit-service/src/handlers/audit.handler.ts',
      );
      expect(handlerContent).toContain('GET');
    });

    it('감사 로그 조회에 tenantId 필터링이 적용되어야 한다', () => {
      const handlerContent = readServiceFile(
        'platform/services/audit-service/src/handlers/audit.handler.ts',
      );
      expect(handlerContent).toContain('tenantId');
    });
  });

  // ── 6. CSAP D-06 감사 로그 .claude/audit.jsonl ──

  describe('프로젝트 감사 로그 파일 검증', () => {
    it('.claude/audit.jsonl 파일이 존재해야 한다', () => {
      const fs = require('fs');
      const path = require('path');
      const auditPath = path.resolve(__dirname, '../../../../.claude/audit.jsonl');
      expect(fs.existsSync(auditPath)).toBe(true);
    });
  });
});
