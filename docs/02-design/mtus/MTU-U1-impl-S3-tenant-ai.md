# MTU-U1 구현 가이드: Session 3 — 테넌트 커스터마이제이션 + AI UI

| 항목 | 내용 |
|------|------|
| 문서 유형 | 구현 가이드 (Implementation Guide) |
| 연계 설계 | MTU-U1-ui-design-system.design.md 섹션 D, E |
| 기술 스택 | Next.js 15, AI SDK 5 (`@ai-sdk/react`, `@ai-sdk/openai-compatible`), Prisma/PostgreSQL, cmdk, Radix UI |
| 작성일 | 2026-04-05 |
| 버전 | 1.0.0 |
| 상태 | 초안 |

---

## Executive Summary

| 관점 | 구현 내용 | 기준 |
|------|---------|------|
| **테넌트 커스터마이제이션** | DB 기반 CSS Variable 오버라이드, 관리자 테마 설정 UI, 도메인 매핑 | §D.1–D.5 |
| **AI UI 컴포넌트** | 사이드 패널, SSE 스트리밍 채팅, 인라인 제안, 명령 팔레트(Cmd+K) | §E.1–E.7 |
| **N2SF 이중 검증** | 클라이언트 차단 + 서버 API 재확인 (C/S등급 → AI API 절대 전송 금지) | N2SF N-05 |
| **감사 로그** | 테마 변경 + AI 호출 전수 기록, append-only | CSAP D-06 |

---

## 1. 테넌트 커스터마이제이션 시스템

### 1.1 의존성 추가 (package.json)

Session 1+2 의존성에 아래 패키지를 추가합니다.

```json
{
  "dependencies": {
    "ai": "^5.0.0",
    "@ai-sdk/react": "^1.0.0",
    "@ai-sdk/openai-compatible": "^0.2.0",
    "cmdk": "^1.0.4",
    "react-markdown": "^9.0.1",
    "rehype-highlight": "^7.0.1",
    "remark-gfm": "^4.0.0",
    "@prisma/client": "^5.22.0",
    "prisma": "^5.22.0",
    "bcryptjs": "^2.4.3",
    "@types/bcryptjs": "^2.4.6"
  }
}
```

---

### 1.2 데이터베이스 스키마 (Prisma)

**파일**: `prisma/schema.prisma` (테넌트 테마 관련 모델 — 기존 스키마에 추가)

```prisma
// Design Ref: §D.2
// Plan SC: FR-U.5

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 테넌트 기본 정보
model Tenant {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @db.VarChar(200)
  slug        String   @unique @db.VarChar(100)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz

  themes      TenantTheme[]
  themeHistory TenantThemeHistory[]
  domains     TenantDomain[]

  @@map("tenants")
}

// 테넌트 테마 설정
model TenantTheme {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @map("tenant_id") @db.Uuid
  // 기본 테마 (5종 중 선택)
  baseTheme       String   @default("government-blue") @map("base_theme") @db.VarChar(50)
  // 색상 오버라이드 (oklch() 형식)
  colorPrimary    String?  @map("color_primary") @db.VarChar(100)
  colorSecondary  String?  @map("color_secondary") @db.VarChar(100)
  colorAccent     String?  @map("color_accent") @db.VarChar(100)
  colorSidebar    String?  @map("color_sidebar") @db.VarChar(100)
  colorHeader     String?  @map("color_header") @db.VarChar(100)
  // 타이포그래피
  fontFamily      String?  @map("font_family") @db.VarChar(200)
  fontSizeBase    String?  @map("font_size_base") @db.VarChar(10)
  // 로고
  logoUrl         String?  @map("logo_url") @db.VarChar(500)
  logoAltText     String?  @map("logo_alt_text") @db.VarChar(200)
  faviconUrl      String?  @map("favicon_url") @db.VarChar(500)
  // 레이아웃
  borderRadius    String?  @map("border_radius") @db.VarChar(10)
  sidebarWidth    String?  @map("sidebar_width") @db.VarChar(10)
  // 메타
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz
  updatedBy       String?  @map("updated_by") @db.Uuid

  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, isActive], name: "uq_tenant_active_theme")
  @@index([tenantId])
  @@map("tenant_themes")
}

// 테마 변경 이력 (CSAP D-06 감사 추적)
model TenantThemeHistory {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @map("tenant_id") @db.Uuid
  // 변경 전 스냅샷 (JSON)
  themeSnapshot  Json     @map("theme_snapshot")
  changedBy      String   @map("changed_by") @db.Uuid
  changedAt      DateTime @default(now()) @map("changed_at") @db.Timestamptz
  changeReason   String?  @map("change_reason")
  // 감사 메타데이터
  actorIp        String?  @map("actor_ip") @db.VarChar(45)
  userAgent      String?  @map("user_agent") @db.VarChar(500)

  tenant         Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, changedAt(sort: Desc)])
  @@map("tenant_theme_history")
}

// 화이트라벨 도메인 매핑
model TenantDomain {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  domain    String   @unique @db.VarChar(255)
  isVerified Boolean @default(false) @map("is_verified")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([domain])
  @@map("tenant_domains")
}
```

---

### 1.3 CSS Variable 오버라이드 시스템

#### 1.3.1 CSS 생성 유틸리티

**파일**: `lib/theme/css-generator.ts`

```typescript
// Design Ref: §D.3
// Plan SC: FR-U.5
// 목적: 테넌트 DB 설정 → CSS Custom Properties 문자열 생성

// 공공기관 허용 폰트 목록 (행안부 공문서 기준)
export const ALLOWED_FONT_FAMILIES = [
  "'Noto Sans KR'",
  "'Malgun Gothic'",
  "'Apple SD Gothic Neo'",
  "Gungsuh",
  "'Nanum Gothic'",
  "'Nanum Myeongjo'",
  "system-ui",
] as const

export type AllowedFontFamily = (typeof ALLOWED_FONT_FAMILIES)[number]

export interface TenantThemeConfig {
  tenantId: string
  baseTheme: string
  colorPrimary?: string | null
  colorSecondary?: string | null
  colorAccent?: string | null
  colorSidebar?: string | null
  colorHeader?: string | null
  fontFamily?: string | null
  fontSizeBase?: string | null
  borderRadius?: string | null
  sidebarWidth?: string | null
  logoUrl?: string | null
  logoAltText?: string | null
}

// 색상 값 안전성 검증 (CSS 주입 방지)
function sanitizeColorValue(value: string): string {
  // oklch(), hsl(), hex(#RRGGBB), rgb() 형식만 허용
  const allowedPattern =
    /^(oklch\([^)]{1,100}\)|hsl\([^)]{1,100}\)|#[0-9a-fA-F]{3,8}|rgb\([^)]{1,100}\))$/
  if (!allowedPattern.test(value.trim())) {
    throw new Error(`허용되지 않는 색상 형식: ${value}`)
  }
  return value.trim()
}

// 폰트 허용 목록 검증
function sanitizeFontFamily(value: string): string {
  const isAllowed = ALLOWED_FONT_FAMILIES.some(
    (allowed) => value.includes(allowed.replace(/'/g, ''))
  )
  if (!isAllowed) {
    // 허용 목록에 없으면 기본 폰트로 대체
    return "'Noto Sans KR', 'Malgun Gothic', system-ui, sans-serif"
  }
  return value
}

// rem/px 값 검증 (layout 값용)
function sanitizeSizeValue(value: string): string {
  const allowedPattern = /^(\d+\.?\d*(rem|px|em)|0)$/
  if (!allowedPattern.test(value.trim())) {
    throw new Error(`허용되지 않는 크기 형식: ${value}`)
  }
  return value.trim()
}

/**
 * 테넌트 테마 설정을 CSS Custom Properties 문자열로 변환
 * @param config 테넌트 테마 DB 레코드
 * @returns CSS @layer tenant 블록 문자열
 */
export function generateTenantCSS(config: TenantThemeConfig): string {
  const overrides: string[] = []

  try {
    if (config.colorPrimary) {
      const safe = sanitizeColorValue(config.colorPrimary)
      overrides.push(`  --color-primary: ${safe};`)
      // 자동 hover/active 변형 생성 (oklch lightness 조정)
      overrides.push(
        `  --color-primary-hover: color-mix(in oklch, ${safe}, black 15%);`
      )
      overrides.push(
        `  --color-primary-active: color-mix(in oklch, ${safe}, black 25%);`
      )
    }

    if (config.colorSecondary) {
      overrides.push(
        `  --color-secondary: ${sanitizeColorValue(config.colorSecondary)};`
      )
    }

    if (config.colorAccent) {
      overrides.push(
        `  --color-accent: ${sanitizeColorValue(config.colorAccent)};`
      )
    }

    if (config.colorSidebar) {
      overrides.push(
        `  --color-sidebar-bg: ${sanitizeColorValue(config.colorSidebar)};`
      )
    }

    if (config.colorHeader) {
      overrides.push(
        `  --color-header-bg: ${sanitizeColorValue(config.colorHeader)};`
      )
    }

    if (config.fontFamily) {
      const safeFontFamily = sanitizeFontFamily(config.fontFamily)
      overrides.push(`  --font-sans: ${safeFontFamily};`)
    }

    if (config.fontSizeBase) {
      overrides.push(
        `  --font-size-base: ${sanitizeSizeValue(config.fontSizeBase)};`
      )
    }

    if (config.borderRadius) {
      overrides.push(
        `  --radius-md: ${sanitizeSizeValue(config.borderRadius)};`
      )
    }

    if (config.sidebarWidth) {
      overrides.push(
        `  --sidebar-width: ${sanitizeSizeValue(config.sidebarWidth)};`
      )
    }
  } catch (error) {
    // 값 검증 실패 시 해당 항목 건너뜀 (기본값 유지)
    console.error(`[TenantCSS] 값 검증 오류 (tenantId: ${config.tenantId}):`, error)
  }

  if (overrides.length === 0) {
    return `/* tenant-${config.tenantId}: 기본 테마 사용 */`
  }

  return `@layer tenant {
  [data-tenant="${config.tenantId}"] {
${overrides.join('\n')}
  }
}`
}
```

