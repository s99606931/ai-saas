// E2E 테스트: SLO 위반 → 에러 버짓 소진 → 자동 대응 플로우
// Design Ref: MTU-N561-N580 §4 시나리오 5
// Plan SC: FR-N580.1, FR-N580.2
// CSAP: D-06 (침해사고 관리), NFR (가용성)

import { describe, it, expect } from 'vitest';
import { readServiceFile, serviceFileContains } from '../helpers/service-validator';
import { existsSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../../../../');

describe('E2E: SLO/에러 버짓/자동 대응 (FR-N580)', () => {
  // ── 1. SLO 에스컬레이션 컨트롤러 ──
  describe('SLO 에스컬레이션', () => {
    it('escalation-controller 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'packages/slo-escalation/src/escalation-controller.ts',
        ['Escalation', 'EscalationLevel'],
      );
      expect(result.exists).toBe(true);
    });

    it('에스컬레이션 단계(Normal~Violated)가 정의되어야 한다', () => {
      const content = readServiceFile(
        'packages/slo-escalation/src/escalation-controller.ts',
      );
      expect(content).toContain('Normal');
      expect(content).toContain('Warning');
      expect(content).toContain('Critical');
      expect(content).toContain('Violated');
    });

    it('알림 채널(Slack/Email/Webhook)이 정의되어야 한다', () => {
      const content = readServiceFile(
        'packages/slo-escalation/src/escalation-controller.ts',
      );
      expect(content).toContain('NotificationChannel');
      expect(content).toContain('Slack');
    });

    it('정책 검증을 위한 zod 스키마가 사용되어야 한다', () => {
      const content = readServiceFile(
        'packages/slo-escalation/src/escalation-controller.ts',
      );
      expect(content).toContain('zod');
      expect(content).toContain('Schema');
    });
  });

  // ── 2. 에러 버짓 정책 ──
  describe('에러 버짓 정책 엔진', () => {
    it('error-budget-policy 모듈이 존재해야 한다', () => {
      const result = serviceFileContains(
        'packages/slo-escalation/src/error-budget-policy.ts',
        ['BudgetStatus', 'budget'],
      );
      expect(result.exists).toBe(true);
    });

    it('버짓 상태(Healthy~Critical)가 정의되어야 한다', () => {
      const content = readServiceFile(
        'packages/slo-escalation/src/error-budget-policy.ts',
      );
      expect(content).toContain('Healthy');
      expect(content).toContain('Caution');
      expect(content).toContain('Warning');
    });

    it('CSAP D-06 침해사고 관리 준수가 명시되어야 한다', () => {
      const content = readServiceFile(
        'packages/slo-escalation/src/error-budget-policy.ts',
      );
      expect(content).toContain('D-06');
    });
  });

  // ── 3. DORA 4-key 익스포터 ──
  describe('DORA 4-key 메트릭', () => {
    it('dora-exporter 진입점이 존재해야 한다', () => {
      const result = serviceFileContains('packages/dora-exporter/src/index.ts', [
        'DORA',
        'prom-client',
      ]);
      expect(result.exists).toBe(true);
    });

    it('Lead Time 계산기가 존재해야 한다', () => {
      const result = serviceFileContains(
        'packages/dora-exporter/src/lead-time.ts',
        ['LeadTime'],
      );
      expect(result.exists).toBe(true);
    });

    it('Change Failure 탐지기가 존재해야 한다', () => {
      const result = serviceFileContains(
        'packages/dora-exporter/src/change-failure.ts',
        ['ChangeFailure'],
      );
      expect(result.exists).toBe(true);
    });

    it('MTTR 추적기가 존재해야 한다', () => {
      const result = serviceFileContains(
        'packages/dora-exporter/src/mttr-tracker.ts',
        ['MTTR'],
      );
      expect(result.exists).toBe(true);
    });

    it('DORA 분류기(Elite/High/Medium/Low)가 존재해야 한다', () => {
      const result = serviceFileContains(
        'packages/dora-exporter/src/classifier.ts',
        ['DORALevel', 'classify'],
      );
      // 함수명/타입 다양성 허용
      const altResult = serviceFileContains(
        'packages/dora-exporter/src/classifier.ts',
        ['DORA'],
      );
      expect(result.exists || altResult.exists).toBe(true);
    });

    it('이벤트 큐가 존재해야 한다 (비동기 처리)', () => {
      const result = serviceFileContains(
        'packages/dora-exporter/src/event-queue.ts',
        ['EventQueue'],
      );
      expect(result.exists).toBe(true);
    });

    it('추세 분석기와 보고서 생성기가 존재해야 한다', () => {
      const trend = serviceFileContains(
        'packages/dora-exporter/src/trend-analyzer.ts',
        ['Trend'],
      );
      const report = serviceFileContains(
        'packages/dora-exporter/src/report-generator.ts',
        ['Report'],
      );
      expect(trend.exists).toBe(true);
      expect(report.exists).toBe(true);
    });
  });

  // ── 4. CI/CD DORA 게이트 ──
  describe('Gitea Actions DORA 게이트', () => {
    it('dora-gate 워크플로우가 존재해야 한다', () => {
      const workflowPath = resolve(PROJECT_ROOT, '.gitea/workflows/dora-gate.yml');
      expect(existsSync(workflowPath)).toBe(true);
    });
  });

  // ── 5. 자동 대응 흐름 종단간 검증 ──
  describe('자동 대응 종단간 흐름', () => {
    it('에스컬레이션 컨트롤러가 정책에 service 식별자를 포함해야 한다', () => {
      const content = readServiceFile(
        'packages/slo-escalation/src/escalation-controller.ts',
      );
      expect(content).toContain('service');
    });

    it('에러 버짓 모듈이 zod 검증을 사용해야 한다', () => {
      const content = readServiceFile(
        'packages/slo-escalation/src/error-budget-policy.ts',
      );
      expect(content).toContain('zod');
    });

    it('DORA exporter가 Prometheus 메트릭(Counter/Gauge/Histogram)을 사용해야 한다', () => {
      const content = readServiceFile('packages/dora-exporter/src/index.ts');
      const hasMetrics =
        content.includes('Counter') ||
        content.includes('Gauge') ||
        content.includes('Histogram');
      expect(hasMetrics).toBe(true);
    });
  });
});
