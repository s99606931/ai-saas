// 테넌트 도메인 타입
// Design Ref: D-P00.2
// CSAP: N2SF N-03 테넌트 격리

/**
 * 테넌트 상태
 * - active: 정상 운영
 * - suspended: 일시 중지 (미납, 관리자 조치)
 * - trial: 체험 기간
 * - archived: 폐기 (데이터 보존)
 */
export type TenantStatus = 'active' | 'suspended' | 'trial' | 'archived';

/**
 * 테넌트 설정
 */
export interface TenantConfig {
  /** 최대 사용자 수 */
  maxUsers: number;
  /** 최대 저장 용량 (bytes) */
  maxStorage: number;
  /** 활성화된 기능 목록 */
  features: string[];
  /** 테넌트 테마 설정 */
  theme?: TenantTheme;
}

/**
 * 테넌트 테마 커스터마이제이션
 */
export interface TenantTheme {
  /** 기본 색상 */
  primaryColor: string;
  /** 로고 URL */
  logoUrl?: string;
  /** 파비콘 URL */
  faviconUrl?: string;
  /** 사이드바 스타일 */
  sidebarVariant?: 'default' | 'compact' | 'floating';
}

/**
 * 테넌트 엔티티
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  maxUsers: number;
  maxStorage: number;
  config: TenantConfig | null;
  theme: TenantTheme | null;
  createdAt: Date;
  updatedAt: Date;
}
