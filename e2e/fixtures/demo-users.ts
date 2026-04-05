// Design Ref: MTU-E2E1 — 데모 계정 픽스처
// Plan SC: FR-QA-2 — 역할별 접근 테스트 지원
// NOTE: 데모 전용 계정 정보. 프로덕션 환경에 사용 금지.

export const DEMO_USERS = {
  superAdmin: {
    email: 'superadmin@platform.go.kr',
    password: 'Demo2026!',
    role: 'SUPER_ADMIN',
    displayName: '슈퍼 관리자',
  },
  tenantAdminMois: {
    email: 'admin@mois-demo.go.kr',
    password: 'Demo2026!',
    role: 'TENANT_ADMIN',
    displayName: '행안부 테넌트 관리자',
    tenantSlug: 'mois-demo',
  },
  tenantAdminMolit: {
    email: 'admin@molit-demo.go.kr',
    password: 'Demo2026!',
    role: 'TENANT_ADMIN',
    displayName: '국토부 테넌트 관리자',
    tenantSlug: 'molit-demo',
  },
  user: {
    email: 'user1@mois-demo.go.kr',
    password: 'Demo2026!',
    role: 'USER',
    displayName: '행안부 일반 사용자',
    tenantSlug: 'mois-demo',
  },
  auditor: {
    email: 'auditor@mois-demo.go.kr',
    password: 'Demo2026!',
    role: 'AUDITOR',
    displayName: '감사관',
    tenantSlug: 'mois-demo',
  },
} as const

export type DemoUserKey = keyof typeof DEMO_USERS

// 로그인 API 직접 호출 헬퍼 (포털이 로그인 UI 없을 경우 대체)
export function buildLoginPayload(userKey: DemoUserKey) {
  const user = DEMO_USERS[userKey]
  return {
    email: user.email,
    password: user.password,
  }
}
