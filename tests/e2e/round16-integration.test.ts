/**
 * 16라운드 통합 테스트
 * Design Ref: MTU-N180
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('MTU-N180: 16라운드 통합 테스트', () => {
  describe('N175: OTel Auto-Instrumentation', () => {
    it('Helm 차트 완전성', () => {
      const helmDir = path.resolve(__dirname, '../../infra/helm/otel-stack');
      expect(fs.existsSync(path.join(helmDir, 'Chart.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(helmDir, 'values.yaml'))).toBe(true);
    });

    it('Auto-Instrumentation CRD 존재', () => {
      expect(
        fs.existsSync(path.resolve(__dirname, '../../infra/helm/otel-stack/templates/auto-instrumentation.yaml')),
      ).toBe(true);
    });

    it('2티어 Collector 구성', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../infra/helm/otel-stack/templates/collector-agent.yaml'))).toBe(
        true,
      );
      expect(
        fs.existsSync(path.resolve(__dirname, '../../infra/helm/otel-stack/templates/collector-gateway.yaml')),
      ).toBe(true);
    });

    it('PII 마스킹 설정 포함', () => {
      const content = fs.readFileSync(path.resolve(__dirname, '../../infra/helm/otel-stack/values.yaml'), 'utf8');
      expect(content).toContain('pii-mask');
    });
  });

  describe('N176: Hubble Network Observability', () => {
    it('Hubble Helm 차트 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../infra/helm/hubble-observability/Chart.yaml'))).toBe(true);
    });

    it('Grafana 네트워크 대시보드 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../infra/grafana/dashboards/hubble-network.json'))).toBe(true);
    });
  });

  describe('N177: Tech Debt Scanner', () => {
    it('스캐너 소스 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../packages/tech-debt-scanner/src/scanner.ts'))).toBe(true);
    });

    it('테스트 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../packages/tech-debt-scanner/tests/scanner.test.ts'))).toBe(
        true,
      );
    });
  });

  describe('N178: SLO Escalation', () => {
    it('에스컬레이션 컨트롤러 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../packages/slo-escalation/src/escalation-controller.ts'))).toBe(
        true,
      );
    });

    it('AlertManager 정책 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../infra/alertmanager/escalation-policy.yaml'))).toBe(true);
    });
  });

  describe('N179: Unified Audit Trail', () => {
    it('감사 수집기 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../packages/audit-collector/src/collector.ts'))).toBe(true);
    });

    it('해시 체인 무결성 기능 포함', () => {
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../packages/audit-collector/src/collector.ts'),
        'utf8',
      );
      expect(content).toContain('verifyIntegrity');
      expect(content).toContain('computeHash');
    });

    it('CSAP D-06 증적 생성 기능 포함', () => {
      const content = fs.readFileSync(
        path.resolve(__dirname, '../../packages/audit-collector/src/collector.ts'),
        'utf8',
      );
      expect(content).toContain('generateCSAPEvidence');
    });
  });

  describe('보안 준수 (전체)', () => {
    it('모든 values.yaml에 PSS Restricted 설정', () => {
      const files = ['infra/helm/otel-stack/values.yaml', 'infra/helm/hubble-observability/values.yaml'];
      for (const file of files) {
        const content = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
        expect(content).toContain('runAsNonRoot: true');
      }
    });
  });

  describe('아카이브 완전성', () => {
    it('16라운드 MTU 전체 아카이브', () => {
      const mtus = [
        'MTU-N175-otel-auto-instrumentation',
        'MTU-N176-hubble-network-observability',
        'MTU-N177-tech-debt-measurement',
        'MTU-N178-slo-auto-escalation',
        'MTU-N179-unified-audit-trail',
      ];
      for (const mtu of mtus) {
        expect(fs.existsSync(path.resolve(__dirname, `../../docs/archive/2026-04/${mtu}`))).toBe(true);
      }
    });
  });
});
