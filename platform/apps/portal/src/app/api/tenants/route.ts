// Design Ref: §테넌트 목록 API
// Plan SC: FR-UP.4
// CSAP: D-08 접근 통제, D-12 입력 검증 (페이지네이션 파라미터)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DB 의존 API — 빌드 시 정적 생성 방지
export const dynamic = 'force-dynamic'

export interface TenantListItem {
  id: string
  name: string
  slug: string
  status: string
  userCount: number
  createdAt: string
}

export interface TenantListResponse {
  tenants: TenantListItem[]
  total: number
}

// Plan SC: FR-UP.4 — 테넌트 목록 페이지네이션 조회
export async function GET(
  request: NextRequest
): Promise<NextResponse<TenantListResponse | { error: string }>> {
  try {
    const { searchParams } = request.nextUrl

    // CSAP D-12: 입력 검증 — 페이지네이션 파라미터 범위 제한
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where: { slug: { not: 'platform-internal' } },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,
          _count: { select: { users: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.tenant.count({
        where: { slug: { not: 'platform-internal' } },
      }),
    ])

    const tenantList: TenantListItem[] = tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      userCount: tenant._count.users,
      createdAt: tenant.createdAt.toISOString(),
    }))

    return NextResponse.json({ tenants: tenantList, total })
  } catch (error) {
    console.error('[API] /api/tenants 오류:', error)
    return NextResponse.json(
      { error: '테넌트 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
