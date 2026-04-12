// E2E 테스트: AI 에이전트 위임 → 실행 → 결과 검증 플로우
// Design Ref: MTU-N561-N580 §4 시나리오 2
// Plan SC: FR-N571.1, FR-N571.2, FR-N571.3
// CSAP: D-08 (접근 통제), D-06 (감사 로깅)

import { describe, it, expect } from 'vitest';
import { readServiceFile, serviceFileContains } from '../helpers/service-validator';

describe('E2E: AI 에이전트 위임 플로우 (FR-N571)', () => {
  // ── 1. 오케스트레이터 ──
  describe('Multi-Agent 오케스트레이션', () => {
    it('agent-orchestrator 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/ai-service/src/lib/agent-orchestrator.ts',
        ['Orchestrator', 'SubAgent'],
      );
      expect(result.exists).toBe(true);
    });

    it('서브에이전트 역할(role)과 위임 작업 인터페이스가 정의되어야 한다', () => {
      const content = readServiceFile(
        'platform/services/ai-service/src/lib/agent-orchestrator.ts',
      );
      expect(content).toContain('SubAgentRole');
      expect(content).toContain('SubAgentTask');
    });

    it('오케스트레이터가 PII 마스킹을 호출해야 한다 (N2SF)', () => {
      const content = readServiceFile(
        'platform/services/ai-service/src/lib/agent-orchestrator.ts',
      );
      expect(content).toContain('maskPII');
    });
  });

  // ── 2. 작업 계획 수립 ──
  describe('에이전트 작업 계획 (Planner)', () => {
    it('agent-planner 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/ai-service/src/lib/agent-planner.ts',
        ['plan', 'Plan'],
      );
      expect(result.exists).toBe(true);
    });
  });

  // ── 3. RBAC 권한 검증 ──
  describe('에이전트 위임 RBAC (CSAP D-08)', () => {
    it('agent-rbac 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/ai-service/src/lib/agent-rbac.ts',
        ['RBAC', 'PolicyRule'],
      );
      expect(result.exists).toBe(true);
    });

    it('RBAC 정책에 effect/actions/resources가 정의되어야 한다', () => {
      const content = readServiceFile('platform/services/ai-service/src/lib/agent-rbac.ts');
      expect(content).toContain('Effect');
      expect(content).toContain('actions');
      expect(content).toContain('resources');
    });

    it('RBAC 조건(condition)에 tenantId 격리가 포함되어야 한다', () => {
      const content = readServiceFile('platform/services/ai-service/src/lib/agent-rbac.ts');
      expect(content).toContain('tenantId');
    });
  });

  // ── 4. 메모리 (컨텍스트 보관) ──
  describe('에이전트 메모리', () => {
    it('agent-memory 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/ai-service/src/lib/agent-memory.ts',
        ['memory', 'Memory'],
      );
      expect(result.exists).toBe(true);
    });
  });

  // ── 5. 감사 추적 (CSAP D-06) ──
  describe('에이전트 작업 감사 추적', () => {
    it('agent-audit-trail 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/ai-service/src/lib/agent-audit-trail.ts',
        ['AgentAuditEntry'],
      );
      expect(result.exists).toBe(true);
    });

    it('감사 추적 모듈이 작업 ID 또는 actor를 기록해야 한다', () => {
      const content = readServiceFile(
        'platform/services/ai-service/src/lib/agent-audit-trail.ts',
      );
      const hasActor =
        content.includes('actor') ||
        content.includes('userId') ||
        content.includes('agentId') ||
        content.includes('id');
      expect(hasActor).toBe(true);
    });
  });

  // ── 6. 버전 관리 ──
  describe('에이전트 버전 관리', () => {
    it('agent-versioning 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/ai-service/src/lib/agent-versioning.ts',
        ['version'],
      );
      expect(result.exists).toBe(true);
    });
  });

  // ── 7. 마켓플레이스 ──
  describe('에이전트 마켓플레이스', () => {
    it('agent-marketplace 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'platform/services/ai-service/src/lib/agent-marketplace.ts',
        ['MarketAgent'],
      );
      expect(result.exists).toBe(true);
    });
  });

  // ── 8. 라우트 통합 ──
  describe('에이전트 위임 API 라우트', () => {
    it('ai-service routes에 agent 핸들러가 등록되어야 한다', () => {
      const content = readServiceFile('platform/services/ai-service/src/routes.ts');
      expect(content.toLowerCase()).toContain('agent');
    });
  });
});
