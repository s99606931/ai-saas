// CSAP 검증 테스트: D-07 가용성 — Graceful Shutdown + Readiness Probe
// Design Ref: DESIGN-MTU-P21
// CSAP: D-07 가용성 (서비스 연속성, 복구)
// Plan SC: FR-CSAP4.1

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../../../');

// DB 사용 서비스 (Prisma 의존) — saas-catalog-service 제외 (deprecated)
const DB_SERVICES = [
  'auth-service',
  'user-service',
  'tenant-service',
  'audit-service',
  'ai-service',
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

// 전체 Fastify 서비스 (api-gateway 포함)
const ALL_SERVICES = [...DB_SERVICES, 'api-gateway'];

describe('CSAP D-07: 가용성 — Graceful Shutdown', () => {
  for (const service of ALL_SERVICES) {
    const indexPath = resolve(
      PROJECT_ROOT,
      `platform/services/${service}/src/index.ts`,
    );

    it(`${service}: SIGTERM 핸들링 구현`, () => {
      expect(existsSync(indexPath)).toBe(true);
      const content = readFileSync(indexPath, 'utf-8');

      // SIGTERM 시그널 핸들러 등록 확인
      expect(content).toContain("process.on('SIGTERM'");
    });

    it(`${service}: SIGINT 핸들링 구현`, () => {
      const content = readFileSync(indexPath, 'utf-8');

      // SIGINT 시그널 핸들러 등록 확인
      expect(content).toContain("process.on('SIGINT'");
    });

    it(`${service}: app.close() 호출로 정상 종료`, () => {
      const content = readFileSync(indexPath, 'utf-8');

      // Fastify app.close() 호출 확인 (진행 중 요청 완료 대기)
      expect(content).toContain('app.close()');
    });
  }
});

describe('CSAP D-07: 가용성 — Readiness Probe (DB 연결 확인)', () => {
  for (const service of DB_SERVICES) {
    const indexPath = resolve(
      PROJECT_ROOT,
      `platform/services/${service}/src/index.ts`,
    );

    it(`${service}: /ready 엔드포인트 존재`, () => {
      const content = readFileSync(indexPath, 'utf-8');
      expect(content).toContain("'/ready'");
    });

    it(`${service}: DB 연결 확인 (SELECT 1)`, () => {
      const content = readFileSync(indexPath, 'utf-8');

      // Prisma $queryRaw로 DB 연결 확인
      expect(content).toContain('$queryRaw');
    });

    it(`${service}: DB 실패 시 503 반환`, () => {
      const content = readFileSync(indexPath, 'utf-8');

      // 503 상태 코드 반환 확인
      expect(content).toContain('503');
      expect(content).toContain("'not_ready'");
    });
  }

  // api-gateway는 다운스트림 서비스 헬스체크 방식
  it('api-gateway: /ready 엔드포인트 존재 (다운스트림 헬스 확인)', () => {
    const indexPath = resolve(
      PROJECT_ROOT,
      'platform/services/api-gateway/src/index.ts',
    );
    const content = readFileSync(indexPath, 'utf-8');
    expect(content).toContain("'/ready'");
    expect(content).toContain('checkServicesHealth');
  });
});

describe('CSAP D-07: 가용성 — k8s 구성 검증', () => {
  const microservicesPath = resolve(
    PROJECT_ROOT,
    'k8s/services/microservices.yaml',
  );

  it('모든 Deployment에 terminationGracePeriodSeconds 설정', () => {
    const content = readFileSync(microservicesPath, 'utf-8');

    const deploymentBlocks = content.split('---').filter((b) =>
      b.includes('kind: Deployment'),
    );

    expect(deploymentBlocks.length).toBeGreaterThanOrEqual(15);

    for (const block of deploymentBlocks) {
      expect(block).toContain('terminationGracePeriodSeconds:');
    }
  });

  it('readinessProbe가 /ready 엔드포인트를 사용', () => {
    const content = readFileSync(microservicesPath, 'utf-8');

    const deploymentBlocks = content.split('---').filter((b) =>
      b.includes('kind: Deployment'),
    );

    for (const block of deploymentBlocks) {
      // readinessProbe 섹션에서 /ready 경로 확인
      expect(block).toContain('readinessProbe:');
      const readinessMatch = block.match(
        /readinessProbe:[\s\S]*?path:\s*(\S+)/,
      );
      expect(readinessMatch).toBeTruthy();
      expect(readinessMatch![1]).toBe('/ready');
    }
  });

  it('livenessProbe는 /health 엔드포인트를 사용 (경량 확인)', () => {
    const content = readFileSync(microservicesPath, 'utf-8');

    const deploymentBlocks = content.split('---').filter((b) =>
      b.includes('kind: Deployment'),
    );

    for (const block of deploymentBlocks) {
      expect(block).toContain('livenessProbe:');
      const livenessMatch = block.match(
        /livenessProbe:[\s\S]*?path:\s*(\S+)/,
      );
      expect(livenessMatch).toBeTruthy();
      expect(livenessMatch![1]).toBe('/health');
    }
  });
});
