/**
 * GitOps 환경 승격 게이트 E2E 테스트
 * Design Ref: MTU-N172 §3.1~3.8
 * Plan SC: FR-PROMO.1~8
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const GITOPS_DIR = path.resolve(__dirname, '../../infra/gitops');

describe('MTU-N172: GitOps 환경 승격 게이트', () => {
  describe('FR-PROMO.1: 환경별 디렉토리 구조', () => {
    it('base 디렉토리 존재', () => {
      expect(fs.existsSync(path.join(GITOPS_DIR, 'base'))).toBe(true);
    });

    it('3개 환경 오버레이 존재', () => {
      const envs = ['dev', 'stg', 'prod'];
      for (const env of envs) {
        expect(fs.existsSync(path.join(GITOPS_DIR, 'overlays', env))).toBe(true);
      }
    });

    it('각 환경에 kustomization.yaml 존재', () => {
      const envs = ['dev', 'stg', 'prod'];
      for (const env of envs) {
        const filePath = path.join(GITOPS_DIR, 'overlays', env, 'kustomization.yaml');
        expect(fs.existsSync(filePath)).toBe(true);
      }
    });
  });

  describe('FR-PROMO.2: dev 환경 설정', () => {
    it('dev 환경 replica 1 (최소 리소스)', () => {
      const content = fs.readFileSync(path.join(GITOPS_DIR, 'overlays/dev/kustomization.yaml'), 'utf8');
      expect(content).toContain('value: 1');
    });

    it('dev 환경 디버그 로그 수준', () => {
      const content = fs.readFileSync(path.join(GITOPS_DIR, 'overlays/dev/kustomization.yaml'), 'utf8');
      expect(content).toContain('LOG_LEVEL=debug');
    });
  });

  describe('FR-PROMO.3: stg 환경 설정', () => {
    it('stg 환경 replica 2 (HA 기본)', () => {
      const content = fs.readFileSync(path.join(GITOPS_DIR, 'overlays/stg/kustomization.yaml'), 'utf8');
      expect(content).toContain('value: 2');
    });
  });

  describe('FR-PROMO.4: prod 환경 설정', () => {
    it('prod 환경 replica 3 (고가용성)', () => {
      const content = fs.readFileSync(path.join(GITOPS_DIR, 'overlays/prod/kustomization.yaml'), 'utf8');
      expect(content).toContain('value: 3');
    });

    it('prod 환경 topologySpreadConstraints 설정', () => {
      const content = fs.readFileSync(path.join(GITOPS_DIR, 'overlays/prod/kustomization.yaml'), 'utf8');
      expect(content).toContain('topologySpreadConstraints');
    });
  });

  describe('FR-PROMO.5: 승격 스크립트', () => {
    it('dev→stg 승격 스크립트 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../scripts/promotion/promote-to-stg.sh'))).toBe(true);
    });

    it('stg→prod 승격 스크립트 존재', () => {
      expect(fs.existsSync(path.resolve(__dirname, '../../scripts/promotion/promote-to-prod.sh'))).toBe(true);
    });

    it('프로덕션 승격에 CSAP 검증 게이트 포함', () => {
      const content = fs.readFileSync(path.resolve(__dirname, '../../scripts/promotion/promote-to-prod.sh'), 'utf8');
      expect(content).toContain('CSAP');
      expect(content).toContain('audit.jsonl');
    });
  });

  describe('FR-PROMO.7: Flux Kustomization', () => {
    it('Flux 환경별 Kustomization 정의 존재', () => {
      expect(fs.existsSync(path.join(GITOPS_DIR, 'flux-promotion-kustomizations.yaml'))).toBe(true);
    });

    it('prod가 stg에 의존', () => {
      const content = fs.readFileSync(path.join(GITOPS_DIR, 'flux-promotion-kustomizations.yaml'), 'utf8');
      expect(content).toContain('dependsOn');
      expect(content).toContain('saas-stg');
    });
  });
});
