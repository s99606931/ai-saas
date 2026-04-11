// GitOps 드리프트 감지 단위 테스트 -- MTU-N273
import { describe, it, expect } from 'vitest';
import {
  normalizeDesiredState,
  detectDrifts,
  addRemediationRule,
  remediate,
  analyzeImpact,
  getDriftAuditLog,
  type ResourceState,
} from '../../src/lib/gitops-drift-detector';

const DESIRED: ResourceState[] = [
  { kind: 'Deployment', name: 'api-gateway', namespace: 'default', properties: { replicas: 3, 'spec.image': 'api:v1.2' } },
  { kind: 'Service', name: 'api-svc', namespace: 'default', properties: { port: 8080, type: 'ClusterIP' } },
  { kind: 'NetworkPolicy', name: 'deny-all', namespace: 'default', properties: { 'spec.policyTypes': ['Ingress', 'Egress'] } },
];

const ACTUAL: ResourceState[] = [
  { kind: 'Deployment', name: 'api-gateway', namespace: 'default', properties: { replicas: 2, 'spec.image': 'api:v1.1' } },
  { kind: 'Service', name: 'api-svc', namespace: 'default', properties: { port: 8080, type: 'ClusterIP' } },
  // NetworkPolicy 누락!
];

describe('GitOps 드리프트 감지', () => {
  describe('normalizeDesiredState', () => {
    it('리소스를 정규화해야 한다', () => {
      const resources = [
        { kind: 'Deployment', metadata: { name: 'app', namespace: 'prod' }, spec: { replicas: 3 } },
      ];
      const normalized = normalizeDesiredState(resources);
      expect(normalized[0].kind).toBe('Deployment');
      expect(normalized[0].name).toBe('app');
    });
  });

  describe('detectDrifts', () => {
    it('드리프트를 감지해야 한다', () => {
      const report = detectDrifts(DESIRED, ACTUAL, 'scanner');
      expect(report.drifts.length).toBeGreaterThan(0);
      expect(report.driftedResources).toBeGreaterThan(0);
    });

    it('누락된 리소스를 감지해야 한다', () => {
      const report = detectDrifts(DESIRED, ACTUAL, 'scanner');
      const missingDrift = report.drifts.find(
        (d) => d.resourceName === 'deny-all' && d.actualValue === 'missing'
      );
      expect(missingDrift).toBeDefined();
      if (missingDrift) {
        expect(missingDrift.severity).toBe('critical');
      }
    });

    it('값 변경을 감지해야 한다', () => {
      const report = detectDrifts(DESIRED, ACTUAL, 'scanner');
      const replicaDrift = report.drifts.find(
        (d) => d.resourceName === 'api-gateway' && d.field === 'replicas'
      );
      expect(replicaDrift).toBeDefined();
      if (replicaDrift) {
        expect(replicaDrift.declaredValue).toBe(3);
        expect(replicaDrift.actualValue).toBe(2);
      }
    });

    it('동일한 상태에서 드리프트가 없어야 한다', () => {
      const report = detectDrifts(DESIRED, DESIRED, 'scanner');
      expect(report.drifts.length).toBe(0);
    });

    it('요약 정보를 포함해야 한다', () => {
      const report = detectDrifts(DESIRED, ACTUAL, 'scanner');
      expect(report.summary).toBeDefined();
      expect(report.totalResources).toBe(3);
    });
  });

  describe('remediate', () => {
    it('자동 수정 규칙을 적용해야 한다', () => {
      addRemediationRule({
        category: 'configuration',
        severity: 'info',
        policy: 'auto_fix',
        description: '구성 드리프트 자동 수정',
        isActive: true,
      });

      const report = detectDrifts(DESIRED, ACTUAL, 'scanner');
      const configDrift = report.drifts.find((d) => d.category === 'configuration');
      if (configDrift) {
        const result = remediate(configDrift, 'system');
        expect(result.status).toBe('fixed');
      }
    });

    it('보안 드리프트에 수동 승인을 요구할 수 있어야 한다', () => {
      addRemediationRule({
        category: 'security',
        severity: 'critical',
        policy: 'manual_approval',
        description: '보안 드리프트 수동 승인',
        isActive: true,
      });

      const report = detectDrifts(DESIRED, ACTUAL, 'scanner');
      const securityDrift = report.drifts.find((d) => d.category === 'security');
      if (securityDrift) {
        const result = remediate(securityDrift, 'system');
        expect(result.status).toBe('pending_approval');
      }
    });
  });

  describe('analyzeImpact', () => {
    it('영향 분석을 수행해야 한다', () => {
      const report = detectDrifts(DESIRED, ACTUAL, 'scanner');
      if (report.drifts.length > 0) {
        const impact = analyzeImpact(report.drifts[0]);
        expect(impact.affectedServices.length).toBeGreaterThan(0);
        expect(impact.recommendation).toBeDefined();
      }
    });
  });

  describe('감사 로그', () => {
    it('모든 스캔이 기록되어야 한다', () => {
      const log = getDriftAuditLog();
      expect(log.length).toBeGreaterThan(0);
    });
  });
});
