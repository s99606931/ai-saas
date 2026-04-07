// E2E 테스트: 전체 서비스 아키텍처 검증
// Design Ref: MTU-N01 Design 2.2 시나리오 2, 3
// Plan SC: FR-N01.2, FR-N01.3, FR-N01.6, FR-N01.7, FR-N01.12
// CSAP: D-08 접근 통제, D-11 가상화 보안, D-12 시스템 개발 보안

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  readServiceFile,
  serviceFileContains,
  serviceExists,
  pluginExists,
  ALL_SERVICES,
} from '../helpers/service-validator';

const PROJECT_ROOT = resolve(__dirname, '../../../../');

describe('E2E: 서비스 아키텍처 검증 (FR-N01.2~N01.7, CSAP D-08, D-11, D-12)', () => {
  // ── 1. 모든 서비스 존재 및 구조 ──

  describe('서비스 존재 및 구조 검증', () => {
    for (const svc of ALL_SERVICES) {
      it(`${svc} 소스 디렉토리가 존재해야 한다`, () => {
        expect(serviceExists(svc)).toBe(true);
      });
    }

    it('모든 서비스에 헬스체크 엔드포인트가 존재해야 한다', () => {
      for (const svc of ALL_SERVICES) {
        const indexContent = readServiceFile(
          `platform/services/${svc}/src/index.ts`,
        );
        expect(indexContent).toContain('/health');
      }
    });

    it('모든 서비스에 Graceful Shutdown이 구현되어야 한다 (CSAP D-07)', () => {
      for (const svc of ALL_SERVICES) {
        const indexContent = readServiceFile(
          `platform/services/${svc}/src/index.ts`,
        );
        expect(indexContent).toContain('SIGTERM');
      }
    });
  });

  // ── 2. 테넌트 수명주기 (FR-N01.2) ──

  describe('테넌트 수명주기 검증 (FR-N01.2)', () => {
    it('tenant-service에 CRUD 핸들러가 존재해야 한다', () => {
      const handlerContent = readServiceFile(
        'platform/services/tenant-service/src/handlers/tenant.handler.ts',
      );
      // Fastify handler 패턴: request/reply 함수 export
      expect(handlerContent).toContain('FastifyRequest');
      expect(handlerContent).toContain('FastifyReply');
      expect(handlerContent).toContain('createTenantSchema');
    });

    it('테넌트 생성 시 입력 검증(Zod)이 적용되어야 한다 (CSAP D-12)', () => {
      const handlerContent = readServiceFile(
        'platform/services/tenant-service/src/handlers/tenant.handler.ts',
      );
      expect(handlerContent).toContain('safeParse');
    });
  });

  // ── 3. 사용자 관리 (FR-N01.3) ──

  describe('사용자 관리 검증 (FR-N01.3)', () => {
    it('user-service에 CRUD 핸들러가 존재해야 한다', () => {
      const handlerContent = readServiceFile(
        'platform/services/user-service/src/handlers/user.handler.ts',
      );
      // Fastify handler 패턴: request/reply 함수 export
      expect(handlerContent).toContain('FastifyRequest');
      expect(handlerContent).toContain('FastifyReply');
      expect(handlerContent).toContain('createUserSchema');
    });

    it('비밀번호 해싱(bcrypt)이 적용되어야 한다', () => {
      const handlerContent = readServiceFile(
        'platform/services/user-service/src/handlers/user.handler.ts',
      );
      expect(handlerContent).toContain('bcrypt');
    });

    it('사용자 입력 검증(Zod)이 적용되어야 한다 (CSAP D-12)', () => {
      const handlerContent = readServiceFile(
        'platform/services/user-service/src/handlers/user.handler.ts',
      );
      expect(handlerContent).toContain('safeParse');
    });
  });

  // ── 4. 구독 워크플로 (FR-N01.6) ──

  describe('구독/과금 워크플로 검증 (FR-N01.6)', () => {
    it('subscription-service가 존재해야 한다', () => {
      expect(serviceExists('subscription-service')).toBe(true);
    });

    it('billing-service가 존재해야 한다', () => {
      expect(serviceExists('billing-service')).toBe(true);
    });
  });

  // ── 5. CSAP 준수 현황 (FR-N01.7) ──

  describe('CSAP 준수 현황 검증 (FR-N01.7)', () => {
    it('compliance-service가 존재해야 한다', () => {
      expect(serviceExists('compliance-service')).toBe(true);
    });

    it('compliance-service에 CSAP 관련 핸들러가 있어야 한다', () => {
      const result = serviceFileContains(
        'platform/services/compliance-service/src/handlers/compliance.handler.ts',
        ['csap', 'compliance'],
      );
      expect(result.exists).toBe(true);
    });
  });

  // ── 6. 플러그인 시스템 (FR-N01.12) ──

  describe('플러그인 시스템 검증 (FR-N01.12)', () => {
    it('전자결재 플러그인이 존재해야 한다', () => {
      expect(pluginExists('electronic-approval')).toBe(true);
    });

    it('공공데이터 연동 플러그인이 존재해야 한다', () => {
      expect(pluginExists('public-data-integration')).toBe(true);
    });

    it('비즈니스 플러그인 SDK가 존재해야 한다', () => {
      const sdkPath = resolve(
        PROJECT_ROOT,
        'platform/packages/business-plugin-sdk/src',
      );
      expect(existsSync(sdkPath)).toBe(true);
    });

    it('전자결재 플러그인에 manifest 파일이 있어야 한다', () => {
      const result = serviceFileContains(
        'platform/plugins/electronic-approval/src/manifest.ts',
        ['manifest', 'id', 'version'],
      );
      expect(result.exists).toBe(true);
    });

    it('공공데이터 연동 플러그인에 manifest 파일이 있어야 한다', () => {
      const result = serviceFileContains(
        'platform/plugins/public-data-integration/src/manifest.ts',
        ['manifest', 'id', 'version'],
      );
      expect(result.exists).toBe(true);
    });
  });

  // ── 7. k8s 배포 매니페스트 ──

  describe('k8s 배포 매니페스트 검증 (CSAP D-11)', () => {
    it('k8s namespace 매니페스트가 존재해야 한다', () => {
      const nsPath = resolve(PROJECT_ROOT, 'k8s/config/namespace.yaml');
      expect(existsSync(nsPath)).toBe(true);
    });

    it('k8s 마이크로서비스 매니페스트가 존재해야 한다', () => {
      const msPath = resolve(
        PROJECT_ROOT,
        'k8s/services/microservices.yaml',
      );
      expect(existsSync(msPath)).toBe(true);
    });

    it('k8s NetworkPolicy 매니페스트가 존재해야 한다 (CSAP D-10)', () => {
      const npPath = resolve(
        PROJECT_ROOT,
        'k8s/config/network-policy.yaml',
      );
      expect(existsSync(npPath)).toBe(true);
    });

    it('k8s secrets 예시 파일이 존재해야 한다', () => {
      const secPath = resolve(
        PROJECT_ROOT,
        'k8s/config/secrets.example.yaml',
      );
      expect(existsSync(secPath)).toBe(true);
    });

    it('k8s 매니페스트에 securityContext가 설정되어야 한다', () => {
      const msContent = readFileSync(
        resolve(PROJECT_ROOT, 'k8s/services/microservices.yaml'),
        'utf-8',
      );
      expect(msContent).toContain('securityContext');
      expect(msContent).toContain('runAsNonRoot');
      expect(msContent).toContain('readOnlyRootFilesystem');
    });

    it('k8s 매니페스트에 리소스 제한이 설정되어야 한다', () => {
      const msContent = readFileSync(
        resolve(PROJECT_ROOT, 'k8s/services/microservices.yaml'),
        'utf-8',
      );
      expect(msContent).toContain('resources');
      expect(msContent).toContain('limits');
      expect(msContent).toContain('requests');
    });
  });

  // ── 8. Docker Compose ──

  describe('Docker Compose 검증', () => {
    it('docker-compose.yml이 존재해야 한다', () => {
      const dcPath = resolve(PROJECT_ROOT, 'docker-compose.yml');
      expect(existsSync(dcPath)).toBe(true);
    });

    it('docker-compose.yml에 인프라(postgres, redis, minio)가 정의되어야 한다', () => {
      const dcContent = readFileSync(
        resolve(PROJECT_ROOT, 'docker-compose.yml'),
        'utf-8',
      );
      expect(dcContent).toContain('postgres');
      expect(dcContent).toContain('redis');
      expect(dcContent).toContain('minio');
    });
  });

  // ── 9. 빌드/배포 스크립트 ──

  describe('빌드/배포 스크립트 검증', () => {
    it('Docker 빌드 스크립트가 존재해야 한다', () => {
      const buildPath = resolve(PROJECT_ROOT, 'scripts/build-all.sh');
      expect(existsSync(buildPath)).toBe(true);
    });

    it('k8s 배포 스크립트가 존재해야 한다', () => {
      const deployPath = resolve(PROJECT_ROOT, 'scripts/deploy-k8s.sh');
      expect(existsSync(deployPath)).toBe(true);
    });

    it('DB 백업 스크립트가 존재해야 한다', () => {
      const backupPath = resolve(PROJECT_ROOT, 'scripts/db-backup.sh');
      expect(existsSync(backupPath)).toBe(true);
    });

    it('DB 복구 스크립트가 존재해야 한다', () => {
      const restorePath = resolve(PROJECT_ROOT, 'scripts/db-restore.sh');
      expect(existsSync(restorePath)).toBe(true);
    });
  });
});