#### 1.3.2 WCAG 대비율 검증 유틸리티

**파일**: `lib/theme/contrast-checker.ts`

```typescript
// Design Ref: §D.4
// 목적: 색상 접근성 자동 검증 (KWCAG 2.2 1.4.3 — 최소 4.5:1)

/**
 * sRGB 채널 값(0~255)을 상대 휘도 계산용 선형 값으로 변환
 */
function toLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/**
 * hex 색상을 상대 휘도로 변환 (WCAG 2.1 공식)
 */
export function hexToRelativeLuminance(hex: string): number {
  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.substring(0, 2), 16)
  const g = parseInt(cleaned.substring(2, 4), 16)
  const b = parseInt(cleaned.substring(4, 6), 16)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

export interface ContrastResult {
  ratio: number
  passAA: boolean   // KWCAG 2.2 1.4.3 일반 텍스트 (4.5:1)
  passAAA: boolean  // KWCAG 2.2 1.4.6 향상 대비 (7.0:1)
  passLargeAA: boolean // KWCAG 2.2 1.4.3 큰 텍스트 (3.0:1)
}

/**
 * 두 hex 색상 간 WCAG 대비율 계산
 * @param foreground 전경 hex 색상 (#RRGGBB)
 * @param background 배경 hex 색상 (#RRGGBB)
 */
export function checkContrastRatio(
  foreground: string,
  background: string
): ContrastResult {
  const lFg = hexToRelativeLuminance(foreground)
  const lBg = hexToRelativeLuminance(background)

  const lighter = Math.max(lFg, lBg)
  const darker = Math.min(lFg, lBg)
  const ratio = (lighter + 0.05) / (darker + 0.05)
  const rounded = Math.round(ratio * 10) / 10

  return {
    ratio: rounded,
    passAA: rounded >= 4.5,
    passAAA: rounded >= 7.0,
    passLargeAA: rounded >= 3.0,
  }
}
```

---

### 1.4 테넌트 테마 API

**파일**: `app/api/tenant/theme/route.ts`

```typescript
// Design Ref: §D.3, §D.4
// Plan SC: FR-U.5, FR-U.6
// CSAP: D-06 감사 로그, D-08 접근 통제, D-12 입력 검증

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { auditLog } from '@/lib/audit/audit-logger'
import { generateTenantCSS } from '@/lib/theme/css-generator'
import { verifyToken, hasPermission } from '@/lib/auth/rbac'
import { getClientIP } from '@/lib/utils/request'

// 입력 검증 스키마 (Zod — CSAP D-12)
const updateThemeSchema = z.object({
  baseTheme: z
    .enum([
      'government-blue',
      'government-green',
      'dark',
      'neutral-gray',
      'high-contrast',
    ])
    .optional(),
  colorPrimary: z
    .string()
    .regex(
      /^(oklch\([^)]{1,100}\)|hsl\([^)]{1,100}\)|#[0-9a-fA-F]{3,8}|rgb\([^)]{1,100}\))$/
    )
    .optional()
    .nullable(),
  colorSecondary: z
    .string()
    .regex(
      /^(oklch\([^)]{1,100}\)|hsl\([^)]{1,100}\)|#[0-9a-fA-F]{3,8}|rgb\([^)]{1,100}\))$/
    )
    .optional()
    .nullable(),
  colorAccent: z
    .string()
    .regex(
      /^(oklch\([^)]{1,100}\)|hsl\([^)]{1,100}\)|#[0-9a-fA-F]{3,8}|rgb\([^)]{1,100}\))$/
    )
    .optional()
    .nullable(),
  colorSidebar: z
    .string()
    .regex(
      /^(oklch\([^)]{1,100}\)|hsl\([^)]{1,100}\)|#[0-9a-fA-F]{3,8}|rgb\([^)]{1,100}\))$/
    )
    .optional()
    .nullable(),
  colorHeader: z
    .string()
    .regex(
      /^(oklch\([^)]{1,100}\)|hsl\([^)]{1,100}\)|#[0-9a-fA-F]{3,8}|rgb\([^)]{1,100}\))$/
    )
    .optional()
    .nullable(),
  fontFamily: z.string().max(200).optional().nullable(),
  fontSizeBase: z
    .string()
    .regex(/^(\d+\.?\d*(rem|px|em)|0)$/)
    .optional()
    .nullable(),
  borderRadius: z
    .string()
    .regex(/^(\d+\.?\d*(rem|px|em)|0)$/)
    .optional()
    .nullable(),
  sidebarWidth: z
    .string()
    .regex(/^(\d+\.?\d*(rem|px|em)|0)$/)
    .optional()
    .nullable(),
  logoUrl: z.string().url().max(500).optional().nullable(),
  logoAltText: z.string().max(200).optional().nullable(),
  changeReason: z.string().max(500).optional(),
})

// GET /api/tenant/theme — 현재 활성 테마 조회
export async function GET(request: NextRequest) {
  // CSAP D-08: 인증 확인
  const user = await verifyToken(request.headers.get('Authorization'))
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  const tenantId = request.headers.get('x-tenant-id')
  if (!tenantId) {
    return NextResponse.json({ error: '테넌트 ID가 없습니다' }, { status: 400 })
  }

  const theme = await prisma.tenantTheme.findFirst({
    where: { tenantId, isActive: true },
  })

  if (!theme) {
    return NextResponse.json({ theme: null, css: '/* 기본 테마 */' })
  }

  const css = generateTenantCSS({
    tenantId: theme.tenantId,
    baseTheme: theme.baseTheme,
    colorPrimary: theme.colorPrimary,
    colorSecondary: theme.colorSecondary,
    colorAccent: theme.colorAccent,
    colorSidebar: theme.colorSidebar,
    colorHeader: theme.colorHeader,
    fontFamily: theme.fontFamily,
    fontSizeBase: theme.fontSizeBase,
    borderRadius: theme.borderRadius,
    sidebarWidth: theme.sidebarWidth,
    logoUrl: theme.logoUrl,
    logoAltText: theme.logoAltText,
  })

  return NextResponse.json({ theme, css })
}

// PUT /api/tenant/theme — 테마 설정 저장
export async function PUT(request: NextRequest) {
  // CSAP D-08: 관리자 권한 확인
  const user = await verifyToken(request.headers.get('Authorization'))
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }
  if (!hasPermission(user, 'tenant:theme:write')) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  }

  const tenantId = request.headers.get('x-tenant-id')
  if (!tenantId) {
    return NextResponse.json({ error: '테넌트 ID가 없습니다' }, { status: 400 })
  }

  // CSAP D-12: 입력 검증
  const body = await request.json()
  const parsed = updateThemeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '입력값 오류', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data

  // 트랜잭션: 기존 테마 비활성화 → 이력 저장 → 새 테마 생성
  const updatedTheme = await prisma.$transaction(async (tx) => {
    // 현재 활성 테마 조회 (이력 저장용)
    const existing = await tx.tenantTheme.findFirst({
      where: { tenantId, isActive: true },
    })

    if (existing) {
      // CSAP D-06: 변경 전 스냅샷을 이력 테이블에 저장
      await tx.tenantThemeHistory.create({
        data: {
          tenantId,
          themeSnapshot: existing as unknown as Record<string, unknown>,
          changedBy: user.id,
          changeReason: data.changeReason ?? '관리자 테마 변경',
          actorIp: getClientIP(request),
          userAgent: request.headers.get('user-agent') ?? undefined,
        },
      })

      // 기존 테마 비활성화
      await tx.tenantTheme.update({
        where: { id: existing.id },
        data: { isActive: false },
      })
    }

    // 새 테마 생성
    return tx.tenantTheme.create({
      data: {
        tenantId,
        baseTheme: data.baseTheme ?? 'government-blue',
        colorPrimary: data.colorPrimary,
        colorSecondary: data.colorSecondary,
        colorAccent: data.colorAccent,
        colorSidebar: data.colorSidebar,
        colorHeader: data.colorHeader,
        fontFamily: data.fontFamily,
        fontSizeBase: data.fontSizeBase,
        borderRadius: data.borderRadius,
        sidebarWidth: data.sidebarWidth,
        logoUrl: data.logoUrl,
        logoAltText: data.logoAltText,
        updatedBy: user.id,
        isActive: true,
      },
    })
  })

  // CSAP D-06: 감사 로그 기록
  await auditLog({
    actor: user.id,
    action: 'TENANT_THEME_UPDATE',
    target: tenantId,
    metadata: { themeId: updatedTheme.id, baseTheme: updatedTheme.baseTheme },
    ip: getClientIP(request),
    userAgent: request.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ theme: updatedTheme }, { status: 200 })
}
```

