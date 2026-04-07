// 서비스 레지스트리
// Design Ref: DESIGN-MTU-P04
// Plan SC: FR-P04.5, FR-P04.11

/**
 * 서비스 등록 정보
 */
interface ServiceEntry {
  /** 서비스 내부 URL */
  url: string;
  /** 인증 필수 여부 */
  requireAuth: boolean;
  /** 필요 권한 (빈 배열 = 인증만 필요) */
  requiredPermissions?: string[];
  /** Rate Limit 커스텀 (기본: 전역 설정) */
  rateLimit?: { max: number; timeWindow: string };
}

/**
 * 플랫폼 서비스 레지스트리 (정적)
 * Design Ref: DESIGN-MTU-P04 라우팅 설계
 * k8s 환경: Kubernetes DNS 서비스명 사용 (AUTH_SERVICE_PORT 등은 k8s가 자동 주입하므로 충돌 방지)
 */
export const SERVICE_REGISTRY: Record<string, ServiceEntry> = {
  auth: {
    url: process.env['AUTH_SVC_URL'] ?? 'http://auth-service:3001',
    requireAuth: false, // 인증 서비스는 인증 불필요
    rateLimit: { max: 10, timeWindow: '1 minute' }, // 로그인 브루트포스 방지
  },
  users: {
    url: process.env['USER_SVC_URL'] ?? 'http://user-service:3002',
    requireAuth: true,
  },
  tenants: {
    url: process.env['TENANT_SVC_URL'] ?? 'http://tenant-service:3003',
    requireAuth: true,
  },
  menus: {
    url: process.env['MENU_SVC_URL'] ?? 'http://menu-service:3004',
    requireAuth: true,
  },
  services: {
    url: process.env['CATALOG_SVC_URL'] ?? 'http://catalog-service:3005',
    requireAuth: true,
  },
  subscriptions: {
    url: process.env['SUBSCRIPTION_SVC_URL'] ?? 'http://subscription-service:3006',
    requireAuth: true,
  },
  billing: {
    url: process.env['BILLING_SVC_URL'] ?? 'http://billing-service:3007',
    requireAuth: true,
  },
  crm: {
    url: process.env['CRM_SVC_URL'] ?? 'http://crm-service:3008',
    requireAuth: true,
  },
  ai: {
    url: process.env['AI_SVC_URL'] ?? 'http://ai-service:3009',
    requireAuth: true,
  },
  notifications: {
    url: process.env['NOTIFICATION_SVC_URL'] ?? 'http://notification-service:3010',
    requireAuth: true,
  },
  files: {
    url: process.env['FILE_SVC_URL'] ?? 'http://file-service:3011',
    requireAuth: true,
  },
  audit: {
    url: process.env['AUDIT_SVC_URL'] ?? 'http://audit-service:3012',
    requireAuth: true,
    requiredPermissions: ['audit:read'],
  },
  compliance: {
    url: process.env['COMPLIANCE_SVC_URL'] ?? 'http://compliance-service:3013',
    requireAuth: true,
  },
  security: {
    url: process.env['SECURITY_SVC_URL'] ?? 'http://security-monitor-service:3014',
    requireAuth: true,
    requiredPermissions: ['security:read'],
  },
};

/**
 * 비즈니스 서비스 동적 등록
 * Plan SC: FR-P04.11
 */
const dynamicServices: Map<string, ServiceEntry> = new Map();

export function registerBusinessService(
  id: string,
  entry: ServiceEntry,
): void {
  dynamicServices.set(id, entry);
}

export function getServiceEntry(serviceId: string): ServiceEntry | undefined {
  return SERVICE_REGISTRY[serviceId] ?? dynamicServices.get(serviceId);
}

export function getAllServices(): Record<string, ServiceEntry> {
  const all: Record<string, ServiceEntry> = { ...SERVICE_REGISTRY };
  for (const [key, value] of dynamicServices) {
    all[key] = value;
  }
  return all;
}
