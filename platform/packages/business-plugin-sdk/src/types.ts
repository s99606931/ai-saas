// 비즈니스 플러그인 SDK 타입
// Design Ref: D-P00.10

import type { DataGrade, UserRole } from '@public-saas/types';

/**
 * CSAP 보안 가드 설정
 */
export interface CsapGuards {
  /** 서비스 데이터 등급 (C: 기밀, S: 민감, O: 공개) */
  dataGrade: DataGrade;
  /** 감사 로그 상세 수준 */
  auditLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * API 라우트 정의
 */
export interface RouteDefinition {
  /** 라우트 경로 (예: /employees) */
  path: string;
  /** HTTP 메서드 */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** 요청 핸들러 */
  handler: (req: unknown, res: unknown) => Promise<unknown>;
  /** 필요 역할 */
  roles?: UserRole[];
}

/**
 * 메뉴 아이템 정의
 */
export interface MenuItemDefinition {
  /** 메뉴 라벨 (한국어) */
  label: string;
  /** 메뉴 경로 */
  path: string;
  /** 아이콘 이름 (lucide-react) */
  icon?: string;
  /** 하위 메뉴 */
  children?: MenuItemDefinition[];
}

/**
 * 서비스 매니페스트
 */
export interface ServiceManifest {
  /** 서비스 고유 ID */
  id: string;
  /** 서비스 표시명 */
  name: string;
  /** 서비스 카테고리 */
  category: string;
  /** 버전 */
  version: string;
  /** 설명 */
  description?: string;
  /** API 라우트 목록 */
  routes: RouteDefinition[];
  /** 메뉴 아이템 목록 */
  menuItems: MenuItemDefinition[];
  /** CSAP 보안 가드 */
  csapGuards: CsapGuards;
}