#### 1.4.1 테마 CSS 엔드포인트 (Edge Function)

**파일**: `app/api/themes/[tenantId]/route.ts`

```typescript
// Design Ref: §D.3
// 목적: 테넌트 CSS를 Edge에서 서빙 (캐시 + CDN 프리로드)

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { generateTenantCSS } from '@/lib/theme/css-generator'

export const runtime = 'edge'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params

  const theme = await prisma.tenantTheme.findFirst({
    where: { tenantId, isActive: true },
  })

  const css = theme
    ? generateTenantCSS({
        tenantId: theme.tenantId,
        baseTheme: theme.baseTheme,
        colorPrimary: theme.colorPrimary,
        colorSecondary: theme.colorSecondary,
        colorAccent: theme.colorAccent,
        colorSidebar: theme.colorSidebar,
        colorHeader: theme.colorHeader,
        fontFamily: theme.fontFamily,
        fontSizeBase: theme.fontSizeBase,
        borderRadius: theme.borderRadius,
        sidebarWidth: theme.sidebarWidth,
        logoUrl: theme.logoUrl,
        logoAltText: theme.logoAltText,
      })
    : `/* tenant-${tenantId}: 기본 테마 */`

  return new NextResponse(css, {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      // 1시간 캐시, stale-while-revalidate 24시간
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
```

---

### 1.5 Edge Middleware — 테넌트 식별 + 테마 주입

**파일**: `middleware.ts`

```typescript
// Design Ref: §D.5
// Plan SC: FR-U.5
// 목적: 도메인/서브도메인으로 테넌트 식별 후 요청 헤더 주입

import { type NextRequest, NextResponse } from 'next/server'

export const config = {
  matcher: [
    // _next/static, _next/image, favicon.ico, API 일부 제외
    '/((?!_next/static|_next/image|favicon.ico|api/themes).*)',
  ],
}

/**
 * 호스트명으로 테넌트 조회
 * 예: ministry-a.saas.go.kr → { id: 'uuid', themeId: 'uuid' }
 * 예: custom.ministry-a.go.kr → { id: 'uuid', themeId: 'uuid' }
 */
async function resolveTenantByDomain(
  hostname: string
): Promise<{ id: string; themeId: string } | null> {
  // 환경변수에서 API 베이스 URL 조회 (Edge에서 직접 DB 접근 불가)
  const apiBase = process.env.INTERNAL_API_BASE
  if (!apiBase) return null

  try {
    const res = await fetch(`${apiBase}/api/internal/tenant-by-domain`, {
      headers: { 'x-domain': hostname },
      // Edge에서 내부 API 호출 — 외부 노출 없음
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  // 포트 제거 (로컬 개발 환경 대응)
  const domain = hostname.split(':')[0]

  const tenant = await resolveTenantByDomain(domain)

  if (tenant) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-tenant-id', tenant.id)
    requestHeaders.set('x-tenant-theme-id', tenant.themeId)

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    })

    // 테넌트 CSS 프리로드 힌트 (CDN 캐시 활용)
    response.headers.set(
      'Link',
      `</api/themes/${tenant.id}>; rel=preload; as=style`
    )

    // 테넌트 ID를 쿠키에도 설정 (클라이언트 참조용)
    response.cookies.set('x-tenant-id', tenant.id, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
    })

    return response
  }

  return NextResponse.next()
}
```

---

### 1.6 관리자 테마 설정 UI

**파일**: `components/admin/theme-configurator.tsx`

```typescript
// Design Ref: §D.4
// Plan SC: FR-U.6
// 목적: 관리자 테마 설정 페이지 컴포넌트

'use client'

import { useState, useCallback, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { checkContrastRatio } from '@/lib/theme/contrast-checker'
import { auditLog } from '@/lib/audit/audit-logger'

// 허용 폰트 목록 (공공기관 표준)
const ALLOWED_FONTS = [
  { label: 'Noto Sans KR (기본)', value: "'Noto Sans KR'" },
  { label: '맑은 고딕', value: "'Malgun Gothic'" },
  { label: '나눔고딕', value: "'Nanum Gothic'" },
  { label: '나눔명조', value: "'Nanum Myeongjo'" },
  { label: '시스템 폰트', value: 'system-ui' },
] as const

// 기본 테마 5종
const BASE_THEMES = [
  { id: 'government-blue', label: '정부 파랑', preview: '#1d4ed8' },
  { id: 'government-green', label: '정부 초록', preview: '#15803d' },
  { id: 'dark', label: '다크', preview: '#1e293b' },
  { id: 'neutral-gray', label: '중립 회색', preview: '#6b7280' },
  { id: 'high-contrast', label: '고대비', preview: '#000000' },
] as const

const themeFormSchema = z.object({
  baseTheme: z.string(),
  colorPrimary: z.string().optional(),
  colorSecondary: z.string().optional(),
  fontFamily: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  logoAltText: z.string().max(200).optional(),
  borderRadius: z.string().optional(),
  sidebarWidth: z.string().optional(),
  changeReason: z.string().max(500).optional(),
})

type ThemeFormValues = z.infer<typeof themeFormSchema>

interface ContrastWarning {
  field: string
  ratio: number
  pass: boolean
}

interface ThemeConfiguratorProps {
  tenantId: string
  initialValues?: Partial<ThemeFormValues>
  onSaveSuccess?: () => void
}

export function ThemeConfigurator({
  tenantId,
  initialValues,
  onSaveSuccess,
}: ThemeConfiguratorProps) {
  const [isPending, startTransition] = useTransition()
  const [contrastWarnings, setContrastWarnings] = useState<ContrastWarning[]>([])
  const [previewKey, setPreviewKey] = useState(0)

  const form = useForm<ThemeFormValues>({
    resolver: zodResolver(themeFormSchema),
    defaultValues: {
      baseTheme: 'government-blue',
      colorPrimary: '',
      colorSecondary: '',
      fontFamily: "'Noto Sans KR'",
      logoUrl: '',
      logoAltText: '',
      borderRadius: '0.375rem',
      sidebarWidth: '240px',
      changeReason: '',
      ...initialValues,
    },
  })

  // 색상 변경 시 대비율 자동 검증
  const handleColorChange = useCallback(
    (field: 'colorPrimary' | 'colorSecondary', value: string) => {
      form.setValue(field, value)

      // hex 형식인 경우만 대비율 검사
      if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        const result = checkContrastRatio(value, '#ffffff')
        setContrastWarnings((prev) => {
          const others = prev.filter((w) => w.field !== field)
          return [...others, { field, ratio: result.ratio, pass: result.passAA }]
        })
      }

      // 미리보기 갱신
      setPreviewKey((k) => k + 1)
    },
    [form]
  )

  async function onSubmit(values: ThemeFormValues) {
    startTransition(async () => {
      const response = await fetch('/api/tenant/theme', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const err = await response.json()
        form.setError('root', { message: err.error ?? '저장 실패' })
        return
      }

      onSaveSuccess?.()
    })
  }

  const primaryWarning = contrastWarnings.find((w) => w.field === 'colorPrimary')

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">테마 설정</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => form.reset()}
            className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-md hover:bg-[var(--color-muted)]"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isPending}
            className={cn(
              'px-4 py-2 text-sm rounded-md',
              'bg-[var(--color-primary)] text-[var(--color-on-primary)]',
              'hover:bg-[var(--color-primary-hover)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 기본 테마 선택 */}
        <section aria-labelledby="base-theme-heading">
          <h2 id="base-theme-heading" className="text-sm font-medium mb-3">
            기본 테마 선택
          </h2>
          <div className="flex gap-3 flex-wrap">
            {BASE_THEMES.map((theme) => {
              const isSelected = form.watch('baseTheme') === theme.id
              return (
                <button
                  key={theme.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => form.setValue('baseTheme', theme.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                    isSelected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-bg)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'
                  )}
                >
                  <div
                    className="w-10 h-10 rounded-md"
                    style={{ backgroundColor: theme.preview }}
                    aria-hidden="true"
                  />
                  <span className="text-xs">{theme.label}</span>
                  {isSelected && (
                    <span className="sr-only">(선택됨)</span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* 색상 커스터마이징 */}
        <section aria-labelledby="color-heading">
          <h2 id="color-heading" className="text-sm font-medium mb-3">
            색상 커스터마이징
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 주 색상 */}
            <div className="space-y-2">
              <label
                htmlFor="colorPrimary"
                className="text-sm text-[var(--color-text-secondary)]"
              >
                주 색상
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="colorPrimary"
                  type="color"
                  value={form.watch('colorPrimary') || '#1d4ed8'}
                  onChange={(e) => handleColorChange('colorPrimary', e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-[var(--color-border)]"
                  aria-describedby="colorPrimary-contrast"
                />
                <input
                  type="text"
                  value={form.watch('colorPrimary') || ''}
                  onChange={(e) => handleColorChange('colorPrimary', e.target.value)}
                  placeholder="#1d4ed8"
                  className={cn(
                    'flex-1 px-3 py-2 text-sm border rounded-md bg-transparent',
                    'border-[var(--color-border)]',
                    'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'
                  )}
                />
              </div>
              {/* 대비율 표시 */}
              {primaryWarning && (
                <p
                  id="colorPrimary-contrast"
                  className={cn(
                    'text-xs',
                    primaryWarning.pass
                      ? 'text-[var(--color-success)]'
                      : 'text-[var(--color-danger)]'
                  )}
                  role="status"
                >
                  대비율: {primaryWarning.ratio}:1{' '}
                  {primaryWarning.pass ? '✓ KWCAG AA 통과' : '✗ KWCAG AA 미달 (4.5:1 필요)'}
                </p>
              )}
            </div>

            {/* 보조 색상 */}
            <div className="space-y-2">
              <label
                htmlFor="colorSecondary"
                className="text-sm text-[var(--color-text-secondary)]"
              >
                보조 색상
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="colorSecondary"
                  type="color"
                  value={form.watch('colorSecondary') || '#6b7280'}
                  onChange={(e) => handleColorChange('colorSecondary', e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-[var(--color-border)]"
                />
                <input
                  type="text"
                  value={form.watch('colorSecondary') || ''}
                  onChange={(e) => handleColorChange('colorSecondary', e.target.value)}
                  placeholder="#6b7280"
                  className={cn(
                    'flex-1 px-3 py-2 text-sm border rounded-md bg-transparent',
                    'border-[var(--color-border)]',
                    'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'
                  )}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 로고 업로드 */}
        <section aria-labelledby="logo-heading">
          <h2 id="logo-heading" className="text-sm font-medium mb-3">
            로고 업로드
          </h2>
          <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-3">
            {form.watch('logoUrl') && (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.watch('logoUrl')}
                  alt={form.watch('logoAltText') || '로고 미리보기'}
                  className="max-h-12 max-w-40 object-contain"
                />
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="logoUrl" className="text-xs text-[var(--color-text-secondary)]">
                로고 URL (SVG 또는 PNG, 최대 200x60px 권장)
              </label>
              <input
                id="logoUrl"
                type="url"
                {...form.register('logoUrl')}
                placeholder="https://example.go.kr/logo.svg"
                className={cn(
                  'w-full px-3 py-2 text-sm border rounded-md bg-transparent',
                  'border-[var(--color-border)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'
                )}
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="logoAltText"
                className="text-xs text-[var(--color-text-secondary)]"
              >
                대체 텍스트 (접근성 필수 — KWCAG 1.1.1)
              </label>
              <input
                id="logoAltText"
                type="text"
                {...form.register('logoAltText')}
                placeholder="○○부 로고"
                className={cn(
                  'w-full px-3 py-2 text-sm border rounded-md bg-transparent',
                  'border-[var(--color-border)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'
                )}
              />
            </div>
          </div>
        </section>

        {/* 폰트 / 레이아웃 */}
        <section aria-labelledby="layout-heading">
          <h2 id="layout-heading" className="text-sm font-medium mb-3">
            폰트 / 레이아웃
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label
                htmlFor="fontFamily"
                className="text-xs text-[var(--color-text-secondary)]"
              >
                폰트 선택
              </label>
              <select
                id="fontFamily"
                {...form.register('fontFamily')}
                className={cn(
                  'w-full px-3 py-2 text-sm border rounded-md bg-[var(--color-surface)]',
                  'border-[var(--color-border)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'
                )}
              >
                {ALLOWED_FONTS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="borderRadius"
                className="text-xs text-[var(--color-text-secondary)]"
              >
                모서리 반경
              </label>
              <input
                id="borderRadius"
                type="text"
                {...form.register('borderRadius')}
                placeholder="0.375rem"
                className={cn(
                  'w-full px-3 py-2 text-sm border rounded-md bg-transparent',
                  'border-[var(--color-border)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'
                )}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="sidebarWidth"
                className="text-xs text-[var(--color-text-secondary)]"
              >
                사이드바 너비
              </label>
              <input
                id="sidebarWidth"
                type="text"
                {...form.register('sidebarWidth')}
                placeholder="240px"
                className={cn(
                  'w-full px-3 py-2 text-sm border rounded-md bg-transparent',
                  'border-[var(--color-border)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'
                )}
              />
            </div>
          </div>
        </section>

        {/* 변경 사유 */}
        <div className="space-y-2">
          <label
            htmlFor="changeReason"
            className="text-sm text-[var(--color-text-secondary)]"
          >
            변경 사유 (감사 로그용 — CSAP D-06)
          </label>
          <input
            id="changeReason"
            type="text"
            {...form.register('changeReason')}
            placeholder="예: 기관 BI 업데이트 반영"
            className={cn(
              'w-full px-3 py-2 text-sm border rounded-md bg-transparent',
              'border-[var(--color-border)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'
            )}
          />
        </div>

        {/* 폼 오류 */}
        {form.formState.errors.root && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {form.formState.errors.root.message}
          </p>
        )}
      </form>

      {/* 실시간 미리보기 */}
      <section aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="text-sm font-medium mb-3">
          실시간 미리보기
        </h2>
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden h-64">
          <iframe
            key={previewKey}
            src={`/preview/theme?primary=${encodeURIComponent(form.watch('colorPrimary') ?? '')}`}
            title="테마 미리보기"
            className="w-full h-full"
            sandbox="allow-same-origin"
          />
        </div>
      </section>
    </div>
  )
}
```

