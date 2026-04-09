// Design Ref: D-P00.6 §시드 데이터 — 데모 테넌트 초기 데이터
// Plan SC: FR-P00.6
// CSAP: D-08 접근 통제(bcrypt), D-06 감사 로그(SHA-256 체인), D-09 암호화
// NOTE: 데모/개발 환경 전용. 운영 환경 실행 금지.

import { PrismaClient, UserRole, TenantStatus, SubscriptionStatus } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'

const prisma = new PrismaClient()

// ============================================================
// 유틸리티
// ============================================================

async function hashPassword(plaintext: string): Promise<string> {
  // CSAP D-08: bcrypt cost=12 필수
  return bcrypt.hash(plaintext, 12)
}

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function buildAuditHash(entry: {
  action: string
  actorId?: string | null
  target?: string | null
  createdAt: string
  previousHash: string
}): string {
  return sha256(JSON.stringify(entry))
}

// ============================================================
// 메인 시드 함수
// ============================================================

async function main() {
  // L-02 수정 (CSAP D-08-07): 프로덕션 환경 시드 실행 차단
  // 알려진 비밀번호(Demo2026!)의 관리자 계정이 운영 DB에 생성되는 것을 방지
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      '[SECURITY] 시드 스크립트는 개발/테스트 환경 전용입니다. 운영 환경에서 실행이 차단됩니다.',
    )
  }
  console.log('[SEED] 데모 데이터 생성 시작...')

  // ----------------------------------------------------------
  // 1. 플랜 3종
  // ----------------------------------------------------------
  console.log('[SEED] 1/8 플랜 생성...')

  const planBasic = await prisma.plan.upsert({
    where: { slug: 'basic' },
    update: {},
    create: {
      name: '기본형',
      slug: 'basic',
      price: 300000,
      currency: 'KRW',
      interval: 'monthly',
      maxUsers: 10,
      maxStorage: BigInt(10 * 1024 * 1024 * 1024), // 10GB
      isActive: true,
    },
  })

  const planStandard = await prisma.plan.upsert({
    where: { slug: 'standard' },
    update: {},
    create: {
      name: '표준형',
      slug: 'standard',
      price: 800000,
      currency: 'KRW',
      interval: 'monthly',
      maxUsers: 50,
      maxStorage: BigInt(100 * 1024 * 1024 * 1024), // 100GB
      isActive: true,
    },
  })

  const planEnterprise = await prisma.plan.upsert({
    where: { slug: 'enterprise' },
    update: {},
    create: {
      name: '기업형',
      slug: 'enterprise',
      price: 2000000,
      currency: 'KRW',
      interval: 'monthly',
      maxUsers: 9999, // 무제한 표현
      maxStorage: BigInt(1024 * 1024 * 1024 * 1024), // 1TB
      isActive: true,
    },
  })

  console.log(`  - 플랜 생성 완료: ${planBasic.name}, ${planStandard.name}, ${planEnterprise.name}`)

  // ----------------------------------------------------------
  // 2. SaaS 서비스 카탈로그 5종
  // ----------------------------------------------------------
  console.log('[SEED] 2/8 서비스 카탈로그 생성...')

  const services = await Promise.all([
    prisma.service.upsert({
      where: { slug: 'edms' },
      update: {},
      create: {
        name: '전자문서관리시스템',
        slug: 'edms',
        description: '공공기관 전자문서 생성·유통·보존 통합 관리',
        category: '문서관리',
        version: '2.1.0',
        isBuiltIn: true,
        isActive: true,
      },
    }),
    prisma.service.upsert({
      where: { slug: 'ai-policy' },
      update: {},
      create: {
        name: 'AI 정책 분석',
        slug: 'ai-policy',
        description: 'N2SF O등급 데이터 기반 정책문서 자동 분석 (AI Gateway 경유)',
        category: 'AI분석',
        version: '1.0.0',
        isBuiltIn: false,
        isActive: true,
      },
    }),
    prisma.service.upsert({
      where: { slug: 'data-portal' },
      update: {},
      create: {
        name: '공공데이터 포털',
        slug: 'data-portal',
        description: '행안부 공공데이터 포털 연동 및 자동 갱신',
        category: '데이터',
        version: '1.3.0',
        isBuiltIn: true,
        isActive: true,
      },
    }),
    prisma.service.upsert({
      where: { slug: 'security-audit' },
      update: {},
      create: {
        name: '통합보안감사',
        slug: 'security-audit',
        description: 'CSAP 79항목 실시간 감사 및 취약점 스캔',
        category: '보안',
        version: '3.0.1',
        isBuiltIn: true,
        isActive: true,
      },
    }),
    prisma.service.upsert({
      where: { slug: 'erp-hub' },
      update: {},
      create: {
        name: 'ERP 연동 허브',
        slug: 'erp-hub',
        description: '나라장터·디브레인 등 정부 ERP 시스템 연동',
        category: '연동',
        version: '1.1.0',
        isBuiltIn: false,
        isActive: true,
      },
    }),
  ])

  console.log(`  - 서비스 ${services.length}종 생성 완료`)

  // ----------------------------------------------------------
  // 3. 테넌트 생성
  // ----------------------------------------------------------
  console.log('[SEED] 3/8 테넌트 생성...')

  const tenantMois = await prisma.tenant.upsert({
    where: { slug: 'mois-demo' },
    update: {},
    create: {
      name: '행정안전부 데모',
      slug: 'mois-demo',
      status: TenantStatus.ACTIVE,
      maxUsers: 50,
      maxStorage: BigInt(100 * 1024 * 1024 * 1024),
      config: { allowAiFeatures: true, dataGrade: 'O' },
      theme: { primaryColor: '#003087', logoUrl: '/logos/mois.png' },
    },
  })

  const tenantMolit = await prisma.tenant.upsert({
    where: { slug: 'molit-demo' },
    update: {},
    create: {
      name: '국토교통부 데모',
      slug: 'molit-demo',
      status: TenantStatus.TRIAL,
      maxUsers: 10,
      maxStorage: BigInt(10 * 1024 * 1024 * 1024),
      config: { allowAiFeatures: false, dataGrade: 'O' },
      theme: { primaryColor: '#00539b', logoUrl: '/logos/molit.png' },
    },
  })

  console.log(`  - 테넌트 생성: ${tenantMois.name}, ${tenantMolit.name}`)

  // ----------------------------------------------------------
  // 4. 사용자 생성 (bcrypt cost=12)
  // ----------------------------------------------------------
  console.log('[SEED] 4/8 사용자 생성 (bcrypt cost=12)...')

  const demoPassword = await hashPassword('Demo2026!')
  const superAdminPassword = await hashPassword('Demo2026!')

  // 슈퍼 관리자 (tenantId 필요 — 플랫폼 내부 테넌트 생성)
  const tenantPlatform = await prisma.tenant.upsert({
    where: { slug: 'platform-internal' },
    update: {},
    create: {
      name: '플랫폼 내부',
      slug: 'platform-internal',
      status: TenantStatus.ACTIVE,
      maxUsers: 5,
      maxStorage: BigInt(1024 * 1024 * 1024),
      config: { internal: true },
    },
  })

  const superAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantPlatform.id, email: 'superadmin@platform.go.kr' } },
    update: {},
    create: {
      tenantId: tenantPlatform.id,
      email: 'superadmin@platform.go.kr',
      name: '플랫폼 슈퍼관리자',
      passwordHash: superAdminPassword,
      role: UserRole.SUPER_ADMIN,
    },
  })

  // 행안부 사용자
  const adminMois = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantMois.id, email: 'admin@mois-demo.go.kr' } },
    update: {},
    create: {
      tenantId: tenantMois.id,
      email: 'admin@mois-demo.go.kr',
      name: '행안부 관리자',
      passwordHash: demoPassword,
      role: UserRole.TENANT_ADMIN,
    },
  })

  const user1Mois = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantMois.id, email: 'user1@mois-demo.go.kr' } },
    update: {},
    create: {
      tenantId: tenantMois.id,
      email: 'user1@mois-demo.go.kr',
      name: '행안부 담당자1',
      passwordHash: demoPassword,
      role: UserRole.USER,
    },
  })

  const user2Mois = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantMois.id, email: 'user2@mois-demo.go.kr' } },
    update: {},
    create: {
      tenantId: tenantMois.id,
      email: 'user2@mois-demo.go.kr',
      name: '행안부 담당자2',
      passwordHash: demoPassword,
      role: UserRole.USER,
    },
  })

  const auditorMois = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantMois.id, email: 'auditor@mois-demo.go.kr' } },
    update: {},
    create: {
      tenantId: tenantMois.id,
      email: 'auditor@mois-demo.go.kr',
      name: '행안부 감사관',
      passwordHash: demoPassword,
      role: UserRole.AUDITOR,
    },
  })

  // 국토부 사용자
  const adminMolit = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantMolit.id, email: 'admin@molit-demo.go.kr' } },
    update: {},
    create: {
      tenantId: tenantMolit.id,
      email: 'admin@molit-demo.go.kr',
      name: '국토부 관리자',
      passwordHash: demoPassword,
      role: UserRole.TENANT_ADMIN,
    },
  })

  const userMolit = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantMolit.id, email: 'user@molit-demo.go.kr' } },
    update: {},
    create: {
      tenantId: tenantMolit.id,
      email: 'user@molit-demo.go.kr',
      name: '국토부 담당자',
      passwordHash: demoPassword,
      role: UserRole.USER,
    },
  })

  console.log(`  - 사용자 7명 생성 완료`)
  void superAdmin; void user1Mois; void user2Mois; void auditorMois; void userMolit

  // ----------------------------------------------------------
  // 5. 구독 생성
  // ----------------------------------------------------------
  console.log('[SEED] 5/8 구독 생성...')

  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const subMois = await prisma.subscription.upsert({
    where: { id: 'sub-mois-standard-demo' },
    update: {},
    create: {
      id: 'sub-mois-standard-demo',
      tenantId: tenantMois.id,
      planId: planStandard.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  })

  const subMolit = await prisma.subscription.upsert({
    where: { id: 'sub-molit-basic-demo' },
    update: {},
    create: {
      id: 'sub-molit-basic-demo',
      tenantId: tenantMolit.id,
      planId: planBasic.id,
      status: SubscriptionStatus.TRIALING,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  })

  // 인보이스 (행안부 ACTIVE 구독)
  await prisma.invoice.upsert({
    where: { id: 'inv-mois-2026-04' },
    update: {},
    create: {
      id: 'inv-mois-2026-04',
      subscriptionId: subMois.id,
      amount: 800000,
      currency: 'KRW',
      status: 'paid',
      issuedAt: periodStart,
      paidAt: new Date(periodStart.getTime() + 2 * 24 * 60 * 60 * 1000),
      dueDate: new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  void subMolit
  console.log('  - 구독 2건, 인보이스 1건 생성 완료')

  // ----------------------------------------------------------
  // 6. 메뉴 아이템
  // ----------------------------------------------------------
  console.log('[SEED] 6/8 메뉴 생성...')

  // 공통 관리자 메뉴 (tenantId = null)
  const adminMenuItems = [
    { label: '대시보드', path: '/admin/dashboard', icon: 'LayoutDashboard', order: 1 },
    { label: '테넌트 관리', path: '/admin/tenants', icon: 'Building2', order: 2 },
    { label: '사용자 관리', path: '/admin/users', icon: 'Users', order: 3 },
    { label: '구독 관리', path: '/admin/subscriptions', icon: 'CreditCard', order: 4 },
    { label: '서비스 카탈로그', path: '/admin/services', icon: 'Grid', order: 5 },
    { label: 'CSAP 준수 현황', path: '/admin/compliance', icon: 'Shield', order: 6 },
    { label: '감사 로그', path: '/admin/audit-logs', icon: 'FileText', order: 7 },
    { label: 'AI 모델 관리', path: '/admin/ai-models', icon: 'Cpu', order: 8 },
    { label: '알림 설정', path: '/admin/notifications', icon: 'Bell', order: 9 },
    { label: '시스템 설정', path: '/admin/settings', icon: 'Settings', order: 10 },
  ]

  for (const item of adminMenuItems) {
    await prisma.menuItem.upsert({
      where: { id: `menu-admin-${item.order}` },
      update: {},
      create: {
        id: `menu-admin-${item.order}`,
        tenantId: null,
        label: item.label,
        path: item.path,
        icon: item.icon,
        order: item.order,
        isVisible: true,
        roles: ['SUPER_ADMIN', 'TENANT_ADMIN'],
      },
    })
  }

  // 행안부 테넌트 메뉴
  const moisMenuItems = [
    { label: '대시보드', path: '/tenant/dashboard', icon: 'LayoutDashboard', order: 1 },
    { label: '서비스', path: '/tenant/services', icon: 'Grid', order: 2 },
    { label: '사용자', path: '/tenant/users', icon: 'Users', order: 3 },
    { label: '마켓플레이스', path: '/tenant/marketplace', icon: 'ShoppingBag', order: 4 },
    { label: '설정', path: '/tenant/settings', icon: 'Settings', order: 5 },
  ]

  for (const item of moisMenuItems) {
    await prisma.menuItem.upsert({
      where: { id: `menu-mois-${item.order}` },
      update: {},
      create: {
        id: `menu-mois-${item.order}`,
        tenantId: tenantMois.id,
        label: item.label,
        path: item.path,
        icon: item.icon,
        order: item.order,
        isVisible: true,
      },
    })
  }

  // 국토부 테넌트 메뉴
  const molitMenuItems = [
    { label: '대시보드', path: '/tenant/dashboard', icon: 'LayoutDashboard', order: 1 },
    { label: '서비스', path: '/tenant/services', icon: 'Grid', order: 2 },
    { label: '사용자', path: '/tenant/users', icon: 'Users', order: 3 },
    { label: '마켓플레이스', path: '/tenant/marketplace', icon: 'ShoppingBag', order: 4 },
    { label: '설정', path: '/tenant/settings', icon: 'Settings', order: 5 },
  ]

  for (const item of molitMenuItems) {
    await prisma.menuItem.upsert({
      where: { id: `menu-molit-${item.order}` },
      update: {},
      create: {
        id: `menu-molit-${item.order}`,
        tenantId: tenantMolit.id,
        label: item.label,
        path: item.path,
        icon: item.icon,
        order: item.order,
        isVisible: true,
      },
    })
  }

  console.log('  - 메뉴 20개 생성 완료')

  // ----------------------------------------------------------
  // 7. 감사 로그 50건+ (SHA-256 체인)
  // CSAP D-06: append-only, 해시 체인 무결성
  // ----------------------------------------------------------
  console.log('[SEED] 7/8 감사 로그 생성 (SHA-256 체인)...')

  const auditActions = [
    { action: 'USER_LOGIN', target: 'user', targetType: 'User' },
    { action: 'USER_LOGOUT', target: 'user', targetType: 'User' },
    { action: 'TENANT_VIEW', target: 'tenant', targetType: 'Tenant' },
    { action: 'USER_CREATE', target: 'user', targetType: 'User' },
    { action: 'SUBSCRIPTION_VIEW', target: 'subscription', targetType: 'Subscription' },
    { action: 'COMPLIANCE_CHECK', target: 'csap', targetType: 'Compliance' },
    { action: 'AUDIT_LOG_VIEW', target: 'audit', targetType: 'AuditLog' },
    { action: 'SERVICE_ENABLE', target: 'service', targetType: 'Service' },
    { action: 'USER_PASSWORD_CHANGE', target: 'user', targetType: 'User' },
    { action: 'TENANT_CONFIG_UPDATE', target: 'tenant', targetType: 'Tenant' },
  ]

  const moisActors = [adminMois.id, user1Mois.id, user2Mois.id, auditorMois.id]
  const molitActors = [adminMolit.id]
  const allActors = [...moisActors, ...molitActors]

  // 시드 실행 시 기존 로그 초기화 (멱등성 보장을 위해 prefix ID 사용)
  let previousHash = '0000000000000000000000000000000000000000000000000000000000000000'

  const logCount = 55
  for (let i = 0; i < logCount; i++) {
    const actionData = auditActions[i % auditActions.length]
    const actorId = allActors[i % allActors.length]
    const tenantId = i < 40 ? tenantMois.id : tenantMolit.id
    const createdAt = new Date(now.getTime() - (logCount - i) * 30 * 60 * 1000) // 30분 간격

    const hashInput = {
      action: actionData.action,
      actorId,
      target: actionData.target,
      createdAt: createdAt.toISOString(),
      previousHash,
    }
    const hash = buildAuditHash(hashInput)

    await prisma.auditLog.upsert({
      where: { id: `audit-seed-${String(i).padStart(3, '0')}` },
      update: {},
      create: {
        id: `audit-seed-${String(i).padStart(3, '0')}`,
        tenantId,
        actorId,
        action: actionData.action,
        target: actionData.target,
        targetType: actionData.targetType,
        ip: `192.168.1.${(i % 254) + 1}`,
        userAgent: 'Mozilla/5.0 (공공기관 표준브라우저 6.0)',
        metadata: { seedIndex: i, demo: true },
        hash,
        previousHash,
        createdAt,
      },
    })

    previousHash = hash
  }

  console.log(`  - 감사 로그 ${logCount}건 생성 완료 (SHA-256 체인)`)

  // ----------------------------------------------------------
  // 8. RBAC 권한 시드 (CSAP D-08-05)
  // ----------------------------------------------------------
  console.log('[SEED] 8/10 RBAC 권한 생성...')

  const permissions = [
    { id: 'perm-tenant-read', name: 'tenant:read', description: '테넌트 조회' },
    { id: 'perm-tenant-write', name: 'tenant:write', description: '테넌트 생성/수정' },
    { id: 'perm-user-read', name: 'user:read', description: '사용자 조회' },
    { id: 'perm-user-write', name: 'user:write', description: '사용자 생성/수정/삭제' },
    { id: 'perm-audit-read', name: 'audit:read', description: '감사 로그 조회' },
    { id: 'perm-security-read', name: 'security:read', description: '보안 모니터링 조회' },
    { id: 'perm-admin-all', name: 'admin:all', description: '전체 관리 권한' },
    { id: 'perm-service-read', name: 'service:read', description: '서비스 카탈로그 조회' },
    { id: 'perm-service-write', name: 'service:write', description: '서비스 카탈로그 관리' },
    { id: 'perm-subscription-read', name: 'subscription:read', description: '구독 조회' },
    { id: 'perm-subscription-write', name: 'subscription:write', description: '구독 관리' },
    { id: 'perm-billing-read', name: 'billing:read', description: '빌링 조회' },
    { id: 'perm-billing-write', name: 'billing:write', description: '빌링 관리' },
    { id: 'perm-ai-read', name: 'ai:read', description: 'AI 모델 조회' },
    { id: 'perm-ai-write', name: 'ai:write', description: 'AI 모델 관리' },
    { id: 'perm-compliance-read', name: 'compliance:read', description: 'CSAP/N2SF 준수 현황 조회' },
    { id: 'perm-file-read', name: 'file:read', description: '파일 조회/다운로드' },
    { id: 'perm-file-write', name: 'file:write', description: '파일 업로드/삭제' },
    { id: 'perm-notification-read', name: 'notification:read', description: '알림 조회' },
    { id: 'perm-notification-write', name: 'notification:write', description: '알림 전송/관리' },
  ]

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { id: p.id },
      update: {},
      create: p,
    })
  }

  // 역할-권한 매핑 (CSAP D-08-05: 최소 권한 원칙)
  const rolePermissions: Array<{ role: UserRole; permName: string }> = [
    // SUPER_ADMIN: 전체 권한
    { role: UserRole.SUPER_ADMIN, permName: 'admin:all' },
    // TENANT_ADMIN: 자기 테넌트 관리
    { role: UserRole.TENANT_ADMIN, permName: 'tenant:read' },
    { role: UserRole.TENANT_ADMIN, permName: 'user:read' },
    { role: UserRole.TENANT_ADMIN, permName: 'user:write' },
    { role: UserRole.TENANT_ADMIN, permName: 'audit:read' },
    { role: UserRole.TENANT_ADMIN, permName: 'service:read' },
    { role: UserRole.TENANT_ADMIN, permName: 'subscription:read' },
    { role: UserRole.TENANT_ADMIN, permName: 'billing:read' },
    { role: UserRole.TENANT_ADMIN, permName: 'ai:read' },
    { role: UserRole.TENANT_ADMIN, permName: 'compliance:read' },
    { role: UserRole.TENANT_ADMIN, permName: 'file:read' },
    { role: UserRole.TENANT_ADMIN, permName: 'file:write' },
    { role: UserRole.TENANT_ADMIN, permName: 'notification:read' },
    { role: UserRole.TENANT_ADMIN, permName: 'notification:write' },
    // AUDITOR: 감사/보안 읽기 전용
    { role: UserRole.AUDITOR, permName: 'audit:read' },
    { role: UserRole.AUDITOR, permName: 'security:read' },
    { role: UserRole.AUDITOR, permName: 'compliance:read' },
    { role: UserRole.AUDITOR, permName: 'user:read' },
    { role: UserRole.AUDITOR, permName: 'tenant:read' },
    // USER: 기본 읽기
    { role: UserRole.USER, permName: 'service:read' },
    { role: UserRole.USER, permName: 'file:read' },
    { role: UserRole.USER, permName: 'file:write' },
    { role: UserRole.USER, permName: 'notification:read' },
    { role: UserRole.USER, permName: 'ai:read' },
    // VIEWER: 최소 읽기
    { role: UserRole.VIEWER, permName: 'service:read' },
    { role: UserRole.VIEWER, permName: 'notification:read' },
  ]

  let rpIndex = 0
  for (const rp of rolePermissions) {
    const perm = permissions.find(p => p.name === rp.permName)
    if (perm) {
      await prisma.rolePermission.upsert({
        where: { id: `rp-seed-${String(rpIndex).padStart(3, '0')}` },
        update: {},
        create: {
          id: `rp-seed-${String(rpIndex).padStart(3, '0')}`,
          role: rp.role,
          permissionId: perm.id,
        },
      })
      rpIndex++
    }
  }

  console.log(`  - 권한 ${permissions.length}개, 역할-권한 매핑 ${rpIndex}건 생성 완료`)

  // ----------------------------------------------------------
  // 9. 플랜-서비스 매핑
  // ----------------------------------------------------------
  console.log('[SEED] 9/10 플랜-서비스 매핑...')

  // 기본형: 문서관리 + 공공데이터
  // 표준형: 기본 + AI정책 + 보안감사
  // 기업형: 전체
  const planServiceMappings: Array<{ planSlug: string; serviceSlug: string }> = [
    { planSlug: 'basic', serviceSlug: 'edms' },
    { planSlug: 'basic', serviceSlug: 'data-portal' },
    { planSlug: 'standard', serviceSlug: 'edms' },
    { planSlug: 'standard', serviceSlug: 'data-portal' },
    { planSlug: 'standard', serviceSlug: 'ai-policy' },
    { planSlug: 'standard', serviceSlug: 'security-audit' },
    { planSlug: 'enterprise', serviceSlug: 'edms' },
    { planSlug: 'enterprise', serviceSlug: 'data-portal' },
    { planSlug: 'enterprise', serviceSlug: 'ai-policy' },
    { planSlug: 'enterprise', serviceSlug: 'security-audit' },
    { planSlug: 'enterprise', serviceSlug: 'erp-hub' },
  ]

  const plans = { basic: planBasic, standard: planStandard, enterprise: planEnterprise }
  const serviceMap: Record<string, string> = {}
  for (const svc of services) {
    serviceMap[svc.slug] = svc.id
  }

  let psIndex = 0
  for (const mapping of planServiceMappings) {
    const planObj = plans[mapping.planSlug as keyof typeof plans]
    const serviceId = serviceMap[mapping.serviceSlug]
    if (planObj && serviceId) {
      await prisma.planService.upsert({
        where: { id: `ps-seed-${String(psIndex).padStart(3, '0')}` },
        update: {},
        create: {
          id: `ps-seed-${String(psIndex).padStart(3, '0')}`,
          planId: planObj.id,
          serviceId: serviceId,
        },
      })
      psIndex++
    }
  }

  console.log(`  - 플랜-서비스 매핑 ${psIndex}건 생성 완료`)

  // ----------------------------------------------------------
  // 10. AI 모델 등록 (N2SF N-05)
  // ----------------------------------------------------------
  console.log('[SEED] 10/10 AI 모델 등록...')

  await prisma.aiModel.upsert({
    where: { id: 'ai-model-claude-sonnet' },
    update: {},
    create: {
      id: 'ai-model-claude-sonnet',
      name: 'Claude Sonnet (AI Gateway)',
      provider: 'Anthropic',
      endpoint: 'http://ai-gateway.internal/v1/messages',
      maxGrade: 'O', // N2SF: O등급 데이터만 허용
      isActive: true,
      config: { masking: true, auditRequired: true },
    },
  })

  await prisma.aiModel.upsert({
    where: { id: 'ai-model-policy-analyzer' },
    update: {},
    create: {
      id: 'ai-model-policy-analyzer',
      name: '정책문서 분석기 (내부)',
      provider: 'Internal',
      endpoint: 'http://policy-ai.internal/analyze',
      maxGrade: 'S', // 내부 모델은 S등급까지 허용
      isActive: false,
      config: { masking: true, auditRequired: true },
    },
  })

  console.log('  - AI 모델 2종 등록 완료')

  // ----------------------------------------------------------
  // 완료
  // ----------------------------------------------------------
  console.log('')
  console.log('===================================')
  console.log('[SEED] 데모 데이터 생성 완료')
  console.log('===================================')
  console.log('데모 계정:')
  console.log('  SUPER_ADMIN  : superadmin@platform.go.kr / Demo2026!')
  console.log('  TENANT_ADMIN : admin@mois-demo.go.kr / Demo2026!')
  console.log('  TENANT_ADMIN : admin@molit-demo.go.kr / Demo2026!')
  console.log('  USER         : user1@mois-demo.go.kr / Demo2026!')
  console.log('  AUDITOR      : auditor@mois-demo.go.kr / Demo2026!')
  console.log('===================================')
}

main()
  .catch((error) => {
    console.error('[SEED] 오류 발생:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
