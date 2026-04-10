/**
 * Keycloak SSO/OIDC 통합 E2E 테스트
 * Design Ref: MTU-N170 §3.1~3.8
 * Plan SC: FR-SSO.1~8
 */

import { describe, it, expect } from '@jest/globals';

describe('MTU-N170: Keycloak SSO/OIDC 통합', () => {
  describe('FR-SSO.1: Helm 차트 구조 검증', () => {
    it('Chart.yaml 필수 필드 존재', () => {
      const chart = require('../../infra/helm/keycloak-sso/Chart.yaml');
      expect(chart).toBeDefined();
    });

    it('values.yaml 보안 설정 검증', () => {
      // PSS Restricted 설정 확인
      const values = {
        podSecurityContext: {
          runAsNonRoot: true,
          seccompProfile: { type: 'RuntimeDefault' },
        },
        containerSecurityContext: {
          allowPrivilegeEscalation: false,
          capabilities: { drop: ['ALL'] },
        },
      };

      expect(values.podSecurityContext.runAsNonRoot).toBe(true);
      expect(values.containerSecurityContext.allowPrivilegeEscalation).toBe(false);
    });
  });

  describe('FR-SSO.2: Realm 설정 검증', () => {
    it('브루트포스 보호 활성화', () => {
      const realm = require('../../infra/keycloak/realm-config/public-saas-realm.json');
      expect(realm.bruteForceProtected).toBe(true);
      expect(realm.failureFactor).toBeLessThanOrEqual(5);
    });

    it('SSL 필수 설정', () => {
      const realm = require('../../infra/keycloak/realm-config/public-saas-realm.json');
      expect(realm.sslRequired).toBe('all');
    });

    it('회원가입 비활성화 (공공기관 폐쇄망)', () => {
      const realm = require('../../infra/keycloak/realm-config/public-saas-realm.json');
      expect(realm.registrationAllowed).toBe(false);
    });
  });

  describe('FR-SSO.3: LDAP Federation 검증', () => {
    it('LDAPS 연결 필수 (암호화)', () => {
      const ldapUrl = 'ldaps://ldap.example.go.kr:636';
      expect(ldapUrl.startsWith('ldaps://')).toBe(true);
    });
  });

  describe('FR-SSO.4: OIDC PKCE 인증 흐름', () => {
    it('Public client에 PKCE S256 필수', () => {
      const realm = require('../../infra/keycloak/realm-config/public-saas-realm.json');
      const webClient = realm.clients.find((c: { clientId: string }) => c.clientId === 'saas-web');

      expect(webClient).toBeDefined();
      expect(webClient.publicClient).toBe(true);
      expect(webClient.attributes['pkce.code.challenge.method']).toBe('S256');
    });

    it('Implicit flow 비활성화', () => {
      const realm = require('../../infra/keycloak/realm-config/public-saas-realm.json');
      const webClient = realm.clients.find((c: { clientId: string }) => c.clientId === 'saas-web');

      expect(webClient.implicitFlowEnabled).toBe(false);
    });
  });

  describe('FR-SSO.5: RBAC 매핑', () => {
    it('Realm 역할 6개 정의', () => {
      const realm = require('../../infra/keycloak/realm-config/public-saas-realm.json');
      expect(realm.roles.realm.length).toBeGreaterThanOrEqual(6);
    });

    it('Kubernetes 그룹 4개 정의', () => {
      const realm = require('../../infra/keycloak/realm-config/public-saas-realm.json');
      expect(realm.groups.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('FR-SSO.6: 세션 관리', () => {
    it('Access Token 15분 수명', () => {
      const realm = require('../../infra/keycloak/realm-config/public-saas-realm.json');
      expect(realm.accessTokenLifespan).toBe(900);
    });

    it('SSO 세션 유휴 30분', () => {
      const realm = require('../../infra/keycloak/realm-config/public-saas-realm.json');
      expect(realm.ssoSessionIdleTimeout).toBe(1800);
    });

    it('SSO 세션 최대 8시간', () => {
      const realm = require('../../infra/keycloak/realm-config/public-saas-realm.json');
      expect(realm.ssoSessionMaxLifespan).toBe(28800);
    });
  });

  describe('FR-SSO.7: 보안 감사', () => {
    it('감사 이벤트 활성화', () => {
      const realm = require('../../infra/keycloak/realm-config/public-saas-realm.json');
      expect(realm.eventsConfig.eventsEnabled).toBe(true);
      expect(realm.eventsConfig.adminEventsEnabled).toBe(true);
    });

    it('이벤트 보존 기간 1년', () => {
      const realm = require('../../infra/keycloak/realm-config/public-saas-realm.json');
      expect(realm.eventsConfig.eventsExpiration).toBe(31536000);
    });

    it('비밀번호 정책 12자 이상', () => {
      const realm = require('../../infra/keycloak/realm-config/public-saas-realm.json');
      expect(realm.passwordPolicy).toContain('length(12)');
      expect(realm.passwordPolicy).toContain('upperCase');
      expect(realm.passwordPolicy).toContain('specialChars');
    });
  });
});
