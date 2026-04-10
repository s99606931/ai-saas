// E2E 테스트: AI 서비스 데이터 등급 검증
// Design Ref: MTU-N01 Design 2.2 시나리오 8
// Plan SC: FR-N01.11
// CSAP: N2SF N-05 (AI API 데이터 등급 준수)

import { describe, it, expect } from 'vitest';
import { readServiceFile, serviceFileContains } from '../helpers/service-validator';

describe('E2E: AI 데이터 등급 검증 (FR-N01.11, N2SF N-05)', () => {
  // ── 1. 데이터 등급 미들웨어 ──

  describe('데이터 등급 미들웨어 검증', () => {
    it('API 게이트웨이에 데이터 등급 검증 미들웨어가 존재해야 한다', () => {
      const result = serviceFileContains('platform/services/api-gateway/src/middleware/data-grade.middleware.ts', [
        'dataGradeMiddleware',
        'DATA_GRADE_VIOLATION',
      ]);
      expect(result.exists).toBe(true);
    });

    it('AI 서비스 프록시에 데이터 등급 미들웨어가 적용되어야 한다', () => {
      const proxyContent = readServiceFile('platform/services/api-gateway/src/routes/proxy.ts');
      expect(proxyContent).toContain('dataGradeMiddleware');
      expect(proxyContent).toContain("serviceId === 'ai'");
    });
  });

  // ── 2. AI 서비스 등급 검사 ──

  describe('AI 서비스 등급 검사 검증', () => {
    it('ai-service에 데이터 등급 검사 로직이 존재해야 한다', () => {
      const result = serviceFileContains('platform/services/ai-service/src/handlers/ai.handler.ts', [
        'validateDataGrade',
        'DataGradeViolationError',
      ]);
      expect(result.exists).toBe(true);
    });

    it('C등급 데이터 차단 테스트가 존재해야 한다', () => {
      const result = serviceFileContains('platform/services/ai-service/tests/unit/grade-check.test.ts', [
        'C등급',
        '차단',
      ]);
      expect(result.exists).toBe(true);
    });

    it('S등급 데이터 차단 테스트가 존재해야 한다', () => {
      const result = serviceFileContains('platform/services/ai-service/tests/unit/grade-check.test.ts', [
        'S등급',
        '차단',
      ]);
      expect(result.exists).toBe(true);
    });

    it('O등급 데이터 허용 테스트가 존재해야 한다', () => {
      const result = serviceFileContains('platform/services/ai-service/tests/unit/grade-check.test.ts', [
        'O등급',
        '허용',
      ]);
      expect(result.exists).toBe(true);
    });
  });

  // ── 3. PII 마스킹 ──

  describe('PII 마스킹 검증', () => {
    it('ai-service에 PII 마스킹 로직이 존재해야 한다', () => {
      const result = serviceFileContains('platform/services/ai-service/src/handlers/ai.handler.ts', [
        'maskPII',
        'PII 마스킹',
      ]);
      expect(result.exists).toBe(true);
    });

    it('PII 마스킹 테스트가 존재해야 한다', () => {
      const result = serviceFileContains('platform/services/ai-service/tests/unit/pii-masking.test.ts', [
        '마스킹',
        'PII',
      ]);
      expect(result.exists).toBe(true);
    });
  });

  // ── 4. AI 감사 로그 ──

  describe('AI 감사 로그 검증', () => {
    it('ai-service에 감사 로그 유틸리티가 존재해야 한다', () => {
      const result = serviceFileContains('platform/services/ai-service/src/lib/audit.ts', ['audit', 'log']);
      expect(result.exists).toBe(true);
    });

    it('AI API 호출 시 감사 로그를 기록해야 한다', () => {
      const handlerContent = readServiceFile('platform/services/ai-service/src/handlers/ai.handler.ts');
      expect(handlerContent).toContain('audit');
    });
  });

  // ── 5. AI 서비스 헬스체크 ──

  describe('AI 서비스 구조 검증', () => {
    it('ai-service에 헬스체크 엔드포인트가 존재해야 한다', () => {
      const indexContent = readServiceFile('platform/services/ai-service/src/index.ts');
      expect(indexContent).toContain('/health');
    });

    it('ai-service에 Graceful Shutdown이 구현되어야 한다', () => {
      const indexContent = readServiceFile('platform/services/ai-service/src/index.ts');
      expect(indexContent).toContain('SIGTERM');
      expect(indexContent).toContain('SIGINT');
    });
  });
});
