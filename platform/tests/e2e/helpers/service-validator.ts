// E2E 테스트용 서비스 코드 검증 유틸리티
// Design Ref: MTU-N01
// Plan SC: FR-N01.4
//
// E2E 테스트에서 서비스가 실제 기동되지 않은 환경에서도
// 코드 수준 검증을 수행하기 위한 유틸리티.
// 기존 platform/tests/csap/ 패턴과 동일한 접근법.

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../../../../');

/**
 * 서비스 소스 파일의 내용을 읽어 반환
 */
export function readServiceFile(relativePath: string): string {
  const fullPath = resolve(PROJECT_ROOT, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`파일 미존재: ${relativePath}`);
  }
  return readFileSync(fullPath, 'utf-8');
}

/**
 * 서비스 파일에 특정 패턴이 존재하는지 확인
 */
export function serviceFileContains(relativePath: string, patterns: string[]): { exists: boolean; missing: string[] } {
  const content = readServiceFile(relativePath);
  const missing = patterns.filter((p) => !content.includes(p));
  return { exists: missing.length === 0, missing };
}

/**
 * 서비스 디렉토리의 핸들러 파일 목록 반환
 */
export function getServiceHandlers(serviceName: string): string[] {
  const handlersDir = resolve(PROJECT_ROOT, `platform/services/${serviceName}/src/handlers`);
  if (!existsSync(handlersDir)) return [];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readdirSync } = require('fs');
  return readdirSync(handlersDir) as string[];
}

/**
 * 서비스 소스 디렉토리 존재 확인
 */
export function serviceExists(serviceName: string): boolean {
  const srcDir = resolve(PROJECT_ROOT, `platform/services/${serviceName}/src`);
  return existsSync(srcDir);
}

/**
 * 플러그인 소스 디렉토리 존재 확인
 */
export function pluginExists(pluginName: string): boolean {
  const srcDir = resolve(PROJECT_ROOT, `platform/plugins/${pluginName}/src`);
  return existsSync(srcDir);
}

/**
 * 모든 플랫폼 서비스 이름 목록
 */
export const ALL_SERVICES = [
  'api-gateway',
  'auth-service',
  'user-service',
  'tenant-service',
  'menu-service',
  'catalog-service',
  'subscription-service',
  'billing-service',
  'crm-service',
  'ai-service',
  'notification-service',
  'file-service',
  'audit-service',
  'compliance-service',
  'security-service',
  'security-monitor-service',
] as const;

/**
 * 인증 필수 서비스 (api-gateway service-registry 기준)
 */
export const AUTH_REQUIRED_SERVICES = [
  'user-service',
  'tenant-service',
  'menu-service',
  'catalog-service',
  'subscription-service',
  'billing-service',
  'crm-service',
  'ai-service',
  'notification-service',
  'file-service',
  'audit-service',
  'compliance-service',
  'security-monitor-service',
] as const;

/**
 * 특수 권한 필요 서비스
 */
export const PERMISSION_REQUIRED_SERVICES: Record<string, string[]> = {
  'audit-service': ['audit:read'],
  'security-monitor-service': ['security:read'],
};