---

### 1.7 화이트라벨 도메인 리졸버

**파일**: `lib/tenant/domain-resolver.ts`

```typescript
// Design Ref: §D.5
// 목적: 도메인 → 테넌트 매핑 조회 (캐시 포함)

import { prisma } from '@/lib/db/client'

interface TenantInfo {
  id: string
  themeId: string
  name: string
}

// 인메모리 캐시 (Edge Function 인스턴스별 — 1분 TTL)
const domainCache = new Map<string, { data: TenantInfo | null; expiresAt: number }>()
const CACHE_TTL_MS = 60 * 1000 // 1분

/**
 * 도메인으로 테넌트 정보 조회 (캐시 → DB 순)
 */
export async function resolveTenantByDomain(
  domain: string
): Promise<TenantInfo | null> {
  // 내부 도메인 및 로컬 개발 환경 제외
  if (
    domain === 'localhost' ||
    domain.startsWith('127.') ||
    domain.endsWith('.localhost')
  ) {
    return null
  }

  // 캐시 확인
  const cached = domainCache.get(domain)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  // DB 조회
  const tenantDomain = await prisma.tenantDomain.findUnique({
    where: { domain, isVerified: true },
    include: {
      tenant: {
        include: {
          themes: {
            where: { isActive: true },
            take: 1,
          },
        },
      },
    },
  })

  const result = tenantDomain
    ? {
        id: tenantDomain.tenant.id,
        themeId: tenantDomain.tenant.themes[0]?.id ?? '',
        name: tenantDomain.tenant.name,
      }
    : null

  // 캐시 저장
  domainCache.set(domain, { data: result, expiresAt: Date.now() + CACHE_TTL_MS })

  return result
}
```

---

## 2. AI Assistant UI 컴포넌트

### 2.1 N2SF 데이터 등급 검증 (클라이언트)

**파일**: `lib/n2sf/data-grade-validator.ts`

```typescript
// Design Ref: §E.7, §E.1
// Plan SC: NFR-U.8
// CSAP: N2SF N-05 — C/S등급 데이터 AI API 전송 절대 금지

/** N2SF 데이터 등급 */
export type DataGrade = 'C' | 'S' | 'O'

/** AI API 전송 가능 여부 검증 결과 */
export interface DataGradeValidationResult {
  allowed: boolean
  grade: DataGrade
  reason: string
}

/**
 * 데이터 등급이 AI API 전송 가능한지 검증
 * C등급(기밀), S등급(민감)은 절대 전송 금지
 * O등급(공개)만 PII 마스킹 후 전송 허용
 */
export function validateForAI(grade: DataGrade): DataGradeValidationResult {
  switch (grade) {
    case 'C':
      return {
        allowed: false,
        grade,
        reason:
          'C등급(기밀) 데이터는 AI API 전송이 금지됩니다. (N2SF N-05 위반)',
      }
    case 'S':
      return {
        allowed: false,
        grade,
        reason:
          'S등급(민감) 데이터는 AI API 전송이 금지됩니다. (N2SF N-05 위반)',
      }
    case 'O':
      return {
        allowed: true,
        grade,
        reason: 'O등급(공개) 데이터 — PII 마스킹 후 전송 허용',
      }
  }
}

/**
 * 텍스트에서 PII(개인식별정보) 마스킹
 * 주민등록번호, 전화번호, 이메일, 이름 패턴 치환
 */
export function maskPII(text: string): string {
  let masked = text

  // 주민등록번호 (6자리-7자리)
  masked = masked.replace(
    /\d{6}-[1-4]\d{6}/g,
    '******-*******'
  )

  // 전화번호 (010-XXXX-XXXX, 02-XXXX-XXXX 등)
  masked = masked.replace(
    /\d{2,3}-\d{3,4}-\d{4}/g,
    '***-****-****'
  )

  // 이메일
  masked = masked.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '***@***.***'
  )

  return masked
}
```

### 2.2 AI 공급자 설정 (LM Studio 연동)

**파일**: `lib/ai/provider.ts`

