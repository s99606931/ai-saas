/**
 * 15라운드 통합 테스트
 * Design Ref: MTU-N174
 * 대상: N169(DORA) + N170(Keycloak) + N171(k6) + N172(GitOps) + N173(MLflow)
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('MTU-N174: 15라운드 통합 테스트', () => {
  describe('INT-1: DORA Metrics 컴포넌트 완전성', () => {
    it('DORA Exporter 소스 파일 존재', () => {
      const files = [
        'packages/dora-exporter/src/index.ts',
        'packages/dora-exporter/src/classifier.ts',
        'packages/dora-exporter/src/lead-time.ts',
        'packages/dora-exporter/src/change-failure.ts',
        'packages/dora-exporter/src/mttr-tracker.ts',
      ];
      for (const file of files) {
        expect(fs.existsSync(path.resolve(__dirname, '../..', file))).toBe(true);
      }
    });

    it('Grafana DORA 대시보드 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../infra/grafana/dashboards/dora-metrics.json'))).toBe(true);
    });

    it('DORA Helm 차트 완전성', () => {
      const helmDir = path.resolve(__dirname, '../../infra/helm/dora-metrics');
      expect(fs.existsSync(path.join(helmDir, 'Chart.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(helmDir, 'values.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(helmDir, 'templates/deployment.yaml'))).toBe(true);
    });
  });

  describe('INT-2: Keycloak SSO 컴포넌트 완전성', () => {
    it('Keycloak Helm 차트 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../infra/helm/keycloak-sso/Chart.yaml'))).toBe(true);
    });

    it('Realm 설정 파일 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../infra/keycloak/realm-config/public-saas-realm.json'))).toBe(
        true,
      );
    });

    it('RBAC 매핑 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../infra/helm/keycloak-sso/templates/rbac-mapping.yaml'))).toBe(
        true,
      );
    });

    it('Realm 관리 스크립트 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../scripts/keycloak/realm-export.sh'))).toBe(true);
      expect(fs.existsSync(path.resolve(__dirname, '../../scripts/keycloak/realm-import.sh'))).toBe(true);
    });
  });

  describe('INT-3: k6 성능 테스트 컴포넌트 완전성', () => {
    it('3가지 테스트 시나리오 존재', () => {
      const scenarios = ['smoke.js', 'load.js', 'soak.js'];
      for (const scenario of scenarios) {
        expect(fs.existsSync(path.resolve(__dirname, '../../tests/performance/scenarios', scenario))).toBe(true);
      }
    });

    it('공통 유틸리티 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../tests/performance/lib/utils.js'))).toBe(true);
      expect(fs.existsSync(path.resolve(__dirname, '../../tests/performance/lib/baselines.js'))).toBe(true);
    });

    it('k6-operator Helm 차트 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../infra/helm/k6-operator/Chart.yaml'))).toBe(true);
    });
  });

  describe('INT-4: GitOps 승격 게이트 완전성', () => {
    it('3개 환경 오버레이 존재', () => {
      const envs = ['dev', 'stg', 'prod'];
      for (const env of envs) {
        expect(fs.existsSync(path.resolve(__dirname, `../../infra/gitops/overlays/${env}/kustomization.yaml`))).toBe(
          true,
        );
      }
    });

    it('Flux Kustomization 정의 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../infra/gitops/flux-promotion-kustomizations.yaml'))).toBe(
        true,
      );
    });

    it('승격 스크립트 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../scripts/promotion/promote-to-stg.sh'))).toBe(true);
      expect(fs.existsSync(path.resolve(__dirname, '../../scripts/promotion/promote-to-prod.sh'))).toBe(true);
    });
  });

  describe('INT-5: MLflow 모델 레지스트리 완전성', () => {
    it('MLflow Helm 차트 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../infra/helm/mlflow/Chart.yaml'))).toBe(true);
    });

    it('모델 CI 파이프라인 코드 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../packages/ml-pipeline/src/model-ci.ts'))).toBe(true);
    });

    it('드리프트 감지 기능 포함', () => {
      const content = fs.readFileSync(path.resolve(__dirname, '../../packages/ml-pipeline/src/model-ci.ts'), 'utf8');
      expect(content).toContain('ModelDriftDetector');
      expect(content).toContain('calculatePSI');
    });
  });

  describe('INT-6: CSAP 보안 준수 (전체)', () => {
    it('모든 Helm 차트에 NetworkPolicy 설정', () => {
      const charts = [
        'infra/helm/dora-metrics/templates/networkpolicy.yaml',
        'infra/helm/keycloak-sso/templates/networkpolicy.yaml',
      ];
      for (const chart of charts) {
        expect(fs.existsSync(path.resolve(__dirname, '../..', chart))).toBe(true);
      }
    });

    it('모든 values.yaml에 PSS Restricted 설정', () => {
      const valueFiles = [
        'infra/helm/dora-metrics/values.yaml',
        'infra/helm/keycloak-sso/values.yaml',
        'infra/helm/mlflow/values.yaml',
      ];
      for (const file of valueFiles) {
        const content = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
        expect(content).toContain('runAsNonRoot: true');
        expect(content).toContain('allowPrivilegeEscalation: false');
      }
    });
  });

  describe('INT-7: 문서 완전성', () => {
    it('모든 MTU 아카이브 완료', () => {
      const mtus = [
        'MTU-N169-dora-metrics',
        'MTU-N170-keycloak-sso',
        'MTU-N171-k6-perf-regression',
        'MTU-N172-gitops-promotion-gates',
        'MTU-N173-mlflow-model-registry',
      ];
      for (const mtu of mtus) {
        expect(fs.existsSync(path.resolve(__dirname, `../../docs/archive/2026-04/${mtu}`))).toBe(true);
      }
    });
  });
});
