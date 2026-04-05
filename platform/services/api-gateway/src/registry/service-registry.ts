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
 */
export const SERVICE_REGISTRY: Record<string, ServiceEntry> = {
  auth: {
    url: `http://localhost:${process.env['AUTH_SERVICE_PORT'] ?? '3001'}`,
    requireAuth: false, // 인증 서비스는 인증 불필요
    rateLimit: { max: 10, timeWindow: '1 minute' }, // 로그인 브루트포스 방지
  },
  users: {
    url: `http://localhost:${process.env['USER_SERVICE_PORT'] ?? '3002'}`,
    requireAuth: true,
  },
  tenants: {
    url: `http://localhost:${process.env['TENANT_SERVICE_PORT'] ?? '3003'}`,
    requireAuth: true,
  },
  menus: {
    url: `http://localhost:${process.env['MENU_SERVICE_PORT'] ?? '3004'}`,
    requireAuth: true,
  },
  services: {
    url: `http://localhost:${process.env['CATALOG_SERVICE_PORT'] ?? '3005'}`,
    requireAuth: true,
  },
  subscriptions: {
    url: `http://localhost:${process.env['SUBSCRIPTION_SERVICE_PORT'] ?? '3006'}`,
    requireAuth: true,
  },
  billing: {
    url: `http://localhost:${process.env['BILLING_SERVICE_PORT'] ?? '3007'}`,
    requireAuth: true,
  },
  crm: {
    url: `http://localhost:${process.env['CRM_SERVICE_PORT'] ?? '3008'}`,
    requireAuth: true,
  },
  ai: {
    url: `http://localhost:${process.env['AI_SERVICE_PORT'] ?? '3009'}`,
    requireAuth: true,
  },
  notifications: {
    url: `http://localhost:${process.env['NOTIFICATION_SERVICE_PORT'] ?? '3010'}`,
    requireAuth: true,
  },
  files: {
    url: `http://localhost:${process.env['FILE_SERVICE_PORT'] ?? '3011'}`,
    requireAuth: true,
  },
  audit: {
    url: `http://localhost:${process.env['AUDIT_SERVICE_PORT'] ?? '3012'}`,
    requireAuth: true,
    requiredPermissions: ['audit:read'],
  },
  compliance: {
    url: `http://localhost:${process.env['COMPLIANCE_SERVICE_PORT'] ?? '3013'}`,
    requireAuth: true,
  },
  security: {
    url: `http://localhost:${process.env['SECURITY_SERVICE_PORT'] ?? '3014'}`,
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