```typescript
// Design Ref: §E.2
// 목적: AI 공급자 설정 (LM Studio OpenAI 호환 API)
// CSAP: 하드코딩 시크릿 금지 (D-12), 환경변수 전용

import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

// AI 공급자 유형 (환경변수로 전환)
type AIProviderType = 'LOCAL' | 'EXTERNAL'

const AI_PROVIDER = (process.env.AI_PROVIDER ?? 'LOCAL') as AIProviderType

// 로컬 LM Studio 연동 (host.docker.internal:1234 — Docker 내부 통신)
// WSL2 환경에서는 host.docker.internal이 Windows 호스트를 가리킴
const lmStudioProvider = createOpenAICompatible({
  name: 'lmstudio',
  baseURL:
    process.env.LM_STUDIO_BASE_URL ?? 'http://host.docker.internal:1234/v1',
  // LM Studio는 API 키 불필요 (로컬 전용)
  apiKey: 'not-required',
})

/**
 * 테넌트별 AI 모델 인스턴스 반환
 * N2SF O등급 데이터만 외부 전송 허용 — 로컬 LLM 우선
 */
export function getAIModel(tenantId: string) {
  // NOTE: 현재는 단일 모델. Phase 2에서 테넌트별 모델 설정 지원 예정.
  const modelId =
    process.env.LM_STUDIO_MODEL_ID ?? 'llama-3.2-8b-instruct'

  if (AI_PROVIDER === 'LOCAL') {
    // 로컬 LM Studio — C/S등급 포함 모든 데이터 처리 가능 (외부 전송 없음)
    return lmStudioProvider.chatModel(modelId)
  }

  // 외부 공급자는 O등급 데이터 + PII 마스킹 후에만 사용 (서버에서 재검증)
  throw new Error(
    'EXTERNAL AI 공급자는 서버 N2SF 검증 통과 후에만 사용 가능합니다.'
  )
}

/**
 * 페이지 컨텍스트 기반 시스템 프롬프트 생성
 */
export function buildSystemPrompt(pageContext: {
  route: string
  pageTitle: string
  dataType: string
}): string {
  return `당신은 공공기관 SaaS 시스템의 AI 어시스턴트입니다.
현재 사용자는 '${pageContext.pageTitle}' 페이지(경로: ${pageContext.route})를 보고 있습니다.
데이터 유형: ${pageContext.dataType}

다음 원칙을 항상 준수하십시오:
1. 공공기관 표준 용어와 경어체를 사용합니다.
2. 개인정보(주민번호, 연락처 등)는 절대 출력하지 않습니다.
3. CSAP, N2SF, 행안부 감리기준 관련 질문에는 정확한 조항 번호를 인용합니다.
4. 불확실한 내용은 추측하지 않고 공식 문서 확인을 안내합니다.`
}
```

### 2.3 AI 채팅 훅 (AI SDK 5)

**파일**: `hooks/use-ai-chat.ts`

```typescript
// Design Ref: §E.2
// Plan SC: FR-U.8
// 기술: AI SDK 5 — @ai-sdk/react useChat + DefaultChatTransport

'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useCallback } from 'react'
import { validateForAI, maskPII, type DataGrade } from '@/lib/n2sf/data-grade-validator'

export interface PageContextForAI {
  route: string
  pageTitle: string
  dataType: string
  dataGrade: DataGrade
}

export interface UseAIChatOptions {
  pageContext: PageContextForAI
  tenantId: string
  onError?: (error: Error) => void
}

/**
 * AI SDK 5 useChat 래퍼
 * N2SF 등급 검증 + PII 마스킹 통합
 */
export function useAIChat({ pageContext, tenantId, onError }: UseAIChatOptions) {
  const validation = validateForAI(pageContext.dataGrade)

  const chat = useChat({
    // AI SDK 5: DefaultChatTransport 사용
    transport: new DefaultChatTransport({
      api: '/api/ai/chat',
      body: {
        tenantId,
        // C/S등급 데이터 내용 제외 — 메타데이터만 전송
        pageContext: {
          route: pageContext.route,
          pageTitle: pageContext.pageTitle,
          dataType: pageContext.dataType,
          dataGrade: pageContext.dataGrade,
        },
      },
    }),

    onError: (error: Error) => {
      // N2SF 위반 차단 응답 처리
      if (error.message.includes('DATA_GRADE_BLOCKED')) {
        onError?.(
          new Error('N2SF 데이터 등급 정책에 의해 차단되었습니다 (N-05)')
        )
        return
      }
      onError?.(error)
    },
  })

  /**
   * 메시지 전송 (클라이언트 사전 검증 포함)
   * 1단계: N2SF 등급 확인
   * 2단계: PII 마스킹
   * 3단계: AI SDK sendMessage 호출
   */
  const sendMessage = useCallback(
    (text: string) => {
      // 1단계: N2SF 등급 사전 검증 (클라이언트)
      if (!validation.allowed) {
        onError?.(new Error(validation.reason))
        return
      }

      // 2단계: PII 마스킹 처리
      const maskedText = maskPII(text)

      // 3단계: AI SDK 5 sendMessage 호출
      chat.sendMessage({ text: maskedText })
    },
    [validation, chat, onError]
  )

  return {
    messages: chat.messages,
    isLoading: chat.status === 'streaming' || chat.status === 'submitted',
    sendMessage,
    isAIAllowed: validation.allowed,
    blockReason: validation.allowed ? null : validation.reason,
  }
}
```

### 2.4 AI 채팅 서버 API (SSE 스트리밍)

**파일**: `app/api/ai/chat/route.ts`

```typescript
// Design Ref: §E.2
// Plan SC: FR-U.8
// CSAP: D-06 감사 로그, D-08 접근 통제, N2SF N-05 이중 검증

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { validateForAI, maskPII } from '@/lib/n2sf/data-grade-validator'
import { getAIModel, buildSystemPrompt } from '@/lib/ai/provider'
import { auditLog } from '@/lib/audit/audit-logger'
import { verifyToken } from '@/lib/auth/rbac'
import { getClientIP } from '@/lib/utils/request'

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(['user', 'assistant', 'system']),
      parts: z.array(
        z.object({
          type: z.string(),
          text: z.string().optional(),
        })
      ),
    })
  ),
  tenantId: z.string().uuid(),
  pageContext: z.object({
    route: z.string().max(500),
    pageTitle: z.string().max(200),
    dataType: z.string().max(100),
    dataGrade: z.enum(['C', 'S', 'O']),
  }),
})

export async function POST(request: NextRequest) {
  // CSAP D-08: 인증 확인
  const user = await verifyToken(request.headers.get('Authorization'))
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  // CSAP D-12: 입력 검증
  const body = await request.json()
  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '요청 형식 오류', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { messages, tenantId, pageContext } = parsed.data

  // N2SF N-05: 서버 측 데이터 등급 재검증 (이중 검증 — 클라이언트 우회 방지)
  const gradeValidation = validateForAI(pageContext.dataGrade)
  if (!gradeValidation.allowed) {
    // CSAP D-06: 차단 이벤트 감사 로그
    await auditLog({
      actor: user.id,
      action: 'AI_CHAT_BLOCKED_N2SF',
      target: tenantId,
      metadata: {
        dataGrade: pageContext.dataGrade,
        reason: gradeValidation.reason,
        route: pageContext.route,
      },
      ip: getClientIP(request),
    })

    return NextResponse.json(
      { error: 'DATA_GRADE_BLOCKED', reason: gradeValidation.reason },
      { status: 422 }
    )
  }

  // 마지막 사용자 메시지 PII 마스킹 (서버 측 재처리)
  const sanitizedMessages = messages.map((msg) => ({
    ...msg,
    parts: msg.parts.map((part) => ({
      ...part,
      text: part.text ? maskPII(part.text) : part.text,
    })),
  }))

  try {
    // AI SDK 5: streamText + convertToModelMessages
    const result = streamText({
      model: getAIModel(tenantId),
      system: buildSystemPrompt(pageContext),
      messages: convertToModelMessages(sanitizedMessages as UIMessage[]),
    })

    // CSAP D-06: AI 호출 감사 로그 (메시지 내용 미포함 — 개인정보 보호)
    await auditLog({
      actor: user.id,
      action: 'AI_CHAT_REQUEST',
      target: tenantId,
      metadata: {
        dataGrade: pageContext.dataGrade,
        route: pageContext.route,
        messageCount: messages.length,
      },
      ip: getClientIP(request),
    })

    // AI SDK 5: UIMessageStreamResponse 반환 (SSE)
    return result.toUIMessageStreamResponse()
  } catch (error) {
    // 안전한 에러 응답 (스택 트레이스 미노출 — CSAP D-12)
    const errorId = crypto.randomUUID()
    console.error(`[AI Chat] 오류 (errorId: ${errorId}):`, error)

    return NextResponse.json(
      { error: '내부 서버 오류', errorId },
      { status: 500 }
    )
  }
}
```

### 2.5 AI 어시스턴트 사이드 패널

**파일**: `components/ai/ai-assistant-panel.tsx`

