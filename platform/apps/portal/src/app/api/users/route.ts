// Design Ref: §사용자 목록 API
// Plan SC: FR-UP.4
// CSAP: D-08 접근 통제, D-09 PII 보호 (passwordHash 절대 미반환), D-12 입력 검증

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DB 의존 API — 빌드 시 정적 생성 방지
export const dynamic = 'force-dynamic'

export interface UserListItem {
  id: string
  email: string
  name: string
  role: string
  tenantName: string
  lastLoginAt: string | null
}

export interface UserListResponse {
  users: UserListItem[]
  total: number
}

// Plan SC: FR-UP.4 — 사용자 목록 조회 (PII 최소화)
export async function GET(
  request: NextRequest
): Promise<NextResponse<UserListResponse | { error: string }>> {
  try {
    const { searchParams } = request.nextUrl

    // CSAP D-12: 입력 검증
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { tenant: { slug: { not: 'platform-internal' } } },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          lastLoginAt: true,
          // CSAP D-09: passwordHash, mfaSecret 절대 선택 금지
          tenant: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({
        where: { tenant: { slug: { not: 'platform-internal' } } },
      }),
    ])

    const userList: UserListItem[] = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantName: user.tenant.name,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    }))

    return NextResponse.json({ users: userList, total })
  } catch (error) {
    console.error('[API] /api/users 오류:', error)
    return NextResponse.json(
      { error: '사용자 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
