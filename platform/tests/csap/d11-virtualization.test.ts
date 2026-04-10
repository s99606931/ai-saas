// CSAP 검증 테스트: D-11 가상화 보안
// Design Ref: DESIGN-MTU-P21
// CSAP: D-11 가상화 보안 (4개 항목)
// Plan SC: FR-CSAP4.3

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../../../');

describe('CSAP D-11: 가상화 보안 — Dockerfile 검증', () => {
  // docker-compose.yml + build-all.sh 기준 16개 서비스 (saas-catalog-service -> catalog-service 전환 완료)
  const services = [
    'auth-service',
    'user-service',
    'tenant-service',
    'api-gateway',
    'ai-service',
    'audit-service',
    'billing-service',
    'catalog-service',
    'compliance-service',
    'crm-service',
    'file-service',
    'menu-service',
    'notification-service',
    'security-monitor-service',
    'security-service',
    'subscription-service',
  ];

  for (const service of services) {
    const dockerfilePath = resolve(PROJECT_ROOT, `platform/services/${service}/Dockerfile`);

    describe(`${service} Dockerfile`, () => {
      it('D-11-01: Dockerfile 존재 확인', () => {
        expect(existsSync(dockerfilePath)).toBe(true);
      });

      it('D-11-02: non-root 사용자 실행', () => {
        if (!existsSync(dockerfilePath)) return;
        const content = readFileSync(dockerfilePath, 'utf-8');

        // USER 지시어가 root가 아닌 사용자로 설정되어 있는지 확인
        const userMatch = content.match(/^USER\s+(\S+)/m);
        expect(userMatch).toBeTruthy();
        expect(userMatch![1]).not.toBe('root');
      });

      it('D-11-03: 멀티스테이지 빌드 사용 (빌드/실행 분리)', () => {
        if (!existsSync(dockerfilePath)) return;
        const content = readFileSync(dockerfilePath, 'utf-8');

        // FROM ... AS builder + FROM ... AS runner 패턴
        const fromCount = (content.match(/^FROM\s+/gm) ?? []).length;
        expect(fromCount).toBeGreaterThanOrEqual(2);
      });

      it('D-11-04: HEALTHCHECK 설정', () => {
        if (!existsSync(dockerfilePath)) return;
        const content = readFileSync(dockerfilePath, 'utf-8');

        // HEALTHCHECK 지시어 존재 확인
        expect(content).toContain('HEALTHCHECK');
      });
    });
  }
});

describe('CSAP D-11: 가상화 보안 — docker-compose 검증', () => {
  const composePath = resolve(PROJECT_ROOT, 'docker-compose.yml');

  it('D-11-05: docker-compose.yml 존재', () => {
    expect(existsSync(composePath)).toBe(true);
  });

  it('D-11-06: 네트워크 격리 설정', () => {
    const content = readFileSync(composePath, 'utf-8');

    // 전용 네트워크 사용 (bridge)
    expect(content).toContain('networks:');
    expect(content).toContain('saas-network');
    expect(content).toContain('driver: bridge');
  });

  it('D-11-07: 리소스 제한 설정 (memory limits)', () => {
    const content = readFileSync(composePath, 'utf-8');

    // 메모리 제한 설정 존재
    expect(content).toContain('memory:');
  });

  it('D-11-08: 인프라 서비스 헬스체크', () => {
    const content = readFileSync(composePath, 'utf-8');

    // PostgreSQL, Redis, MinIO의 healthcheck 설정 확인
    expect(content).toContain('pg_isready');
    expect(content).toContain('redis-cli');
  });

  it('D-11-09: 서비스 의존성 순서 (depends_on)', () => {
    const content = readFileSync(composePath, 'utf-8');

    // depends_on + condition: service_healthy 패턴
    expect(content).toContain('depends_on:');
    expect(content).toContain('condition: service_healthy');
  });
});

describe('CSAP D-11: 가상화 보안 — k8s 매니페스트 검증', () => {
  const microservicesPath = resolve(PROJECT_ROOT, 'k8s/services/microservices.yaml');
  const namespacePath = resolve(PROJECT_ROOT, 'k8s/config/namespace.yaml');

  it('D-11-10: k8s 네임스페이스 격리', () => {
    expect(existsSync(namespacePath)).toBe(true);
    const content = readFileSync(namespacePath, 'utf-8');
    expect(content).toContain('saas-platform');
  });

  it('D-11-11: k8s 리소스 제한 (resources.limits)', () => {
    const content = readFileSync(microservicesPath, 'utf-8');

    // 모든 Deployment에 resources.limits 설정 확인
    const deploymentBlocks = content.split('---').filter((b) => b.includes('kind: Deployment'));

    for (const block of deploymentBlocks) {
      expect(block).toContain('resources:');
      expect(block).toContain('limits:');
      expect(block).toContain('memory:');
    }
  });

  it('D-11-12: k8s readinessProbe 설정 (/ready 엔드포인트)', () => {
    const content = readFileSync(microservicesPath, 'utf-8');

    const deploymentBlocks = content.split('---').filter((b) => b.includes('kind: Deployment'));

    for (const block of deploymentBlocks) {
      expect(block).toContain('readinessProbe:');
      expect(block).toContain('/ready');
    }
  });

  it('D-11-14: k8s terminationGracePeriodSeconds 설정', () => {
    const content = readFileSync(microservicesPath, 'utf-8');

    const deploymentBlocks = content.split('---').filter((b) => b.includes('kind: Deployment'));

    for (const block of deploymentBlocks) {
      expect(block).toContain('terminationGracePeriodSeconds:');
    }
  });

  it('D-11-13: audit-service 고가용성 (replicas >= 2)', () => {
    const content = readFileSync(microservicesPath, 'utf-8');

    // audit-service는 감사 무결성을 위해 3 replicas + PDB
    expect(content).toContain('PodDisruptionBudget');
    expect(content).toContain('minAvailable: 2');
  });
});