```typescript
// Design Ref: §E.1
// Plan SC: FR-U.7
// 접근성: KWCAG 2.2 — role="complementary", aria-label, 포커스 트랩

'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAIChat, type PageContextForAI } from '@/hooks/use-ai-chat'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import { DataGradeWarning } from './data-grade-warning'

interface AIAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
  pageContext: PageContextForAI
  tenantId: string
}

export function AIAssistantPanel({
  isOpen,
  onClose,
  pageContext,
  tenantId,
}: AIAssistantPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [chatError, setChatError] = useState<string | null>(null)

  const { messages, isLoading, sendMessage, isAIAllowed, blockReason } =
    useAIChat({
      pageContext,
      tenantId,
      onError: (error) => setChatError(error.message),
    })

  // 패널 열릴 때 닫기 버튼으로 포커스 이동 (접근성 — KWCAG 2.4.3)
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus()
    }
  }, [isOpen])

  // 포커스 트랩 (패널 내부에서 Tab 순환 — KWCAG 2.1.2)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return

      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    },
    [onClose]
  )

  // Ctrl+Shift+A 단축키 — 패널 토글
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        if (isOpen) onClose()
      }
    }
    document.addEventListener('keydown', handleGlobalKey)
    return () => document.removeEventListener('keydown', handleGlobalKey)
  }, [isOpen, onClose])

  return (
    <>
      {/* 오버레이 (모바일/태블릿) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      {/* AI 사이드 패널 */}
      <aside
        ref={panelRef}
        role="complementary"
        aria-label="AI 어시스턴트"
        aria-hidden={!isOpen}
        onKeyDown={handleKeyDown}
        className={cn(
          'fixed right-0 top-0 h-full flex flex-col',
          'bg-[var(--color-surface-raised)] border-l border-[var(--color-border)]',
          'transition-transform duration-200 ease-out',
          'z-50',
          // 반응형 너비
          'w-full md:w-80 lg:w-[360px] xl:w-[400px]',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          // 닫힌 상태에서 포커스 수신 방지
          !isOpen && 'pointer-events-none'
        )}
        tabIndex={-1}
      >
        {/* 헤더 */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* SparklesIcon은 lucide-react에서 import */}
            <span
              className="h-5 w-5 text-[var(--color-ai-accent)]"
              aria-hidden="true"
            >
              ✨
            </span>
            <h2 className="text-sm font-semibold">AI 어시스턴트</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="AI 패널 닫기 (Esc)"
            className={cn(
              'p-1.5 rounded-md',
              'hover:bg-[var(--color-muted)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
            )}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        {/* N2SF 등급 경고 (C/S등급 시) */}
        {!isAIAllowed && blockReason && (
          <DataGradeWarning
            grade={pageContext.dataGrade as 'C' | 'S'}
            reason={blockReason}
          />
        )}

        {/* 현재 컨텍스트 요약 */}
        <div className="px-4 py-2 bg-[var(--color-muted)] text-xs text-[var(--color-text-secondary)] flex-shrink-0">
          <span className="font-medium">현재 페이지:</span> {pageContext.pageTitle}
        </div>

        {/* 에러 메시지 */}
        {chatError && (
          <div
            role="alert"
            className="mx-4 mt-2 px-3 py-2 text-xs rounded-md bg-[var(--color-danger-bg)] text-[var(--color-danger)] flex-shrink-0"
          >
            {chatError}
            <button
              type="button"
              onClick={() => setChatError(null)}
              className="ml-2 underline"
              aria-label="오류 메시지 닫기"
            >
              닫기
            </button>
          </div>
        )}

        {/* 메시지 영역 (스크롤) */}
        <div
          className="flex-1 overflow-y-auto"
          role="log"
          aria-label="AI 대화 내역"
          aria-live="polite"
        >
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-tertiary)] px-4 text-center">
              {isAIAllowed
                ? '질문을 입력하면 AI가 현재 페이지 컨텍스트를 바탕으로 도움을 드립니다.'
                : 'AI 어시스턴트를 사용하려면 O등급 데이터 페이지로 이동하십시오.'}
            </div>
          )}
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              role={message.role as 'user' | 'assistant'}
              // AI SDK 5: parts 배열에서 텍스트 추출
              content={
                message.parts
                  .filter((p) => p.type === 'text')
                  .map((p) => (p as { type: 'text'; text: string }).text)
                  .join('') ?? ''
              }
              isStreaming={
                isLoading &&
                index === messages.length - 1 &&
                message.role === 'assistant'
              }
            />
          ))}
        </div>

        {/* 채팅 입력창 */}
        <div className="flex-shrink-0 border-t border-[var(--color-border)]">
          <ChatInput
            onSend={sendMessage}
            disabled={!isAIAllowed || isLoading}
            placeholder={
              isAIAllowed
                ? '질문을 입력하세요... (Enter로 전송)'
                : 'AI 사용이 제한된 데이터 등급입니다'
            }
            isLoading={isLoading}
          />
        </div>
      </aside>
    </>
  )
}
```

### 2.6 AI 채팅 메시지 컴포넌트

**파일**: `components/ai/chat-message.tsx`

```typescript
// Design Ref: §E.3
// Plan SC: FR-U.8

'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  timestamp?: Date
}

export function ChatMessage({
  role,
  content,
  isStreaming = false,
  timestamp,
}: ChatMessageProps) {
  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3',
        role === 'user'
          ? 'bg-[var(--color-ai-message-user,var(--color-muted))]'
          : 'bg-transparent'
      )}
    >
      {/* 아바타 */}
      <div className="flex-shrink-0 mt-0.5" aria-hidden="true">
        {role === 'assistant' ? (
          <div className="w-6 h-6 rounded-full bg-[var(--color-ai-accent,var(--color-primary))] flex items-center justify-center text-white text-xs">
            AI
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-[var(--color-muted)] flex items-center justify-center text-xs">
            나
          </div>
        )}
      </div>

      {/* 메시지 본문 */}
      <div className="flex-1 min-w-0">
        <div
          className="prose prose-sm max-w-none text-[var(--color-text-primary)] [&_code]:text-xs [&_pre]:bg-[var(--color-muted)] [&_pre]:rounded [&_pre]:p-2"
          aria-label={role === 'user' ? '사용자 메시지' : 'AI 응답'}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // 코드 블록 스타일
              code({ className, children, ...props }) {
                return (
                  <code
                    className={cn('bg-[var(--color-muted)] rounded px-1', className)}
                    {...props}
                  >
                    {children}
                  </code>
                )
              },
              // 외부 링크 새 탭 열기
              a({ children, href, ...props }) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                  >
                    {children}
                  </a>
                )
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {/* 스트리밍 타이핑 인디케이터 */}
        {isStreaming && (
          <div
            className="flex items-center gap-1 mt-2"
            aria-live="polite"
            aria-label="AI가 응답을 생성 중입니다"
          >
            <span className="sr-only">AI가 응답을 생성 중입니다</span>
            <span
              className="inline-flex gap-1"
              aria-hidden="true"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[var(--color-ai-accent,var(--color-primary))] animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </span>
          </div>
        )}

        {/* 타임스탬프 */}
        {!isStreaming && timestamp && (
          <time
            className="block mt-1 text-xs text-[var(--color-text-tertiary)]"
            dateTime={timestamp.toISOString()}
          >
            {timestamp.toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        )}
      </div>
    </div>
  )
}
```

### 2.7 채팅 입력창

**파일**: `components/ai/chat-input.tsx`

```typescript
// Design Ref: §E.2
// 목적: 자동 크기 조정 텍스트 영역 + 전송 버튼

'use client'

import { useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled?: boolean
  placeholder?: string
  isLoading?: boolean
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = '질문을 입력하세요...',
  isLoading = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 텍스트 영역 높이 자동 조정
  const handleInput = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
  }, [])

  const handleSend = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const text = textarea.value.trim()
    if (!text || disabled) return

    onSend(text)
    textarea.value = ''
    textarea.style.height = 'auto'
  }, [disabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter: 전송 / Shift+Enter: 줄바꿈
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div className="flex items-end gap-2 p-3">
      <textarea
        ref={textareaRef}
        rows={1}
        disabled={disabled}
        placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        aria-label="AI에게 메시지 입력"
        aria-describedby="chat-input-hint"
        className={cn(
          'flex-1 resize-none rounded-lg px-3 py-2 text-sm',
          'bg-[var(--color-surface)] border border-[var(--color-border)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'min-h-[40px] max-h-40 overflow-y-auto'
        )}
      />
      <span id="chat-input-hint" className="sr-only">
        Enter 키로 전송, Shift+Enter로 줄바꿈
      </span>
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || isLoading}
        aria-label={isLoading ? 'AI 응답 대기 중' : '메시지 전송'}
        className={cn(
          'flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center',
          'bg-[var(--color-primary)] text-[var(--color-on-primary)]',
          'hover:bg-[var(--color-primary-hover)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors'
        )}
      >
        {isLoading ? (
          <span aria-hidden="true" className="animate-spin text-sm">
            ⟳
          </span>
        ) : (
          <span aria-hidden="true">↑</span>
        )}
      </button>
    </div>
  )
}
```

### 2.8 N2SF 데이터 등급 경고 컴포넌트

**파일**: `components/ai/data-grade-warning.tsx`

