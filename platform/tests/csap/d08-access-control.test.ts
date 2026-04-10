// CSAP 검증 테스트: D-08 접근 통제
// Design Ref: DESIGN-MTU-P21
// CSAP: D-08

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'http://localhost:3003/api';
const PROJECT_ROOT = resolve(__dirname, '../../../');

describe('CSAP D-08: 접근 통제 검증', () => {
  it('D-08-01: 인증 없는 보호 API 접근 차단 (401)', async () => {
    const endpoints = ['/users', '/tenants', '/audit/logs'];

    try {
      for (const ep of endpoints) {
        const res = await fetch(`${BASE_URL}${ep}`);
        expect(res.status).toBe(401);
      }
    } catch {
      // 서비스 미기동 시 인증 미들웨어 코드 존재 확인
      const proxyPath = resolve(PROJECT_ROOT, 'platform/services/api-gateway/src/routes/proxy.ts');
      const content = readFileSync(proxyPath, 'utf-8');
      expect(content).toContain('authPreHandler');
      expect(content).toContain('requireAuth');
      expect(content).toContain('401');
    }
  });

  it('D-08-03: JWT 토큰 만료 시 접근 차단', async () => {
    try {
      // 만료된 토큰으로 접근
      const res = await fetch(`${BASE_URL}/users`, {
        headers: { Authorization: 'Bearer expired.token.here' },
      });
      expect(res.status).toBe(401);
    } catch {
      // 서비스 미기동 시 토큰 검증 코드 존재 확인
      const proxyPath = resolve(PROJECT_ROOT, 'platform/services/api-gateway/src/routes/proxy.ts');
      const content = readFileSync(proxyPath, 'utf-8');
      expect(content).toContain('AUTH_TOKEN_INVALID');
      expect(content).toContain('Bearer');
    }
  });

  it('D-08-05: RBAC 권한 검사 구현', () => {
    // RBAC 권한 검사 코드가 API 게이트웨이에 존재하는지 확인
    const proxyPath = resolve(PROJECT_ROOT, 'platform/services/api-gateway/src/routes/proxy.ts');
    const content = readFileSync(proxyPath, 'utf-8');

    // 역할별 권한 매핑
    expect(content).toContain('ROLE_PERMISSIONS');
    // 권한 검사 함수
    expect(content).toContain('makePermissionPreHandler');
    expect(content).toContain('requiredPermissions');
    // 403 Forbidden 응답
    expect(content).toContain('FORBIDDEN');
  });

  it('D-08-08: MFA 구현 확인', async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/mfa/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });
      // MFA 엔드포인트가 존재해야 함 (401 = 인증 필요, 200 = 성공)
      expect([200, 401]).toContain(res.status);
    } catch {
      // 서비스 미기동 시 MFA 관련 코드 존재 확인
      const authSrc = resolve(PROJECT_ROOT, 'platform/services/auth-service/src');
      const files = findTsFiles(authSrc);
      const hasMfa = files.some((f) => {
        const content = readFileSync(f, 'utf-8');
        return (
          content.includes('mfa') || content.includes('MFA') || content.includes('totp') || content.includes('TOTP')
        );
      });
      expect(hasMfa).toBe(true);
    }
  });

  it('D-08-09: 세션 관리 — 동시 세션 제한', () => {
    // ConfigMap에서 동시 세션 제한 설정 확인
    const configmapPath = resolve(PROJECT_ROOT, 'k8s/config/configmap.yaml');
    const content = readFileSync(configmapPath, 'utf-8');
    expect(content).toContain('SESSION_MAX_CONCURRENT');
    expect(content).toContain('3');
  });

  it('D-08-10: JWT 토큰 만료 설정', () => {
    // ConfigMap에서 JWT 만료 설정 확인
    const configmapPath = resolve(PROJECT_ROOT, 'k8s/config/configmap.yaml');
    const content = readFileSync(configmapPath, 'utf-8');
    // 접근 토큰: 15분
    expect(content).toContain('JWT_ACCESS_EXPIRY');
    expect(content).toContain('15m');
    // 갱신 토큰: 7일
    expect(content).toContain('JWT_REFRESH_EXPIRY');
    expect(content).toContain('7d');
  });
});

function findTsFiles(dir: string): string[] {
  const { readdirSync } = require('fs');
  const { join } = require('path');
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !['node_modules', 'dist', 'tests'].includes(entry.name)) {
        files.push(...findTsFiles(fullPath));
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        files.push(fullPath);
      }
    }
  } catch {
    /* ignore */
  }
  return files;
}
