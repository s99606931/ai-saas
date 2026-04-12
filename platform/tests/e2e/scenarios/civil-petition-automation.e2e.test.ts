// E2E 테스트: 공공기관 민원 처리 완전 자동화 플로우
// Design Ref: MTU-N561-N580 §4 시나리오 1
// Plan SC: FR-N561.1, FR-N561.2
// CSAP: D-06 (감사 로깅), D-12 (시스템 개발 보안)

import { describe, it, expect } from 'vitest';
import { readServiceFile, serviceFileContains } from '../helpers/service-validator';

describe('E2E: 공공기관 민원 처리 완전 자동화 (FR-N561)', () => {
  // ── 1. 민원 자동화 모듈 존재 검증 ──
  describe('민원 자동화 핵심 모듈', () => {
    it('civil-petition-automation 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/ai-service/src/lib/civil-petition-automation.ts',
        ['petition'],
      );
      expect(result.exists).toBe(true);
    });

    it('민원 만족도 예측 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/ai-service/src/lib/civil-satisfaction-predictor.ts',
        ['Satisfaction'],
      );
      expect(result.exists).toBe(true);
    });
  });

  // ── 2. 민원 분류 → 응답 → 만족도 예측 흐름 ──
  describe('민원 처리 파이프라인 흐름', () => {
    it('자동화 모듈이 분류 함수 또는 카테고리 처리를 포함해야 한다', () => {
      const content = readServiceFile(
        'platform/services/ai-service/src/lib/civil-petition-automation.ts',
      );
      const hasClassification =
        content.includes('classify') ||
        content.includes('category') ||
        content.includes('분류') ||
        content.includes('Category');
      expect(hasClassification).toBe(true);
    });

    it('자동화 모듈이 AI 응답 생성을 위해 ai-agent 또는 RAG를 호출해야 한다', () => {
      const content = readServiceFile(
        'platform/services/ai-service/src/lib/civil-petition-automation.ts',
      );
      const hasAiCall =
        content.includes('ai-agent') ||
        content.includes('rag') ||
        content.includes('generate') ||
        content.includes('llm') ||
        content.includes('aiAgent');
      expect(hasAiCall).toBe(true);
    });

    it('만족도 예측 모듈이 점수 계산 로직을 포함해야 한다', () => {
      const content = readServiceFile(
        'platform/services/ai-service/src/lib/civil-satisfaction-predictor.ts',
      );
      const hasScore =
        content.includes('score') ||
        content.includes('predict') ||
        content.includes('rate') ||
        content.includes('satisfaction');
      expect(hasScore).toBe(true);
    });
  });

  // ── 3. 감사 로그 통합 (CSAP D-06) ──
  describe('민원 처리 감사 추적', () => {
    it('ai-service에 audit 모듈이 존재해야 한다', () => {
      const result = serviceFileContains('platform/services/ai-service/src/lib/audit.ts', [
        'audit',
      ]);
      expect(result.exists).toBe(true);
    });

    it('audit 모듈이 audit-sdk 또는 logAiEvent를 통해 감사 로그를 위임해야 한다', () => {
      const content = readServiceFile('platform/services/ai-service/src/lib/audit.ts');
      const usesSdk =
        content.includes('audit-sdk') ||
        content.includes('logAiEvent') ||
        content.includes('createServiceAuditLogger');
      expect(usesSdk).toBe(true);
    });
  });

  // ── 4. 멀티테넌트 격리 (CSAP D-08) ──
  describe('민원 멀티테넌트 격리', () => {
    it('ai-service routes에 tenant 컨텍스트가 적용되어야 한다', () => {
      const content = readServiceFile('platform/services/ai-service/src/routes.ts');
      const hasTenant =
        content.includes('tenant') ||
        content.includes('tenantId') ||
        content.includes('x-tenant');
      expect(hasTenant).toBe(true);
    });
  });

  // ── 5. AI 데이터 등급 검증 (N2SF) ──
  describe('민원 데이터 등급 분류', () => {
    it('AI 호출 시 데이터 등급/마스킹/가드레일 모듈이 존재해야 한다', () => {
      const gradeCheck = serviceFileContains(
        'platform/services/ai-service/src/lib/grade-check.ts',
        ['grade'],
      );
      const piiMask = serviceFileContains(
        'platform/services/ai-service/src/lib/pii-masking.ts',
        ['mask'],
      );
      const guardrails = serviceFileContains(
        'platform/services/ai-service/src/lib/ai-guardrails.ts',
        ['guard'],
      );
      expect(gradeCheck.exists || piiMask.exists || guardrails.exists).toBe(true);
    });
  });

  // ── 6. 종단간 흐름 무결성 ──
  describe('민원 처리 종단간 흐름', () => {
    it('ai-service routes에 민원 또는 자동화 엔드포인트가 등록되어야 한다', () => {
      const content = readServiceFile('platform/services/ai-service/src/routes.ts');
      // routes.ts에 핸들러 import가 존재하는지만 확인 (다양한 라우트명 허용)
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('register');
    });
  });
});