```typescript
// Design Ref: §E.7
// Plan SC: NFR-U.8
// 목적: AI 사용 차단 시 시각적 경고 표시

'use client'

import { cn } from '@/lib/utils'

interface DataGradeWarningProps {
  grade: 'C' | 'S'
  reason: string
  className?: string
}

export function DataGradeWarning({ grade, reason, className }: DataGradeWarningProps) {
  const config = {
    C: {
      label: '기밀 (C등급)',
      bgClass: 'bg-[var(--color-danger-bg,#fef2f2)]',
      borderClass: 'border-[var(--color-danger,#ef4444)]',
      textClass: 'text-[var(--color-danger,#ef4444)]',
      icon: '🔴',
    },
    S: {
      label: '민감 (S등급)',
      bgClass: 'bg-[var(--color-warning-bg,#fffbeb)]',
      borderClass: 'border-[var(--color-warning,#f59e0b)]',
      textClass: 'text-[var(--color-warning,#b45309)]',
      icon: '🟡',
    },
  }

  const c = config[grade]

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'mx-4 mt-3 p-3 rounded-md border',
        c.bgClass,
        c.borderClass,
        className
      )}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="flex-shrink-0 mt-0.5">
          {c.icon}
        </span>
        <div>
          <p className={cn('text-sm font-medium', c.textClass)}>
            AI 사용 차단 — {c.label}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {reason}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
            N2SF N-05 데이터 보안 정책에 따라 현재 페이지 데이터는
            AI API로 전송할 수 없습니다.
          </p>
        </div>
      </div>
    </div>
  )
}
```

### 2.9 AI 인라인 제안 컴포넌트

**파일**: `components/ai/inline-suggestion.tsx`

```typescript
// Design Ref: §E.4
// Plan SC: FR-U.9
// 목적: 테이블/폼 컨텍스트에 AI 제안 팝업 표시

'use client'

import { cn } from '@/lib/utils'

export interface SuggestionAction {
  id: string
  label: string
  handler: () => void
}

export interface AISuggestion {
  id: string
  type: 'table-action' | 'form-completion' | 'data-insight'
  content: string
  confidence: number  // 0~1 신뢰도
  actions: SuggestionAction[]
}

interface InlineSuggestionProps {
  suggestion: AISuggestion
  onDismiss: () => void
  className?: string
}

export function InlineSuggestion({
  suggestion,
  onDismiss,
  className,
}: InlineSuggestionProps) {
  // 신뢰도 70% 미만은 표시하지 않음 (노이즈 방지)
  if (suggestion.confidence < 0.7) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="AI 인라인 제안"
      className={cn(
        'border border-[var(--color-ai-border,var(--color-border))] rounded-lg p-3',
        'bg-[var(--color-ai-bg,var(--color-surface-raised))]',
        'animate-in fade-in slide-in-from-top-2 duration-200',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className="text-[var(--color-ai-accent,var(--color-primary))] flex-shrink-0 mt-0.5 text-base"
          aria-hidden="true"
        >
          💡
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--color-text-primary)]">
            {suggestion.content}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {suggestion.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.handler}
                className={cn(
                  'text-xs px-3 py-1 rounded-md',
                  'bg-[var(--color-primary)] text-[var(--color-on-primary)]',
                  'hover:bg-[var(--color-primary-hover)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                )}
              >
                {action.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="이 제안 무시"
              className={cn(
                'text-xs text-[var(--color-text-tertiary)]',
                'hover:text-[var(--color-text-secondary)] hover:underline',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded'
              )}
            >
              무시
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 2.10 AI 자동화 트리거 배너

**파일**: `components/ai/automation-banner.tsx`

```typescript
// Design Ref: §E.5
// Plan SC: FR-U.10
// 목적: 반복 작업 패턴 감지 → 자동화 제안 배너

'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

interface RecentAction {
  route: string
  actionType: string
  actionName: string
  timestamp: Date
}

interface AutomationTrigger {
  id: string
  title: string
  description: string
  frequency: number
  suggestedAction: string
}

interface AutomationBannerProps {
  triggers: AutomationTrigger[]
  onSetupAutomation: (triggerId: string) => void
  onDismissForever: (triggerId: string) => void
}

/**
 * 최근 7일 액션 기록에서 반복 패턴 감지
 */
export function useAutomationDetector(
  recentActions: RecentAction[]
): AutomationTrigger[] {
  return useMemo(() => {
    const triggers: AutomationTrigger[] = []

    // 동일 페이지 + 동일 액션 타입으로 그룹핑
    const grouped = recentActions.reduce<Record<string, RecentAction[]>>(
      (acc, action) => {
        const key = `${action.route}:${action.actionType}`
        if (!acc[key]) acc[key] = []
        acc[key].push(action)
        return acc
      },
      {}
    )

    for (const [, actions] of Object.entries(grouped)) {
      // 3회 이상 반복 시 자동화 제안
      if (actions.length >= 3) {
        const sample = actions[0]
        triggers.push({
          id: `repeat-${sample.route}-${sample.actionType}`,
          title: '반복 작업 감지',
          description: `지난 7일간 '${sample.actionName}'을(를) ${actions.length}회 수동 실행했습니다.`,
          frequency: actions.length,
          suggestedAction: '자동 스케줄 설정',
        })
      }
    }

    return triggers
  }, [recentActions])
}

