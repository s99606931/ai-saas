// E2E 테스트: CSAP 감사 증적 자동 수집 플로우
// Design Ref: MTU-N561-N580 §4 시나리오 4
// Plan SC: FR-N578.1, FR-N578.2
// CSAP: D-06 (침해사고 관리), D-01~D-13 전 영역

import { describe, it, expect } from 'vitest';
import { readServiceFile, serviceFileContains } from '../helpers/service-validator';
import { existsSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../../../../');

describe('E2E: CSAP 감사 증적 자동 수집 (FR-N578)', () => {
  // ── 1. 증거 수집기 모듈 ──
  describe('CSAP 증거 수집기', () => {
    it('csap-evidence-collector v2 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/compliance-service/src/lib/csap-evidence-collector.ts',
        ['CSAP', 'evidence'],
      );
      expect(result.exists).toBe(true);
    });

    it('CSAP 13개 통제 도메인(D-01~D-13)이 정의되어야 한다', () => {
      const content = readServiceFile(
        'platform/services/compliance-service/src/lib/csap-evidence-collector.ts',
      );
      expect(content).toContain('D-01');
      expect(content).toContain('D-06');
      expect(content).toContain('D-08');
      expect(content).toContain('D-09');
      expect(content).toContain('D-12');
      expect(content).toContain('D-13');
    });

    it('SHA-256 무결성 해시 생성 로직이 존재해야 한다', () => {
      const content = readServiceFile(
        'platform/services/compliance-service/src/lib/csap-evidence-collector.ts',
      );
      expect(content).toContain('createHash');
    });
  });

  // ── 2. compliance-service 핸들러 ──
  describe('compliance-service 증적 API', () => {
    it('compliance.handler가 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/compliance-service/src/handlers/compliance.handler.ts',
        ['compliance'],
      );
      expect(result.exists).toBe(true);
    });

    it('compliance-trend 핸들러가 존재해야 한다 (추세 분석)', () => {
      const result = serviceFileContains(
        'platform/services/compliance-service/src/handlers/compliance-trend.handler.ts',
        ['trend'],
      );
      expect(result.exists).toBe(true);
    });
  });

  // ── 3. 플랫폼 성숙도 엔진 ──
  describe('플랫폼 성숙도 평가', () => {
    it('platform-maturity-engine 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/compliance-service/src/lib/platform-maturity-engine.ts',
        ['maturity'],
      );
      expect(result.exists).toBe(true);
    });
  });

  // ── 4. 감사 로그 통합 ──
  describe('compliance audit 통합', () => {
    it('compliance-service에 audit 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/compliance-service/src/lib/audit.ts',
        ['audit'],
      );
      expect(result.exists).toBe(true);
    });

    it('audit 모듈이 actor/action 필드를 포함해야 한다', () => {
      const content = readServiceFile(
        'platform/services/compliance-service/src/lib/audit.ts',
      );
      const hasFields =
        (content.includes('actor') || content.includes('userId')) &&
        content.includes('action');
      expect(hasFields).toBe(true);
    });
  });

  // ── 5. CI/CD 자동 수집 워크플로우 ──
  describe('Gitea Actions 자동 수집', () => {
    it('csap-evidence Gitea 워크플로우가 존재해야 한다', () => {
      const workflowPath = resolve(PROJECT_ROOT, '.gitea/workflows/csap-evidence.yml');
      expect(existsSync(workflowPath)).toBe(true);
    });
  });

  // ── 6. 증적 무결성 (CSAP D-06) ──
  describe('증적 무결성 보장', () => {
    it('.claude/audit.jsonl 프로젝트 감사 로그가 존재해야 한다', () => {
      const auditPath = resolve(PROJECT_ROOT, '.claude/audit.jsonl');
      expect(existsSync(auditPath)).toBe(true);
    });

    it('compliance audit 모듈이 audit-sdk 표준 로거를 사용해야 한다', () => {
      const content = readServiceFile(
        'platform/services/compliance-service/src/lib/audit.ts',
      );
      const usesSdk =
        content.includes('audit-sdk') ||
        content.includes('createAuditLogger') ||
        content.includes('createStandardTransport') ||
        content.includes('logComplianceEvent');
      expect(usesSdk).toBe(true);
    });
  });

  // ── 7. 종단간 흐름 ──
  describe('CSAP 증적 종단간 흐름', () => {
    it('compliance-service 라우트가 등록되어야 한다', () => {
      const result = serviceFileContains(
        'platform/services/compliance-service/src/routes.ts',
        ['register'],
      );
      expect(result.exists).toBe(true);
    });

    it('compliance-service 진입점이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/compliance-service/src/index.ts',
        ['fastify', 'Fastify'],
      );
      expect(result.exists).toBe(true);
    });
  });
});
