// 서비스 등록 함수
// Design Ref: D-P00.10
// 실제 API 게이트웨이 연동: MTU-P18

import type { ServiceManifest } from './types.js';

/**
 * 서비스 등록 결과
 */
export interface ServiceRegistration {
  /** 등록 성공 여부 */
  success: boolean;
  /** 서비스 ID */
  serviceId: string;
  /** API 기본 경로 (예: /api/v1/my-hr-service) */
  basePath: string;
  /** 등록 시각 */
  registeredAt: string;
}

/**
 * 비즈니스 서비스를 플랫폼에 등록
 *
 * - API 게이트웨이에 라우트 자동 등록
 * - 메뉴 서비스에 메뉴 아이템 자동 등록
 * - CSAP 보안 가드 자동 적용
 * - 감사 로그 자동 기록
 *
 * @param manifest - 서비스 매니페스트
 * @returns 등록 결과
 *
 * @example
 * ```typescript
 * import { registerService } from '@public-saas/business-plugin-sdk';
 *
 * registerService({
 *   id: 'my-hr-service',
 *   name: '인사관리 서비스',
 *   category: '업무관리',
 *   version: '1.0.0',
 *   routes: [
 *     { path: '/employees', handler: employeeHandler },
 *   ],
 *   menuItems: [
 *     { label: '직원 관리', path: '/employees', icon: 'users' },
 *   ],
 *   csapGuards: {
 *     dataGrade: 'S',
 *     auditLevel: 'HIGH',
 *   },
 * });
 * ```
 */
export async function registerService(manifest: ServiceManifest): Promise<ServiceRegistration> {
  // NOTE: 실제 구현은 MTU-P18에서 API 게이트웨이 연동으로 완성
  // 현재는 인터페이스 스켈레톤
  const basePath = `/api/v1/${manifest.id}`;

  return {
    success: true,
    serviceId: manifest.id,
    basePath,
    registeredAt: new Date().toISOString(),
  };
}