export function AutomationBanner({
  triggers,
  onSetupAutomation,
  onDismissForever,
}: AutomationBannerProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const visibleTriggers = triggers.filter((t) => !dismissedIds.has(t.id))

  if (visibleTriggers.length === 0) return null

  return (
    <div className="space-y-2" role="region" aria-label="AI 자동화 제안">
      {visibleTriggers.map((trigger) => (
        <div
          key={trigger.id}
          role="alert"
          className={cn(
            'flex items-start gap-3 px-4 py-3 rounded-lg',
            'bg-[var(--color-ai-bg,var(--color-surface-raised))]',
            'border border-[var(--color-ai-border,var(--color-border))]',
            'animate-in fade-in slide-in-from-top-1 duration-200'
          )}
        >
          <span aria-hidden="true" className="flex-shrink-0 mt-0.5">
            ⚡
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {trigger.title}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {trigger.description}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <button
                type="button"
                onClick={() => onSetupAutomation(trigger.id)}
                className={cn(
                  'text-xs px-3 py-1 rounded-md',
                  'bg-[var(--color-primary)] text-[var(--color-on-primary)]',
                  'hover:bg-[var(--color-primary-hover)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                )}
              >
                자동화 설정
              </button>
              <button
                type="button"
                onClick={() =>
                  setDismissedIds((prev) => new Set([...prev, trigger.id]))
                }
                className="text-xs text-[var(--color-text-tertiary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
              >
                이번만 무시
              </button>
              <button
                type="button"
                onClick={() => {
                  onDismissForever(trigger.id)
                  setDismissedIds((prev) => new Set([...prev, trigger.id]))
                }}
                className="text-xs text-[var(--color-text-tertiary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
              >
                다시 표시하지 않음
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

### 2.11 AI 명령 팔레트 (Cmd+K)

**파일**: `components/ai/command-palette.tsx`

```typescript
// Design Ref: §E.6
// Plan SC: FR-U.11
// 기술: shadcn/ui Command 컴포넌트 (cmdk 기반)
// 단축키: Cmd+K (macOS) / Ctrl+K (Windows/Linux)

'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useRouter } from 'next/navigation'

// 명령 정의 타입
interface CommandDefinition {
  id: string
  label: string
  description?: string
  shortcut?: string
  icon?: string
  action: () => void
  group: 'ai' | 'navigation' | 'settings' | 'recent'
}

interface CommandPaletteProps {
  pageRoute?: string
  onOpenAIPanel?: () => void
  onToggleDarkMode?: () => void
  onToggleSidebar?: () => void
}

export function CommandPalette({
  pageRoute = '/',
  onOpenAIPanel,
  onToggleDarkMode,
  onToggleSidebar,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  // Cmd+K / Ctrl+K 단축키 등록
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const closeAndRun = useCallback((action: () => void) => {
    setOpen(false)
    // 팔레트 닫힘 애니메이션 후 액션 실행
    setTimeout(action, 50)
  }, [])

  // 페이지 컨텍스트 기반 AI 명령 목록
  const aiCommands: CommandDefinition[] = [
    {
      id: 'ai-open',
      label: 'AI 어시스턴트 열기',
      icon: '✨',
      shortcut: 'Ctrl+Shift+A',
      action: () => onOpenAIPanel?.(),
      group: 'ai',
    },
    {
      id: 'ai-summarize',
      label: '현재 페이지 요약',
      description: 'AI가 현재 페이지 내용을 요약합니다',
      icon: '📄',
      action: () => {
        onOpenAIPanel?.()
        // NOTE: AI 패널 열린 후 자동 요약 요청은 Phase 2에서 구현 예정 (FR-U.11 확장)
      },
      group: 'ai',
    },
    {
      id: 'ai-csap-analysis',
      label: 'CSAP 미충족 항목 분석',
      description: 'AI가 현재 CSAP 체크리스트를 분석합니다',
      icon: '🔍',
      action: () => onOpenAIPanel?.(),
      group: 'ai',
    },
    {
      id: 'ai-report-draft',
      label: '보고서 초안 생성',
      description: 'AI가 현재 데이터 기반 보고서 초안을 작성합니다',
      icon: '📝',
      action: () => onOpenAIPanel?.(),
      group: 'ai',
    },
  ]

  const navigationCommands: CommandDefinition[] = [
    {
      id: 'nav-dashboard',
      label: '대시보드',
      icon: '🏠',
      action: () => router.push('/dashboard'),
      group: 'navigation',
    },
    {
      id: 'nav-csap',
      label: 'CSAP 체크리스트',
      icon: '✅',
      action: () => router.push('/csap/checklist'),
      group: 'navigation',
    },
    {
      id: 'nav-n2sf',
      label: 'N2SF 매핑 현황',
      icon: '🗺️',
      action: () => router.push('/n2sf/mapping'),
      group: 'navigation',
    },
    {
      id: 'nav-audit',
      label: '감리 산출물',
      icon: '📋',
      action: () => router.push('/audit/documents'),
      group: 'navigation',
    },
  ]

  const settingsCommands: CommandDefinition[] = [
    {
      id: 'set-dark-mode',
      label: '다크 모드 전환',
      icon: '🌙',
      action: () => onToggleDarkMode?.(),
      group: 'settings',
    },
    {
      id: 'set-sidebar',
      label: '사이드바 접기/펼치기',
      icon: '⬅️',
      action: () => onToggleSidebar?.(),
      group: 'settings',
    },
    {
      id: 'set-theme',
      label: '테마 설정',
      icon: '🎨',
      action: () => router.push('/admin/theme'),
      group: 'settings',
    },
  ]

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="명령을 입력하거나 검색하세요..."
        aria-label="명령 검색"
      />
      <CommandList>
        <CommandEmpty>
          <span className="text-sm text-[var(--color-text-tertiary)]">
            일치하는 명령이 없습니다.
          </span>
        </CommandEmpty>

        {/* AI 명령 그룹 */}
        <CommandGroup heading="AI 명령">
          {aiCommands.map((cmd) => (
            <CommandItem
              key={cmd.id}
              value={`${cmd.label} ${cmd.description ?? ''}`}
              onSelect={() => closeAndRun(cmd.action)}
            >
              <span aria-hidden="true" className="mr-2">
                {cmd.icon}
              </span>
              <span className="flex-1">{cmd.label}</span>
              {cmd.shortcut && (
                <kbd className="ml-2 text-xs text-[var(--color-text-tertiary)] border border-[var(--color-border)] rounded px-1.5 py-0.5">
                  {cmd.shortcut}
                </kbd>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* 페이지 이동 그룹 */}
        <CommandGroup heading="페이지 이동">
          {navigationCommands.map((cmd) => (
            <CommandItem
              key={cmd.id}
              value={cmd.label}
              onSelect={() => closeAndRun(cmd.action)}
            >
              <span aria-hidden="true" className="mr-2">
                {cmd.icon}
              </span>
              <span>{cmd.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* 빠른 설정 그룹 */}
        <CommandGroup heading="빠른 설정">
          {settingsCommands.map((cmd) => (
            <CommandItem
              key={cmd.id}
              value={cmd.label}
              onSelect={() => closeAndRun(cmd.action)}
            >
              <span aria-hidden="true" className="mr-2">
                {cmd.icon}
              </span>
              <span>{cmd.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

---

## 3. 감사 로그 통합 (CSAP D-06)

**파일**: `lib/audit/audit-logger.ts`

```typescript
// CSAP D-06: 침해사고 관리 — 감사 로그
// 목적: 테마 변경 + AI 호출 전수 기록 (append-only)
// 출력: .claude/audit.jsonl (로컬), DB audit_logs 테이블 (운영)

import { appendFile } from 'fs/promises'
import path from 'path'

export type AuditAction =
  | 'TENANT_THEME_UPDATE'
  | 'AI_CHAT_REQUEST'
  | 'AI_CHAT_BLOCKED_N2SF'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_DELETE'
  | 'PERMISSION_CHANGE'

export interface AuditLogEntry {
  id?: string
  timestamp?: string
  actor: string           // 사용자 ID
  action: AuditAction
  target: string          // 대상 리소스 ID
  metadata?: Record<string, unknown>
  ip?: string
  userAgent?: string
}

/**
 * 감사 로그 기록 (append-only — CSAP D-06)
 * 개발: .claude/audit.jsonl 파일
 * 운영: DB audit_logs 테이블 (별도 구현)
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  const record = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  }

  // 개발 환경: 파일 append-only 기록
  if (process.env.NODE_ENV !== 'production') {
    const logPath = path.join(process.cwd(), '.claude', 'audit.jsonl')
    try {
      await appendFile(logPath, JSON.stringify(record) + '\n', 'utf-8')
    } catch {
      // 파일 쓰기 실패 시 콘솔 fallback (운영 환경에서는 DB 사용)
      console.log('[AUDIT]', JSON.stringify(record))
    }
    return
  }

  // 운영 환경: DB 기록 (prisma.auditLog.create — Phase 2 구현 예정)
  // NOTE: 미사용. Phase 2 DB 감사 로그 구현 시 활성화 예정 (FR-2.x).
  console.log('[AUDIT]', JSON.stringify(record))
}
```

---

## 4. 유틸리티 함수

**파일**: `lib/utils/request.ts`

```typescript
// 목적: 요청 IP 추출 유틸리티 (감사 로그용)

import { type NextRequest } from 'next/server'

/**
 * 클라이언트 IP 추출 (프록시/로드밸런서 헤더 우선)
 */
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}
```

---

## 5. 환경 변수 설정

**파일**: `.env.local.example` (커밋 금지 — `.env.local`은 .gitignore 대상)

```bash
# 데이터베이스
DATABASE_URL="postgresql://user:password@localhost:5432/public_saas?schema=public"

# AI 공급자 설정
AI_PROVIDER="LOCAL"
LM_STUDIO_BASE_URL="http://host.docker.internal:1234/v1"
LM_STUDIO_MODEL_ID="llama-3.2-8b-instruct"

# 내부 API (Edge Middleware → API 통신용)
INTERNAL_API_BASE="http://localhost:3000"

# 암호화 키 (AES-256 — CSAP D-09)
ENCRYPTION_KEY="(32바이트 이상 랜덤 문자열 — 운영 환경에서는 HSM/KMS 관리)"

# JWT 시크릿
JWT_SECRET="(운영 환경에서는 HSM/KMS 관리)"
```

---

## 6. 추적성 매트릭스 (Session 3)

| FR/NFR ID | Design 섹션 | 구현 파일 | CSAP/N2SF | 테스트 포인트 |
|-----------|-----------|---------|-----------|------------|
| FR-U.5 | D.2, D.3 | `prisma/schema.prisma`, `lib/theme/css-generator.ts`, `app/api/themes/[tenantId]/route.ts` | — | CSS 생성 검증, DB CRUD |
| FR-U.6 | D.4 | `components/admin/theme-configurator.tsx`, `app/api/tenant/theme/route.ts` | D-06, D-08, D-12 | 테마 저장 + 감사 로그 확인 |
| FR-U.5 | D.5 | `middleware.ts`, `lib/tenant/domain-resolver.ts` | — | 도메인 매핑, x-tenant-id 헤더 |
| FR-U.7 | E.1 | `components/ai/ai-assistant-panel.tsx` | N2SF N-05 | 패널 열기/닫기, 포커스 트랩 |
| FR-U.8 | E.2 | `hooks/use-ai-chat.ts`, `app/api/ai/chat/route.ts` | D-06, D-08, N-05 | SSE 스트리밍, C/S등급 차단 |
| FR-U.8 | E.3 | `components/ai/chat-message.tsx`, `components/ai/chat-input.tsx` | — | 마크다운 렌더링, 스트리밍 표시 |
| FR-U.9 | E.4 | `components/ai/inline-suggestion.tsx` | — | 신뢰도 임계값, 수락/무시 |
| FR-U.10 | E.5 | `components/ai/automation-banner.tsx` | — | 반복 패턴 감지, 배너 표시 |
| FR-U.11 | E.6 | `components/ai/command-palette.tsx` | — | Cmd+K, 명령 검색, 실행 |
| NFR-U.8 | E.7 | `lib/n2sf/data-grade-validator.ts`, `components/ai/data-grade-warning.tsx` | N2SF N-05 | C/S등급 클라이언트+서버 이중 차단 |
| — | §E | `lib/ai/provider.ts` | N2SF N-05 | LM Studio 연동, 환경변수 전용 |
| — | 전체 | `lib/audit/audit-logger.ts` | CSAP D-06 | append-only 로그, 무결성 |

---

## 7. 보안 체크리스트 (구현 전 확인)

| 항목 | 기준 | 확인 방법 |
|------|------|---------|
| N2SF C/S등급 클라이언트 차단 | `validateForAI()` 반환값 확인 | 단위 테스트 |
| N2SF C/S등급 서버 재검증 | `/api/ai/chat` 422 응답 | 통합 테스트 |
| 하드코딩 시크릿 없음 | grep으로 전수 확인 | `npm run audit:dead-code` |
| 감사 로그 기록 | `audit.jsonl` append 확인 | 로그 파일 검사 |
| RBAC 모든 API 적용 | `verifyToken` + `hasPermission` 호출 | 코드 리뷰 |
| 입력 검증 (Zod) | 모든 API 라우트 | 코드 리뷰 |
| CSS 주입 방지 | `sanitizeColorValue()` 정규식 | 단위 테스트 |
| SQL 주입 방지 | Prisma 매개변수화 쿼리 전용 | 코드 리뷰 |
| 환경변수 누락 시 오류 | 시작 시 검증 | 통합 테스트 |
| KWCAG 포커스 트랩 | AI 패널 키보드 순환 | Playwright 테스트 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — MTU-U1 Session 3 구현 가이드 (섹션 D, E) | Claude Code |
| — | — | AI SDK 5 (`@ai-sdk/react`, `DefaultChatTransport`, `UIMessage`) 최신 API 반영 | — |
| — | — | LM Studio `createOpenAICompatible` 연동 코드 포함 | — |
| — | — | N2SF 이중 검증 (클라이언트 `validateForAI` + 서버 422 차단) 완비 | — |
